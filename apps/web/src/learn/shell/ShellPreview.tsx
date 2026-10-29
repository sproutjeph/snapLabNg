import { demoSeedFor } from "@snaplab/engine";
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { parseOverride } from "../../quality/tier";
import type { Covered } from "../../scene/look/types";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { OHMS_LAW_QUESTION } from "../paper/ohmsLawQuestion";
import { Player } from "../player/Player";
import { StageChecklist } from "../player/StageChecklist";
import { MODE_NOTE, playerCovered } from "../player/stages";
import { useStageNav } from "../player/useStageNav";
import { emptyOhmsLawRecord } from "../readings/record";
import { createDirector } from "../script/createDirector";
import { modeFrom } from "../script/previewMode";
import { SAMPLE_SCRIPT } from "../script/sampleScript";
import type { Director, DirectorOptions } from "../script/types";
import type {
  BenchState,
  Callout,
  IdentifyCard,
  Lesson,
  LessonMode,
  OhmsLawBench,
  PracticalMode,
} from "../types";
import { createVoice } from "../voice/createVoice";
import { createOhmsLawBench } from "../wiring/bench";
import LessonShell, { type GuideState, type ShellTab, type StepStatus } from "./LessonShell";
import { layoutFor } from "./layout";
import { creditFromSource } from "./StatusCard";

const ShellCanvas = lazy(() => import("./ShellCanvas"));

// ?shell=1 preview of the page shell with the Ohm's-law lesson.
//   &step=<n>      0-based current step (default 0)
//   &mode=exam     Exam (the hints go); with &director=1 also &mode=watch|practice (default watch)
//   &identify=1    a sample Identify card
//   &diagram=1     opens the "Compare with diagram" card with a placeholder diagram
//   &lost=<n,n>    steps shown as lost (✕); every step before the current one is otherwise done
//   &tab=why|precautions|examiner   the guide's tab (default instructions)
//   &examiner=1    adds the Examiner asks tab (the lesson page's), with a sample body
//   &guide=open    a phone's guide fully open (default: folded to a peek)
//   &director=1    the real director on the sample script drives the player, the checklist and
//                  the strip (&beat=N starts paused at beat N, &play=1, &speed=1|1.5|2, &seed=N,
//                  &mute=1)
//   &canvas=1      the real bench through the look behind the cards (&quality=low|mid|high,
//                  &dpr=<1–3> pins the pixel ratio); default is a paper-grid placeholder
//   &debug=1       outlines the free rect playerCovered returns and prints the region rects as
//                  JSON (also on window.__SHELL_RECTS__), for the geometry diff against BC101

const SAMPLE_CARD: IdentifyCard = {
  part: "ammeter",
  name: "Ammeter",
  symbol: "The letter A inside a circle, drawn in series with the wire.",
  whatItDoes: "Measures the current through the wire.",
  howToUse: "Join it in series. Red lead to the + terminal, so the current enters at +.",
  commonMistake: "Putting it in parallel across the wire, or joining + and − the wrong way round.",
};

const SAMPLE_CALLOUTS: Callout[] = [
  { part: "ammeter", label: "Ammeter", sub: "In series with the wire" },
  { part: "voltmeter", label: "Voltmeter", sub: "Across the wire" },
  { part: "box", label: "Resistance box", sub: "Plug key out to add a coil" },
];

/** Fills what a step does not have yet, so every tab has something to show. */
function withSampleText(lesson: Lesson): Lesson {
  return {
    ...lesson,
    steps: lesson.steps.map((s, i) => ({
      ...s,
      plain: s.plain || `Sample next action for step ${i + 1}: tap the part, then the terminal.`,
      callouts: s.callouts ?? (i < 6 ? SAMPLE_CALLOUTS : []),
      whyItWorks: s.whyItWorks ?? [
        "Sample reason one, in plain words.",
        "Sample reason two, a little longer so the line wraps on a phone screen.",
      ],
      precautions: s.precautions ?? [
        "Open the key between readings.",
        "Clean the ends of the connecting wires with sandpaper.",
      ],
    })),
  };
}

const LESSON = withSampleText(OHMS_LAW_LESSON);
const STAGE_TITLES = Object.fromEntries(LESSON.steps.map((st) => [st.key, st.title]));
const CREDIT = creditFromSource(OHMS_LAW_QUESTION.source);

function SampleDiagram() {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="Sample circuit diagram">
      <title>Sample circuit diagram</title>
      <g fill="none" strokeWidth="1.6">
        <path d="M20 30h80M124 30h96v90H20V30" stroke="#1d2430" />
        <path d="M100 30h24" stroke="#9a958a" strokeDasharray="4 4" />
        <circle cx="112" cy="30" r="12" fill="#f8f2e6" stroke="#1d2430" />
        <path d="M100 108v24M108 114v12" stroke="#1d2430" strokeWidth="2" />
      </g>
      <text x="108" y="34" fontSize="11" fill="#1d2430" fontFamily="Barlow, sans-serif">
        A
      </text>
    </svg>
  );
}

const css = `
.sp-grid { position: absolute; inset: 0; background: var(--paper-2); }
.sp-grid svg { display: block; width: 100%; height: 100%; }
.sp-label { position: absolute; left: 0; right: 0; top: 50%; text-align: center;
  font-family: var(--f-cond); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.sp-free { position: absolute; z-index: 1; border: 2px dashed var(--accent); pointer-events: none; }
.sp-rects { position: absolute; z-index: 9; left: 8px; top: 120px; max-width: 420px; margin: 0;
  padding: 4px 6px; background: rgba(248,242,230,.88); color: var(--ink);
  font: 9px/1.25 ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; pointer-events: none; }
`;

/** The paper-grid placeholder: graph paper in thin pencil rules, no picture of the bench. */
function PaperGrid() {
  return (
    <div className="sp-grid">
      <svg aria-hidden="true" focusable="false">
        <defs>
          <pattern id="sp-cells" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="var(--line)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sp-cells)" />
      </svg>
      <div className="sp-label">Bench canvas</div>
    </div>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The geometry diff's source: the free rect the camera is given (dashed), and every region's
 * rect (data-region) as JSON, refreshed twice a second. Rects are in CSS px from the viewport's
 * top left, as getBoundingClientRect reports them.
 */
function Debug({
  covered,
  guide,
  caption,
}: {
  covered: Covered;
  guide: GuideState;
  caption: boolean;
}) {
  const [json, setJson] = useState("");
  useEffect(() => {
    const collect = () => {
      const rects: Record<string, [number, number, number, number]> = {};
      for (const el of document.querySelectorAll<HTMLElement>("[data-region]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        rects[el.dataset.region ?? "?"] = [round(r.x), round(r.y), round(r.width), round(r.height)];
      }
      const l = layoutFor(window.innerWidth, window.innerHeight);
      const out = {
        viewport: [window.innerWidth, window.innerHeight],
        layout: l.mode,
        ui: Math.round(l.ui * 10000) / 10000,
        guide,
        caption,
        covered: {
          left: round(covered.left),
          right: round(covered.right),
          top: round(covered.top),
          bottom: round(covered.bottom),
        },
        rects,
      };
      (window as unknown as { __SHELL_RECTS__?: unknown }).__SHELL_RECTS__ = out;
      setJson(JSON.stringify(out));
    };
    collect();
    const id = window.setInterval(collect, 500);
    return () => window.clearInterval(id);
  }, [covered, guide, caption]);
  return (
    <>
      <div
        className="sp-free"
        style={{
          left: covered.left,
          top: covered.top,
          right: covered.right,
          bottom: covered.bottom,
        }}
      />
      <pre id="shell-rects" className="sp-rects">
        {json}
      </pre>
    </>
  );
}

interface ScreenProps {
  q: URLSearchParams;
  practical: PracticalMode;
  stepIndex: number;
  stepStatus: StepStatus[];
  onStepChange(index: number): void;
  lockedFrom?: number | undefined;
  readOnlyTabs?: boolean | undefined;
  overlay?: ReactNode;
  checklist?: ReactNode;
  bench: OhmsLawBench;
  director: Director | null;
  /** A caption pill is showing, so the camera keeps clear of it. */
  caption: boolean;
}

/** The shell with the preview's state and its canvas (a placeholder, or the real bench). */
function Screen({
  q,
  practical,
  stepIndex,
  stepStatus,
  onStepChange,
  lockedFrom,
  readOnlyTabs,
  overlay,
  checklist,
  bench,
  director,
  caption,
}: ScreenProps) {
  const exam = practical === "exam";
  const mode: LessonMode = exam ? "exam" : "practice";
  const withCanvas = q.get("canvas") === "1";
  const debug = q.get("debug") === "1";
  const tabParam = q.get("tab");
  // The Examiner asks tab is the lesson page's (its mark panel); the director screens have none.
  const withExaminer = q.get("examiner") === "1" || tabParam === "examiner";
  const [tab, setTab] = useState<ShellTab>(
    tabParam === "why" || tabParam === "precautions" || tabParam === "examiner"
      ? tabParam
      : "instructions",
  );
  const [card, setCard] = useState<IdentifyCard | null>(() =>
    q.get("identify") === "1" ? SAMPLE_CARD : null,
  );
  const [diagramOpen, setDiagramOpen] = useState(q.get("diagram") === "1");
  const [guide, setGuide] = useState<GuideState>(q.get("guide") === "open" ? "open" : "peek");
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight] as const);
  const quality: QualityTier = parseOverride(location.search) ?? "high";
  const pinned = Number(q.get("dpr"));

  useEffect(() => {
    const onResize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The paper-grid placeholder has no renderer to say it is ready; the real canvas does.
  useEffect(() => {
    if (withCanvas) return;
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, [withCanvas]);

  // A phone's guide is folded to its peek except on Instructions (the shell's own rule).
  const guideNow: GuideState = tab === "instructions" ? guide : "open";
  const covered = playerCovered(size[0], size[1], { guide: guideNow, caption });

  return (
    <LessonShell
      lesson={LESSON}
      mode={mode}
      practical={practical}
      stepIndex={stepIndex}
      onStepChange={onStepChange}
      stepStatus={stepStatus}
      lockedFrom={lockedFrom}
      readOnlyTabs={readOnlyTabs}
      tab={tab}
      onTabChange={setTab}
      {...(withExaminer
        ? {
            tabContent: {
              examiner: (
                <p>Sample slot: the lesson page passes the examiner's questions in here.</p>
              ),
            },
          }
        : {})}
      notebookSlot={<p>Sample slot: the typed notebook goes here.</p>}
      diagramSlot={<SampleDiagram />}
      diagramOpen={diagramOpen}
      onDiagramOpenChange={setDiagramOpen}
      identify={{ card, onClose: () => setCard(null) }}
      status={{ credit: CREDIT, hideCount: exam }}
      note={MODE_NOTE[practical]}
      guide={guide}
      onGuideChange={setGuide}
      overlay={overlay}
      checklist={checklist}
    >
      {withCanvas ? (
        <Suspense fallback={<PaperGrid />}>
          <ShellCanvas
            bench={bench}
            director={director}
            covered={covered}
            quality={quality}
            dpr={Number.isFinite(pinned) && pinned >= 1 && pinned <= 3 ? pinned : null}
          />
        </Suspense>
      ) : (
        <PaperGrid />
      )}
      {debug ? <Debug covered={covered} guide={guideNow} caption={caption} /> : null}
      <style>{css}</style>
    </LessonShell>
  );
}

/** No director: the strip is driven by a step number, as the lesson page drives it. */
function PlainPreview({ q }: { q: URLSearchParams }) {
  const last = LESSON.steps.length - 1;
  const [stepIndex, setStepIndex] = useState(() =>
    Math.min(last, Math.max(0, Number(q.get("step")) || 0)),
  );
  const lost = useMemo(
    () => (q.get("lost") ?? "").split(",").map((n) => Number.parseInt(n, 10)),
    [q],
  );
  const bench = useMemo(() => createOhmsLawBench(7), []);
  const practical: PracticalMode = q.get("mode") === "exam" ? "exam" : "practice";
  const stepStatus: StepStatus[] = LESSON.steps.map((_, i) =>
    lost.includes(i) ? "lost" : i < stepIndex ? "done" : "todo",
  );
  return (
    <Screen
      q={q}
      practical={practical}
      stepIndex={stepIndex}
      stepStatus={stepStatus}
      onStepChange={setStepIndex}
      bench={bench}
      director={null}
      caption={false}
    />
  );
}

function makeRig(q: URLSearchParams) {
  const mode = modeFrom(q.get("mode"));
  const seed = Number(q.get("seed")) || 7;
  // Watch drives its own bench, on a different seed from the one she would practise on.
  const bench = createOhmsLawBench(mode === "watch" ? demoSeedFor(seed) : seed, {
    mode: mode === "exam" ? "exam" : "practice",
  });
  const voice = createVoice();
  voice.muted = q.get("mute") === "1";
  // Her notebook is never edited here: the same record object every frame (see createDirector).
  const record = emptyOhmsLawRecord("practice");
  const benchState = (): BenchState => ({
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record,
    identified: new Set(),
  });
  const base = { script: SAMPLE_SCRIPT, voice, benchState };
  const options: DirectorOptions =
    mode === "watch" ? { ...base, mode, bench } : { ...base, mode, bench };
  const director = createDirector(options);
  const speed = Number(q.get("speed"));
  if (speed === 1 || speed === 1.5 || speed === 2) director.setSpeed(speed);
  const beat = q.get("beat");
  if (beat !== null && beat !== "" && Number.isFinite(Number(beat))) director.seek(Number(beat));
  if (q.get("play") === "1") director.play();
  return { bench, director };
}

/** The strip, the checklist and the player come from one director on the sample script. */
function DirectedScreen({ q, rig }: { q: URLSearchParams; rig: ReturnType<typeof makeRig> }) {
  const { bench, director } = rig;
  const nav = useStageNav(director, LESSON.steps);
  const practical = director.state.mode;
  return (
    <Screen
      q={q}
      practical={practical}
      stepIndex={nav.stepIndex}
      stepStatus={nav.stepStatus}
      onStepChange={nav.onStepChange}
      lockedFrom={nav.lockedFrom}
      readOnlyTabs={nav.readOnlyTabs}
      overlay={<Player director={director} stageTitles={STAGE_TITLES} />}
      checklist={<StageChecklist director={director} stageTitles={STAGE_TITLES} />}
      bench={bench}
      director={director}
      caption={practical !== "exam" && director.state.caption !== ""}
    />
  );
}

function DirectedPreview({ q }: { q: URLSearchParams }) {
  // Made in an effect and torn down on unmount (StrictMode runs it twice: the first rig is
  // disposed, the second is the one on screen).
  const [rig, setRig] = useState<ReturnType<typeof makeRig> | null>(null);
  useEffect(() => {
    const made = makeRig(q);
    setRig(made);
    return () => made.director.dispose();
  }, [q]);
  return rig ? <DirectedScreen q={q} rig={rig} /> : null;
}

export default function ShellPreview() {
  const q = useMemo(() => new URLSearchParams(location.search), []);
  return q.get("director") === "1" ? <DirectedPreview q={q} /> : <PlainPreview q={q} />;
}
