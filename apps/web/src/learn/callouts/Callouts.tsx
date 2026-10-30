import { useEffect, useRef, useState } from "react";
import "./callouts.css";
import type { CalloutsProps } from "./types";

export type { CalloutsProps };

export interface ChipPlacement {
  chipX: number;
  chipY: number;
  attachX: number;
  attachY: number;
  flippedX: boolean;
  flippedY: boolean;
}

/**
 * Places the chip relative to the dot at (dotX, dotY), flipping sides near edges and clamping
 * within the stage bounds so the chip never overflows any edge.
 */
export function computeChipPlacement(
  dotX: number,
  dotY: number,
  stageW: number,
  stageH: number,
  chipW = 120,
  chipH = 40,
  margin = 12,
  topMargin = 68,
  bottomMargin = 52,
): ChipPlacement {
  const dx = 50;
  const dy = -40;

  const w = Math.max(1, stageW);
  const h = Math.max(1, stageH);

  let flippedX = false;
  let flippedY = false;

  let cx = dotX + dx;
  if (cx + chipW > w - margin) {
    cx = dotX - dx - chipW;
    flippedX = true;
  }
  if (cx < margin) {
    cx = dotX + dx;
    flippedX = false;
  }

  let cy = dotY + dy;
  if (cy < topMargin) {
    cy = dotY + Math.abs(dy);
    flippedY = true;
  } else if (cy + chipH > h - bottomMargin) {
    cy = dotY - Math.abs(dy) - chipH;
    flippedY = false;
  }

  const maxLeft = Math.max(margin, w - chipW - margin);
  const maxTop = Math.max(topMargin, h - chipH - bottomMargin);
  const clampedX = Math.max(margin, Math.min(maxLeft, cx));
  const clampedY = Math.max(topMargin, Math.min(maxTop, cy));

  const attachX =
    dotX < clampedX ? clampedX : dotX > clampedX + chipW ? clampedX + chipW : clampedX + chipW / 2;
  const attachY =
    dotY < clampedY ? clampedY : dotY > clampedY + chipH ? clampedY + chipH : clampedY + chipH / 2;

  return {
    chipX: clampedX,
    chipY: clampedY,
    attachX,
    attachY,
    flippedX,
    flippedY,
  };
}

export interface CalloutChipProps {
  label: string;
  x: number;
  y: number;
  visible: boolean;
  stageWidth?: number;
  stageHeight?: number;
}

/**
 * The callout chip as DOM (docs/plans/wave-2-lean.md, "What we learned" point 3):
 * ringed dot at (x, y) with a leader line connecting to a floating chip label.
 * Handles edge flipping, spring settling, text swap fading and first-show pop animation.
 */
export function CalloutChip({ label, x, y, visible, stageWidth, stageHeight }: CalloutChipProps) {
  const chipRef = useRef<HTMLDivElement>(null);
  const [displayedLabel, setDisplayedLabel] = useState(label);
  const [fade, setFade] = useState<"idle" | "out" | "in">("idle");
  const [popping, setPopping] = useState(false);
  const prevVisible = useRef(visible);
  const [chipSize, setChipSize] = useState({ w: 120, h: 40 });

  useEffect(() => {
    let live = true;
    const measure = () => {
      if (!live || !chipRef.current || !displayedLabel) return;
      // The layout box, not the bounding rect: the first-show pop scales the chip from 0.3, and a
      // width measured mid-pop is far too narrow.
      const el = chipRef.current;
      const rect = { width: el.offsetWidth, height: el.offsetHeight };
      if (rect.width > 0 && rect.height > 0) {
        setChipSize((s) =>
          Math.abs(s.w - rect.width) < 0.5 && Math.abs(s.h - rect.height) < 0.5
            ? s
            : { w: rect.width, h: rect.height },
        );
      }
    };
    measure();
    // The chip's face (Barlow Condensed) may still be loading: a width measured in the fallback
    // face is too narrow, and the chip then pokes past the stage's edge. Measure again once the
    // page's fonts are in.
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    void fonts?.ready.then(measure);
    fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      live = false;
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [displayedLabel]);

  // First-show pop (0.3s, 0.3 -> 1.12 -> 1)
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setPopping(true);
      const timer = setTimeout(() => setPopping(false), 300);
      prevVisible.current = visible;
      return () => clearTimeout(timer);
    }
    prevVisible.current = visible;
  }, [visible]);

  // Text swap timing: out 130 ms, in 250 ms after a 91 ms delay
  useEffect(() => {
    if (label === displayedLabel) return;
    setFade("out");
    const tOut = setTimeout(() => {
      setDisplayedLabel(label);
      const tHold = setTimeout(() => {
        setFade("in");
        const tIn = setTimeout(() => setFade("idle"), 250);
        return () => clearTimeout(tIn);
      }, 91);
      return () => clearTimeout(tHold);
    }, 130);
    return () => clearTimeout(tOut);
  }, [label, displayedLabel]);

  const sw = stageWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1728);
  const sh = stageHeight ?? (typeof window !== "undefined" ? window.innerHeight : 907);

  const placement = computeChipPlacement(x, y, sw, sh, chipSize.w, chipSize.h);

  return (
    <div className="cc-container" data-visible={visible} aria-hidden={!visible}>
      <svg className="cc-leader-svg" aria-hidden="true">
        <line
          x1={x}
          y1={y}
          x2={placement.attachX}
          y2={placement.attachY}
          stroke="rgba(40, 30, 20, 0.18)"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <line
          x1={x}
          y1={y}
          x2={placement.attachX}
          y2={placement.attachY}
          stroke="var(--paper, #f8f2e6)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span className="cc-dot" style={{ left: `${x}px`, top: `${y}px` }} aria-hidden="true" />
      <div
        ref={chipRef}
        className="cc-chip"
        data-pop={popping}
        style={{
          left: `${placement.chipX}px`,
          top: `${placement.chipY}px`,
        }}
      >
        <span className="cc-text" data-fade={fade}>
          {displayedLabel}
        </span>
      </div>
    </div>
  );
}

// Callouts container overlay
export function Callouts(_props: CalloutsProps) {
  return null;
}
