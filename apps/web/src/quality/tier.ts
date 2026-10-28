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
    shadows: false,
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
   * MSAA samples for the composer's scene buffer. 0 on every tier: each geometric edge carries
   * an ink line, so 4× MSAA changed nothing visible and cost about a third of the frame in the
   * headless shot (high: 30 → 45 fps phone, 10 → 15 laptop).
   */
  multisampling: number;
}

const OUTLINE: Record<QualityTier, OutlineSettings> = {
  low: { mode: "hull", scale: 1, multisampling: 0 },
  mid: { mode: "ink", scale: 0.75, multisampling: 0 },
  high: { mode: "ink", scale: 1, multisampling: 0 },
};

export function outlineFor(tier: QualityTier): OutlineSettings {
  return { ...OUTLINE[tier] };
}
