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
