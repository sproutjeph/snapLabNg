import type { OhmsLawRecord } from "@snaplab/contracts";
import type { LookShot } from "../../scene/look/types";
import type { CalloutSpec } from "../callouts/types";
import type { BenchState, OhmsLawBench, PartId, PracticalMode, TerminalId } from "../types";
import type { VoiceGuide } from "../voice/types";

// One script drives Watch, Practise and Exam (docs/plans/exam-redesign.md, "Architecture").
// FROZEN for Waves 1–2: slices code against these and never change them; ask the lead.

/** A place in her record the actor writes to. */
export type RecordField =
  | { kind: "length" }
  | { kind: "header"; col: "R" | "I" | "V" }
  | { kind: "cell"; row: number; col: "R" | "I" | "V" }
  | { kind: "precaution"; index: number }
  | { kind: "law" }
  | { kind: "lengthCalc" }
  | {
      kind: "graph";
      part: "axisX" | "axisY" | "scaleX" | "scaleY" | "deltaY" | "deltaX" | "slope";
    };

/** Where a written value comes from: the demo bench's supervisor, or fixed text. */
export type ValueSource = { from: "ammeter" | "voltmeter" | "rule" } | { text: string };

/** What Watch performs, through the same public bench API a student uses. */
export type ActorAction =
  | { kind: "enter"; parts: readonly PartId[] }
  | { kind: "lead"; from: TerminalId; to: TerminalId }
  | { kind: "plug"; ohm: number }
  | { kind: "key"; closed: boolean }
  | { kind: "loupe"; target: "ammeter" | "voltmeter" | "rule" | null }
  | { kind: "write"; field: RecordField; value: ValueSource }
  | { kind: "plot"; row: number }
  | { kind: "line" }
  | { kind: "triangle" }
  | { kind: "wait"; s: number };

export interface Beat {
  id: string;
  /** The Step.key of the question stage this beat belongs to. */
  stage: string;
  /** Watch narration. Never a practice-bench value. */
  say: string;
  /** Practise: the one instruction she hears. */
  instruct: string;
  /** A LookShot.id from the script's shots. */
  shot: string;
  callouts?: readonly CalloutSpec[];
  focus?: readonly PartId[];
  act?: ActorAction;
  /** Practise waits for this. */
  done?: (s: BenchState) => boolean;
  /** Setup actions only: Practise may perform this beat for her once. */
  showMe?: boolean;
}

export interface Script {
  lessonId: "ohms_law_vi";
  shots: readonly LookShot[];
  beats: readonly Beat[];
}

/** Playback speeds. The player offers 1, 1.5 and 2; 4 and 8 are for E2E runs (`e2e=1`). */
export type DirectorSpeed = 1 | 1.5 | 2 | 4 | 8;

export interface DirectorState {
  mode: PracticalMode;
  beat: number;
  playing: boolean;
  speed: DirectorSpeed;
  /** The words on screen: the narration in Watch, the instruction in Practise. */
  caption: string;
  /** Practise: waiting for her to finish the beat's action. */
  waiting: boolean;
  /** Practise: how far up the hint ladder she is on this beat. */
  hint: 0 | 1 | 2 | 3;
  finished: boolean;
  /** Watch: the action being performed now, and its progress 0..1, for the pen nib and tweens. */
  act: ActorAction | null;
  actT: number;
  /** Watch: the loupe the actor has open. */
  loupe: "ammeter" | "voltmeter" | "rule" | null;
}

export interface Director {
  readonly state: DirectorState;
  /** Watch only: the demonstration record the actor fills in. */
  readonly demoRecord: OhmsLawRecord;
  play(): void;
  pause(): void;
  next(): void;
  prev(): void;
  /** Deterministic: resets the bench and applies every earlier beat's action instantly. */
  seek(beat: number): void;
  setSpeed(s: DirectorSpeed): void;
  showMe(): void;
  /** Real time since the last call, from useFrame. */
  advance(dtS: number): void;
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

interface DirectorOptionsBase {
  script: Script;
  voice: VoiceGuide;
  /**
   * What a beat's `done` reads in Practise; the page owns her record and what she identified.
   * Hand back the same `record` object until she edits it, and a new object after each edit: the
   * director counts a new record object as activity, so a fresh object on every call resets the
   * idle clock each frame and the hint ladder never fires.
   */
  benchState: () => BenchState;
}

/**
 * A union on `mode`, so her bench's truth never reaches the director: in Watch the director
 * drives the demonstration bench (seeded with demoSeedFor) and may read its supervisor; in
 * Practise and Exam it only reads her bench, and its type has no `supervisor` to read.
 */
export type DirectorOptions =
  | (DirectorOptionsBase & { mode: "watch"; bench: OhmsLawBench })
  | (DirectorOptionsBase & {
      mode: "practice" | "exam";
      bench: Omit<OhmsLawBench, "supervisor">;
    });
