import { z } from "zod";
import { Box, Legibility } from "./common";

export const ReadingColumn = z.enum([
  "R",
  "l",
  "R_inv",
  "l_inv",
  "initial",
  "final",
  "volume_used",
  "i",
  "r",
  "d",
  "tan_i",
  "tan_r",
  "other",
]);
export type ReadingColumn = z.infer<typeof ReadingColumn>;

const Point = z.strictObject({ x: z.number(), y: z.number() });

export const ReadingsSchema = z.strictObject({
  table_found: z.boolean(),
  cells: z.array(
    z.strictObject({
      row: z.string(),
      column: ReadingColumn,
      column_header_as_written: z.string().nullable(),
      text_as_written: z.string(),
      value: z.number().nullable(),
      unit_as_written: z.string().nullable(),
      box: Box,
      legibility: Legibility,
    }),
  ),
  average_as_written: z
    .strictObject({
      text_as_written: z.string(),
      value: z.number().nullable(),
      rows_averaged: z.array(z.string()),
    })
    .nullable(),
  graph: z
    .strictObject({
      x_label_as_written: z.string().nullable(),
      y_label_as_written: z.string().nullable(),
      points: z.array(Point),
      line_drawn: z.boolean(),
      triangle: z.strictObject({ p1: Point, p2: Point, p3: Point }).nullable(),
      slope_as_written: z.string().nullable(),
      intercept_as_written: z.string().nullable(),
      result_as_written: z.string().nullable(),
      box: Box,
    })
    .nullable(),
  precautions: z.array(z.string()),
  other_marks: z.array(
    z.strictObject({
      description: z.string(),
      text_as_written: z.string().nullable(),
      box: Box.nullable(),
    }),
  ),
});
export type Readings = z.infer<typeof ReadingsSchema>;
