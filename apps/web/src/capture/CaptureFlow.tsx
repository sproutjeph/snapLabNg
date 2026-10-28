import { useRef, useState } from "react";
import { CameraView } from "./CameraView";
import { CornerEditor } from "./CornerEditor";
import { compressPhoto } from "./compress";
import { findPageCorners } from "./cornerFinder";
import { solveHomography } from "./homography";
import type { CaptureResult, Quad } from "./types";

const UNIT_PAGE_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export interface CaptureFlowProps {
  onDone: (result: CaptureResult) => void;
}

interface CapturedStill {
  canvas: HTMLCanvasElement;
  source: "camera" | "file";
  initialCorners: Quad | null;
}

export default function CaptureFlow({ onDone }: CaptureFlowProps) {
  const [still, setStill] = useState<CapturedStill | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const busyRef = useRef(false);

  const handleCapture = (canvas: HTMLCanvasElement, source: "camera" | "file") => {
    busyRef.current = false;
    setBusy(false);
    setErrorMsg(null);
    const ctx = canvas.getContext("2d");
    let detected: Quad | null = null;
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      detected = findPageCorners(imgData);
    }
    setStill({
      canvas,
      source,
      initialCorners: detected,
    });
  };

  const handleRetake = () => {
    if (busyRef.current) return;
    setErrorMsg(null);
    setStill(null);
  };

  const handleConfirm = async (corners: Quad) => {
    if (!still || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { canvas, source } = still;
      const { blob, width, height } = await compressPhoto(canvas, canvas.width, canvas.height);
      const sx = width / canvas.width;
      const sy = height / canvas.height;

      const scaledCorners: Quad = [
        { x: Math.round(corners[0].x * sx * 10) / 10, y: Math.round(corners[0].y * sy * 10) / 10 },
        { x: Math.round(corners[1].x * sx * 10) / 10, y: Math.round(corners[1].y * sy * 10) / 10 },
        { x: Math.round(corners[2].x * sx * 10) / 10, y: Math.round(corners[2].y * sy * 10) / 10 },
        { x: Math.round(corners[3].x * sx * 10) / 10, y: Math.round(corners[3].y * sy * 10) / 10 },
      ];

      const homography = solveHomography(UNIT_PAGE_QUAD, scaledCorners);

      onDone({
        photo: blob,
        width,
        height,
        corners: scaledCorners,
        homography,
        source,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not confirm corners. Please ensure the four corners form a valid quadrilateral.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (!still) {
    return <CameraView onCapture={handleCapture} />;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CornerEditor
        canvas={still.canvas}
        initialCorners={still.initialCorners}
        busy={busy}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
      {errorMsg && (
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--card)",
            color: "var(--ink)",
            padding: "8px 16px",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius)",
            fontSize: "13px",
            fontFamily: "var(--f-body)",
            pointerEvents: "none",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
