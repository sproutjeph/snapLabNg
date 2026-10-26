import type { CellParams } from "./constants";

export interface CellState {
  emfV: number;
  internalOhm: number;
}

export function restingCell(p: CellParams): CellState {
  return { emfV: p.restEmfV, internalOhm: p.restInternalOhm };
}

/**
 * Leclanché polarisation (docs/07 §4.2), first order. While current flows, emf and
 * internal resistance relax toward their polarised values at a rate proportional
 * to |I| / refCurrentA. With no current (key open) they recover toward rest.
 */
export function stepCell(s: CellState, currentA: number, p: CellParams, dtS: number): CellState {
  const flowing = currentA !== 0;
  const rate = flowing ? Math.abs(currentA) / p.refCurrentA / p.polariseTauS : 1 / p.recoverTauS;
  const targetEmf = flowing ? p.polarisedEmfV : p.restEmfV;
  const targetR = flowing ? p.polarisedInternalOhm : p.restInternalOhm;
  // Exact decay over the step, so large dt cannot overshoot the target.
  const k = 1 - Math.exp(-rate * dtS);
  return {
    emfV: s.emfV + (targetEmf - s.emfV) * k,
    internalOhm: s.internalOhm + (targetR - s.internalOhm) * k,
  };
}
