import { useCallback, useEffect, useRef, useState } from "react";
import { usePushToTalk } from "./usePushToTalk";
import { pcm16ToWav } from "./wav";

/** Preview page for `?mic=1`: push-to-talk capture, level and WAV playback check. */
export default function MicPreview() {
  const chunksRef = useRef<Int16Array[]>([]);
  const holdingRef = useRef(false);
  const [level, setLevel] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);

  const { state, start, stop } = usePushToTalk({
    onChunk: useCallback((pcm: Int16Array) => {
      chunksRef.current.push(pcm);
      setChunkCount(chunksRef.current.length);
      setTotalSamples((prev) => prev + pcm.length);
      setHasRecording(true);
    }, []),
    onLevel: useCallback((rms: number) => setLevel(rms), []),
  });

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, []);

  const begin = useCallback(() => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    chunksRef.current = [];
    setChunkCount(0);
    setTotalSamples(0);
    setHasRecording(false);
    setLevel(0);
    void start();
  }, [start]);

  const end = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stop();
    setLevel(0);
  }, [stop]);

  const downloadWav = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const url = URL.createObjectURL(pcm16ToWav(chunksRef.current));
    const a = document.createElement("a");
    a.href = url;
    a.download = "snaplab-mic.wav";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const seconds = totalSamples / 16000;
  const recording = state === "recording" || state === "starting";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "var(--f-body)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Mic capture preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted)", lineHeight: 1.5 }}>
          Hold the button and speak. Audio leaves this page only as PCM16 mono 16 kHz chunks (100 ms
          each) for the examiner relay. Download the WAV to check it by ear.
        </p>

        <button
          type="button"
          aria-pressed={recording}
          onPointerDown={(e) => {
            e.preventDefault();
            begin();
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          onKeyDown={(e) => {
            if (e.code === "Space" && !e.repeat) {
              e.preventDefault();
              begin();
            }
          }}
          onKeyUp={(e) => {
            if (e.code === "Space") {
              e.preventDefault();
              end();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            display: "block",
            width: "100%",
            marginTop: "24px",
            padding: "28px 16px",
            fontSize: "18px",
            fontWeight: 700,
            borderRadius: "var(--radius)",
            border: "1px solid var(--ink-2)",
            backgroundColor: recording ? "var(--ink)" : "var(--card)",
            color: recording ? "var(--paper)" : "var(--ink)",
            cursor: "pointer",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {recording ? "Listening… release to stop" : "Hold to speak"}
        </button>

        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
              color: "var(--muted)",
              marginBottom: "6px",
            }}
          >
            <span>Level</span>
            <span>State: {state}</span>
          </div>
          <meter
            aria-label="Microphone level"
            min={0}
            max={1}
            value={level}
            style={{ width: "100%", height: "14px", display: "block" }}
          />
        </div>

        <dl
          style={{
            display: "flex",
            gap: "24px",
            margin: "20px 0 0",
            fontSize: "14px",
            color: "var(--ink-2)",
          }}
        >
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "12px" }}>Recorded</dt>
            <dd style={{ margin: "2px 0 0", fontWeight: 700 }}>{seconds.toFixed(1)} s</dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "12px" }}>Chunks</dt>
            <dd style={{ margin: "2px 0 0", fontWeight: 700 }}>{chunkCount}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "12px" }}>Format</dt>
            <dd style={{ margin: "2px 0 0", fontWeight: 700 }}>PCM16 · 16 kHz · mono</dd>
          </div>
        </dl>

        {state === "denied" ? (
          <p
            style={{ marginTop: "16px", fontSize: "14px", lineHeight: 1.5, color: "var(--accent)" }}
          >
            Allow the microphone in your browser settings, or type your answer instead.
          </p>
        ) : null}
        {state === "unsupported" ? (
          <p
            style={{ marginTop: "16px", fontSize: "14px", lineHeight: 1.5, color: "var(--accent)" }}
          >
            This browser cannot capture microphone audio here. Try a recent Chrome, Edge or Safari,
            or type your answer instead.
          </p>
        ) : null}

        <button
          type="button"
          onClick={downloadWav}
          disabled={!hasRecording}
          style={{
            marginTop: "20px",
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--ink-2)",
            backgroundColor: "var(--card)",
            color: hasRecording ? "var(--ink)" : "var(--muted)",
            fontSize: "14px",
            cursor: hasRecording ? "pointer" : "default",
          }}
        >
          Download WAV
        </button>
      </div>
    </div>
  );
}
