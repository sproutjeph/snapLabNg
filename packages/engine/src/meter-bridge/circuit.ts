import { WIRE_LENGTH_CM, type WireParams } from "./constants";
import { type ScrapeCm, wireOhm } from "./wire";

export interface CircuitInputs {
  emfV: number;
  internalOhm: number;
  keyClosed: boolean;
  /** Resistance box in the left gap (between A and B). */
  rOhm: number;
  /** Unknown in the right gap (between B and C). */
  xOhm: number;
  wire: WireParams;
  scrapesCm: ReadonlyArray<ScrapeCm>;
  /** Contact point on the wire, from end A. null = the jockey is not touching the wire. */
  jockeyCm: number | null;
  galvoOhm: number;
  protectOhm: number;
}

export interface CircuitSolution {
  /** Node potentials; C is the 0 V reference. */
  nodeV: { A: number; B: number; J: number };
  /**
   * Conventional currents. cell: out of the + terminal into A. rArm: A→B.
   * xArm: B→C. wireAJ: A→J. wireJC: J→C. galvo: B→J (0 when the jockey is up).
   */
  branchCurrentsA: {
    cell: number;
    rArm: number;
    xArm: number;
    wireAJ: number;
    wireJC: number;
    galvo: number;
  };
}

const MIN_OHM = 1e-6;

/**
 * Gaussian elimination for the symmetric 3×3 nodal system
 *   | a b c | |x|   |r1|
 *   | b d e | |y| = |r2|
 *   | c e f | |z|   |r3|
 * The conductance matrix is symmetric and diagonally dominant (strictly in the B and
 * J rows, which reach ground through X and the wire), so it is positive definite and
 * elimination in order needs no pivoting.
 */
function solveSymmetric3(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  r1: number,
  r2: number,
  r3: number,
): [number, number, number] {
  const d1 = d - (b * b) / a;
  const e1 = e - (b * c) / a;
  const f1 = f - (c * c) / a;
  const y2 = r2 - (b * r1) / a;
  const y3 = r3 - (c * r1) / a;
  const f2 = f1 - (e1 * e1) / d1;
  const z = (y3 - (e1 * y2) / d1) / f2;
  const y = (y2 - e1 * z) / d1;
  const x = (r1 - b * y - c * z) / a;
  return [x, y, z];
}

/**
 * Nodal analysis of the metre bridge (docs/07 §4.2). Unknowns V_A, V_B, V_J with
 * C grounded. The cell (emf E, internal r) drives A through the key; R joins A–B,
 * X joins B–C; the wire runs A→J→C with end resistances at A and C; the
 * galvanometer joins B–J only while the jockey touches the wire.
 */
export function solveCircuit(c: CircuitInputs): CircuitSolution {
  // A non-finite contact point (a bad raycast) counts as the jockey being up, so
  // NaN never enters the needle or cell state.
  const jockeyCm = c.jockeyCm !== null && Number.isFinite(c.jockeyCm) ? c.jockeyCm : null;
  const touching = jockeyCm !== null;
  // With the jockey up the wire is one resistor from A to C; split it anywhere
  // (here at the middle) so J stays a well-defined node and the matrix is regular.
  const lCm = Math.min(WIRE_LENGTH_CM, Math.max(0, jockeyCm ?? WIRE_LENGTH_CM / 2));

  // Every resistance is floored, so a 0 Ω entry (R with every plug in and no contact
  // resistance, an ideal end with the jockey on it) stays finite instead of NaN.
  const g = (ohm: number) => 1 / Math.max(MIN_OHM, ohm);
  const gCell = c.keyClosed ? g(c.internalOhm) : 0;
  const gR = g(c.rOhm);
  const gX = g(c.xOhm);
  const gAJ = g(c.wire.endAOhm + wireOhm(0, lCm, c.wire, c.scrapesCm));
  const gJC = g(wireOhm(lCm, WIRE_LENGTH_CM, c.wire, c.scrapesCm) + c.wire.endCOhm);
  const gG = touching ? g(c.galvoOhm + c.protectOhm) : 0;

  // KCL at A, B and J (rows), unknowns V_A, V_B, V_J (columns).
  const [vA, vB, vJ] = solveSymmetric3(
    gCell + gR + gAJ,
    -gR,
    -gAJ,
    gR + gX + gG,
    -gG,
    gAJ + gJC + gG,
    c.emfV * gCell,
    0,
    0,
  );

  return {
    nodeV: { A: vA, B: vB, J: vJ },
    branchCurrentsA: {
      cell: (c.emfV - vA) * gCell,
      rArm: (vA - vB) * gR,
      xArm: vB * gX,
      wireAJ: (vA - vJ) * gAJ,
      wireJC: vJ * gJC,
      galvo: touching ? (vB - vJ) * gG : 0,
    },
  };
}
