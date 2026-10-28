import { DT_S, NEEDLE_AT_REST, restingCell } from "../meter-bridge";
import {
  DIAGRAM_LEADS,
  type DiagramComparison,
  type Lead,
  METER_ZERO_DEG,
  type OhmsLawInputs,
  type OhmsLawParams,
  type OhmsLawReadout,
  type OhmsLawState,
  type TerminalId,
} from "./types";

// STUBS (Wave 0). The signatures are frozen; the circuit engine slice replaces the bodies
// with the MNA solve, cited constants and tests (docs/plans/ohms-law-vi.md, "Engine").
// The values below are placeholders so the apparatus previews can render. Nothing shows them.

const PLACEHOLDER_PARAMS: OhmsLawParams = {
  seed: 0,
  cell: {
    restEmfV: 1.5,
    restInternalOhm: 0.4,
    polarisedEmfV: 1.3,
    polarisedInternalOhm: 1.0,
    polariseTauS: 60,
    refCurrentA: 0.5,
    recoverTauS: 20,
  },
  ammeter: {
    fullScale: 1,
    division: 0.02,
    ohm: 0.1,
    zeroError: 0,
    needle: { naturalFreqHz: 1.5, dampingRatio: 0.6, restitution: 0.25, slamSpeedDegPerS: 400 },
  },
  voltmeter: {
    fullScale: 3,
    division: 0.05,
    ohm: 3000,
    zeroError: 0,
    needle: { naturalFreqHz: 1.5, dampingRatio: 0.6, restitution: 0.25, slamSpeedDegPerS: 400 },
  },
  wire: { lengthCm: 80, startCm: 10, ohm: 3.5, diameterMm: 0.376, alphaPerK: 0 },
  boxCoilsOhm: [1, 2, 2, 5, 10, 20, 20, 50],
};

/** Bench parameters for one session, chosen from the seed. Pure: the same seed gives the same bench. */
export function paramsFromSeed(seed: number): OhmsLawParams {
  return { ...PLACEHOLDER_PARAMS, seed };
}

function idleReadout(): OhmsLawReadout {
  return {
    ammeterDeg: METER_ZERO_DEG,
    voltmeterDeg: METER_ZERO_DEG,
    ammeterSlammed: false,
    voltmeterSlammed: false,
    leadCurrentsA: {},
    partCurrentsA: { cells: 0, key: 0, ammeter: 0, voltmeter: 0, box: 0, wire: 0 },
    cellDrain01: 0,
    shortCircuit: false,
  };
}

export function createOhmsLaw(params: OhmsLawParams): OhmsLawState {
  return {
    params,
    timeS: 0,
    cells: [restingCell(params.cell), restingCell(params.cell)],
    ammeter: { ...NEEDLE_AT_REST, thetaDeg: METER_ZERO_DEG },
    voltmeter: { ...NEEDLE_AT_REST, thetaDeg: METER_ZERO_DEG },
    wireRiseK: 0,
    readout: idleReadout(),
  };
}

/** Advances the bench by one fixed step (120 Hz). */
export function stepOhmsLaw(
  s: OhmsLawState,
  _inputs: OhmsLawInputs,
  dtS: number = DT_S,
): OhmsLawState {
  return { ...s, timeS: s.timeS + dtS };
}

const pairKey = (a: TerminalId, b: TerminalId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Compares her leads with the diagram. Stub: exact terminal pairs only. The engine slice
 * makes any electrically equivalent series order match and fills in `issues`.
 */
export function compareWithDiagram(leads: readonly Lead[]): DiagramComparison {
  const wanted = new Set(DIAGRAM_LEADS.map(([a, b]) => pairKey(a, b)));
  const made = new Set<string>();
  const extra: string[] = [];
  for (const l of leads) {
    const k = pairKey(l.a, l.b);
    if (wanted.has(k) && !made.has(k)) made.add(k);
    else extra.push(l.id);
  }
  const missing = DIAGRAM_LEADS.filter(([a, b]) => !made.has(pairKey(a, b)));
  return { matches: missing.length === 0 && extra.length === 0, missing, extra, issues: [] };
}
