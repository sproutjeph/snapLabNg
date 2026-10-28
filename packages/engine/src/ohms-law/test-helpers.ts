// Test-only helpers. Not exported from the package: the UI must never read a value off a dial.
import { DT_S } from "../meter-bridge";
import { createOhmsLaw, stepOhmsLaw } from "./bench";
import { METER_SPAN_DEG } from "./meter";
import {
  DIAGRAM_LEADS,
  type JointState,
  type Lead,
  METER_ZERO_DEG,
  type MeterParams,
  type OhmsLawInputs,
  type OhmsLawParams,
  type OhmsLawState,
  type TerminalId,
} from "./types";

export const GOOD: JointState = { tightened: true, clean: true };

export const lead = (
  id: string,
  a: TerminalId,
  b: TerminalId,
  jointA = GOOD,
  jointB = GOOD,
): Lead => ({
  id,
  a,
  b,
  jointA,
  jointB,
});

export const diagramLeads = (): Lead[] => DIAGRAM_LEADS.map(([a, b], i) => lead(`L${i + 1}`, a, b));

/** Plugs out for each R the question uses: 1, 5, 10, 20 (one coil), 40 = 20 + 20, 60 = 50 + 10. */
const PLUGS_OUT: Readonly<Record<number, readonly number[]>> = {
  0: [],
  1: [0],
  5: [3],
  10: [4],
  20: [5],
  40: [5, 6],
  60: [4, 7],
};

export function plugsFor(rOhm: number, coils = 8): boolean[] {
  const out = PLUGS_OUT[rOhm];
  if (!out) throw new Error(`no plug pattern for ${rOhm} Ω`);
  return Array.from({ length: coils }, (_, i) => !out.includes(i));
}

export function inputs(leads: readonly Lead[], over: Partial<OhmsLawInputs> = {}): OhmsLawInputs {
  return {
    leads,
    keyClosed: true,
    plugsIn: plugsFor(0),
    zeroTrimDeg: { ammeter: 0, voltmeter: 0 },
    ...over,
  };
}

export function run(
  s: OhmsLawState,
  i: OhmsLawInputs,
  seconds: number,
  onStep?: (s: OhmsLawState) => void,
): OhmsLawState {
  let st = s;
  const n = Math.round(seconds / DT_S);
  for (let k = 0; k < n; k++) {
    st = stepOhmsLaw(st, i);
    onStep?.(st);
  }
  return st;
}

export const bench = (p: OhmsLawParams, i: OhmsLawInputs, seconds: number) =>
  run(createOhmsLaw(p), i, seconds);

/** The reading a perfect eye takes off the dial (amperes or volts), zero error included. */
export const dialReading = (m: MeterParams, deg: number) =>
  ((deg - METER_ZERO_DEG) / METER_SPAN_DEG) * m.fullScale;

/** Params with the ammeter's zero error removed, for tests about the circuit, not the dial. */
export const noZeroError = (p: OhmsLawParams): OhmsLawParams => ({
  ...p,
  ammeter: { ...p.ammeter, zeroError: 0 },
});
