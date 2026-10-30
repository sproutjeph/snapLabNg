import { IconBook, IconPage } from "./icons";

/** The credit slot's two lines: a small tracked line above, and a larger line below. */
export interface StatusCredit {
  lead: string;
  line: string;
}

export interface StatusCardProps {
  /** The practical's name; it is the page's heading. */
  title: string;
  /** Stages done and stages in all (from the strip's statuses). */
  done: number;
  total: number;
  /** Exam: no bar and no count. */
  hideCount?: boolean | undefined;
  /** The paper's source. Without it the card is just the practical's name and count. */
  credit?: StatusCredit | undefined;
}

/**
 * Turns the paper's source ("WASSCE (SC) 2018, Physics Paper 3, Question 3B", from
 * `PracticalQuestion.source`) into the credit's two lines: "WASSCE (SC) 2018" over
 * "Physics Paper 3 · Q3B".
 */
export function creditFromSource(source: string): StatusCredit {
  const [lead = "", ...rest] = source.split(",").map((part) => part.trim());
  const line = rest.map((part) => part.replace(/^Question\s+/i, "Q")).join(" · ");
  return { lead, line };
}

/**
 * The status card, top right: the practical's name, how many stages are done (a bar that steps
 * once per stage, and "3/11"), and the paper's source in the credit slot. In compact the credit
 * folds to its mark; on a phone the card drops its frame and shows only the name, bar and
 * count; in a landscape phone it is clipped away.
 */
export default function StatusCard({ title, done, total, hideCount, credit }: StatusCardProps) {
  const pct = total > 0 ? Math.round((100 * Math.min(done, total)) / total) : 0;
  return (
    <section className="sh-status" data-region="status">
      <div className="sh-course">
        <span className="sh-book" aria-hidden="true">
          <IconBook />
        </span>
        <div className="sh-course-meta">
          <h1 className="sh-course-name">{title}</h1>
          {hideCount ? null : (
            <div className="sh-progress">
              <span className="sh-bar" aria-hidden="true">
                <span className="sh-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="sh-count">
                <span aria-hidden="true">
                  {done}/{total}
                </span>
                <span className="sh-sr">
                  {done} of {total} stages done
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      {credit ? (
        <div className="sh-credit">
          <span className="sh-credit-mark" aria-hidden="true">
            <IconPage />
          </span>
          <span className="sh-credit-text sh-txt">
            <span className="sh-credit-lead">{credit.lead}</span>
            {credit.line ? <span className="sh-credit-line">{credit.line}</span> : null}
          </span>
        </div>
      ) : null}
    </section>
  );
}
