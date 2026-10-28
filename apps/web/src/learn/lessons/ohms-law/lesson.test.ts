import { judgePrecaution } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { OHMS_LAW_LESSON } from "./lesson";

const L = OHMS_LAW_LESSON;

/** Every string in the lesson text (not the SVG, which is markup). */
function allText(): string[] {
  const out: string[] = [L.title, L.diagram.caption];
  for (const s of L.steps) {
    out.push(s.title, s.instruction, s.plain, ...(s.whyItWorks ?? []), ...(s.precautions ?? []));
    for (const c of s.callouts ?? []) out.push(c.label, c.sub ?? "");
  }
  for (const c of L.identify) {
    out.push(c.name, c.symbol, c.whatItDoes, c.howToUse, c.commonMistake);
  }
  return out;
}

describe("ohms-law lesson", () => {
  it("gives every step a pose that exists", () => {
    for (const s of L.steps) expect(L.poses[s.pose], s.key).toBeDefined();
  });

  it("keeps poses at a sane distance and elevation", () => {
    for (const [k, p] of Object.entries(L.poses)) {
      expect(p.distanceM, k).toBeGreaterThanOrEqual(0.4);
      expect(p.distanceM, k).toBeLessThanOrEqual(1.6);
      expect(p.elevationDeg, k).toBeGreaterThanOrEqual(25);
      expect(p.elevationDeg, k).toBeLessThanOrEqual(60);
    }
  });

  it("has 11 Identify cards with unique parts", () => {
    const parts = L.identify.map((c) => c.part);
    expect(parts).toHaveLength(11);
    expect(new Set(parts).size).toBe(11);
    expect(new Set(parts)).toEqual(
      new Set([
        "cells",
        "key",
        "ammeter",
        "voltmeter",
        "box",
        "wire",
        "leads",
        "nuts",
        "sandpaper",
        "paper",
        "micrometer",
      ]),
    );
  });

  it("writes every precaution in the reported tense and gets it accepted", () => {
    const all = L.steps.flatMap((s) => s.precautions ?? []);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      const j = judgePrecaution(p, "ohms_law_vi");
      expect(j, p).toMatchObject({ accepted: true, reason: "accepted" });
    }
  });

  it("uses the diagram from the wiring slice", () => {
    expect(L.diagram.svg).toContain("<svg");
  });

  it("states no reading, current, voltage, resistance or slope", () => {
    // Numbers the question itself gives: R values, 0.2 mm, 7 Ω, 8.8 × 10⁻⁷, 22/7.
    const ALLOWED = new Set(["0", "1", "5", "10", "20", "40", "60", "0.2", "7", "8.8", "22"]);
    for (const raw of allText()) {
      // Source hints and CHECK notes carry paper and section numbers, not readings.
      const t = raw.replace(/\[[^\]]*\]/g, "").replace(/CHECK:.*$/, "");
      for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) {
        expect(ALLOWED.has(m[0]), `"${m[0]}" in: ${t}`).toBe(true);
      }
      expect(t).not.toMatch(/!/);
      expect(t).not.toMatch(/\b(he|she|his|her|him)\b/i);
    }
  });
});
