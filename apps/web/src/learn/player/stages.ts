import type { Covered } from "../../scene/look/types";
import type { DirectorHandle } from "../script/createDirector";
import type { Director, Script } from "../script/types";
import { type CoveredOptions, coveredFor, layoutFor } from "../shell/layout";
import type { PracticalMode } from "../types";

// What the player and the stage checklist draw from the script alone: the question's stages (one
// per `Step.key`, in the order the script first reaches them), the words for each mode, and the
// room the page's cards take on the screen.

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

/** createDirector's handle carries the script and the voice; any other Director shows less. */
export function handleOf(d: Director): DirectorHandle | null {
  return "script" in d && "voice" in d ? (d as DirectorHandle) : null;
}

/** The three ways through a practical, as the UI says them. */
export const MODE_LABEL: Readonly<Record<PracticalMode, string>> = {
  watch: "Watch",
  practice: "Practise",
  exam: "Exam",
};

/** The one line the guide's foot says about each mode. */
export const MODE_NOTE: Readonly<Record<PracticalMode, string>> = {
  watch: "Demonstration bench. Your own bench will give different readings.",
  practice: "Your own bench. Do each action yourself; the voice will guide you.",
  exam: "Exam conditions: no guide.",
};

/**
 * The part of the canvas the page's cards cover, in CSS px, for LookCamera's `covered`: from the
 * one layout the shell and the player share (shell/layout.ts). `o.guide` is the phone's guide
 * state (default open) and `o.caption` is true while a caption pill shows.
 */
export function playerCovered(
  viewportWidthPx: number,
  viewportHeightPx: number,
  o?: CoveredOptions,
): Covered {
  return coveredFor(layoutFor(viewportWidthPx, viewportHeightPx), o);
}
