import { WIRE_LENGTH_CM, type WireParams } from "./constants";

export type ScrapeCm = readonly [number, number];

function clampCm(cm: number): number {
  return Math.min(WIRE_LENGTH_CM, Math.max(0, cm));
}

/** Length of [fromCm, toCm] covered by at least one scrape. Overlaps count once. */
export function scrapedLengthCm(
  fromCm: number,
  toCm: number,
  scrapesCm: ReadonlyArray<ScrapeCm>,
): number {
  const lo = Math.min(fromCm, toCm);
  const hi = Math.max(fromCm, toCm);
  const segments = scrapesCm
    .map(([a, b]) => [Math.max(lo, Math.min(a, b)), Math.min(hi, Math.max(a, b))] as const)
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  let covered = 0;
  let end = Number.NEGATIVE_INFINITY;
  for (const [a, b] of segments) {
    if (b <= end) continue;
    covered += b - Math.max(a, end);
    end = b;
  }
  return covered;
}

/** Resistance of the bare wire between two points (end resistances are separate). */
export function wireOhm(
  fromCm: number,
  toCm: number,
  wire: WireParams,
  scrapesCm: ReadonlyArray<ScrapeCm> = [],
): number {
  const lo = clampCm(Math.min(fromCm, toCm));
  const hi = clampCm(Math.max(fromCm, toCm));
  return wire.ohmPerCm * (hi - lo + wire.scrapeFactor * scrapedLengthCm(lo, hi, scrapesCm));
}
