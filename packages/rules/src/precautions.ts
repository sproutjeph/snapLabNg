// PRECAUTIONS (docs/07 §5.2): any two valid precautions, stated as things that were done
// ("the key was opened between readings"), awarded positively. Accepted list from
// docs/15 §4, from WAEC Phys P3 2008, 2014, 2018 and 2023 expected answers.

export type PrecautionId =
  | "key_opened"
  | "jockey_not_dragged"
  | "tight_clean_connections"
  | "parallax_avoided"
  | "zero_error"
  | "repeated_readings";

/** Dragging words: WAEC penalises sliding the jockey along the wire (2018 Q3A, 2014, 2008). */
const DRAG =
  "(drag|dragged|dragging|slid|slide|sliding|slided|scrape|scraped|scratch|scratched|rub|rubbed)";
const NEG = "(not|never|n't)";
/** A negation that applies to dragging, e.g. "was not dragged", "never slid", "tapped, not dragged". */
const NEGATED_DRAG_SOURCE = String.raw`${NEG}\s+(?:\w+\s+){0,2}?${DRAG}\b`;
// Fresh RegExp objects per use: a shared /g regex keeps lastIndex between calls.
const negatedDrag = (flags = "") => new RegExp(NEGATED_DRAG_SOURCE, flags);

const TOPICS: Array<{ id: PrecautionId; test: (t: string) => boolean }> = [
  { id: "key_opened", test: (t) => /\bkey\b/.test(t) && /\b(open|opened|removed)\b/.test(t) },
  {
    id: "jockey_not_dragged",
    test: (t) =>
      /\bjockey\b/.test(t) &&
      (negatedDrag().test(t) || /\b(tapped|pressed lightly|lightly pressed)\b/.test(t)),
  },
  {
    id: "tight_clean_connections",
    test: (t) =>
      /\b(connections?|terminals?|contacts?)\b/.test(t) &&
      /\b(tight|tightened|clean|cleaned)\b/.test(t),
  },
  { id: "parallax_avoided", test: (t) => /\bparallax\b/.test(t) || /\beye level\b/.test(t) },
  { id: "zero_error", test: (t) => /\bzero error\b/.test(t) },
  { id: "repeated_readings", test: (t) => /\b(repeat|repeated)\b/.test(t) },
];

/** Starts like an instruction: WAEC wants what was done, not what to do. */
const IMPERATIVE =
  /^(avoid|ensure|make sure|open|close|take|check|use|do not|don't|dont|never|always|read|tap|clean|tighten|note|keep|remove|slide|drag)\b/;
/** Not a statement of something done: should, must, will… */
const MODAL =
  /\b(should|must|will|shall|would|can|could|may|might|need to|needs to|have to|has to)\b/;
/** Says something was done: "was/were …", "had been …", or "I/we" with a past-tense verb. */
const DONE =
  /\b(was|were|had been|has been|have been)\b|\b(i|we)\s+(\w+ed|took|made|kept|read|did|saw|put|set)\b/;

export interface PrecautionJudgement {
  accepted: boolean;
  matched: PrecautionId | null;
  reason:
    | "accepted"
    | "instruction"
    | "penalised_action"
    | "not_done"
    | "not_a_listed_precaution"
    | "not_past_tense";
}

const normalise = (written: string) =>
  written
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^\s*\(?\d+[.)]\s*/, "") // "1. ", "(2) "
    .trim();

/**
 * Says the jockey was dragged, slid or scraped (not negated), whatever the tense: "I slid the
 * jockey…" and "Slide the jockey gently…" both describe the penalised action.
 */
export function describesDragging(written: string): boolean {
  const t = normalise(written);
  return (
    /\bjockey\b/.test(t) &&
    new RegExp(String.raw`\b${DRAG}\b`).test(t.replace(negatedDrag("g"), " "))
  );
}

/** Judges one precaution, exactly as written. */
export function judgePrecaution(written: string): PrecautionJudgement {
  const t = normalise(written);
  const topic = TOPICS.find((x) => x.test(t))?.id ?? null;

  if (IMPERATIVE.test(t)) return { accepted: false, matched: topic, reason: "instruction" };

  // Negations about dragging are the precaution itself; any other negation says it wasn't done.
  const withoutDragNegation = t.replace(negatedDrag("g"), " ");
  if (/\bjockey\b/.test(t) && new RegExp(String.raw`\b${DRAG}\b`).test(withoutDragNegation)) {
    return { accepted: false, matched: null, reason: "penalised_action" };
  }
  if (!topic) return { accepted: false, matched: null, reason: "not_a_listed_precaution" };
  if (MODAL.test(t)) return { accepted: false, matched: topic, reason: "not_past_tense" };
  if (new RegExp(String.raw`\b${NEG}\b|n't`).test(withoutDragNegation)) {
    return { accepted: false, matched: topic, reason: "not_done" };
  }
  // WAEC's own wording can drop the subject: "Jockey not allowed to scratch resistance wire"
  // (2008 expected answer, docs/15 §9). A negated dragging phrase states the practice.
  const statesPractice = topic === "jockey_not_dragged" && negatedDrag().test(t);
  if (!DONE.test(t) && !statesPractice) {
    return { accepted: false, matched: topic, reason: "not_past_tense" };
  }
  return { accepted: true, matched: topic, reason: "accepted" };
}
