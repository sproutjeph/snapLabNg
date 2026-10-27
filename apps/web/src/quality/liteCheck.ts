import type { QualityTier } from "../apparatus/meter-bridge/types";

export const LITE_FPS_LIMIT = 20;
export const LITE_HOLD_MS = 5000;

export interface LiteState {
  lowSince: number | null;
}

export function createLiteState(): LiteState {
  return { lowSince: null };
}

export function meanFps(averages: number[]): number {
  if (averages.length === 0) return 0;
  let total = 0;
  for (const value of averages) total += value;
  return total / averages.length;
}

export function resetLite(state: LiteState): void {
  state.lowSince = null;
}

/**
 * Returns true once the mean fps has stayed under LITE_FPS_LIMIT at the low
 * tier for LITE_HOLD_MS. Any sample at or over the limit resets the timer.
 */
export function updateLite(
  state: LiteState,
  tier: QualityTier,
  averages: number[],
  now: number,
): boolean {
  if (tier !== "low" || meanFps(averages) >= LITE_FPS_LIMIT) {
    state.lowSince = null;
    return false;
  }
  if (state.lowSince === null) state.lowSince = now;
  return now - state.lowSince >= LITE_HOLD_MS;
}
