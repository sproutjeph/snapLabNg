// Test-only helpers. Not exported from the package: the UI must never know the balance point.
import { type CircuitInputs, solveCircuit } from "./circuit";
import { DEFAULT_GALVO, type WireParams } from "./constants";

export const IDEAL_WIRE: WireParams = {
  ohmPerCm: 0.025,
  endAOhm: 0,
  endCOhm: 0,
  scrapeFactor: 0.03,
};

export function bench(over: Partial<CircuitInputs> = {}): CircuitInputs {
  return {
    emfV: 1.5,
    internalOhm: 0.8,
    keyClosed: true,
    rOhm: 3,
    xOhm: 3,
    wire: IDEAL_WIRE,
    scrapesCm: [],
    jockeyCm: 50,
    galvoOhm: DEFAULT_GALVO.coilOhm,
    protectOhm: 0,
    ...over,
  };
}

export function galvoA(c: CircuitInputs, jockeyCm: number): number {
  return solveCircuit({ ...c, jockeyCm }).branchCurrentsA.galvo;
}

/** The jockey position where I_g = 0, by bisection over the wire; null if I_g never changes sign. */
export function balanceCm(c: CircuitInputs): number | null {
  let lo = 0;
  let hi = 100;
  const sLo = Math.sign(galvoA(c, lo));
  if (sLo === Math.sign(galvoA(c, hi))) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(galvoA(c, mid)) === sLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
