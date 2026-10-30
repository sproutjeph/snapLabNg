import type { MarkSheet, OhmsLawRecord } from "@snaplab/contracts";
import { DIAGRAM_LEADS, demoSeedFor } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createLabAudio } from "../audio/labAudio";
import { QualityProvider, useQuality } from "../quality/QualityProvider";
import { GraphSheet } from "./graph/GraphSheet";
import { OHMS_LAW_LESSON } from "./lessons/ohms-law/lesson";
import { OHMS_LAW_SCRIPT } from "./lessons/ohms-law/script";
import { MarkPanel } from "./MarkPanel";
import { stepStatuses } from "./marking";
import { OHMS_LAW_QUESTION } from "./paper/ohmsLawQuestion";
import { Player } from "./player/Player";
import { StageChecklist } from "./player/StageChecklist";
import { MODE_NOTE, playerCovered } from "./player/stages";
import { useStageNav } from "./player/useStageNav";
import { OhmsLawNotebook } from "./readings/OhmsLawNotebook";
import { useParallaxNote } from "./readings/parallax";
import { clampEye, type LoupeTarget, MAX_EYE_DEG, type RuleEnd } from "./readings/poses";
import { emptyOhmsLawRecord } from "./readings/record";
import { createDirector, type DirectorHandle } from "./script/createDirector";
import type { Beat, DirectorOptions } from "./script/types";
import LessonShell, { type GuideState, type PopupId, type ShellTab } from "./shell/LessonShell";
import { creditFromSource } from "./shell/StatusCard";
import { BenchTools } from "./stage/BenchTools";
import { Stage } from "./stage/Stage";
import { StageChip } from "./stage/StageChip";
import { createStageMotion, type StageMotion, trackEpoch } from "./stage/stageMotion";
import type {
  BenchState,
  IdentifyCard,
  LessonMode,
  OhmsLawBench,
  PartId,
  PracticalMode,
} from "./types";
import { createVoice } from "./voice/createVoice";
import { createSfx } from "./voice/sfx";
import { createOhmsLawBench } from "./wiring/bench";
import { CircuitDiagram } from "./wiring/CircuitDiagram";
import { watchWrongTaps } from "./wiring/wrongTap";
import "./learn.css";

// ?practical=ohms-law and ?learn=ohms-law — the hands-on V–I practical (docs/plans/ohms-law-vi.md,
// Integration A; docs/plans/wave-2-lean.md, 2b-motion). Lead-owned: it only composes the slices.
// The engine decides every number on the bench; the rules mark what she typed; nothing here
// computes science or shows an engine value.
//   &mode=watch|practice|exam   Watch plays the demonstration on its own bench (demoSeedFor);
//                               Practise and Exam are her bench. Default: Watch on ?practical=,
//                               Practise on ?learn=.
//   &seed=N   &step=N (Exam)   &beat=N   &play=1   &speed=1|1.5|2   &mute=1   &dpr=1–3
//   &freeze=S (dev)  pauses S beat seconds into the beat it starts on, for screenshots.
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

function readSeed(search: URLSearchParams): number {
  const n = Number(search.get("seed"));
  return search.has("seed") && Number.isFinite(n) ? n : Math.floor(Math.random() * 1_000_000_000);
}

/** Which way through the practical the URL asks for. */
export function practicalFrom(search: URLSearchParams): PracticalMode {
  const m = search.get("mode");
  if (m === "exam") return "exam";
  if (m === "watch") return "watch";
  if (m === "practice" || m === "practise") return "practice";
  return search.get("practical") === "ohms-law" ? "watch" : "practice";
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

const lesson = OHMS_LAW_LESSON;
const STAGE_TITLES = Object.fromEntries(lesson.steps.map((st) => [st.key, st.title]));
const CREDIT = creditFromSource(OHMS_LAW_QUESTION.source);

interface Rig {
  bench: ReturnType<typeof createOhmsLawBench>;
  director: DirectorHandle;
  motion: StageMotion;
}

/** Her page state the director's `done` checks read (kept in refs, read each frame). */
interface Live {
  record: OhmsLawRecord;
  identified: ReadonlySet<PartId>;
}

function makeRig(search: URLSearchParams, practical: PracticalMode, seed: number, live: Live): Rig {
  const mode: LessonMode = practical === "exam" ? "exam" : "practice";
  // Watch drives its own bench, on a different seed from the one she practises on.
  const bench = createOhmsLawBench(practical === "watch" ? demoSeedFor(seed) : seed, { mode });
  // Dev only (screenshots and the no-leak check): `&demo=wired` pre-wires the diagram's leads,
  // `&demo=wired-closed` also closes the key. Never in a production build.
  const demo = import.meta.env.DEV && practical !== "watch" ? search.get("demo") : null;
  if (demo === "wired" || demo === "wired-closed") {
    for (const [a, z] of DIAGRAM_LEADS) {
      bench.tapTerminal(a);
      bench.tapTerminal(z);
    }
    if (demo === "wired-closed") bench.toggleKey();
  }
  const voice = createVoice();
  voice.muted = search.get("mute") === "1";
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
  trackEpoch(director, motion);
  const speed = Number(search.get("speed"));
  if (speed === 1 || speed === 1.5 || speed === 2) director.setSpeed(speed);
  const beat = search.get("beat");
  if (beat !== null && beat !== "" && Number.isFinite(Number(beat))) director.seek(Number(beat));
  const freeze = Number(search.get("freeze"));
  if (import.meta.env.DEV && search.has("freeze") && freeze >= 0) motion.freezeAtS = freeze;
  if (search.get("play") === "1") director.play();
  return { bench, director, motion };
}

function LearnView() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const practical = useMemo(() => practicalFrom(search), [search]);
  const [seed] = useState(() => readSeed(search));
  // What the director's checks read: her record and what she identified, as of now.
  const [live] = useState<Live>(() => ({
    record: emptyOhmsLawRecord(practical === "exam" ? "exam" : "practice"),
    identified: new Set(),
  }));
  // Made in an effect and torn down on unmount (StrictMode runs it twice: the first rig is
  // disposed, the second is the one on screen).
  const [rig, setRig] = useState<Rig | null>(null);
  useEffect(() => {
    const made = makeRig(search, practical, seed, live);
    setRig(made);
    return () => made.director.dispose();
  }, [search, practical, seed, live]);
  if (!rig) return null;
  return <LearnScreen rig={rig} practical={practical} search={search} live={live} />;
}

function LearnScreen({
  rig,
  practical,
  search,
  live,
}: {
  rig: Rig;
  practical: PracticalMode;
  search: URLSearchParams;
  live: Live;
}) {
  const { bench, director, motion } = rig;
  const mode: LessonMode = practical === "exam" ? "exam" : "practice";
  const watch = practical === "watch";
  const version = useBenchVersion(bench);
  const { tier } = useQuality();
  const [dprPin] = useState(() => pinnedDpr(search));
  const nav = useStageNav(director, lesson.steps);

  // Exam keeps its own step (she moves through it herself); Watch and Practise follow the director.
  const [examStep, setExamStep] = useState(() => {
    const n = Number(search.get("step"));
    return Number.isInteger(n) && n >= 1 ? Math.min(n, lesson.steps.length) - 1 : 0;
  });
  const stepIndex = practical === "exam" ? examStep : nav.stepIndex;
  const [tab, setTab] = useState<ShellTab>("instructions");
  const [popup, setPopup] = useState<PopupId | null>(null);
  const calloutLayer = useRef<HTMLDivElement>(null);
  // A phone held upright folds the guide to a peek or opens it. The shell reports each change, and
  // the bench is framed in the window that leaves. Only Instructions has a peek: any other tab
  // shows the guide in full (the shell's own rule).
  const [guide, setGuide] = useState<GuideState>("peek");
  const framedGuide: GuideState = tab === "instructions" ? guide : "open";
  const caption = practical !== "exam" && director.state.caption !== "";
  // Where the shell's always-on chrome covers the canvas, for the stage's camera.
  const covered = useCallback(
    (w: number, h: number) => playerCovered(w, h, { guide: framedGuide, caption }),
    [framedGuide, caption],
  );
  const [record, setRecordState] = useState<OhmsLawRecord>(() => live.record);
  const [identified, setIdentified] = useState<ReadonlySet<PartId>>(() => live.identified);
  live.record = record;
  live.identified = identified;
  const [sheet, setSheet] = useState<MarkSheet | null>(null);
  const [stale, setStale] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);

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
    if (practical !== "practice") return;
    return watchWrongTaps(bench, {
      expected: () => {
        const act = director.script.beats[director.state.beat]?.act;
        return act?.kind === "lead" ? ([act.from, act.to] as const) : undefined;
      },
      onWrong: (line, ends) => {
        motion.marks.shake = [ends[0], ends[1]];
        motion.marks.shakeAtS = performance.now() / 1000;
        director.voice.stop();
        director.voice.say(line);
      },
    });
  }, [practical, bench, director, motion]);

  const setRecord = useCallback((next: OhmsLawRecord) => {
    setRecordState(next);
    setStale(true);
  }, []);
  const handIn = useCallback(() => {
    setSheet(markOhmsLaw(record));
    setStale(false);
  }, [record]);
  // Exam mode: one hand-in, then the notebook is closed, so the feedback can't become hints.
  const handedIn = mode === "exam" && sheet !== null;

  const stepKey = lesson.steps[stepIndex]?.key;
  // Identify mode: on the Identify step (Practise), a tap on any item opens its card.
  const [card, setCard] = useState<IdentifyCard | null>(null);
  const identifying = practical === "practice" && stepKey === "identify";
  const identify = useCallback(
    (part: PartId) => {
      setIdentified((prev) => (prev.has(part) ? prev : new Set(prev).add(part)));
      if (identifying) setCard(lesson.identify.find((c) => c.part === part) ?? null);
    },
    [identifying],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new step closes the card.
  useEffect(() => setCard(null), [stepIndex]);
  // The stage draws its own rings (both ends of the beat's lead); the pencil-grey ghost leads
  // still guide the Connect step in Practise.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-runs it after every bench change.
  useEffect(() => {
    const v = bench.visual.current;
    v.ring = null;
    const ghosts = practical === "practice" && stepKey === "connect";
    v.hintMissing = ghosts ? bench.comparison.missing : [];
    v.hintExtra = ghosts ? bench.comparison.extra : [];
  }, [bench, stepKey, practical, version]);

  const state: BenchState = {
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record,
    identified,
  };
  const status = watch
    ? nav.stepStatus
    : stepStatuses(lesson, state, sheet, mode, bench.visual.current.leads.length);
  const latestNote = practical === "practice" ? bench.notes[bench.notes.length - 1] : undefined;

  // Watch shows the demonstration's own notebook and graph, which the actor fills in.
  const shownRecord = watch ? director.demoRecord : record;
  const noEdit = useCallback(() => {}, []);
  const pose = watch
    ? watchPose(director.script.beats[director.state.beat], director.state.loupe)
    : lesson.steps[stepIndex]?.pose;

  return (
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
      overlay={<Player director={director} stageTitles={STAGE_TITLES} />}
      checklist={<StageChecklist director={director} stageTitles={STAGE_TITLES} />}
      calloutLayerRef={calloutLayer}
      activePopup={popup}
      onPopupChange={setPopup}
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
            onChange={watch ? noEdit : (graph) => setRecord({ ...record, graph })}
            mode={mode}
            table={shownRecord}
          />
        )
      }
      tabContent={{
        examiner: <MarkPanel sheet={sheet} stale={stale} onHandIn={handIn} mode={mode} />,
      }}
      notebookSlot={
        handedIn ? (
          <p className="ol-handed">
            Your notebook has been handed in. Your marks are under Examiner asks.
          </p>
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
          comparison={mode === "exam" || watch ? null : bench.comparison}
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
          practical={practical}
        />
        <StageChip motion={motion} layer={calloutLayer} />

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

        {latestNote && !loupe && (
          <p className="ol-note" role="status">
            {latestNote.text}
          </p>
        )}
      </div>
    </LessonShell>
  );
}

export default function LearnPage() {
  return (
    <QualityProvider>
      <LearnView />
    </QualityProvider>
  );
}
