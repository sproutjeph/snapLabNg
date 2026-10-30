import type { PartId } from "../types";
import { estimateSpeechS } from "../voice/chunk";
import type { ActorAction, Script } from "./types";

// How long the actor takes over each action, and when inside it things happen. All times are in
// beat seconds at 1x: the director divides real time by the speed. Screen choices, not science:
// tweens are about 0.4 s and staggers 0.1 s (docs/plans/exam-redesign-brief.md, research report 2).

/** A parts' drop and the gap before the next part. */
export const ENTER_DROP_S = 0.4;
export const ENTER_STAGGER_S = 0.1;
/** The pen nib's travel to a terminal, a plug or the key. */
export const NIB_TRAVEL_S = 0.4;
/**
 * A lead: the nib goes to the first terminal and taps, goes to the second and taps, the lead draws
 * itself in over the last 0.6 s. The draw is the one action past the 0.4 s tween cap: a lead
 * crosses the bench, and the eye must follow its path (docs/plans/wave-2-lean.md).
 */
export const LEAD_S = 1.6;
/** Where in a lead's action (0..1) the two taps happen. */
export const LEAD_TAP_AT = [0.22, 0.625] as const;
/** One plug pulled or pushed. */
export const PLUG_EACH_S = 0.5;
export const KEY_S = 0.9;
/** Where in the key's action (0..1) it moves. */
export const KEY_TOGGLE_AT = 0.55;
export const LOUPE_S = 0.5;
/** Handwriting: a base, plus a little for each character, at most MAX. */
export const WRITE_BASE_S = 0.5;
export const WRITE_PER_CHAR_S = 0.05;
export const WRITE_MAX_S = 2.5;
export const PLOT_S = 0.6;
export const LINE_S = 1;
export const TRIANGLE_S = 1.2;
/** The hold after a beat, before the next: BC101 holds every step 1.0 s (docs/plans/wave-2-lean.md). */
export const BEAT_GAP_S = 1;
/** The pause after she finishes a Practise action, before the next instruction. */
export const PRACTISE_GAP_S = 0.7;

/**
 * Seconds the bench must have been left alone before the actor reads a meter. The needle is a
 * damped oscillator (ζ = 0.7, f₀ = 1.5 Hz in the engine): its envelope decays like e^(−ζ·ω·t)
 * with ζ·ω ≈ 6.6 per second, so two seconds leaves under 2 × 10⁻⁶ of the swing, far below the
 * 0.01 of a 2 d.p. reading. The same wait is what a careful candidate gives a needle.
 */
export const QUIET_S = 2;
/** The longest the actor waits for a reading in real time before it settles the bench headless. */
export const READING_WAIT_CAP_S = 8;

/** How long a beat's narration may run before the director stops waiting for the voice. */
export const VOICE_CAP_FACTOR = 1.4;
export const VOICE_CAP_EXTRA_S = 0.8;
/** The voice's own speed with the director at 1x (VoiceGuide.rate's default). */
export const BASE_RATE = 0.95;

/** The longest the voice can take over `text` before the director gives up waiting for onEnd. */
export function voiceCapS(text: string): number {
  const est = estimateSpeechS(text, BASE_RATE);
  return est === 0 ? 0 : est * VOICE_CAP_FACTOR + VOICE_CAP_EXTRA_S;
}

/** How long an action takes. `plugChanges` is how many plugs the action moves. */
export function actDurationS(act: ActorAction, plugChanges = 1, writtenChars = 6): number {
  switch (act.kind) {
    case "enter":
      return ENTER_DROP_S + Math.max(0, act.parts.length - 1) * ENTER_STAGGER_S + 0.2;
    case "lead":
      return LEAD_S;
    case "plug":
      return NIB_TRAVEL_S + PLUG_EACH_S * Math.max(1, plugChanges);
    case "key":
      return KEY_S;
    case "loupe":
      return LOUPE_S;
    case "write":
      return Math.min(WRITE_MAX_S, WRITE_BASE_S + WRITE_PER_CHAR_S * writtenChars);
    case "plot":
      return PLOT_S;
    case "line":
      return LINE_S;
    case "triangle":
      return TRIANGLE_S;
    case "wait":
      return Math.max(0, act.s);
  }
}

/** Where a lead's action has got to, for the pen nib and the draw-on. */
export interface LeadPhase {
  /** Which terminal the nib is heading to or standing on. */
  nibAt: "from" | "to";
  /** Taps done so far: 0, 1 (a lead is pending) or 2 (the lead exists). */
  tapped: 0 | 1 | 2;
  /** How much of the lead is drawn, 0..1. The lead exists on the bench from the second tap. */
  drawn: number;
}

export function leadPhase(actT: number): LeadPhase {
  return leadPhaseInto(actT, { nibAt: "from", tapped: 0, drawn: 0 });
}

/** leadPhase, written into `out` (for a per-frame caller: allocates nothing). */
export function leadPhaseInto(actT: number, out: LeadPhase): LeadPhase {
  const [first, second] = LEAD_TAP_AT;
  if (actT < first) {
    out.nibAt = "from";
    out.tapped = 0;
    out.drawn = 0;
  } else if (actT < second) {
    out.nibAt = "to";
    out.tapped = 1;
    out.drawn = 0;
  } else {
    out.nibAt = "to";
    out.tapped = 2;
    out.drawn = Math.min(1, (actT - second) / (1 - second));
  }
  return out;
}

/**
 * The parts that have landed on the bench before beat `beat` begins, from the script alone. The
 * scene shows exactly these (plus the current beat's `enter` as it drops), so a seek shows the
 * same bench as playing.
 */
export function partsEnteredBefore(script: Script, beat: number): ReadonlySet<PartId> {
  const set = new Set<PartId>();
  for (let i = 0; i < Math.min(beat, script.beats.length); i++) {
    const act = script.beats[i]?.act;
    if (act?.kind === "enter") for (const p of act.parts) set.add(p);
  }
  return set;
}
