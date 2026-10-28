import { ROUTES } from "./links";

interface ExperimentStatus {
  name: string;
  status: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
}

const EXPERIMENTS: ExperimentStatus[] = [
  {
    name: "Metre bridge",
    status: "Ready",
    badgeBg: "var(--card)",
    badgeColor: "var(--green)",
    badgeBorder: "1px solid var(--green)",
  },
  {
    name: "Titration",
    status: "Coming soon",
    badgeBg: "var(--card)",
    badgeColor: "var(--ink-2)",
    badgeBorder: "1px solid var(--ink-2)",
  },
  {
    name: "Glass block",
    status: "Later",
    badgeBg: "var(--card)",
    badgeColor: "var(--muted)",
    badgeBorder: "1px dashed var(--pencil)",
  },
];

export default function HomePage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--f-body)",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        padding: "24px 20px 48px",
      }}
    >
      <style>{`
        .snaplab-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
        }
      `}</style>
      <main style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <header style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            SnapLab NG
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--muted)", margin: 0 }}>
            Snap your WAEC practical. Watch it come alive. Get marked like the exam.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <a
            href={ROUTES.snap}
            className="snaplab-btn"
            style={{
              flex: "1 1 200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "var(--tap)",
              padding: "12px 20px",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              border: "1px solid var(--ink)",
              textDecoration: "none",
              fontFamily: "var(--f-cond)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontSize: 16,
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            Snap my practical
          </a>
          <a
            href={ROUTES.demo}
            className="snaplab-btn"
            style={{
              flex: "1 1 200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "var(--tap)",
              padding: "12px 20px",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--card)",
              color: "var(--ink)",
              border: "1px solid var(--ink-2)",
              textDecoration: "none",
              fontFamily: "var(--f-cond)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontSize: 16,
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            Try a demo page
          </a>
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
            How it works
          </h2>
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              color: "var(--ink-2)",
              lineHeight: 1.6,
              fontSize: 15,
            }}
          >
            <li style={{ marginBottom: 8 }}>Snap your notebook page.</li>
            <li style={{ marginBottom: 8 }}>Your apparatus comes alive as a 3D lab.</li>
            <li>Get your marks in red ink, then answer examiner-style questions.</li>
          </ol>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
            Experiments
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {EXPERIMENTS.map((exp) => (
              <li
                key={exp.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  backgroundColor: "var(--card)",
                  borderRadius: "var(--radius)",
                  border: "var(--rule)",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                  {exp.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--f-cond)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "var(--radius)",
                    backgroundColor: exp.badgeBg,
                    color: exp.badgeColor,
                    border: exp.badgeBorder,
                  }}
                >
                  {exp.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
            Your privacy
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6, fontSize: 15 }}>
            Your name and school at the top of the page are blurred on your phone before upload.
            Your photo is not saved.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
            How marking works
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6, fontSize: 15 }}>
            Meta's Muse Spark, Muse Wonder and SAM 3.1 read your page. The marks come from a fixed
            rule engine, so the same page always gets the same score. The AI never decides your
            marks.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
            Teachers
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6, fontSize: 15 }}>
            After a snap, tap For teachers in the corner to enter your measured value and mark
            accuracy.
          </p>
        </section>

        <footer style={{ marginTop: 40, borderTop: "var(--rule)", paddingTop: 20 }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            <a href="/?about=1" className="snaplab-btn" style={{ color: "var(--ink)" }}>
              About SnapLab NG
            </a>
            {" · "}Not affiliated with WAEC. Built for the Meta Global AI Developer Hackathon, 2026.
          </p>
        </footer>
      </main>
    </div>
  );
}
