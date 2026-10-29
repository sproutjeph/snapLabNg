import type { QualityTier } from "../apparatus/meter-bridge/types";

export interface DeviceSignals {
  gpu: string | null;
  deviceMemoryGb: number | null;
  cores: number | null;
  isMobile: boolean;
  warmupFps: number | null;
}

export interface QualitySettings {
  dpr: [number, number];
  bloom: boolean;
  shadows: boolean;
  maxParticles: number;
  physicalGlass: boolean;
  segments: number;
}

const WEAK_GPU_PATTERNS: RegExp[] = [
  /PowerVR/i,
  /Mali-G5\d/i,
  /Mali-G3\d/i,
  /Mali-T/i,
  /Adreno \(TM\) [3-5]\d\d/i,
  /Adreno \(TM\) 6[0-1]\d/i,
  /Intel\(R\) HD Graphics/i,
];

const SETTINGS: Record<QualityTier, QualitySettings> = {
  low: {
    dpr: [1, 1],
    bloom: false,
    shadows: false,
    maxParticles: 150,
    physicalGlass: false,
    segments: 0.5,
  },
  mid: {
    dpr: [1, 1.5],
    bloom: true,
    // Real soft shadows on mid too (docs/plans/exam-redesign.md, "The look": 1024 on mid).
    shadows: true,
    maxParticles: 400,
    physicalGlass: false,
    segments: 0.75,
  },
  high: {
    dpr: [1, 2],
    bloom: true,
    shadows: true,
    maxParticles: 1000,
    physicalGlass: true,
    segments: 1,
  },
};

function isWeakGpu(gpu: string | null): boolean {
  if (gpu === null) return false;
  return WEAK_GPU_PATTERNS.some((pattern) => pattern.test(gpu));
}

export function chooseTier(signals: DeviceSignals): QualityTier {
  if (signals.warmupFps !== null && signals.warmupFps < 30) return "low";
  if (signals.deviceMemoryGb !== null && signals.deviceMemoryGb <= 3) return "low";
  if (isWeakGpu(signals.gpu)) return "low";
  if (signals.warmupFps !== null && signals.warmupFps < 50) return "mid";
  if (signals.isMobile) return "mid";
  return "high";
}

export function settingsFor(tier: QualityTier): QualitySettings {
  const settings = SETTINGS[tier];
  return { ...settings, dpr: [settings.dpr[0], settings.dpr[1]] };
}

export function stepDown(tier: QualityTier): QualityTier {
  if (tier === "high") return "mid";
  return "low";
}

export function parseOverride(search: string): QualityTier | null {
  let value: string | null;
  try {
    value = new URLSearchParams(search).get("quality");
  } catch {
    return null;
  }
  if (value === "low" || value === "mid" || value === "high") return value;
  return null;
}

/**
 * The ink outline per tier (docs/plans/ink-look.md). Kept apart from QualitySettings so the
 * existing settings stay exactly as they were.
 *   - "ink": a post pass with depth, normal and ink-ID edges; `scale` is the ID target's size.
 *   - "hull": no post pass; inverted-hull lines on the parts (`scale` unused).
 * Low was chosen by measuring `?kit=ohms-law&quality=low` in the headless shot (Oct 28, four
 * interleaved rounds): no outline at all 41–47 fps on the laptop viewport, depth-only edges at
 * 0.5× 27–31, inverted hulls 42–45; the phone viewport held 60 with each.
 */
export type OutlineMode = "ink" | "hull";

export interface OutlineSettings {
  mode: OutlineMode;
  scale: number;
  /**
   * MSAA samples for the composer's scene buffer (WebGL2). On since the user's golden-frame
   * review (Oct 30, "looking pixelated"): 4× on high, 2× on mid. Low has no composer; the
   * canvas's own antialias (MSAA on the default framebuffer) smooths its hull lines.
   */
  multisampling: number;
  /** FXAA after the ink pass, so the ink lines (drawn per pixel, after MSAA) get smooth edges. */
  fxaa: boolean;
}

const OUTLINE: Record<QualityTier, OutlineSettings> = {
  low: { mode: "hull", scale: 1, multisampling: 0, fxaa: false },
  mid: { mode: "ink", scale: 0.75, multisampling: 2, fxaa: true },
  high: { mode: "ink", scale: 1, multisampling: 4, fxaa: true },
};

export function outlineFor(tier: QualityTier): OutlineSettings {
  return { ...OUTLINE[tier] };
}

/**
 * The look recipe per tier (docs/plans/exam-redesign.md, "The look" and "Performance"): the
 * shadow map's size and the pixel-ratio ladder, which QualitySettings does not carry. Real soft
 * shadows on mid (1024) and high (2048), matching `shadows`; low has none (blob shadows only).
 */
export interface LookSettings {
  /** Side of the key light's shadow map; 0 means no shadow map. */
  shadowMapSize: number;
  /** The pixel-ratio ladder from the top rung down; the canvas starts on the first rung. */
  dprLadder: readonly number[];
}

/** Backcountry 101's pixel-ratio ladder (research report 2). */
export const DPR_LADDER: readonly number[] = [2, 1.5, 1.25, 1];
/** A frame slower than this counts against the current rung. */
export const DPR_SLOW_FRAME_MS = 25;
/** Frames judged together. */
export const DPR_WINDOW_FRAMES = 90;
/** More slow frames than this in one window steps the ratio down a rung. */
export const DPR_SLOW_LIMIT = 60;

const LOOK: Record<QualityTier, { shadowMapSize: number; maxDpr: number }> = {
  low: { shadowMapSize: 0, maxDpr: 1 },
  mid: { shadowMapSize: 1024, maxDpr: 1.5 },
  high: { shadowMapSize: 2048, maxDpr: 2 },
};

/** On mid and high the ladder never steps below min(device ratio, this). */
export const DPR_FLOOR_SHARP = 1.5;

/**
 * The look settings for `tier`. The ladder starts at the tier's top, capped at the device's own
 * ratio, and never goes below 1, nor on mid and high below min(device ratio, 1.5), so a slow
 * frame never makes a Retina phone render soft.
 */
export function lookFor(tier: QualityTier, devicePixelRatio = 2): LookSettings {
  const { shadowMapSize, maxDpr } = LOOK[tier];
  const device = Math.max(1, devicePixelRatio);
  const top = Math.max(1, Math.min(maxDpr, device));
  const floor = tier === "low" ? 1 : Math.min(top, Math.max(1, Math.min(device, DPR_FLOOR_SHARP)));
  const rungs = DPR_LADDER.filter((d) => d <= top && d >= floor);
  const dprLadder = rungs[0] === top ? rungs : [top, ...rungs];
  return { shadowMapSize, dprLadder };
}

/**
 * The rung after one window of frames: one step down when more than DPR_SLOW_LIMIT of
 * DPR_WINDOW_FRAMES were slow, otherwise the same. Never below the last rung, never back up.
 */
export function nextDprRung(ladder: readonly number[], rung: number, slowFrames: number): number {
  const last = Math.max(0, ladder.length - 1);
  const current = Math.max(0, Math.min(last, rung));
  return slowFrames > DPR_SLOW_LIMIT ? Math.min(last, current + 1) : current;
}
