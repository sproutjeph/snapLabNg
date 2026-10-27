import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SnapEvent, SnapEvent as SnapEventSchema } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { type Config, loadConfig } from "./env";
import { RateLimiter } from "./rateLimit";
import { componentBoxPrompt, runSnap, toPageBox } from "./snap";
import { SpendLedger } from "./spend";

const SPIKE = join(__dirname, "../../../fixtures/spike/2026-10-26");

function cfgFor(fixtureDir: string): Config {
  return { ...loadConfig({ MODE: "fixtures" }), fixtureDir };
}

async function collect(cfg: Config): Promise<SnapEvent[]> {
  const events: SnapEvent[] = [];
  await runSnap(
    cfg,
    { photo: new Uint8Array([1, 2, 3]), width: 1024, height: 1448, hint: "meter_bridge" },
    (e) => events.push(e),
    new AbortController().signal,
  );
  return events;
}

describe("runSnap on the recorded Oct 26 responses", () => {
  it("streams valid events in the docs/04 §4.3 order", async () => {
    const events = await collect(cfgFor(SPIKE));
    for (const e of events) expect(SnapEventSchema.safeParse(e).success).toBe(true);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("accepted");
    expect(types.at(-1)).toBe("done");
    const mode = types.indexOf("mode");
    expect(mode).toBeGreaterThan(0);
    for (const later of ["values", "setup_issues", "readings", "sam_box"]) {
      const i = types.indexOf(later as SnapEvent["type"]);
      if (i !== -1) expect(i).toBeGreaterThan(mode);
    }
    expect(events.find((e) => e.type === "mode")).toMatchObject({ experiment: "meter_bridge" });
    expect(types).toContain("readings");
  });

  it("sends one timing per model call and never the blueprint's notes", async () => {
    const events = await collect(cfgFor(SPIKE));
    const timings = events.filter((e) => e.type === "timing");
    expect(timings.map((t) => t.lane).sort()).toEqual(
      // Text prompts for "table" and "graph"; this blueprint fixture has no components, so
      // there is no box-prompt request for drawn parts (docs/06 §5.2 Plan B).
      ["sam", "sam", "spark", "wonder"].sort(),
    );
    // Spark copied NAME/SCHOOL into notes on Oct 26 (BUILD_LOG); it must not reach the client.
    expect(JSON.stringify(events)).not.toContain("Amina Bello");
    expect(JSON.stringify(events)).not.toContain("data:image");
  });

  it("reports a broken readings answer as an error and still finishes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fx-"));
    copyFileSync(join(SPIKE, "spark-blueprint.json"), join(dir, "spark-blueprint.json"));
    const wonder = JSON.parse(readFileSync(join(SPIKE, "wonder-readings.json"), "utf8"));
    wonder.response.output = [
      { type: "message", content: [{ type: "output_text", text: "{not json" }] },
    ];
    writeFileSync(join(dir, "wonder-readings.json"), JSON.stringify(wonder));
    const events = await collect(cfgFor(dir));
    expect(events).toContainEqual(expect.objectContaining({ type: "error", stage: "readings" }));
    expect(events.at(-1)?.type).toBe("done");
    expect(events.map((e) => e.type)).not.toContain("readings");
  });
});

describe("toPageBox", () => {
  it("turns half-open source pixels into 0–1 page coordinates and clamps", () => {
    expect(toPageBox({ left: 256, top: 362, right: 768, bottom: 1448 }, 1024, 1448)).toEqual({
      x0: 0.25,
      y0: 0.25,
      x1: 0.75,
      y1: 1,
    });
    expect(toPageBox({ left: -5, top: 0, right: 2000, bottom: 10 }, 1024, 1448).x0).toBe(0);
  });
});

describe("HTTP", () => {
  const app = (cfg: Config, perHour = 10) =>
    createApp(cfg, {
      ledger: new SpendLedger(join(mkdtempSync(join(tmpdir(), "l-")), "l.json"), 1, 1),
      limiter: new RateLimiter(perHour),
    });

  it("never shows the key on /healthz", async () => {
    // A dummy key, built at runtime so no key-shaped literal sits in the source.
    const dummy = ["LLM", "test", "secret", "123"].join("_");
    const cfg = { ...loadConfig({ MODE: "live", MODEL_API_KEY: dummy }) };
    const res = await app(cfg).request("/healthz");
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(dummy);
    expect(text).toContain('"mode":"live"');
  });

  it("streams a snap over SSE in fixtures mode", async () => {
    const form = new FormData();
    form.set(
      "photo",
      new File([new Uint8Array([255, 216, 255])], "page.jpg", { type: "image/jpeg" }),
    );
    form.set("width", "1024");
    form.set("height", "1448");
    const res = await app(cfgFor(SPIKE)).request("/api/snap", { method: "POST", body: form });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(body).toContain("event: accepted");
    expect(body).toContain("event: mode");
    expect(body.trim().split("\n\n").at(-1)).toContain("event: done");
  });

  it("refuses the 2nd snap with a limit of 1 per hour", async () => {
    const a = app(cfgFor(SPIKE), 1);
    const send = async () => {
      const form = new FormData();
      form.set(
        "photo",
        new File([new Uint8Array([255, 216, 255, 0])], "p.jpg", { type: "image/jpeg" }),
      );
      form.set("width", "10");
      form.set("height", "10");
      const res = await a.request("/api/snap", { method: "POST", body: form });
      return res.text();
    };
    expect(await send()).toContain("event: mode");
    const second = await send();
    expect(second).toContain('"stage":"rate_limit"');
    expect(second).not.toContain("event: mode");
  });

  it("rejects a photo that is not a JPEG with a plain 400, before any stream", async () => {
    const form = new FormData();
    form.set("photo", new File(["<svg/>"], "p.svg", { type: "image/svg+xml" }));
    form.set("width", "10");
    form.set("height", "10");
    const res = await app(cfgFor(SPIKE)).request("/api/snap", { method: "POST", body: form });
    expect(res.status).toBe(400);
  });
});

describe("componentBoxPrompt (SAM Plan B)", () => {
  // dev.meta.ai/docs/sam/segmenting: box prompts in source pixels, at most 16 objects, ids we choose.
  const comp = (
    kind: "galvanometer" | "cell" | "key",
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => ({
    kind,
    label_as_written: null,
    approx_box: { x0, y0, x1, y1 },
  });

  it("turns the blueprint's 0–1 boxes into pixel box prompts with ids 1…n", () => {
    const p = componentBoxPrompt(
      [comp("galvanometer", 0.5, 0.4, 0.55, 0.5), comp("key", 0.6, 0.2, 0.68, 0.28)],
      1200,
      896,
    );
    expect(p?.names).toEqual(["galvanometer", "key"]);
    expect(p?.text).toContain("1<|box;x1=600;y1=358");
    expect(p?.text).toContain("2<|box;x1=720;y1=179");
  });

  it("skips boxes that are too small and caps at 16 objects", () => {
    expect(componentBoxPrompt([comp("cell", 0.5, 0.5, 0.5005, 0.6)], 1000, 1000)).toBeNull();
    const many = Array.from({ length: 20 }, (_, i) =>
      comp("cell", 0.01 * i, 0.1, 0.01 * i + 0.05, 0.2),
    );
    expect(componentBoxPrompt(many, 1000, 1000)?.names).toHaveLength(16);
  });
});
