import { z } from "zod";
import { BlueprintSchema } from "./blueprint";
import { Box, Confidence, SnapExperiment } from "./common";
import { ReadingsSchema } from "./readings";

/** Which model lane a call belongs to; matches the "Show the AI" drawer's lanes. */
export const ModelLane = z.enum(["spark", "sam", "wonder", "voice", "engine"]);
export type ModelLane = z.infer<typeof ModelLane>;

/** Where a failed stage falls back to (docs/04 §6). */
export const Fallback = z.enum(["golden", "blueprint_boxes", "retry_later", "none"]);
export type Fallback = z.infer<typeof Fallback>;

/**
 * The `/api/snap` event stream, server → client (docs/04 §4.3). Guaranteed order:
 * `accepted` first (then `cache_hit` on a replay); nothing else until the blueprint is
 * settled, which sends `mode`, `component`s, `values` and `setup_issues` together (or an
 * `error{stage:"blueprint"}`); then `sam_box`es and `readings` as their stages finish,
 * each stage followed by its `timing`; `done` last. An `error` for one stage does not
 * stop the others.
 * Golden replays are recordings of exactly this stream.
 */
export const SnapEvent = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("accepted"), request_id: z.string(), image_sha256: z.string() }),
  z.strictObject({ type: z.literal("cache_hit"), source: z.enum(["memory", "golden"]) }),
  z.strictObject({ type: z.literal("mode"), experiment: SnapExperiment, confidence: Confidence }),
  z.strictObject({
    type: z.literal("component"),
    component: BlueprintSchema.shape.components.element,
  }),
  z.strictObject({
    type: z.literal("sam_box"),
    phrase: z.string(),
    box: Box,
    score: z.number().nullable(),
  }),
  z.strictObject({ type: z.literal("values"), values: BlueprintSchema.shape.values }),
  z.strictObject({
    type: z.literal("setup_issues"),
    setup_issues: BlueprintSchema.shape.setup_issues,
  }),
  z.strictObject({ type: z.literal("readings"), readings: ReadingsSchema }),
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
    /** The request as sent, with the image replaced by a size note and no headers. */
    request: z.unknown(),
    /** The validated response (never raw model text), or null on failure. */
    response: z.unknown(),
    note: z.string().nullable(),
  }),
  z.strictObject({ type: z.literal("done"), total_ms: z.number().min(0) }),
  z.strictObject({
    type: z.literal("error"),
    stage: z.enum(["input", "rate_limit", "budget", "blueprint", "sam", "readings"]),
    message: z.string(),
    fallback: Fallback,
  }),
]);
export type SnapEvent = z.infer<typeof SnapEvent>;
