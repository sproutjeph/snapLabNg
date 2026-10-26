import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type { Point, Quad } from "./types";

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;
const LOUPE_SIZE = 116;
const LOUPE_ZOOM = 2.6;

export interface CornerEditorProps {
  canvas: HTMLCanvasElement;
  initialCorners: Quad | null;
  onConfirm: (corners: Quad) => void;
  onRetake: () => void;
}

function makeDefaultInsetQuad(width: number, height: number): Quad {
  const mx = Math.round(width * 0.1);
  const my = Math.round(height * 0.1);
  return [
    { x: mx, y: my },
    { x: width - mx, y: my },
    { x: width - mx, y: height - my },
    { x: mx, y: height - my },
  ];
}

export function CornerEditor({ canvas, initialCorners, onConfirm, onRetake }: CornerEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const imgW = canvas.width;
  const imgH = canvas.height;

  const [corners, setCorners] = useState<Quad>(() =>
    initialCorners ? initialCorners : makeDefaultInsetQuad(imgW, imgH),
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [displayRect, setDisplayRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ left: 0, top: 0, width: imgW, height: imgH });

  // Draw the captured photo onto the visible canvas and measure its fitted box
  useEffect(() => {
    const disp = displayCanvasRef.current;
    if (disp) {
      disp.width = imgW;
      disp.height = imgH;
      const ctx = disp.getContext("2d");
      ctx?.drawImage(canvas, 0, 0);
    }

    const updateLayout = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const pad = 24;
      const availW = Math.max(100, rect.width - pad * 2);
      const availH = Math.max(100, rect.height - pad * 2);
      const scale = Math.min(availW / imgW, availH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      setDisplayRect({
        left: (rect.width - w) / 2,
        top: (rect.height - h) / 2,
        width: w,
        height: h,
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [canvas, imgW, imgH]);

  // Update the magnifying loupe canvas while dragging a corner handle
  useEffect(() => {
    if (activeIdx === null) return;
    const loupe = loupeCanvasRef.current;
    if (!loupe) return;
    const ctx = loupe.getContext("2d");
    if (!ctx) return;

    const pt = corners[activeIdx] ?? { x: 0, y: 0 };
    const srcSpan = LOUPE_SIZE / LOUPE_ZOOM;
    const sx = pt.x - srcSpan / 2;
    const sy = pt.y - srcSpan / 2;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(canvas, sx, sy, srcSpan, srcSpan, 0, 0, LOUPE_SIZE, LOUPE_SIZE);

    // Draw crosshair in the centre of the loupe
    const mid = LOUPE_SIZE / 2;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mid - 14, mid);
    ctx.lineTo(mid + 14, mid);
    ctx.moveTo(mid, mid - 14);
    ctx.lineTo(mid, mid + 14);
    ctx.stroke();
  }, [activeIdx, corners, canvas]);

  const toScreenPoint = (p: Point): Point => ({
    x: displayRect.left + (p.x / imgW) * displayRect.width,
    y: displayRect.top + (p.y / imgH) * displayRect.height,
  });

  const clientToPhotoPoint = (clientX: number, clientY: number): Point => {
    const stage = stageRef.current;
    if (!stage || displayRect.width <= 0 || displayRect.height <= 0) {
      return { x: 0, y: 0 };
    }
    const stageRect = stage.getBoundingClientRect();
    const relX = clientX - stageRect.left - displayRect.left;
    const relY = clientY - stageRect.top - displayRect.top;
    const px = Math.max(0, Math.min(imgW, (relX / displayRect.width) * imgW));
    const py = Math.max(0, Math.min(imgH, (relY / displayRect.height) * imgH));
    return { x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 };
  };

  const handlePointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveIdx(index);
  };

  const handlePointerMove = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (activeIdx !== index) return;
    e.stopPropagation();
    const nextPt = clientToPhotoPoint(e.clientX, e.clientY);
    setCorners((prev) => {
      const next: Quad = [prev[0], prev[1], prev[2], prev[3]];
      next[index] = nextPt;
      return next;
    });
  };

  const handlePointerUp = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (activeIdx !== index) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setActiveIdx(null);
  };

  const screenCorners = corners.map(toScreenPoint);
  const polygonPoints = screenCorners.map((p) => `${p.x},${p.y}`).join(" ");
  const activeScreenPt = activeIdx !== null ? screenCorners[activeIdx] : undefined;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0f14",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "14px 20px",
          backgroundColor: "#141923",
          borderBottom: "1px solid #262f40",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>
            Confirm Exercise-Book Page Corners
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>
            {initialCorners
              ? "Page detected automatically — drag any corner handle to fine-tune"
              : "Adjust the four corner handles to match your notebook page"}
          </div>
        </div>
      </header>

      {/* Interactive image stage + SVG quad + 44px draggable corner handles */}
      <div
        ref={stageRef}
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <canvas
          ref={displayCanvasRef}
          style={{
            position: "absolute",
            left: `${displayRect.left}px`,
            top: `${displayRect.top}px`,
            width: `${displayRect.width}px`,
            height: `${displayRect.height}px`,
            borderRadius: "4px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        />

        <svg
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <polygon
            points={polygonPoints}
            fill="rgba(34, 197, 94, 0.16)"
            stroke="#22c55e"
            strokeWidth={2.5}
          />
        </svg>

        {CORNER_LABELS.map((label, idx) => {
          const sp = screenCorners[idx] ?? { x: 0, y: 0 };
          const isDragging = activeIdx === idx;
          return (
            <button
              key={label}
              type="button"
              aria-label={`Corner ${label}`}
              onPointerDown={handlePointerDown(idx)}
              onPointerMove={handlePointerMove(idx)}
              onPointerUp={handlePointerUp(idx)}
              onPointerCancel={handlePointerUp(idx)}
              style={{
                position: "absolute",
                left: `${sp.x - 22}px`,
                top: `${sp.y - 22}px`,
                width: "44px",
                height: "44px",
                padding: 0,
                borderRadius: "999px",
                border: "3px solid #ffffff",
                backgroundColor: isDragging ? "#16a34a" : "rgba(34, 197, 94, 0.88)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
                touchAction: "none",
              }}
            >
              {label}
            </button>
          );
        })}

        {/* Magnifying loupe shown while dragging a corner handle */}
        {activeIdx !== null && activeScreenPt && (
          <div
            style={{
              position: "absolute",
              left: `${Math.max(12, Math.min(displayRect.left + displayRect.width - LOUPE_SIZE - 12, activeScreenPt.x - LOUPE_SIZE / 2))}px`,
              top: `${activeScreenPt.y > LOUPE_SIZE + 44 ? activeScreenPt.y - LOUPE_SIZE - 34 : activeScreenPt.y + 34}px`,
              width: `${LOUPE_SIZE}px`,
              height: `${LOUPE_SIZE}px`,
              borderRadius: "999px",
              overflow: "hidden",
              border: "3px solid #22c55e",
              boxShadow: "0 10px 25px rgba(0,0,0,0.65)",
              pointerEvents: "none",
              backgroundColor: "#0f172a",
            }}
          >
            <canvas ref={loupeCanvasRef} width={LOUPE_SIZE} height={LOUPE_SIZE} />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <footer
        style={{
          padding: "14px 24px 20px",
          backgroundColor: "#141923",
          borderTop: "1px solid #262f40",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={onRetake}
          style={{
            minHeight: "44px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "1px solid #475569",
            backgroundColor: "transparent",
            color: "#e2e8f0",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retake
        </button>

        <button
          type="button"
          onClick={() => onConfirm(corners)}
          style={{
            minHeight: "46px",
            padding: "10px 26px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "#16a34a",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Use this page
        </button>
      </footer>
    </div>
  );
}
