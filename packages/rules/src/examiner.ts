// Examiner questions for the metre bridge (docs/07 §6). The bank decides which questions she
// gets and the model answer for each; the model only judges her answer (docs/06 §5.5).
// "Ask about her specific mistake first" (docs/07 §6), so questions come from her lost items.

import type { ExaminerQuestion, MarkItem, MarkSheet } from "@snaplab/contracts";
import { L1L2_QUESTION_LABEL } from "./meterBridgeL1L2";
import { describesDragging, judgePrecaution } from "./precautions";
import { hasUnit } from "./text";

export interface BankQuestion extends ExaminerQuestion {
  /** Where the model answer comes from. */
  source: string;
}

const q = (
  id: string,
  rule: ExaminerQuestion["rule"],
  text: string,
  model_answer: string,
  source: string,
): BankQuestion => ({ id, rule, text, model_answer, source });

/** The metre bridge bank. Order of the general questions is the order they fill up in. */
export const METER_BRIDGE_QUESTIONS = {
  jockey: q(
    "mb-jockey-slide",
    "PRECAUTIONS",
    "Why must you not slide the jockey along the wire?",
    "Sliding the jockey scrapes the wire, so its cross-section is no longer uniform. Its resistance per centimetre is then not constant, and the balance lengths no longer give the true ratio of the resistances. The jockey should only be tapped on the wire.",
    "docs/07 §6; WAEC Phys P3 2018 Q3A, 2014, 2008 (sliding the jockey penalised)",
  ),
  tense: q(
    "mb-precaution-tense",
    "PRECAUTIONS",
    "How should a precaution be written in your report, and why?",
    "A precaution reports something you actually did, so it is written as a completed action, for example: “The key was opened between readings.” “Open the key” or “Avoid parallax” is an instruction, not a report of what was done.",
    "docs/07 §5.2; WAEC Phys P3 2023 Q3B (precautions stated as actions taken)",
  ),
  oneDp: q(
    "mb-length-1dp",
    "PHYS-1DP",
    "Why should each balance length be recorded to one decimal place in centimetres, like 57.0 cm?",
    "The metre rule is graduated in millimetres, so a length can be read to the nearest 0.1 cm. Writing 57 instead of 57.0 hides the precision of the reading.",
    "WAEC Phys P3 2018 Q3A (lengths to at least 1 d.p.)",
  ),
  units: q(
    "mb-table-units",
    "PHYS-TABLE",
    "Why must each column heading in your table carry its unit?",
    "A column heading gives the quantity and its unit, for example l (cm) or X (Ω), so that every number in the column has a meaning. A number without a unit is incomplete.",
    "WAEC Phys P3 2018 Q3A, 2023 Q3B (composite table with units)",
  ),
  slope: q(
    "mb-slope-triangle",
    "GRAPH-SLOPE",
    "How do you find the slope from your graph, and why should the triangle be large?",
    "Draw a large right-angled triangle on the line of best fit, read the change in y and the change in x from its sides, and divide: slope = Δy/Δx. A large triangle makes the reading errors a small fraction of Δy and Δx.",
    "docs/07 §5.1 (GRAPH-SLOPE); WAEC Phys P3 2023 Q3B",
  ),
  cell: q(
    "mb-weak-cell",
    null,
    "Does a weakening cell change the balance point?",
    "No. At balance no current flows through the galvanometer, and the balance length depends only on the ratio of the resistances, R/X = l/(100 − l). A weaker cell only gives a smaller current, so the galvanometer is less sensitive near the balance point.",
    "docs/07 §4.2 (balance independent of the cell's e.m.f.)",
  ),
  centreZero: q(
    "mb-centre-zero",
    null,
    "What does the galvanometer show at balance, and why is it centre-zero?",
    "At balance the galvanometer shows no deflection, because no current flows through it. It is centre-zero so that it can deflect either way, showing which side of the balance point the jockey is on.",
    "docs/07 §4.2",
  ),
  key: q(
    "mb-key-open",
    null,
    "Why should the key be opened between readings?",
    "Opening the key stops the current, so the resistors and the wire do not heat up and change their resistance, and the Leclanché cell does not polarise, which would make the galvanometer less sensitive.",
    "docs/07 §4.2; docs/15 §4 (key opened between readings, WAEC expected answer)",
  ),
  constantan: q(
    "mb-constantan",
    null,
    "Why is the bridge wire made of constantan?",
    "Constantan has a high resistivity and a very small temperature coefficient of resistance, so the resistance of the wire hardly changes as it warms.",
    "docs/07 §4.2",
  ),
  middle: q(
    "mb-balance-middle",
    null,
    "Why is a balance point near the middle of the wire better?",
    "Near the middle, l and 100 − l are both large, so the reading error is a small fraction of each, and end errors matter least.",
    "docs/07 §4.2",
  ),
  endError: q(
    "mb-end-error",
    null,
    "How do you eliminate end error?",
    "Interchange R and X, find the new balance length, and average the first balance length with 100 minus the second. This cancels the effect of unequal end resistances; what remains is smallest when the balance point is near the middle of the wire.",
    "docs/07 §4.2 (interchange and average cancels α₂ − α₁)",
  ),
} as const;

const GENERAL: BankQuestion[] = [
  METER_BRIDGE_QUESTIONS.cell,
  METER_BRIDGE_QUESTIONS.centreZero,
  METER_BRIDGE_QUESTIONS.key,
  METER_BRIDGE_QUESTIONS.constantan,
  METER_BRIDGE_QUESTIONS.middle,
  METER_BRIDGE_QUESTIONS.endError,
];

const ALL: BankQuestion[] = Object.values(METER_BRIDGE_QUESTIONS);

export function examinerQuestionById(id: string): BankQuestion | null {
  return ALL.find((x) => x.id === id) ?? null;
}

/** undefined when the item was not lost; otherwise her text for it (or null). */
const mapLost = (i: MarkItem | undefined, text: (i: MarkItem) => string | null) =>
  i === undefined ? undefined : text(i);

export interface PickedQuestion {
  question: BankQuestion;
  /** Her own words for the mistake, exactly as written; null for a general question. */
  her_mistake: string | null;
}

const written = (i: MarkItem): string | null =>
  i.evidence.find((e) => e.text_as_written)?.text_as_written ?? null;

/** For a units item, the heading she wrote without a unit (the item lists every heading). */
const headingWithoutUnit = (i: MarkItem): string | null =>
  i.evidence.find((e) => e.text_as_written && !hasUnit(e.text_as_written))?.text_as_written ?? null;

/**
 * Up to `max` questions for this sheet: her own mistakes first (sliding the jockey, the
 * precaution tense, 1 d.p. lengths, units, the slope triangle), then the general bank.
 * Pure: the same sheet always gets the same questions.
 */
export function examinerQuestions(sheet: MarkSheet, max = 3): PickedQuestion[] {
  const lost = sheet.items.filter((i) => i.outcome === "lost");
  const lostPrecautions = lost.filter((i) => i.rule === "PRECAUTIONS" && written(i) !== null);
  // Sliding the jockey is the mistake, whether she wrote it as done or as an instruction.
  const dragged = lostPrecautions.find((i) => describesDragging(written(i) ?? ""));
  const wrongTense = lostPrecautions.find((i) => {
    const t = written(i) ?? "";
    return (
      !describesDragging(t) && ["instruction", "not_past_tense"].includes(judgePrecaution(t).reason)
    );
  });
  const units = lost.find((i) => i.id.startsWith("PHYS-TABLE:units"));
  // The l₁/l₂ graph always has slope −1, so its slope earns nothing to ask about.
  const slope =
    sheet.question_label === L1L2_QUESTION_LABEL
      ? undefined
      : lost.find((i) => i.rule === "GRAPH-SLOPE");

  const mistakes: Array<[BankQuestion, string | null | undefined]> = [
    [METER_BRIDGE_QUESTIONS.jockey, dragged && written(dragged)],
    [METER_BRIDGE_QUESTIONS.tense, wrongTense && written(wrongTense)],
    [
      METER_BRIDGE_QUESTIONS.oneDp,
      mapLost(
        lost.find((i) => i.rule === "PHYS-1DP"),
        written,
      ),
    ],
    [METER_BRIDGE_QUESTIONS.units, mapLost(units, headingWithoutUnit)],
    [METER_BRIDGE_QUESTIONS.slope, mapLost(slope, written)],
  ];
  const picked: PickedQuestion[] = mistakes
    .filter((m): m is [BankQuestion, string | null] => m[1] !== undefined)
    .map(([question, text]) => ({ question, her_mistake: text?.slice(0, 300) ?? null }));
  for (const question of GENERAL) picked.push({ question, her_mistake: null });
  return picked.slice(0, Math.max(0, max));
}
