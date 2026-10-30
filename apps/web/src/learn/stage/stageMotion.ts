import type { NibTarget } from "../../apparatus/ohms-law/PenNib";
import type { CalloutSpec } from "../callouts/types";
import type { DirectorHandle } from "../script/createDirector";
import type { Beat, DirectorState } from "../script/types";
import type { TerminalId } from "../types";
import { createLeadPicks, type LeadPicks } from "../wiring/leadPick";
import { DROP_HEIGHT_M, type DropPose, type DropSlot, dropFrom, dropStartS } from "./motion";

// What the stage's choreographer (Choreo.tsx) writes each frame and the parts read in their own
// useFrame: one plain object, made once per page and mutated in place, so nothing re-renders
// React per frame (.claude/rules/web-3d.md).

/** The callout chip's sink: the DOM chip (StageChip.tsx) registers it; Choreo calls it. */
/** The lead's Remove chip (LeadRemove.tsx): where, its words, whether it removes, and which lead. */
export type RemoveSink = (
  x: number,
  y: number,
  label: string,
  removes: boolean,
  id: string | null,
) => void;

export type ChipSink = (
  x: number,
  y: number,
  label: string,
  visible: boolean,
  settled: boolean,
) => void;

export interface StageMotion {
  /** Each part's drop: height above its place, and k (0 = not on the bench yet, 1 = landed). */
  parts: Record<DropSlot, DropPose>;
  /** The lead the actor is drawing (Watch, or Show me), with how much of it is drawn. */
  lead: { from: TerminalId | null; to: TerminalId | null; drawn: number };
  /** The pen nib: where it points, its tap counter, and the playback speed. */
  nib: { target: NibTarget; tap: number; rate: number };
  /** Rings on the beat's two terminals, the nut under the pointer, and nuts shaking. */
  marks: {
    targets: TerminalId[];
    hover: TerminalId | null;
    shake: TerminalId[];
    /** performance.now() in seconds when the shake began. */
    shakeAtS: number;
  };
  /** Keep the demand loop rendering (a beat plays, a ring pulses, the chip springs). */
  busy: boolean;
  /** Something that casts a shadow is moving: re-render the shadow map. */
  moving: boolean;
  /** Bumped by every seek, previous, next and replay: the stage restarts the beat's clock. */
  epoch: number;
  chip: ChipSink | null;
  /**
   * Dev only (shots): pause the director once this many beat seconds of the current beat have
   * played (`&freeze=`), so a screenshot shows one moment of a beat, whatever the frame rate.
   */
  freezeAtS: number | null;
  /** Which lead is hovered or selected for removal, and the first-lead hint (wiring/leadPick.ts). */
  leads: LeadPicks;
  remove: RemoveSink | null;
  /** The parts landing while the question paper is open (Entrance, below). */
  entrance: Entrance;
}

/**
 * The entrance under the question paper (docs/plans/integration.md, I1). While the paper is open
 * the entrance, not the director, places the parts: each drops as "Read it to me" names it, or,
 * when nothing is reading aloud (speech unavailable, muted, or the reading stopped early), on the
 * timed drop (0.9 s, then one part every 0.1 s).
 */
export interface Entrance {
  /** The paper is open. */
  on: boolean;
  /** Seconds since the paper opened (real time). */
  t: number;
  /** A reading aloud is naming the parts: a part not named yet waits above the bench. */
  byVoice: boolean;
  /** Entrance seconds at which each part was named. */
  namedAtS: Partial<Record<DropSlot, number>>;
  /** Entrance seconds the timed drop counts from (a stopped reading restarts it). */
  timedFromS: number;
  /** Every part is down: the first Watch after the paper starts with the bench full. */
  landed: boolean;
}

const DROP_SLOTS: readonly DropSlot[] = ["cells", "key", "ammeter", "voltmeter", "box", "wire"];

export { DROP_SLOTS };

const isDropSlot = (p: string): p is DropSlot => (DROP_SLOTS as readonly string[]).includes(p);

export function createEntrance(): Entrance {
  return { on: false, t: 0, byVoice: false, namedAtS: {}, timedFromS: 0, landed: false };
}

/** A reading aloud began: with speech that can be heard, the parts wait to be named. */
export function entranceReading(e: Entrance, audible: boolean): void {
  if (!e.on) return;
  e.byVoice = audible;
}

/** The reading stopped: the parts not named yet drop on the timed drop, from now. */
export function entranceStopped(e: Entrance): void {
  if (!e.on || !e.byVoice) return;
  e.byVoice = false;
  e.timedFromS = e.t;
}

/** The reader named `part`: it drops now (once). Returns whether it starts a drop. */
export function entranceNamed(e: Entrance, part: string): boolean {
  if (!e.on || !e.byVoice || !isDropSlot(part) || e.namedAtS[part] !== undefined) return false;
  e.namedAtS[part] = e.t;
  return true;
}

/**
 * One frame of the entrance: advances its clock by `dtS` and writes each part's drop. `order` is
 * the timed drop's order (lowest on screen first). Returns whether a part is mid-drop.
 */
export function entranceFrame(
  e: Entrance,
  order: readonly DropSlot[],
  dtS: number,
  parts: Record<DropSlot, DropPose>,
): boolean {
  e.t += dtS;
  let dropping = false;
  let down = 0;
  for (let i = 0; i < order.length; i++) {
    const slot = order[i];
    if (!slot) continue;
    const pose = parts[slot];
    const named = e.namedAtS[slot];
    if (named !== undefined) dropFrom(e.t, named, pose);
    else if (e.byVoice) {
      pose.heightM = DROP_HEIGHT_M;
      pose.k = 0;
    } else dropFrom(e.t, e.timedFromS + dropStartS(i), pose);
    if (pose.k > 0 && pose.k < 1) dropping = true;
    if (pose.k >= 1) down++;
  }
  e.landed = down === order.length;
  return dropping;
}

export function createStageMotion(): StageMotion {
  const parts = {} as Record<DropSlot, DropPose>;
  for (const s of DROP_SLOTS) parts[s] = { heightM: 0, k: 1 };
  return {
    parts,
    lead: { from: null, to: null, drawn: 1 },
    nib: { target: null, tap: 0, rate: 1 },
    marks: { targets: [], hover: null, shake: [], shakeAtS: -1 },
    busy: false,
    moving: false,
    epoch: 0,
    chip: null,
    freezeAtS: null,
    leads: createLeadPicks(),
    remove: null,
    entrance: createEntrance(),
  };
}

/**
 * Makes every jump of the director (seek, previous, next, a replay from the end) bump
 * `m.epoch`, so the stage restarts the beat's own clock even when the beat number stays the same
 * (a restart from the first beat replays the entrance). Wraps the handle's methods in place.
 */
export function trackEpoch(
  d: Pick<DirectorHandle, "seek" | "prev" | "next" | "play" | "state">,
  m: Pick<StageMotion, "epoch">,
): void {
  const { seek, prev, next, play } = d;
  d.seek = (beat) => {
    m.epoch++;
    seek(beat);
  };
  d.prev = () => {
    m.epoch++;
    prev();
  };
  d.next = () => {
    m.epoch++;
    next();
  };
  d.play = () => {
    if (d.state.finished) m.epoch++;
    play();
  };
}

/**
 * Whether the demand loop must keep rendering. A director that plays (Watch or Practise) needs
 * every frame: its clock only runs in advance(), so a Practise narration beat, its hold and the
 * hint ladder's idle clock would stall while the loop rests. Rings pulse, the chip springs, and
 * parts move; Exam's director never plays.
 */
export function stageBusy(
  s: Pick<DirectorState, "mode" | "playing" | "finished">,
  rings: number,
  chipSpringing: boolean,
  moving: boolean,
): boolean {
  return (s.mode !== "exam" && s.playing && !s.finished) || rings > 0 || chipSpringing || moving;
}

/**
 * The chip for beat `i`: its own first callout, or else the last one before it in the same
 * stage, or none. From the script alone, so a seek lands on the chip playing would show.
 */
export function chipSpecAt(beats: readonly Beat[], i: number): CalloutSpec | null {
  const stage = beats[i]?.stage;
  for (let j = i; j >= 0; j--) {
    const b = beats[j];
    if (!b || b.stage !== stage) return null;
    const spec = b.callouts?.[0];
    if (spec) return spec;
  }
  return null;
}

/** Hides every part above its place (Watch, before the entrance). */
export function clearBench(m: StageMotion): void {
  for (const s of DROP_SLOTS) {
    m.parts[s].heightM = DROP_HEIGHT_M;
    m.parts[s].k = 0;
  }
}
