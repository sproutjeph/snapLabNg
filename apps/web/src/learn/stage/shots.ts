import { cmToX } from "../../apparatus/meter-bridge/dimensions";
import { slotBounds } from "../../apparatus/ohms-law/kitParams";
import { BENCH_FOOTPRINTS, PIN_LENGTH_M, PLUG_RADIUS_M } from "../../apparatus/ohms-law/LeadParts";
import { type BenchSlot, LEAD_REST, OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import {
  type Frustum,
  fitShot,
  LOOK_ELEVATION_DEG,
  SHOT_DEPTH_RATIO,
} from "../../scene/look/LookCamera";
import type { Covered, LookShot } from "../../scene/look/types";

// The live stage's named shots (docs/plans/wave-2-lean.md; Oct 30 review): the camera
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
/**
 * The resistance box close-up on a phone: seen from her left, so the box runs up the screen and its
 * plugs stand well apart (the box and key shot holds four parts, which leaves them ~12 px).
 */
export const BOX_PHONE_AZIMUTH_DEG = -90;
/** Room round the bench's footprint for nuts, plugs and leads, in metres of span. */
const BENCH_MARGIN_M = 0.04;
/** Paper left round the parts of a close shot, in metres. */
export const PAPER_M = 0.012;

export type StageShotName = "bench" | "meters" | "boxKey" | "box" | "board";
export const STAGE_SHOT_NAMES: readonly StageShotName[] = [
  "bench",
  "meters",
  "boxKey",
  "box",
  "board",
];

/**
 * The shot each lesson pose takes. A laptop sees the whole bench except for a reading; a phone
 * held upright, where the bench is a thin strip, also comes close for the box and key and the
 * wire board.
 */
export const SHOT_FOR_POSE: Readonly<
  Record<"laptop" | "phone", Readonly<Record<string, StageShotName>>>
> = {
  laptop: {
    bench: "bench",
    connect: "bench",
    wire: "bench",
    readings: "meters",
    box: "bench",
    boxClose: "bench",
  },
  // `boxClose` is the box pose after she taps "Box close-up" (LearnPage): the box alone, so each
  // plug stands well apart and can be tapped.
  phone: {
    bench: "bench",
    connect: "bench",
    wire: "board",
    readings: "meters",
    box: "boxKey",
    boxClose: "box",
  },
};

/**
 * In Watch the actor reads a meter through the loupe (learn/readings/ReadingLoupe: the close-up
 * camera flies in from the shot and back to it), so a reading takes no shot of its own: the stage
 * holds the shot the step had (the bench on a laptop, the box and key, which hold both meters, on
 * a phone), and the loupe is the only camera move (docs/plans/beauty-pass.md B2 item 9).
 */
export const WATCH_READINGS_SHOT: Readonly<Record<"laptop" | "phone", StageShotName>> = {
  laptop: "bench",
  phone: "boxKey",
};

/**
 * The shot for a step's pose; `portrait` is LookCamera's isPortrait for the free area, and
 * `watch` is true on the demonstration, where readings use the loupe (WATCH_READINGS_SHOT).
 */
export function shotForPose(
  pose: string | undefined,
  portrait: boolean,
  watch = false,
): StageShotName | IdentifyShotName {
  const screen = portrait ? "phone" : "laptop";
  if (watch && isIdentifyShot(pose)) return pose;
  if (watch && pose === "readings") return WATCH_READINGS_SHOT[screen];
  return SHOT_FOR_POSE[screen][pose ?? "bench"] ?? "bench";
}

/**
 * Where the leads lie before they are connected (layout.ts LEAD_REST), plugs and pins included,
 * so every shot of the whole bench holds them.
 */
export function restBounds(): { x0: number; x1: number; z0: number; z1: number; h: number } {
  const reach = PIN_LENGTH_M + 0.002;
  return {
    x0: Math.min(...LEAD_REST.map((r) => r.x)) - PLUG_RADIUS_M,
    x1: Math.max(...LEAD_REST.map((r) => r.x)) + PLUG_RADIUS_M,
    z0: Math.min(...LEAD_REST.map((r) => r.z0)) - reach,
    z1: Math.max(...LEAD_REST.map((r) => r.z1)) + reach,
    h: 2 * PLUG_RADIUS_M,
  };
}

/**
 * How far either way of the board's middle a wire end, X or Y, can stand: the engine lays the wire
 * anywhere from 1 cm to 99 cm on the 100 cm rule (packages/engine/src/ohms-law/params.ts,
 * RULE_MARGIN_CM), and the nut's washer is 1.15 cm round (TerminalNut.tsx).
 */
const WIRE_END_REACH_M = Math.abs(cmToX(1)) + 0.0115;

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
  // She reads both meters on the R = 1 Ω and Repeat steps, which take this shot on a phone, so it
  // holds the meters in front of the box and key (docs/plans/wave-2-lean.md, 2b additions).
  boxKey: {
    slots: ["box", "key", "ammeter", "voltmeter"],
    topPad: 0.025,
    azimuthDeg: STAGE_AZIMUTH_DEG,
  },
  box: { slots: ["box"], topPad: 0.02, azimuthDeg: BOX_PHONE_AZIMUTH_DEG },
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
  // The leads lying in front of the row are apparatus too.
  const r = restBounds();
  x0 = Math.min(x0, r.x0);
  x1 = Math.max(x1, r.x1);
  z0 = Math.min(z0, r.z0);
  z1 = Math.max(z1, r.z1);
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
  return fittedShot(name, frameCorners(name), CLOSE[name].azimuthDeg, covered, width, height);
}

/** The slots the phone's bench shot holds: every part on the bench (the tray stands behind). */
const PHONE_BENCH_SLOTS: readonly BenchSlot[] = [
  "box",
  "key",
  "cells",
  "ammeter",
  "voltmeter",
  "wire",
];

/**
 * The bench on a phone held upright, where the whole bench is a strip: every part and the leads
 * lying in front, but the wire board's ends are cropped to the width of the other parts and of the
 * farthest the wire's ends X and Y can stand (WIRE_END_REACH_M), so all twelve terminals stay in,
 * and the bench is as big as the free area allows rather than at the laptop's fixed span.
 */
export function phoneBenchCorners(): Array<[number, number, number]> {
  const others = PHONE_BENCH_SLOTS.filter((s) => s !== "wire").map((s) => slotBounds(s, 0.025));
  const r = restBounds();
  const wx = OHMS_LAW_LAYOUT.wire.position[0];
  const xMin = Math.min(...others.map((b) => b.x0), r.x0, wx - WIRE_END_REACH_M) - PAPER_M;
  const xMax = Math.max(...others.map((b) => b.x1), r.x1, wx + WIRE_END_REACH_M) + PAPER_M;
  const box = (b: { x0: number; x1: number; z0: number; z1: number; h: number }) => {
    const xs = [Math.max(xMin, b.x0 - PAPER_M), Math.min(xMax, b.x1 + PAPER_M)];
    const zs = [b.z0 - PAPER_M, b.z1 + PAPER_M];
    const ys = [0, b.h];
    return xs.flatMap((x) => ys.flatMap((y) => zs.map((z): [number, number, number] => [x, y, z])));
  };
  return [...PHONE_BENCH_SLOTS.flatMap((slot) => box(slotBounds(slot, 0.025))), ...box(r)];
}

function fittedShot(
  id: string,
  corners: ReadonlyArray<readonly [number, number, number]>,
  azimuthDeg: number,
  covered: Covered,
  width: number,
  height: number,
): LookShot {
  const az = azimuthDeg * DEG;
  const el = LOOK_ELEVATION_DEG * DEG;
  const right = [Math.cos(az), 0, -Math.sin(az)] as const;
  const up = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)] as const;
  let sx0 = Number.POSITIVE_INFINITY;
  let sx1 = Number.NEGATIVE_INFINITY;
  let sy0 = Number.POSITIVE_INFINITY;
  let sy1 = Number.NEGATIVE_INFINITY;
  for (const [x, y, z] of corners) {
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
  return { id, focus, spanM: hi, azimuthDeg };
}

/**
 * How far she can turn the bench shot by dragging, either way (docs/plans/wave-2-lean.md, 2b
 * additions). The shot is fitted at its own azimuth, not for LookCamera's ±25° drag, so the bench
 * fills the free area; the stage turns it itself (StageCamera) and keeps the zoom while it does.
 */
export const BENCH_DRAG_DEG = 8;
/** Degrees of turn per CSS px of drag (LookCamera's 0.006 rad/px). */
export const BENCH_DRAG_DEG_PER_PX = 0.006 / DEG;

const dragScratch: Frustum = { halfW: 1, halfH: 1, offsetX: 0, offsetY: 0 };

/**
 * The span that, seen from `azimuthDeg`, frames the bench at the same scale `shot` has from its
 * own azimuth, so a turn never zooms (fitShot's scale grows with the span; bisection finds it).
 */
export function spanAtAzimuth(
  shot: LookShot,
  azimuthDeg: number,
  covered: Covered,
  width: number,
  height: number,
): number {
  const baseAz = (shot.azimuthDeg ?? STAGE_AZIMUTH_DEG) * DEG;
  const el = LOOK_ELEVATION_DEG * DEG;
  const want = fitShot(shot.spanM, covered, width, height, baseAz, dragScratch, el).halfW;
  const az = azimuthDeg * DEG;
  let lo = MIN_SPAN_M;
  let hi = Math.max(shot.spanM * 2, MIN_SPAN_M * 2);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fitShot(mid, covered, width, height, az, dragScratch, el).halfW >= want) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The whole bench on a wide screen: every part (the tray stands behind, out of the shot) and the
 * leads lying in front, with paper round them. Layout v4 is deeper than it is wide on screen, so
 * BENCH_SHOT's square-ish patch would leave the parts small; this fits what is there.
 */
export function benchCorners(): Array<[number, number, number]> {
  const box = (b: { x0: number; x1: number; z0: number; z1: number; h: number }) => {
    const xs = [b.x0 - PAPER_M, b.x1 + PAPER_M];
    const zs = [b.z0 - PAPER_M, b.z1 + PAPER_M];
    const ys = [0, b.h];
    return xs.flatMap((x) => ys.flatMap((y) => zs.map((z): [number, number, number] => [x, y, z])));
  };
  return [
    ...PHONE_BENCH_SLOTS.flatMap((slot) => box(slotBounds(slot, 0.025))),
    ...box(restBounds()),
  ];
}

/**
 * The guided demonstration's identify beats each frame one part (docs/plans/guided-demo.md): the
 * camera eases to it, and the part's tag stands beside it. A beat takes the shot named by its id.
 */
export const IDENTIFY_SHOT_NAMES = [
  "id-cells",
  "id-key",
  "id-ammeter",
  "id-voltmeter",
  "id-box",
  "id-wire",
  "id-leads",
] as const;
export type IdentifyShotName = (typeof IDENTIFY_SHOT_NAMES)[number];

export function isIdentifyShot(name: string | undefined): name is IdentifyShotName {
  return (IDENTIFY_SHOT_NAMES as readonly string[]).includes(name ?? "");
}

/**
 * Room round the framed part, in metres: its tag (a name and a line, about 4 cm of bench to a
 * side at this zoom) needs a margin more than the paper of a close shot does.
 */
const IDENTIFY_MARGIN_X_M = 0.09;
const IDENTIFY_MARGIN_Z_M = 0.05;
const IDENTIFY_MIN_X_M = 0.5;
const IDENTIFY_MIN_Z_M = 0.28;

const IDENTIFY_SLOT: Readonly<Record<Exclude<IdentifyShotName, "id-leads">, BenchSlot>> = {
  "id-cells": "cells",
  "id-key": "key",
  "id-ammeter": "ammeter",
  "id-voltmeter": "voltmeter",
  "id-box": "box",
  "id-wire": "wire",
};

/** The corners one identify shot holds, in world metres. */
export function identifyCorners(name: IdentifyShotName): Array<[number, number, number]> {
  const b = name === "id-leads" ? restBounds() : slotBounds(IDENTIFY_SLOT[name], 0.025);
  // A small part (the key is 9 cm across) is framed in a patch no smaller than this, so it does
  // not fill the screen; the wire board already runs the width of the bench.
  const halfX = Math.max(
    (b.x1 - b.x0) / 2 + (name === "id-wire" ? 0.02 : IDENTIFY_MARGIN_X_M),
    IDENTIFY_MIN_X_M / 2,
  );
  const halfZ = Math.max((b.z1 - b.z0) / 2 + IDENTIFY_MARGIN_Z_M, IDENTIFY_MIN_Z_M / 2);
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const xs = [cx - halfX, cx + halfX];
  const zs = [cz - halfZ, cz + halfZ];
  const ys = [0, b.h];
  return xs.flatMap((x) => ys.flatMap((y) => zs.map((z): [number, number, number] => [x, y, z])));
}

/**
 * The named shot for a canvas this size under these cards. `portrait` (LookCamera's isPortrait for
 * the free area: a phone held upright) crops the bench shot's sides (phoneBenchCorners).
 */
export function stageShot(
  name: StageShotName | IdentifyShotName,
  covered: Covered,
  width: number,
  height: number,
  portrait = false,
): LookShot {
  if (isIdentifyShot(name)) {
    // On a phone the wire board is seen from her left, so its metre runs up the screen.
    const az = name === "id-wire" && portrait ? BOARD_PHONE_AZIMUTH_DEG : STAGE_AZIMUTH_DEG;
    return fittedShot(name, identifyCorners(name), az, covered, width, height);
  }
  if (name !== "bench") return closeShot(name, covered, width, height);
  if (!portrait) {
    return fittedShot("bench", benchCorners(), STAGE_AZIMUTH_DEG, covered, width, height);
  }
  return fittedShot("bench", phoneBenchCorners(), STAGE_AZIMUTH_DEG, covered, width, height);
}
