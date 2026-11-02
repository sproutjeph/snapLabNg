import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import "../learn/paper/desk.css";
import "./home.css";
import { createVoice } from "../learn/voice/createVoice";
import { Bench3DSlot } from "./Bench3DSlot";
import { MeterBridgeArt, TitrationArt } from "./illustrations";
import { practicalIn, ROUTES } from "./links";
import { createWelcomeSpeaker, isMuteTarget, loadMuted, saveMuted } from "./welcome";

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
    const removeGestureListeners = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    const welcome = createWelcomeSpeaker(voice, { onSpoken: removeGestureListeners });
    const onGesture = (event: Event) => {
      // A first tap on Mute must not start the welcome and then mute it.
      if (isMuteTarget(event.target)) return;
      welcome.onGesture();
      if (welcome.spoken) removeGestureListeners();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    welcome.start();
    if (welcome.spoken) removeGestureListeners();
    return () => {
      removeGestureListeners();
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
            Watch a WAEC practical come to life, then do it yourself at the bench. Marks come from a
            fixed rule engine, so the same work always scores the same.
          </p>
        </header>

        <ul className="hp-cards">
          <li className="hp-card hp-hero">
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
            <h2 className="xp-caps">Watch</h2>
            <p>
              The question is read aloud, then the practical is done for you step by step: the
              apparatus, the circuit, the readings, the graph and the slope.
            </p>
          </div>
          <div>
            <h2 className="xp-caps">Practise</h2>
            <p>
              Wire the circuit yourself, take the readings, plot the graph. A guide helps when you
              are stuck.
            </p>
          </div>
          <div>
            <h2 className="xp-caps">Exam</h2>
            <p>Sit it under exam conditions, with a clock and no hints. Hand in for your marks.</p>
          </div>
          <div>
            <h2 className="xp-caps">How marking works</h2>
            <p>
              Your table, graph and answers are marked by a fixed rule engine built from the WAEC
              marking scheme. The AI never decides your marks.
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
