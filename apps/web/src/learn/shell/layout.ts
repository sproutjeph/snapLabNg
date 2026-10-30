import type { Covered } from "../../scene/look/types";

// The page layout's one breakpoint set (docs/plans/page-layout.md, "One breakpoint set"). The
// layout is drawn on a design canvas of 1728 × 996 "design px" and scaled by `ui` (CSS `zoom` on
// each floating layer), so every size below is a design px. Four modes replace the shell's old
// 640 px phone query and the player's 900 px query, and `coveredFor` says which part of the
// canvas the cards leave free, so the camera frames what she can see.
//
// Pure: no DOM, no React. The shell and the player both call `layoutFor` with the window size.

export type LayoutMode = "wide" | "compact" | "short" | "portrait";

export interface LayoutInfo {
  mode: LayoutMode;
  /** CSS px per design px (the zoom on each floating layer). */
  ui: number;
  /** The viewport in design px: width / ui and height / ui. */
  lw: number;
  lh: number;
  /** Portrait: where the stage ends and the step strip starts, from the top, in design px. */
  sceneBottom?: number;
  /** Wide, compact and short: the guide panel's width, in design px. */
  guideW?: number;
}

export interface CoveredOptions {
  /** Portrait only: the guide fully open (default), or folded to its tab row and one line. */
  guide?: "open" | "peek";
  /** A caption pill is showing above the strip, so the bench keeps clear of it. */
  caption?: boolean;
}

/** The design canvas the wide layout is drawn on. */
export const DESIGN_W = 1728;
export const DESIGN_H = 996;
/** The rail's width (wide and compact). */
export const RAIL_W = 74;

/** The guide: wide is 513 wide and 16 from the edge; compact 446 and 12. */
export const WIDE_GUIDE_W = 513;
export const WIDE_GUIDE_EDGE = 16;
export const COMPACT_GUIDE_W = 446;
export const COMPACT_GUIDE_EDGE = 12;
/** Compact is drawn on a canvas this size, and folds the credit to its mark below the width. */
const COMPACT_DESIGN_W = 1226 + RAIL_W;
const COMPACT_DESIGN_H = 860;
export const COMPACT_CREDIT_MIN_LW = 1400 + RAIL_W;

/** Wide and compact: the bottom of the status card, and the height of the step strip. */
export const STATUS_BOTTOM = 104;
export const STRIP_H = 164;

/** Short (a landscape phone): the player's bottom, the strip's height, the guide's gap. */
export const SHORT_PLAYER_BOTTOM = 58;
export const SHORT_STRIP_H = 100;
export const SHORT_GUIDE_EDGE = 6;
/** Short shrinks the brand to its mark when the stage beside the guide is narrower than this. */
export const SHORT_BRAND_MIN_STAGE = 600;

/** Portrait (a phone held upright): the band, the player's bottom, the strip, the folded guide. */
export const PORTRAIT_BAND_H = 68;
export const PORTRAIT_PLAYER_BOTTOM = 132;
export const PORTRAIT_STRIP_H = 150;
export const PORTRAIT_PEEK_GUIDE_H = 100;
/** The guide is at least this tall, and leaves the stage window at least this much. */
const PORTRAIT_MIN_GUIDE = 240;
const PORTRAIT_MIN_STAGE = 230;

/** What a showing caption adds to the covered bottom, in design px. */
export const CAPTION_PX = 52;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The layout for a viewport. `w < 0.95 h` is portrait; otherwise `n` is how much of the
 * 1728 × 996 canvas fits, and `n ≥ 0.7` is wide (scaled by `n`). Smaller landscape screens are
 * short (under 540 px tall: no rail, the guide down the right) or compact (a narrower guide).
 */
export function layoutFor(widthPx: number, heightPx: number): LayoutInfo {
  const w = Math.max(1, widthPx);
  const h = Math.max(1, heightPx);
  if (w < h * 0.95) {
    const ui = clamp(w / 430, 0.72, 1.1);
    const lh = h / ui;
    // The guide takes 42% of the height (280 to 560 design px), but leaves the stage window 230
    // between the player row and the strip, and never drops below 240.
    const wanted = clamp(lh * 0.42, 280, 560);
    const room = lh - PORTRAIT_PLAYER_BOTTOM - PORTRAIT_MIN_STAGE - PORTRAIT_STRIP_H;
    const guideH = Math.max(PORTRAIT_MIN_GUIDE, Math.min(wanted, room));
    return {
      mode: "portrait",
      ui,
      lw: w / ui,
      lh,
      sceneBottom: lh - guideH - PORTRAIT_STRIP_H,
    };
  }
  const n = Math.min(w / DESIGN_W, h / DESIGN_H);
  if (n >= 0.7) return { mode: "wide", ui: n, lw: w / n, lh: h / n, guideW: WIDE_GUIDE_W };
  if (h < 540) {
    const ui = clamp(h / 430, 0.72, 1.15);
    const lw = w / ui;
    return { mode: "short", ui, lw, lh: h / ui, guideW: clamp(lw * 0.4, 320, 420) };
  }
  const ui = clamp(Math.min(w / COMPACT_DESIGN_W, h / COMPACT_DESIGN_H), 0.5, 0.9);
  return { mode: "compact", ui, lw: w / ui, lh: h / ui, guideW: COMPACT_GUIDE_W };
}

/**
 * The part of the canvas the cards cover, in CSS px, for LookCamera's `covered`. Canvas-local:
 * the canvas is the shell minus the rail column, so `left` is always 0. Wide and compact cover
 * the guide on the right, the status card on top and the strip below; short the guide, the
 * player and a thinner strip; portrait the band and player row on top and the strip and guide
 * below (a folded guide leaves more stage).
 */
export function coveredFor(l: LayoutInfo, o: CoveredOptions = {}): Covered {
  const caption = o.caption ? CAPTION_PX : 0;
  const u = l.ui;
  switch (l.mode) {
    case "wide":
      return {
        left: 0,
        right: (WIDE_GUIDE_W + WIDE_GUIDE_EDGE) * u,
        top: STATUS_BOTTOM * u,
        bottom: (STRIP_H + caption) * u,
      };
    case "compact":
      return {
        left: 0,
        right: (COMPACT_GUIDE_W + COMPACT_GUIDE_EDGE) * u,
        top: STATUS_BOTTOM * u,
        bottom: (STRIP_H + caption) * u,
      };
    case "short":
      return {
        left: 0,
        right: ((l.guideW ?? 320) + SHORT_GUIDE_EDGE) * u,
        top: SHORT_PLAYER_BOTTOM * u,
        bottom: (SHORT_STRIP_H + caption) * u,
      };
    case "portrait": {
      const open = l.lh - (l.sceneBottom ?? l.lh - PORTRAIT_STRIP_H - PORTRAIT_MIN_GUIDE);
      const below = o.guide === "peek" ? PORTRAIT_PEEK_GUIDE_H + PORTRAIT_STRIP_H : open;
      return { left: 0, right: 0, top: PORTRAIT_PLAYER_BOTTOM * u, bottom: (below + caption) * u };
    }
  }
}
