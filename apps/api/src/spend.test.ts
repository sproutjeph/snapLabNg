import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimit";
import { costUsd, SpendLedger } from "./spend";

describe("costUsd", () => {
  it("prices the recorded Oct 26 calls at list prices", () => {
    // docs/06 §3: Wonder $4 in / $20 out per M tokens; Spark $1.25 / $4.25; SAM $2.50 per 1,000 images.
    // Usage from fixtures/spike/2026-10-26.
    expect(costUsd("muse-wonder-1.0", { input_tokens: 4064, output_tokens: 3332 })).toBeCloseTo(
      0.082896,
      6,
    );
    expect(costUsd("muse-spark-1.3", { input_tokens: 4060, output_tokens: 991 })).toBeCloseTo(
      0.00929,
      5,
    );
    expect(costUsd("sam-3.1", { images_processed: 1 })).toBeCloseTo(0.0025, 6);
  });
});

describe("SpendLedger", () => {
  const ledgerPath = () => join(mkdtempSync(join(tmpdir(), "spend-")), "ledger.json");

  it("refuses a reserve that would pass the total cap", () => {
    const l = new SpendLedger(ledgerPath(), 0.2, 5);
    expect(l.reserve(0.15)).toBe(true);
    l.settle(0.15, 0.1);
    expect(l.reserve(0.15)).toBe(false);
    expect(l.reserve(0.05)).toBe(true);
  });

  it("refuses past the daily cap and resets it the next day", () => {
    let day = "2026-10-27";
    const l = new SpendLedger(ledgerPath(), 100, 0.2, () => day);
    l.settle(0, 0.18);
    expect(l.reserve(0.05)).toBe(false);
    day = "2026-10-28";
    expect(l.reserve(0.05)).toBe(true);
  });

  it("keeps the total across a restart", () => {
    const p = ledgerPath();
    new SpendLedger(p, 1, 1).settle(0, 0.4);
    const again = new SpendLedger(p, 1, 1);
    expect(again.summary().totalUsd).toBeCloseTo(0.4, 6);
    expect(again.reserve(0.7)).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("refuses the 11th snap in an hour from one IP but not from another", () => {
    let t = 0;
    const r = new RateLimiter(10, () => t);
    for (let i = 0; i < 10; i++) expect(r.allow("1.2.3.4")).toBe(true);
    expect(r.allow("1.2.3.4")).toBe(false);
    expect(r.allow("5.6.7.8")).toBe(true);
    t = 3_600_000;
    expect(r.allow("1.2.3.4")).toBe(true);
  });
});
