import { z } from "zod";
import { Box, Confidence } from "./common";
import { ModelLane } from "./events";

/**
 * Snap your question (docs/plans/snap-question.md): she photographs a printed practical question
 * (the question page, its diagram, or one page with both) and Spark reads it. What comes back is
 * the paper as printed: which practical it is, the apparatus it lists, its numbered instructions
 * word for word, and the parts drawn in its diagram. It never carries a reading, a current, a
 * voltage, an expected result or a mark; the engine and packages/rules decide all of those.
 */

/** The practicals a snapped question can be. Only ohms_law_vi opens a bench today. */
export const QuestionExperiment = z.enum([
  "ohms_law_vi",
  "meter_bridge",
  "titration",
  "glass_block",
  "unknown",
]);
export type QuestionExperiment = z.infer<typeof QuestionExperiment>;

/** A piece of apparatus as a question names it or its diagram draws it. */
export const ApparatusKind = z.enum([
  "cells",
  "key",
  "ammeter",
  "voltmeter",
  "resistance_box",
  "rheostat",
  "wire_xy",
  "metre_rule",
  "connecting_wires",
  "galvanometer",
  "other",
]);
export type ApparatusKind = z.infer<typeof ApparatusKind>;

/** Spark's reading of the snapped paper (strict JSON schema `practical_question`). */
export const QuestionRead = z.strictObject({
  experiment: QuestionExperiment,
  confidence: Confidence,
  /** e.g. "WASSCE (SC) 2018, Physics Paper 3, Question 3B", when the page prints one. */
  source_as_printed: z.string().nullable(),
  /** The question's heading or the experiment's name as printed, if any. */
  title_as_printed: z.string().nullable(),
  /** The apparatus the question lists, in the order it names them, with the exact words. */
  apparatus: z.array(z.strictObject({ kind: ApparatusKind, text_as_printed: z.string() })),
  /** The numbered instructions, word for word; `label` as printed ("1", "(i)", "a"). */
  instructions: z.array(z.strictObject({ label: z.string(), text: z.string() })),
  diagram: z.strictObject({
    present: z.boolean(),
    /** Which photo the diagram is on (0 = the first photo sent). */
    photo: z.number().int().min(0).max(1),
    /** Each part drawn, with its printed label (e.g. "A", "K", "E") and its box on that photo. */
    parts: z.array(
      z.strictObject({
        kind: ApparatusKind,
        label_as_printed: z.string().nullable(),
        box: Box,
      }),
    ),
  }),
});
export type QuestionRead = z.infer<typeof QuestionRead>;

/** Where a failed stage of `/api/question` leaves her. */
export const QuestionFallback = z.enum(["app_question", "retry_later", "none"]);
export type QuestionFallback = z.infer<typeof QuestionFallback>;

/**
 * The `POST /api/question` event stream, server → client. Order: `accepted`; then `question` (or
 * an `error{stage:"read"}`, which ends the stream with `done`); then a `part_outline` per drawn
 * part as SAM finishes, each SAM call followed by its `timing`; `done` last. A SAM failure does
 * not stop the stream: the part keeps Spark's box.
 */
export const QuestionEvent = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("accepted"),
    request_id: z.string(),
    /** One hash per photo, in the order sent. */
    image_sha256: z.array(z.string()).min(1).max(2),
  }),
  z.strictObject({ type: z.literal("cache_hit"), source: z.literal("memory") }),
  z.strictObject({ type: z.literal("question"), question: QuestionRead }),
  z.strictObject({
    type: z.literal("part_outline"),
    /** Index into `question.diagram.parts`. */
    part: z.number().int().min(0),
    box: Box,
    score: z.number().nullable(),
  }),
  z.strictObject({
    type: z.literal("timing"),
    id: z.string(),
    lane: ModelLane,
    model: z.string(),
    label: z.string(),
    /** Milliseconds since `accepted`. */
    start_ms: z.number().min(0),
    end_ms: z.number().min(0),
    status: z.enum(["ok", "fallback", "error"]),
    /** The request as sent, with each image replaced by a size note and no headers. */
    request: z.unknown(),
    /** The validated response (never raw model text), or null on failure. */
    response: z.unknown(),
    note: z.string().nullable(),
  }),
  z.strictObject({ type: z.literal("done"), total_ms: z.number().min(0) }),
  z.strictObject({
    type: z.literal("error"),
    stage: z.enum(["input", "rate_limit", "budget", "read", "sam"]),
    message: z.string(),
    fallback: QuestionFallback,
  }),
]);
export type QuestionEvent = z.infer<typeof QuestionEvent>;
