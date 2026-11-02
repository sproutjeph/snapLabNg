import { useEffect, useRef } from "react";
import "./guidedEnd.css";

// The guided demonstration's end panel (docs/plans/guided-demo.md). TEMPORARY: it takes exactly
// the props of Gemini's `learn/end/ConclusionCard`, so the lead swaps it in with one import line
// in LearnPage.tsx. It shows the conclusion lines and two buttons; no marks.

export interface GuidedEndProps {
  title: string;
  /** 3 to 5 short lines, each one sentence. */
  lines: readonly string[];
  /** Plays the demonstration again from its first beat, on a reset bench. */
  onReplay(): void;
  /** Back to the home page. */
  onHome(): void;
}

export default function GuidedEnd({ title, lines, onReplay, onHome }: GuidedEndProps) {
  const replay = useRef<HTMLButtonElement>(null);
  // The panel appears on its own at the end: put the keyboard on its first button.
  useEffect(() => replay.current?.focus(), []);
  return (
    <div className="ge-layer">
      <section className="ge-card" data-testid="conclusion" aria-label={title}>
        <h2 className="ge-title">{title}</h2>
        <ol className="ge-lines">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className="ge-actions">
          <button
            ref={replay}
            type="button"
            className="ge-btn ge-btn-primary"
            data-testid="conclusion-replay"
            onClick={onReplay}
          >
            Replay
          </button>
          <button type="button" className="ge-btn" data-testid="conclusion-home" onClick={onHome}>
            Home
          </button>
        </div>
      </section>
    </div>
  );
}
