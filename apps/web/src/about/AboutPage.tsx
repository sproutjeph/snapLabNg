import { ABOUT_SECTIONS } from "./content";

export default function AboutPage() {
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
        .snaplab-back-link:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
        }
      `}</style>
      <main style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: 20 }}>
          <a
            href="/?home=1"
            className="snaplab-back-link"
            style={{
              color: "var(--ink)",
              textDecoration: "none",
              fontFamily: "var(--f-cond)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              minHeight: "var(--tap)",
            }}
          >
            ← Back to home
          </a>
        </div>

        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            About SnapLab NG
          </h1>
        </header>

        {ABOUT_SECTIONS.map((section) => {
          const bullets = section.bullets ?? [];
          return (
            <section key={section.id} id={section.id} style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: "0 0 12px",
                  color: "var(--ink)",
                }}
              >
                {section.heading}
              </h2>
              {section.paragraphs.map((p, idx) => (
                <p
                  key={`${section.id}-p-${p.slice(0, 20)}`}
                  style={{
                    margin:
                      idx === section.paragraphs.length - 1 && bullets.length === 0
                        ? 0
                        : "0 0 12px",
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  {p}
                </p>
              ))}
              {bullets.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  {bullets.map((bullet, idx) => (
                    <li
                      key={`${section.id}-b-${bullet.slice(0, 20)}`}
                      style={{
                        marginBottom: idx === bullets.length - 1 ? 0 : 8,
                      }}
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
