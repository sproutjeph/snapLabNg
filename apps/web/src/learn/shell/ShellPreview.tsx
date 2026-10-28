import { useEffect, useMemo, useState } from "react";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import type { Callout, IdentifyCard, Lesson, LessonMode } from "../types";
import LessonShell, { type ShellTab, type StepStatus } from "./LessonShell";

// ?shell=1 preview of the lesson shell with the stub lesson.
//   &step=<n>      0-based current step (default 0)
//   &mode=exam     exam badge
//   &identify=1    a sample Identify card
//   &diagram=1     opens the "Compare with diagram" card with a placeholder diagram
//   &lost=<n,n>    steps shown as lost (✕); every step before the current one is otherwise done
// The stub lesson has no plain lines or callouts yet, so this page adds neutral sample text.

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

export default function ShellPreview() {
  const q = new URLSearchParams(location.search);
  const lesson = useMemo(() => withSampleText(OHMS_LAW_LESSON), []);
  const last = lesson.steps.length - 1;
  const [stepIndex, setStepIndex] = useState(() =>
    Math.min(last, Math.max(0, Number(q.get("step")) || 0)),
  );
  const [tab, setTab] = useState<ShellTab>("instructions");
  const [card, setCard] = useState<IdentifyCard | null>(() =>
    q.get("identify") === "1" ? SAMPLE_CARD : null,
  );
  const [diagramOpen, setDiagramOpen] = useState(q.get("diagram") === "1");
  const mode: LessonMode = q.get("mode") === "exam" ? "exam" : "practice";
  const lost = useMemo(
    () => (q.get("lost") ?? "").split(",").map((n) => Number.parseInt(n, 10)),
    [q],
  );

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, []);

  const stepStatus: StepStatus[] = lesson.steps.map((_, i) =>
    lost.includes(i) ? "lost" : i < stepIndex ? "done" : "todo",
  );

  return (
    <LessonShell
      lesson={lesson}
      mode={mode}
      stepIndex={stepIndex}
      onStepChange={setStepIndex}
      stepStatus={stepStatus}
      tab={tab}
      onTabChange={setTab}
      tabContent={{
        examiner: <p>Sample slot: the lesson page passes the examiner's questions in here.</p>,
      }}
      notebookSlot={<p>Sample slot: the typed notebook goes here.</p>}
      diagramSlot={<SampleDiagram />}
      diagramOpen={diagramOpen}
      onDiagramOpenChange={setDiagramOpen}
      identify={{ card, onClose: () => setCard(null) }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "var(--paper-2)",
          color: "var(--muted)",
          fontFamily: "var(--f-cond)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Bench canvas
      </div>
    </LessonShell>
  );
}
