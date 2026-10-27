import { useEffect, useRef, useState } from "react";
import type { LabAudio } from "./labAudio";
import { createLabAudio } from "./labAudio";

export default function AudioPreview() {
  const audioRef = useRef<LabAudio | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [intensity, setIntensity] = useState(0.7);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  function audio(): LabAudio {
    if (!audioRef.current) {
      audioRef.current = createLabAudio();
    }
    return audioRef.current;
  }

  async function handleUnlock() {
    await audio().unlock();
    setUnlocked(true);
  }

  function handleMuted(next: boolean) {
    setMuted(next);
    audio().setMuted(next);
  }

  const btnStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    fontSize: "14px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0f14",
        color: "#f8fafc",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Lab sounds preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#94a3b8", lineHeight: 1.5 }}>
          Procedural Web Audio for the metre bridge bench. No sound plays before you tap to enable
          it.
        </p>

        <button
          type="button"
          onClick={() => void handleUnlock()}
          style={{
            ...btnStyle,
            display: "block",
            width: "100%",
            marginTop: "20px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            backgroundColor: unlocked ? "#14532d" : "#7c2d12",
          }}
        >
          {unlocked ? "Sound enabled — tap again to resume" : "Tap to enable sound"}
        </button>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().nullClick()}
          >
            Null click
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().needleSlam(intensity)}
          >
            Needle slam
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().scrape(0.6)}
          >
            Jockey scrape
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().plug(true)}
          >
            Plug in
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().plug(false)}
          >
            Plug out
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().keyToggle(true)}
          >
            Key close
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={!unlocked}
            onClick={() => audio().keyToggle(false)}
          >
            Key open
          </button>
        </div>

        <label
          style={{
            display: "block",
            marginTop: "20px",
            fontSize: "14px",
            color: "#cbd5e1",
          }}
        >
          Slam intensity: {intensity.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginTop: "8px" }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "16px",
            fontSize: "14px",
            color: "#cbd5e1",
          }}
        >
          <input type="checkbox" checked={muted} onChange={(e) => handleMuted(e.target.checked)} />
          Mute
        </label>
      </div>
    </div>
  );
}
