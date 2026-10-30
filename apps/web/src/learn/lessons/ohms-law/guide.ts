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

/**
 * One spoken correction for a wrong tap. `expected`, when the caller knows it, is the lead the
 * current beat is waiting for; the correction then points her at the right partner, in words.
 */
export function correctionFor(tap: WrongTap, expected?: readonly [TerminalId, TerminalId]): string {
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
  if (pair(tap, "K2", "A-") || pair(tap, "A+", "R1") || pair(tap, "A+", "R2")) {
    return `${joined}. The ammeter is the wrong way round there: it goes in series, and the current must enter at its positive terminal, on the side towards the cells.`;
  }
  if (pair(tap, "V-", "X") || pair(tap, "V+", "Y")) {
    return `${joined}. The voltmeter is the wrong way round: its positive terminal goes to the end X of the wire, and its negative terminal to the end Y.`;
  }
  if (
    pair(tap, "V+", "R1") ||
    pair(tap, "V+", "R2") ||
    pair(tap, "V-", "R1") ||
    pair(tap, "V-", "R2") ||
    pair(tap, "V+", "A-") ||
    pair(tap, "V-", "A+")
  ) {
    return `${joined}. The voltmeter goes across the resistance wire alone, between the end X and the end Y, so it reads the drop across the wire and nothing else.`;
  }
  if (pair(tap, "V+", "V-") || pair(tap, "A+", "A-")) {
    return `${joined}. A lead joins two different parts of the circuit, never the two terminals of the same meter.`;
  }
  if (expected) {
    const [a, b] = expected;
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
 * The hint ladder's spoken line for a beat, matching the director's idle clock: level one
 * repeats the instruction, level two points at the part (the page rings it), level three is
 * Show me performing it, which needs no line of its own. Null means say nothing new.
 */
export function hintLine(beat: Beat, level: 1 | 2 | 3): string | null {
  if (level === 1) return beat.instruct;
  if (level === 3) {
    return showMeAllowed(beat)
      ? "Watch how this one is done, then do the next one yourself."
      : null;
  }
  const act = beat.act;
  if (act?.kind === "lead") {
    return `The next lead starts at ${TERMINAL_WORDS[act.from]}. Tap it, then tap ${TERMINAL_WORDS[act.to]}.`;
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
