import { correctionFor } from "../lessons/ohms-law/guide";
import type { OhmsLawBench, TerminalId } from "../types";

// Practise: a wrong tap (docs/plans/wave-2-lean.md, "The experience"). When she finishes a lead
// that no accepted circuit has, or puts a meter the wrong way round, the two nuts shake for 0.3 s
// and the voice says why, in words from the guide (correctionFor: no digits, no values). A lead
// in any series order the engine accepts is not wrong, whatever the script's order.

export interface WrongTapOptions {
  /** The lead the current beat is waiting for, if it is a lead beat. */
  expected(): readonly [TerminalId, TerminalId] | undefined;
  /** A wrong lead was just made: the spoken line, the two terminals it joined, and its id. */
  onWrong(line: string, ends: readonly [TerminalId, TerminalId], leadId: string): void;
  /** Any lead she has just made with her taps (right or wrong), by id. */
  onLead?(leadId: string): void;
}

/** Watches her bench for new leads and reports the wrong ones. Returns the unsubscribe. */
export function watchWrongTaps(
  bench: Pick<OhmsLawBench, "subscribe" | "visual">,
  o: WrongTapOptions,
): () => void {
  // Every lead id ever on the bench: an undo of a removal brings the same lead back, and that is
  // not a new tap.
  const seen = new Set(bench.visual.current.leads.map((l) => l.id));
  let before = bench.visual.current.leads.map((l) => [l.a, l.b] as const);
  return bench.subscribe(() => {
    const leads = bench.visual.current.leads;
    const fresh = leads.filter((l) => !seen.has(l.id));
    // One new lead is a tap that finished a lead; more at once is an undo or a reset, not a tap.
    if (fresh.length === 1 && leads.length === before.length + 1) {
      const l = fresh[0];
      if (l) {
        o.onLead?.(l.id);
        const expected = o.expected();
        const line = correctionFor(
          { from: l.a, to: l.b },
          { leads: before, ...(expected ? { expected } : {}) },
        );
        if (line) o.onWrong(line, [l.a, l.b], l.id);
      }
    }
    for (const l of leads) seen.add(l.id);
    before = leads.map((l) => [l.a, l.b] as const);
  });
}
