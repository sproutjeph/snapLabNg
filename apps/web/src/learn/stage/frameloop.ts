import { INK_IDS } from "../../apparatus/ohms-law/layout";
import type { OhmsLawVisualState } from "../types";

// The live stage's demand frameloop (docs/plans/wave-2-lean.md, 2a-stage). The canvas renders only
// while something can move: a closed key (the engine runs, current dots flow), a pulsing ring or a
// pending lead, an open close-up, and for a short while after anything else changes (a bench
// change, a needle still swinging, a tap or drag, a page re-render, a resize). Each of those wakes
// the loop for a few seconds; while it is awake, every frame asks for the next. The same signals
// mark the shadow map dirty when a part that casts a shadow moved.

/** Seconds of frames after a bench change (a lead, plug or key tween, a needle swinging back). */
export const SETTLE_S = 2.5;
/** Seconds of frames after a pointer moves or lifts on the canvas (hover, drag and its ease back). */
export const POINTER_S = 2;
/** Seconds of frames after the page re-renders or the window changes (the camera's follow). */
export const RENDER_S = 1.5;
/** Seconds of frames when the canvas first mounts (shaders, the lights' warm-up, the ready signal). */
export const MOUNT_S = 3;
/**
 * A gap between rendered frames longer than this is the loop resting, not a slow frame: the
 * pixel-ratio ladder does not count it.
 */
export const IDLE_GAP_S = 0.2;
/**
 * A rendered frame spends at most this much of a wake, so a wake always buys frames, not just
 * time: a first frame that takes seconds (shaders compiling) still leaves the rest to render.
 */
export const MAX_TICK_S = 0.1;
/** A needle that moved less than this many degrees since the last frame has stopped. */
const NEEDLE_STILL_DEG = 0.01;

/** One canvas's wake timer. Lives outside the Canvas, so the page can wake it too. */
export interface StageLoop {
  /** Keep rendering for at least `seconds` from now. */
  wake(seconds: number): void;
  /** One rendered frame `dtS` long (counted as at most MAX_TICK_S): true while still awake. */
  tick(dtS: number): boolean;
  /** Seconds of frames left. */
  remaining(): number;
  /** r3f's invalidate, set by the canvas, so a wake from outside a frame starts one. */
  invalidate: () => void;
}

export function createStageLoop(): StageLoop {
  let left = 0;
  const loop: StageLoop = {
    wake(seconds) {
      left = Math.max(left, seconds);
      loop.invalidate();
    },
    tick(dtS) {
      left = Math.max(0, left - Math.min(MAX_TICK_S, Math.max(0, dtS)));
      return left > 0;
    },
    remaining: () => left,
    invalidate: () => {},
  };
  return loop;
}

/** True while the bench itself keeps moving, whatever the timer says. */
export function benchBusy(v: OhmsLawVisualState): boolean {
  return v.keyClosed || v.ring !== null || v.pendingFrom !== null;
}

/** What was seen last frame of the parts that move and cast shadows. Updated in place. */
export interface PoseMemo {
  ammeterDeg: number;
  voltmeterDeg: number;
  keyClosed: boolean;
  plugs: number;
  leads: number;
}

export function createPoseMemo(): PoseMemo {
  return {
    ammeterDeg: Number.NaN,
    voltmeterDeg: Number.NaN,
    keyClosed: false,
    plugs: -1,
    leads: -1,
  };
}

/**
 * True when a needle, the key, a plug or the lead count changed since the last call (the first
 * call is always a change). Writes the memo; allocates nothing, so it runs every frame.
 */
export function poseChanged(memo: PoseMemo, v: OhmsLawVisualState): boolean {
  let plugs = 0;
  for (let i = 0; i < v.plugsIn.length; i++) if (v.plugsIn[i]) plugs += 2 ** i;
  const a = v.readout.ammeterDeg;
  const b = v.readout.voltmeterDeg;
  const changed =
    !(Math.abs(a - memo.ammeterDeg) < NEEDLE_STILL_DEG) ||
    !(Math.abs(b - memo.voltmeterDeg) < NEEDLE_STILL_DEG) ||
    v.keyClosed !== memo.keyClosed ||
    plugs !== memo.plugs ||
    v.leads.length !== memo.leads;
  memo.ammeterDeg = a;
  memo.voltmeterDeg = b;
  memo.keyClosed = v.keyClosed;
  memo.plugs = plugs;
  memo.leads = v.leads.length;
  return changed;
}

/** The bench's parts, by their ink-id block (apparatus/ohms-law/layout.ts INK_IDS). */
export type StagePart = "cells" | "key" | "ammeter" | "voltmeter" | "box" | "wire" | "tray";

/** The ids every focus keeps: the twelve terminal nuts (100+) and the twenty lead ids (140+). */
const NUT_IDS = 12;
const LEAD_IDS = 20;

/**
 * The ink ids kept in focus for these parts: each part's block of ten, plus every terminal nut
 * and every lead, so the wiring never fades back while a part is in focus. Null or no parts: null
 * (everything in focus).
 */
export function stageFocusIds(parts: readonly StagePart[] | null | undefined): Set<number> | null {
  if (!parts || parts.length === 0) return null;
  const ids = new Set<number>();
  for (const p of parts) for (let i = 0; i < 10; i++) ids.add(INK_IDS[p] + i);
  for (let i = 0; i < NUT_IDS; i++) ids.add(INK_IDS.nutBase + i);
  for (let i = 0; i < LEAD_IDS; i++) ids.add(INK_IDS.leadBase + i);
  // The Watch pen nib draws the leads: it stays in focus with them.
  ids.add(INK_IDS.pen);
  return ids;
}
