// The V–I bench's resistance box, plug key and cell holder: what they print and where their
// terminal nuts stand, as pure data (no canvas, no WebGL), so a test can pin it. Sizes in metres,
// in each part's own frame: x to the right, z toward the student, y = 0 on the desk.

/** A point in a part's own frame. */
export type Vec3 = readonly [number, number, number];

/**
 * Where each terminal nut stands (the foot of the nut, which TerminalNut raises a further 23.7 mm
 * to its plug seat). These are the hit targets the lessons tap and the leads end on: restyling a
 * part must not move one by more than 2 mm (docs/plans/asset-pass.md, C8).
 */
export const BOX_NUTS = {
  R1: [0.13, 0.066, -0.006],
  R2: [-0.13, 0.066, -0.006],
} as const satisfies Record<string, Vec3>;

export const KEY_NUTS = {
  K1: [0.031, 0.024, 0],
  K2: [-0.031, 0.024, 0],
} as const satisfies Record<string, Vec3>;

export const CELLS_NUTS = {
  "E+": [-0.0682, 0.046, 0],
  "E-": [0.0682, 0.046, 0],
} as const satisfies Record<string, Vec3>;

/** The ohm sign, as printed after the last coil value. */
export const OHM = "Ω";

/**
 * The coil values as the maker printed them, in plug order: one entry per coil, nothing added up.
 * The strip on the box's front lists these, and each slot's own engraving is one of them.
 */
export function boxCoilLabels(coilsOhm: readonly number[]): string[] {
  return coilsOhm.map((ohm) => String(ohm));
}

/** The whole front strip as one line, e.g. "1 2 2 5 10 20 20 50 Ω". */
export function boxStripText(coilsOhm: readonly number[]): string {
  return `${boxCoilLabels(coilsOhm).join(" ")} ${OHM}`;
}

/**
 * Horizontal positions of the printed values along the front strip, centred on 0 and spaced by
 * `pitch` metres; the ohm sign takes one more place at the end. `n` values give n + 1 places.
 */
export function boxStripPlaces(n: number, pitch: number): number[] {
  const total = n + 1;
  return Array.from({ length: total }, (_, i) => (i - (total - 1) / 2) * pitch);
}

/**
 * The cell holder's three springs: round wire of 8 sides or more on every tier, a coil of
 * `coilR` with wire of radius `wireR`, and how many turns and steps round each turn a tier takes
 * (fewer on the lower ones, to stay within the triangle budget).
 */
export const CELL_SPRING = {
  sides: 8,
  coilR: 0.0072,
  wireR: 0.0014,
  turns: { low: 2.4, mid: 3.2, high: 3.2 },
  perTurn: { low: 6, mid: 11, high: 14 },
} as const;

/** The steps along one spring at a tier. */
export function cellSpringSteps(tier: "low" | "mid" | "high"): number {
  return Math.round(CELL_SPRING.turns[tier] * CELL_SPRING.perTurn[tier]);
}

/** Triangles in the three springs a holder carries at a tier: two for every step and side. */
export function cellSpringTriangles(tier: "low" | "mid" | "high"): number {
  return 3 * cellSpringSteps(tier) * CELL_SPRING.sides * 2;
}
