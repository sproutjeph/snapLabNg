/** Below this current a branch looks still: the galvanometer at balance (10 µA). */
const STILL_A = 1e-5;
/** At or above this a branch moves at full rate (0.1 A, the cell's whole current). */
const FULL_A = 0.1;

/**
 * How fast current-flow dots move (0–1) for a branch current, on a log scale: the main
 * branches carry ~0.1 A while the galvanometer near balance carries micro-amps, and both
 * must read. Only a view rate; every current comes from the engine.
 */
export function flowRate(currentA: number): number {
  const i = Math.abs(currentA);
  if (!(i > STILL_A)) return 0;
  return Math.min(1, Math.log10(i / STILL_A) / Math.log10(FULL_A / STILL_A));
}
