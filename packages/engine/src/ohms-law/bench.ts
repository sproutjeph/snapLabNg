import { solveMna } from "../circuit";
import { type CellState, DT_S, restingCell, stepCell } from "../meter-bridge";
import { meterRestDeg, meterTargetDeg, stepMeter } from "./meter";
import {
  type BenchNetlist,
  buildBenchNetlist,
  createBenchNetlist,
  isBadJoint,
  TERMINAL_NODE,
} from "./netlist";
import {
  CONSTANTAN_DENSITY_KG_M3,
  CONSTANTAN_SPECIFIC_HEAT_J_PER_KG_K,
  WIRE_COOLING_W_PER_M2_K,
} from "./params";
import type {
  Lead,
  OhmsLawInputs,
  OhmsLawParams,
  OhmsLawReadout,
  OhmsLawState,
  PartId,
} from "./types";

/** Currents below this are rounding, not current: they read as exactly 0 (so cells recover). */
export const CURRENT_FLOOR_A = 1e-9;

/** Engine-only bookkeeping carried on the state. Not part of the frozen OhmsLawState. */
export interface OhmsLawInternals {
  /** Scratch buffers for the solve, shared by every state of one bench. Never read before written. */
  net: BenchNetlist;
  /** The inputs the readout's currents were solved for (a private copy), or null before the first solve. */
  solvedInputs: OhmsLawInputs | null;
  solvedCells: readonly [CellState, CellState];
  solvedWireOhm: number;
}

export type OhmsLawEngineState = OhmsLawState & { engine: OhmsLawInternals };

const ZERO_PARTS: Readonly<Record<PartId, number>> = Object.freeze({
  cells: 0,
  key: 0,
  ammeter: 0,
  voltmeter: 0,
  box: 0,
  wire: 0,
});
const NO_LEADS: Readonly<Record<string, number>> = Object.freeze({});

function internalsOf(s: OhmsLawState): OhmsLawInternals {
  const e = (s as Partial<OhmsLawEngineState>).engine;
  return (
    e ?? { net: createBenchNetlist(), solvedInputs: null, solvedCells: s.cells, solvedWireOhm: -1 }
  );
}

export function createOhmsLaw(params: OhmsLawParams): OhmsLawState {
  const cells = [restingCell(params.cell), restingCell(params.cell)] as const;
  const aRest = meterRestDeg(params.ammeter);
  const vRest = meterRestDeg(params.voltmeter);
  const state: OhmsLawEngineState = {
    params,
    timeS: 0,
    cells,
    ammeter: { thetaDeg: aRest, omegaDegPerS: 0, slammed: false },
    voltmeter: { thetaDeg: vRest, omegaDegPerS: 0, slammed: false },
    wireRiseK: 0,
    readout: {
      ammeterDeg: aRest,
      voltmeterDeg: vRest,
      ammeterSlams: 0,
      voltmeterSlams: 0,
      leadCurrentsA: NO_LEADS,
      partCurrentsA: ZERO_PARTS,
      cellDrain01: 0,
      shortCircuit: false,
    },
    engine: {
      net: createBenchNetlist(),
      solvedInputs: null,
      solvedCells: cells,
      solvedWireOhm: -1,
    },
  };
  return state;
}

const sameJoint = (a: Lead["jointA"], b: Lead["jointA"]) =>
  a.tightened === b.tightened && a.clean === b.clean;

function sameInputs(a: OhmsLawInputs | null, b: OhmsLawInputs): boolean {
  if (!a) return false;
  if (a.keyClosed !== b.keyClosed) return false;
  if (a.plugsIn.length !== b.plugsIn.length || a.leads.length !== b.leads.length) return false;
  for (let i = 0; i < a.plugsIn.length; i++) if (a.plugsIn[i] !== b.plugsIn[i]) return false;
  for (let i = 0; i < a.leads.length; i++) {
    const p = a.leads[i];
    const q = b.leads[i];
    if (!p || !q) return false;
    if (p.id !== q.id || p.a !== q.a || p.b !== q.b) return false;
    if (!sameJoint(p.jointA, q.jointA) || !sameJoint(p.jointB, q.jointB)) return false;
  }
  return true;
}

function copyInputs(i: OhmsLawInputs): OhmsLawInputs {
  return {
    leads: i.leads.map((l) => ({ ...l, jointA: { ...l.jointA }, jointB: { ...l.jointB } })),
    keyClosed: i.keyClosed,
    plugsIn: [...i.plugsIn],
    zeroTrimDeg: { ...i.zeroTrimDeg },
  };
}

const sameCell = (a: CellState, b: CellState) =>
  a.emfV === b.emfV && a.internalOhm === b.internalOhm;

const floor = (iA: number) => (Math.abs(iA) < CURRENT_FLOOR_A ? 0 : iA);

/** Builds the bench into the shared buffers and solves it. Results stay in net.circuit. */
function solveBench(
  net: BenchNetlist,
  p: OhmsLawParams,
  inputs: OhmsLawInputs,
  cells: readonly [CellState, CellState],
  wireOhm: number,
  timeS: number,
): void {
  buildBenchNetlist(net, {
    params: p,
    leads: inputs.leads,
    keyClosed: inputs.keyClosed,
    plugsIn: inputs.plugsIn,
    cells,
    wireOhm,
    timeS,
  });
  solveMna(net.circuit);
}

const elementA = (net: BenchNetlist, i: number) =>
  i < 0 ? 0 : floor(net.circuit.currentA[i] ?? 0);

function partCurrentsOf(net: BenchNetlist): Record<PartId, number> {
  return {
    cells: elementA(net, net.part.cells),
    key: elementA(net, net.part.key),
    ammeter: elementA(net, net.part.ammeter),
    voltmeter: elementA(net, net.part.voltmeter),
    box: elementA(net, net.part.box),
    wire: elementA(net, net.part.wire),
  };
}

/** Current in each lead by id. Ids are unique; if one repeats, the first lead with it wins. */
function leadCurrentsOf(net: BenchNetlist, leads: readonly Lead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    if (!l || Object.hasOwn(out, l.id)) continue;
    out[l.id] = elementA(net, net.lead[i] ?? -1);
  }
  return out;
}

/**
 * Nearly short-circuited: current flows and the terminal p.d. is below half the emf, i.e. the
 * external resistance is below the cells' own internal resistance.
 */
function isShortCircuit(
  net: BenchNetlist,
  cells: readonly [CellState, CellState],
  cellsA: number,
): boolean {
  const v = net.circuit.nodeV;
  const terminalV = (v[TERMINAL_NODE["E+"]] ?? 0) - (v[TERMINAL_NODE["E-"]] ?? 0);
  return cellsA !== 0 && terminalV < 0.5 * (cells[0].emfV + cells[1].emfV);
}

/** Wire heating: I²R in, Newton cooling h·(surface)·ΔT out, heat capacity m·c (exact step). */
function stepWireRiseK(
  p: OhmsLawParams,
  riseK: number,
  currentA: number,
  ohm: number,
  dtS: number,
) {
  const dM = p.wire.diameterMm * 1e-3;
  const lM = p.wire.lengthCm * 1e-2;
  const heatCapJPerK =
    CONSTANTAN_DENSITY_KG_M3 * ((Math.PI * dM * dM) / 4) * lM * CONSTANTAN_SPECIFIC_HEAT_J_PER_KG_K;
  const coolWPerK = WIRE_COOLING_W_PER_M2_K * Math.PI * dM * lM;
  if (!(heatCapJPerK > 0) || !(coolWPerK > 0)) return riseK;
  const steadyK = (currentA * currentA * ohm) / coolWPerK;
  return steadyK + (riseK - steadyK) * Math.exp((-coolWPerK / heatCapJPerK) * dtS);
}

function drain01(p: OhmsLawParams, c: CellState): number {
  const span = p.cell.restEmfV - p.cell.polarisedEmfV;
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, (p.cell.restEmfV - c.emfV) / span));
}

/**
 * Advances the bench by one fixed step (120 Hz). The circuit is re-solved when the inputs, the
 * cells or the wire's resistance changed, or while a bad joint flickers; otherwise the last
 * solution stands. Cells, wire temperature and both needles step every time.
 */
export function stepOhmsLaw(
  s: OhmsLawState,
  inputs: OhmsLawInputs,
  dtS: number = DT_S,
): OhmsLawState {
  const p = s.params;
  const eng = internalsOf(s);
  const wireOhm = p.wire.ohm * (1 + p.wire.alphaPerK * s.wireRiseK);
  const fresh = !sameInputs(eng.solvedInputs, inputs);
  let flickering = false;
  for (const l of inputs.leads) if (isBadJoint(l.jointA) || isBadJoint(l.jointB)) flickering = true;
  const resolve =
    fresh ||
    flickering ||
    wireOhm !== eng.solvedWireOhm ||
    !sameCell(s.cells[0], eng.solvedCells[0]) ||
    !sameCell(s.cells[1], eng.solvedCells[1]);

  let partCurrentsA = s.readout.partCurrentsA;
  let leadCurrentsA = s.readout.leadCurrentsA;
  let shortCircuit = s.readout.shortCircuit;
  // While current flows the cells polarise and XY warms, so this re-solves every step. That is
  // intended: 13 nodes in reused buffers is cheap, and the only allocations are the new readout's.
  if (resolve) {
    solveBench(eng.net, p, inputs, s.cells, wireOhm, s.timeS);
    partCurrentsA = partCurrentsOf(eng.net);
    leadCurrentsA = leadCurrentsOf(eng.net, inputs.leads);
    shortCircuit = isShortCircuit(eng.net, s.cells, partCurrentsA.cells);
  }

  // The two cells are in series, so they carry the same current.
  const cellA = Math.abs(partCurrentsA.cells);
  const cells = [
    stepCell(s.cells[0], cellA, p.cell, dtS),
    stepCell(s.cells[1], cellA, p.cell, dtS),
  ] as const;
  const wireRiseK = stepWireRiseK(p, s.wireRiseK, partCurrentsA.wire, wireOhm, dtS);

  const ammeterReading = partCurrentsA.ammeter;
  const voltmeterReading = partCurrentsA.voltmeter * p.voltmeter.ohm;
  const ammeter = stepMeter(
    s.ammeter,
    meterTargetDeg(p.ammeter, ammeterReading, inputs.zeroTrimDeg.ammeter),
    p.ammeter.needle,
    dtS,
  );
  const voltmeter = stepMeter(
    s.voltmeter,
    meterTargetDeg(p.voltmeter, voltmeterReading, inputs.zeroTrimDeg.voltmeter),
    p.voltmeter.needle,
    dtS,
  );

  const readout: OhmsLawReadout = {
    ammeterDeg: ammeter.thetaDeg,
    voltmeterDeg: voltmeter.thetaDeg,
    ammeterSlams: s.readout.ammeterSlams + (ammeter.slammed ? 1 : 0),
    voltmeterSlams: s.readout.voltmeterSlams + (voltmeter.slammed ? 1 : 0),
    leadCurrentsA,
    partCurrentsA,
    cellDrain01: (drain01(p, cells[0]) + drain01(p, cells[1])) / 2,
    shortCircuit,
  };

  const next: OhmsLawEngineState = {
    params: p,
    timeS: s.timeS + dtS,
    cells,
    ammeter,
    voltmeter,
    wireRiseK,
    readout,
    engine: resolve
      ? {
          net: eng.net,
          // A copy only when they change, so a caller that mutates its inputs in place still
          // triggers a re-solve next step.
          solvedInputs: fresh ? copyInputs(inputs) : eng.solvedInputs,
          solvedCells: s.cells,
          solvedWireOhm: wireOhm,
        }
      : eng,
  };
  return next;
}
