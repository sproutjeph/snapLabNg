import "../paper/desk.css";
import "./conclusion.css";

export interface ConclusionCardProps {
  title: string;
  /** 3–5 short lines, each one sentence. */
  lines: readonly string[];
  onReplay(): void;
  onHome(): void;
}

/**
 * End-of-demonstration card shown after Watch finishes the practical: summarises the key
 * takeaways and offers Replay and Home actions.
 */
export function ConclusionCard({ title, lines, onReplay, onHome }: ConclusionCardProps) {
  return (
    <section className="xp cc-card" data-testid="conclusion" aria-labelledby="cc-heading">
      <p className="cc-eyebrow">Practical complete</p>
      <h2 id="cc-heading" className="cc-title">
        {title}
      </h2>
      <ul className="cc-lines">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the lines are a fixed ordered list; two may read alike
          <li key={i} className="cc-line">
            {line}
          </li>
        ))}
      </ul>
      <div className="cc-actions">
        <button
          type="button"
          className="xp-btn xp-btn-primary"
          data-testid="conclusion-replay"
          onClick={onReplay}
        >
          Replay
        </button>
        <button type="button" className="xp-btn" data-testid="conclusion-home" onClick={onHome}>
          Home
        </button>
      </div>
    </section>
  );
}
