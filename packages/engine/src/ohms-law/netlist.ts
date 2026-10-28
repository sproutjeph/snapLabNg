import { addBranch, addSource, createMnaCircuit, type MnaCircuit, resetMna } from "../circuit";
import { boxOhm, type CellState, PLUG_CONTACT_OHM } from "../meter-bridge";
import {
  type JointState,
  type Lead,
  type OhmsLawParams,
  PART_TERMINALS,
  type PartId,
  TERMINAL_IDS,
  type TerminalId,
} from "./types";

// The bench as a netlist (docs/plans/ohms-law-vi.md, slot 1). Nodes are the twelve terminals
// plus the junction between the two cells. Every lead is its own branch (copper plus a contact
// resistance at each end), so the current in each lead is solved, not guessed.

/** Node index of each terminal: its place in TERMINAL_IDS. */
export const TERMINAL_NODE: Readonly<Record<TerminalId, number>> = Object.freeze(
  Object.fromEntries(TERMINAL_IDS.map((t, i) => [t, i])) as Record<TerminalId, number>,
);
/** The junction between cell 1 (+ at E+) and cell 2 (− at E−). Not a terminal. */
export const CELL_MID_NODE = TERMINAL_IDS.length;
export const BENCH_NODE_COUNT = TERMINAL_IDS.length + 1;
/** E− is 0 V. */
export const BENCH_GROUND_NODE = TERMINAL_NODE["E-"];

// A connecting lead: about 50 cm of 0.5 mm² copper, ρ = 1.7 × 10⁻⁸ Ω m (Nelkon & Parker,
// table of resistivities), so R ≈ 0.017 Ω; rounded to 0.02 Ω.
export const LEAD_OHM = 0.02;
// A plug key's contact resistance, the same few milliohms as a plug in the box (metre bridge).
export const KEY_CONTACT_OHM = PLUG_CONTACT_OHM;
// Contact resistance at one lead end. A tight, clean joint is a few milliohms. Loose and dirty
// joints add ohms that flicker. No textbook figure: illustrative values chosen so a bad joint
// at R = 0 moves the ammeter by several divisions (behaviour tests only).
export const JOINT_GOOD_OHM = 0.002;
export const JOINT_LOOSE_OHM = 0.3;
export const JOINT_LOOSE_FLICKER_OHM = 1.2;
export const JOINT_DIRTY_OHM = 0.2;
export const JOINT_DIRTY_FLICKER_OHM = 0.6;
/** How fast a bad joint's resistance wanders. */
export const JOINT_FLICKER_HZ = 6;

/** lowbias32 integer hash (C. Wellons): a deterministic stand-in for noise. */
function mix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** FNV-1a hash of a lead id. Reads the string in place: no allocation. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function lattice01(seed: number, key: number, k: number): number {
  return mix32(seed ^ mix32(key ^ mix32(k))) / 4294967296;
}

/**
 * Smooth value noise in [0, 1): a deterministic function of (seed, t, key). Same arguments,
 * same value, always. No Math.random.
 */
export function flicker01(seed: number, timeS: number, key: number): number {
  const x = timeS * JOINT_FLICKER_HZ;
  const k = Math.floor(x);
  const f = x - k;
  const s = f * f * (3 - 2 * f);
  const a = lattice01(seed, key, k | 0);
  const b = lattice01(seed, key, (k + 1) | 0);
  return a + (b - a) * s;
}

/** Contact resistance of one lead end at time t. */
export function jointOhm(j: JointState, seed: number, timeS: number, key: number): number {
  let ohm = JOINT_GOOD_OHM;
  if (!j.tightened) {
    ohm += JOINT_LOOSE_OHM + JOINT_LOOSE_FLICKER_OHM * flicker01(seed, timeS, key);
  }
  if (!j.clean) {
    ohm += JOINT_DIRTY_OHM + JOINT_DIRTY_FLICKER_OHM * flicker01(seed, timeS, key ^ 0x5bd1e995);
  }
  return ohm;
}

export const isBadJoint = (j: JointState) => !j.tightened || !j.clean;

export interface BenchNetlist {
  circuit: MnaCircuit;
  /** Element index of each part's body; -1 when absent (key open). */
  part: Record<PartId, number>;
  /** Element index of the second cell (the first is part.cells). */
  cell2: number;
  /**
   * Element index of each lead, by position in the inputs; -1 for a lead from a terminal to
   * itself, or for a lead whose id repeats an earlier lead's (the first with an id wins).
   */
  lead: Int32Array;
}

export function createBenchNetlist(): BenchNetlist {
  return {
    circuit: createMnaCircuit(BENCH_NODE_COUNT, BENCH_GROUND_NODE, 32),
    part: { cells: -1, key: -1, ammeter: -1, voltmeter: -1, box: -1, wire: -1 },
    cell2: -1,
    lead: new Int32Array(24),
  };
}

export interface BenchElements {
  params: OhmsLawParams;
  leads: readonly Lead[];
  keyClosed: boolean;
  plugsIn: readonly boolean[];
  cells: readonly [CellState, CellState];
  wireOhm: number;
  timeS: number;
}

const node = (t: TerminalId) => TERMINAL_NODE[t];

function addPart(net: BenchNetlist, id: PartId, ohm: number): void {
  const [a, b] = PART_TERMINALS[id];
  net.part[id] = addBranch(net.circuit, node(a), node(b), ohm);
}

/** True if an earlier lead has the same id. Lead ids are unique; on a repeat the first wins. */
export function repeatsAnEarlierId(leads: readonly Lead[], i: number): boolean {
  const id = leads[i]?.id;
  for (let k = 0; k < i; k++) if (leads[k]?.id === id) return true;
  return false;
}

/** Writes the bench into the netlist's buffers (allocates only if there are more leads than ever). */
export function buildBenchNetlist(net: BenchNetlist, e: BenchElements): void {
  const c = net.circuit;
  const p = e.params;
  resetMna(c);
  const [c1, c2] = e.cells;
  // Two cells in series: cell 1 from E+ to the junction, cell 2 from the junction to E−.
  net.part.cells = addSource(c, node("E+"), CELL_MID_NODE, c1.emfV, c1.internalOhm);
  net.cell2 = addSource(c, CELL_MID_NODE, node("E-"), c2.emfV, c2.internalOhm);
  if (e.keyClosed) addPart(net, "key", KEY_CONTACT_OHM);
  else net.part.key = -1;
  addPart(net, "ammeter", p.ammeter.ohm);
  addPart(net, "voltmeter", p.voltmeter.ohm);
  addPart(net, "box", boxOhm(p.boxCoilsOhm, e.plugsIn));
  addPart(net, "wire", e.wireOhm);

  if (net.lead.length < e.leads.length) net.lead = new Int32Array(e.leads.length * 2);
  for (let i = 0; i < e.leads.length; i++) {
    const l = e.leads[i];
    if (!l || l.a === l.b || repeatsAnEarlierId(e.leads, i)) {
      net.lead[i] = -1;
      continue;
    }
    const key = hashId(l.id);
    const ohm =
      LEAD_OHM +
      jointOhm(l.jointA, p.seed, e.timeS, key) +
      jointOhm(l.jointB, p.seed, e.timeS, key ^ 0x9e3779b9);
    net.lead[i] = addBranch(c, node(l.a), node(l.b), ohm);
  }
}
