import type { OhmsLawBench } from "../types";

// Taking a lead off, made easy to find (docs/plans/wave-2-lean.md, 2b; the user, PR #100: "can it
// be clear?"). A mouse that hovers a lead highlights the whole cable and shows a "Remove" chip at
// its middle; a click on the cable or the chip takes it off. A finger has no hover, so its first
// tap selects the lead (the same highlight and chip) and a second tap on the cable or the chip
// takes it off: one tap never removes a lead she only meant to look at. A lead the guide calls
// wrong (a short circuit) is selected for her at once, so taking it off is a single tap. The
// first lead she makes shows "Tap a wire to remove it" there for a few seconds, once.

/** What the bench's leads show and which one a tap acts on. One per page, mutated in place. */
export interface LeadPicks {
  /** The lead under the mouse, or null. */
  hover: string | null;
  /** performance.now() seconds when the mouse left a lead (the chip lingers so it can be reached). */
  hoverOutS: number;
  /** The mouse is over the Remove chip. */
  overChip: boolean;
  /** The last lead the chip was shown for while hovering, kept while the mouse moves onto it. */
  lastHover: string | null;
  /** The lead a finger selected (or the guide selected after a wrong lead), or null. */
  selected: string | null;
  /** The one-time hint on her first lead: which lead, and until when (performance.now seconds). */
  hint: { id: string; untilS: number } | null;
  /** The hint has been shown on this page. */
  hinted: boolean;
}

export function createLeadPicks(): LeadPicks {
  return {
    hover: null,
    hoverOutS: Number.NEGATIVE_INFINITY,
    overChip: false,
    lastHover: null,
    selected: null,
    hint: null,
    hinted: false,
  };
}

/** How long the Remove chip stays after the mouse leaves the cable, so it can reach the chip. */
export const CHIP_LINGER_S = 0.8;
/** How long the first-lead hint shows. */
export const HINT_S = 4;
export const HINT_TEXT = "Tap a wire to remove it";
export const REMOVE_TEXT = "Remove";

/** What a tap on lead `id` does: a mouse or pen removes; a finger selects first. */
export function leadTapAction(
  p: Pick<LeadPicks, "selected">,
  id: string,
  pointerType: string | undefined,
): "remove" | "select" {
  if (pointerType !== "touch") return "remove";
  return p.selected === id ? "remove" : "select";
}

/** Clears every mark on lead `id` (it has gone). */
export function forgetLead(p: LeadPicks, id: string): void {
  if (p.hover === id) p.hover = null;
  if (p.lastHover === id) p.lastHover = null;
  if (p.selected === id) p.selected = null;
  if (p.hint?.id === id) p.hint = null;
}

/** A tap on lead `id`: removes it from the bench, or selects it (a finger's first tap). */
export function tapLead(
  bench: Pick<OhmsLawBench, "removeLead">,
  p: LeadPicks,
  id: string,
  pointerType: string | undefined,
): "remove" | "select" {
  const action = leadTapAction(p, id, pointerType);
  if (action === "remove") {
    forgetLead(p, id);
    bench.removeLead(id);
  } else {
    p.selected = id;
    p.hint = null;
  }
  return action;
}

/** The mouse entered or left lead `id`'s cable. */
export function hoverLead(p: LeadPicks, id: string, on: boolean, nowS: number): void {
  if (on) {
    p.hover = id;
    p.lastHover = id;
  } else if (p.hover === id) {
    p.hover = null;
    p.hoverOutS = nowS;
  }
}

/** True when lead `id`'s cable is drawn highlighted. */
export function leadLit(p: LeadPicks, id: string, nowS: number): boolean {
  const t = chipTarget(p, nowS);
  return t !== null && t.id === id && t.label === REMOVE_TEXT;
}

/** Which lead the chip sits on now, with its words and whether a tap on it removes the lead. */
export function chipTarget(
  p: LeadPicks,
  nowS: number,
): { id: string; label: string; removes: boolean } | null {
  if (p.hover) return { id: p.hover, label: REMOVE_TEXT, removes: true };
  if (p.lastHover && (p.overChip || nowS - p.hoverOutS < CHIP_LINGER_S)) {
    return { id: p.lastHover, label: REMOVE_TEXT, removes: true };
  }
  if (p.selected) return { id: p.selected, label: REMOVE_TEXT, removes: true };
  if (p.hint && nowS < p.hint.untilS) return { id: p.hint.id, label: HINT_TEXT, removes: false };
  return null;
}

/** Her first lead on this page: show the hint on it, once. */
export function hintFirstLead(p: LeadPicks, id: string, nowS: number): void {
  if (p.hinted) return;
  p.hinted = true;
  p.hint = { id, untilS: nowS + HINT_S };
}
