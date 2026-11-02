import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./env";
import { RateLimiter } from "./rateLimit";
import { SpendLedger } from "./spend";
import { wsOriginAllowed } from "./voiceServer";

const SITE = "https://snaplab.web.app";

const app = (allowed?: string) =>
  createApp(loadConfig({ MODE: "fixtures", ...(allowed ? { ALLOWED_ORIGINS: allowed } : {}) }), {
    ledger: new SpendLedger(join(mkdtempSync(join(tmpdir(), "l-")), "l.json"), 1, 1),
    limiter: new RateLimiter(10),
    examinerLimiter: new RateLimiter(10),
  });

const preflight = (a: ReturnType<typeof app>, origin: string) =>
  a.request("/api/examiner", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

describe("CORS on /api/*", () => {
  it("allows a listed origin (and trims a trailing slash in the list)", async () => {
    const res = await preflight(app(`${SITE}/, https://x.firebaseapp.com`), SITE);
    expect(res.headers.get("access-control-allow-origin")).toBe(SITE);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("refuses an unlisted origin: no allow-origin header", async () => {
    const res = await preflight(app(SITE), "https://evil.example");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds no CORS headers when ALLOWED_ORIGINS is unset", async () => {
    const res = await preflight(app(), SITE);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("/ws/examiner origin check", () => {
  const req = (origin?: string) =>
    new Request("https://api.run.app/ws/examiner", {
      headers: { host: "api.run.app", ...(origin ? { origin } : {}) },
    });

  it("allows a listed origin", () => {
    expect(wsOriginAllowed(req(SITE), [SITE])).toBe(true);
  });
  it("allows the same host", () => {
    expect(wsOriginAllowed(req("https://api.run.app"), [SITE])).toBe(true);
  });
  it("refuses an unlisted origin", () => {
    expect(wsOriginAllowed(req("https://evil.example"), [SITE])).toBe(false);
  });
  it("allows anything when ALLOWED_ORIGINS is unset", () => {
    expect(wsOriginAllowed(req("https://evil.example"), [])).toBe(true);
  });
});
