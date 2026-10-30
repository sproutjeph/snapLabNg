import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalloutChip } from "../callouts/Callouts";
import type { StageMotion } from "./stageMotion";

// The one callout chip on the live stage (docs/plans/wave-2-lean.md, 2b-motion), wired to 2a-shell's
// CalloutChip (label, x, y, visible; its own text swap and first-show pop). Choreo springs the
// chip's screen point toward the beat's anchor every frame and calls this component's sink. The
// sink moves a wrapper with a CSS transform, written straight to the DOM; React renders the chip
// again only when its label or visibility changes, or when the point has drifted far from where
// the chip was last laid out (so its edge flips stay right). Never a React render per frame.

/** Re-lay the chip out once the sprung point is this far (px) from its last layout. */
const RELAYOUT_PX = 24;

interface Laid {
  x: number;
  y: number;
  label: string;
  visible: boolean;
}

/** Moves the chip's wrapper from where it is laid out to the sprung point. */
function place(el: HTMLDivElement | null, point: { x: number; y: number }, shown: Laid): void {
  if (!el) return;
  const dx = point.x - shown.x;
  const dy = point.y - shown.y;
  el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
}

export function StageChip({
  motion,
  layer,
}: {
  motion: StageMotion;
  /** The shell's callout layer (over the canvas, under the cards). */
  layer: RefObject<HTMLDivElement | null>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [laid, setLaid] = useState<Laid>({ x: 0, y: 0, label: "", visible: false });
  /** What was asked for last (the layout may not have caught up yet). */
  const asked = useRef<Laid>(laid);
  /** What the DOM shows now, and the sprung point the transform must reach. */
  const shown = useRef<Laid>(laid);
  const point = useRef({ x: 0, y: 0 });
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => setHost(layer.current), [layer]);
  useEffect(() => {
    if (!host) return;
    const measure = () => setSize([host.clientWidth, host.clientHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);

  // After React lays the chip out at a new point, the transform is measured from there.
  useLayoutEffect(() => {
    shown.current = laid;
    place(wrap.current, point.current, laid);
  });

  useEffect(() => {
    motion.chip = (x, y, label, visible, settled) => {
      point.current.x = x;
      point.current.y = y;
      const l = asked.current;
      const far = Math.abs(x - l.x) > RELAYOUT_PX || Math.abs(y - l.y) > RELAYOUT_PX;
      const drift = Math.abs(x - l.x) > 0.5 || Math.abs(y - l.y) > 0.5;
      if (label !== l.label || visible !== l.visible || far || (settled && drift)) {
        const next = { x, y, label, visible };
        asked.current = next;
        setLaid(next);
      }
      place(wrap.current, point.current, shown.current);
    };
    return () => {
      motion.chip = null;
    };
  }, [motion]);

  if (!host) return null;
  const stage = size[0] > 0 && size[1] > 0 ? { stageWidth: size[0], stageHeight: size[1] } : {};
  return createPortal(
    <div
      ref={wrap}
      className="ol-chip"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <CalloutChip
        label={laid.label}
        x={laid.x}
        y={laid.y}
        visible={laid.visible && laid.label !== ""}
        {...stage}
      />
    </div>,
    host,
  );
}
