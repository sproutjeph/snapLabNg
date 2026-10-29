import { DPR_SLOW_FRAME_MS, DPR_WINDOW_FRAMES, nextDprRung } from "../../quality/tier";

// The pixel-ratio ladder's state (docs/plans/exam-redesign.md, "Performance"). It lives outside
// the Canvas: the page that owns the Canvas passes `dpr={ladder.dpr()}` (a number, so r3f does
// not follow the device's ratio) and re-renders when the ladder steps. r3f re-applies the `dpr`
// prop whenever the Canvas re-renders, so the rung must not live inside it: here a re-render
// re-applies the current rung, never the top one. Inside the Canvas, useDprLadder feeds it
// frame times. It steps down one rung whenever more than 60 of 90 frames took over 25 ms, and
// never steps back up during a visit.

/** Frames ignored after it starts and after each step, while shaders compile and targets resize. */
export const DPR_SETTLE_FRAMES = 20;

export interface DprLadder {
  readonly rungs: readonly number[];
  /** The pixel ratio to render at now. */
  dpr(): number;
  rung(): number;
  /** One frame's delta, in seconds. True when this frame stepped the ratio down. */
  frame(deltaS: number): boolean;
  /** For useSyncExternalStore: called after every step. */
  subscribe(fn: () => void): () => void;
}

export function createDprLadder(rungs: readonly number[]): DprLadder {
  const ladder = rungs.length > 0 ? rungs : [1];
  let rung = 0;
  let frames = 0;
  let slow = 0;
  let settle = DPR_SETTLE_FRAMES;
  const listeners = new Set<() => void>();
  return {
    rungs: ladder,
    dpr: () => ladder[rung] ?? 1,
    rung: () => rung,
    frame(deltaS) {
      if (settle > 0) {
        settle -= 1;
        return false;
      }
      frames += 1;
      if (deltaS * 1000 > DPR_SLOW_FRAME_MS) slow += 1;
      if (frames < DPR_WINDOW_FRAMES) return false;
      const next = nextDprRung(ladder, rung, slow);
      frames = 0;
      slow = 0;
      if (next === rung) return false;
      rung = next;
      settle = DPR_SETTLE_FRAMES;
      for (const fn of listeners) fn();
      return true;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
