// Rules read what she wrote, not the parsed number (docs/07 §5.1): "57" and "57.0" are
// the same value but not the same answer.

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "⁺": "+",
};

/** One written number: its mantissa exactly as written and a power-of-ten exponent. */
interface Written {
  mantissa: string; // e.g. "3.95", "57", ".5", "57."
  exponent: number; // 0 unless written in standard form (3.95 × 10⁻²)
}

// A plain number (not part of a word or a unit like "cm-1"), optionally in standard form:
// 3.95×10⁻², 3.95 x 10^-2, 3.95e-2.
const NUM = String.raw`[+\-−]?(?:\d+\.?\d*|\.\d+)`;
const EXP = String.raw`(?:\s*[×xX*]\s*10\s*\^?\s*\(?\s*([+\-−⁻⁺]?\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*\)?|[eE]([+\-]?\d+))?`;
const WRITTEN = new RegExp(String.raw`(?<![A-Za-zΩµ\d.⁻¹²³\-\u2212^])(${NUM})${EXP}`, "g");

function toExponent(raw: string | undefined): number {
  if (!raw) return 0;
  const ascii = [...raw.replace(/\s/g, "")]
    .map((ch) => SUPERSCRIPT[ch] ?? (ch === "−" ? "-" : ch))
    .join("");
  const n = Number(ascii);
  return Number.isFinite(n) ? n : 0;
}

function allWritten(text: string): Written[] {
  const out: Written[] = [];
  for (const m of text.matchAll(WRITTEN)) {
    const mantissa = (m[1] ?? "").replace("−", "-").replace(/^\+/, "");
    out.push({ mantissa, exponent: toExponent(m[2] ?? m[3]) });
  }
  return out;
}

/** The single number a table cell holds (a trailing unit such as "cm" is ignored), or null. */
function cellNumber(text: string): Written | null {
  const t = text.trim();
  const all = allWritten(t);
  // A cell is one number, maybe with a unit after it; anything else is not a number.
  if (all.length !== 1) return null;
  const first = all[0] ?? null;
  return first && /^[+\-−]?[\d.]/.test(t) ? first : null;
}

/**
 * Decimal places of the value as written: "57" → 0, "57.0" → 1, "0.0395" → 4,
 * "57.0 cm" → 1, "5.70 × 10¹" → 1. Null if the cell isn't a number.
 */
export function decimalPlaces(text: string): number | null {
  const w = cellNumber(text);
  if (!w) return null;
  const m = w.mantissa.replace(/^-/, "");
  const dot = m.indexOf(".");
  const places = dot === -1 ? 0 : m.length - dot - 1;
  return Math.max(0, places - w.exponent);
}

/**
 * Significant figures as written: "0.02" → 1, "0.0200" → 3, "1.00" → 3, "3.95 × 10⁻²" → 3.
 * Without a decimal point, trailing zeros are not counted ("500" → 1), the usual convention.
 */
export function sigFigs(text: string): number | null {
  const w = cellNumber(text);
  if (!w) return null;
  const m = w.mantissa.replace(/^-/, "");
  if (m.includes(".")) return m.replace(".", "").replace(/^0+/, "").length;
  return m.replace(/^0+/, "").replace(/0+$/, "").length;
}

function value(w: Written): number {
  return Number(w.mantissa) * 10 ** w.exponent;
}

/** The value of a cell as written (unit ignored), or null. */
export function parseNumber(text: string | null): number | null {
  if (text === null) return null;
  const w = cellNumber(text);
  return w ? value(w) : null;
}

/**
 * The last number on a working line, e.g. "s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030",
 * "c = 1.02 × 10⁻² cm⁻¹" or "c = .010". Exponents that belong to a unit (cm⁻¹, cm-1) are ignored.
 */
export function lastNumber(text: string | null): number | null {
  if (!text) return null;
  const last = allWritten(text).at(-1);
  return last ? value(last) : null;
}

/** A unit symbol a metre bridge label can carry. */
const UNIT = /(?<![a-z])(cm|mm|m|Ω|ohms?)(?![a-z])\s*(⁻¹|\^?-1)?/i;

/**
 * Whether a table header or axis label states a unit: "l (cm)", "R⁻¹ (Ω⁻¹)", "l/cm".
 * "1/R" and "l⁻¹ (approx)" do not.
 */
export function hasUnit(label: string | null): boolean {
  if (!label) return false;
  const t = label.replace(/^\s*1\s*\/\s*/, ""); // "1/R" is a quantity, not a unit
  const bracket = t.match(/\(([^)]*)\)/)?.[1];
  if (bracket !== undefined && UNIT.test(bracket)) return true;
  const afterSlash = t.match(/\/\s*(.+)$/)?.[1];
  return afterSlash !== undefined && UNIT.test(afterSlash);
}
