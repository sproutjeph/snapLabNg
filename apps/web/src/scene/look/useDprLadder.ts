import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { DPR_SLOW_FRAME_MS, DPR_WINDOW_FRAMES, nextDprRung } from "../../quality/tier";

// The pixel-ratio ladder (docs/plans/exam-redesign.md, "Performance"): the canvas starts on the
// top rung and steps down one rung whenever more than 60 of 90 frames took over 25 ms. It never
// steps back up during a visit. Use inside a Canvas whose `dpr` prop is the ladder's first rung;
// r3f puts the prop back if the Canvas re-renders, which only restarts the climb down.

/** Frames ignored after mount and after each step, while shaders compile and targets resize. */
const SETTLE_FRAMES = 20;

export function useDprLadder(ladder: readonly number[], enabled = true): void {
  const setDpr = useThree((s) => s.setDpr);
  const state = useRef({ rung: 0, frames: 0, slow: 0, settle: SETTLE_FRAMES });

  useEffect(() => {
    state.current = { rung: 0, frames: 0, slow: 0, settle: SETTLE_FRAMES };
    const top = ladder[0];
    if (enabled && top !== undefined) setDpr(top);
  }, [ladder, enabled, setDpr]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const s = state.current;
    if (s.settle > 0) {
      s.settle -= 1;
      return;
    }
    s.frames += 1;
    if (delta * 1000 > DPR_SLOW_FRAME_MS) s.slow += 1;
    if (s.frames < DPR_WINDOW_FRAMES) return;
    const next = nextDprRung(ladder, s.rung, s.slow);
    s.frames = 0;
    s.slow = 0;
    if (next !== s.rung) {
      s.rung = next;
      s.settle = SETTLE_FRAMES;
      const dpr = ladder[next];
      if (dpr !== undefined) setDpr(dpr);
    }
  });
}
