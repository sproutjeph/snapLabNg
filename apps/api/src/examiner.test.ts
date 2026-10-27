import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExaminerJudgement, ExaminerTurnResponse } from "@snaplab/contracts";
import { METER_BRIDGE_QUESTIONS } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { type Config, loadConfig } from "./env";
import { outputText } from "./meta";
import { RateLimiter } from "./rateLimit";
import { SpendLedger } from "./spend";

/** Live turns recorded on Oct 27, one per question (text only: G1's synthetic sentences and made-up answers). */
const FIXTURES = join(__dirname, "../../../fixtures/recorded/2026-10-27-examiner");

const recorded = (id: string) =>
  ExaminerJudgement.parse(
    JSON.parse(
      outputText(
        JSON.parse(readFileSync(join(FIXTURES, `spark-examiner-${id}.json`), "utf8")).response,
      ),
    ),
  );

const ledger = (cap = 1) =>
  new SpendLedger(join(mkdtempSync(join(tmpdir(), "l-")), "l.json"), cap, cap);

const app = (cfg: Config, opts: { perHour?: number; cap?: number } = {}) =>
  createApp(cfg, {
    ledger: ledger(opts.cap),
    limiter: new RateLimiter(10),
    examinerLimiter: new RateLimiter(opts.perHour ?? 30),
  });

const fixturesCfg = (): Config => ({
  ...loadConfig({ MODE: "fixtures" }),
  examinerFixtureDir: FIXTURES,
});

const turn = {
  question_id: "mb-jockey-slide",
  answer: "E go scratch the wire, so the wire no go dey uniform again",
  language: "pidgin",
  her_mistake: "2. I slid the jockey gently along the wire to find the balance point.",
};

const post = (a: ReturnType<typeof app>, body: unknown) =>
  a.request("/api/examiner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/examiner", () => {
  it("returns Spark's verdict and reply with the bank's model answer", async () => {
    const res = await post(app(fixturesCfg()), turn);
    expect(res.status).toBe(200);
    const body = ExaminerTurnResponse.parse(await res.json());
    expect(body.verdict).toBe(recorded("mb-jockey-slide").verdict);
    expect(body.reply.length).toBeGreaterThan(0);
    expect(body.reply.length).toBeLessThanOrEqual(300);
    expect(body.model_answer).toBe(METER_BRIDGE_QUESTIONS.jockey.model_answer);
  });

  it("refuses a bad body and an unknown question with 400", async () => {
    const a = app(fixturesCfg());
    expect((await post(a, { ...turn, answer: "   " })).status).toBe(400);
    expect((await post(a, { ...turn, language: "french" })).status).toBe(400);
    expect((await post(a, { ...turn, extra: 1 })).status).toBe(400);
    expect((await post(a, { ...turn, question_id: "nope" })).status).toBe(400);
  });

  it("refuses the 31st answer from one IP in an hour", async () => {
    const a = app(fixturesCfg(), { perHour: 30 });
    for (let i = 0; i < 30; i++) expect((await post(a, turn)).status).toBe(200);
    expect((await post(a, turn)).status).toBe(429);
  });

  it("is offline in golden-only mode", async () => {
    const res = await post(app({ ...loadConfig({ MODE: "golden-only" }) }), turn);
    expect(res.status).toBe(503);
  });

  it("makes no call once the live budget is used up", async () => {
    // A dummy key, built at runtime so no key-shaped literal sits in the source.
    const dummy = ["LLM", "test", "secret", "456"].join("_");
    const cfg = loadConfig({ MODE: "live", MODEL_API_KEY: dummy });
    const res = await post(app(cfg, { cap: 0 }), turn);
    expect(res.status).toBe(402);
  });

  it("has a recorded answer for every bank question, matching the strict contract", () => {
    // One recording per bank question, so every question works offline.
    for (const q of Object.values(METER_BRIDGE_QUESTIONS)) {
      expect(recorded(q.id).reply.trim().length).toBeGreaterThan(0);
    }
  });
});
