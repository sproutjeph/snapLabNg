import type { Covered } from "../../scene/look/types";
import { layoutFor } from "./layout";

// What the guided demonstration docks over the stage (docs/plans/guided-demo.md): the question
// paper while it reads, the readings table, and the graph. On a laptop each takes a column down the
// right; on a phone each is a bottom sheet. The camera frames the bench in what is left, so no
// part stands behind a panel. The sizes here are the CSS's (shell/guidedDock.css, shell.css's
// `.sh-sheet`); the two must agree.

export type GuidedDock = "paper" | "readings" | "graph" | "notes" | "end";

/** A laptop's column: the paper's sheet is 520 px, the table's 400, the graph's up to 800 or 56%. */
export const DOCK_PAPER_W = 520;
export const DOCK_READINGS_W = 400;
export const DOCK_GRAPH_W = 800;
/** The precautions, the law and the working: a card of lines under the step. */
export const DOCK_NOTES_W = 440;
/** The conclusion card at the end. */
export const DOCK_END_W = 520;
/** The room left round a column, in px (the sheet's own gap to the window). */
const DOCK_GAP = 16;

/** A phone's bottom sheet, as a fraction of the window's height. */
export const DOCK_SHEET_FRAC: Readonly<Record<GuidedDock, number>> = {
  paper: 0.58,
  readings: 0.62,
  graph: 0.66,
  notes: 0.46,
  end: 0.66,
};

/** The width a laptop's column takes, in CSS px, for a window this wide. */
export function dockWidth(dock: GuidedDock, windowWidth: number): number {
  switch (dock) {
    case "paper":
      return Math.min(DOCK_PAPER_W, windowWidth - 32);
    case "readings":
      return Math.min(DOCK_READINGS_W, windowWidth * 0.45);
    case "graph":
      return Math.min(DOCK_GRAPH_W, windowWidth * 0.56);
    case "notes":
      return Math.min(DOCK_NOTES_W, windowWidth - 32);
    case "end":
      return Math.min(DOCK_END_W, windowWidth - 32);
  }
}

/** Which stages dock which board; any other stage docks nothing (the whole paper is there). */
export function dockForStage(stage: string | undefined): GuidedDock | null {
  switch (stage) {
    case "r0":
    case "r1":
    case "repeat":
      return "readings";
    case "plot":
    case "slope":
      return "graph";
    case "precautions":
    case "law":
    case "length":
      return "notes";
    default:
      return null;
  }
}

/**
 * `base` (what the always-on chrome covers) plus the docked panel: a column on the right on a
 * laptop, the foot of the window on a phone. No dock leaves `base` as it is.
 */
export function dockedCovered(
  base: Covered,
  dock: GuidedDock | null,
  width: number,
  height: number,
  /** The stage's own height: the window's less the step strip (the callout layer's). */
  stageHeight: number = height,
): Covered {
  if (dock === null) return base;
  const layout = layoutFor(width, height);
  if (layout.mode === "portrait" || layout.mode === "short") {
    // The sheet's top is at (1 - fraction) of the window, but the stage ends above the step strip:
    // only what of the stage lies below the sheet's top is covered.
    const sheetTop = height * (1 - DOCK_SHEET_FRAC[dock]);
    return { ...base, bottom: Math.max(base.bottom, stageHeight - sheetTop) };
  }
  return { ...base, right: base.right + dockWidth(dock, width) + DOCK_GAP };
}
