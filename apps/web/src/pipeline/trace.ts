import type { SnapEvent } from "@snaplab/contracts";
import type { AiCall, AiTrace, CallStatus } from "../ai-drawer/types";

/**
 * Turns the /api/snap events seen so far into the "Show the AI" drawer's trace.
 * `timing` events become calls on the server's clock (ms since `accepted`), offset by
 * `t0Ms`, the client time when `accepted` arrived. Stage errors become flags.
 */
export function traceFromEvents(events: readonly SnapEvent[], t0Ms: number): AiTrace {
  const calls: AiCall[] = [];
  const flags: AiTrace["flags"] = [];
  for (const e of events) {
    if (e.type === "timing") {
      const status: CallStatus = e.status;
      calls.push({
        id: e.id,
        lane: e.lane,
        model: e.model,
        label: e.label,
        startMs: t0Ms + e.start_ms,
        endMs: t0Ms + e.end_ms,
        status,
        request: e.request,
        response: e.response,
        note: e.note,
      });
    } else if (e.type === "error") {
      const lane = e.stage === "readings" ? "wonder" : e.stage === "sam" ? "sam" : "spark";
      flags.push({ lane, message: `${e.message} (fallback: ${e.fallback})` });
    } else if (e.type === "cache_hit") {
      flags.push({
        lane: "engine",
        message: "Same page as before: answers replayed from the cache",
      });
    }
  }
  return { t0Ms, calls, flags };
}
