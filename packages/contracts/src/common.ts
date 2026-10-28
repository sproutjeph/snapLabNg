import { z } from "zod";

const coord = z.number().min(0).max(1);

/** A box in 0-1 page coordinates. */
export const Box = z.strictObject({
  x0: coord,
  y0: coord,
  x1: coord,
  y1: coord,
});
export type Box = z.infer<typeof Box>;

/** A value read off the page: parsed number next to the exact text. */
export const Measured = z.strictObject({
  value: z.number().nullable(),
  unit_as_written: z.string().nullable(),
  text_as_written: z.string(),
});
export type Measured = z.infer<typeof Measured>;

export const Experiment = z.enum([
  "meter_bridge",
  "titration",
  "glass_block",
  "ohms_law_vi",
  "unknown",
]);
export type Experiment = z.infer<typeof Experiment>;

/**
 * What a snapped page can be read as. `ohms_law_vi` is hands-on only until the snap flow
 * supports it (docs/plans/ohms-law-vi.md), so the Spark schema and the recorded fixtures
 * stay exactly as they were.
 */
export const SnapExperiment = Experiment.exclude(["ohms_law_vi"]);
export type SnapExperiment = z.infer<typeof SnapExperiment>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const Legibility = z.enum(["clear", "unsure"]);
export type Legibility = z.infer<typeof Legibility>;
