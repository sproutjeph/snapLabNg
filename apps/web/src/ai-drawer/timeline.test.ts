import { describe, expect, it } from "vitest";
import { formatMs, laneSpans, redactForDisplay, summarise } from "./timeline";
import type { AiTrace } from "./types";

describe("timeline helpers", () => {
  it("computes laneSpans leftPct and widthPct within 1e-9 and stretches running calls to nowMs", () => {
    const trace: AiTrace = {
      t0Ms: 0,
      calls: [
        {
          id: "c1",
          lane: "spark",
          model: "muse-spark-1.3",
          label: "Blueprint compile",
          startMs: 0,
          endMs: 1000,
          status: "ok",
          request: {},
          response: {},
          note: null,
        },
        {
          id: "c2",
          lane: "sam",
          model: "sam-3.1",
          label: "Outline: galvanometer",
          startMs: 500,
          endMs: 2000,
          status: "ok",
          request: {},
          response: {},
          note: null,
        },
      ],
      flags: [],
    };

    const spans = laneSpans(trace, 2000);
    expect(spans).toHaveLength(2);
    expect(Math.abs((spans[0]?.leftPct ?? 0) - 0)).toBeLessThan(1e-9);
    expect(Math.abs((spans[0]?.widthPct ?? 0) - 50)).toBeLessThan(1e-9);
    expect(Math.abs((spans[1]?.leftPct ?? 0) - 25)).toBeLessThan(1e-9);
    expect(Math.abs((spans[1]?.widthPct ?? 0) - 75)).toBeLessThan(1e-9);

    const runningTrace: AiTrace = {
      t0Ms: 0,
      calls: [
        ...trace.calls,
        {
          id: "c3",
          lane: "wonder",
          model: "muse-wonder-1.0",
          label: "Page readings",
          startMs: 600,
          endMs: null,
          status: "running",
          request: {},
          response: null,
          note: null,
        },
      ],
      flags: [],
    };

    const runningSpans = laneSpans(runningTrace, 3000);
    const runningBar = runningSpans[2];
    expect(runningBar).toBeDefined();
    expect(Math.abs((runningBar?.leftPct ?? 0) - 20)).toBeLessThan(1e-9);
    expect(Math.abs((runningBar?.widthPct ?? 0) - 80)).toBeLessThan(1e-9);
    expect(Math.abs((runningBar?.leftPct ?? 0) + (runningBar?.widthPct ?? 0) - 100)).toBeLessThan(
      1e-9,
    );
  });

  it("formats durations under and from 1 second with formatMs", () => {
    expect(formatMs(840)).toBe("840 ms");
    expect(formatMs(1240)).toBe("1.24 s");
    expect(formatMs(0)).toBe("0 ms");
  });

  it("summarises calls per lane, finds the longest call, and reports anyFallback", () => {
    const trace: AiTrace = {
      t0Ms: 0,
      calls: [
        {
          id: "s1",
          lane: "spark",
          model: "muse-spark-1.3",
          label: "Blueprint compile",
          startMs: 0,
          endMs: 2400,
          status: "ok",
          request: {},
          response: {},
          note: null,
        },
        {
          id: "m1",
          lane: "sam",
          model: "sam-3.1",
          label: "Outline: resistance box",
          startMs: 50,
          endMs: 950,
          status: "ok",
          request: {},
          response: {},
          note: null,
        },
        {
          id: "m2",
          lane: "sam",
          model: "sam-3.1",
          label: "Outline: plug key",
          startMs: 60,
          endMs: 1160,
          status: "fallback",
          request: {},
          response: {},
          note: "fallback: boxes from Spark",
        },
        {
          id: "w1",
          lane: "wonder",
          model: "muse-wonder-1.0",
          label: "Page readings",
          startMs: 80,
          endMs: 4280,
          status: "ok",
          request: {},
          response: {},
          note: null,
        },
      ],
      flags: [],
    };

    const summary = summarise(trace);
    expect(summary.totalCalls).toBe(4);
    expect(summary.byLane.spark.count).toBe(1);
    expect(summary.byLane.spark.totalMs).toBe(2400);
    expect(summary.byLane.sam.count).toBe(2);
    expect(summary.byLane.sam.totalMs).toBe(2000);
    expect(summary.byLane.wonder.count).toBe(1);
    expect(summary.byLane.wonder.totalMs).toBe(4200);
    expect(summary.byLane.voice.count).toBe(0);
    expect(summary.byLane.engine.count).toBe(0);
    expect(summary.longestCall?.call.id).toBe("w1");
    expect(summary.longestCall?.durationMs).toBe(4200);
    expect(summary.anyFallback).toBe(true);
  });

  it("redacts data URLs, long strings, and secret keys without mutating the input", () => {
    // 182 KB binary -> ~248,491 base64 chars
    const base64Body = "A".repeat(Math.round((182 * 1024 * 4) / 3));
    const dataUrl = `data:image/jpeg;base64,${base64Body}`;
    const longText = "x".repeat(5321);

    const original = {
      model: "muse-spark-1.3",
      Authorization: "Bearer LLM_secret_token",
      api_key: "LLM_root_key",
      headers: {
        authorization: "Bearer nested_secret",
        "X-Request-Id": "req-01",
      },
      auth: {
        apiKey: "LLM_nested_camel_key",
        key: "LLM_raw_key",
      },
      input: [
        {
          type: "input_image",
          image_url: dataUrl,
        },
        {
          type: "input_text",
          text: longText,
          shortNote: "metre bridge practical",
          readingCount: 5,
        },
      ],
    };

    const snapshot = JSON.stringify(original);
    const redacted = redactForDisplay(original) as Record<string, unknown>;

    // Does not mutate input
    expect(JSON.stringify(original)).toBe(snapshot);

    // Removes secret keys at all depths
    expect("Authorization" in redacted).toBe(false);
    expect("api_key" in redacted).toBe(false);
    const headers = redacted.headers as Record<string, unknown>;
    expect("authorization" in headers).toBe(false);
    expect(headers["X-Request-Id"]).toBe("req-01");
    const auth = redacted.auth as Record<string, unknown>;
    expect("apiKey" in auth).toBe(false);
    expect("key" in auth).toBe(false);

    // Replaces data URL and long text while preserving short strings and numbers
    const inputArr = redacted.input as Array<Record<string, unknown>>;
    expect(inputArr[0]?.image_url).toBe("[image 182 KB]");
    expect(inputArr[1]?.text).toBe("[text 5,321 chars]");
    expect(inputArr[1]?.shortNote).toBe("metre bridge practical");
    expect(inputArr[1]?.readingCount).toBe(5);
  });
});
