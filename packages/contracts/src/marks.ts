import { z } from "zod";
import { Box, Experiment } from "./common";

/** Rule codes from docs/07 §5.2 (the WAEC rule table). VIVA does not exist in WASSCE and is not here. */
export const RuleCode = z.enum([
  "CHEM-BUR-2DP",
  "CHEM-CONCORD",
  "CHEM-ROUGH",
  "CHEM-PARALLAX",
  "CHEM-MOLE-RATIO",
  "CHEM-3SF",
  "CHEM-ENDPOINT",
  "PHYS-OPT-TRACES",
  "PHYS-OPT-ARROW",
  "PHYS-1DP",
  "PHYS-3SF",
  "PHYS-TABLE",
  "GRAPH-AXES",
  "GRAPH-POINTS",
  "GRAPH-LINE",
  "GRAPH-INTERCEPT",
  "GRAPH-SCALE",
  "GRAPH-SLOPE",
  "PHYS-EVAL",
  "PHYS-ACCURACY",
  "PRECAUTIONS",
]);
export type RuleCode = z.infer<typeof RuleCode>;

/** How the red ink draws an item on her page. */
export const Annotation = z.enum(["tick", "circle", "underline", "strike", "box"]);
export type Annotation = z.infer<typeof Annotation>;

const halfMarks = z.number().min(0).multipleOf(0.5);

/**
 * One scheme item, marked positively (docs/07 §5.1). Produced only by packages/rules;
 * the AI may add the wording of `fix_en`/`fix_pcm`, never the marks.
 */
export const MarkItem = z
  .strictObject({
    /** Unique within a sheet, e.g. "PHYS-1DP:l:4". */
    id: z.string().min(1),
    rule: RuleCode,
    outcome: z.enum(["earned", "lost"]),
    marks_earned: halfMarks,
    marks_available: halfMarks,
    /** Where on her page this item is, with the text exactly as she wrote it. */
    evidence: z.array(
      z.strictObject({ box: Box.nullable(), text_as_written: z.string().nullable() }),
    ),
    annotation: Annotation,
    /** What a correct entry would look like, e.g. "57.0"; null when there is nothing to rewrite. */
    correction: z.string().nullable(),
    fix_en: z.string(),
    fix_pcm: z.string().nullable(),
    source: z.strictObject({ label: z.string(), url: z.string().url() }).nullable(),
  })
  .refine((m) => m.marks_earned <= m.marks_available, "marks_earned exceeds marks_available")
  .refine(
    (m) => (m.outcome === "earned") === (m.marks_earned === m.marks_available),
    "outcome must be 'earned' exactly when all available marks are earned",
  );
export type MarkItem = z.infer<typeof MarkItem>;

/** A marked question, e.g. G1 = 15½ / 21 (docs/15 §5). */
export const MarkSheet = z
  .strictObject({
    experiment: Experiment,
    question_label: z.string(),
    earned: halfMarks,
    available: halfMarks,
    items: z.array(MarkItem),
    /** Drawing problems that are circled but carry no mark, e.g. "No key drawn in the circuit". */
    setup_issues: z.array(z.strictObject({ description: z.string(), box: Box.nullable() })),
    /** Accuracy (PHYS-ACCURACY) is only marked when a teacher entered the true value. */
    teacher_mode: z.boolean(),
  })
  .refine(
    (s) => s.earned === s.items.reduce((t, i) => t + i.marks_earned, 0),
    "earned must equal the sum of the items' marks_earned",
  )
  .refine(
    (s) => s.available === s.items.reduce((t, i) => t + i.marks_available, 0),
    "available must equal the sum of the items' marks_available",
  )
  .refine(
    (s) => s.teacher_mode || s.items.every((i) => i.rule !== "PHYS-ACCURACY"),
    "PHYS-ACCURACY is only marked in teacher mode",
  );
export type MarkSheet = z.infer<typeof MarkSheet>;
