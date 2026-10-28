import type { CellParams, CellState, NeedleState } from "../meter-bridge";

/**
 * The Ohm's-law (V–I) bench, docs/07 §4.4 and §5.2 and docs/plans/ohms-law-vi.md.
 *
 * FROZEN for Wave 1: the web codes against these shapes. A change goes through the lead.
 * The engine may add internal fields to OhmsLawParams and OhmsLawState; it never removes
 * or renames one.
 */

/** Every terminal on the bench. Leads join terminals; each part joins its two inside itself. */
export const TERMINAL_IDS = [
  "E+",
  "E-",
  "K1",
  "K2",
  "A+",
  "A-",
  "V+",
  "V-",
  "R1",
  "R2",
  "X",
  "Y",
] as const;
export type TerminalId = (typeof TERMINAL_IDS)[number];

/** The parts with a body between two terminals. */
export type PartId = "cells" | "key" | "ammeter" | "voltmeter" | "box" | "wire";

/** Each part's terminals, in the order its current is signed (positive from first to second). */
export const PART_TERMINALS: Readonly<Record<PartId, readonly [TerminalId, TerminalId]>> = {
  cells: ["E+", "E-"],
  key: ["K1", "K2"],
  ammeter: ["A+", "A-"],
  voltmeter: ["V+", "V-"],
  box: ["R1", "R2"],
  wire: ["X", "Y"],
};

/** A terminal nut takes at most this many lead ends. */
export const MAX_LEADS_PER_TERMINAL = 3;

/** Where one lead end meets a terminal nut. Loose or dirty joints add contact resistance and flicker. */
export interface JointState {
  tightened: boolean;
  clean: boolean;
}

/** A connecting lead from terminal a to terminal b. The id is stable, for undo and currents. */
export interface Lead {
  id: string;
  a: TerminalId;
  b: TerminalId;
  jointA: JointState;
  jointB: JointState;
}

/**
 * The circuit for this practical: E → K → A → R → X–Y → back to E, with V across X and Y.
 * One pair per lead; a lead may run either way. Any electrically equivalent series order
 * also matches (compareWithDiagram).
 */
export const DIAGRAM_LEADS: ReadonlyArray<readonly [TerminalId, TerminalId]> = [
  ["E+", "K1"],
  ["K2", "A+"],
  ["A-", "R1"],
  ["R2", "X"],
  ["Y", "E-"],
  ["V+", "X"],
  ["V-", "Y"],
];

/** Dial geometry shared by the engine and the dial painter: zero reading, full scale, stops. */
export const METER_ZERO_DEG = -40;
export const METER_FULL_DEG = 40;
export const METER_STOP_DEG = 45;

export interface NeedleDynamics {
  naturalFreqHz: number;
  dampingRatio: number;
  /** Fraction of the speed kept when the needle bounces off a stop. */
  restitution: number;
  /** Impact speed above which hitting a stop counts as a slam. */
  slamSpeedDegPerS: number;
}

export interface MeterParams {
  /** Full-scale reading: amperes for the ammeter, volts for the voltmeter. Painted on the dial. */
  fullScale: number;
  /** The smallest scale division, same unit. Painted on the dial. */
  division: number;
  /** Resistance between the + and − terminals. */
  ohm: number;
  /** The reading with no current (seeded zero error, same unit; 0 = none). Never shown as a number. */
  zeroError: number;
  needle: NeedleDynamics;
}

export interface WireXYParams {
  /** Length of the bare wire between X and Y. The student measures it with the metre rule. */
  lengthCm: number;
  /** Where X sits on the metre rule fixed alongside the wire (cm mark under X). */
  startCm: number;
  /** Resistance of XY at room temperature. Never shown. */
  ohm: number;
  diameterMm: number;
  /** Temperature coefficient of resistance (constantan, cited in the engine). */
  alphaPerK: number;
}

export interface OhmsLawParams {
  seed: number;
  /** One dry cell; the holder has two in series. */
  cell: CellParams;
  ammeter: MeterParams;
  voltmeter: MeterParams;
  wire: WireXYParams;
  /** Resistance-box coils in plug order, e.g. [1, 2, 2, 5, 10, 20, 20, 50]. Painted on the box. */
  boxCoilsOhm: readonly number[];
}

/** What the student controls. */
export interface OhmsLawInputs {
  leads: readonly Lead[];
  keyClosed: boolean;
  /** Same order as params.boxCoilsOhm; true = plug in (that coil shorted). */
  plugsIn: readonly boolean[];
  /** Turns of the zero-adjust screws, as a needle offset in degrees (0 = untouched). */
  zeroTrimDeg: { ammeter: number; voltmeter: number };
}

/**
 * What the bench shows after a step. The currents drive the current-flow dots only;
 * the UI never prints them, or any other engine number.
 */
export interface OhmsLawReadout {
  /** Needle angles: a zero reading at METER_ZERO_DEG, full scale at METER_FULL_DEG, stops at ±METER_STOP_DEG. */
  ammeterDeg: number;
  voltmeterDeg: number;
  /** True on a step in which that needle hit a stop hard (sound and shake). */
  ammeterSlammed: boolean;
  voltmeterSlammed: boolean;
  /** Conventional current through each lead (A), keyed by lead id, positive from lead.a to lead.b. */
  leadCurrentsA: Readonly<Record<string, number>>;
  /** Current through each part's body (A), positive from its first terminal to its second. */
  partCurrentsA: Readonly<Record<PartId, number>>;
  /** 0 = fresh cells, 1 = fully polarised; the holder shows it. */
  cellDrain01: number;
  /** True while the cells are nearly short-circuited. */
  shortCircuit: boolean;
}

export interface OhmsLawState {
  params: OhmsLawParams;
  timeS: number;
  cells: readonly [CellState, CellState];
  ammeter: NeedleState;
  voltmeter: NeedleState;
  /** How far XY has warmed above room temperature. */
  wireRiseK: number;
  readout: OhmsLawReadout;
}

/** Problems the guided hint can name. Never carries a value. */
export type DiagramIssue =
  | "open_loop"
  | "ammeter_reversed"
  | "voltmeter_reversed"
  | "ammeter_in_parallel"
  | "voltmeter_in_series"
  | "voltmeter_not_across_wire"
  | "short_circuit";

export interface DiagramComparison {
  /** True when her circuit is electrically the diagram's: any series order, meters the right way round. */
  matches: boolean;
  /** Diagram leads (terminal pairs) she has not made; empty when matches. */
  missing: ReadonlyArray<readonly [TerminalId, TerminalId]>;
  /** Ids of her leads that are not in the diagram; empty when matches. */
  extra: readonly string[];
  issues: readonly DiagramIssue[];
}
