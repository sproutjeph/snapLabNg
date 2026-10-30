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
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import type { CameraPose } from "../types";
import {
  BENCH_BOUNDS,
  BENCH_PARTS,
  BENCH_POSE_MIN_M,
  BENCH_SHOT,
  FIT_HALF_WIDTH_M,
  MAX_POSE_DISTANCE_M,
  poseFitFactor,
} from "./benchFrame";
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
    expect(frame(390, 844, "open").portrait).toBe(true);
    expect(frame(1440, 900, "peek").portrait).toBe(false);
    expect(frame(844, 390, "peek").portrait).toBe(false);
  });
});

// The lesson page's perspective camera (LearnPage: fov 40, PoseRig). It sits `distanceM x back-off`
// from the pose's target, looks at it, and slides the view so the target is in the middle of the
// free window.
const LESSON_FOV_DEG = 40;
const POSES = OHMS_LAW_LESSON.poses as Record<string, CameraPose>;

/** The same windows, wider and narrower, as the pose fit sees them: the canvas and what covers it. */
function poseWindow(w: number, h: number, guide: "open" | "peek") {
  const l = layoutFor(w, h);
  const c = canvasOf(l, w, h);
  return { c, covered: coveredFor(l, { guide }) };
}

/** Where the bench's parts land across the canvas for a pose, left to right in CSS px. */
function poseScreenXs(pose: CameraPose, w: number, h: number, guide: "open" | "peek") {
  const { c, covered } = poseWindow(w, h, guide);
  const k = poseFitFactor(pose.distanceM, LESSON_FOV_DEG, c.w, c.h, covered);
  const az = pose.azimuthDeg * DEG;
  const el = pose.elevationDeg * DEG;
  const d = pose.distanceM * k;
  const [tx, ty, tz] = pose.target;
  const eye = [
    tx + d * Math.sin(az) * Math.cos(el),
    ty + d * Math.sin(el),
    tz + d * Math.cos(az) * Math.cos(el),
  ] as const;
  const norm = (v: readonly number[]) => {
    const n = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
    return [(v[0] ?? 0) / n, (v[1] ?? 0) / n, (v[2] ?? 0) / n] as const;
  };
  const fwd = norm([tx - eye[0], ty - eye[1], tz - eye[2]]);
  // right = forward x up, with up = +y
  const right = norm([-fwd[2], 0, fwd[0]]);
  const tanHalf = Math.tan((LESSON_FOV_DEG * DEG) / 2);
  const xs: number[] = [];
  for (const part of BENCH_PARTS) {
    for (const x of [part.minX, part.maxX]) {
      for (const y of [0, part.height]) {
        for (const z of [part.minZ, part.maxZ]) {
          const v = [x - eye[0], y - eye[1], z - eye[2]] as const;
          const depth = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2];
          const side = v[0] * right[0] + v[1] * right[1] + v[2] * right[2];
          const ndc = side / (depth * tanHalf * (c.w / c.h));
          // The view offset slides the picture left by half of (covered right less covered left).
          xs.push(c.w / 2 + (ndc * c.w) / 2 - (covered.right - covered.left) / 2);
        }
      }
    }
  }
  return { xs, free: { left: covered.left, right: c.w - covered.right } };
}

const BENCH_POSES = ["bench", "wire", "connect"] as const;
const CLOSE_UPS = ["readings", "box"] as const;

describe("the lesson page's pose fit", () => {
  it("tells the lesson's whole-bench poses from its close-ups by distance", () => {
    for (const name of BENCH_POSES) {
      expect(POSES[name]?.distanceM).toBeGreaterThanOrEqual(BENCH_POSE_MIN_M);
    }
    for (const name of CLOSE_UPS) {
      expect(POSES[name]?.distanceM).toBeLessThan(BENCH_POSE_MIN_M);
    }
  });

  it.each(WINDOWS)(
    "shows the bench's whole width on each whole-bench pose: %i x %i, %s",
    (w, h, guide) => {
      for (const name of BENCH_POSES) {
        const pose = POSES[name];
        if (!pose) throw new Error(`no pose ${name}`);
        const { xs, free } = poseScreenXs(pose, w, h, guide);
        // The bench's ink ran 10 px past each edge of a phone before this fit; keep it inside.
        const margin = 8;
        expect(Math.min(...xs), `${name} left edge`).toBeGreaterThanOrEqual(free.left + margin);
        expect(Math.max(...xs), `${name} right edge`).toBeLessThanOrEqual(free.right - margin);
      }
    },
  );

  it.each(WINDOWS)(
    "backs a close-up of a meter or the box off as height over width and the guide did: %i x %i, %s",
    (w, h, guide) => {
      const { c, covered } = poseWindow(w, h, guide);
      const free = Math.max(c.w - covered.left - covered.right, 1);
      // The rule before the bench fit, for a pose nearer than the bench poses.
      const was = Math.min(2.6, Math.max(1, c.w < c.h ? c.h / c.w : 1, (0.9 * c.w) / free));
      for (const name of CLOSE_UPS) {
        const pose = POSES[name];
        if (!pose) throw new Error(`no pose ${name}`);
        expect(poseFitFactor(pose.distanceM, LESSON_FOV_DEG, c.w, c.h, covered)).toBeCloseTo(
          was,
          6,
        );
      }
    },
  );

  // The guide beside the stage already backs the camera off far enough on these. (A 1024 x 768
  // laptop did not get that far: its resistance box ran 9 px off the left of the stage.)
  it("leaves a wide laptop's and a landscape phone's framing of the whole bench as it was", () => {
    for (const [w, h] of [
      [1440, 900],
      [1728, 907],
      [844, 390],
    ] as const) {
      const { c, covered } = poseWindow(w, h, "peek");
      const free = Math.max(c.w - covered.left - covered.right, 1);
      const was = Math.min(2.6, Math.max(1, (0.9 * c.w) / free));
      for (const name of BENCH_POSES) {
        const pose = POSES[name];
        if (!pose) throw new Error(`no pose ${name}`);
        expect(poseFitFactor(pose.distanceM, LESSON_FOV_DEG, c.w, c.h, covered)).toBeCloseTo(
          was,
          6,
        );
      }
    }
  });

  it("never asks the camera to stand farther off than the orbit allows", () => {
    for (const [w, h] of [
      [390, 844],
      [320, 800],
      [280, 900],
    ] as const) {
      const { c, covered } = poseWindow(w, h, "peek");
      for (const name of BENCH_POSES) {
        const pose = POSES[name];
        if (!pose) throw new Error(`no pose ${name}`);
        const k = poseFitFactor(pose.distanceM, LESSON_FOV_DEG, c.w, c.h, covered);
        expect(pose.distanceM * k).toBeLessThanOrEqual(MAX_POSE_DISTANCE_M + 1e-9);
      }
    }
  });
});
