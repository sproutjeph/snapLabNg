import type { Covered } from "../../scene/look/types";
import type { Script } from "../script/types";

// What the player draws from the script alone: the question's stages (one per `Step.key`, in
// the order the script first reaches them) and the room its panels take on the screen.

export interface StageInfo {
  key: string;
  /** Index of the stage's first beat. */
  first: number;
  /** How many beats it has. */
  count: number;
}

/** The script's stages, in order. A stage's beats are expected to sit side by side. */
export function stagesOf(script: Script): StageInfo[] {
  const stages: StageInfo[] = [];
  script.beats.forEach((b, i) => {
    const last = stages[stages.length - 1];
    if (last && last.key === b.stage) last.count++;
    else stages.push({ key: b.stage, first: i, count: 1 });
  });
  return stages;
}

/** Which stage a beat belongs to (0 for an empty script). */
export function stageIndexOf(stages: readonly StageInfo[], beat: number): number {
  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i];
    if (s && beat >= s.first) return i;
  }
  return 0;
}

/** "measure-xy" becomes "Measure xy": a fallback when the page gives no stage titles. */
export function humaniseStage(key: string): string {
  const t = key.replace(/[-_]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Below this width the stage panel folds into a sheet that a button opens. */
export const WIDE_MIN_PX = 900;
/** The stage panel's width and the gap around it (player.css uses the same numbers). */
export const PANEL_WIDTH_PX = 280;
const GUTTER_PX = 16;
/** The header chips at the top, and the caption bar and player pill at the bottom. */
const TOP_PX = 76;
const DOCK_PX = 150;

/**
 * The part of the canvas the player's panels cover, in CSS px, for LookCamera's `covered`: the
 * stage panel on the right (wide screens), the header at the top, the caption and player below.
 */
export function playerCovered(viewportWidthPx: number, viewportHeightPx: number): Covered {
  const wide = viewportWidthPx >= WIDE_MIN_PX;
  return {
    left: 0,
    right: wide ? PANEL_WIDTH_PX + 2 * GUTTER_PX : 0,
    top: TOP_PX,
    bottom: Math.min(DOCK_PX, viewportHeightPx * 0.3),
  };
}
