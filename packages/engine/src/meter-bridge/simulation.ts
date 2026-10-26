import { type CellState, restingCell, stepCell } from "./cell";
import { type CircuitSolution, solveCircuit } from "./circuit";
import {
  type CellParams,
  DEFAULT_CELL,
  DEFAULT_GALVO,
  DEFAULT_PROTECT_OHM,
  DEFAULT_WIRE,
  DT_S,
  type GalvoParams,
  PLUG_CONTACT_OHM,
  type WireParams,
} from "./constants";
import { NEEDLE_AT_REST, type NeedleState, stepNeedle } from "./galvanometer";
import { boxOhm } from "./plugBox";

export interface MeterBridgeParams {
  wire: WireParams;
  cell: CellParams;
  galvo: GalvoParams;
  protectOhm: number;
  plugContactOhm: number;
}

/** What the student controls. */
export interface MeterBridgeInputs {
  plugsIn: ReadonlyArray<boolean>;
  boxValuesOhm: ReadonlyArray<number>;
  xOhm: number;
  keyClosed: boolean;
  jockeyCm: number | null;
}

export interface MeterBridgeState {
  params: MeterBridgeParams;
  /** The inputs the current solution was solved for (null before the first step). */
  inputs: MeterBridgeInputs | null;
  scrapesCm: ReadonlyArray<readonly [number, number]>;
  /** The scrape count the current solution was solved for. */
  solvedScrapeCount: number;
  cell: CellState;
  needle: NeedleState;
  solution: CircuitSolution;
  timeS: number;
}

const NO_CURRENT: CircuitSolution = Object.freeze({
  nodeV: Object.freeze({ A: 0, B: 0, J: 0 }),
  branchCurrentsA: Object.freeze({ cell: 0, rArm: 0, xArm: 0, wireAJ: 0, wireJC: 0, galvo: 0 }),
});

export function createMeterBridge(params: Partial<MeterBridgeParams> = {}): MeterBridgeState {
  const p: MeterBridgeParams = {
    wire: params.wire ?? DEFAULT_WIRE,
    cell: params.cell ?? DEFAULT_CELL,
    galvo: params.galvo ?? DEFAULT_GALVO,
    protectOhm: params.protectOhm ?? DEFAULT_PROTECT_OHM,
    plugContactOhm: params.plugContactOhm ?? PLUG_CONTACT_OHM,
  };
  return {
    params: p,
    inputs: null,
    scrapesCm: [],
    solvedScrapeCount: 0,
    cell: restingCell(p.cell),
    needle: NEEDLE_AT_REST,
    solution: NO_CURRENT,
    timeS: 0,
  };
}

/** Records a segment the jockey was dragged along (docs/07 §4.2, scraping). */
export function addScrape(s: MeterBridgeState, fromCm: number, toCm: number): MeterBridgeState {
  return { ...s, scrapesCm: [...s.scrapesCm, [fromCm, toCm] as const] };
}

function sameInputs(a: MeterBridgeInputs | null, b: MeterBridgeInputs): boolean {
  if (!a) return false;
  if (a.xOhm !== b.xOhm || a.keyClosed !== b.keyClosed || a.jockeyCm !== b.jockeyCm) return false;
  if (a.plugsIn.length !== b.plugsIn.length || a.boxValuesOhm.length !== b.boxValuesOhm.length) {
    return false;
  }
  for (let i = 0; i < a.plugsIn.length; i++) if (a.plugsIn[i] !== b.plugsIn[i]) return false;
  for (let i = 0; i < a.boxValuesOhm.length; i++) {
    if (a.boxValuesOhm[i] !== b.boxValuesOhm[i]) return false;
  }
  return true;
}

/**
 * Advances the bench by one fixed step (120 Hz). The circuit is re-solved only
 * when an input, the scrapes or (with the key closed) the polarising cell changed.
 * The needle and cell step every time.
 */
export function stepMeterBridge(
  s: MeterBridgeState,
  inputs: MeterBridgeInputs,
  dtS: number = DT_S,
): MeterBridgeState {
  const p = s.params;
  const fresh = !sameInputs(s.inputs, inputs);
  const changed =
    fresh ||
    s.solvedScrapeCount !== s.scrapesCm.length ||
    (inputs.keyClosed && s.solution.branchCurrentsA.cell !== 0);
  const solution = changed
    ? solveCircuit({
        emfV: s.cell.emfV,
        internalOhm: s.cell.internalOhm,
        keyClosed: inputs.keyClosed,
        rOhm: boxOhm(inputs.boxValuesOhm, inputs.plugsIn, p.plugContactOhm),
        xOhm: inputs.xOhm,
        wire: p.wire,
        scrapesCm: s.scrapesCm,
        jockeyCm: inputs.jockeyCm,
        galvoOhm: p.galvo.coilOhm,
        protectOhm: p.protectOhm,
      })
    : s.solution;

  return {
    params: p,
    // A copy when they change, so a caller that mutates its inputs object in place still
    // triggers a re-solve next step.
    inputs: fresh
      ? { ...inputs, plugsIn: [...inputs.plugsIn], boxValuesOhm: [...inputs.boxValuesOhm] }
      : s.inputs,
    scrapesCm: s.scrapesCm,
    solvedScrapeCount: s.scrapesCm.length,
    cell: stepCell(s.cell, solution.branchCurrentsA.cell, p.cell, dtS),
    needle: stepNeedle(s.needle, solution.branchCurrentsA.galvo, p.galvo, dtS),
    solution,
    timeS: s.timeS + dtS,
  };
}
