import { z } from "zod";
import { Measured } from "./common";

/**
 * The hands-on Ohm's-law practical (V against I for a wire XY; docs/07 §4.4 and §5.2,
 * docs/plans/ohms-law-vi.md). Everything here is what the student typed or drew on the
 * virtual bench, exactly as entered. packages/rules marks it; it never carries an engine value.
 */

/** A point on the virtual graph sheet, in cm from the bottom-left corner of its grid. */
const SheetPoint = z.strictObject({ x_cm: z.number(), y_cm: z.number() });
export type SheetPoint = z.infer<typeof SheetPoint>;

/** One row of her table. R is what she wrote for the box setting, not the box itself. */
export const OhmsLawRow = z.strictObject({
  R: Measured,
  I: Measured,
  V: Measured,
});
export type OhmsLawRow = z.infer<typeof OhmsLawRow>;

export const OhmsLawAxis = z.strictObject({
  /** Her axis label, e.g. "V/V" or "I (A)"; null when she left it blank. */
  label_as_written: z.string().nullable(),
  /** Her scale as written, e.g. "2 cm to 0.1 A". */
  scale_as_written: z.string().nullable(),
  /** Value per cm of the scale she chose; null when she chose none. */
  units_per_cm: z.number().nullable(),
  /** The value she put at the grid's corner (her axes need not start at 0). */
  origin_value: z.number(),
});
export type OhmsLawAxis = z.infer<typeof OhmsLawAxis>;

export const OhmsLawGraph = z.strictObject({
  sheet: z.strictObject({ width_cm: z.number(), height_cm: z.number() }),
  /** The horizontal axis. The question asks for I here. */
  x: OhmsLawAxis,
  /** The vertical axis. The question asks for V here. */
  y: OhmsLawAxis,
  points: z.array(SheetPoint),
  line: z.strictObject({ p1: SheetPoint, p2: SheetPoint }).nullable(),
  triangle: z.strictObject({ p1: SheetPoint, p2: SheetPoint, p3: SheetPoint }).nullable(),
  delta_y_as_written: z.string().nullable(),
  delta_x_as_written: z.string().nullable(),
  slope_as_written: z.string().nullable(),
});
export type OhmsLawGraph = z.infer<typeof OhmsLawGraph>;

export const OhmsLawRecord = z.strictObject({
  experiment: z.literal("ohms_law_vi"),
  /** Exam mode runs the same bench with every hint off. Marks are the same in both. */
  mode: z.enum(["practice", "exam"]),
  /** Step 1: the length XY she measured. */
  length_xy: Measured.nullable(),
  /** The column headers she wrote, e.g. "I/A"; units usually live here. */
  headers: z.strictObject({
    R: z.string().nullable(),
    I: z.string().nullable(),
    V: z.string().nullable(),
  }),
  rows: z.array(OhmsLawRow),
  graph: OhmsLawGraph.nullable(),
  precautions: z.array(z.string()),
  /** (b)(i): the law she named and stated. */
  law_as_written: z.string().nullable(),
  /** (b)(ii): her working and answer for the length of the wire. */
  length_calc_as_written: z.string().nullable(),
});
export type OhmsLawRecord = z.infer<typeof OhmsLawRecord>;
