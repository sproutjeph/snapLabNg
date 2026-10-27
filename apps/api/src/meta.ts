import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./env";

const BASE = "https://api.meta.ai/v1";

export interface MetaResult {
  /** The full Responses API object (for a stream: the one inside response.completed). */
  response: ResponsesObject;
  /** Every stream event, for SAM's parser; empty for non-streamed calls. */
  events: StreamEvent[];
  latencyMs: number;
}

export interface ResponsesObject {
  model?: string;
  output?: Array<{ type?: string; id?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; images_processed?: number };
  [k: string]: unknown;
}

export type StreamEvent = { type: string; [k: string]: unknown };

/** The concatenated output text of a Responses object. */
export function outputText(r: ResponsesObject): string {
  return (r.output ?? [])
    .flatMap((o) => o.content ?? [])
    .map((c) => c.text ?? "")
    .join("");
}

/** Replaces inline images (data URLs) with a size note, so records hold no photo. */
export function redactImages(body: unknown): unknown {
  return JSON.parse(
    JSON.stringify(body, (_k, v) =>
      typeof v === "string" && v.startsWith("data:")
        ? `[image ${Math.round((v.length * 3) / 4 / 1024)} KB]`
        : v,
    ),
  );
}

/** Turns a non-streamed response into the done/completed events SAM's parser reads. */
export function eventsFromResponse(r: ResponsesObject): StreamEvent[] {
  const events: StreamEvent[] = [];
  (r.output ?? []).forEach((o, output_index) => {
    (o.content ?? []).forEach((c, content_index) => {
      if (c.type === "output_text") {
        events.push({
          type: "response.output_text.done",
          text: c.text ?? "",
          item_id: o.id ?? `item_${output_index}`,
          output_index,
          content_index,
        });
      }
    });
  });
  events.push({ type: "response.completed", response: r });
  return events;
}

async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let sep = buf.indexOf("\n\n");
    while (sep !== -1) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data) as StreamEvent;
      sep = buf.indexOf("\n\n");
    }
  }
}

/**
 * One call to POST /v1/responses. In fixtures mode it reads `<fixtureDir>/<name>.json`
 * (the format scripts/meta-check.ts writes) and never touches the network. In live mode
 * it calls Meta; with RECORD_FIXTURES=1 it also writes the response to recordDir.
 * Errors carry the HTTP status, never the request headers.
 */
export async function callResponses(
  cfg: Config,
  name: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<MetaResult> {
  const t0 = performance.now();
  if (cfg.mode !== "live") {
    const f = JSON.parse(readFileSync(join(cfg.fixtureDir, `${name}.json`), "utf8")) as {
      response: ResponsesObject & { events?: StreamEvent[] };
    };
    const response = f.response;
    const events = Array.isArray(response.events) ? response.events : [];
    return { response, events, latencyMs: Math.round(performance.now() - t0) };
  }

  const res = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Meta ${name} failed with HTTP ${res.status}`);
  }

  let response: ResponsesObject;
  const events: StreamEvent[] = [];
  if (body.stream === true) {
    for await (const ev of sseEvents(res.body)) {
      events.push(ev);
      if (ev.type === "response.failed" || ev.type === "error") {
        throw new Error(`Meta ${name} stream failed (${ev.type})`);
      }
    }
    const done = events.find((e) => e.type === "response.completed");
    response = (done?.response as ResponsesObject | undefined) ?? {};
  } else {
    response = (await res.json()) as ResponsesObject;
  }
  const latencyMs = Math.round(performance.now() - t0);

  if (cfg.recordFixtures) {
    mkdirSync(cfg.recordDir, { recursive: true });
    const recorded = events.length ? { ...response, events } : response;
    writeFileSync(
      join(cfg.recordDir, `${name}.json`),
      `${JSON.stringify({ name, status: res.status, latencyMs, request: redactImages(body), response: recorded }, null, 2)}\n`,
    );
  }
  return { response, events, latencyMs };
}
