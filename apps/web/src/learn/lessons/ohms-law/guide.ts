import { PART_TERMINALS } from "@snaplab/engine";
import type { Beat } from "../../script/types";
import type { PartId, TerminalId } from "../../types";
import { TERMINAL_WORDS } from "./script";

// The Practise guide for the V–I lesson (docs/plans/wave-2-lean.md slice 2a-script): what the
// voice says when she taps the wrong terminal, how the hint ladder escalates, and which beats
// may be performed for her by Show me. Pure functions of the script and the tap: no bench
// access, no values, and no digits in anything spoken — a correction names terminals in words
// (TERMINAL_WORDS), never by their codes, and never states a reading or a resistance.

/** The two taps she just made: the terminal the lead started from, and the one she tapped next. */
export interface WrongTap {
  from: TerminalId;
  to: TerminalId;
}

const pair = (tap: WrongTap, a: TerminalId, b: TerminalId) =>
  (tap.from === a && tap.to === b) || (tap.from === b && tap.to === a);

const keyOf = (a: TerminalId, b: TerminalId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Every lead that can appear in a circuit the engine accepts (compare.ts: one loop through
 * cells, key, ammeter, box and wire in any order; the key and the box non-polar; the ammeter
 * traversed from its positive terminal; the voltmeter across the wire). Built by walking every
 * order of the four loop parts after the cells, in every non-polar orientation.
 */
const VALID_LEADS: ReadonlySet<string> = (() => {
  const ends: Record<string, ReadonlyArray<readonly [TerminalId, TerminalId]>> = {
    key: [
      ["K1", "K2"],
      ["K2", "K1"],
    ],
    ammeter: [["A+", "A-"]],
    box: [
      ["R1", "R2"],
      ["R2", "R1"],
    ],
    wire: [
      ["X", "Y"],
      ["Y", "X"],
    ],
  };
  const parts = ["key", "ammeter", "box", "wire"];
  const set = new Set<string>();
  const orders: string[][] = [];
  const permute = (rest: string[], acc: string[]) => {
    if (rest.length === 0) orders.push(acc);
    rest.forEach((p, i) => {
      permute(
        rest.filter((_, j) => j !== i),
        [...acc, p],
      );
    });
  };
  permute(parts, []);
  for (const order of orders) {
    const choices = order.map((p) => ends[p] ?? []);
    for (const a of choices[0] ?? [])
      for (const b of choices[1] ?? [])
        for (const c of choices[2] ?? [])
          for (const d of choices[3] ?? []) {
            const seq = [a, b, c, d];
            set.add(keyOf("E+", seq[0]?.[0] as TerminalId));
            for (let i = 0; i < 3; i++) {
              set.add(keyOf(seq[i]?.[1] as TerminalId, seq[i + 1]?.[0] as TerminalId));
            }
            set.add(keyOf(seq[3]?.[1] as TerminalId, "E-"));
            const wireAt = order.indexOf("wire");
            const [wIn, wOut] = seq[wireAt] as readonly [TerminalId, TerminalId];
            set.add(keyOf("V+", wIn));
            set.add(keyOf("V-", wOut));
          }
  }
  return set;
})();

/** The order terminals are reached walking the series loop from E+, through her leads. */
function loopOrder(leads: ReadonlyArray<readonly [TerminalId, TerminalId]>): TerminalId[] {
  const internal = new Map<TerminalId, TerminalId>();
  for (const part of Object.values(PART_TERMINALS)) {
    internal.set(part[0], part[1]);
    internal.set(part[1], part[0]);
  }
  const neighbours = new Map<TerminalId, TerminalId[]>();
  for (const [a, b] of leads) {
    if (a === "V+" || a === "V-" || b === "V+" || b === "V-") continue;
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  // Alternate: cross a lead, then cross that part inside itself, then the next lead.
  const order: TerminalId[] = ["E+"];
  let current: TerminalId = "E+";
  let crossInternal = false;
  for (;;) {
    const next: TerminalId | undefined = crossInternal
      ? internal.get(current)
      : (neighbours.get(current) ?? []).find((t) => !order.includes(t));
    if (!next || order.includes(next)) break;
    order.push(next);
    current = next;
    crossInternal = !crossInternal;
  }
  return order;
}

export interface CorrectionOptions {
  /** The lead the current beat is waiting for; a correction points her at its far end. */
  expected?: readonly [TerminalId, TerminalId];
  /** The leads already on her bench, so polarity is judged from the loop she has built. */
  leads?: ReadonlyArray<readonly [TerminalId, TerminalId]>;
}

/**
 * One spoken correction for a wrong tap, or null when the tap is a lead in a circuit the
 * engine accepts — in any series order, not only the diagram's. Polarity is judged from the
 * loop she has built (with `leads`): the ammeter's positive terminal must face towards the
 * positive terminal of the cells along the loop, and the voltmeter's positive terminal goes
 * on the wire's end nearer that side.
 */
export function correctionFor(tap: WrongTap, opts: CorrectionOptions = {}): string | null {
  const joined = `You joined ${TERMINAL_WORDS[tap.from]} to ${TERMINAL_WORDS[tap.to]}`;
  if (tap.from === tap.to) {
    return "That is the same terminal twice. A lead joins two different terminals: tap a second terminal to finish it.";
  }
  if (pair(tap, "E+", "E-")) {
    return `${joined}. That is a short circuit across the cells. Take that lead off at once.`;
  }
  if (pair(tap, "X", "Y")) {
    return `${joined}. That shorts the wire out. The two ends of the wire join through the rest of the circuit, never straight to each other.`;
  }
  if (pair(tap, "V+", "V-") || pair(tap, "A+", "A-")) {
    return `${joined}. A lead joins two different parts of the circuit, never the two terminals of the same meter.`;
  }
  if (VALID_LEADS.has(keyOf(tap.from, tap.to))) {
    if (opts.leads) {
      const order = loopOrder([...opts.leads, [tap.from, tap.to]]);
      const aMinus = order.indexOf("A-");
      const aPlus = order.indexOf("A+");
      if (aMinus !== -1 && (aPlus === -1 || aMinus < aPlus)) {
        return `${joined}. The ammeter is the wrong way round there: it goes in series, with its positive terminal towards the positive terminal of the cells, so the current enters at its positive terminal.`;
      }
      const xAt = order.indexOf("X");
      const yAt = order.indexOf("Y");
      if (xAt !== -1 && yAt !== -1) {
        // The wire's end reached first from the cells' positive side is its high side.
        const high = xAt < yAt ? "X" : "Y";
        const low = high === "X" ? "Y" : "X";
        const all = [...opts.leads, [tap.from, tap.to] as const];
        const vPlusWrong = all.some(([a, b]) => pair({ from: a, to: b }, "V+", low));
        const vMinusWrong = all.some(([a, b]) => pair({ from: a, to: b }, "V-", high));
        if (vPlusWrong || vMinusWrong) {
          return `${joined}. The voltmeter is the wrong way round: its positive terminal goes on the end of the wire nearer the positive terminal of the cells.`;
        }
      }
    }
    return null;
  }
  if (tap.from.startsWith("V") || tap.to.startsWith("V")) {
    return `${joined}. The voltmeter goes across the resistance wire alone, between the end X and the end Y, so it reads the drop across the wire and nothing else.`;
  }
  if (
    (tap.from.startsWith("A") && !tap.to.startsWith("V")) ||
    (tap.to.startsWith("A") && !tap.from.startsWith("V"))
  ) {
    return `${joined}. The ammeter is the wrong way round there: it goes in series, with its positive terminal towards the positive terminal of the cells, so the current enters at its positive terminal.`;
  }
  if (opts.expected) {
    const [a, b] = opts.expected;
    const start = tap.from === a || tap.from === b ? tap.from : a;
    const other = start === a ? b : a;
    return `${joined}, and those two do not join in the diagram. The lead from ${TERMINAL_WORDS[start]} goes to ${TERMINAL_WORDS[other]}.`;
  }
  return `${joined}, and those two do not join in the diagram. Take the lead off and look at the diagram again.`;
}

/** How a part is named in a spoken hint. */
const PART_WORDS: Readonly<Record<PartId, string>> = {
  cells: "the dry cells",
  key: "the plug key",
  ammeter: "the ammeter",
  voltmeter: "the voltmeter",
  box: "the resistance box",
  wire: "the resistance wire",
  leads: "the connecting leads",
  nuts: "the terminal screws",
  sandpaper: "the sandpaper",
  paper: "your notebook and graph paper",
  micrometer: "the micrometer screw gauge",
  rheostat: "the rheostat",
};

/**
 * The hint ladder's spoken line for a beat, on top of the director's idle clock: at level
 * one the director already repeats the instruction, so the guide adds nothing; level two
 * points at the part (the page rings it); level three is Show me performing it. For a lead
 * beat, `missing` — the first lead she has not made, when the caller knows it — is the lead
 * the level-two hint names, since she may have made this beat's lead out of order.
 * Null means say nothing new.
 */
export function hintLine(
  beat: Beat,
  level: 1 | 2 | 3,
  missing?: readonly [TerminalId, TerminalId],
): string | null {
  if (level === 1) return null;
  if (level === 3) {
    return showMeAllowed(beat)
      ? "Watch how this one is done, then do the next one yourself."
      : null;
  }
  const act = beat.act;
  if (act?.kind === "lead") {
    const [from, to] = missing ?? [act.from, act.to];
    return `The next lead starts at ${TERMINAL_WORDS[from]}. Tap it, then tap ${TERMINAL_WORDS[to]}.`;
  }
  if (act?.kind === "plug") {
    return "Look at the resistance box. A plug that is pulled out adds its coil; a plug pushed in adds nothing.";
  }
  if (act?.kind === "key") {
    return act.closed
      ? "Look at the plug key: push the plug in to close it, just long enough to read the meters."
      : "Look at the plug key: pull the plug out to open it, and leave it open between readings.";
  }
  const part = beat.focus?.[0];
  return part ? `Look at ${PART_WORDS[part]}.` : null;
}

/**
 * Which beats Show me may perform for her: setup actions only (a lead, the plugs, the key),
 * exactly the set the script flags and the director enforces. Never a reading, a written
 * value or the graph.
 */
export function showMeAllowed(beat: Beat): boolean {
  if (beat.showMe !== true || !beat.act) return false;
  return beat.act.kind === "lead" || beat.act.kind === "plug" || beat.act.kind === "key";
}
