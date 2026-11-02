import type { Box, QuestionEvent, QuestionRead } from "@snaplab/contracts";
import { useEffect, useRef, useState } from "react";
import { CameraView } from "../capture/CameraView";
import "../learn/paper/desk.css";
import { navigate } from "../navigate";
import { streamQuestion } from "./client";
import { FoundOverlay } from "./FoundOverlay";
import "./snapq.css";
import { SAMPLE_PHOTOS, SNAPPED_PRACTICAL_URL, setSnappedPaper } from "./store";
import { toJpeg } from "./toJpeg";

// Snap your question (docs/plans/snap-question.md, "Muse: snap page"): she photographs the
// printed question, Meta reads it, and an Ohm's law paper goes on to Build the bench. The AI
// only reads; it never sets a current, a voltage or a mark.

/** Where Use the app's question goes: the Ohm's law paper the app ships. */
export const APP_QUESTION_URL = "/?practical=ohms-law";

type Timing = Extract<QuestionEvent, { type: "timing" }>;

/** What the stream has given the page so far. Pure, so the three endings can be tested. */
export interface SnapState {
  question: QuestionRead | null;
  outlines: ReadonlyMap<number, Box>;
  timings: readonly Timing[];
  error: string | null;
  done: boolean;
}

export const EMPTY_SNAP: SnapState = {
  question: null,
  outlines: new Map(),
  timings: [],
  error: null,
  done: false,
};

/** Folds one validated event into the page state. */
export function applyQuestionEvent(state: SnapState, event: QuestionEvent): SnapState {
  switch (event.type) {
    case "question":
      return { ...state, question: event.question };
    case "part_outline": {
      const outlines = new Map(state.outlines);
      outlines.set(event.part, event.box);
      return { ...state, outlines };
    }
    case "timing":
      return { ...state, timings: [...state.timings, event] };
    case "error":
      return { ...state, error: event.message };
    case "done":
      return { ...state, done: true };
    default:
      return state;
  }
}

/** The name she sees for a practical, with the WAEC spelling "metre bridge". */
export function experimentName(experiment: QuestionRead["experiment"]): string {
  switch (experiment) {
    case "ohms_law_vi":
      return "Ohm's law (V–I)";
    case "meter_bridge":
      return "metre bridge";
    case "titration":
      return "titration";
    case "glass_block":
      return "glass block";
    case "unknown":
      return "not recognised";
  }
}

const KIND_NAME: Record<string, string> = {
  cells: "cells",
  key: "key",
  ammeter: "ammeter",
  voltmeter: "voltmeter",
  resistance_box: "resistance box",
  rheostat: "rheostat",
  wire_xy: "wire XY",
  metre_rule: "metre rule",
  connecting_wires: "connecting wires",
  galvanometer: "galvanometer",
  other: "apparatus",
};

export interface ResultPanelProps {
  question: QuestionRead | null;
  error: string | null;
  onBuild: () => void;
  onUseAppQuestion: () => void;
  onSnapAgain: () => void;
}

/** The three ways a read can end. Every one offers a way on; there is no dead end. */
export function ResultPanel({
  question,
  error,
  onBuild,
  onUseAppQuestion,
  onSnapAgain,
}: ResultPanelProps) {
  if (question?.experiment === "ohms_law_vi") {
    return (
      <section className="sq-result" data-testid="snapq-result-ohms">
        <p className="xp-caps">Your question</p>
        <h2 className="sq-result-name">Ohm's law (V–I)</h2>
        {question.source_as_printed ? (
          <p className="sq-source">{question.source_as_printed}</p>
        ) : null}
        {question.title_as_printed ? (
          <p className="sq-source">{question.title_as_printed}</p>
        ) : null}
        <div className="sq-actions">
          <button
            type="button"
            className="xp-btn xp-btn-primary"
            data-testid="snapq-build"
            onClick={onBuild}
          >
            Build the bench
          </button>
          <button type="button" className="xp-btn" onClick={onSnapAgain}>
            Snap again
          </button>
        </div>
      </section>
    );
  }
  if (question) {
    return (
      <section className="sq-result" data-testid="snapq-result-other">
        <p className="sq-message">
          This looks like {experimentName(question.experiment)}. Only Ohm's law is ready.
        </p>
        <div className="sq-actions">
          <button type="button" className="xp-btn xp-btn-primary" onClick={onUseAppQuestion}>
            Use the app's question
          </button>
          <button type="button" className="xp-btn" onClick={onSnapAgain}>
            Snap again
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="sq-result" data-testid="snapq-result-error">
      <p className="sq-message">{error ?? "We could not read that question."}</p>
      <div className="sq-actions">
        <button type="button" className="xp-btn" onClick={onSnapAgain}>
          Snap again
        </button>
        <button type="button" className="xp-btn xp-btn-primary" onClick={onUseAppQuestion}>
          Use the app's question
        </button>
      </div>
    </section>
  );
}

interface PickedPhoto {
  blob: Blob;
  url: string;
}

export interface SnapQuestionPageProps {
  /** The event stream; tests pass a mocked read in place of the real /api/question. */
  stream?: typeof streamQuestion;
}

export default function SnapQuestionPage({ stream = streamQuestion }: SnapQuestionPageProps) {
  const [phase, setPhase] = useState<"pick" | "reading" | "result">("pick");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [snap, setSnap] = useState<SnapState>(EMPTY_SNAP);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const photosRef = useRef<PickedPhoto[]>([]);
  photosRef.current = photos;
  const handedOffRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      abortRef.current?.abort();
      // URLs handed to setSnappedPaper belong to the store; never revoke those.
      if (!handedOffRef.current) {
        for (const p of photosRef.current) URL.revokeObjectURL(p.url);
      }
    };
  }, []);

  const addBlob = (blob: Blob) => {
    if (photosRef.current.length >= 2) return;
    const entry = { blob, url: URL.createObjectURL(blob) };
    setPhotos((prev) => (prev.length >= 2 ? prev : [...prev, entry]));
  };

  const removePhoto = (index: number) => {
    const gone = photosRef.current[index];
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const onCameraCapture = (canvas: HTMLCanvasElement) => {
    setShowCamera(false);
    canvas.toBlob(
      (blob) => {
        if (blob) addBlob(blob);
        else setPickError("Could not take that photo. Try again.");
      },
      "image/jpeg",
      0.85,
    );
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setPickError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 2 - photos.length)) {
        addBlob(await toJpeg(file));
      }
    } catch {
      setPickError("Could not read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const trySample = async () => {
    setPickError(null);
    setBusy(true);
    try {
      const blobs: Blob[] = [];
      for (const src of SAMPLE_PHOTOS) {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`sample ${res.status}`);
        blobs.push(await toJpeg(await res.blob()));
      }
      const entries = blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }));
      for (const p of photosRef.current) URL.revokeObjectURL(p.url);
      setPhotos(entries);
    } catch {
      setPickError("Could not load the sample. Snap your own question instead.");
    } finally {
      setBusy(false);
    }
  };

  const read = async () => {
    if (photos.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSnap(EMPTY_SNAP);
    setHighlight(null);
    setPhase("reading");
    try {
      await stream(
        photos.map((p) => p.blob),
        (event) => setSnap((prev) => applyQuestionEvent(prev, event)),
        controller.signal,
      );
    } catch {
      if (!controller.signal.aborted) {
        setSnap((prev) => ({
          ...prev,
          error:
            prev.error ?? "We could not read that question. Check your connection and try again.",
        }));
      }
    } finally {
      if (!controller.signal.aborted) setPhase("result");
    }
  };

  const snapAgain = () => {
    abortRef.current?.abort();
    handedOffRef.current = false;
    for (const p of photosRef.current) URL.revokeObjectURL(p.url);
    setPhotos([]);
    setSnap(EMPTY_SNAP);
    setPickError(null);
    setHighlight(null);
    setPhase("pick");
  };

  const goAppQuestion = () => navigate(APP_QUESTION_URL);

  const buildBench = () => {
    if (!snap.question) return;
    handedOffRef.current = true;
    setSnappedPaper({
      question: snap.question,
      photos: photos.map((p) => p.url),
      outlines: new Map(snap.outlines),
    });
    navigate(SNAPPED_PRACTICAL_URL);
  };

  const question = snap.question;
  const diagramPhoto =
    question && photos[question.diagram.photo] ? photos[question.diagram.photo] : photos[0];

  return (
    <div className="xp xp-desk sq-page">
      <main className="sq-main" data-testid="snapq-page">
        <a
          className="xp-link sq-back"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          Back to home
        </a>
        <h1 className="sq-title">Snap your question</h1>
        <p className="sq-lede">
          Photograph your printed practical question — one page, or the question and its diagram as
          two. Meta reads which practical it is and what it asks. The bench and the marks still come
          from the app.
        </p>

        {phase === "pick" ? (
          <section className="sq-card">
            {showCamera ? (
              <div className="sq-camera">
                <CameraView onCapture={onCameraCapture} />
                <button
                  type="button"
                  className="xp-btn sq-close-camera"
                  onClick={() => setShowCamera(false)}
                >
                  Close camera
                </button>
              </div>
            ) : (
              <>
                {photos.length > 0 ? (
                  <ul className="sq-thumbs">
                    {photos.map((p, i) => (
                      <li key={p.url} className="sq-thumb">
                        <img src={p.url} alt={`Page ${i + 1} you added`} />
                        <button
                          type="button"
                          className="xp-btn sq-remove"
                          onClick={() => removePhoto(i)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sq-hint">
                    No photos yet. Add the question page, and its diagram if it is on another page.
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="sq-actions">
                  {photos.length < 2 ? (
                    <>
                      <button type="button" className="xp-btn" onClick={() => setShowCamera(true)}>
                        Take a photo
                      </button>
                      <button
                        type="button"
                        className="xp-btn"
                        onClick={() => fileRef.current?.click()}
                      >
                        Choose photos
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="xp-btn"
                    disabled={busy}
                    onClick={() => void trySample()}
                  >
                    Try a sample
                  </button>
                  <button type="button" className="xp-btn" onClick={goAppQuestion}>
                    Use the app's question
                  </button>
                </div>
                {pickError ? <p className="sq-error">{pickError}</p> : null}
                <button
                  type="button"
                  className="xp-btn xp-btn-primary sq-read"
                  data-testid="snapq-read"
                  disabled={photos.length === 0 || busy}
                  onClick={() => void read()}
                >
                  Read my question
                </button>
              </>
            )}
          </section>
        ) : null}

        {phase !== "pick" ? (
          <section className="sq-card">
            {phase === "reading" ? (
              <h2 className="sq-reading">Meta is reading your question…</h2>
            ) : null}
            {diagramPhoto ? (
              <div className="sq-diagram">
                {question ? (
                  <FoundOverlay
                    photo={diagramPhoto.url}
                    parts={question.diagram.parts}
                    outlines={snap.outlines}
                    highlight={highlight}
                  />
                ) : (
                  <img className="sq-photo" src={diagramPhoto.url} alt="Your question" />
                )}
              </div>
            ) : null}
            {question ? (
              <div className="sq-found">
                <h2 className="sq-result-name">{experimentName(question.experiment)}</h2>
                {question.source_as_printed ? (
                  <p className="sq-source">{question.source_as_printed}</p>
                ) : null}
                {question.title_as_printed ? (
                  <p className="sq-source">{question.title_as_printed}</p>
                ) : null}
                {question.apparatus.length > 0 ? (
                  <>
                    <h3 className="sq-sub">Apparatus</h3>
                    <ul className="sq-parts">
                      {question.apparatus.map((a) => (
                        <li key={`${a.kind}-${a.text_as_printed}`}>{a.text_as_printed}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {question.instructions.length > 0 ? (
                  <>
                    <h3 className="sq-sub">The question</h3>
                    <ul className="sq-instructions">
                      {question.instructions.map((ins) => (
                        <li key={ins.label}>
                          <span className="sq-label">{ins.label}</span> {ins.text}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {question.diagram.parts.length > 0 ? (
                  <div className="sq-actions">
                    {question.diagram.parts.map((part, i) => (
                      <button
                        key={`${part.kind}-${part.label_as_printed ?? "part"}-${part.box.x0}`}
                        type="button"
                        className="xp-btn"
                        aria-pressed={highlight === i}
                        onClick={() => setHighlight(highlight === i ? null : i)}
                      >
                        {part.label_as_printed ? `${part.label_as_printed} · ` : ""}
                        {KIND_NAME[part.kind] ?? part.kind}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="xp-btn sq-ai-toggle"
              aria-expanded={showAi}
              onClick={() => setShowAi(!showAi)}
            >
              Show the AI
            </button>
            {showAi ? (
              snap.timings.length > 0 ? (
                <ul className="sq-timings" data-testid="snapq-timings">
                  {snap.timings.map((t) => (
                    <li key={t.id}>
                      {t.model} · {t.label} · {Math.max(0, Math.round(t.end_ms - t.start_ms))} ms
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sq-hint">No model calls yet.</p>
              )
            ) : null}

            {phase === "result" ? (
              <ResultPanel
                question={question}
                error={snap.error}
                onBuild={buildBench}
                onUseAppQuestion={goAppQuestion}
                onSnapAgain={snapAgain}
              />
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
