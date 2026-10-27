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
          bg: "#064e3b",
          border: "#059669",
          text: "#a7f3d0",
        };
      case "partly":
        return {
          label: "Partly correct",
          bg: "#78350f",
          border: "#d97706",
          text: "#fde68a",
        };
      case "needs_work":
        return {
          label: "Needs work",
          bg: "#7f1d1d",
          border: "#dc2626",
          text: "#fecaca",
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
        background: "#0b1120",
        color: "#f8fafc",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxSizing: "border-box",
        padding: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
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
              color: "#38bdf8",
              letterSpacing: "-0.01em",
            }}
          >
            Examiner-style questions
          </h2>
          <p
            style={{
              margin: "3px 0 0 0",
              fontSize: "0.82rem",
              color: "#94a3b8",
            }}
          >
            Examiner (computer voice) &bull; Questions based on your practical mistakes
          </p>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            background: "#1e293b",
            color: "#cbd5e1",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #334155",
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
                background: "#0f172a",
                borderRadius: "10px",
                padding: "12px 14px",
                border: "1px solid #1e293b",
              }}
            >
              {/* Question */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748b",
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
                    color: "#f1f5f9",
                    lineHeight: 1.4,
                  }}
                >
                  {turn.question.text}
                </p>
              </div>

              {/* Student Answer */}
              <div
                style={{
                  background: "#1e293b",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #38bdf8",
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
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>
                    Your answer
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      textTransform: "capitalize",
                      background: "#334155",
                      color: "#cbd5e1",
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
                    color: "#f8fafc",
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
                  background: "#131d31",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  border: "1px solid #1e293b",
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
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                    Examiner (computer voice)
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.92rem",
                    color: "#e2e8f0",
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
                      color: "#38bdf8",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
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
                        background: "#0b1120",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        border: "1px dashed #334155",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#94a3b8",
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
                          color: "#cbd5e1",
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
              background: "#0f172a",
              borderRadius: "10px",
              padding: "14px",
              border: "1px solid #38bdf8",
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
                  color: "#38bdf8",
                }}
              >
                Question {turns.length + 1}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                Examiner (computer voice)
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "#f8fafc",
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
              background: "#064e3b",
              border: "1px solid #059669",
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>🎓</span>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 700,
                color: "#ecfdf5",
              }}
            >
              That's all. Well done for practising.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.82rem",
                color: "#a7f3d0",
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
              background: "#450a0a",
              border: "1px solid #dc2626",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.84rem", color: "#fecaca" }}>{error}</p>
            <button
              type="button"
              onClick={() => handleSend()}
              style={{
                background: "#dc2626",
                border: "none",
                color: "#ffffff",
                padding: "6px 12px",
                borderRadius: "6px",
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
          borderTop: "1px solid #1e293b",
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
              background: "#0f172a",
              borderRadius: "6px",
              padding: "2px",
              border: "1px solid #1e293b",
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
                    background: active ? "#38bdf8" : "transparent",
                    color: active ? "#0f172a" : "#94a3b8",
                    border: "none",
                    borderRadius: "4px",
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
              background: voiceAnswer.state === "listening" ? "#7f1d1d" : "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "0.74rem",
              fontWeight: 500,
              cursor: isCompleted || isSubmitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <span>🎙️</span>
            <span>
              {voiceAnswer.state === "listening"
                ? "Listening… let go to stop"
                : voiceAnswer.state === "thinking"
                  ? "Writing down your words…"
                  : "Hold to speak"}
            </span>
          </button>
        </div>

        {voiceAnswer.error && (
          <p role="status" style={{ margin: "0 0 6px", color: "#fca5a5", fontSize: "0.78rem" }}>
            {voiceAnswer.error}
          </p>
        )}

        {/* Text Input & Send */}
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
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
                  ? "Type your answer here in Pidgin (Press Enter to send)..."
                  : "Type your answer here (Press Enter to send)..."
            }
            disabled={isCompleted || isSubmitting}
            rows={2}
            style={{
              flex: 1,
              background: isCompleted ? "#0f172a" : "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.92rem",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              opacity: isCompleted ? 0.7 : 1,
            }}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isCompleted || isSubmitting || !answer.trim()}
            style={{
              background: isCompleted || isSubmitting || !answer.trim() ? "#1e293b" : "#38bdf8",
              color: isCompleted || isSubmitting || !answer.trim() ? "#64748b" : "#0f172a",
              border: "none",
              borderRadius: "8px",
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
