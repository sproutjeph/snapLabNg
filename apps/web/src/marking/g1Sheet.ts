import { type MarkItem, MarkSheet } from "@snaplab/contracts";

const WAEC_2018_Q3A = {
  label: "WAEC Physics Paper 3 (May/June 2018 Q3A)",
  url: "https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html",
} as const;

const WAEC_2023_Q3B = {
  label: "WAEC Physics Paper 3 (May/June 2023 Q3B)",
  url: "https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html",
} as const;

const WAEC_2011_Q3 = {
  label: "WAEC Physics Paper 3 (Nov/Dec 2011 Q3)",
  url: "https://waeconline.org.ng/E-Learning/Physics/Phys320nq3.html",
} as const;

/**
 * Golden G1 MarkSheet (Amina's flawed metre bridge page) from docs/15 §5 and docs/11 §2.
 * Totals 21 marks available and 15½ (15.5) marks earned in student mode (`teacher_mode: false`).
 * Ordered top-to-bottom of the page with lost and earned items interleaved as they appear.
 */
const rawItems: MarkItem[] = [
  {
    id: "PHYS-TABLE:structure",
    rule: "PHYS-TABLE",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.08, y0: 0.305, x1: 0.65, y1: 0.335 },
        text_as_written: "R (Ω) | l (cm) | R⁻¹ (Ω⁻¹)",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Composite table showing R, l, R⁻¹ and l⁻¹ in one table with units on R, l and R⁻¹.",
    fix_pcm: "Composite table get R, l, R⁻¹ and l⁻¹ inside one table with unit for R, l and R⁻¹.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-TABLE:unit:l_inv",
    rule: "PHYS-TABLE",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 0.5,
    evidence: [
      {
        box: { x0: 0.73, y0: 0.306, x1: 0.8, y1: 0.334 },
        text_as_written: "l⁻¹",
      },
    ],
    annotation: "underline",
    correction: "l⁻¹ (cm⁻¹)",
    fix_en: "Include the unit in every column header of the composite table: write l⁻¹ (cm⁻¹).",
    fix_pcm: "Put the unit for every column header inside your table: write l⁻¹ (cm⁻¹).",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-1DP:l:valid",
    rule: "PHYS-1DP",
    outcome: "earned",
    marks_earned: 2.0,
    marks_available: 2.0,
    evidence: [
      {
        box: { x0: 0.3, y0: 0.386, x1: 0.4, y1: 0.414 },
        text_as_written: "25.3, 39.8, 50.2, 62.4",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Four balance lengths (25.3, 39.8, 50.2 and 62.4 cm) recorded to 1 decimal place.",
    fix_pcm: "Four balance lengths (25.3, 39.8, 50.2 and 62.4 cm) dey for 1 decimal place.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-3SF:l_inv:3",
    rule: "PHYS-3SF",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 0.5,
    evidence: [
      {
        box: { x0: 0.725, y0: 0.426, x1: 0.805, y1: 0.454 },
        text_as_written: "0.02",
      },
    ],
    annotation: "circle",
    correction: "0.0199",
    fix_en:
      "Evaluate derived values (R⁻¹ and l⁻¹) to at least 3 significant figures: 1 ÷ 50.2 = 0.0199 cm⁻¹.",
    fix_pcm:
      "Work your R⁻¹ and l⁻¹ values to at least 3 significant figures: 1 ÷ 50.2 na 0.0199, no be 0.02.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-1DP:l:4",
    rule: "PHYS-1DP",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 0.5,
    evidence: [
      {
        box: { x0: 0.315, y0: 0.466, x1: 0.385, y1: 0.494 },
        text_as_written: "57",
      },
    ],
    annotation: "circle",
    correction: "57.0",
    fix_en: "Record balance lengths to at least 1 decimal place in cm: write 57.0, not 57.",
    fix_pcm: "Write every length on the metre rule to at least 1 decimal place: 57.0 cm, no be 57.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-3SF:r_inv:all",
    rule: "PHYS-3SF",
    outcome: "earned",
    marks_earned: 2.5,
    marks_available: 2.5,
    evidence: [
      {
        box: { x0: 0.5, y0: 0.466, x1: 0.62, y1: 0.494 },
        text_as_written: "1.00, 0.500, 0.333, 0.250, 0.200",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "All five R⁻¹ values evaluated to 3 significant figures.",
    fix_pcm: "All five R⁻¹ values dey for 3 significant figures.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "PHYS-3SF:l_inv:valid",
    rule: "PHYS-3SF",
    outcome: "earned",
    marks_earned: 2.0,
    marks_available: 2.0,
    evidence: [
      {
        box: { x0: 0.72, y0: 0.506, x1: 0.825, y1: 0.534 },
        text_as_written: "0.0395, 0.0251, 0.0175, 0.0160",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Four l⁻¹ values evaluated to 3 significant figures.",
    fix_pcm: "Four l⁻¹ values dey for 3 significant figures.",
    source: WAEC_2018_Q3A,
  },
  {
    id: "GRAPH-SCALE:area",
    rule: "GRAPH-SCALE",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 0.5,
    evidence: [
      {
        box: { x0: 0.51, y0: 0.57, x1: 0.81, y1: 0.8 },
        text_as_written: "Graph covers ~¼ of the page",
      },
    ],
    annotation: "box",
    correction: "≥ ⅓ page",
    fix_en: "Choose scales so the plotted graph occupies at least one-third of the graph page.",
    fix_pcm: "Choose scale wey go make your graph cover at least one-third of the graph sheet.",
    source: WAEC_2011_Q3,
  },
  {
    id: "GRAPH-AXES:unit:y",
    rule: "GRAPH-AXES",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 0.5,
    evidence: [
      {
        box: { x0: 0.525, y0: 0.58, x1: 0.572, y1: 0.61 },
        text_as_written: "l⁻¹",
      },
    ],
    annotation: "circle",
    correction: "l⁻¹ (cm⁻¹)",
    fix_en:
      "Label both graph axes with the quantity and its unit: l⁻¹ (cm⁻¹) on the vertical axis.",
    fix_pcm:
      "Label both graph axes with the name and the unit: write l⁻¹ (cm⁻¹) for vertical axis.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-SLOPE:calc",
    rule: "GRAPH-SLOPE",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.07, y0: 0.602, x1: 0.46, y1: 0.632 },
        text_as_written: "s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Δl⁻¹ and ΔR⁻¹ values read and divided to obtain the slope s.",
    fix_pcm: "You show Δl⁻¹ and ΔR⁻¹ values well and divide dem to get slope s.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-POINTS:plotted",
    rule: "GRAPH-POINTS",
    outcome: "earned",
    marks_earned: 1.5,
    marks_available: 1.5,
    evidence: [
      {
        box: { x0: 0.69, y0: 0.61, x1: 0.785, y1: 0.642 },
        text_as_written: "5 plotted points",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "All five points plotted accurately from the table values.",
    fix_pcm: "All five points from your table dey plotted well.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-INTERCEPT:c",
    rule: "GRAPH-INTERCEPT",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.07, y0: 0.662, x1: 0.22, y1: 0.692 },
        text_as_written: "c = 0.010",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Line of best fit extended to the vertical axis and intercept c read.",
    fix_pcm: "Line of best fit reach the vertical axis and you read the intercept c.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-LINE:best_fit",
    rule: "GRAPH-LINE",
    outcome: "earned",
    marks_earned: 1.5,
    marks_available: 1.5,
    evidence: [
      {
        box: { x0: 0.63, y0: 0.66, x1: 0.73, y1: 0.692 },
        text_as_written: "Line of best fit",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Straight line of best fit drawn through the plotted points.",
    fix_pcm: "Straight line of best fit pass through the plotted points.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-SLOPE:triangle",
    rule: "GRAPH-SLOPE",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.58, y0: 0.705, x1: 0.635, y1: 0.742 },
        text_as_written: "Small triangle (0.200 to 0.250)",
      },
    ],
    annotation: "box",
    correction: "Large Δ",
    fix_en:
      "Draw a large right-angled triangle spanning most of the line of best fit to determine the slope, not between two neighbouring points.",
    fix_pcm:
      "Draw big right-angled triangle across the line of best fit when you dey find slope, no use two small neighbour points.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "PHYS-EVAL:x",
    rule: "PHYS-EVAL",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.07, y0: 0.722, x1: 0.39, y1: 0.752 },
        text_as_written: "X = s/c = 0.030 ÷ 0.010 = 3.0 Ω",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "X = s/c evaluated accurately from the candidate's own slope s and intercept c.",
    fix_pcm: "X = s/c work out well from your own slope s and intercept c.",
    source: WAEC_2023_Q3B,
  },
  {
    id: "GRAPH-SCALE:multiples",
    rule: "GRAPH-SCALE",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.55, y0: 0.76, x1: 0.64, y1: 0.788 },
        text_as_written: "0 to 1.0, 0 to 0.04",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Axes start from the origin with sensible scales (not in multiples of 3).",
    fix_pcm: "Both axes start from zero with clean scale (no be multiple of 3).",
    source: WAEC_2011_Q3,
  },
  {
    id: "GRAPH-AXES:x",
    rule: "GRAPH-AXES",
    outcome: "earned",
    marks_earned: 1.0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.67, y0: 0.765, x1: 0.78, y1: 0.793 },
        text_as_written: "R⁻¹ (Ω⁻¹)",
      },
    ],
    annotation: "tick",
    correction: null,
    fix_en: "Horizontal axis labelled with quantity and unit: R⁻¹ (Ω⁻¹).",
    fix_pcm: "Horizontal axis get both the name and the unit: R⁻¹ (Ω⁻¹).",
    source: WAEC_2023_Q3B,
  },
  {
    id: "PRECAUTIONS:1",
    rule: "PRECAUTIONS",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.07, y0: 0.876, x1: 0.49, y1: 0.906 },
        text_as_written: "1. Avoid parallax error when reading the metre rule.",
      },
    ],
    annotation: "strike",
    correction: "Parallax error was avoided…",
    fix_en:
      "State precautions in acceptable past tense as actions you took: 'Parallax error was avoided when reading the metre rule.'",
    fix_pcm:
      "Write your precaution for past tense as wetin you do: 'Parallax error was avoided when reading the metre rule.'",
    source: WAEC_2023_Q3B,
  },
  {
    id: "PRECAUTIONS:2",
    rule: "PRECAUTIONS",
    outcome: "lost",
    marks_earned: 0,
    marks_available: 1.0,
    evidence: [
      {
        box: { x0: 0.07, y0: 0.922, x1: 0.56, y1: 0.952 },
        text_as_written: "2. I slid the jockey gently along the wire to find the balance point.",
      },
    ],
    annotation: "strike",
    correction: "The jockey was not dragged…",
    fix_en:
      "Sliding the jockey scrapes the constantan wire and alters its uniformity. State: 'The jockey was not dragged along the wire.'",
    fix_pcm:
      "No ever drag the jockey on top the wire; e go scratch am. Write: 'The jockey was not dragged along the wire.'",
    source: WAEC_2018_Q3A,
  },
];

export const g1Sheet: MarkSheet = MarkSheet.parse({
  experiment: "meter_bridge",
  question_label: "Question 3",
  earned: 15.5,
  available: 21,
  items: rawItems,
  setup_issues: [
    {
      description: "No key drawn in the circuit",
      box: { x0: 0.54, y0: 0.092, x1: 0.68, y1: 0.125 },
    },
  ],
  teacher_mode: false,
});
