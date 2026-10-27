import type { SnapEvent } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { parseSse } from "./sse";
import { traceFromEvents } from "./trace";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

async function all(chunks: string[]) {
  const out = [];
  for await (const m of parseSse(streamOf(chunks))) out.push(m);
  return out;
}

describe("parseSse", () => {
  it("reassembles events split across chunks, with CRLF and comments", async () => {
    // Server-sent events format (WHATWG HTML §9.2): blank line ends an event; ":" lines are comments.
    const msgs = await all([
      'event: accepted\r\ndata: {"a":',
      '1}\r\n\r\n: heartbeat\n\nevent: mode\ndata: {"b":2}\n',
      "\n",
    ]);
    expect(msgs).toEqual([
      { event: "accepted", data: '{"a":1}' },
      { event: "mode", data: '{"b":2}' },
    ]);
  });

  it("joins multi-line data and keeps a final event without a trailing blank line", async () => {
    expect(await all(["data: line one\ndata: line two\n\ndata: tail"])).toEqual([
      { event: "message", data: "line one\nline two" },
      { event: "message", data: "tail" },
    ]);
  });
});

describe("traceFromEvents", () => {
  it("turns timing events into drawer calls on the client clock and errors into flags", () => {
    const events: SnapEvent[] = [
      { type: "accepted", request_id: "r", image_sha256: "x" },
      {
        type: "timing",
        id: "spark-blueprint",
        lane: "spark",
        model: "muse-spark-1.3",
        label: "Blueprint compile",
        start_ms: 2,
        end_ms: 7800,
        status: "ok",
        request: {},
        response: {},
        note: null,
      },
      {
        type: "error",
        stage: "readings",
        message: "timed out or cancelled",
        fallback: "retry_later",
      },
    ];
    const t = traceFromEvents(events, 1000);
    expect(t.calls).toEqual([
      expect.objectContaining({
        id: "spark-blueprint",
        lane: "spark",
        startMs: 1002,
        endMs: 8800,
        status: "ok",
      }),
    ]);
    expect(t.flags).toEqual([
      { lane: "wonder", message: "timed out or cancelled (fallback: retry_later)" },
    ]);
  });
});

describe("parseSse edge cases", () => {
  it("handles a CRLF split across two chunks", async () => {
    const msgs = await all(["data: a\r", "\n\r\n", "data: b\r\n\r\n"]);
    expect(msgs).toEqual([
      { event: "message", data: "a" },
      { event: "message", data: "b" },
    ]);
  });
});
