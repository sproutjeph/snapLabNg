import { describe, expect, it } from "vitest";
import type { Covered } from "../../scene/look/types";
import { playerCovered } from "../player/stages";
import {
  CAPTION_PX,
  COMPACT_GUIDE_W,
  coveredFor,
  layoutFor,
  PORTRAIT_PEEK_GUIDE_H,
  PORTRAIT_PLAYER_BOTTOM,
  PORTRAIT_STRIP_H,
  WIDE_GUIDE_W,
} from "./layout";

// Source for every expected number: Backcountry 101 (backcountry-101.vercel.app/?lesson=fire),
// measured on Oct 29 in headless Chromium with getBoundingClientRect, and its own layout script
// (docs/plans/page-layout.md, "BC101 measurements"). Its cards, at DPR 1:
//   1728 x 907: status card bottom 94.7, step strip top 757.7 (149.3 high), guide left 1246.3.
//   1440 x 900: status card bottom 87, step strip top 763, guide left 999.
//   390 x 844:  player bottom 119.7, step strip top 353.5, guide top 489.5 (its --scene-bottom
//               389.727, --lw 430 and --lh 930.564 are in design px).

const near = (a: number, b: number, tol = 1.5) => expect(Math.abs(a - b)).toBeLessThan(tol);
const nearCovered = (c: Covered, want: readonly [number, number, number, number]) => {
  near(c.left, want[0]);
  near(c.right, want[1]);
  near(c.top, want[2]);
  near(c.bottom, want[3]);
};

describe("layoutFor", () => {
  it("1728 × 907 is wide and scales by the height (0.9106)", () => {
    const l = layoutFor(1728, 907);
    expect(l.mode).toBe("wide");
    expect(l.ui).toBeCloseTo(0.9106, 3);
    expect(l.guideW).toBe(WIDE_GUIDE_W);
  });

  it("1440 × 900 is wide and scales by the width (0.8333)", () => {
    const l = layoutFor(1440, 900);
    expect(l.mode).toBe("wide");
    expect(l.ui).toBeCloseTo(0.8333, 3);
  });

  it("1024 × 768 is compact with the narrower guide (0.788)", () => {
    const l = layoutFor(1024, 768);
    expect(l.mode).toBe("compact");
    expect(l.ui).toBeCloseTo(0.788, 3);
    expect(l.guideW).toBe(COMPACT_GUIDE_W);
  });

  it("390 × 844 is portrait (0.907) and the stage ends at 389.7 design px", () => {
    const l = layoutFor(390, 844);
    expect(l.mode).toBe("portrait");
    expect(l.ui).toBeCloseTo(0.907, 3);
    // BC101's own --scene-bottom there: 389.727 px, --lw 430, --lh 930.564.
    expect(l.sceneBottom).toBeCloseTo(389.7, 1);
    expect(l.lw).toBeCloseTo(430, 1);
    expect(l.lh).toBeCloseTo(930.56, 1);
  });

  it("844 × 390 is short, with the guide 40% of the width kept between 320 and 420", () => {
    const l = layoutFor(844, 390);
    expect(l.mode).toBe("short");
    expect(l.ui).toBeCloseTo(0.907, 3);
    expect(l.guideW).toBeCloseTo(l.lw * 0.4, 6);
    expect(layoutFor(640, 360).guideW).toBe(320);
    expect(layoutFor(1500, 500).guideW).toBe(420);
  });

  it("768 × 1024 is portrait with the scale clamped at 1.1", () => {
    const l = layoutFor(768, 1024);
    expect(l.mode).toBe("portrait");
    expect(l.ui).toBe(1.1);
  });

  it("a very narrow phone clamps the scale at 0.72", () => {
    expect(layoutFor(300, 700).ui).toBe(0.72);
  });

  it("is portrait only when the width is under 95% of the height", () => {
    expect(layoutFor(959, 1010).mode).toBe("portrait");
    expect(layoutFor(960, 1010).mode).toBe("compact");
  });

  it("a short portrait phone keeps the stage window at least 230 design px", () => {
    const l = layoutFor(360, 640);
    expect((l.sceneBottom ?? 0) - PORTRAIT_PLAYER_BOTTOM).toBeGreaterThanOrEqual(229.99);
  });

  it("the guide never drops below 240 design px, even if the stage window must shrink", () => {
    const l = layoutFor(320, 480);
    expect(l.lh - (l.sceneBottom ?? 0) - PORTRAIT_STRIP_H).toBeCloseTo(240, 6);
  });
});

describe("coveredFor / playerCovered against the measured cards", () => {
  it("1728 × 907: guide + edge on the right, status on top, strip below", () => {
    nearCovered(playerCovered(1728, 907), [0, 481.7, 94.7, 149.3]);
  });

  it("1440 × 900", () => {
    nearCovered(playerCovered(1440, 900), [0, 440.8, 86.7, 136.7]);
  });

  it("390 × 844: the band and player row above, the strip and open guide below", () => {
    nearCovered(playerCovered(390, 844), [0, 0, 119.7, 490.5]);
  });

  it("390 × 844 with the guide folded to a peek leaves more stage (bottom 226.7)", () => {
    nearCovered(playerCovered(390, 844, { guide: "peek" }), [0, 0, 119.7, 226.7]);
    const peek = (PORTRAIT_PEEK_GUIDE_H + PORTRAIT_STRIP_H) * layoutFor(390, 844).ui;
    near(playerCovered(390, 844, { guide: "peek" }).bottom, peek, 0.01);
  });

  it("a showing caption adds 52 design px to the bottom, in every mode", () => {
    for (const [w, h] of [
      [1728, 907],
      [1440, 900],
      [1024, 768],
      [844, 390],
      [390, 844],
    ] as const) {
      const l = layoutFor(w, h);
      const plain = coveredFor(l).bottom;
      near(coveredFor(l, { caption: true }).bottom - plain, CAPTION_PX * l.ui, 0.001);
    }
    near(playerCovered(1728, 907, { caption: true }).bottom, 196.7);
  });

  it("compact covers the narrower guide and its 12 px edge", () => {
    const l = layoutFor(1024, 768);
    near(coveredFor(l).right, (COMPACT_GUIDE_W + 12) * l.ui, 0.001);
  });

  it("short covers the guide down the right, the player row above and a thin strip below", () => {
    const l = layoutFor(844, 390);
    const c = coveredFor(l);
    near(c.right, ((l.guideW ?? 0) + 6) * l.ui, 0.001);
    near(c.top, 58 * l.ui, 0.001);
    near(c.bottom, 100 * l.ui, 0.001);
  });

  it("the canvas is the shell minus the rail, so left is always 0", () => {
    for (const [w, h] of [
      [1728, 907],
      [1024, 768],
      [844, 390],
      [390, 844],
    ] as const) {
      expect(playerCovered(w, h).left).toBe(0);
    }
  });

  it("playerCovered is coveredFor(layoutFor(w, h))", () => {
    expect(playerCovered(1280, 720, { caption: true })).toEqual(
      coveredFor(layoutFor(1280, 720), { caption: true }),
    );
  });
});
