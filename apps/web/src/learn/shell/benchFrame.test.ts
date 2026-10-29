import { describe, expect, it } from "vitest";
import {
  type Frustum,
  fitShot,
  isPortrait,
  LOOK_AZIMUTH_DEG,
  lookElevation,
  PORTRAIT_AZIMUTH_DEG,
  SHOT_DEPTH_RATIO,
} from "../../scene/look/LookCamera";
import { BENCH_BOUNDS, BENCH_PARTS, BENCH_SHOT, FIT_HALF_WIDTH_M } from "./benchFrame";
import { coveredFor, type LayoutInfo, layoutFor, RAIL_W } from "./layout";

const DEG = Math.PI / 180;

/** The canvas the look camera draws on: the window, less the rail on a laptop. */
function canvasOf(l: LayoutInfo, w: number, h: number): { w: number; h: number } {
  const rail = l.mode === "wide" || l.mode === "compact" ? RAIL_W * l.ui : 0;
  return { w: w - rail, h };
}

/**
 * Where every part's top and bottom corners land on the screen, in CSS px, for a window and the
 * guide's state: the look camera's own fit (fitShot) for the shot ShellCanvas picks, then the camera's
 * right and up axes. Also returns the free rect the cards leave.
 */
function frame(w: number, h: number, guide: "open" | "peek") {
  const l = layoutFor(w, h);
  const c = canvasOf(l, w, h);
  const covered = coveredFor(l, { guide });
  const portrait = isPortrait(covered, c.w, c.h);
  const shot = BENCH_SHOT;
  const az = (portrait ? PORTRAIT_AZIMUTH_DEG : LOOK_AZIMUTH_DEG) * DEG;
  const el = lookElevation(portrait);
  const f: Frustum = { halfW: 0, halfH: 0, offsetX: 0, offsetY: 0 };
  fitShot(shot.spanM, covered, c.w, c.h, az, f, el);
  const right = [Math.cos(az), 0, -Math.sin(az)] as const;
  const up = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)] as const;
  const corners: Array<[number, number]> = [];
  for (const part of BENCH_PARTS) {
    for (const x of [part.minX, part.maxX]) {
      for (const y of [0, part.height]) {
        for (const z of [part.minZ, part.maxZ]) {
          const d = [x - shot.focus[0], y - shot.focus[1], z - shot.focus[2]] as const;
          const sx = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
          const sy = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
          corners.push([
            c.w / 2 - f.offsetX + (sx / (2 * f.halfW)) * c.w,
            c.h / 2 - f.offsetY - (sy / (2 * f.halfH)) * c.h,
          ]);
        }
      }
    }
  }
  const free = {
    left: covered.left,
    right: c.w - covered.right,
    top: covered.top,
    bottom: c.h - covered.bottom,
  };
  return { portrait, corners, free };
}

const WINDOWS: Array<[number, number, "open" | "peek", string]> = [
  [390, 844, "peek", "a phone, guide folded"],
  [360, 640, "peek", "a small phone, guide folded"],
  [412, 915, "peek", "a tall phone, guide folded"],
  [600, 960, "peek", "a large phone, guide folded"],
  [390, 844, "open", "a phone, guide open"],
  [360, 640, "open", "a small phone, guide open"],
  [844, 390, "peek", "a landscape phone"],
  [640, 360, "peek", "a small landscape phone"],
  [1024, 768, "peek", "a small laptop"],
  [1440, 900, "peek", "a laptop"],
  [1728, 907, "peek", "a wide laptop"],
];

describe("the bench frame", () => {
  it("the shot's box holds the bench's whole footprint (the box is spanM wide and 0.6 deep)", () => {
    const half = BENCH_SHOT.spanM / 2;
    expect(BENCH_SHOT.focus[0] - half).toBeLessThanOrEqual(BENCH_BOUNDS.minX);
    expect(BENCH_SHOT.focus[0] + half).toBeGreaterThanOrEqual(BENCH_BOUNDS.maxX);
    expect(BENCH_SHOT.focus[2] - half * SHOT_DEPTH_RATIO).toBeLessThanOrEqual(BENCH_BOUNDS.minZ);
    expect(BENCH_SHOT.focus[2] + half * SHOT_DEPTH_RATIO).toBeGreaterThanOrEqual(BENCH_BOUNDS.maxZ);
  });

  it("the perspective fit is wider than the bench's half width", () => {
    const half = Math.max(Math.abs(BENCH_BOUNDS.minX), Math.abs(BENCH_BOUNDS.maxX));
    expect(FIT_HALF_WIDTH_M).toBeGreaterThan(half * 1.06);
  });

  it.each(WINDOWS)(
    "shows the whole bench inside what the cards leave free: %i x %i, %s",
    (w, h, guide) => {
      const { corners, free } = frame(w, h, guide);
      // A few px to spare, so a corner is not on the edge of a card.
      const margin = 4;
      for (const [x, y] of corners) {
        expect(x).toBeGreaterThanOrEqual(free.left + margin);
        expect(x).toBeLessThanOrEqual(free.right - margin);
        expect(y).toBeGreaterThanOrEqual(free.top + margin);
        expect(y).toBeLessThanOrEqual(free.bottom - margin);
      }
    },
  );

  it("turns the bench up the screen only in a window taller than wide", () => {
    expect(frame(390, 844, "peek").portrait).toBe(true);
    expect(frame(390, 844, "open").portrait).toBe(false);
    expect(frame(1440, 900, "peek").portrait).toBe(false);
    expect(frame(844, 390, "peek").portrait).toBe(false);
  });
});
