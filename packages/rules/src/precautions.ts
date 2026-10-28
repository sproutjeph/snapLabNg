// PRECAUTIONS (docs/07 §5.2): any two valid precautions, stated as things that were done
// ("the key was opened between readings"), awarded positively. Accepted list from
// docs/15 §4, from WAEC Phys P3 2008, 2014, 2018 and 2023 expected answers.

export type PrecautionId =
  | "key_opened"
  | "jockey_not_dragged"
  | "tight_clean_connections"
  | "parallax_avoided"
  | "zero_error"
  | "repeated_readings"
  // Ohm's law (V–I) only, docs/07 §5.2. DRAFT: needs a physics teacher's check.
  | "plugs_firm"
  | "wire_straight"
  | "current_brief";

/** Which practical's precaution list to judge against. The metre bridge list is the default. */
export type PrecautionExperiment = "meter_bridge" | "ohms_law_vi";

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
  // "The zero errors of the meters were corrected" names the same precaution (Oct 28 review).
  { id: "zero_error", test: (t) => /\bzero errors?\b/.test(t) },
  { id: "repeated_readings", test: (t) => /\b(repeat|repeated)\b/.test(t) },
];

function topicById(id: PrecautionId): { id: PrecautionId; test: (t: string) => boolean } {
  const found = TOPICS.find((x) => x.id === id);
  if (!found) throw new Error(`unknown precaution topic ${id}`);
  return found;
}

/**
 * The Ohm's-law (V–I) list. DRAFT: needs a physics teacher's check (docs/07 §5.2,
 * docs/plans/ohms-law-vi.md). No jockey here. "The meters were connected correctly" is
 * procedure, not a precaution: nothing matches it, so it is not scored. The key topic comes
 * before the plug topic, so "the plug key was opened" stays the key precaution.
 */
const OHMS_LAW_TOPICS: Array<{ id: PrecautionId; test: (t: string) => boolean }> = [
  topicById("key_opened"),
  {
    // "Current was not allowed to flow for long": here the negation is the precaution.
    id: "current_brief",
    test: (t) =>
      // "The key was never left closed" / "…not closed for long": the same practice.
      (/\bkey\b/.test(t) && new RegExp(String.raw`\b${NEG}\s+(?:left\s+)?closed\b`).test(t)) ||
      (/\bcurrents?\b/.test(t) &&
        (new RegExp(
          String.raw`\b${NEG}\s+(?:\w+\s+){0,3}?(flow|flowing|flowed|pass|passing|passed)\b.*\b(long|continuously|unnecessarily)\b`,
        ).test(t) ||
          /\b(flow|flowed|passed)\b.*\b(briefly|short time|only when)\b/.test(t))),
  },
  topicById("tight_clean_connections"),
  {
    id: "plugs_firm",
    test: (t) =>
      /\bplugs?\b/.test(t) &&
      /\b(firm|firmly|tight|tightly|pushed in|pressed in|secure|securely)\b/.test(t),
  },
  {
    id: "wire_straight",
    test: (t) => /\bwires?\b/.test(t) && /\b(straight|taut|stretched)\b/.test(t),
  },
  {
    // Parallax at the meter: the pointer read over its own image in the mirror strip, or the
    // eye directly above / in line with the pointer.
    id: "parallax_avoided",
    test: (t) =>
      topicById("parallax_avoided").test(t) ||
      (/\bmirror\b/.test(t) && /\b(image|pointer|needle)\b/.test(t)) ||
      (/\b(pointer|needle)\b/.test(t) && /\b(image|reflection)\b/.test(t)) ||
      (/\beyes?\b/.test(t) &&
        /\b(above|in line|over|perpendicular|vertically|normal)\b/.test(t) &&
        /\b(pointer|needle|scale|meters?|dial)\b/.test(t)),
  },
  topicById("zero_error"),
  topicById("repeated_readings"),
];

/**
 * V–I path only: the words a negation must reach to say the precaution was NOT done, per
 * topic ("the key was not opened"). A negation elsewhere ("…when readings were not being
 * taken") leaves the precaution standing. Null: the negation is the precaution itself.
 */
const OHMS_LAW_NEGATABLE: Record<PrecautionId, string | null> = {
  key_opened: "open|opened|removed",
  current_brief: null,
  tight_clean_connections: "tight|tightened|clean|cleaned",
  plugs_firm: "firm|firmly|tight|tightly|pushed|pressed|secure|securely",
  wire_straight: "straight|taut|stretched|kept",
  parallax_avoided:
    // Not "read": "the meters were not read at an angle" is the precaution, said negatively.
    "avoided|eliminated|minimi[sz]ed|reduced|prevented|above|in|over|level|perpendicular|covered",
  zero_error: "checked|corrected|noted|adjusted|eliminated|removed|accounted|considered",
  repeated_readings: "repeat|repeated",
  jockey_not_dragged: null,
};

function negatesTopic(t: string, id: PrecautionId): boolean {
  const verbs = OHMS_LAW_NEGATABLE[id];
  if (verbs === null) return false;
  return new RegExp(String.raw`(\b(not|never)|n't)\s+(?:\w+\s+){0,2}?(${verbs})\b`).test(t);
}

const TOPICS_FOR: Record<PrecautionExperiment, typeof TOPICS> = {
  meter_bridge: TOPICS,
  ohms_law_vi: OHMS_LAW_TOPICS,
};

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

/**
 * Judges one precaution, exactly as written, against one practical's list (the metre bridge
 * by default, so its marks are unchanged).
 */
export function judgePrecaution(
  written: string,
  experiment: PrecautionExperiment = "meter_bridge",
): PrecautionJudgement {
  const t = normalise(written);
  const topic = TOPICS_FOR[experiment].find((x) => x.test(t))?.id ?? null;

  if (IMPERATIVE.test(t)) return { accepted: false, matched: topic, reason: "instruction" };

  // Negations about dragging are the precaution itself; any other negation says it wasn't done.
  const withoutDragNegation = t.replace(negatedDrag("g"), " ");
  if (/\bjockey\b/.test(t) && new RegExp(String.raw`\b${DRAG}\b`).test(withoutDragNegation)) {
    return { accepted: false, matched: null, reason: "penalised_action" };
  }
  if (!topic) return { accepted: false, matched: null, reason: "not_a_listed_precaution" };
  if (MODAL.test(t)) return { accepted: false, matched: topic, reason: "not_past_tense" };
  if (experiment === "ohms_law_vi") {
    // V–I only: the negation must reach the topic's own verb (the metre bridge path below is
    // unchanged).
    if (negatesTopic(t, topic)) return { accepted: false, matched: topic, reason: "not_done" };
  } else if (new RegExp(String.raw`\b${NEG}\b|n't`).test(withoutDragNegation)) {
    return { accepted: false, matched: topic, reason: "not_done" };
  }
  // WAEC's own wording can drop the subject: "Jockey not allowed to scratch resistance wire"
  // (2008 expected answer, docs/15 §9). A negated dragging phrase states the practice.
  const statesPractice =
    (topic === "jockey_not_dragged" && negatedDrag().test(t)) ||
    // V–I: "The pointer covered its image in the mirror" reports the reading in the past tense.
    (experiment === "ohms_law_vi" &&
      topic === "parallax_avoided" &&
      /\b(covered|coincided)\b/.test(t));
  if (!DONE.test(t) && !statesPractice) {
    return { accepted: false, matched: topic, reason: "not_past_tense" };
  }
  return { accepted: true, matched: topic, reason: "accepted" };
}
