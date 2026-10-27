import { ROUTES } from "./links";

interface ExperimentStatus {
  name: string;
  status: string;
  badgeBg: string;
  badgeColor: string;
}

const EXPERIMENTS: ExperimentStatus[] = [
  { name: "Metre bridge", status: "Ready", badgeBg: "#064e3b", badgeColor: "#6ee7b7" },
  { name: "Titration", status: "Coming soon", badgeBg: "#1e293b", badgeColor: "#cbd5e1" },
  { name: "Glass block", status: "Later", badgeBg: "#1e293b", badgeColor: "#94a3b8" },
];

export default function HomePage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0f14",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        padding: "24px 20px 48px",
      }}
    >
      <style>{`
        .snaplab-btn:focus-visible {
          outline: 2px solid #38bdf8;
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
          <p style={{ fontSize: 16, lineHeight: 1.5, color: "#94a3b8", margin: 0 }}>
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
              minHeight: 48,
              padding: "12px 20px",
              borderRadius: 10,
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
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
              minHeight: 48,
              padding: "12px 20px",
              borderRadius: 10,
              backgroundColor: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 16,
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            Try a demo page
          </a>
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#f8fafc" }}>
            How it works
          </h2>
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              color: "#cbd5e1",
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
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#f8fafc" }}>
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
                  backgroundColor: "#131b26",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: "#f8fafc" }}>{exp.name}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: exp.badgeBg,
                    color: exp.badgeColor,
                  }}
                >
                  {exp.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#f8fafc" }}>
            Your privacy
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6, fontSize: 15 }}>
            Your name and school at the top of the page are blurred on your phone before upload.
            Your photo is not saved.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#f8fafc" }}>
            How marking works
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6, fontSize: 15 }}>
            Meta's Muse Spark, Muse Wonder and SAM 3.1 read your page. The marks come from a fixed
            rule engine, so the same page always gets the same score. The AI never decides your
            marks.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#f8fafc" }}>
            Teachers
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6, fontSize: 15 }}>
            After a snap, tap For teachers in the corner to enter your measured value and mark
            accuracy.
          </p>
        </section>

        <footer style={{ marginTop: 40, borderTop: "1px solid #1e293b", paddingTop: 20 }}>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
            <a href="/?about=1" className="snaplab-btn" style={{ color: "#7dd3fc" }}>
              About SnapLab NG
            </a>
            {" · "}Not affiliated with WAEC. Built for the Meta Global AI Developer Hackathon, 2026.
          </p>
        </footer>
      </main>
    </div>
  );
}
