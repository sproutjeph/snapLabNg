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

/**
 * The Ohm's-law (V–I) bank (docs/07 §4.4 and §5.2; DRAFT scheme). Model answers name the
 * physics and the procedure, never a value she should have found (I, V, R_XY or the slope).
 */
export const OHMS_LAW_QUESTIONS = {
  tense: q(
    "vi-precaution-tense",
    "PRECAUTIONS",
    "How should a precaution be written in your report, and why?",
    "A precaution reports something you actually did, so it is written as a completed action, for example: “The key was opened between readings.” “Open the key” or “Avoid parallax” is an instruction, not a report of what was done.",
    "docs/07 §5.2; WAEC Phys P3 2023 Q3B (precautions stated as actions taken)",
  ),
  twoDp: q(
    "vi-meter-2dp",
    "PHYS-2DP",
    "Why should each ammeter and voltmeter reading be recorded to two decimal places?",
    "Each meter can be read to half of its smallest division, and on these meters that falls in the second decimal place. Writing a reading with one decimal place hides the precision you actually read it to.",
    "docs/07 §5.2 (PHYS-2DP, DRAFT); docs/07 §4.4 (0.02 A and 0.05 V divisions)",
  ),
  oneDp: q(
    "vi-length-1dp",
    "PHYS-1DP",
    "Why should the length XY be recorded in centimetres to one decimal place?",
    "The metre rule is graduated in millimetres, so the length can be read to the nearest millimetre, the first decimal place in centimetres. Writing a whole number of centimetres hides the precision of the reading.",
    "WAEC Phys P3 2018 Q3A (lengths to at least 1 d.p.)",
  ),
  units: q(
    "vi-table-units",
    "PHYS-TABLE",
    "Why must each column heading in your table carry its unit?",
    "A column heading gives the quantity and its unit, for example R (Ω), I (A) and V (V), so that every number in the column has a meaning. A number without a unit is incomplete.",
    "WAEC Phys P3 2018 Q3A, 2023 Q3B (composite table with units)",
  ),
  axes: q(
    "vi-graph-axes",
    "GRAPH-AXES",
    "Which quantity goes on each axis of your graph, and why does it matter?",
    "The question asks for V against I: V on the vertical axis and I on the horizontal axis, each labelled with its unit. Then the slope ΔV/ΔI is the resistance of the wire XY. With the axes swapped the slope is ΔI/ΔV, its reciprocal.",
    "docs/plans/ohms-law-vi.md (the question, step 6); WAEC Phys P3 2023 Q3B (axes labelled)",
  ),
  slope: q(
    "vi-slope-triangle",
    "GRAPH-SLOPE",
    "What does the slope of your V–I graph represent, and why should the triangle be large?",
    "The slope s = ΔV/ΔI is the resistance of the wire XY, so its unit is the ohm (Ω). A large right-angled triangle makes the reading errors at its corners a small fraction of ΔV and ΔI.",
    "docs/07 §4.4 (V/I ≈ R_XY); WAEC Phys P3 2023 Q3B (large triangle)",
  ),
  trend: q(
    "vi-trend",
    "PHYS-TREND",
    "Why do the current and the p.d. across XY both fall as R is increased?",
    "Increasing R increases the total resistance of the circuit, so the cells drive a smaller current through it. The p.d. across XY is that current times the resistance of XY, so it falls too.",
    "docs/07 §4.4 (the circuit model)",
  ),
  law: q(
    "vi-ohms-law",
    "PHYS-LAW",
    "State Ohm's law, with its condition.",
    "Ohm's law: the current through a metallic conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions remain constant.",
    "docs/07 §4.4 (b)(i); standard textbook statement",
  ),
  calc: q(
    "vi-wire-length",
    "PHYS-CALC",
    "How do you find the length of a wire from its resistance, diameter and resistivity?",
    "Use R = ρL/A, so L = RA/ρ. First find the cross-sectional area A = πd²/4 with the diameter in metres, then substitute R, A and ρ, and give L in metres.",
    "docs/07 §4.4 (b)(ii)",
  ),
  key: q(
    "vi-key-open",
    null,
    "Why should the key be opened between readings?",
    "Opening the key stops the current, so the wire stays at a steady temperature, which is the condition for Ohm's law, and the cells do not run down or polarise, which would make the readings drift.",
    "docs/07 §4.4 (cell polarisation; heating); Oct 28 lesson review, P1",
  ),
  meters: q(
    "vi-meter-connections",
    null,
    "Why is the ammeter connected in series and the voltmeter across XY?",
    "The ammeter must carry the same current as the wire, so it goes in series and has a very small resistance. The voltmeter measures the p.d. between X and Y, so it goes across them, and its high resistance means it draws very little current.",
    "docs/07 §4.4 (ammeter ≈ 0.1 Ω, voltmeter ≈ 1 kΩ/V)",
  ),
  constantan: q(
    "vi-constantan",
    null,
    "Why is the wire XY made of constantan?",
    "Constantan has a high resistivity and its resistance changes very little with temperature, so the wire keeps a steady resistance while current flows.",
    "docs/07 §4.4 (constantan, α = 8×10⁻⁶ K⁻¹); Oct 28 lesson review, CHECK 10",
  ),
  lamp: q(
    "vi-filament-lamp",
    null,
    "How would the V–I graph look for a filament lamp instead of the wire, and why?",
    "It would curve, getting steeper as the current rises: the filament gets much hotter, so its resistance increases. A filament lamp does not obey Ohm's law, because its temperature does not stay constant.",
    "Oct 28 lesson review, ask 5 (non-ohmic conductor)",
  ),
} as const;

const OHMS_LAW_GENERAL: BankQuestion[] = [
  OHMS_LAW_QUESTIONS.key,
  OHMS_LAW_QUESTIONS.meters,
  OHMS_LAW_QUESTIONS.constantan,
  OHMS_LAW_QUESTIONS.lamp,
];

const ALL: BankQuestion[] = [
  ...Object.values(METER_BRIDGE_QUESTIONS),
  ...Object.values(OHMS_LAW_QUESTIONS),
];

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
  if (sheet.experiment === "ohms_law_vi") return ohmsLawExaminerQuestions(sheet, max);
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

/**
 * The Ohm's-law picker, like the metre bridge's: her own lost items first (precaution tense,
 * 2 d.p. meter readings, the 1 d.p. length, units, axes, the slope, the trend, the law, the
 * calculation), then the general V–I bank. Pure: the same sheet always gets the same questions.
 */
function ohmsLawExaminerQuestions(sheet: MarkSheet, max: number): PickedQuestion[] {
  const lost = sheet.items.filter((i) => i.outcome === "lost");
  const wrongTense = lost.find(
    (i) =>
      i.rule === "PRECAUTIONS" &&
      written(i) !== null &&
      ["instruction", "not_past_tense"].includes(
        judgePrecaution(written(i) ?? "", "ohms_law_vi").reason,
      ),
  );
  const byId = (...ids: string[]) => lost.find((i) => ids.includes(i.id));
  const byRule = (rule: MarkItem["rule"]) => lost.find((i) => i.rule === rule);
  const mistakes: Array<[BankQuestion, string | null | undefined]> = [
    [OHMS_LAW_QUESTIONS.tense, wrongTense && written(wrongTense)],
    [OHMS_LAW_QUESTIONS.twoDp, mapLost(byId("PHYS-2DP:I", "PHYS-2DP:V"), written)],
    [OHMS_LAW_QUESTIONS.oneDp, mapLost(byId("PHYS-1DP:xy"), written)],
    [
      OHMS_LAW_QUESTIONS.units,
      mapLost(byId("PHYS-1DP:xy-unit", "PHYS-TABLE:units-R", "PHYS-2DP:units"), written),
    ],
    [OHMS_LAW_QUESTIONS.axes, mapLost(byId("GRAPH-AXES:x", "GRAPH-AXES:y"), written)],
    [OHMS_LAW_QUESTIONS.slope, mapLost(byRule("GRAPH-SLOPE"), written)],
    [OHMS_LAW_QUESTIONS.trend, mapLost(byRule("PHYS-TREND"), written)],
    [OHMS_LAW_QUESTIONS.law, mapLost(byRule("PHYS-LAW"), written)],
    [OHMS_LAW_QUESTIONS.calc, mapLost(byRule("PHYS-CALC"), written)],
  ];
  const picked: PickedQuestion[] = mistakes
    .filter((m): m is [BankQuestion, string | null] => m[1] !== undefined)
    .map(([question, text]) => ({ question, her_mistake: text?.slice(0, 300) ?? null }));
  for (const question of OHMS_LAW_GENERAL) picked.push({ question, her_mistake: null });
  return picked.slice(0, Math.max(0, max));
}
