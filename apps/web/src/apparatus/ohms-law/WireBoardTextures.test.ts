import { paramsFromSeed } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { cmToX } from "../meter-bridge/dimensions";
import {
  markPx,
  RULE_CUTS_CM,
  RULE_EDGE_M,
  RULE_LENGTH_M,
  RULE_MARGIN_M,
  ruleMarks,
  ruleMarkX,
  rulePxPerCm,
  ruleSegments,
  wireEndX,
} from "./WireBoardTextures";

const TIERS = ["low", "mid", "high"] as const;

describe("the printed metre rule", () => {
  it("puts the 0 and 100 marks under the ends of a wire laid the whole length, within 1 mm", () => {
    for (const q of TIERS) {
      expect(Math.abs(ruleMarkX(0, q) - wireEndX(0))).toBeLessThan(0.001);
      expect(Math.abs(ruleMarkX(100, q) - wireEndX(100))).toBeLessThan(0.001);
    }
    // And the scale itself runs from -0.5 m to +0.5 m about the board's middle.
    expect(ruleMarkX(0)).toBeCloseTo(-0.5, 4);
    expect(ruleMarkX(100)).toBeCloseTo(0.5, 4);
  });

  it("puts each end of any wire the engine can set under its mark, within 1 mm", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const { startCm, lengthCm } = paramsFromSeed(seed).wire;
      for (const cm of [startCm, startCm + lengthCm]) {
        for (const q of TIERS) {
          expect(Math.abs(ruleMarkX(cm, q) - wireEndX(cm))).toBeLessThan(0.001);
        }
      }
    }
  });

  it("stands the X and Y blocks at the same x as the board's own metre mapping", () => {
    expect(wireEndX(37.5)).toBe(cmToX(37.5));
  });

  it("stands each block on its own mark, not on the 0 and 100, when the wire is shorter than a metre", () => {
    // A wire of 53.6 cm from 24.4 cm: X on 24.4 and Y on 78.0. The rule's 0 and 100 are then the
    // ends of the scale, and the loupe reads the wire's length between the two blocks. Only a wire
    // laid the whole metre puts the blocks on the 0 and the 100 (the first test).
    const startCm = 24.4;
    const lengthCm = 53.6;
    for (const q of TIERS) {
      expect(Math.abs(ruleMarkX(startCm, q) - wireEndX(startCm))).toBeLessThan(0.001);
      expect(
        Math.abs(ruleMarkX(startCm + lengthCm, q) - wireEndX(startCm + lengthCm)),
      ).toBeLessThan(0.001);
      expect(Math.abs(wireEndX(startCm) - ruleMarkX(0, q))).toBeGreaterThan(0.2);
      expect(Math.abs(wireEndX(startCm + lengthCm) - ruleMarkX(100, q))).toBeGreaterThan(0.2);
    }
  });

  it("cuts the print into textures of at most 1024 px, whatever the tier", () => {
    for (const q of TIERS) {
      for (const s of ruleSegments(q)) {
        expect(s.widthPx).toBeLessThanOrEqual(1024);
        expect(s.heightPx).toBeLessThanOrEqual(1024);
      }
    }
  });

  it("covers the scale from before 0 to after 100 with no gap between the pieces", () => {
    const segs = ruleSegments("high");
    expect(segs.length).toBe(RULE_CUTS_CM.length - 1);
    expect(segs[0]?.fromCm).toBeLessThanOrEqual(0);
    expect(segs[segs.length - 1]?.toCm).toBeGreaterThanOrEqual(100);
    let reach = (segs[0]?.centreX ?? 0) - (segs[0]?.lengthM ?? 0) / 2;
    for (const s of segs) {
      expect(s.centreX - s.lengthM / 2).toBeCloseTo(reach, 9);
      reach = s.centreX + s.lengthM / 2;
    }
    // The strip is 1.04 m; its printed face stops where the flat top ends, 1.5 mm inside each end.
    expect(RULE_LENGTH_M).toBeCloseTo(1 + 2 * RULE_MARGIN_M, 9);
    expect(reach).toBeLessThanOrEqual(RULE_LENGTH_M / 2 - RULE_EDGE_M + 1e-9);
  });

  it("leaves 2 cm of strip beyond the 0 and the 100, so the numeral stands clear of the ink line at the end", () => {
    // The look's outline is 3 px; at the phone's fit that is as wide as 1 cm of rule, and it covered
    // the left half of the 0 when the margin was 1 cm (visual QA of the wire board, round 1).
    expect(RULE_MARGIN_M).toBeGreaterThanOrEqual(0.02);
    // The strip's body is 4.5 mm thick (3 mm proud, 1.5 mm in the board) so its 1.5 mm rounding fits.
    expect(RULE_EDGE_M).toBeGreaterThanOrEqual(0.0015);
    // The 0 mark is 2 cm from the strip's end; the first printed pixel is 1.85 cm before it.
    expect(-(RULE_CUTS_CM[0] ?? 0)).toBeCloseTo((RULE_MARGIN_M - RULE_EDGE_M) * 100, 9);
  });

  it("makes every cut fall between two millimetre marks, so no tick is split", () => {
    for (const cut of RULE_CUTS_CM.slice(1, -1)) {
      const mm = cut * 10;
      expect(Math.abs(mm - Math.round(mm))).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("prints a tick every millimetre, 0 to 1000, longer at each 5 mm, cm and 10 cm", () => {
    const marks = ruleMarks();
    expect(marks.length).toBe(1001);
    const count = (kind: string) => marks.filter((m) => m.kind === kind).length;
    expect(count("ten")).toBe(11);
    expect(count("cm")).toBe(90);
    expect(count("half")).toBe(100);
    expect(count("mm")).toBe(800);
  });

  it("lands a mark on a whole pixel pitch: 3.9 px a millimetre on mid and high, half that on low", () => {
    expect(rulePxPerCm("high")).toBe(39);
    expect(rulePxPerCm("low")).toBe(19.5);
    const seg = ruleSegments("high")[1];
    expect(seg).toBeDefined();
    if (!seg) return;
    // Two marks 10 mm apart are 39 px apart on the canvas.
    expect(markPx(seg, 300) - markPx(seg, 290)).toBeCloseTo(39, 6);
  });
});
