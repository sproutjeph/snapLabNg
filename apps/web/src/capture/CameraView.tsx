import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { sharpness } from "./sharpness";

const MAX_DECODE_SIDE = 1600;
const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 120;
const SHARPNESS_THRESHOLD = 45;

export interface CameraViewProps {
  onCapture: (canvas: HTMLCanvasElement, source: "camera" | "file") => void;
}

function drawSourceToWorkingCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): HTMLCanvasElement {
  const safeW = Math.max(1, Math.round(srcW));
  const safeH = Math.max(1, Math.round(srcH));
  const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(safeW, safeH));
  const width = Math.max(1, Math.round(safeW * scale));
  const height = Math.max(1, Math.round(safeH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D context for working photo canvas");
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function decodeFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return drawSourceToWorkingCanvas(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = drawSourceToWorkingCanvas(img, img.naturalWidth, img.naturalHeight);
        resolve(canvas);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode selected image file"));
    };
    img.src = url;
  });
}

function stopStreamTracks(streamRef: { current: MediaStream | null }): void {
  const stream = streamRef.current;
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    streamRef.current = null;
  }
}

export function CameraView({ onCapture }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraState, setCameraState] = useState<"starting" | "live" | "fallback">("starting");
  const [isSteady, setIsSteady] = useState(false);
  const [sharpnessScore, setSharpnessScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setCameraState("fallback");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (!cancelled) {
          setCameraState("live");
        }
      } catch {
        if (!cancelled) {
          stopStreamTracks(streamRef);
          setCameraState("fallback");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStreamTracks(streamRef);
    };
  }, []);

  // Sample sharpness 4 times per second from a single small reusable canvas
  useEffect(() => {
    if (cameraState !== "live") return;

    if (!sampleCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = SAMPLE_WIDTH;
      c.height = SAMPLE_HEIGHT;
      sampleCanvasRef.current = c;
    }

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const sampleCanvas = sampleCanvasRef.current;
      if (!video || !sampleCanvas || video.readyState < 2 || video.videoWidth === 0) return;

      const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const imgData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const score = sharpness(imgData);
      setSharpnessScore(Math.round(score));
      setIsSteady(score >= SHARPNESS_THRESHOLD);
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [cameraState]);

  const handleSnapVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    try {
      const canvas = drawSourceToWorkingCanvas(video, video.videoWidth, video.videoHeight);
      stopStreamTracks(streamRef);
      onCapture(canvas, "camera");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not capture frame");
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const canvas = await decodeFileToCanvas(file);
      stopStreamTracks(streamRef);
      onCapture(canvas, "file");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not read photo file");
    } finally {
      e.target.value = "";
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        fontFamily: "var(--f-body)",
        boxSizing: "border-box",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Video element (kept mounted while starting/live so getUserMedia stream attaches cleanly) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: cameraState === "live" ? "block" : "none",
        }}
      />

      {/* Top header & hold-steady sharpness badge */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--paper)",
          borderBottom: "var(--rule)",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.01em" }}>
            SnapLab NG · Metre Bridge Practical
          </div>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "2px" }}>
            Align your WAEC exercise-book page inside the guide
          </div>
        </div>

        {cameraState === "live" && (
          <div
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius)",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid var(--ink-2)",
              backgroundColor: "var(--card)",
              color: isSteady ? "var(--green)" : "var(--ink-2)",
            }}
          >
            {isSteady ? `Sharp (${sharpnessScore})` : "Hold steady…"}
          </div>
        )}
      </header>

      {/* Center page-shaped guide or file-picker fallback card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        {cameraState === "live" ? (
          <div
            style={{
              width: "min(76vw, 420px)",
              aspectRatio: "3 / 4",
              maxHeight: "66vh",
              border: isSteady ? "2.5px solid var(--green)" : "2px dashed var(--paper)",
              borderRadius: "var(--radius)",
              boxShadow: "0 0 0 9999px rgba(29, 36, 48, 0.48)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "14px",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                backgroundColor: "var(--card)",
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                fontSize: "13px",
                color: "var(--ink)",
              }}
            >
              Fit all four corners of your notebook page inside the frame
            </span>
          </div>
        ) : (
          <div
            style={{
              width: "min(90vw, 440px)",
              backgroundColor: "var(--card)",
              border: "var(--rule)",
              borderRadius: "var(--radius)",
              padding: "28px 24px",
              textAlign: "center",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "80px",
                margin: "0 auto 16px",
                borderRadius: "8px",
                border: "2px dashed var(--ink-2)",
                backgroundColor: "var(--paper-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                color: "var(--ink-2)",
                fontWeight: 700,
              }}
            >
              A4
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
              Upload or Snap Your Exercise-Book Page
            </h2>
            <p
              style={{
                margin: "0 0 22px",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--muted)",
              }}
            >
              {cameraState === "starting"
                ? "Requesting camera access… You can also pick a photo from your device below."
                : "Camera is unavailable on this device. Choose a photo of your WAEC practical page to find and confirm its four corners."}
            </p>
            <button
              type="button"
              onClick={openFilePicker}
              style={{
                width: "100%",
                minHeight: "var(--tap)",
                padding: "12px 20px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--ink)",
                backgroundColor: "var(--ink)",
                color: "var(--paper)",
                fontSize: "15px",
                fontFamily: "var(--f-cond)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Choose Photo from Device
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            marginBottom: "8px",
            padding: "8px 14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--accent)",
            backgroundColor: "var(--card)",
            color: "var(--ink)",
            fontSize: "13px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Bottom control bar (always includes file-picker fallback) */}
      <footer
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          padding: "16px 24px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "var(--paper)",
          borderTop: "var(--rule)",
          boxSizing: "border-box",
        }}
      >
        {cameraState === "live" && (
          <button
            type="button"
            onClick={handleSnapVideo}
            style={{
              minHeight: "var(--tap)",
              padding: "12px 28px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--ink)",
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Snap Page
          </button>
        )}

        <button
          type="button"
          onClick={openFilePicker}
          style={{
            minHeight: "var(--tap)",
            padding: "10px 18px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--ink-2)",
            backgroundColor: "var(--card)",
            color: "var(--ink)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Pick Photo File
        </button>
      </footer>
    </div>
  );
}
