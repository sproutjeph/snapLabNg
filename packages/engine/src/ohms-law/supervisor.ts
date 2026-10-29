import type { OhmsLawParams } from "./types";

/**
 * The resistance a careful candidate's V–I slope measures on this bench: XY in parallel with the
 * voltmeter, because the ammeter also carries the voltmeter's current (docs/07 §4.4). It is the
 * supervisor's value for PHYS-ACCURACY on the simulated bench (docs/plans/exam-redesign.md,
 * D1(d)). Cold XY: constantan's α = 8 × 10⁻⁶ K⁻¹ moves it under 0.05% at the bench's warming.
 */
export function effectiveXyOhm(p: OhmsLawParams): number {
  const r = p.wire.ohm;
  const rv = p.voltmeter.ohm;
  return (r * rv) / (r + rv);
}
