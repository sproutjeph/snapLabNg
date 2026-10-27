// The only module that reads process.env. The key never leaves this file except
// as the Authorization header built in meta.ts; never log or return it.

import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Paths below are relative to the repo root, wherever the server is started from. */
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const fromRoot = (p: string) => (isAbsolute(p) ? p : resolve(REPO_ROOT, p));

export type Mode = "live" | "fixtures" | "golden-only";

export interface Config {
  mode: Mode;
  /** Present only in live mode. */
  apiKey: string | null;
  recordFixtures: boolean;
  fixtureDir: string;
  /** Recorded examiner turns, replayed in fixtures mode. */
  examinerFixtureDir: string;
  recordDir: string;
  spendCapUsd: number;
  spendDailyCapUsd: number;
  spendLedgerPath: string;
  snapsPerHourPerIp: number;
  examinerTurnsPerHourPerIp: number;
  /** Trust fly-client-ip / x-forwarded-for for rate limiting (only behind a real proxy). */
  trustProxy: boolean;
  port: number;
  /** The built web app, served from the same origin by mountWebDist. */
  webDistDir: string;
}

function num(v: string | undefined, fallback: number): number {
  const n = v === undefined ? Number.NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const mode: Mode =
    env.MODE === "live" || env.MODE === "golden-only" || env.MODE === "fixtures"
      ? env.MODE
      : "fixtures";
  const apiKey = env.MODEL_API_KEY?.trim() || null;
  if (mode === "live" && !apiKey) {
    throw new Error("MODE=live needs MODEL_API_KEY in the server env");
  }
  return {
    mode,
    apiKey: mode === "live" ? apiKey : null,
    recordFixtures: env.RECORD_FIXTURES === "1",
    fixtureDir: fromRoot(env.FIXTURE_DIR ?? "fixtures/spike/2026-10-26"),
    examinerFixtureDir: fromRoot(
      env.EXAMINER_FIXTURE_DIR ?? "fixtures/recorded/2026-10-27-examiner",
    ),
    recordDir: fromRoot(
      env.RECORD_DIR ?? `fixtures/recorded/${new Date().toISOString().slice(0, 10)}`,
    ),
    spendCapUsd: num(env.SPEND_CAP_USD, 20),
    spendDailyCapUsd: num(env.SPEND_DAILY_CAP_USD, 5),
    spendLedgerPath: fromRoot(env.SPEND_LEDGER_PATH ?? ".spend/ledger.json"),
    snapsPerHourPerIp: num(env.SNAPS_PER_HOUR_PER_IP, 10),
    examinerTurnsPerHourPerIp: num(env.EXAMINER_TURNS_PER_HOUR_PER_IP, 30),
    trustProxy: env.TRUST_PROXY === "1",
    port: num(env.PORT, 8787),
    webDistDir: fromRoot(env.WEB_DIST_DIR ?? "apps/web/dist"),
  };
}
