import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BENCH_FOOTPRINTS } from "../../apparatus/ohms-law/LeadParts";
import { OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { DIAL } from "../../apparatus/ohms-law/MeterDial";
import {
  faceToMeter,
  METER_DIAL_LIFT,
  METER_DIAL_Y,
  METER_FACE_Z,
} from "../../apparatus/ohms-law/MeterImage";
import { fitShot, LOOK_DISTANCE_M, LOOK_ELEVATION_DEG } from "../../scene/look/LookCamera";
import type { Covered, LookShot } from "../../scene/look/types";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { playerCovered } from "../player/stages";
import { layoutFor, RAIL_W } from "../shell/layout";
import {
  BENCH_SHOT,
  frameCorners,
  freeArea,
  SHOT_FOR_POSE,
  STAGE_SHOT_NAMES,
  type StageShotName,
  shotForPose,
  stageShot,
} from "./shots";

// The stage's named shots (docs/plans/wave-2-lean.md, 2a-stage; the user's Oct 30 review). No
// textbook source: these test framing and geometry, not science.

const DEG = Math.PI / 180;

/** The canvas for a window: the shell less the rail column on wide and compact layouts. */
function canvasFor(w: number, h: number) {
  const l = layoutFor(w, h);
  const rail = l.mode === "wide" || l.mode === "compact" ? RAIL_W * l.ui : 0;
  return { width: w - rail, height: h };
}

/** An orthographic camera placed and fitted exactly as LookCamera places it at rest. */
function lookCamera(shot: LookShot, covered: Covered, width: number, height: number) {
  const az = (shot.azimuthDeg ?? 45) * DEG;
  const el = LOOK_ELEVATION_DEG * DEG;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const [fx, fy, fz] = shot.focus;
  cam.position.set(
    fx + Math.sin(az) * Math.cos(el) * LOOK_DISTANCE_M,
    fy + Math.sin(el) * LOOK_DISTANCE_M,
    fz + Math.cos(az) * Math.cos(el) * LOOK_DISTANCE_M,
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(fx, fy, fz);
  const f = fitShot(
    shot.spanM,
    covered,
    width,
    height,
    az,
    {
      halfW: 1,
      halfH: 1,
      offsetX: 0,
      offsetY: 0,
    },
    el,
  );
  cam.left = -f.halfW;
  cam.right = f.halfW;
  cam.top = f.halfH;
  cam.bottom = -f.halfH;
  cam.setViewOffset(width, height, f.offsetX, f.offsetY, width, height);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

/** World point to canvas CSS px. */
function toPx(cam: THREE.Camera, p: THREE.Vector3, width: number, height: number) {
  const v = p.clone().project(cam);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}

/** The corners of a slot's footprints (a meter's case and ledge), from the desk to their tops. */
function slotCorners(slot: string): THREE.Vector3[] {
  return BENCH_FOOTPRINTS.filter((f) => f.slot === slot).flatMap((f) =>
    [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) =>
        [0, f.top].map((y) => new THREE.Vector3(f.cx + sx * f.hx, y, f.cz + sz * f.hz)),
      ),
    ),
  );
}

const SCREENS = [
  { name: "laptop 1440×900", w: 1440, h: 900 },
  { name: "phone 390×844", w: 390, h: 844 },
] as const;

function fitsInFree(name: StageShotName, slots: readonly string[], w: number, h: number) {
  const { width, height } = canvasFor(w, h);
  const covered = playerCovered(w, h, { guide: "peek" });
  const shot = stageShot(name, covered, width, height);
  const cam = lookCamera(shot, covered, width, height);
  const free = freeArea(covered, width, height);
  for (const slot of slots) {
    for (const p of slotCorners(slot)) {
      const { x, y } = toPx(cam, p, width, height);
      expect(x, `${slot} left of the free area`).toBeGreaterThanOrEqual(free.left - 1e-6);
      expect(x, `${slot} right of the free area`).toBeLessThanOrEqual(
        free.left + free.width + 1e-6,
      );
      expect(y, `${slot} above the free area`).toBeGreaterThanOrEqual(free.top - 1e-6);
      expect(y, `${slot} below the free area`).toBeLessThanOrEqual(free.top + free.height + 1e-6);
    }
  }
  return { cam, width, height, covered };
}

/** A dial's width and height on screen, in px, from the meter's face geometry. */
function dialPx(cam: THREE.Camera, kind: "ammeter" | "voltmeter", width: number, height: number) {
  const [mx, my, mz] = OHMS_LAW_LAYOUT[kind].position;
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 360; i++) {
    const t = i * DEG;
    const p = faceToMeter(
      new THREE.Vector3(
        DIAL.radius * Math.cos(t),
        METER_DIAL_Y + DIAL.radius + DIAL.radius * Math.sin(t),
        METER_FACE_Z + METER_DIAL_LIFT,
      ),
    );
    p.add(new THREE.Vector3(mx, my, mz));
    const s = toPx(cam, p, width, height);
    x0 = Math.min(x0, s.x);
    x1 = Math.max(x1, s.x);
    y0 = Math.min(y0, s.y);
    y1 = Math.max(y1, s.y);
  }
  return { w: x1 - x0, h: y1 - y0 };
}

describe("the stage's named shots", () => {
  it("maps each lesson step's pose to a shot that exists, on a laptop and a phone", () => {
    for (const step of OHMS_LAW_LESSON.steps) {
      for (const screen of ["laptop", "phone"] as const) {
        expect(Object.keys(SHOT_FOR_POSE[screen]), `${step.key} on a ${screen}`).toContain(
          step.pose,
        );
        const name = shotForPose(step.pose, screen === "phone");
        expect(STAGE_SHOT_NAMES).toContain(name);
        const shot = stageShot(name, playerCovered(1440, 900), 1378, 900);
        expect(shot.spanM).toBeGreaterThan(0);
        expect(shot.focus.every(Number.isFinite)).toBe(true);
      }
    }
    // The reading steps come close to the meters everywhere; the phone also closes on the rest.
    expect(shotForPose("readings", false)).toBe("meters");
    expect(shotForPose("readings", true)).toBe("meters");
    expect(shotForPose("box", true)).toBe("boxKey");
    expect(shotForPose("wire", true)).toBe("board");
  });

  for (const s of SCREENS) {
    it(`keeps both meter cases inside the free area on a ${s.name}`, () => {
      fitsInFree("meters", ["ammeter", "voltmeter"], s.w, s.h);
    });
  }

  it("keeps the box and key with both meters, and the wire board, inside a phone's free area", () => {
    fitsInFree("boxKey", ["box", "key", "ammeter", "voltmeter"], 390, 844);
    fitsInFree("board", ["wire"], 390, 844);
  });

  it("makes the meters bigger than the bench shot does, and as big as the free area allows", () => {
    for (const s of SCREENS) {
      const { cam, width, height, covered } = fitsInFree(
        "meters",
        ["ammeter", "voltmeter"],
        s.w,
        s.h,
      );
      const close = dialPx(cam, "ammeter", width, height);
      const bench = dialPx(
        lookCamera(BENCH_SHOT, covered, width, height),
        "ammeter",
        width,
        height,
      );
      expect(close.w, s.name).toBeGreaterThan(bench.w * 1.5);
      // A slightly tighter shot would cut into the paper round the cases: the shot is the
      // tightest that keeps the cases and their margin in view.
      const shot = stageShot("meters", covered, width, height);
      const tighter = lookCamera({ ...shot, spanM: shot.spanM * 0.97 }, covered, width, height);
      const free = freeArea(covered, width, height);
      const out = frameCorners("meters")
        .map(([x, y, z]) => toPx(tighter, new THREE.Vector3(x, y, z), width, height))
        .some(
          (q) =>
            q.x < free.left - 2 ||
            q.x > free.left + free.width + 2 ||
            q.y < free.top - 2 ||
            q.y > free.top + free.height + 2,
        );
      expect(out, `${s.name}: 3% tighter still fits, so the shot is not the tightest`).toBe(true);
    }
  });
});

describe("the sloping-front meter", () => {
  it("shows a nearly round dial from the student's seat (height ≥ 0.9 of width at the bench shot)", () => {
    const { width, height } = canvasFor(1440, 900);
    const covered = playerCovered(1440, 900);
    const cam = lookCamera(BENCH_SHOT, covered, width, height);
    for (const kind of ["ammeter", "voltmeter"] as const) {
      const d = dialPx(cam, kind, width, height);
      expect(d.h / d.w, kind).toBeGreaterThanOrEqual(0.9);
    }
  });
});
