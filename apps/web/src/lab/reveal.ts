/**
 * The reveal, in seconds (docs/plans/ink-look.md, Wave 3 slot 3): her page's ink darkens, ink
 * motes lift off it, the kit's outlines draw themselves on in pen ink from her page outward,
 * then the fills fade in from the paper colour, while the camera moves to the bench.
 *   glow    0.0–1.2  her page's ink darkens (PageSheet)
 *   sparks  0.8–3.0  ink motes fly from each drawn part to its place (InkSparks)
 *   rise    1.6–4.6  the kit draws on: lines first, the fills a little behind (RevealClip)
 *   camera  1.2–3.6  page → bench
 * `rise` used to be the clipping-plane rise at 2.6–4.6; it starts a second earlier (Oct 29) so
 * the lines have time to draw before the fills follow. REVEAL_S and the moment the bench goes
 * live are unchanged.
 */
const GLOW = { from: 0, to: 1.2 } as const;
const SPARKS = { from: 0.8, to: 3.0 } as const;
const RISE = { from: 1.6, to: 4.6 } as const;
const CAMERA = { from: 1.2, to: 3.6 } as const;

export const REVEAL_S = 4.6;

/** Within `rise`: the outlines draw over its first 70 %, the fills fade over its last 70 %. */
const LINES_END = 0.7;
const FILLS_START = 0.3;

export interface RevealPhases {
  glow: number;
  sparks: number;
  rise: number;
  camera: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const span = (t: number, w: { from: number; to: number }) =>
  clamp01((t - w.from) / (w.to - w.from));

/**
 * Dev only: `&revealAt=<seconds>` holds the reveal at that moment, for screenshots. The bench
 * still goes live REVEAL_S after it opens. Never read in a production build.
 */
const HELD_AT_S: number | null = (() => {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  const raw = new URLSearchParams(location.search).get("revealAt");
  if (raw === null) return null;
  const s = Number(raw);
  return Number.isFinite(s) ? Math.min(REVEAL_S, Math.max(0, s)) : null;
})();

/** Writes the phases at time `tS` into `out` (no allocation, for the render loop). */
export function revealInto(tS: number, out: RevealPhases, reducedMotion = false): RevealPhases {
  const t = reducedMotion ? REVEAL_S : (HELD_AT_S ?? tS);
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

/** 0 → 1: how far the kit's ink outlines have drawn on (the InkComposer `reveal`). */
export function inkLinesOf(p: RevealPhases): number {
  return clamp01(p.rise / LINES_END);
}

/** 0 → 1: how far the kit's fills have faded in from the paper colour. */
export function inkFillsOf(p: RevealPhases): number {
  return clamp01((p.rise - FILLS_START) / (1 - FILLS_START));
}

/** Smooth start and stop for anything that moves. */
export function ease(x: number): number {
  return x * x * (3 - 2 * x);
}
