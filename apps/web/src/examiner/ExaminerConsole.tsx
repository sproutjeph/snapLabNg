import { useEffect, useRef, useState } from "react";
import { cancelSpeech, speak } from "./speak";
import type {
  AnswerLanguage,
  ExaminerConsoleProps,
  ExaminerQuestion,
  ExaminerReply,
  Verdict,
} from "./types";
import { useVoiceAnswer } from "./voice/useVoiceAnswer";

interface CompletedTurn {
  id: string;
  question: ExaminerQuestion;
  answer: string;
  language: AnswerLanguage;
  reply: ExaminerReply;
}

export default function ExaminerConsole({
  first,
  ask,
  maxTurns = 3,
  voice = true,
}: ExaminerConsoleProps) {
  const [turns, setTurns] = useState<CompletedTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<ExaminerQuestion | null>(first);
  const [answer, setAnswer] = useState("");
  // Her spoken words fill the answer box as she speaks; she checks them, then sends.
  const voiceAnswer = useVoiceAnswer((text) => setAnswer(text.slice(0, 600)));
  const [language, setLanguage] = useState<AnswerLanguage>("english");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const turnsEndRef = useRef<HTMLDivElement | null>(null);

  // Abort pending ask and silence speech on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cancelSpeech();
    };
  }, []);

  // Scroll to bottom when turns update or current question changes
  useEffect(() => {
    void turns.length;
    void currentQuestion?.id;
    void isSubmitting;
    void error;
    // Not on mount: inside the flow, the page must not jump past her red ink.
    if (turns.length === 0 && !isSubmitting && !error) return;
    turnsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, currentQuestion?.id, isSubmitting, error]);

  const toggleModelAnswer = (turnId: string) => {
    setExpandedAnswers((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }));
  };

  const isCompleted = currentQuestion === null || turns.length >= maxTurns;

  const handleSend = async (overrideAnswer?: string) => {
    const textToSend = (overrideAnswer !== undefined ? overrideAnswer : answer).trim();
    if (!currentQuestion || !textToSend || isSubmitting) return;

    const questionToSend = currentQuestion;
    const langToSend = language;

    setError(null);
    setIsSubmitting(true);

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const result = await ask(
        {
          question: questionToSend,
          answer: textToSend,
          language: langToSend,
        },
        ac.signal,
      );

      const turnId = `turn-${turns.length}-${Date.now()}`;
      const newTurn: CompletedTurn = {
        id: turnId,
        question: questionToSend,
        answer: textToSend,
        language: langToSend,
        reply: result,
      };

      const nextTurnsCount = turns.length + 1;
      const willBeCompleted = nextTurnsCount >= maxTurns || result.next === null;

      setTurns((prev) => [...prev, newTurn]);
      setAnswer("");
      setCurrentQuestion(willBeCompleted ? null : result.next);

      // Speak reply aloud ONLY after user action (Send), never on mount
      if (voice) {
        const spokenText = willBeCompleted
          ? `${result.reply} That's all. Well done for practising.`
          : `${result.reply} Next question: ${result.next?.text ?? ""}`;
        speak(spokenText);
      }
    } catch (_err: unknown) {
      if (ac.signal.aborted) return;
      setError("The examiner could not be reached. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case "correct":
        return {
          label: "Correct",
          bg: "var(--card)",
          border: "var(--green)",
          text: "var(--green)",
        };
      case "partly":
        return {
          label: "Partly correct",
          bg: "var(--card)",
          border: "var(--accent)",
          text: "var(--ink-2)",
        };
      case "needs_work":
        return {
          label: "Needs work",
          bg: "var(--card)",
          border: "var(--red-ink)",
          text: "var(--red-ink)",
        };
    }
  };

  return (
    <section
      aria-label="Examiner Console"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: "760px",
        margin: "0 auto",
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--f-body)",
        boxSizing: "border-box",
        padding: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "var(--rule)",
          paddingBottom: "12px",
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Examiner-style questions
          </h2>
          <p
            style={{
              margin: "3px 0 0 0",
              fontSize: "0.82rem",
              color: "var(--muted)",
            }}
          >
            Examiner (computer voice) &bull; Questions based on your practical mistakes
          </p>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            background: "var(--card)",
            color: "var(--ink-2)",
            padding: "4px 8px",
            borderRadius: "var(--radius)",
            border: "var(--rule)",
          }}
        >
          Turn {Math.min(turns.length + (isCompleted ? 0 : 1), maxTurns)} of {maxTurns}
        </div>
      </header>

      {/* Conversation Thread */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          paddingRight: "4px",
        }}
      >
        {turns.map((turn, index) => {
          const badge = getVerdictBadge(turn.reply.verdict);
          const isModelAnswerVisible = !!expandedAnswers[turn.id];

          return (
            <div
              key={turn.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "var(--card)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
                border: "var(--rule)",
              }}
            >
              {/* Question */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    fontFamily: "var(--f-cond)",
                    letterSpacing: "0.06em",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Question {index + 1}
                  {turn.question.rule ? ` • ${turn.question.rule}` : ""}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.96rem",
                    fontWeight: 600,
                    color: "var(--ink)",
                    lineHeight: 1.4,
                  }}
                >
                  {turn.question.text}
                </p>
              </div>

              {/* Student Answer */}
              <div
                style={{
                  background: "var(--paper-2)",
                  borderRadius: "var(--radius)",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--ink)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>
                    Your answer
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      textTransform: "capitalize",
                      background: "var(--paper)",
                      color: "var(--ink-2)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {turn.language}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {turn.answer}
                </p>
              </div>

              {/* Examiner Reply & Verdict */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  background: "var(--paper-2)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  border: "var(--rule)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "9999px",
                      background: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    Examiner (computer voice)
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.92rem",
                    color: "var(--ink-2)",
                    lineHeight: 1.45,
                  }}
                >
                  {turn.reply.reply}
                </p>

                {/* Model Answer Accordion */}
                <div style={{ marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => toggleModelAnswer(turn.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      minHeight: "var(--tap)",
                      padding: "4px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    aria-expanded={isModelAnswerVisible}
                  >
                    {isModelAnswerVisible ? "▴ Hide model answer" : "▾ Show model answer"}
                  </button>
                  {isModelAnswerVisible && (
                    <div
                      style={{
                        marginTop: "6px",
                        background: "var(--paper)",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        border: "1px dashed var(--pencil)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--muted)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Model answer (formal English)
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.85rem",
                          color: "var(--ink-2)",
                          lineHeight: 1.4,
                        }}
                      >
                        {turn.reply.modelAnswer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Current Active Question Bubble */}
        {!isCompleted && currentQuestion && (
          <div
            aria-live="polite"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              padding: "14px",
              border: "1px solid var(--ink)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--ink)",
                }}
              >
                Question {turns.length + 1}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                Examiner (computer voice)
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--ink)",
                lineHeight: 1.45,
              }}
            >
              {currentQuestion.text}
            </p>
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: "var(--card)",
              border: "1px solid var(--green)",
              borderRadius: "var(--radius)",
              padding: "14px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--green)",
              }}
            >
              That's all. Well done for practising.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.82rem",
                color: "var(--green)",
              }}
            >
              You answered {turns.length} examiner {turns.length === 1 ? "question" : "questions"}.
            </p>
          </div>
        )}

        {/* Error / Retry Banner */}
        {error && (
          <div
            role="alert"
            style={{
              background: "var(--card)",
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-2)" }}>{error}</p>
            <button
              type="button"
              onClick={() => handleSend()}
              style={{
                background: "var(--ink)",
                border: "1px solid var(--ink)",
                color: "var(--paper)",
                minHeight: "var(--tap)",
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div ref={turnsEndRef} />
      </div>

      {/* Answer Box (Always Visible) */}
      <footer
        style={{
          borderTop: "var(--rule)",
          paddingTop: "12px",
          marginTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {/* Controls: Language toggle & Hold to speak button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {/* Language Toggle */}
          <fieldset
            style={{
              display: "inline-flex",
              background: "var(--paper-2)",
              borderRadius: "var(--radius)",
              padding: "2px",
              border: "var(--rule)",
              margin: 0,
            }}
          >
            <legend
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                borderWidth: 0,
              }}
            >
              Answer language
            </legend>
            {(["english", "pidgin", "mixed"] as const).map((lang) => {
              const active = language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={active}
                  style={{
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--muted)",
                    border: "none",
                    borderRadius: "var(--radius)",
                    minHeight: "var(--tap)",
                    padding: "4px 8px",
                    fontSize: "0.74rem",
                    fontWeight: active ? 700 : 500,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {lang}
                </button>
              );
            })}
          </fieldset>
        </div>

        {voiceAnswer.error && (
          <p
            role="status"
            style={{ margin: "0 0 6px", color: "var(--ink-2)", fontSize: "0.78rem" }}
          >
            {voiceAnswer.error}
          </p>
        )}

        {/* Text Input & Send */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            value={answer}
            maxLength={600}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isCompleted
                ? "All questions completed. Well done!"
                : language === "pidgin"
                  ? "Hold the mic and speak, or type in Pidgin (Enter sends)…"
                  : "Hold the mic and speak, or type your answer (Enter sends)…"
            }
            disabled={isCompleted || isSubmitting}
            rows={2}
            style={{
              flex: "1 1 260px",
              background: "var(--card)",
              color: "var(--ink)",
              border: "1px solid var(--ink-2)",
              borderRadius: "var(--radius)",
              padding: "8px 12px",
              fontSize: "0.92rem",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              opacity: isCompleted ? 0.7 : 1,
            }}
          />
          {/* Hold to speak: her voice goes to the server's relay; her words fill the box */}
          <button
            type="button"
            disabled={isCompleted || isSubmitting}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              void voiceAnswer.start();
            }}
            onPointerUp={() => voiceAnswer.stop()}
            onPointerCancel={() => voiceAnswer.stop()}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                void voiceAnswer.start();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") voiceAnswer.stop();
            }}
            aria-pressed={voiceAnswer.state === "listening"}
            style={{
              background: voiceAnswer.state === "listening" ? "var(--ink)" : "var(--card)",
              color: voiceAnswer.state === "listening" ? "var(--paper)" : "var(--ink)",
              border: "1px solid var(--ink-2)",
              borderRadius: "var(--radius)",
              padding: "10px 16px",
              height: "46px",
              fontSize: "0.9rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: isCompleted || isSubmitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <span>
              {voiceAnswer.state === "listening"
                ? "Listening… let go to stop"
                : voiceAnswer.state === "thinking"
                  ? "Writing down your words…"
                  : "Hold to speak"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isCompleted || isSubmitting || !answer.trim()}
            style={{
              background:
                isCompleted || isSubmitting || !answer.trim() ? "var(--paper-2)" : "var(--ink)",
              color:
                isCompleted || isSubmitting || !answer.trim() ? "var(--muted)" : "var(--paper)",
              border: "none",
              borderRadius: "var(--radius)",
              padding: "10px 18px",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: isCompleted || isSubmitting || !answer.trim() ? "not-allowed" : "pointer",
              height: "46px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {isSubmitting ? "Checking..." : "Send"}
          </button>
        </div>
      </footer>
    </section>
  );
}
