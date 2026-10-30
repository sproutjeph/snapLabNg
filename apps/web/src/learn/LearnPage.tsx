import type { OhmsLawRecord } from "@snaplab/contracts";
import { DIAGRAM_LEADS, demoSeedFor, TERMINAL_IDS } from "@snaplab/engine";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createLabAudio } from "../audio/labAudio";
import { QualityProvider, useQuality } from "../quality/QualityProvider";
import { e2eOn, installE2E, type SnaplabE2E, speedFrom } from "./e2e";
import { GraphSheet } from "./graph/GraphSheet";
import { OHMS_LAW_LESSON } from "./lessons/ohms-law/lesson";
import { OHMS_LAW_SCRIPT } from "./lessons/ohms-law/script";
import { stepStatuses } from "./marking";
import { OHMS_LAW_QUESTION } from "./paper/ohmsLawQuestion";
import { QuestionPaper } from "./paper/QuestionPaper";
import { Player } from "./player/Player";
import { StageChecklist } from "./player/StageChecklist";
import { MODE_NOTE, playerCovered } from "./player/stages";
import { useStageNav } from "./player/useStageNav";
import { OhmsLawNotebook } from "./readings/OhmsLawNotebook";
import { useParallaxNote } from "./readings/parallax";
import { clampEye, type LoupeTarget, MAX_EYE_DEG, type RuleEnd } from "./readings/poses";
import { addRow, emptyOhmsLawRecord, setCell } from "./readings/record";
import { benchTruthForE2E, handIn } from "./results/handIn";
import { Results } from "./results/Results";
import { checkRows } from "./results/resultsModel";
import type { ResultsProps } from "./results/types";
import { plugMoves } from "./script/actor";
import { createDirector, type DirectorHandle } from "./script/createDirector";
import type { Beat, DirectorOptions } from "./script/types";
import LessonShell, { type GuideState, type PopupId, type ShellTab } from "./shell/LessonShell";
import { creditFromSource } from "./shell/StatusCard";
import { BenchTools } from "./stage/BenchTools";
import { LeadRemove } from "./stage/LeadRemove";
import { Stage } from "./stage/Stage";
import { StageChip } from "./stage/StageChip";
import {
  createStageMotion,
  entranceNamed,
  entranceReading,
  entranceStopped,
  type StageMotion,
  trackEpoch,
} from "./stage/stageMotion";
import type {
  BenchState,
  IdentifyCard,
  LessonMode,
  OhmsLawBench,
  PartId,
  PracticalMode,
  TerminalId,
} from "./types";
import { createVoice } from "./voice/createVoice";
import { createSfx } from "./voice/sfx";
import type { VoiceGuide } from "./voice/types";
import { createOhmsLawBench } from "./wiring/bench";
import { CircuitDiagram } from "./wiring/CircuitDiagram";
import { hintFirstLead } from "./wiring/leadPick";
import { watchWrongTaps } from "./wiring/wrongTap";
import "./learn.css";
import "./results/results.css";

// ?practical=ohms-law and ?learn=ohms-law — the hands-on V–I practical (docs/plans/ohms-law-vi.md;
// docs/plans/wave-2-lean.md, 2b-motion; docs/plans/integration.md, I1). Lead-owned: it only
// composes the slices. The engine decides every number on the bench; the rules mark what she
// typed; nothing here computes science or shows an engine value before she hands in.
//   ?practical=ohms-law with no mode opens on the question paper, in its pop-up over the stage,
//   while the apparatus drops onto the bench; its three choices set the mode (and the URL's
//   `mode`). Hand-in (Practise, Exam) and the end of Watch show the results.
//   &mode=watch|practice|exam   skips the paper. Watch plays the demonstration on its own bench
//                               (demoSeedFor); Practise and Exam are her bench. ?learn= with no
//                               mode is Practise.
//   &seed=N   &step=N (Exam)   &beat=N   &speed=1|1.5|2   &mute=1   &dpr=1–3
//   &e2e=1 (dev) the test hook window.__snaplab (learn/e2e.ts): a silent voice, speed 4 or 8.
//   &play=1 (dev) starts without a tap; &freeze=S (dev) pauses S beat seconds into the beat it
//   starts on, for screenshots.
// Watch plays itself from a tap on Start (iOS speaks only after a gesture). Practise: the same
// director waits for her to do each beat; the chip and the caption follow her.

/** Re-renders on every discrete bench change (leads, key, plugs, notes). Never per frame. */
function useBenchVersion(bench: OhmsLawBench): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => bench.subscribe(bump), [bench]);
  return version;
}

/** `&dpr=1.5` pins the canvas's pixel ratio (shots at a chosen ratio); otherwise the ladder runs. */
function pinnedDpr(search: URLSearchParams): number | null {
  const raw = search.get("dpr");
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : null;
}

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

function readSeed(search: URLSearchParams): number {
  const n = Number(search.get("seed"));
  return search.has("seed") && Number.isFinite(n) ? n : randomSeed();
}

/** A seed for a new bench: any but the one she has just used. */
function freshSeed(old: number): number {
  let s = randomSeed();
  while (s === old) s = randomSeed();
  return s;
}

const URL_MODES: ReadonlySet<string> = new Set(["watch", "practice", "practise", "exam"]);

/** Which way through the practical the URL asks for. */
export function practicalFrom(search: URLSearchParams): PracticalMode {
  const m = search.get("mode");
  if (m === "exam") return "exam";
  if (m === "watch") return "watch";
  if (m === "practice" || m === "practise") return "practice";
  return search.get("practical") === "ohms-law" ? "watch" : "practice";
}

/** The page opens on the question paper: ?practical=ohms-law with no mode in the URL. */
export function paperFirst(search: URLSearchParams): boolean {
  return search.get("practical") === "ohms-law" && !URL_MODES.has(search.get("mode") ?? "");
}

/** One way through the page: the question paper (`practical` null), or a mode on a bench. */
export interface Run {
  practical: PracticalMode | null;
  /** Her bench's seed (Watch's demonstration bench is demoSeedFor(seed)). */
  seed: number;
  /** Bumped by every new run, so the screen and its bench start fresh. */
  n: number;
  /** The run follows the paper, whose entrance has already put the parts on the bench. */
  afterPaper: boolean;
}

export function initialRun(search: URLSearchParams, seed: number): Run {
  return {
    practical: paperFirst(search) ? null : practicalFrom(search),
    seed,
    n: 0,
    afterPaper: false,
  };
}

export type RunAction =
  /** A choice on the paper (or the paper closed: Practise, its primary choice). */
  | { kind: "choose"; mode: PracticalMode }
  /** Results' "Watch the demonstration again": Watch from its first beat, the same seed. */
  | { kind: "watchAgain" }
  /** Results' "Try again on a new bench": Practise (Exam, if she was in Exam) on a new seed. */
  | { kind: "newBench"; seed: number };

export function nextRun(run: Run, a: RunAction): Run {
  const n = run.n + 1;
  if (a.kind === "choose") {
    return { practical: a.mode, seed: run.seed, n, afterPaper: run.practical === null };
  }
  if (a.kind === "watchAgain") return { practical: "watch", seed: run.seed, n, afterPaper: false };
  const practical = run.practical === "exam" ? "exam" : "practice";
  return { practical, seed: a.seed, n, afterPaper: false };
}

/**
 * `href` with the run's `mode` and `seed` set: the URL after every choice on the paper or the
 * results (history.replaceState), so a reload stays on the same mode and the same bench.
 */
export function urlForRun(href: string, mode: PracticalMode, seed: number): string {
  const url = new URL(href);
  url.searchParams.set("mode", mode);
  url.searchParams.set("seed", String(seed));
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The camera pose for a Watch beat: the meters while the actor reads one, the box and key while it
 * sets R and works the key (a phone comes close there; a laptop keeps the bench), the wire board
 * while it reads the rule, and the whole bench otherwise. The camera never moves between beats
 * of the same kind.
 */
export function watchPose(beat: Beat | undefined, loupe: string | null): string {
  if (loupe === "ammeter" || loupe === "voltmeter") return "readings";
  if (loupe === "rule") return "wire";
  const act = beat?.act?.kind;
  if (act === "plug" || act === "key") return "box";
  if (beat?.id.endsWith("-r") || beat?.id.endsWith("-box")) return "box";
  return "bench";
}

/**
 * Whether a run starts playing by itself: only Watch, and only after a tap (the paper's choice or
 * the results' "Watch again"). A page loaded straight into ?mode=watch waits for Start; Practise
 * and Exam never autoplay.
 */
export function autoPlays(run: Run): boolean {
  return run.practical === "watch" && run.n > 0;
}

/** Whether Watch has the graph paper out on this step: Plot and Slope only. */
export function watchGraphOut(stepKey: string | undefined): boolean {
  return stepKey === "plot" || stepKey === "slope";
}

/** What the results screen shows, without its buttons. */
type ResultsView = Omit<ResultsProps, "onAgain" | "onWatch">;

/** Only results the page shows: before hand-in this is null and nothing of them is drawn. */
export function ResultsLayer({
  results,
  onAgain,
  onWatch,
}: {
  results: ResultsView | null;
  onAgain(): void;
  onWatch(): void;
}) {
  if (!results) return null;
  return (
    <div className="rs-layer">
      <Results {...results} onAgain={onAgain} onWatch={onWatch} />
    </div>
  );
}

const TERMINALS: ReadonlySet<string> = new Set(TERMINAL_IDS);
const isTerminalId = (id: string): id is TerminalId => TERMINALS.has(id);

/**
 * The two terminals of the next lead her circuit still needs: the beat's own lead if it is still
 * missing, else the first missing one; none once the circuit is complete.
 */
export function nextLeadTargets(
  bench: Pick<OhmsLawBench, "comparison">,
  beat: Beat | undefined,
): string[] {
  const missing = bench.comparison.missing;
  const act = beat?.act;
  const want =
    act?.kind === "lead"
      ? missing.find(
          ([a, b]) => (a === act.from && b === act.to) || (a === act.to && b === act.from),
        )
      : undefined;
  const next = want ?? missing[0];
  return next ? [next[0], next[1]] : [];
}

const lesson = OHMS_LAW_LESSON;
/** What the voice adds after every wrong lead's correction (the user, PR #100). */
export const WRONG_LEAD_TAIL = "Tap the wire to remove it.";
const STAGE_TITLES = Object.fromEntries(lesson.steps.map((st) => [st.key, st.title]));
const CREDIT = creditFromSource(OHMS_LAW_QUESTION.source);

interface Rig {
  bench: ReturnType<typeof createOhmsLawBench>;
  director: DirectorHandle;
  motion: StageMotion;
  /** The run this rig was made for. */
  n: number;
  run: Run;
  /** The page state this rig's director reads. */
  live: Live;
}

/** Her page state the director's `done` checks read (kept in refs, read each frame). */
interface Live {
  record: OhmsLawRecord;
  identified: ReadonlySet<PartId>;
}

function makeRig(search: URLSearchParams, run: Run, live: Live): Rig {
  // Under the paper: her bench, with a Practise director that never plays.
  const practical = run.practical ?? "practice";
  const first = run.n === 0;
  const mode: LessonMode = practical === "exam" ? "exam" : "practice";
  // Watch drives its own bench, on a different seed from the one she practises on.
  const bench = createOhmsLawBench(practical === "watch" ? demoSeedFor(run.seed) : run.seed, {
    mode,
  });
  // Dev only (screenshots and the no-leak check): `&demo=wired` pre-wires the diagram's leads,
  // `&demo=wired-closed` also closes the key. Never in a production build.
  const demo =
    import.meta.env.DEV && first && run.practical !== null && practical !== "watch"
      ? search.get("demo")
      : null;
  if (demo === "wired" || demo === "wired-closed") {
    for (const [a, z] of DIAGRAM_LEADS) {
      bench.tapTerminal(a);
      bench.tapTerminal(z);
    }
    if (demo === "wired-closed") bench.toggleKey();
  }
  const voice = createVoice();
  // E2E runs are silent: the voice keeps its estimated durations (learn/voice/createVoice.ts).
  voice.muted = search.get("mute") === "1" || e2eOn(search);
  const benchState = (): BenchState => ({
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record: live.record,
    identified: live.identified,
  });
  const base = { script: OHMS_LAW_SCRIPT, voice, benchState };
  const options: DirectorOptions =
    practical === "watch" ? { ...base, mode: "watch", bench } : { ...base, mode: practical, bench };
  const director = createDirector(options);
  const motion = createStageMotion();
  motion.entrance.on = run.practical === null;
  motion.entrance.landed = run.afterPaper;
  trackEpoch(director, motion);
  const speed = speedFrom(search);
  if (speed !== null) director.setSpeed(speed);
  if (first && run.practical !== null) {
    const beat = search.get("beat");
    if (beat !== null && beat !== "" && Number.isFinite(Number(beat))) director.seek(Number(beat));
    const freeze = Number(search.get("freeze"));
    if (import.meta.env.DEV && search.has("freeze") && freeze >= 0) motion.freezeAtS = freeze;
    // Dev only (screenshots): start without her tap. In a build, Watch starts from the Start button.
    if (import.meta.env.DEV && search.get("play") === "1") director.play();
  }
  // Choosing Watch (on the paper or on the results) is her tap: the demonstration starts at once.
  // A page load straight into ?mode=watch has no tap yet, so it waits for Start.
  if (autoPlays(run)) director.play();
  return { bench, director, motion, n: run.n, run, live };
}

/** The hook's answers while no screen is up (between two runs). */
function idleE2E(run: Run): SnaplabE2E {
  return {
    screen: () => run.practical ?? "paper",
    progress: () => ({ beat: 0, beats: OHMS_LAW_SCRIPT.beats.length, done: false }),
    targets: () => [],
    tap: () => {},
    type: () => {},
    meters: () => ({ i: null, v: null }),
    wireOhm: () => Number.NaN,
    handIn: () => {},
    result: () => null,
    play: () => {},
    setR: () => {},
    key: () => {},
  };
}

function LearnView() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const [run, setRun] = useState<Run>(() => initialRun(search, readSeed(search)));
  // What the director's checks read: her record and what she identified, as of now.
  const live = useMemo<Live>(
    () => ({
      record: emptyOhmsLawRecord(run.practical === "exam" ? "exam" : "practice"),
      identified: new Set(),
    }),
    [run],
  );
  // Made in an effect and torn down on unmount (StrictMode runs it twice: the first rig is
  // disposed, the second is the one on screen). Each run makes a new one.
  const [rig, setRig] = useState<Rig | null>(null);
  useEffect(() => {
    const made = makeRig(search, run, live);
    setRig(made);
    return () => made.director.dispose();
  }, [search, run, live]);

  // The E2E hook (?e2e=1 only): one global for the page's life, answering for the screen on show.
  const e2e = useRef<SnaplabE2E>(idleE2E(run));
  useEffect(() => installE2E(search, () => e2e.current), [search]);

  // The run as of the last action, so two quick actions build on each other.
  const runRef = useRef(run);
  const act = useCallback((a: RunAction) => {
    const next = nextRun(runRef.current, a);
    runRef.current = next;
    setRun(next);
    if (next.practical !== null) {
      history.replaceState(history.state, "", urlForRun(location.href, next.practical, next.seed));
    }
  }, []);

  if (!rig) {
    e2e.current = idleE2E(run);
    return null;
  }
  // While a new rig is being made the last one stays on screen, so the Canvas is never torn down.
  const stale = rig.n !== run.n;
  if (stale) e2e.current = idleE2E(run);
  return (
    <LearnScreen
      rig={rig}
      run={rig.run}
      search={search}
      live={rig.live}
      stale={stale}
      onRun={act}
      e2e={e2e}
    />
  );
}

/** Whether a reading aloud will be heard: speech exists and the voice is not muted. */
function audible(voice: VoiceGuide): boolean {
  return !voice.muted && typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * The voice the paper reads with: the director's own, watched, so the entrance knows when a
 * reading aloud starts and stops (the parts then wait to be named, or drop on the timed drop).
 */
function readerVoice(voice: VoiceGuide, motion: StageMotion, changed: () => void): VoiceGuide {
  let pending = 0;
  const end = () => {
    if (pending === 0) return;
    pending = 0;
    entranceStopped(motion.entrance);
    changed();
  };
  return {
    say(text, o) {
      if (pending === 0) {
        entranceReading(motion.entrance, audible(voice));
        changed();
      }
      pending++;
      const opts: { onWord?: (i: number) => void; onEnd: () => void } = {
        onEnd: () => {
          pending = Math.max(0, pending - 1);
          if (pending === 0) end();
          o?.onEnd?.();
        },
      };
      if (o?.onWord) opts.onWord = o.onWord;
      voice.say(text, opts);
    },
    stop() {
      voice.stop();
      if (pending > 0) {
        pending = 1;
        end();
      }
    },
    get speaking() {
      return voice.speaking;
    },
    get muted() {
      return voice.muted;
    },
    set muted(m: boolean) {
      voice.muted = m;
    },
    get rate() {
      return voice.rate;
    },
    set rate(r: number) {
      voice.rate = r;
    },
  };
}

function LearnScreen({
  rig,
  run,
  search,
  live,
  stale,
  onRun,
  e2e,
}: {
  rig: Rig;
  run: Run;
  search: URLSearchParams;
  live: Live;
  /** The rig for the newest run is not ready: this is still the last run's screen. */
  stale: boolean;
  onRun(a: RunAction): void;
  e2e: MutableRefObject<SnaplabE2E>;
}) {
  const { bench, director, motion } = rig;
  // The screen is not remounted for a new run (its Canvas stays up), so a new rig resets its state
  // below. Until that re-render, this render's state is the last run's: it must not reach `live`.
  const [seenRig, setSeenRig] = useState(rig.n);
  const fresh = seenRig !== rig.n;
  const paper = run.practical === null;
  const practical: PracticalMode = run.practical ?? "practice";
  const mode: LessonMode = practical === "exam" ? "exam" : "practice";
  const watch = practical === "watch";
  const version = useBenchVersion(bench);
  const { tier } = useQuality();
  const [dprPin] = useState(() => pinnedDpr(search));
  const nav = useStageNav(director, lesson.steps);

  // Exam keeps its own step (she moves through it herself); Watch and Practise follow the director.
  const [examStep, setExamStep] = useState(() => {
    const n = Number(search.get("step"));
    return run.n === 0 && Number.isInteger(n) && n >= 1 ? Math.min(n, lesson.steps.length) - 1 : 0;
  });
  const stepIndex = practical === "exam" ? examStep : nav.stepIndex;
  const [tab, setTab] = useState<ShellTab>("instructions");
  // The paper opens first, in the shell's question pop-up.
  const [popup, setPopupState] = useState<PopupId | null>(paper ? "question" : null);
  const calloutLayer = useRef<HTMLDivElement>(null);
  // A phone held upright folds the guide to a peek or opens it. The shell reports each change, and
  // the bench is framed in the window that leaves. Only Instructions has a peek: any other tab
  // shows the guide in full (the shell's own rule).
  const [guide, setGuide] = useState<GuideState>("peek");
  const framedGuide: GuideState = tab === "instructions" ? guide : "open";
  const caption = practical !== "exam" && !paper && director.state.caption !== "";
  // Where the shell's always-on chrome covers the canvas, for the stage's camera.
  const covered = useCallback(
    (w: number, h: number) => playerCovered(w, h, { guide: framedGuide, caption }),
    [framedGuide, caption],
  );
  const [record, setRecordState] = useState<OhmsLawRecord>(() => live.record);
  // Her record as of her last keystroke (the E2E hook may type twice before React renders).
  const recordRef = useRef(record);
  const [identified, setIdentified] = useState<ReadonlySet<PartId>>(() => live.identified);
  if (!fresh) {
    live.record = record;
    live.identified = identified;
  }
  const [results, setResultsState] = useState<ResultsView | null>(null);
  const resultsRef = useRef<ResultsView | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  // Practise: the last wrong lead's correction, shown until her next lead.
  const [wrongLine, setWrongLine] = useState<string | null>(null);

  const showResults = useCallback((r: ResultsView) => {
    resultsRef.current = r;
    setResultsState(r);
    setPopupState(null);
    setNotebookOpen(false);
  }, []);

  // The close-up loupe (Practise and Exam): the stage hands its camera to the close-up until it
  // is back. Watch's actor reads the meters through the stage's meters shot instead.
  const [loupe, setLoupe] = useState<{ target: LoupeTarget; ruleEnd: RuleEnd } | null>(null);
  const [returning, setReturning] = useState(false);
  const [eye, setEye] = useState(0);
  const parallax = useParallaxNote(bench);
  const meterOpen = loupe !== null && loupe.target !== "rule";
  useEffect(() => parallax.setEye(meterOpen ? eye : 0), [parallax, eye, meterOpen]);

  const openLoupe = useCallback((target: LoupeTarget) => {
    setLoupe({ target, ruleEnd: "X" });
    setEye(0);
    setDiagramOpen(false);
  }, []);
  const closeLoupe = useCallback(() => {
    setLoupe(null);
    setReturning(true);
  }, []);
  const loupeReturned = useCallback(() => setReturning(false), []);

  const [audio] = useState(createLabAudio);
  useEffect(() => {
    const unlock = () => void audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      audio.dispose();
    };
  }, [audio]);

  // The actor's sounds: a lead's snap, a plug, the key, a page written.
  useEffect(() => {
    const sfx = createSfx(() => director.voice.muted);
    const off = director.onEvent((e) => {
      if (e.kind === "lead") sfx.leadSnap();
      else if (e.kind === "plug") sfx.plug();
      else if (e.kind === "key") sfx.key();
      else if (e.kind === "write" || e.kind === "plot") sfx.page();
    });
    return () => {
      off();
      sfx.dispose();
    };
  }, [director]);

  // Practise: a wrong lead shakes its two nuts and the voice says why (no digits).
  useEffect(() => {
    if (practical !== "practice" || paper) return;
    return watchWrongTaps(bench, {
      expected: () => {
        const act = director.script.beats[director.state.beat]?.act;
        return act?.kind === "lead" ? ([act.from, act.to] as const) : undefined;
      },
      // Her first lead on this page shows, once, how a lead comes off again.
      onLead: (id) => {
        setWrongLine(null);
        hintFirstLead(motion.leads, id, performance.now() / 1000);
      },
      onWrong: (line, ends, id) => {
        motion.marks.shake = [ends[0], ends[1]];
        motion.marks.shakeAtS = performance.now() / 1000;
        // The wrong lead is the one picked for removal: lit, with its Remove chip, one tap away.
        motion.leads.selected = id;
        const said = `${line} ${WRONG_LEAD_TAIL}`;
        setWrongLine(said);
        director.voice.stop();
        director.voice.say(said);
      },
    });
  }, [practical, paper, bench, director, motion]);

  // Watch's last beat opens the demonstration's own mark sheet: the actor's record, handed in on
  // the demonstration bench.
  useEffect(() => {
    if (!watch) return;
    const check = () => {
      if (director.state.finished && resultsRef.current === null) {
        showResults({ ...handIn(director.demoRecord, bench, "practice"), demo: true });
      }
    };
    check();
    return director.subscribe(check);
  }, [watch, director, bench, showResults]);

  const setRecord = useCallback((next: OhmsLawRecord) => {
    recordRef.current = next;
    setRecordState(next);
  }, []);
  const doHandIn = useCallback(() => {
    if (paper || watch || resultsRef.current !== null) return;
    showResults(handIn(recordRef.current, bench, mode));
  }, [paper, watch, bench, mode, showResults]);
  // Exam mode: one hand-in, then the notebook is closed, so the feedback can't become hints.
  const handedIn = mode === "exam" && results !== null;

  const stepKey = lesson.steps[stepIndex]?.key;
  // Identify mode: on the Identify step (Practise), a tap on any item opens its card.
  const [card, setCard] = useState<IdentifyCard | null>(null);
  const identifying = practical === "practice" && !paper && stepKey === "identify";
  const identify = useCallback(
    (part: PartId) => {
      setIdentified((prev) => (prev.has(part) ? prev : new Set(prev).add(part)));
      if (identifying) setCard(lesson.identify.find((c) => c.part === part) ?? null);
    },
    [identifying],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new step closes the card.
  useEffect(() => setCard(null), [stepIndex]);

  // A new run (a mode chosen, Watch again, a new bench) starts every piece of state over, as the
  // remount used to. Adjusting state during render: React re-renders at once, before any paint.
  const graphAuto = useRef(false);
  if (fresh) {
    setSeenRig(rig.n);
    graphAuto.current = false;
    recordRef.current = live.record;
    resultsRef.current = null;
    setExamStep(0);
    setTab("instructions");
    setPopupState(paper ? "question" : null);
    setGuide("peek");
    setRecordState(live.record);
    setIdentified(live.identified);
    setResultsState(null);
    setNotebookOpen(false);
    setDiagramOpen(false);
    setWrongLine(null);
    setLoupe(null);
    setReturning(false);
    setEye(0);
    setCard(null);
  }

  // Watch: the graph paper comes out on the Plot and Slope steps and goes away on the next one.
  // (In Practise and Exam she opens it herself.)
  useEffect(() => {
    if (!watch || paper) return;
    if (watchGraphOut(stepKey)) {
      graphAuto.current = true;
      setPopupState("graph");
    } else if (graphAuto.current) {
      graphAuto.current = false;
      setPopupState((p) => (p === "graph" ? null : p));
    }
  }, [watch, paper, stepKey]);
  // The stage draws its own rings (both ends of the beat's lead); the pencil-grey ghost leads
  // still guide the Connect step in Practise.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-runs it after every bench change.
  useEffect(() => {
    const v = bench.visual.current;
    v.ring = null;
    const ghosts = practical === "practice" && !paper && stepKey === "connect";
    v.hintMissing = ghosts ? bench.comparison.missing : [];
    v.hintExtra = ghosts ? bench.comparison.extra : [];
  }, [bench, stepKey, practical, paper, version]);

  // ---- The question paper: the parts drop as it names them ----
  // A re-render of the stage wakes its demand loop, so each named part is drawn dropping.
  const [, entranceChanged] = useReducer((n: number) => n + 1, 0);
  const paperVoice = useMemo(
    () => readerVoice(director.voice, motion, entranceChanged),
    [director, motion],
  );
  const onItemRead = useCallback(
    (part: PartId) => {
      if (entranceNamed(motion.entrance, part)) entranceChanged();
    },
    [motion],
  );
  const choose = useCallback((m: PracticalMode) => onRun({ kind: "choose", mode: m }), [onRun]);
  // Closing the paper without a choice goes on with its primary choice, Practise.
  const setPopup = useCallback(
    (p: PopupId | null) => {
      if (paper && p !== "question") choose("practice");
      else setPopupState(p);
    },
    [paper, choose],
  );

  const state: BenchState = {
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record,
    identified,
  };
  const status = watch
    ? nav.stepStatus
    : stepStatuses(lesson, state, results?.sheet ?? null, mode, bench.visual.current.leads.length);
  const latestNote = practical === "practice" ? bench.notes[bench.notes.length - 1] : undefined;
  const hint = practical === "practice" && !paper ? (wrongLine ?? latestNote?.text) : undefined;

  // Watch shows the demonstration's own notebook and graph, which the actor fills in.
  const shownRecord = watch ? director.demoRecord : record;
  const noEdit = useCallback(() => {}, []);
  const pose = watch
    ? watchPose(director.script.beats[director.state.beat], director.state.loupe)
    : lesson.steps[stepIndex]?.pose;

  // ---- The E2E hook's answers for this screen (learn/e2e.ts) ----
  const truth = useMemo(() => benchTruthForE2E(bench), [bench]);
  if (!stale)
    e2e.current = {
      screen: () => (resultsRef.current ? "results" : paper ? "paper" : practical),
      progress: () => ({
        beat: director.state.beat,
        beats: director.script.beats.length,
        done: director.state.finished,
      }),
      targets: () =>
        practical === "practice" && !paper
          ? nextLeadTargets(bench, director.script.beats[director.state.beat])
          : [],
      tap: (id) => {
        if (!paper && !watch && resultsRef.current === null && isTerminalId(id)) {
          bench.tapTerminal(id);
        }
      },
      type: (row, col, value) => {
        if (paper || watch || resultsRef.current !== null) return;
        if (col !== "R" && col !== "I" && col !== "V") return;
        if (!Number.isInteger(row) || row < 0) return;
        let next = recordRef.current;
        while (next.rows.length <= row) next = addRow(next);
        setRecord(setCell(next, row, col, value));
        if (col !== "R") parallax.reading(`${row}:${col}`);
      },
      meters: truth.meters,
      wireOhm: truth.wireOhm,
      handIn: doHandIn,
      result: () => {
        const r = resultsRef.current;
        if (!r) return null;
        const rows = checkRows(r.record, r.checks);
        return {
          total: r.sheet.earned,
          max: r.sheet.available,
          checkRows: rows.length,
          checkOk: rows.filter((row) => row.ok).length,
        };
      },
      play: () => {
        if (!paper && resultsRef.current === null) director.play();
      },
      setR: (ohms) => {
        if (paper || watch || resultsRef.current !== null) return;
        const moves = plugMoves(bench.params.boxCoilsOhm, bench.visual.current.plugsIn, ohms);
        for (const index of moves) bench.togglePlug(index);
      },
      key: (closed) => {
        if (paper || watch || resultsRef.current !== null) return;
        if (bench.visual.current.keyClosed !== closed) bench.toggleKey();
      },
    };

  return (
    <>
      <LessonShell
        lesson={lesson}
        mode={mode}
        practical={practical}
        stepIndex={stepIndex}
        onStepChange={practical === "exam" ? setExamStep : nav.onStepChange}
        stepStatus={status}
        lockedFrom={practical === "exam" ? undefined : nav.lockedFrom}
        readOnlyTabs={practical === "exam" ? undefined : nav.readOnlyTabs}
        tab={tab}
        onTabChange={setTab}
        status={{ credit: CREDIT, hideCount: practical === "exam" }}
        note={MODE_NOTE[practical]}
        guide={guide}
        onGuideChange={setGuide}
        onRestart={watch ? () => director.seek(0) : undefined}
        overlay={
          paper ? null : (
            <>
              <Player
                director={director}
                stageTitles={STAGE_TITLES}
                onHandIn={watch || results ? undefined : doHandIn}
              />
              {practical === "practice" ? (
                <button
                  type="button"
                  className="ol-btn ol-undo"
                  disabled={bench.visual.current.leads.length === 0}
                  onClick={() => bench.undo()}
                >
                  Undo lead
                </button>
              ) : null}
            </>
          )
        }
        checklist={<StageChecklist director={director} stageTitles={STAGE_TITLES} />}
        calloutLayerRef={calloutLayer}
        activePopup={popup}
        onPopupChange={setPopup}
        questionSlot={
          paper ? (
            <QuestionPaper
              question={OHMS_LAW_QUESTION}
              voice={paperVoice}
              onItemRead={onItemRead}
              onChoose={choose}
            />
          ) : undefined
        }
        tools={
          <BenchTools
            onGraph={() => setPopup("graph")}
            onUndo={watch ? undefined : () => bench.undo()}
            onReset={watch ? undefined : () => bench.reset()}
          />
        }
        graphSlot={
          handedIn ? (
            <p className="ol-handed">Your graph has been handed in with your notebook.</p>
          ) : (
            <GraphSheet
              value={shownRecord.graph}
              onChange={watch ? noEdit : (graph) => setRecord({ ...recordRef.current, graph })}
              mode={mode}
              table={shownRecord}
            />
          )
        }
        tabContent={{
          examiner: (
            <div className="ol-mark">
              <p>
                When your table, precautions and part (b) are written, hand in your notebook. The
                examiner marks only what you wrote.
                {mode === "exam" && " In exam mode you can hand in once."}
              </p>
              <p className="ol-draft">DRAFT marking scheme: needs a physics teacher's check.</p>
            </div>
          ),
        }}
        notebookSlot={
          handedIn ? (
            <p className="ol-handed">Your notebook has been handed in.</p>
          ) : (
            <OhmsLawNotebook
              value={shownRecord}
              onChange={watch ? noEdit : setRecord}
              mode={mode}
              onReadingEdit={(cell) => parallax.reading(`${cell.row}:${cell.col}`)}
            />
          )
        }
        notebookOpen={notebookOpen}
        onNotebookOpenChange={setNotebookOpen}
        diagramSlot={
          <CircuitDiagram
            caption={false}
            comparison={mode === "exam" || watch || paper ? null : bench.comparison}
            onPart={(part, how) => how === "tap" && identify(part)}
          />
        }
        diagramOpen={diagramOpen}
        onDiagramOpenChange={setDiagramOpen}
        identify={{ card, onClose: () => setCard(null) }}
      >
        <div className={diagramOpen || card ? "ol-stage ol-float-open" : "ol-stage"}>
          <Stage
            bench={bench}
            quality={tier}
            covered={covered}
            audio={audio}
            parts={{
              onPartTap: identify,
              onMeterTap: (kind) => {
                identify(kind);
                if (!identifying && !watch) openLoupe(kind);
              },
              onRuleTap: () => {
                identify("wire");
                if (!identifying && !watch) openLoupe("rule");
              },
              onTrayItem: (item) => identify(item === "leads" ? "leads" : item),
            }}
            loupe={loupe}
            eyeDeg={eye}
            loupeHeld={loupe !== null || returning}
            onLoupeReturned={loupeReturned}
            dpr={dprPin}
            // Each step's pose (Watch: each beat's) picks a named shot (learn/stage/shots.ts).
            pose={pose}
            director={director}
            motion={motion}
            // Under the paper the bench is only looked at.
            practical={paper ? "watch" : practical}
          />
          <StageChip motion={motion} layer={calloutLayer} />
          {watch || paper ? null : (
            <LeadRemove
              motion={motion}
              layer={calloutLayer}
              onRemove={(id) => bench.removeLead(id)}
            />
          )}

          {loupe && (
            <fieldset className="ol-loupe" aria-label="Close-up">
              <span className="snap-label">
                {loupe.target === "ammeter"
                  ? "Ammeter"
                  : loupe.target === "voltmeter"
                    ? "Voltmeter"
                    : `Metre rule at ${loupe.ruleEnd}`}
              </span>
              {loupe.target === "rule" ? (
                <button
                  type="button"
                  className="ol-btn"
                  onClick={() =>
                    setLoupe({ target: "rule", ruleEnd: loupe.ruleEnd === "X" ? "Y" : "X" })
                  }
                >
                  Look at {loupe.ruleEnd === "X" ? "Y" : "X"}
                </button>
              ) : null}
              <label className="ol-eye">
                <span>Eye</span>
                <input
                  type="range"
                  min={-MAX_EYE_DEG}
                  max={MAX_EYE_DEG}
                  step={1}
                  value={eye}
                  aria-label="Move your eye left or right"
                  onChange={(e) => setEye(clampEye(Number(e.target.value)))}
                />
              </label>
              <button type="button" className="ol-btn ol-btn-primary" onClick={closeLoupe}>
                Back to the bench
              </button>
            </fieldset>
          )}

          {hint && !loupe && (
            <p className="ol-note" role="status" data-testid="hint">
              {hint}
            </p>
          )}
        </div>
      </LessonShell>
      <ResultsLayer
        results={results}
        onWatch={() => onRun({ kind: "watchAgain" })}
        onAgain={() => onRun({ kind: "newBench", seed: freshSeed(run.seed) })}
      />
    </>
  );
}

export default function LearnPage() {
  return (
    <QualityProvider>
      <LearnView />
    </QualityProvider>
  );
}
