import type { DiagramComparison } from "@snaplab/engine";
import { useEffect, useRef } from "react";
import { CircuitDiagram } from "../wiring/CircuitDiagram";
import { headings, Said } from "./QuestionPaper";
import type { ReadView } from "./readAloud";
import type { PracticalQuestion } from "./types";
import "./desk.css";
import "./paper.css";
import "./guidedPaper.css";

// The question paper as guided Watch shows it (docs/plans/guided-demo.md, "Watch v2"): the whole
// paper, docked on the right, with the step being done marked and kept in view (PaperSheet); or,
// while a board needs the room, just that step as a card (StepCard). Both only draw: the director
// reads and the tracker (sentenceTracker.ts) says where the voice is.

export interface GuidedPaperProps {
  question: PracticalQuestion;
  /** `instr` is the step being done; `word` the word being said, when one is. */
  view: ReadView;
  /** The circuit diagram's lines: a made lead is solid ink. Null: all pencil. */
  comparison: DiagramComparison | null;
  /** The voice is reading this step's sentence: Skip shows. Omitted: no Skip. */
  onSkip?: (() => void) | undefined;
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button type="button" className="xp-btn gp-skip" data-testid="paper-skip" onClick={onSkip}>
      Skip to the work
    </button>
  );
}

/** The whole paper: heading, every step, the diagram under the step that points to it. */
export function PaperSheet({ question, view, comparison, onSkip }: GuidedPaperProps) {
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  // Keep the step being done in view: the scroll box shows it a quarter of the way down.
  useEffect(() => {
    if (view.instr === null) return;
    const box = scroller.current;
    const item = items.current[view.instr];
    if (!box || !item) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const at = item.getBoundingClientRect().top - box.getBoundingClientRect().top;
    // A short box (a phone's sheet) puts the step at the top, so the diagram under it fits.
    const share = box.clientHeight < 420 ? 0.02 : 0.25;
    const top = box.scrollTop + at - box.clientHeight * share;
    box.scrollTo({ top: Math.max(0, top), behavior: quiet ? "auto" : "smooth" });
  }, [view.instr]);

  const { eyebrow, heading, sub } = headings(question.source, question.title);
  const diagramAt = Math.max(
    0,
    question.instructions.findIndex((i) => /diagram/i.test(i.text)),
  );
  return (
    <section className="xp qp gp" aria-labelledby="gp-heading" data-testid="paper-sheet">
      <div className="qp-sheet">
        <div className="qp-frame">
          <header className="qp-head gp-head">
            <p className="xp-caps">{eyebrow}</p>
            <h2 id="gp-heading" className="qp-title">
              {heading}
            </h2>
            <p className="qp-sub">{sub}</p>
          </header>
          <div className="qp-scroll" ref={scroller}>
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
                          comparison={comparison}
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
          {onSkip ? (
            <footer className="qp-foot gp-foot">
              <SkipButton onSkip={onSkip} />
            </footer>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The step being done, alone: its number and sentence, marked, with Skip while it is read. */
export function StepCard({ question, view, onSkip }: Omit<GuidedPaperProps, "comparison">) {
  const i = view.instr ?? 0;
  const ins = question.instructions[i];
  if (!ins) return null;
  return (
    <section className="xp gp-step" aria-label={`Step ${ins.label}`} data-testid="step-card">
      <span className="qp-label gp-step-label">{ins.label}</span>
      <p className="gp-step-text">
        <Said text={ins.text} view={{ ...view, instr: i }} index={i} />
      </p>
      {onSkip ? <SkipButton onSkip={onSkip} /> : null}
    </section>
  );
}
