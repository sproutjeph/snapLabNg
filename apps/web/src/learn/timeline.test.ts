import { describe, expect, it } from "vitest";
import {
  arc,
  createTimeline,
  DROP_HEIGHT,
  DROP_IMPACT_AT,
  drop,
  ease,
  MAX_TWEEN_S,
  pop,
  stagger,
} from "./timeline";

// The motion helpers (docs/plans/exam-redesign.md, "The look": Motion). Their numbers (a 2.2
// fall, a bounce, an impact at 36% of the drop, outBack overshoot, tweens of at most 0.4 s) come
// from Backcountry 101 (docs/plans/exam-redesign-brief.md, research report 2); the easings are
// Robert Penner's standard curves.

describe("easings", () => {
  it("outBounce starts at 0, ends at 1 and touches 1 first at 1/2.75 of the way", () => {
    expect(ease.outBounce(0)).toBe(0);
    expect(ease.outBounce(1)).toBeCloseTo(1, 10);
    expect(ease.outBounce(1 / 2.75)).toBeCloseTo(1, 10);
  });

  it("outBounce comes back down after touching 1 (it bounces) and never passes 1", () => {
    const samples = Array.from({ length: 101 }, (_, i) => ease.outBounce(i / 100));
    expect(Math.max(...samples)).toBeLessThanOrEqual(1 + 1e-12);
    expect(ease.outBounce(0.5)).toBeLessThan(ease.outBounce(0.36));
  });

  it("quad is slow at the start and exact at the ends", () => {
    expect(ease.quad(0)).toBe(0);
    expect(ease.quad(0.5)).toBeCloseTo(0.25, 10);
    expect(ease.quad(1)).toBe(1);
  });
});

describe("drop", () => {
  const run = (tS: number) => {
    const seen = { y: -1, shadow: false, puff: -1 };
    const tl = createTimeline();
    drop(tl, 1, {
      y: (y) => {
        seen.y = y;
      },
      shadow: (on) => {
        seen.shadow = on;
      },
      puff: (k) => {
        seen.puff = k;
      },
    });
    tl.seek(tS);
    return seen;
  };

  it("starts 2.2 above its place with no shadow, and rests at 0 with the shadow on", () => {
    expect(run(0).y).toBeCloseTo(DROP_HEIGHT, 10);
    expect(run(0).shadow).toBe(false);
    const end = run(1 + MAX_TWEEN_S);
    expect(end.y).toBeCloseTo(0, 10);
    expect(end.shadow).toBe(true);
  });

  it("casts no shadow until it first touches down, then fires the dust puff", () => {
    const before = run(1 + MAX_TWEEN_S * (DROP_IMPACT_AT - 0.05));
    expect(before.y).toBeGreaterThan(0);
    expect(before.shadow).toBe(false);
    expect(before.puff).toBe(0);
    const after = run(1 + MAX_TWEEN_S * DROP_IMPACT_AT + 0.1);
    expect(after.shadow).toBe(true);
    expect(after.puff).toBeGreaterThan(0);
    expect(run(2).puff).toBe(1);
  });

  it("never lasts longer than 0.4 s even when asked", () => {
    const tl = createTimeline();
    drop(tl, 0, {}, { durS: 3 });
    expect(tl.durationS).toBeLessThanOrEqual(MAX_TWEEN_S + 1e-12);
  });
});

describe("pop", () => {
  it("grows from 0.01 to 1, overshooting a little on the way", () => {
    const sizes: number[] = [];
    const tl = createTimeline();
    pop(tl, 0, (s) => sizes.push(s));
    tl.seek(0);
    tl.seek(0.3 * 0.7);
    tl.seek(0.3);
    expect(sizes[0]).toBeCloseTo(0.01, 10);
    expect(Math.max(...sizes)).toBeGreaterThan(1);
    expect(sizes[sizes.length - 1]).toBeCloseTo(1, 10);
  });
});

describe("arc", () => {
  it("rises by the lift at mid-way and lands on the target", () => {
    let at: [number, number, number] = [0, 0, 0];
    const tl = createTimeline();
    arc(tl, 0, 0.4, [0, 0, 0], [2, 0, 4], 0.5, (x, y, z) => {
      at = [x, y, z];
    });
    tl.seek(0.2);
    expect(at[0]).toBeCloseTo(1, 10);
    expect(at[1]).toBeCloseTo(0.5, 10);
    expect(at[2]).toBeCloseTo(2, 10);
    tl.seek(0.4);
    expect(at[0]).toBeCloseTo(2, 10);
    expect(at[1]).toBeCloseTo(0, 10);
    expect(at[2]).toBeCloseTo(4, 10);
  });
});

describe("stagger", () => {
  it("starts the i-th part i steps after the first", () => {
    expect(stagger(2, 0)).toBe(2);
    expect(stagger(2, 3)).toBeCloseTo(2.3, 10);
    expect(stagger(2, 3, 0.05)).toBeCloseTo(2.15, 10);
  });
});
