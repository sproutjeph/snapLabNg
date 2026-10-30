import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { forgetLead } from "../wiring/leadPick";
import type { StageMotion } from "./stageMotion";

// The lead's "Remove" chip (the user, PR #100: "can it be clear?"): a small ink pill with a ✕ at
// the middle of the lead she hovers or has selected, and the one-time "Tap a wire to remove it"
// on her first lead. Choreo projects the lead's middle each frame and calls the sink, which moves
// the pill with a CSS transform; React renders it again only when its words or its lead change.

/** Centred on the lead's middle, a little above it so the cable stays in sight. */
function placePill(el: HTMLElement | null, at: { x: number; y: number }): void {
  if (el)
    el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -135%)`;
}

interface Shown {
  label: string;
  removes: boolean;
  id: string | null;
}

const PILL: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  border: "1px solid var(--ink-2, #3a4150)",
  borderRadius: 16,
  background: "var(--ink, #1d2430)",
  color: "var(--paper, #f8f2e6)",
  font: "500 15px/1 var(--f-cond, sans-serif)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 6px rgba(40, 30, 20, 0.18)",
  willChange: "transform",
};

export function LeadRemove({
  motion,
  layer,
  onRemove,
}: {
  motion: StageMotion;
  /** The shell's callout layer (over the canvas, under the cards). */
  layer: RefObject<HTMLDivElement | null>;
  onRemove(leadId: string): void;
}) {
  const pill = useRef<HTMLElement | null>(null);
  const at = useRef({ x: 0, y: 0 });
  const place = (el: HTMLElement | null) => {
    pill.current = el;
    placePill(el, at.current);
  };
  const [shown, setShown] = useState<Shown>({ label: "", removes: false, id: null });
  const asked = useRef(shown);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => setHost(layer.current), [layer]);

  useEffect(() => {
    motion.remove = (x, y, label, removes, id) => {
      const a = asked.current;
      if (a.label !== label || a.removes !== removes || a.id !== id) {
        const next = { label, removes, id };
        asked.current = next;
        setShown(next);
      }
      at.current.x = x;
      at.current.y = y;
      placePill(pill.current, at.current);
    };
    return () => {
      motion.remove = null;
    };
  }, [motion]);

  if (!host || shown.id === null || shown.label === "") return null;
  const id = shown.id;
  const content = shown.removes ? (
    <button
      ref={place}
      type="button"
      className="ol-lead-remove"
      aria-label="Remove this lead"
      style={{ ...PILL, cursor: "pointer", pointerEvents: "auto" }}
      onPointerEnter={() => {
        motion.leads.overChip = true;
      }}
      onPointerLeave={() => {
        motion.leads.overChip = false;
        motion.leads.hoverOutS = performance.now() / 1000;
      }}
      onClick={() => {
        motion.leads.overChip = false;
        forgetLead(motion.leads, id);
        onRemove(id);
      }}
    >
      <span aria-hidden="true">✕</span>
      {shown.label}
    </button>
  ) : (
    <span
      ref={place}
      className="ol-lead-hint"
      role="status"
      style={{ ...PILL, pointerEvents: "none" }}
    >
      {shown.label}
    </span>
  );
  return createPortal(content, host);
}
