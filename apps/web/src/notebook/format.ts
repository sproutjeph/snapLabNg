import type { Reading } from "./types";

/**
 * Rounds half up to `decimals` places without binary floating-point
 * surprises at .x5 boundaries (62.45 -> 62.5). Shifting via the decimal
 * string ("62.45e1" = 624.5, exact in binary) avoids 62.45 * 10 giving
 * 624.4999...
 */
function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const shifted = Number(`${value}e${decimals}`);
  if (!Number.isFinite(shifted)) {
    return Math.round(value * 10 ** decimals) / 10 ** decimals;
  }
  const rounded = Math.round(shifted);
  const result = Number(`${rounded}e${-decimals}`);
  return result === 0 ? 0 : result;
}

/** Length to 1 d.p. in cm: the metre rule is read to 1 mm. */
export function formatLength(lCm: number): string {
  return roundHalfUp(lCm, 1).toFixed(1);
}

/** Resistance to 1 d.p. in ohm. */
export function formatOhm(r: number): string {
  return roundHalfUp(r, 1).toFixed(1);
}

/** Formats to 3 significant figures, e.g. 1/50.2 -> "0.0199", 1 -> "1.00". */
export function formatSig3(x: number): string {
  if (x === 0) {
    return "0.00";
  }
  if (!Number.isFinite(x)) {
    return String(x);
  }
  const sign = x < 0 ? "-" : "";
  const ax = Math.abs(x);
  let exponent = Math.floor(Math.log10(ax));
  while (ax >= 10 ** (exponent + 1)) {
    exponent += 1;
  }
  while (ax < 10 ** exponent) {
    exponent -= 1;
  }
  const rounded = roundHalfUp(ax, 2 - exponent);
  let roundedExponent = Math.floor(Math.log10(rounded));
  while (rounded >= 10 ** (roundedExponent + 1)) {
    roundedExponent += 1;
  }
  while (rounded < 10 ** roundedExponent) {
    roundedExponent -= 1;
  }
  const decimals = 2 - roundedExponent;
  return sign + (decimals >= 0 ? rounded.toFixed(decimals) : String(rounded));
}

/** Reciprocals of her own reading, both to 3 s.f. Plain arithmetic only. */
export function reciprocalRow(reading: Reading): { rInv: string; lInv: string } {
  return {
    rInv: formatSig3(1 / reading.rOhm),
    lInv: formatSig3(1 / reading.lCm),
  };
}
