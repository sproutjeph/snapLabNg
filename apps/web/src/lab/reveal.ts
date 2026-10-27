/** The reveal, in seconds: the ink glows, sparks lift off, the kit rises, the camera moves. */
const GLOW = { from: 0, to: 1.2 } as const;
const SPARKS = { from: 0.8, to: 3.0 } as const;
const RISE = { from: 2.6, to: 4.6 } as const;
const CAMERA = { from: 1.2, to: 3.6 } as const;

export const REVEAL_S = 4.6;

export interface RevealPhases {
  glow: number;
  sparks: number;
  rise: number;
  camera: number;
}

const span = (t: number, w: { from: number; to: number }) =>
  Math.min(1, Math.max(0, (t - w.from) / (w.to - w.from)));

/** Writes the phases at time `tS` into `out` (no allocation, for the render loop). */
export function revealInto(tS: number, out: RevealPhases, reducedMotion = false): RevealPhases {
  const t = reducedMotion ? REVEAL_S : tS;
  out.glow = span(t, GLOW);
  out.sparks = span(t, SPARKS);
  out.rise = span(t, RISE);
  out.camera = span(t, CAMERA);
  return out;
}

/** Phases at time `tS` (each 0–1, never decreasing). Reduced motion ends the reveal at once. */
export function revealAt(tS: number, reducedMotion = false): RevealPhases {
  return revealInto(tS, { glow: 0, sparks: 0, rise: 0, camera: 0 }, reducedMotion);
}

/** Smooth start and stop for anything that moves. */
export function ease(x: number): number {
  return x * x * (3 - 2 * x);
}
