import type { OhmsLawGraph } from "@snaplab/contracts";
import "../paper/desk.css";
import { halves } from "../marking";
import "./results.css";
import {
  type CheckCell,
  checkRows,
  parallaxHint,
  ruleLines,
  slopeLine,
  unreadSettings,
} from "./resultsModel";
import type { ResultsProps } from "./types";

// The results after hand-in (docs/plans/exam-redesign.md, "The experience", step 6; D1(b)-(d)),
// drawn like a marked exam script: the score circled in red ink, the marks by rule, then "Check
// against your apparatus" with what she wrote beside what her meters showed. Marks are the rules'
// own; nothing is computed here, and nothing reaches the screen before she hands in.

const Tick = () => (
  <svg className="rs-glyph" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M3.5 10.5 8 15.5 16.5 4.5" />
  </svg>
);

const Cross = () => (
  <svg className="rs-glyph" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M4 4 16 16M16 4 4 16" />
  </svg>
);

/** The score, written in red ink and ringed twice, the way an examiner circles a total. */
function Score({ earned, available }: { earned: string; available: string }) {
  return (
    <div className="rs-score">
      <svg viewBox="0 0 220 110" className="rs-ring" aria-hidden="true" focusable="false">
        <path
          pathLength={1}
          d="M104 10C168 4 212 26 211 55C210 86 160 104 106 101C52 98 10 82 12 52C14 24 62 8 124 12"
        />
        <path pathLength={1} d="M118 12C156 14 196 28 203 50" />
      </svg>
      <p className="rs-total">
        <span className="rs-sr">
          Your mark: {earned} out of {available}
        </span>
        <span aria-hidden="true">
          {earned} / {available}
        </span>
      </p>
    </div>
  );
}

/** Her graph in miniature, drawn from what she plotted. Nothing is added to it. */
function GraphThumb({ graph }: { graph: OhmsLawGraph }) {
  const { width_cm: w, height_cm: h } = graph.sheet;
  const px = (x: number) => 14 + (x / Math.max(w, 1e-5)) * 100;
  const py = (y: number) => 76 - (y / Math.max(h, 1e-5)) * 64;
  return (
    <svg
      className="rs-thumb"
      viewBox="0 0 128 100"
      role="img"
      aria-label="Your graph of V against I, as you drew it"
    >
      <path d="M14 8V76H122" className="rs-axes" />
      {graph.points.map((p) => (
        <path
          key={`${p.x_cm},${p.y_cm}`}
          d={`M${px(p.x_cm) - 2.5} ${py(p.y_cm) - 2.5}l5 5m0 -5l-5 5`}
          className="rs-pt"
        />
      ))}
      {graph.line && (
        <path
          d={`M${px(graph.line.p1.x_cm)} ${py(graph.line.p1.y_cm)}L${px(graph.line.p2.x_cm)} ${py(graph.line.p2.y_cm)}`}
          className="rs-ln"
        />
      )}
      <text x="68" y="94" textAnchor="middle" className="rs-axis-label">
        V against I
      </text>
    </svg>
  );
}

/** What she wrote, and the shape of whether it stands. */
function Reading({ cell }: { cell: CheckCell }) {
  return (
    <>
      <td data-ok={cell.ok ? "1" : "0"}>{cell.wrote || <Dash what="empty" />}</td>
      <td>{cell.showed ?? <Dash what="not read" />}</td>
    </>
  );
}

/** A dash for nothing there, said aloud as what it means. */
function Dash({ what }: { what: string }) {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="rs-sr">{what}</span>
    </>
  );
}

export function Results({ mode, sheet, checks, record, benchOhm, onAgain, onWatch }: ResultsProps) {
  const lines = ruleLines(sheet);
  const rows = checkRows(record, checks);
  const unread = unreadSettings(rows);
  const slope = slopeLine(record, benchOhm);

  return (
    <div className="xp xp-desk rs-page">
      <article className="rs-main" aria-labelledby="rs-title">
        <header className="rs-head">
          <div>
            <p className="xp-caps rs-caps">
              Results <span className="rs-mode">{mode === "exam" ? "Exam" : "Practise"}</span>
            </p>
            <h1 id="rs-title" className="rs-title">
              Ohm's law (V–I)
            </h1>
            <p className="rs-draft">DRAFT marking scheme: needs a physics teacher's check.</p>
          </div>
          <Score earned={halves(sheet.earned)} available={halves(sheet.available)} />
        </header>

        <div className="rs-grid">
          <section className="rs-card" aria-labelledby="rs-marks">
            <h2 id="rs-marks" className="rs-h2">
              Marks
            </h2>
            <ul className="rs-lines">
              {lines.map((l) => (
                <li key={l.rule} data-lost={l.lost ? "1" : "0"}>
                  <span className="rs-line-head">
                    <span className="rs-line-mark">{l.lost ? <Cross /> : <Tick />}</span>
                    <span className="rs-line-label">{l.label}</span>
                    <span className="rs-line-num">
                      {l.earned} / {l.available}
                      <span className="rs-sr">{l.lost ? " some marks lost" : " all earned"}</span>
                    </span>
                  </span>
                  {l.fixes.map((f) => (
                    <span key={f} className="rs-fix">
                      {f}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>

          <div className="rs-side">
            <section className="rs-card" aria-labelledby="rs-check">
              <h2 id="rs-check" className="rs-h2">
                Check against your apparatus
              </h2>
              {rows.length === 0 ? (
                <p className="rs-note">You did not write any readings in your table.</p>
              ) : (
                <table className="rs-table">
                  <thead>
                    <tr>
                      <th scope="col">R (Ω)</th>
                      <th scope="col">I you wrote</th>
                      <th scope="col">I meter showed</th>
                      <th scope="col">V you wrote</th>
                      <th scope="col">V meter showed</th>
                      <th scope="col">
                        <span className="rs-sr">Within one division?</span>
                        <span aria-hidden="true">✓/✕</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} data-ok={r.ok ? "1" : "0"}>
                        <th scope="row">{r.box || <Dash what="empty" />}</th>
                        <Reading cell={r.I} />
                        <Reading cell={r.V} />
                        <td className="rs-verdict">
                          {r.ok ? <Tick /> : <Cross />}
                          <span className="rs-sr">
                            {r.ok ? "Within one division" : "Not within one division"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {parallaxHint(rows) && <p className="rs-hint">Read straight on, avoid parallax.</p>}
              {unread.length > 0 && (
                <p className="rs-hint">
                  You wrote readings for R = {unread.join(", ")} Ω but did not read the meters there
                  with the key closed.
                </p>
              )}
              <p className="rs-slope">
                {slope.yours === null ? (
                  <>You did not write a slope. </>
                ) : (
                  <>
                    Your slope <b>{slope.yours} Ω</b>.{" "}
                  </>
                )}
                The wire is <b>{slope.wire} Ω</b>.
              </p>
            </section>

            <div className="rs-foot">
              {record.graph && <GraphThumb graph={record.graph} />}
              <button type="button" className="xp-btn" onClick={onWatch}>
                Watch the demonstration again
              </button>
              <button type="button" className="xp-btn xp-btn-primary" onClick={onAgain}>
                Try again on a new bench
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
