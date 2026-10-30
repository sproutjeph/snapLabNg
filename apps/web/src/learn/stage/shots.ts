import { slotBounds } from "../../apparatus/ohms-law/kitParams";
import { BENCH_FOOTPRINTS } from "../../apparatus/ohms-law/LeadParts";
import type { BenchSlot } from "../../apparatus/ohms-law/layout";
import {
  type Frustum,
  fitShot,
  LOOK_ELEVATION_DEG,
  SHOT_DEPTH_RATIO,
} from "../../scene/look/LookCamera";
import type { Covered, LookShot } from "../../scene/look/types";

// The live stage's named shots (docs/plans/wave-2-lean.md; the user's Oct 30 review): the camera
// stands where the student sits, a little to her right (STAGE_AZIMUTH_DEG), so the meters in the
// front row (apparatus/ohms-law/layout.ts, v3) face her and the bench runs across the screen.
// Each step's pose (learn/lessons/ohms-law/lesson.ts) takes one shot (shotForPose): the whole
// bench, both meters for a reading, and on a phone held upright also the box and key, and the
// wire board. Every shot is a LookShot for LookCamera, worked out from the layout, so a moved part
// can never leave a shot looking at empty desk. BC101 zooms per step the same way (named shots,
// followed with k = 1 − e^(−8 dt), which LookCamera already does).
//
// The close shots are fitted to the free area the page's cards leave (`covered`), not to a fixed
// span: LookCamera's fit always keeps a box of SHOT_HEIGHT_M above and below the focus, so on a
// wide window a span alone either clips the parts' ends or leaves them small. stageShot finds the
// smallest span at which the parts, with a little paper round them, fit inside the free area, and
// centres them there; as the chrome shrinks the same parts come out bigger.

/** From +z (her side) toward +x: about square to her, a little to her right. */
export const STAGE_AZIMUTH_DEG = 12;
/**
 * The wire board on a phone: seen from her left, so its metre runs up the screen (X at the
 * bottom, the scale reading upward) and fills the upright free area.
 */
export const BOARD_PHONE_AZIMUTH_DEG = -70;
/** Room round the bench's footprint for nuts, plugs and leads, in metres of span. */
const BENCH_MARGIN_M = 0.04;
/** Paper left round the parts of a close shot, in metres. */
export const PAPER_M = 0.012;

export type StageShotName = "bench" | "meters" | "boxKey" | "board";
export const STAGE_SHOT_NAMES: readonly StageShotName[] = ["bench", "meters", "boxKey", "board"];

/**
 * The shot each lesson pose takes. A laptop sees the whole bench except for a reading; a phone
 * held upright, where the bench is a thin strip, also comes close for the box and key and the
 * wire board.
 */
export const SHOT_FOR_POSE: Readonly<
  Record<"laptop" | "phone", Readonly<Record<string, StageShotName>>>
> = {
  laptop: { bench: "bench", connect: "bench", wire: "bench", readings: "meters", box: "bench" },
  phone: { bench: "bench", connect: "bench", wire: "board", readings: "meters", box: "boxKey" },
};

/** The shot for a step's pose; `portrait` is LookCamera's isPortrait for the free area. */
export function shotForPose(pose: string | undefined, portrait: boolean): StageShotName {
  return SHOT_FOR_POSE[portrait ? "phone" : "laptop"][pose ?? "bench"] ?? "bench";
}

/** What a close shot must hold: these parts' footprints, this much above their tops, from here. */
interface CloseFrame {
  slots: readonly BenchSlot[];
  /** Above the footprints' tops: plugs standing in the box and key, nuts on the board. */
  topPad: number;
  azimuthDeg: number;
}

const CLOSE: Readonly<Record<Exclude<StageShotName, "bench">, CloseFrame>> = {
  // A meter's nuts stand on its ledge, well under the case's top.
  meters: { slots: ["ammeter", "voltmeter"], topPad: 0, azimuthDeg: STAGE_AZIMUTH_DEG },
  boxKey: { slots: ["box", "key"], topPad: 0.025, azimuthDeg: STAGE_AZIMUTH_DEG },
  board: { slots: ["wire"], topPad: 0.025, azimuthDeg: BOARD_PHONE_AZIMUTH_DEG },
};

const DEG = Math.PI / 180;

function benchShot(): LookShot {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  for (const f of BENCH_FOOTPRINTS) {
    // The tray stands behind the board, out of the shot (layout.ts).
    if (f.slot === "tray") continue;
    x0 = Math.min(x0, f.cx - f.hx);
    x1 = Math.max(x1, f.cx + f.hx);
    z0 = Math.min(z0, f.cz - f.hz);
    z1 = Math.max(z1, f.cz + f.hz);
  }
  // A shot fits a patch spanM wide and spanM × SHOT_DEPTH_RATIO deep: wide enough for both.
  const spanM = Math.max(x1 - x0, (z1 - z0) / SHOT_DEPTH_RATIO) + BENCH_MARGIN_M;
  return {
    id: "bench",
    focus: [(x0 + x1) / 2, 0, (z0 + z1) / 2],
    spanM,
    azimuthDeg: STAGE_AZIMUTH_DEG,
  };
}

/** The whole bench: the same on every screen. */
export const BENCH_SHOT: LookShot = benchShot();

/** The corners of a close frame's parts, with paper round them, in world metres. */
export function frameCorners(
  name: Exclude<StageShotName, "bench">,
): Array<[number, number, number]> {
  const f = CLOSE[name];
  return f.slots.flatMap((slot) => {
    const b = slotBounds(slot, f.topPad);
    const xs = [b.x0 - PAPER_M, b.x1 + PAPER_M];
    const zs = [b.z0 - PAPER_M, b.z1 + PAPER_M];
    const ys = [0, b.h];
    return xs.flatMap((x) => ys.flatMap((y) => zs.map((z): [number, number, number] => [x, y, z])));
  });
}

/** The free area of a width × height canvas, as fitShot takes it. */
export function freeArea(covered: Covered, width: number, height: number) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let left = Math.max(0, covered.left);
  let top = Math.max(0, covered.top);
  let freeW = w - left - Math.max(0, covered.right);
  let freeH = h - top - Math.max(0, covered.bottom);
  if (freeW < 1) {
    freeW = w;
    left = 0;
  }
  if (freeH < 1) {
    freeH = h;
    top = 0;
  }
  return { left, top, width: freeW, height: freeH };
}

const scratch: Frustum = { halfW: 1, halfH: 1, offsetX: 0, offsetY: 0 };
const MIN_SPAN_M = 0.02;
const MAX_SPAN_M = 4;

/**
 * A close shot: the parts of `name`, centred in the free area and as big as fits inside it. The
 * camera's right and up vectors are fitShot's, so the parts' extent on screen is exact; the span
 * is then the smallest whose fit leaves room for that extent (LookCamera's zoom only grows with
 * the span, so a bisection finds it).
 */
function closeShot(
  name: Exclude<StageShotName, "bench">,
  covered: Covered,
  width: number,
  height: number,
): LookShot {
  const { azimuthDeg } = CLOSE[name];
  const az = azimuthDeg * DEG;
  const el = LOOK_ELEVATION_DEG * DEG;
  const right = [Math.cos(az), 0, -Math.sin(az)] as const;
  const up = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)] as const;
  let sx0 = Number.POSITIVE_INFINITY;
  let sx1 = Number.NEGATIVE_INFINITY;
  let sy0 = Number.POSITIVE_INFINITY;
  let sy1 = Number.NEGATIVE_INFINITY;
  for (const [x, y, z] of frameCorners(name)) {
    const sx = x * right[0] + z * right[2];
    const sy = x * up[0] + y * up[1] + z * up[2];
    sx0 = Math.min(sx0, sx);
    sx1 = Math.max(sx1, sx);
    sy0 = Math.min(sy0, sy);
    sy1 = Math.max(sy1, sy);
  }
  const cx = (sx0 + sx1) / 2;
  const cy = (sy0 + sy1) / 2;
  // The point in the camera's plane that projects to the parts' middle: the free area centres it.
  const focus: [number, number, number] = [
    cx * right[0] + cy * up[0],
    cy * up[1],
    cx * right[2] + cy * up[2],
  ];
  const free = freeArea(covered, width, height);
  const need = Math.max((sx1 - sx0) / free.width, (sy1 - sy0) / free.height);
  const w = Math.max(1, width);
  const perPx = (span: number) =>
    (2 * fitShot(span, covered, width, height, az, scratch, el).halfW) / w;
  let lo = MIN_SPAN_M;
  let hi = MAX_SPAN_M;
  if (perPx(lo) >= need) hi = lo;
  else {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (perPx(mid) >= need) hi = mid;
      else lo = mid;
    }
  }
  return { id: name, focus, spanM: hi, azimuthDeg };
}

/** The named shot for a canvas this size under these cards. */
export function stageShot(
  name: StageShotName,
  covered: Covered,
  width: number,
  height: number,
): LookShot {
  return name === "bench" ? BENCH_SHOT : closeShot(name, covered, width, height);
}
