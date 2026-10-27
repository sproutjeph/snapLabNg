import { z } from "zod";
import { SnapEvent } from "./events";

/**
 * A golden replay: a recording of one real /api/snap event stream with its timings
 * (docs/04 §4.3, "Golden replays are simply recordings of this exact stream with
 * timestamps"). Replaying it reproduces the real experience offline, for the demo and
 * for schools with poor connections.
 */
export const GoldenRecording = z.strictObject({
  version: z.literal(1),
  /** e.g. "g1", "g2". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** The flattened, header-pixelated page that was uploaded, served from /golden/<file>. */
  page: z.strictObject({
    file: z.string().regex(/^[a-z0-9-]+\.jpg$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  /** Every event in arrival order, with milliseconds since the first one. */
  events: z
    .array(z.strictObject({ at_ms: z.number().min(0), event: SnapEvent }))
    .min(1)
    .refine((es) => es.every((e, i) => i === 0 || e.at_ms >= (es[i - 1]?.at_ms ?? 0)), {
      message: "events must be in time order",
    })
    .refine((es) => es[0]?.event.type === "accepted", { message: "first event must be accepted" })
    .refine((es) => es.at(-1)?.event.type === "done", { message: "last event must be done" }),
});
export type GoldenRecording = z.infer<typeof GoldenRecording>;
