import type { MarkSheet, OhmsLawRecord } from "@snaplab/contracts";
import { DIAGRAM_LEADS, type TerminalId } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createLabAudio } from "../audio/labAudio";
import { QualityProvider, useQuality } from "../quality/QualityProvider";
import { GraphSheet } from "./graph/GraphSheet";
import { OHMS_LAW_LESSON } from "./lessons/ohms-law/lesson";
import { MarkPanel } from "./MarkPanel";
import { stepStatuses } from "./marking";
import { playerCovered } from "./player/stages";
import { OhmsLawNotebook } from "./readings/OhmsLawNotebook";
import { useParallaxNote } from "./readings/parallax";
import { clampEye, type LoupeTarget, MAX_EYE_DEG, type RuleEnd } from "./readings/poses";
import { emptyOhmsLawRecord } from "./readings/record";
import LessonShell, { type GuideState, type ShellTab } from "./shell/LessonShell";
import { Stage } from "./stage/Stage";
import type { BenchState, IdentifyCard, LessonMode, OhmsLawBench, PartId } from "./types";
import { createOhmsLawBench } from "./wiring/bench";
import { CircuitDiagram } from "./wiring/CircuitDiagram";
import "./learn.css";

// ?learn=ohms-law[&mode=exam][&step=<n>][&seed=<n>] — the hands-on V–I practical
// (docs/plans/ohms-law-vi.md, Integration A). Lead-owned: it only composes the slices.
// The engine decides every number on the bench; the rules mark what she typed; nothing here
// computes science or shows an engine value.

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

/** In guided mode, the next terminal to tap while wiring gets the pulsing ring. */
function ringFor(stepKey: string | undefined, bench: OhmsLawBench): TerminalId | null {
  if (stepKey !== "connect" || bench.comparison.matches) return null;
  const next = bench.comparison.missing[0];
  if (!next) return null;
  const pending = bench.visual.current.pendingFrom;
  if (pending === next[0]) return next[1];
  if (pending === next[1]) return next[0];
  return next[0];
}

function readSeed(search: URLSearchParams): number {
  const n = Number(search.get("seed"));
  return search.has("seed") && Number.isFinite(n) ? n : Math.floor(Math.random() * 1_000_000_000);
}

const lesson = OHMS_LAW_LESSON;

function LearnView() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  const [seed] = useState(() => readSeed(search));
  const bench = useMemo(() => {
    const b = createOhmsLawBench(seed, { mode });
    // Dev only (screenshots and the no-leak check): `&demo=wired` pre-wires the diagram's
    // leads, `&demo=wired-closed` also closes the key. Never in a production build.
    const demo = import.meta.env.DEV ? search.get("demo") : null;
    if (demo === "wired" || demo === "wired-closed") {
      for (const [a, z] of DIAGRAM_LEADS) {
        b.tapTerminal(a);
        b.tapTerminal(z);
      }
      if (demo === "wired-closed") b.toggleKey();
    }
    return b;
  }, [seed, mode, search]);
  const version = useBenchVersion(bench);
  const { tier } = useQuality();
  const [dprPin] = useState(() => pinnedDpr(search));

  const [stepIndex, setStepIndex] = useState(() => {
    const n = Number(search.get("step"));
    return Number.isInteger(n) && n >= 1 ? Math.min(n, lesson.steps.length) - 1 : 0;
  });
  const [tab, setTab] = useState<ShellTab>("instructions");
  // A phone held upright folds the guide to a peek or opens it. The shell reports each change, and
  // the bench is framed in the window that leaves. Only Instructions has a peek: any other tab
  // shows the guide in full (the shell's own rule).
  const [guide, setGuide] = useState<GuideState>("peek");
  const framedGuide: GuideState = tab === "instructions" ? guide : "open";
  // Where the shell's cards cover the canvas, for the stage's camera to frame the bench in the rest.
  const covered = useCallback(
    (w: number, h: number) => playerCovered(w, h, { guide: framedGuide }),
    [framedGuide],
  );
  const [record, setRecordState] = useState<OhmsLawRecord>(() => emptyOhmsLawRecord(mode));
  const [identified, setIdentified] = useState<ReadonlySet<PartId>>(() => new Set());
  const [sheet, setSheet] = useState<MarkSheet | null>(null);
  const [stale, setStale] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);

  // The close-up loupe: the stage hands its camera to the close-up until it is back.
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
  // Identify mode: on the Identify step (practice), a tap on any item opens its card.
  const [card, setCard] = useState<IdentifyCard | null>(null);
  const identifying = mode === "practice" && stepKey === "identify";
  const identify = useCallback(
    (part: PartId) => {
      setIdentified((prev) => (prev.has(part) ? prev : new Set(prev).add(part)));
      if (identifying) setCard(lesson.identify.find((c) => c.part === part) ?? null);
    },
    [identifying],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new step closes the card.
  useEffect(() => setCard(null), [stepIndex]);
  // The graph paper comes out for Plot and Slope, and goes away for the bench steps.
  useEffect(() => setGraphOpen(stepKey === "plot" || stepKey === "slope"), [stepKey]);
  // The diagram card would cover the graph paper: one at a time.
  useEffect(() => {
    if (graphOpen) setDiagramOpen(false);
  }, [graphOpen]);
  // The ring is written into the visual state; parts read it in useFrame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-runs it after every bench change.
  useEffect(() => {
    const v = bench.visual.current;
    v.ring = mode === "practice" ? ringFor(stepKey, bench) : null;
    // The pencil-grey ghost leads guide the Connect step only (practice); elsewhere they are noise.
    const guide = mode === "practice" && stepKey === "connect";
    v.hintMissing = guide ? bench.comparison.missing : [];
    v.hintExtra = guide ? bench.comparison.extra : [];
  }, [bench, stepKey, mode, version]);

  const state: BenchState = {
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record,
    identified,
  };
  const status = stepStatuses(lesson, state, sheet, mode, bench.visual.current.leads.length);
  const latestNote = mode === "practice" ? bench.notes[bench.notes.length - 1] : undefined;

  return (
    <LessonShell
      lesson={lesson}
      mode={mode}
      stepIndex={stepIndex}
      onStepChange={setStepIndex}
      stepStatus={status}
      tab={tab}
      onTabChange={setTab}
      guide={guide}
      onGuideChange={setGuide}
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
            value={record}
            onChange={setRecord}
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
          comparison={mode === "exam" ? null : bench.comparison}
          onPart={(part, how) => how === "tap" && identify(part)}
        />
      }
      diagramOpen={diagramOpen}
      onDiagramOpenChange={(open) => {
        setDiagramOpen(open);
        if (open) setGraphOpen(false);
      }}
      identify={{ card, onClose: () => setCard(null) }}
    >
      <div className={(diagramOpen || card) && !graphOpen ? "ol-stage ol-float-open" : "ol-stage"}>
        <Stage
          bench={bench}
          quality={tier}
          covered={covered}
          audio={audio}
          parts={{
            onPartTap: identify,
            onMeterTap: (kind) => {
              identify(kind);
              if (!identifying) openLoupe(kind);
            },
            onRuleTap: () => {
              identify("wire");
              if (!identifying) openLoupe("rule");
            },
            onTrayItem: (item) => identify(item === "leads" ? "leads" : item),
          }}
          loupe={loupe}
          eyeDeg={eye}
          loupeHeld={loupe !== null || returning}
          onLoupeReturned={loupeReturned}
          dpr={dprPin}
          // Each step's pose picks a named shot (learn/stage/shots.ts): BC101's per-step zoom.
          pose={lesson.steps[stepIndex]?.pose}
        />

        <div className="ol-tools" role="toolbar" aria-label="Bench">
          <button type="button" className="ol-btn" onClick={() => setNotebookOpen(true)}>
            Notebook
          </button>
          <button
            type="button"
            className="ol-btn"
            aria-pressed={graphOpen}
            onClick={() => setGraphOpen(!graphOpen)}
          >
            {graphOpen ? "Back to the bench" : "Graph paper"}
          </button>
          {!graphOpen && (
            <>
              <button type="button" className="ol-btn" onClick={() => bench.undo()}>
                Undo lead
              </button>
              <button type="button" className="ol-btn" onClick={() => bench.reset()}>
                Reset bench
              </button>
            </>
          )}
        </div>

        {graphOpen && (
          <section className="ol-graph" aria-label="Graph paper">
            {handedIn ? (
              <p className="ol-handed">Your graph has been handed in with your notebook.</p>
            ) : (
              <GraphSheet
                value={record.graph}
                onChange={(graph) => setRecord({ ...record, graph })}
                mode={mode}
                table={record}
              />
            )}
          </section>
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

        {latestNote && !loupe && !graphOpen && (
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
