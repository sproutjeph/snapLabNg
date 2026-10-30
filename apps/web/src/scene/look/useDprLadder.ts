import { useFrame, useThree } from "@react-three/fiber";
import { useSyncExternalStore } from "react";
import type { DprLadder } from "./dprLadder";

// The pixel-ratio ladder's two hooks (dprLadder.ts). Outside the Canvas, useLadderDpr gives the
// `dpr` prop and re-renders the owner when the ladder steps. Inside it, useDprLadder feeds the
// ladder each frame's time and, if the ratio on the renderer ever differs from the ladder's
// (a Canvas re-render from an owner that does not pass the ladder's dpr), puts it back.

/** The Canvas's `dpr` prop: the ladder's current rung. */
export function useLadderDpr(ladder: DprLadder): number {
  return useSyncExternalStore(ladder.subscribe, ladder.dpr, ladder.dpr);
}

/**
 * `maxGapS`: on a demand frameloop, a longer gap between frames is the loop resting, not a slow
 * frame, so it is not counted (default: every frame counts).
 */
export function useDprLadder(
  ladder: DprLadder,
  enabled = true,
  maxGapS = Number.POSITIVE_INFINITY,
): void {
  const setDpr = useThree((s) => s.setDpr);
  useFrame((state, delta) => {
    if (!enabled) return;
    if (delta <= maxGapS) ladder.frame(delta);
    const dpr = ladder.dpr();
    if (state.viewport.dpr !== dpr) setDpr(dpr);
  });
}
