import type { QuestionEvent } from "@snaplab/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamQuestion } from "./client";

const question = {
  experiment: "ohms_law_vi",
  confidence: "high",
  source_as_printed: "WASSCE (SC) 2018, Physics Paper 3, Question 3B",
  title_as_printed: "Ohm's law (V–I)",
  apparatus: [{ kind: "ammeter", text_as_printed: "an ammeter" }],
  instructions: [{ label: "1", text: "Connect the circuit." }],
  diagram: {
    present: true,
    photo: 0,
    parts: [
      { kind: "ammeter", label_as_printed: "A", box: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.3 } },
    ],
  },
} as const;

function sseResponse(lines: string[], ok = true, status = 200): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const line of lines) c.enqueue(enc.encode(line));
      c.close();
    },
  });
  return { ok, status, body: ok ? body : null } as Response;
}

async function collect(): Promise<QuestionEvent[]> {
  const events: QuestionEvent[] = [];
  await streamQuestion([new Blob(["x"], { type: "image/jpeg" })], (e) => events.push(e));
  return events;
}

describe("streamQuestion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the photos as multipart field 'photos' and reports a good event", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenInit = init;
      return sseResponse([
        `data: ${JSON.stringify({ type: "accepted", request_id: "r1", image_sha256: ["a"] })}\n\n`,
        `data: ${JSON.stringify({ type: "question", question })}\n\n`,
        `data: ${JSON.stringify({ type: "done", total_ms: 12 })}\n\n`,
      ]);
    });
    const events = await collect();
    expect(seenUrl).toBe("/api/question");
    const form = seenInit?.body as FormData;
    expect(form.getAll("photos")).toHaveLength(1);
    expect(events.map((e) => e.type)).toEqual(["accepted", "question", "done"]);
    expect(events[1]).toMatchObject({ type: "question", question: { experiment: "ohms_law_vi" } });
  });

  it("ends with a client error on a bad line and reports nothing after it", async () => {
    vi.stubGlobal("fetch", async () =>
      sseResponse([
        "data: {not json}\n\n",
        `data: ${JSON.stringify({ type: "done", total_ms: 1 })}\n\n`,
      ]),
    );
    const events = await collect();
    expect(events).toEqual([
      {
        type: "error",
        stage: "input",
        message: "The server sent an event this app doesn't understand.",
        fallback: "app_question",
      },
    ]);
  });

  it("passes an error event from the server through unchanged", async () => {
    const serverError = {
      type: "error",
      stage: "read",
      message: "We could not read that question.",
      fallback: "app_question",
    } as const;
    vi.stubGlobal("fetch", async () => sseResponse([`data: ${JSON.stringify(serverError)}\n\n`]));
    expect(await collect()).toEqual([serverError]);
  });

  it("reports an HTTP refusal as an input error", async () => {
    vi.stubGlobal("fetch", async () => sseResponse([], false, 429));
    expect(await collect()).toEqual([
      {
        type: "error",
        stage: "input",
        message: "The server refused the photos (HTTP 429).",
        fallback: "app_question",
      },
    ]);
  });
});
