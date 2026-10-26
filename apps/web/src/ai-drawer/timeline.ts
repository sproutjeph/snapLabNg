import type { AiCall, AiTrace, LaneId } from "./types";

export const LANE_ORDER: readonly LaneId[] = ["spark", "sam", "wonder", "voice", "engine"] as const;

export interface LaneSpan {
  id: string;
  call: AiCall;
  leftPct: number;
  widthPct: number;
  durationMs: number;
}

export interface LaneTotals {
  count: number;
  totalMs: number;
}

export interface TraceSummary {
  totalCalls: number;
  byLane: Record<LaneId, LaneTotals>;
  longestCall: { call: AiCall; durationMs: number } | null;
  anyFallback: boolean;
  anyRunning: boolean;
}

const SENSITIVE_KEY_PATTERN = /(^|[-_])(api[-_]?key|key|authorization|token|secret)$/i;
const MAX_INLINE_STRING_LENGTH = 2000;

function isSensitiveKey(key: string): boolean {
  const snakeKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(snakeKey);
}

/**
 * Computes each call's `{ leftPct, widthPct }` bar on a shared time axis
 * from `trace.t0Ms` to `max(nowMs, last end)`. Running calls (`endMs === null`)
 * stretch to `nowMs`.
 */
export function laneSpans(trace: AiTrace, nowMs: number): LaneSpan[] {
  const t0 = trace.t0Ms;
  let maxEnd = nowMs;
  for (const call of trace.calls) {
    const callEnd = call.endMs ?? Math.max(nowMs, call.startMs);
    if (callEnd > maxEnd) {
      maxEnd = callEnd;
    }
  }

  const totalWindowMs = maxEnd > t0 ? maxEnd - t0 : 1;

  return trace.calls.map((call) => {
    const start = Math.max(t0, call.startMs);
    const end = Math.max(start, call.endMs ?? nowMs);
    const leftPct = ((start - t0) / totalWindowMs) * 100;
    const widthPct = ((end - start) / totalWindowMs) * 100;
    const durationMs = Math.max(0, (call.endMs ?? nowMs) - call.startMs);

    return {
      id: call.id,
      call,
      leftPct,
      widthPct,
      durationMs,
    };
  });
}

/**
 * Formats a duration in milliseconds: `"840 ms"` under 1 s, `"1.24 s"` from 1 s up.
 */
export function formatMs(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 1000) {
    return `${Math.round(clamped)} ms`;
  }
  return `${(clamped / 1000).toFixed(2)} s`;
}

/**
 * Summarises a trace: totals per lane, total call count, the longest call,
 * and whether any call fell back (`status === "fallback"`).
 */
export function summarise(trace: AiTrace, nowMs?: number): TraceSummary {
  const byLane: Record<LaneId, LaneTotals> = {
    spark: { count: 0, totalMs: 0 },
    sam: { count: 0, totalMs: 0 },
    wonder: { count: 0, totalMs: 0 },
    voice: { count: 0, totalMs: 0 },
    engine: { count: 0, totalMs: 0 },
  };

  let longestCall: { call: AiCall; durationMs: number } | null = null;
  let anyFallback = false;
  let anyRunning = false;

  for (const call of trace.calls) {
    const effectiveEnd = call.endMs ?? nowMs ?? call.startMs;
    const durationMs = Math.max(0, effectiveEnd - call.startMs);
    const laneStat = byLane[call.lane];
    laneStat.count += 1;
    laneStat.totalMs += durationMs;

    if (call.status === "fallback") {
      anyFallback = true;
    }
    if (call.status === "running" || call.endMs === null) {
      anyRunning = true;
    }
    if (longestCall === null || durationMs > longestCall.durationMs) {
      longestCall = { call, durationMs };
    }
  }

  return {
    totalCalls: trace.calls.length,
    byLane,
    longestCall,
    anyFallback,
    anyRunning,
  };
}

function estimateDataUrlKb(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return Math.max(1, Math.round(dataUrl.length / 1024));
  }
  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const bytes = header.includes(";base64") ? Math.floor((body.length * 3) / 4) : body.length;
  return Math.max(1, Math.round(bytes / 1024));
}

/**
 * Deep-copies a JSON value for display:
 * - Replaces any string starting with `data:` with `"[image N KB]"`
 * - Replaces any string longer than 2,000 characters with `"[text N,NNN chars]"`
 * - Removes any property matching key/api_key/authorization/token/secret (case-insensitive, including prefixes and camelCase) at any depth
 * - Replaces circular object references with `"[circular]"`.
 */
export function redactForDisplay(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      const kb = estimateDataUrlKb(value);
      return `[image ${kb} KB]`;
    }
    if (value.length > MAX_INLINE_STRING_LENGTH) {
      return `[text ${value.length.toLocaleString("en-US")} chars]`;
    }
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactForDisplay(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      continue;
    }
    out[k] = redactForDisplay(v, seen);
  }
  return out;
}
