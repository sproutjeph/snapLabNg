import type { MarkItem, MarkSheet } from "@snaplab/contracts";
import { examinerQuestions } from "@snaplab/rules";
import { halves, RULE_LABEL } from "./marking";
import type { LessonMode } from "./types";

interface RuleGroup {
  rule: MarkItem["rule"];
  earned: number;
  available: number;
  lost: MarkItem[];
}

/** One line per scheme rule (its sub-items summed), in the order the sheet lists them. */
function groupByRule(sheet: MarkSheet): RuleGroup[] {
  const groups = new Map<MarkItem["rule"], RuleGroup>();
  for (const item of sheet.items) {
    const g = groups.get(item.rule) ?? { rule: item.rule, earned: 0, available: 0, lost: [] };
    g.earned += item.marks_earned;
    g.available += item.marks_available;
    if (item.outcome === "lost") g.lost.push(item);
    groups.set(item.rule, g);
  }
  return [...groups.values()];
}

export interface MarkPanelProps {
  sheet: MarkSheet | null;
  /** True when she has changed her notebook since this sheet was marked. */
  stale: boolean;
  onHandIn(): void;
  /** Exam mode allows one hand-in: no "Mark again". */
  mode: LessonMode;
}

/**
 * The "Examiner asks" tab: hand in, the marked sheet item by item, then the examiner's questions
 * picked from the marks she lost. Marks come only from packages/rules (a DRAFT scheme for now).
 * Corrections show how a correct entry looks; nothing here is ever an engine value.
 */
export function MarkPanel({ sheet, stale, onHandIn, mode }: MarkPanelProps) {
  if (!sheet) {
    return (
      <div className="ol-mark">
        <p>
          When your table, precautions and part (b) are written, hand in your notebook. The examiner
          marks only what you wrote.
          {mode === "exam" && " In exam mode you can hand in once."}
        </p>
        <button type="button" className="ol-btn ol-btn-primary" onClick={onHandIn}>
          Hand in for marking
        </button>
        <p className="ol-draft">DRAFT marking scheme: needs a physics teacher's check.</p>
      </div>
    );
  }
  const questions = examinerQuestions(sheet, 3);
  return (
    <div className="ol-mark">
      <p className="ol-score" aria-live="polite">
        {halves(sheet.earned)} / {halves(sheet.available)}
      </p>
      <p className="ol-draft">{sheet.question_label}</p>
      {stale && <p className="ol-stale">You have changed your notebook since this was marked.</p>}
      <ul className="ol-items">
        {groupByRule(sheet).map((g) => (
          <li key={g.rule} className="ol-item" data-outcome={g.lost.length > 0 ? "lost" : "earned"}>
            <span className="ol-item-mark" aria-hidden="true">
              {g.lost.length > 0 ? "✕" : "✓"}
            </span>
            <span className="ol-item-body">
              <span className="ol-item-head">
                {RULE_LABEL[g.rule] ?? g.rule}
                <span className="ol-item-marks">
                  {halves(g.earned)} / {halves(g.available)}
                  <span className="ol-sr">{g.lost.length > 0 ? " some lost" : " all earned"}</span>
                </span>
              </span>
              {g.lost.map((item) => (
                <span key={item.id} className="ol-item-fix">
                  {item.fix_en}
                  {item.correction && <> For example: {item.correction}</>}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {questions.length > 0 && (
        <section className="ol-asks" aria-label="The examiner asks">
          <h3 className="snap-label">The examiner asks</h3>
          {questions.map(({ question, her_mistake }) => (
            <details key={question.id} className="ol-ask">
              <summary>{question.text}</summary>
              {her_mistake && <p className="ol-ask-yours">You wrote: “{her_mistake}”</p>}
              <p>{question.model_answer}</p>
            </details>
          ))}
        </section>
      )}
      {mode === "practice" && (
        <button type="button" className="ol-btn" onClick={onHandIn}>
          Mark again
        </button>
      )}
    </div>
  );
}
