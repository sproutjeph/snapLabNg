import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Covered, LookCameraProps, LookShot } from "./types";

// The look's shot camera (docs/plans/exam-redesign.md, "The look": camera; numbers from
// Backcountry 101, research report 2). Orthographic, azimuth 45°, elevation 41°. Each shot is
// {focus, spanM}: the zoom fits the shot's bounds (spanM of bench, see fitShot) into the part of
// the canvas no panel covers, in width and height, and the view offset centres the focus there. The camera follows a new shot with
// k = 1 − e^(−8 dt); reduced motion jumps. Dragging turns the azimuth only (±25°, 0.006 rad/px,
// inertia e^(−5 dt)), then the camera eases back to the shot.

/**
 * Azimuth of every shot unless it sets its own, from +z (the student's side) toward +x: the
 * camera stands front-right, so the key light from the upper left-front (LookLights) lights the
 * faces she sees and throws the shadows to the right, where she sees them.
 */
export const LOOK_AZIMUTH_DEG = 45;
export const LOOK_ELEVATION_DEG = 41;
/** Distance from the focus, in metres; orthographic, so it only has to clear the bench. */
const DISTANCE_M = 4;
const NEAR_M = 0.1;
const FAR_M = 10;
/** A shot frames a patch of desk spanM wide (x) and spanM × this deep (z)… */
export const SHOT_DEPTH_RATIO = 0.6;
/** …and this tall, so the tops of the parts stay in frame. */
export const SHOT_HEIGHT_M = 0.12;
const FOLLOW_RATE = 8;
const DRAG_RAD_PER_PX = 0.006;
const DRAG_LIMIT_RAD = (25 * Math.PI) / 180;
const INERTIA_RATE = 5;
/** How fast a released drag eases back to the shot's own azimuth. */
const RETURN_RATE = 3;
/** Pointer travel before a press counts as a drag (taps on parts stay taps). */
const DRAG_START_PX = 6;
/** A release more than this long after the last move keeps no velocity. */
const FLING_WINDOW_MS = 50;
const DEG = Math.PI / 180;

export interface Frustum {
  /** Half the visible width and height, in metres. */
  halfW: number;
  halfH: number;
  /** setViewOffset's x and y, in CSS px. */
  offsetX: number;
  offsetY: number;
}

/**
 * Fits the shot's bounds (a box of desk spanM × spanM·SHOT_DEPTH_RATIO × SHOT_HEIGHT_M round the
 * focus, seen from `azimuthRad` at the look's elevation) into the uncovered part of a
 * `width` × `height` canvas, in both width and height, and centres the focus there. Writes `out`
 * and returns it, so the per-frame call allocates nothing. Pure, so it is tested without a
 * renderer. Covers that leave less than 1 px free are ignored.
 */
export function fitShot(
  spanM: number,
  covered: Covered,
  width: number,
  height: number,
  azimuthRad: number,
  out: Frustum,
): Frustum {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let freeW = w - Math.max(0, covered.left) - Math.max(0, covered.right);
  let freeH = h - Math.max(0, covered.top) - Math.max(0, covered.bottom);
  let left = Math.max(0, covered.left);
  let top = Math.max(0, covered.top);
  if (freeW < 1) {
    freeW = w;
    left = 0;
  }
  if (freeH < 1) {
    freeH = h;
    top = 0;
  }
  const a = Math.max(1e-3, spanM) / 2;
  const b = a * SHOT_DEPTH_RATIO;
  const el = LOOK_ELEVATION_DEG * DEG;
  const sinAz = Math.abs(Math.sin(azimuthRad));
  const cosAz = Math.abs(Math.cos(azimuthRad));
  // The box's half extents on screen: along the camera's right vector (cos az, 0, −sin az) and
  // its up vector (−sin el sin az, cos el, −sin el cos az).
  const halfX = cosAz * a + sinAz * b;
  const halfY = Math.sin(el) * (sinAz * a + cosAz * b) + Math.cos(el) * SHOT_HEIGHT_M;
  // Metres per CSS px: whichever of width and height is tighter.
  const mPerPx = Math.max((2 * halfX) / freeW, (2 * halfY) / freeH);
  out.halfW = (mPerPx * w) / 2;
  out.halfH = (mPerPx * h) / 2;
  out.offsetX = w / 2 - (left + freeW / 2);
  out.offsetY = h / 2 - (top + freeH / 2);
  return out;
}

/** One step of the follow: the fraction of the remaining way to move this frame. */
export function followK(dtS: number, rate = FOLLOW_RATE): number {
  return 1 - Math.exp(-rate * Math.max(0, dtS));
}

interface Rig {
  focus: THREE.Vector3;
  span: number;
  azimuth: number;
  covered: Covered;
  /** Drag: the azimuth offset, its velocity (rad/s) and whether a finger is down. */
  drag: number;
  dragVel: number;
  held: boolean;
  primed: boolean;
}

function shotAzimuth(shot: LookShot): number {
  return (shot.azimuthDeg ?? LOOK_AZIMUTH_DEG) * DEG;
}

/**
 * Makes an orthographic camera the canvas's default for as long as it is mounted (the previous
 * camera comes back afterwards) and flies it between shots. Props are the frozen LookCameraProps.
 */
export function LookCamera({
  shot,
  covered,
  drag = false,
  reducedMotion = false,
}: LookCameraProps) {
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const camera = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR_M, FAR_M);
    // r3f leaves a manual camera's frustum alone on resize; this component sets it every frame.
    (c as THREE.OrthographicCamera & { manual?: boolean }).manual = true;
    c.name = "LookCamera";
    return c;
  }, []);
  const rig = useRef<Rig>({
    focus: new THREE.Vector3(...shot.focus),
    span: shot.spanM,
    azimuth: shotAzimuth(shot),
    covered: { ...covered },
    drag: 0,
    dragVel: 0,
    held: false,
    primed: false,
  });
  const frustum = useMemo<Frustum>(() => ({ halfW: 1, halfH: 1, offsetX: 0, offsetY: 0 }), []);
  const target = useRef({ shot, covered, reducedMotion });
  target.current = { shot, covered, reducedMotion };

  useLayoutEffect(() => {
    const prev = get().camera;
    set({ camera });
    return () => {
      if (get().camera === camera) set({ camera: prev });
    };
  }, [camera, get, set]);

  // Drag turns the azimuth only. DOM listeners, so taps on parts still reach r3f.
  useEffect(() => {
    if (!drag) return;
    const el = gl.domElement;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let pointer = -1;
    let dragging = false;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || pointer !== -1) return;
      pointer = e.pointerId;
      startX = e.clientX;
      lastX = e.clientX;
      lastT = e.timeStamp;
      dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (!dragging && Math.abs(e.clientX - startX) < DRAG_START_PX) return;
      const r = rig.current;
      dragging = true;
      r.held = true;
      const dx = e.clientX - lastX;
      const dt = Math.max(1e-3, (e.timeStamp - lastT) / 1000);
      // Dragging right turns the bench toward her right, like turning it by hand.
      const turn = -dx * DRAG_RAD_PER_PX;
      r.drag = Math.max(-DRAG_LIMIT_RAD, Math.min(DRAG_LIMIT_RAD, r.drag + turn));
      r.dragVel = turn / dt;
      lastX = e.clientX;
      lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = -1;
      rig.current.held = false;
      // A hold before letting go throws nothing: only a moving finger flings the bench.
      if (!dragging || e.timeStamp - lastT > FLING_WINDOW_MS) rig.current.dragVel = 0;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      rig.current.held = false;
      rig.current.dragVel = 0;
    };
  }, [drag, gl]);

  useFrame((state, delta) => {
    const r = rig.current;
    const t = target.current;
    // Frame-delta clamp (50 ms), so a stalled tab does not jump the camera.
    const dt = Math.min(delta, 0.05);
    const snap = t.reducedMotion || !r.primed;
    const k = snap ? 1 : followK(dt);
    const [fx, fy, fz] = t.shot.focus;
    r.focus.x += (fx - r.focus.x) * k;
    r.focus.y += (fy - r.focus.y) * k;
    r.focus.z += (fz - r.focus.z) * k;
    r.span += (t.shot.spanM - r.span) * k;
    r.azimuth += (shotAzimuth(t.shot) - r.azimuth) * k;
    r.covered.left += (t.covered.left - r.covered.left) * k;
    r.covered.right += (t.covered.right - r.covered.right) * k;
    r.covered.top += (t.covered.top - r.covered.top) * k;
    r.covered.bottom += (t.covered.bottom - r.covered.bottom) * k;
    r.primed = true;

    if (!r.held) {
      if (t.reducedMotion) {
        r.drag = 0;
        r.dragVel = 0;
      } else {
        r.drag += r.dragVel * dt;
        r.dragVel *= Math.exp(-INERTIA_RATE * dt);
        r.drag *= 1 - followK(dt, RETURN_RATE);
        r.drag = Math.max(-DRAG_LIMIT_RAD, Math.min(DRAG_LIMIT_RAD, r.drag));
      }
    }

    const az = r.azimuth + r.drag;
    const el = LOOK_ELEVATION_DEG * DEG;
    camera.position.set(
      r.focus.x + Math.sin(az) * Math.cos(el) * DISTANCE_M,
      r.focus.y + Math.sin(el) * DISTANCE_M,
      r.focus.z + Math.cos(az) * Math.cos(el) * DISTANCE_M,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(r.focus);

    const { width, height } = state.size;
    // Fitted at the shot's own azimuth, so a drag turns the bench without zooming.
    const f = fitShot(r.span, r.covered, width, height, r.azimuth, frustum);
    camera.left = -f.halfW;
    camera.right = f.halfW;
    camera.top = f.halfH;
    camera.bottom = -f.halfH;
    camera.setViewOffset(width, height, f.offsetX, f.offsetY, width, height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, -1);

  return null;
}
