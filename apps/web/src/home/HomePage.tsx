import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import "../learn/paper/desk.css";
import "./home.css";
import { createVoice } from "../learn/voice/createVoice";
import { Bench3DSlot } from "./Bench3DSlot";
import { MeterBridgeArt, TitrationArt } from "./illustrations";
import { practicalIn, ROUTES } from "./links";
import { createWelcomeSpeaker, loadMuted, saveMuted } from "./welcome";

// The picker (docs/plans/exam-redesign.md, "The experience", step 1): "Choose a practical" as three
// ink-drawn cards. Ohm's law (V–I) opens its question paper from the picture and title, or goes
// straight to Watch, Practise or Exam. Nothing here marks, computes or shows a reading.
// Guided home (docs/plans/guided-demo.md): a welcome voice with a remembered mute, Watch opening
// the guided demo, and metre bridge / titration as "Coming soon" stills.

function StillImage({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      className="hp-still"
      src={src}
      alt={alt}
      width={1600}
      height={1100}
      onError={() => setFailed(true)}
    />
  );
}

export default function HomePage() {
  const voice = useMemo(() => createVoice(), []);
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    voice.muted = mutedRef.current;
    const welcome = createWelcomeSpeaker(voice);
    welcome.start();
    const onGesture = () => welcome.onGesture();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      welcome.dispose();
      voice.stop();
    };
    // One voice and one welcome per visit; muted is applied before start above.
  }, [voice]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    voice.muted = next;
    if (next) voice.stop();
    saveMuted(next);
  };

  return (
    <div className="xp xp-desk hp-page">
      <main className="hp-main">
        <header className="hp-head">
          <p className="xp-caps hp-brand">SnapLab NG</p>
          <button
            type="button"
            className="xp-btn hp-mute"
            data-testid="home-mute"
            aria-pressed={muted}
            aria-label={muted ? "Unmute the welcome voice" : "Mute the welcome voice"}
            onClick={toggleMute}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <h1 className="hp-title">Choose a practical</h1>
          <p className="hp-lede">
            Snap your WAEC practical, or work one through at the bench. Marks come from a fixed rule
            engine, so the same work always scores the same.
          </p>
        </header>

        <ul className="hp-cards">
          <li className="hp-card">
            <a
              className="hp-open xp-focus"
              href={ROUTES.practical}
              aria-label="Ohm's law (V–I): read the question first"
            >
              <span className="hp-art">
                <Bench3DSlot />
              </span>
              <h2 className="hp-name">Ohm's law (V–I)</h2>
            </a>
            <p className="hp-meta">WASSCE-style · Physics Paper 3</p>
            <div className="hp-actions hp-actions-3">
              <a className="xp-btn xp-btn-primary" href={ROUTES.guidedWatch}>
                Watch
              </a>
              <a className="xp-btn" href={practicalIn("practice")}>
                Practise
              </a>
              <a className="xp-btn" href={practicalIn("exam")}>
                Exam
              </a>
            </div>
          </li>

          <li className="hp-card hp-soon">
            <div className="hp-open">
              <span className="hp-art">
                <StillImage src="/home/meter-bridge.webp" alt="" fallback={<MeterBridgeArt />} />
              </span>
              <h2 className="hp-name">Metre bridge</h2>
            </div>
            <p className="hp-meta">
              <span className="hp-pill">Coming soon</span>
            </p>
          </li>

          <li className="hp-card hp-soon">
            <div className="hp-open">
              <span className="hp-art">
                <StillImage src="/home/titration.webp" alt="" fallback={<TitrationArt />} />
              </span>
              <h2 className="hp-name">Titration</h2>
            </div>
            <p className="hp-meta">
              <span className="hp-pill">Coming soon</span>
            </p>
          </li>
        </ul>

        <section className="hp-notes" aria-label="About SnapLab NG">
          <div>
            <h2 className="xp-caps">How it works</h2>
            <ol>
              <li>Snap your notebook page, or open the question.</li>
              <li>The apparatus comes alive as a 3D lab.</li>
              <li>Get your marks in red ink, then answer examiner-style questions.</li>
            </ol>
          </div>
          <div>
            <h2 className="xp-caps">Your privacy</h2>
            <p>
              Your name and school at the top of the page are blurred on your phone before upload.
              Your photo is not saved.
            </p>
          </div>
          <div>
            <h2 className="xp-caps">How marking works</h2>
            <p>
              Meta's Muse Spark, Muse Wonder and SAM 3.1 read your page. The marks come from a fixed
              rule engine. The AI never decides your marks.
            </p>
          </div>
          <div>
            <h2 className="xp-caps">Teachers</h2>
            <p>
              After a snap, tap For teachers in the corner to enter your measured value and mark
              accuracy.
            </p>
          </div>
        </section>

        <footer className="hp-foot">
          <a href="/?about=1" className="xp-link">
            About SnapLab NG
          </a>
          {" · "}Not affiliated with WAEC. Built for the Meta Global AI Developer Hackathon, 2026.
        </footer>
      </main>
    </div>
  );
}
