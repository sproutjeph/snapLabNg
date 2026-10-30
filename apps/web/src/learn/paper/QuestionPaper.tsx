import type { DiagramComparison } from "@snaplab/engine";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CircuitDiagram } from "../wiring/CircuitDiagram";
import "./desk.css";
import "./paper.css";
import { createReadAloud, IDLE_VIEW, type ReadView } from "./readAloud";
import type { QuestionPaperProps } from "./types";

// The question paper (docs/plans/exam-redesign.md, "The experience", step 2): the question typeset
// like an exam paper with our corrected circuit diagram, "Read it to me" with the sentence and
// word being said marked, and the three ways to go on. It shows no reading and no mark.
// Each apparatus item is announced through onItemRead as the voice names it; the stage lands it.

/** The diagram as printed: every line solid ink. It is the question's, not her wiring. */
const PRINTED: DiagramComparison = { matches: true, missing: [], extra: [], issues: [] };

const MODES = [
  { mode: "watch", label: "Watch it done", sub: "The lab does it, with a voice" },
  { mode: "practice", label: "Practise with a guide", sub: "A voice guides each action" },
  { mode: "exam", label: "Exam conditions", sub: "No help, and the clock runs" },
] as const;

function IconSpeaker({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      {muted ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      ) : (
        <>
          <path d="M15.5 9.5a3.6 3.6 0 0 1 0 5" />
          <path d="M18 7a7 7 0 0 1 0 10" />
        </>
      )}
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** One instruction's text, with the sentence being read marked and, inside it, the word. */
function Said({ text, view, index }: { text: string; view: ReadView; index: number }): ReactNode {
  if (view.instr !== index) return text;
  const w = view.word;
  return (
    <span className="qp-sent">
      {w ? (
        <>
          {text.slice(0, w[0])}
          <span className="qp-word">{text.slice(w[0], w[1])}</span>
          {text.slice(w[1])}
        </>
      ) : (
        text
      )}
    </span>
  );
}

/** "WASSCE (SC) 2018, Physics Paper 3, Question 3B" -> the paper and the question number. */
function headings(source: string, title: string) {
  const [, paper, number] = source.split(", ");
  return paper && number
    ? { eyebrow: paper, heading: number, sub: `WASSCE-style · ${title}` }
    : { eyebrow: source, heading: title, sub: "WASSCE-style" };
}

export function QuestionPaper({ question, voice, onItemRead, onChoose }: QuestionPaperProps) {
  const [view, setView] = useState<ReadView>(IDLE_VIEW);
  const [muted, setMuted] = useState(voice.muted);
  const itemRef = useRef(onItemRead);
  itemRef.current = onItemRead;
  const reader = useMemo(
    () =>
      createReadAloud({
        question,
        voice,
        onChange: setView,
        onItemRead: (p) => itemRef.current?.(p),
      }),
    [question, voice],
  );
  useEffect(() => () => reader.stop(), [reader]);

  // Keep the sentence being read in sight.
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (view.instr === null) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items.current[view.instr]?.scrollIntoView({
      block: "nearest",
      behavior: quiet ? "auto" : "smooth",
    });
  }, [view.instr]);

  const { eyebrow, heading, sub } = headings(question.source, question.title);
  const reading = view.reading;
  // The circuit sits under the instruction that points to it, as on a printed paper.
  const diagramAt = Math.max(
    0,
    question.instructions.findIndex((i) => /diagram/i.test(i.text)),
  );

  return (
    <section className="xp qp" aria-labelledby="qp-heading">
      <div className="qp-sheet">
        <div className="qp-frame">
          <header className="qp-head">
            <p className="xp-caps">{eyebrow}</p>
            <h1 id="qp-heading" className="qp-title">
              {heading}
            </h1>
            <p className="qp-sub">{sub}</p>
            <button
              type="button"
              className="qp-mute xp-btn"
              aria-pressed={muted}
              aria-label="Mute the voice"
              onClick={() => {
                voice.muted = !voice.muted;
                setMuted(voice.muted);
              }}
            >
              <IconSpeaker muted={muted} />
            </button>
          </header>

          <div className="qp-scroll">
            <ol className="qp-list">
              {question.instructions.map((ins, i) => (
                <li
                  key={ins.label}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  data-reading={view.instr === i ? "1" : undefined}
                >
                  <span className="qp-label">{ins.label}</span>
                  <span className="qp-text">
                    <Said text={ins.text} view={view} index={i} />
                    {i === diagramAt && (
                      <span className="qp-diagram" inert>
                        <CircuitDiagram
                          comparison={PRINTED}
                          highlight={view.naming}
                          caption={false}
                        />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <footer className="qp-foot">
            <button
              type="button"
              className="xp-btn xp-btn-primary qp-read"
              data-testid="paper-read"
              onClick={() => (reading ? reader.stop() : reader.start())}
            >
              {reading ? <IconStop /> : <IconSpeaker />}
              {reading ? "Stop reading" : "Read it to me"}
            </button>
            <fieldset className="qp-modes">
              <legend className="qp-sr">How do you want to do it?</legend>
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  className={`xp-btn qp-mode${m.mode === "practice" ? " xp-btn-primary" : ""}`}
                  data-testid={`paper-choice-${m.mode}`}
                  onClick={() => {
                    reader.stop();
                    onChoose(m.mode);
                  }}
                >
                  <span>{m.label}</span>
                  <small>{m.sub}</small>
                </button>
              ))}
            </fieldset>
          </footer>
        </div>
      </div>
    </section>
  );
}
