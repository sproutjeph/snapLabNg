import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QuestionEvent as QuestionEventSchema, type QuestionRead } from "@snaplab/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { type Config, loadConfig } from "./env";
import { jpegSize, partBoxPrompt } from "./question";
import { RateLimiter } from "./rateLimit";
import { SpendLedger } from "./spend";

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const QUESTION: QuestionRead = {
  experiment: "ohms_law_vi",
  confidence: "high",
  source_as_printed: "WASSCE (SC) 2018, Physics Paper 3, Question 3B",
  title_as_printed: null,
  apparatus: [{ kind: "ammeter", text_as_printed: "an ammeter" }],
  instructions: [{ label: "(b)(i)", text: "Connect the circuit as shown." }],
  diagram: {
    present: true,
    photo: 1,
    parts: [
      { kind: "ammeter", label_as_printed: "A", box: box(0.1, 0.1, 0.2, 0.2) },
      { kind: "key", label_as_printed: "K", box: box(0.5, 0.5, 0.6, 0.6) },
    ],
  },
};
const asResponse = (text: string) => ({
  response: { output: [{ type: "message", content: [{ type: "output_text", text }] }] },
});
// A recorded SAM box-prompt answer (a real box plus mask); the parser needs both tokens.
const SAM_RECORDED = join(
  __dirname,
  "../../../fixtures/recorded/2026-10-27-note1-v2/sam-components.json",
);

function fixtureDir(opts: { spark?: unknown; sam?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "q-"));
  mkdirSync(dir, { recursive: true });
  if (opts.spark !== null) {
    writeFileSync(
      join(dir, "spark-question.json"),
      JSON.stringify(asResponse(JSON.stringify(opts.spark ?? QUESTION))),
    );
  }
  if (opts.sam !== false) {
    writeFileSync(join(dir, "sam-question.json"), readFileSync(SAM_RECORDED, "utf8"));
  }
  return dir;
}

const cfgFor = (dir: string, extra: Record<string, string> = {}): Config => ({
  ...loadConfig({ MODE: "fixtures", ...extra }),
  questionFixtureDir: dir,
});

const app = (cfg: Config, perHour = 10) =>
  createApp(cfg, {
    ledger: new SpendLedger(join(mkdtempSync(join(tmpdir(), "l-")), "l.json"), 1, 1),
    limiter: new RateLimiter(perHour),
  });

const jpeg = (n: number) =>
  new File([new Uint8Array([255, 216, 255, n])], "p.jpg", { type: "image/jpeg" });

async function post(a: ReturnType<typeof app>, files: File[]) {
  const form = new FormData();
  for (const f of files) form.append("photos", f);
  return a.request("/api/question", { method: "POST", body: form });
}

function parseSse(text: string): QuestionEventSchemaType[] {
  return text
    .trim()
    .split("\n\n")
    .map((block) => {
      const line = block.split("\n").find((l) => l.startsWith("data:")) ?? "";
      return QuestionEventSchema.parse(JSON.parse(line.slice(5)));
    });
}
type QuestionEventSchemaType = ReturnType<typeof QuestionEventSchema.parse>;

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/question (fixtures mode)", () => {
  it("streams accepted, question, timing, part_outline, timing, done", async () => {
    const res = await post(app(cfgFor(fixtureDir())), [jpeg(1), jpeg(2)]);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = parseSse(await res.text());
    expect(events.map((e) => e.type)).toEqual([
      "accepted",
      "question",
      "timing",
      "part_outline",
      "part_outline",
      "timing",
      "done",
    ]);
    expect(events[0]).toMatchObject({ type: "accepted" });
    expect((events[0] as { image_sha256: string[] }).image_sha256).toHaveLength(2);
    expect(events[3]).toMatchObject({
      type: "part_outline",
      part: 0,
      box: { x0: 0.22, y0: 0.344, x1: 1, y1: 0.395 },
      score: 0.54296875,
    });
    expect(JSON.stringify(events)).not.toContain("data:image");
  });

  it("forces diagram.photo to 0 when only one photo was sent", async () => {
    const res = await post(app(cfgFor(fixtureDir())), [jpeg(1)]);
    const q = parseSse(await res.text()).find((e) => e.type === "question");
    expect(q).toMatchObject({ question: { diagram: { photo: 0 } } });
  });

  it("rejects 0 photos, 3 photos and a non-JPEG with a plain 400", async () => {
    const a = app(cfgFor(fixtureDir()));
    expect((await post(a, [])).status).toBe(400);
    expect((await post(a, [jpeg(1), jpeg(2), jpeg(3)])).status).toBe(400);
    const svg = new File(["<svg/>"], "p.svg", { type: "image/svg+xml" });
    expect((await post(a, [jpeg(1), svg])).status).toBe(400);
  });

  it("sends read error then done when Spark fails or there is no fixture", async () => {
    for (const dir of [
      fixtureDir({ spark: { experiment: "nonsense" } }),
      fixtureDir({ spark: null }),
    ]) {
      const events = parseSse(await (await post(app(cfgFor(dir)), [jpeg(1)])).text());
      expect(events.map((e) => e.type)).toEqual(["accepted", "error", "timing", "done"]);
      expect(events[1]).toMatchObject({ stage: "read", fallback: "app_question" });
    }
  });

  it("keeps streaming when SAM fails", async () => {
    const events = parseSse(
      await (await post(app(cfgFor(fixtureDir({ sam: false }))), [jpeg(1), jpeg(2)])).text(),
    );
    expect(events.map((e) => e.type)).toEqual([
      "accepted",
      "question",
      "timing",
      "error",
      "timing",
      "done",
    ]);
    expect(events[3]).toMatchObject({ stage: "sam", fallback: "none" });
  });

  it("refuses the 2nd snap with a limit of 1 per hour", async () => {
    const a = app(cfgFor(fixtureDir()), 1);
    await (await post(a, [jpeg(1)])).text();
    const second = await (await post(a, [jpeg(1)])).text();
    expect(second).toContain('"stage":"rate_limit"');
  });
});

describe("POST /api/question (live mode)", () => {
  it("replays the second identical request from memory without calling Meta", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as { model?: string };
      if (body.model === "muse-spark-1.3") {
        return new Response(JSON.stringify(asResponse(JSON.stringify(QUESTION)).response));
      }
      return new Response("no", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const dummy = ["LLM", "test", "key"].join("_");
    const cfg = { ...loadConfig({ MODE: "live", MODEL_API_KEY: dummy }) };
    const a = app(cfg);
    const first = parseSse(await (await post(a, [jpeg(1), jpeg(2)])).text());
    expect(first.map((e) => e.type)).toContain("question");
    const calls = fetchMock.mock.calls.length;
    const second = parseSse(await (await post(a, [jpeg(1), jpeg(2)])).text());
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(second.map((e) => e.type).slice(0, 3)).toEqual(["accepted", "cache_hit", "question"]);
  });
});

describe("helpers", () => {
  it("partBoxPrompt maps boxes to pixels and remembers part indexes", () => {
    const p = partBoxPrompt(QUESTION.diagram.parts, 1000, 500);
    expect(p?.partIndex).toEqual([0, 1]);
    expect(p?.text).toContain("1<|box;x1=100;y1=50");
  });

  it("jpegSize reads the SOF marker", () => {
    const b = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x01, 0xf4, 0x03, 0x20, 0x01, 0x01, 0x11, 0x00,
    ]);
    expect(jpegSize(b)).toEqual({ width: 800, height: 500 });
    expect(jpegSize(new Uint8Array([255, 216, 255, 0]))).toBeNull();
  });
});
