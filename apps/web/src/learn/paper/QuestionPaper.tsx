import type { DiagramComparison } from "@snaplab/engine";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircuitDiagram } from "../wiring/CircuitDiagram";
import "./desk.css";
import "./paper.css";
import { benchHeld, readingRefused, voiceNeverStarted } from "./guidedReading";
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

/** Whether the browser can speak at all. */
function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function QuestionPaper({
  question,
  voice,
  onItemRead,
  onChoose,
  guided,
}: QuestionPaperProps) {
  const [view, setView] = useState<ReadView>(IDLE_VIEW);
  const [muted, setMuted] = useState(voice.muted);
  // Guided: speech was refused until a tap, so the paper asks for one.
  const [needsTap, setNeedsTap] = useState(false);
  const itemRef = useRef(onItemRead);
  itemRef.current = onItemRead;
  const guidedRef = useRef(guided);
  guidedRef.current = guided;
  const isGuided = guided !== undefined;
  const startedAt = useRef(0);
  const tapped = useRef(false);
  const reader = useMemo(
    () =>
      createReadAloud({
        question,
        voice,
        onChange: setView,
        onItemRead: (p) => itemRef.current?.(p),
        onDone: () => {
          const g = guidedRef.current;
          if (!g) return;
          // A voice that is audible and refused to speak ends every sentence at once: that is
          // not a reading. Ask for a tap instead of going on.
          const refused = readingRefused(performance.now() - startedAt.current, {
            muted: voice.muted,
            speechAvailable: canSpeak(),
            tapped: tapped.current,
          });
          if (refused) setNeedsTap(true);
          else g.onDone();
        },
      }),
    [question, voice],
  );
  useEffect(() => () => reader.stop(), [reader]);

  const startReading = useCallback(() => {
    startedAt.current = performance.now();
    reader.start();
  }, [reader]);

  // Guided: read at once. If the voice has not been heard within a moment, ask for a tap. The
  // reader is left running (a cold or network voice may yet start); the prompt goes away if it
  // does, and only the tap restarts the reading.
  useEffect(() => {
    if (!isGuided) return;
    startReading();
    const start = { muted: voice.muted, speechAvailable: canSpeak(), tapped: tapped.current };
    // Until the voice is heard, the bench stays empty: a refused reading must not drop the parts.
    if (benchHeld(false, start)) guidedRef.current?.onHold?.(true);
    if (voice.muted || !canSpeak()) return;
    const t0 = performance.now();
    let heard = false;
    let offered = false;
    const id = setInterval(() => {
      const waited = performance.now() - t0;
      if (window.speechSynthesis.speaking) {
        if (!heard) guidedRef.current?.onHold?.(false);
        heard = true;
        if (offered) {
          offered = false;
          setNeedsTap(false);
        }
      }
      const facts = { muted: voice.muted, speechAvailable: canSpeak(), tapped: tapped.current };
      if (!offered && voiceNeverStarted(waited, heard, facts)) {
        offered = true;
        setNeedsTap(true);
      }
      if (waited >= 10000) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [isGuided, voice, startReading]);

  const tapToStart = () => {
    tapped.current = true;
    setNeedsTap(false);
    // Inside the tap, so the browser lets this speech through; the old reading is cut first, and
    // the parts go back up to drop on their names as the new reading says them.
    reader.stop();
    guidedRef.current?.onRestart?.();
    startReading();
  };

  // Keep the sentence being read in view: the scroll box shows it a quarter of the way down.
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view.instr === null) return;
    const box = scroller.current;
    const item = items.current[view.instr];
    if (!box || !item) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const at = item.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const top = box.scrollTop + at - box.clientHeight * 0.25;
    box.scrollTo({ top: Math.max(0, top), behavior: quiet ? "auto" : "smooth" });
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

          {needsTap ? (
            <div className="qp-tap">
              <button
                type="button"
                className="xp-btn xp-btn-primary qp-tap-btn"
                data-testid="paper-tap"
                onClick={tapToStart}
              >
                <IconSpeaker />
                Tap to start
              </button>
              <p>Your browser needs a tap before it will read aloud.</p>
            </div>
          ) : null}

          <footer className="qp-foot">
            {guided ? (
              <button
                type="button"
                className="xp-btn xp-btn-primary qp-skip"
                data-testid="paper-skip"
                onClick={() => {
                  reader.stop();
                  guided.onSkip();
                }}
              >
                Skip
              </button>
            ) : (
              <>
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
              </>
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}
