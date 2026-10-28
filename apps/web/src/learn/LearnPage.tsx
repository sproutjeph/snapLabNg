import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import type { MarkSheet, OhmsLawRecord } from "@snaplab/contracts";
import type { TerminalId } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as THREE from "three";
import { createLabAudio } from "../audio/labAudio";
import { QualityProvider, useQuality } from "../quality/QualityProvider";
import { InkComposer } from "../scene/ink/InkComposer";
import { InkLights } from "../scene/ink/InkLights";
import { PaperDesk } from "../scene/ink/PaperDesk";
import { ReadySignal } from "../scene/ReadySignal";
import { OHMS_LAW_LESSON } from "./lessons/ohms-law/lesson";
import { MarkPanel } from "./MarkPanel";
import { stepStatuses } from "./marking";
import { OhmsLawNotebook } from "./readings/OhmsLawNotebook";
import { useParallaxNote } from "./readings/parallax";
import { clampEye, type LoupeTarget, MAX_EYE_DEG, type RuleEnd } from "./readings/poses";
import { ReadingLoupe } from "./readings/ReadingLoupe";
import { emptyOhmsLawRecord } from "./readings/record";
import LessonShell, { type ShellTab } from "./shell/LessonShell";
import { TerminalProvider } from "./terminals";
import type { BenchState, LessonMode, OhmsLawBench, PartId } from "./types";
import { BenchParts } from "./wiring/BenchParts";
import { BenchWiring } from "./wiring/BenchWiring";
import { createOhmsLawBench } from "./wiring/bench";
import { CircuitDiagram } from "./wiring/CircuitDiagram";
import "./learn.css";

// ?learn=ohms-law[&mode=exam][&step=<n>][&seed=<n>] — the hands-on V–I practical
// (docs/plans/ohms-law-vi.md, Integration A). Lead-owned: it only composes the slices.
// The engine decides every number on the bench; the rules mark what she typed; nothing here
// computes science or shows an engine value.

const BENCH_TARGET: [number, number, number] = [0, 0, -0.05];
const BENCH_CAMERA: [number, number, number] = [0, 0.95, 1.05];

/** Re-renders on every discrete bench change (leads, key, plugs, notes). Never per frame. */
function useBenchVersion(bench: OhmsLawBench): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => bench.subscribe(bump), [bench]);
  return version;
}

/**
 * Where the shell's panels cover the canvas (shell.css: rail 76 px, panel 400 px or 340 px on a
 * tablet, a bottom sheet on phones), so the bench is framed in the part she can see.
 */
function coveredPx(width: number): { left: number; right: number; top: number; bottom: number } {
  if (width <= 640) return { left: 0, right: 0, top: 96, bottom: 200 };
  if (width <= 900) return { left: 76, right: 356, top: 56, bottom: 80 };
  return { left: 76, right: 416, top: 56, bottom: 80 };
}

/**
 * Keeps the whole bench in view: farther back on a tall phone screen (as the V–I kit preview
 * does), and shifted with a view offset so it sits in the uncovered part of the canvas.
 */
function FrameBench({ paused }: { paused: boolean }) {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  // The view offset always follows the size, close-up or not, so nothing jumps.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const c = coveredPx(width);
    camera.setViewOffset(
      width,
      height,
      (c.right - c.left) / 2,
      (c.bottom - c.top) / 2,
      width,
      height,
    );
    return () => camera.clearViewOffset();
  }, [camera, width, height]);
  // The framing runs once, then again only after a resize. A close-up owns the camera while it
  // is open, so a resize then waits until it is back; her own orbit is never thrown away.
  const dirty = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new size is what marks it dirty.
  useEffect(() => {
    dirty.current = true;
  }, [width, height]);
  useEffect(() => {
    if (paused || !dirty.current) return;
    dirty.current = false;
    const aspect = width / Math.max(height, 1);
    const c = coveredPx(width);
    // Back off so the bench (about 1.5 m with the tray) spans the uncovered width.
    const fitTall = aspect < 1 ? 1 / aspect : 1;
    const fitPanels = (0.9 * width) / Math.max(width - c.left - c.right, 1);
    const k = Math.min(2.6, Math.max(1, fitTall, fitPanels));
    camera.position.set(
      BENCH_TARGET[0] + (BENCH_CAMERA[0] - BENCH_TARGET[0]) * k,
      BENCH_TARGET[1] + (BENCH_CAMERA[1] - BENCH_TARGET[1]) * k,
      BENCH_TARGET[2] + (BENCH_CAMERA[2] - BENCH_TARGET[2]) * k,
    );
    camera.lookAt(BENCH_TARGET[0], BENCH_TARGET[1], BENCH_TARGET[2]);
  }, [camera, width, height, paused]);
  return null;
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

function LearnView() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  const lesson = OHMS_LAW_LESSON;
  const [seed] = useState(() => readSeed(search));
  const bench = useMemo(() => createOhmsLawBench(seed, { mode }), [seed, mode]);
  const version = useBenchVersion(bench);
  const { tier, settings } = useQuality();

  const [stepIndex, setStepIndex] = useState(() => {
    const n = Number(search.get("step"));
    return Number.isInteger(n) && n >= 1 ? Math.min(n, lesson.steps.length) - 1 : 0;
  });
  const [tab, setTab] = useState<ShellTab>("instructions");
  const [record, setRecordState] = useState<OhmsLawRecord>(() => emptyOhmsLawRecord(mode));
  const [identified, setIdentified] = useState<ReadonlySet<PartId>>(() => new Set());
  const [sheet, setSheet] = useState<MarkSheet | null>(null);
  const [stale, setStale] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);

  // The close-up loupe: OrbitControls stay unmounted until the camera is back.
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

  const identify = useCallback((part: PartId) => {
    setIdentified((prev) => (prev.has(part) ? prev : new Set(prev).add(part)));
  }, []);

  const stepKey = lesson.steps[stepIndex]?.key;
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
      onDiagramOpenChange={setDiagramOpen}
    >
      <div className={diagramOpen ? "ol-stage ol-float-open" : "ol-stage"}>
        <Canvas
          shadows={settings.shadows}
          dpr={settings.dpr}
          gl={{ antialias: false }}
          camera={{ fov: 40, position: BENCH_CAMERA, near: 0.02, far: 20 }}
        >
          <InkLights quality={tier} />
          <FrameBench paused={loupe !== null || returning} />
          {!loupe && !returning && (
            <OrbitControls
              target={BENCH_TARGET}
              makeDefault
              enablePan={false}
              minDistance={0.45}
              maxDistance={2.6}
              maxPolarAngle={Math.PI * 0.45}
            />
          )}
          <TerminalProvider>
            <PaperDesk quality={tier} />
            <BenchParts
              bench={bench}
              quality={tier}
              onPartTap={identify}
              onMeterTap={(kind) => {
                identify(kind);
                openLoupe(kind);
              }}
              onRuleTap={() => {
                identify("wire");
                openLoupe("rule");
              }}
              onTrayItem={(item) => identify(item === "leads" ? "leads" : item)}
            />
            <BenchWiring bench={bench} quality={tier} audio={audio} />
          </TerminalProvider>
          <ReadingLoupe
            target={loupe?.target ?? null}
            eyeDeg={eye}
            ruleEnd={loupe?.ruleEnd ?? "X"}
            wire={bench.params.wire}
            onReturned={loupeReturned}
          />
          <InkComposer quality={tier} />
          <ReadySignal />
        </Canvas>

        <div className="ol-tools" role="toolbar" aria-label="Bench">
          <button type="button" className="ol-btn" onClick={() => setNotebookOpen(true)}>
            Notebook
          </button>
          <button type="button" className="ol-btn" onClick={() => bench.undo()}>
            Undo lead
          </button>
          <button type="button" className="ol-btn" onClick={() => bench.reset()}>
            Reset bench
          </button>
        </div>

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
