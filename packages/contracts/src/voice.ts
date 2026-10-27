import { z } from "zod";

// The examiner voice relay (GET /ws/examiner, docs/04 §2 ⑥, docs/06 §5.5). One socket per
// spoken answer: the browser streams raw PCM16 mono 16 kHz as binary frames, then sends
// `{"type":"end"}` when she lets go of the button. The server only ever sends these.

export const VoiceClientEnd = z.strictObject({ type: z.literal("end") });
export type VoiceClientEnd = z.infer<typeof VoiceClientEnd>;

export const VoiceServerMessage = z.discriminatedUnion("type", [
  /** The speech service has accepted the session; audio sent before this is queued. */
  z.strictObject({ type: z.literal("ready") }),
  /** Her words so far (`final: false` replaces the previous partial) or in full. */
  z.strictObject({ type: z.literal("transcript"), text: z.string(), final: z.boolean() }),
  /** Something went wrong; the socket closes next and she can type instead. */
  z.strictObject({ type: z.literal("error"), message: z.string() }),
]);
export type VoiceServerMessage = z.infer<typeof VoiceServerMessage>;
