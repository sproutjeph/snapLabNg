import type { OhmsLawRecord } from "@snaplab/contracts";
import { DT_S } from "@snaplab/engine";
import { emptyOhmsLawRecord } from "../readings/record";
import type { OhmsLawBench, TerminalId } from "../types";
import type { VoiceGuide } from "../voice/types";
import {
  drawBestFitLine,
  drawTriangle,
  plotRow,
  plugMoves,
  readTriangle,
  writeField,
} from "./actor";
import {
  actDurationS,
  BASE_RATE,
  BEAT_GAP_S,
  KEY_TOGGLE_AT,
  LEAD_TAP_AT,
  NIB_TRAVEL_S,
  PLUG_EACH_S,
  PRACTISE_GAP_S,
  QUIET_S,
  READING_WAIT_CAP_S,
  voiceCapS,
} from "./timing";
import type {
  ActorAction,
  Director,
  DirectorOptions,
  DirectorState,
  RecordField,
  ValueSource,
} from "./types";

// The director (docs/plans/exam-redesign.md, "Architecture: one script drives all three modes").
// A renderer-free state machine: it reads the script, speaks through the voice, and in Watch
// performs each beat's action on the demonstration bench through the same public bench API a
// student uses. No React, no three.js, no timers of its own: time arrives through advance().
//
// Who steps the bench: the page does, every frame (BenchWiring), in every mode. The director
// never advances the bench's clock while playing; it only waits for it. The one exception is a
// seek, which settles the engine headless (below) because it replays many beats at once.
//
// Where the numbers in Watch come from: meter readings from the demonstration bench's
// supervisor (only Watch's DirectorOptions carries one; her bench's type has none), the length
// from the metre rule, and everything else from the script's own text. Nothing from a
// Practise or Exam bench is read here, and `supervisor` is never named on those paths.

/** Something the actor did to the bench that the page may want a sound for. */
export type DirectorEvent =
  | { kind: "enter" }
  | { kind: "lead"; from: TerminalId; to: TerminalId }
  | { kind: "plug" }
  | { kind: "key" }
  | { kind: "write" }
  | { kind: "plot" };

/**
 * What createDirector returns: the frozen Director, plus what the player and the page read.
 * `state` is one object updated in place and `subscribe` fires on discrete changes (a new beat,
 * play or pause, a hint, a written value). Per-frame values (`actT`) change without a
 * notification: read them inside useFrame or requestAnimationFrame, never into React state.
 */
export interface DirectorHandle extends Director {
  readonly script: DirectorOptions["script"];
  readonly voice: VoiceGuide;
  /** How far through the current beat, 0..1, for a progress bar. */
  beatProgress(): number;
  /** The actor's events (a lead made, a plug moved, the key, a page written), for sound. */
  onEvent(fn: (e: DirectorEvent) => void): () => void;
}

/** Practise: seconds with no bench activity before the voice repeats the instruction. */
export const HINT_REPEAT_S = 20;
/** Practise: seconds with no bench activity before the target is highlighted. */
export const HINT_HIGHLIGHT_S = 40;
/** Previous restarts the current beat when it has run longer than this. */
export const PREV_RESTART_S = 1.5;

const SPEEDS = [1, 1.5, 2] as const;
/** The fastest the voice is asked to go: above this, voices garble. */
const MAX_VOICE_RATE = 2;
/** Headless settling steps the bench in chunks of this many seconds (12 engine steps each). */
const SETTLE_CHUNK_S = 12 * DT_S;

type Meter = "ammeter" | "voltmeter";

/** The runtime of the action being performed (Watch, or Show me in Practise). */
interface ActRun {
  act: ActorAction;
  beat: number;
  durS: number;
  elapsedS: number;
  /** A meter reading the actor is waiting to be able to take before it starts to write. */
  pendingMeter: Meter | null;
  waitedS: number;
  /** Bench changes still to make, with the share of the action at which each happens. */
  steps: Array<{ at: number; run: () => void }>;
  next: number;
}

/** What is going on in the current beat. */
interface Run {
  started: boolean;
  elapsedS: number;
  voiceDone: boolean;
  voiceElapsedS: number;
  voiceCapS: number;
  token: number;
  ar: ActRun | null;
  actDone: boolean;
  gapS: number;
  /** Practise: seconds since she last touched the bench. */
  idleS: number;
  /** Practise: seconds since her action was done (null while it is not). */
  doneS: number | null;
  shown: boolean;
}

const freshRun = (token: number): Run => ({
  started: false,
  elapsedS: 0,
  voiceDone: true,
  voiceElapsedS: 0,
  voiceCapS: 0,
  token,
  ar: null,
  actDone: true,
  gapS: 0,
  idleS: 0,
  doneS: null,
  shown: false,
});

const isMeter = (src: ValueSource): src is { from: Meter } =>
  "from" in src && (src.from === "ammeter" || src.from === "voltmeter");

export function createDirector(opts: DirectorOptions): DirectorHandle {
  const { script, voice, mode } = opts;
  const beats = script.beats;
  /** What every mode may touch. */
  const bench: Omit<OhmsLawBench, "supervisor"> = opts.bench;
  /** The demonstration bench's own truth: Watch only. In Practise and Exam this stays null. */
  const sup = opts.mode === "watch" ? opts.bench.supervisor : null;
  const baseRate = voice.rate || BASE_RATE;

  const captionFor = (i: number): string => {
    const b = beats[i];
    if (!b || mode === "exam") return "";
    return mode === "watch" ? b.say : b.instruct;
  };

  const state: DirectorState = {
    mode,
    beat: 0,
    playing: false,
    speed: 1,
    caption: captionFor(0),
    waiting: false,
    hint: 0,
    finished: false,
    act: null,
    actT: 0,
    loupe: null,
  };

  let record: OhmsLawRecord = emptyOhmsLawRecord("practice");
  let tokenCounter = 0;
  let run = freshRun(0);
  let disposed = false;
  /** Seconds the bench has been left alone, for the needle to settle before a reading. */
  let sinceChangeS = 0;
  /**
   * The text each meter-writing beat wrote the first time it ran. The dial is not a function of
   * the circuit alone: the cells polarise (time constant 300 s at 0.5 A, params.ts) and the wire
   * warms, so the same beat read a second time, or after a seek that settles the bench in two
   * seconds, would read a hundredth or two differently. The notebook keeps the reading it first
   * wrote, so scrubbing back and forth never changes a number she has seen.
   */
  const written = new Map<number, string>();
  const listeners = new Set<() => void>();
  const eventListeners = new Set<(e: DirectorEvent) => void>();

  const notify = () => {
    for (const fn of [...listeners]) fn();
  };
  const emit = (e: DirectorEvent) => {
    for (const fn of [...eventListeners]) fn(e);
  };

  const unsubscribeBench = bench.subscribe(() => {
    sinceChangeS = 0;
    run.idleS = 0;
  });

  // ---- Settling the bench headless (seek, and a reading that will not come) ----

  function settleHeadless(): void {
    for (let t = 0; t < QUIET_S + 0.5; t += SETTLE_CHUNK_S) bench.advance(SETTLE_CHUNK_S);
    sinceChangeS = QUIET_S + 0.5;
  }

  const readMeter = (meter: Meter): string | null => sup?.reading(meter) ?? null;

  /** The text an action writes, or null when it has nothing to write (yet). */
  function textFor(field: RecordField, src: ValueSource): string | null {
    if ("text" in src) return src.text;
    if (isMeter(src)) return readMeter(src.from);
    // "rule": the metre rule for the length, her own triangle for ΔV, ΔI and s.
    if (field.kind === "length") return sup ? `${sup.lengthText()} cm` : null;
    if (field.kind === "graph") {
      if (field.part === "deltaY" || field.part === "deltaX" || field.part === "slope") {
        return readTriangle(record, field.part);
      }
    }
    return null;
  }

  // ---- Doing an action's effect on the bench and the record ----

  const coils = (): readonly number[] => bench.params.boxCoilsOhm;

  /** The steps (bench changes) of an action, each with the share of the action at which it happens. */
  function benchSteps(act: ActorAction, announce: boolean): Array<{ at: number; run: () => void }> {
    if (act.kind === "lead") {
      const [first, second] = LEAD_TAP_AT;
      return [
        { at: first, run: () => bench.tapTerminal(act.from) },
        {
          at: second,
          run: () => {
            bench.tapTerminal(act.to);
            if (announce) emit({ kind: "lead", from: act.from, to: act.to });
          },
        },
      ];
    }
    if (act.kind === "plug") {
      const moves = plugMoves(coils(), bench.visual.current.plugsIn, act.ohm);
      const durS = actDurationS(act, moves.length);
      return moves.map((index, i) => ({
        at: (NIB_TRAVEL_S + PLUG_EACH_S * (i + 0.5)) / durS,
        run: () => {
          bench.togglePlug(index);
          if (announce) emit({ kind: "plug" });
        },
      }));
    }
    if (act.kind === "key") {
      return [
        {
          at: KEY_TOGGLE_AT,
          run: () => {
            if (bench.visual.current.keyClosed !== act.closed) {
              bench.toggleKey();
              if (announce) emit({ kind: "key" });
            }
          },
        },
      ];
    }
    return [];
  }

  /** Writes, plots or draws on the demonstration record. */
  function commitRecord(act: ActorAction, text: string | null): boolean {
    switch (act.kind) {
      case "write": {
        if (text === null) return false;
        record = writeField(record, act.field, text);
        emit({ kind: "write" });
        return true;
      }
      case "plot":
        record = plotRow(record, act.row);
        emit({ kind: "plot" });
        return true;
      case "line":
        record = drawBestFitLine(record);
        return true;
      case "triangle":
        record = drawTriangle(record);
        return true;
      default:
        return false;
    }
  }

  /** The record's actions belong to Watch's demonstration notebook only. */
  const recordAction = (act: ActorAction) =>
    act.kind === "write" || act.kind === "plot" || act.kind === "line" || act.kind === "triangle";

  /** Applies an action completely and at once (seek). */
  function applyInstant(act: ActorAction | undefined, beat: number): void {
    if (!act) return;
    if (act.kind === "loupe") {
      state.loupe = act.target;
      return;
    }
    if (act.kind === "write") {
      let text = isMeter(act.value) ? (written.get(beat) ?? null) : textFor(act.field, act.value);
      if (text === null && isMeter(act.value)) {
        // The dial, once the bench has been left alone long enough for the needle to settle.
        if (sinceChangeS < QUIET_S) settleHeadless();
        for (let tries = 0; tries < 3 && text === null; tries++) {
          text = textFor(act.field, act.value);
          if (text === null) settleHeadless();
        }
        if (text !== null) written.set(beat, text);
      }
      commitRecord(act, text);
      return;
    }
    if (recordAction(act)) {
      commitRecord(act, null);
      return;
    }
    for (const step of benchSteps(act, false)) step.run();
  }

  // ---- Beats ----

  function speakBeat(text: string): void {
    const myToken = run.token;
    run.voiceDone = false;
    run.voiceElapsedS = 0;
    run.voiceCapS = voiceCapS(text);
    if (text.trim() === "") {
      run.voiceDone = true;
      return;
    }
    voice.say(text, {
      onEnd: () => {
        if (run.token === myToken) run.voiceDone = true;
      },
    });
  }

  /** Starts the action of the current beat live. */
  function beginAct(act: ActorAction, beat: number): void {
    const ar: ActRun = {
      act,
      beat,
      durS: 0,
      elapsedS: 0,
      pendingMeter: null,
      waitedS: 0,
      steps: [],
      next: 0,
    };
    run.ar = ar;
    run.actDone = false;
    state.act = act;
    state.actT = 0;
    if (act.kind === "enter") emit({ kind: "enter" });
    if (act.kind === "loupe") state.loupe = act.target;
    if (act.kind === "write") {
      if (isMeter(act.value) && sup && !written.has(beat)) {
        // Wait for the needle: write nothing until the bench has been left alone and the dial reads.
        ar.pendingMeter = act.value.from;
        notify();
        return;
      }
      commitWrite(ar, act);
      notify();
      return;
    }
    if (recordAction(act)) {
      commitRecord(act, null);
      ar.durS = actDurationS(act);
      notify();
      return;
    }
    ar.steps = benchSteps(act, true);
    ar.durS = actDurationS(act, ar.steps.length);
    notify();
  }

  function commitWrite(ar: ActRun, act: Extract<ActorAction, { kind: "write" }>): void {
    const text = isMeter(act.value)
      ? (written.get(ar.beat) ?? textFor(act.field, act.value))
      : textFor(act.field, act.value);
    if (text !== null && isMeter(act.value)) written.set(ar.beat, text);
    const wrote = commitRecord(act, text);
    ar.durS = wrote ? actDurationS(act, 1, text?.length ?? 0) : 0;
  }

  function finishAct(ar: ActRun): void {
    while (ar.next < ar.steps.length) ar.steps[ar.next++]?.run();
    state.actT = 1;
    run.actDone = true;
    notify();
  }

  function stepAct(ar: ActRun, dtRealS: number, dtBeatS: number): void {
    if (ar.pendingMeter && ar.act.kind === "write") {
      ar.waitedS += dtRealS;
      const ready = sinceChangeS >= QUIET_S && readMeter(ar.pendingMeter) !== null;
      if (!ready && ar.waitedS < READING_WAIT_CAP_S) return;
      if (!ready) settleHeadless();
      ar.pendingMeter = null;
      commitWrite(ar, ar.act);
      notify();
      return;
    }
    ar.elapsedS += dtBeatS;
    const t = ar.durS <= 0 ? 1 : Math.min(1, ar.elapsedS / ar.durS);
    state.actT = t;
    while (ar.next < ar.steps.length && (ar.steps[ar.next]?.at ?? 2) <= t)
      ar.steps[ar.next++]?.run();
    if (t >= 1) finishAct(ar);
  }

  function finish(): void {
    state.finished = true;
    state.playing = false;
    state.waiting = false;
    voice.stop();
    notify();
  }

  function startBeat(i: number): void {
    if (voice.speaking) voice.stop();
    run = freshRun(++tokenCounter);
    const b = beats[i];
    if (!b) {
      finish();
      return;
    }
    run.started = true;
    state.beat = i;
    state.caption = captionFor(i);
    state.act = null;
    state.actT = 0;
    state.hint = 0;
    state.waiting = false;
    if (mode === "watch") {
      speakBeat(b.say);
      if (b.act) beginAct(b.act, i);
    } else if (mode === "practice") {
      speakBeat(b.instruct);
      if (b.done) {
        if (b.done(opts.benchState())) run.doneS = 0;
        else state.waiting = true;
      }
    }
    notify();
  }

  function completeBeat(): void {
    const next = state.beat + 1;
    if (next >= beats.length) finish();
    else startBeat(next);
  }

  /** Watch: back to a bare bench and notebook. */
  function resetDemo(): void {
    bench.reset();
    record = emptyOhmsLawRecord("practice");
    state.loupe = null;
  }

  function goTo(n: number): void {
    const last = beats.length - 1;
    if (last < 0) return;
    const i = Math.min(last, Math.max(0, Math.trunc(n)));
    voice.stop();
    if (mode === "watch") {
      resetDemo();
      for (let k = 0; k < i; k++) applyInstant(beats[k]?.act, k);
    }
    state.finished = false;
    state.beat = i;
    state.caption = captionFor(i);
    state.act = null;
    state.actT = 0;
    state.hint = 0;
    state.waiting = false;
    run = freshRun(++tokenCounter);
    if (state.playing) startBeat(i);
    else notify();
  }

  // ---- Per-frame ----

  function stepWatch(dtRealS: number, dtBeatS: number): void {
    if (!run.voiceDone) {
      run.voiceElapsedS += dtBeatS;
      // Never wait on onend alone: past the estimate, the voice is done whatever the browser says.
      if (run.voiceElapsedS >= run.voiceCapS) run.voiceDone = true;
    }
    if (run.ar && !run.actDone) stepAct(run.ar, dtRealS, dtBeatS);
    if (run.voiceDone && run.actDone) {
      run.gapS += dtBeatS;
      if (run.gapS >= BEAT_GAP_S) completeBeat();
    }
  }

  function stepPractice(dtS: number): void {
    const b = beats[state.beat];
    if (!b) return;
    if (!run.voiceDone) {
      run.voiceElapsedS += dtS;
      if (run.voiceElapsedS >= run.voiceCapS) run.voiceDone = true;
    }
    if (run.ar && !run.actDone) stepAct(run.ar, dtS, dtS);
    if (!b.done) {
      // Narration only: say it, then go on.
      if (run.voiceDone) {
        run.gapS += dtS;
        if (run.gapS >= BEAT_GAP_S) completeBeat();
      }
      return;
    }
    if (run.doneS === null) {
      if (b.done(opts.benchState())) {
        run.doneS = 0;
        state.waiting = false;
        notify();
      } else {
        run.idleS += dtS;
        if (run.idleS >= HINT_REPEAT_S && state.hint < 1) {
          state.hint = 1;
          voice.say(b.instruct);
          notify();
        }
        if (run.idleS >= HINT_HIGHLIGHT_S && state.hint < 2) {
          state.hint = 2;
          notify();
        }
      }
      return;
    }
    run.doneS += dtS;
    if (run.doneS >= PRACTISE_GAP_S && run.actDone) completeBeat();
  }

  const handle: DirectorHandle = {
    state,
    script,
    voice,
    get demoRecord() {
      return record;
    },

    play() {
      if (disposed || mode === "exam") return;
      if (state.finished) {
        state.playing = true;
        goTo(0);
        notify();
        return;
      }
      state.playing = true;
      if (!run.started) startBeat(state.beat);
      else if (!run.voiceDone) speakBeat(captionFor(state.beat));
      notify();
    },

    pause() {
      if (disposed || mode === "exam" || !state.playing) return;
      state.playing = false;
      voice.stop();
      notify();
    },

    next() {
      if (disposed || mode === "exam") return;
      const last = beats.length - 1;
      if (state.beat >= last) {
        if (mode === "watch") {
          // Skip to the end: the bench and notebook as they are when the last beat is done.
          const wasPlaying = state.playing;
          state.playing = false;
          goTo(last);
          applyInstant(beats[last]?.act, last);
          state.playing = wasPlaying;
        }
        finish();
        return;
      }
      goTo(state.beat + 1);
    },

    prev() {
      if (disposed || mode === "exam") return;
      goTo(run.started && run.elapsedS > PREV_RESTART_S ? state.beat : state.beat - 1);
    },

    seek(beat) {
      if (disposed || mode === "exam") return;
      goTo(beat);
    },

    setSpeed(s) {
      if (disposed || mode !== "watch" || !SPEEDS.includes(s)) return;
      state.speed = s;
      voice.rate = Math.min(MAX_VOICE_RATE, baseRate * s);
      notify();
    },

    showMe() {
      if (disposed || mode !== "practice" || !state.playing || state.finished) return;
      const b = beats[state.beat];
      const act = b?.act;
      // Setup actions only (leads, plugs, the key), once per beat; never a reading or the graph.
      if (!b?.showMe || !act || run.shown) return;
      if (act.kind !== "lead" && act.kind !== "plug" && act.kind !== "key") return;
      run.shown = true;
      state.hint = 3;
      beginAct(act, state.beat);
    },

    advance(dtS) {
      if (disposed || mode === "exam" || !(dtS > 0)) return;
      sinceChangeS += dtS;
      if (!state.playing || state.finished || !run.started) return;
      run.elapsedS += dtS * state.speed;
      if (mode === "watch") stepWatch(dtS, dtS * state.speed);
      else stepPractice(dtS);
    },

    beatProgress() {
      if (!run.started) return 0;
      if (run.voiceDone && run.actDone) return 1;
      const expected = Math.max(run.voiceCapS, run.ar?.durS ?? 0, 0.5);
      return Math.min(0.99, run.elapsedS / expected);
    },

    onEvent(fn) {
      eventListeners.add(fn);
      return () => {
        eventListeners.delete(fn);
      };
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      state.playing = false;
      voice.stop();
      voice.rate = baseRate;
      unsubscribeBench();
      listeners.clear();
      eventListeners.clear();
    },
  };
  return handle;
}
