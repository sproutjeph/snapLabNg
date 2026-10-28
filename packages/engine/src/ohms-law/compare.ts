import { solveMna } from "../circuit";
import { buildBenchNetlist, createBenchNetlist, TERMINAL_NODE } from "./netlist";
import { paramsFromSeed } from "./params";
import {
  DIAGRAM_LEADS,
  type DiagramComparison,
  type DiagramIssue,
  type Lead,
  PART_TERMINALS,
  type PartId,
  TERMINAL_IDS,
  type TerminalId,
} from "./types";

// Compares her wiring with the corrected diagram by electrical equivalence (docs/plans/
// ohms-law-vi.md, slot 1): her leads join terminals into nodes; the diagram's circuit is one
// loop through cells, key, ammeter, box and wire in any order, with the voltmeter across the
// wire. The key and box are non-polar; A+ must face E+ along the loop, and V+ must be on the
// wire's high side (X in the diagram's orientation). Never carries a value.

const PARTS: readonly PartId[] = ["cells", "key", "ammeter", "voltmeter", "box", "wire"];
const LOOP_PARTS: readonly PartId[] = ["cells", "key", "ammeter", "box", "wire"];
const N = TERMINAL_IDS.length;

class Dsu {
  readonly p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    let r = x;
    while (this.p[r] !== r) r = this.p[r] ?? r;
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[ra] = rb;
  }
}

/** Nodes of her circuit: terminals her leads join. */
function nodesOf(leads: readonly Lead[]): (t: TerminalId) => number {
  const d = new Dsu(N);
  for (const l of leads) d.union(TERMINAL_NODE[l.a], TERMINAL_NODE[l.b]);
  return (t) => d.find(TERMINAL_NODE[t]);
}

/** Are nodes u and v joined through the parts not excluded (the key counted as closed)? */
function joined(
  nodeOf: (t: TerminalId) => number,
  exclude: readonly PartId[],
  u: number,
  v: number,
): boolean {
  const d = new Dsu(N);
  for (const id of PARTS) {
    if (exclude.includes(id)) continue;
    const [a, b] = PART_TERMINALS[id];
    d.union(nodeOf(a), nodeOf(b));
  }
  return d.find(u) === d.find(v);
}

/** One simple loop through the five series parts, with the voltmeter across the wire. */
function sameTopology(nodeOf: (t: TerminalId) => number): boolean {
  const ends = new Map<number, number>();
  for (const id of LOOP_PARTS) {
    for (const t of PART_TERMINALS[id]) ends.set(nodeOf(t), (ends.get(nodeOf(t)) ?? 0) + 1);
  }
  if (ends.size !== LOOP_PARTS.length) return false;
  for (const count of ends.values()) if (count !== 2) return false;
  // Five nodes of degree two and five edges: one loop if it is connected.
  const d = new Dsu(N);
  for (const id of LOOP_PARTS) {
    const [a, b] = PART_TERMINALS[id];
    d.union(nodeOf(a), nodeOf(b));
  }
  const roots = new Set([...ends.keys()].map((n) => d.find(n)));
  if (roots.size !== 1) return false;
  const [x, y] = [nodeOf("X"), nodeOf("Y")];
  const [vp, vm] = [nodeOf("V+"), nodeOf("V-")];
  return (vp === x && vm === y) || (vp === y && vm === x);
}

/** Meter signs on a nominal bench (key closed, every plug in): + means it reads the right way. */
function meterSigns(leads: readonly Lead[]): { ammeterA: number; voltmeterV: number } {
  const params = paramsFromSeed(0);
  const net = createBenchNetlist();
  const good = { tightened: true, clean: true };
  buildBenchNetlist(net, {
    params,
    leads: leads.map((l) => ({ ...l, jointA: good, jointB: good })),
    keyClosed: true,
    plugsIn: params.boxCoilsOhm.map(() => true),
    cells: [
      { emfV: params.cell.restEmfV, internalOhm: params.cell.restInternalOhm },
      { emfV: params.cell.restEmfV, internalOhm: params.cell.restInternalOhm },
    ],
    wireOhm: params.wire.ohm,
    timeS: 0,
  });
  solveMna(net.circuit);
  return {
    ammeterA: net.circuit.currentA[net.part.ammeter] ?? 0,
    voltmeterV: (net.circuit.currentA[net.part.voltmeter] ?? 0) * params.voltmeter.ohm,
  };
}

const pairKey = (a: TerminalId, b: TerminalId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The issues the guided hint can name, in a fixed order. */
export function diagramIssues(leads: readonly Lead[]): DiagramIssue[] {
  const nodeOf = nodesOf(leads);
  const ep = nodeOf("E+");
  const em = nodeOf("E-");
  const issues: DiagramIssue[] = [];
  const openLoop = ep !== em && !joined(nodeOf, ["cells"], ep, em);
  if (openLoop) issues.push("open_loop");

  if (!openLoop) {
    const signs = meterSigns(leads);
    // Floor well above rounding, far below any real meter current (the series voltmeter's ~1 mA).
    if (signs.ammeterA < -1e-7) issues.push("ammeter_reversed");
    if (signs.voltmeterV < -1e-7) issues.push("voltmeter_reversed");
  }

  const ap = nodeOf("A+");
  const am = nodeOf("A-");
  if (!openLoop && ap !== am && joined(nodeOf, ["ammeter", "cells"], ap, am)) {
    issues.push("ammeter_in_parallel");
  }

  // In series with the cells: every path from E+ to E− runs through the voltmeter.
  const vSeries = !openLoop && ep !== em && !joined(nodeOf, ["cells", "voltmeter"], ep, em);
  if (vSeries) issues.push("voltmeter_in_series");
  else {
    const [x, y] = [nodeOf("X"), nodeOf("Y")];
    const [vp, vm] = [nodeOf("V+"), nodeOf("V-")];
    const across = x !== y && ((vp === x && vm === y) || (vp === y && vm === x));
    if (!across) issues.push("voltmeter_not_across_wire");
  }

  // The cells shorted: E+ reaches E− through leads, the key and the ammeter alone.
  if (ep === em || joined(nodeOf, ["cells", "voltmeter", "box", "wire"], ep, em)) {
    issues.push("short_circuit");
  }
  return issues;
}

/**
 * Compares her leads with the diagram. Any electrically equivalent series order matches, with
 * the meters the right way round. `missing` and `extra` are listed against DIAGRAM_LEADS only
 * when it does not match.
 */
export function compareWithDiagram(leads: readonly Lead[]): DiagramComparison {
  const issues = diagramIssues(leads);
  const matches = issues.length === 0 && sameTopology(nodesOf(leads));
  if (matches) return { matches, missing: [], extra: [], issues };

  const wanted = new Set(DIAGRAM_LEADS.map(([a, b]) => pairKey(a, b)));
  const made = new Set<string>();
  const extra: string[] = [];
  for (const l of leads) {
    const k = pairKey(l.a, l.b);
    if (wanted.has(k) && !made.has(k)) made.add(k);
    else extra.push(l.id);
  }
  const missing = DIAGRAM_LEADS.filter(([a, b]) => !made.has(pairKey(a, b)));
  return { matches, missing, extra, issues };
}
