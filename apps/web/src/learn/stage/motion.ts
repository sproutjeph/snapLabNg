import { BENCH_FOOTPRINTS } from "../../apparatus/ohms-law/LeadParts";
import type { BenchSlot } from "../../apparatus/ohms-law/layout";
import { LOOK_ELEVATION_DEG } from "../../scene/look/LookCamera";
import {
  BEAT_GAP_S,
  ENTER_DROP_S,
  ENTER_STAGGER_S,
  KEY_TOGGLE_AT,
  LEAD_DROP_GAP_S,
  LEAD_DROP_STAGGER_S,
  LEAD_S,
  LEAD_TAP_AT,
  NIB_TRAVEL_S,
} from "../script/timing";

export { LEAD_DROP_GAP_S, LEAD_DROP_STAGGER_S };

import { ease } from "../timeline";
import { STAGE_AZIMUTH_DEG } from "./shots";

// Watch and Practise motion on the live stage (docs/plans/wave-2-lean.md, 2b-motion; BC101's pace
// in "What we learned" 3). Pure numbers and curves, so the tests check them without a renderer;
// learn/stage/Choreo.tsx plays them each frame. Screen choices, not science.
//   - The entrance: 0.9 s after Watch starts, each part drops 2.2 BC101 units (0.22 m) with a
//     0.4 s outBounce, 0.10 s apart, lowest on screen (nearest her) first; then the seven leads
//     drop into their rest places one by one, 0.2 s apart, all down by about 3.5 s.
//   - A lead: the nib taps both terminals (the director's LEAD_TAP_AT), then the lead draws
//     itself over the last 0.6 s with an inOut cubic. The one tween past BC101's 0.4 s cap.
//   - The callout chip springs to each beat's anchor at the beat's start, in real time (speed
//     never scales it).

/** Seconds from Watch starting (her tap) to the first part leaving the sky. */
export const ENTRANCE_DELAY_S = 0.9;
/** BC101 drops from 2.2 of its units; one of its units is about 10 cm of ours (LookLights.tsx). */
export const BC101_UNIT_M = 0.1;
export const DROP_HEIGHT_M = 2.2 * BC101_UNIT_M;
/** The lead's draw-on: the share of LEAD_S after the second tap. */
export const LEAD_DRAW_S = LEAD_S * (1 - LEAD_TAP_AT[1]);
/** A wrong tap shakes this long. */
export const SHAKE_S = 0.3;
/** The shake's sideways swing at the nut, metres. */
export const SHAKE_M = 0.004;
/** The chip's spring: angular rate (rad/s) and damping ratio; it settles in about 0.35 s. */
export const CHIP_SPRING_RATE = 20;
export const CHIP_SPRING_DAMPING = 0.8;
/** About how long the chip takes to settle (four time constants of the spring's envelope). */
export const CHIP_SETTLE_S = 4 / (CHIP_SPRING_RATE * CHIP_SPRING_DAMPING) + 0.1;
/** The pen nib's tap (apparatus/ohms-law/PenNib.tsx TAP_S). */
export const NIB_TAP_S = 0.28;

/**
 * Every tween the stage plays, in beat seconds at 1×. BC101 keeps every tween at or under 0.4 s;
 * the lead's draw is the one allowed past it (docs/plans/wave-2-lean.md, "The experience").
 */
export const STAGE_TWEENS: Readonly<Record<string, number>> = {
  drop: ENTER_DROP_S,
  nibTravel: NIB_TRAVEL_S,
  nibTap: NIB_TAP_S,
  shake: SHAKE_S,
  chipSpring: CHIP_SETTLE_S,
  leadDraw: LEAD_DRAW_S,
};
/** The longest any tween but the lead draw may run (BC101). */
export const MAX_TWEEN_S = 0.4;

/** The parts that drop in, as the stage draws them (the tray stays off the bench). */
export type DropSlot = Exclude<BenchSlot, "tray">;

/** How high on screen a world point sits, in metres along the bench shot's up vector. */
export function screenHeight(x: number, y: number, z: number): number {
  const az = (STAGE_AZIMUTH_DEG * Math.PI) / 180;
  const el = (LOOK_ELEVATION_DEG * Math.PI) / 180;
  return -Math.sin(el) * Math.sin(az) * x + Math.cos(el) * y - Math.sin(el) * Math.cos(az) * z;
}

/**
 * The order the parts drop in: the lowest on screen first (the bottom of each footprint, as the
 * bench shot sees it), so each lands in front of nothing that is still to come.
 */
export function entranceOrder(slots: readonly DropSlot[]): DropSlot[] {
  const bottom = (slot: DropSlot) => {
    let low = Number.POSITIVE_INFINITY;
    for (const f of BENCH_FOOTPRINTS) {
      if (f.slot !== slot) continue;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          low = Math.min(low, screenHeight(f.cx + sx * f.hx, 0, f.cz + sz * f.hz));
    }
    return low;
  };
  return [...slots].sort((a, b) => bottom(a) - bottom(b));
}

/** When the i-th part to drop leaves the sky, in seconds from the entrance beat's start. */
export function dropStartS(i: number): number {
  return ENTRANCE_DELAY_S + i * ENTER_STAGGER_S;
}

/** A dropping part: its height above its place, and how far it has come (0 before, 1 landed). */
export interface DropPose {
  heightM: number;
  k: number;
}

/** A part's drop at `t` seconds, for a drop that leaves the sky at `startS`. Allocates nothing. */
export function dropFrom(t: number, startS: number, out: DropPose): DropPose {
  const raw = (t - startS) / ENTER_DROP_S;
  const k = Math.min(1, Math.max(0, raw));
  out.k = raw < 0 ? 0 : k;
  out.heightM = DROP_HEIGHT_M * (1 - ease.outBounce(k));
  return out;
}

/** The i-th part's drop at `t` seconds into the entrance beat. Writes `out`; allocates nothing. */
export function dropAt(t: number, i: number, out: DropPose): DropPose {
  return dropFrom(t, dropStartS(i), out);
}

/** Seconds from the entrance beat's start until the last of `n` parts has landed. */
export function entranceEndS(n: number): number {
  return dropStartS(Math.max(0, n - 1)) + ENTER_DROP_S;
}

/**
 * The leads lie on the bench as apparatus (docs/plans/beauty-pass.md, Step 0 item 2): after the
 * last part has landed they drop into their rest places one by one, LEAD_DROP_STAGGER_S apart,
 * each with the parts' drop. The whole entrance, parts and leads, is over within ENTRANCE_MAX_S.
 */
export const ENTRANCE_MAX_S = 7;

/** When the j-th lead leaves the sky, in seconds from the entrance's start, after `parts` parts. */
export function leadDropStartS(j: number, parts: number): number {
  return entranceEndS(parts) + LEAD_DROP_GAP_S + j * LEAD_DROP_STAGGER_S;
}

/** Seconds from the entrance's start until the last of `leads` leads has landed. */
export function fullEntranceEndS(parts: number, leads: number): number {
  return leads > 0 ? leadDropStartS(leads - 1, parts) + ENTER_DROP_S : entranceEndS(parts);
}

/** Where in a plug beat's action (0..1) the nib taps the box: as the plug moves, after its travel. */
export const PLUG_TAP_AT = 0.5;

/**
 * How many times the pen nib has tapped by `actT` (0..1) into an action: a lead's two terminals
 * (LEAD_TAP_AT), the key as it moves (KEY_TOGGLE_AT), and a plug as it is pulled or pushed
 * (PLUG_TAP_AT). Choreo taps once each time this rises.
 */
export function actTaps(kind: string | undefined, actT: number): number {
  if (kind === "lead") return (actT >= LEAD_TAP_AT[0] ? 1 : 0) + (actT >= LEAD_TAP_AT[1] ? 1 : 0);
  if (kind === "key") return actT >= KEY_TOGGLE_AT ? 1 : 0;
  if (kind === "plug") return actT >= PLUG_TAP_AT ? 1 : 0;
  return 0;
}

/** inOut cubic: the lead's draw-on. */
export function inOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * How long a lead beat runs, in beat seconds, from its start to the next beat's: the nib's two
 * taps and the 0.6 s draw (LEAD_S) overlap the narration, then the stage holds BC101's 1.0 s.
 * The draw is the action's last 0.6 s, so the beat is never shorter than the taps, the draw and
 * the hold.
 */
export function leadBeatS(narrationS: number): number {
  return Math.max(narrationS, LEAD_S) + BEAT_GAP_S;
}

/** The sideways offset of a shaking nut, metres, `t` seconds into its shake (0 once it is over). */
export function shakeAt(t: number): number {
  if (!(t >= 0) || t >= SHAKE_S) return 0;
  const k = t / SHAKE_S;
  // Three swings, dying away.
  return SHAKE_M * Math.sin(k * Math.PI * 6) * (1 - k);
}

/** One step of the chip's spring toward `target`, per axis. Mutates `s`; allocates nothing. */
export function springStep(
  s: { x: number; v: number },
  target: number,
  dtS: number,
  rate = CHIP_SPRING_RATE,
  damping = CHIP_SPRING_DAMPING,
): void {
  // Semi-implicit Euler in small sub-steps, stable for a slow frame.
  let left = Math.min(0.1, Math.max(0, dtS));
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    const a = -rate * rate * (s.x - target) - 2 * damping * rate * s.v;
    s.v += a * h;
    s.x += s.v * h;
    left -= h;
  }
}
