import { DIAGRAM_LEADS, type DiagramComparison } from "@snaplab/engine";
import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";
import type { PartId } from "../types";
import { diagramLeadKey, OHMS_LAW_DIAGRAM_CAPTION, OHMS_LAW_DIAGRAM_SVG } from "./diagram";

export interface CircuitDiagramProps {
  /**
   * Her wiring against the diagram. A made lead turns its line from dashed pencil to solid ink,
   * and every line is ink when it matches. Pass null to show the plain diagram (all pencil),
   * e.g. in exam mode, where the diagram must not confirm her wiring.
   */
  comparison: DiagramComparison | null;
  /** The part to light (from the bench, Identify mode or a callout). */
  highlight?: PartId | null;
  /** She hovered or tapped a symbol: the shell can light the part on the bench. */
  onPart?: (part: PartId, how: "hover" | "tap") => void;
  /** Shows the caption under the drawing. Default true. */
  caption?: boolean;
  style?: CSSProperties;
}

/** Diagram leads she has made: all when it matches, otherwise those not listed as missing. */
export function madeLeadKeys(comparison: DiagramComparison | null): Set<string> {
  const made = new Set<string>();
  if (!comparison) return made;
  const missing = new Set(comparison.missing.map(([a, b]) => diagramLeadKey(a, b)));
  for (const [a, b] of DIAGRAM_LEADS) {
    const k = diagramLeadKey(a, b);
    if (comparison.matches || !missing.has(k)) made.add(k);
  }
  return made;
}

const PART_NAMES: Partial<Record<PartId, string>> = {
  cells: "Cells E",
  key: "Key K",
  ammeter: "Ammeter A",
  box: "Resistance box R",
  wire: "Wire XY",
  voltmeter: "Voltmeter V",
};

function partOf(target: EventTarget | null): PartId | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-part]");
  return (el?.getAttribute("data-part") as PartId | null) ?? null;
}

/**
 * "Circuit for this practical": our own SVG of the corrected diagram (diagram.ts), mounted as
 * DOM so its lines and symbols can be restyled by attribute without re-parsing.
 */
export function CircuitDiagram({
  comparison,
  highlight = null,
  onPart,
  caption = true,
  style,
}: CircuitDiagramProps) {
  const host = useRef<HTMLDivElement>(null);
  const hovered = useRef<PartId | null>(null);
  const onPartRef = useRef(onPart);
  onPartRef.current = onPart;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const doc = new DOMParser().parseFromString(OHMS_LAW_DIAGRAM_SVG, "image/svg+xml");
    const svg = document.importNode(doc.documentElement, true);
    svg.setAttribute("width", "100%");
    svg.removeAttribute("height");
    // Each symbol can be reached from the keyboard and named by a screen reader.
    for (const part of svg.querySelectorAll("[data-part]")) {
      const id = part.getAttribute("data-part") as PartId;
      part.setAttribute("tabindex", "0");
      part.setAttribute("role", "button");
      part.setAttribute("aria-label", PART_NAMES[id] ?? id);
    }
    el.replaceChildren(svg);

    // Delegated listeners on the drawing (native, so the static host needs no ARIA role).
    const over = (e: PointerEvent) => {
      const p = partOf(e.target);
      if (p && p !== hovered.current) onPartRef.current?.(p, "hover");
      hovered.current = p;
    };
    const leave = () => {
      hovered.current = null;
    };
    const click = (e: MouseEvent) => {
      const p = partOf(e.target);
      if (p) onPartRef.current?.(p, "tap");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const p = partOf(e.target);
      if (!p) return;
      e.preventDefault();
      onPartRef.current?.(p, "tap");
    };
    el.addEventListener("pointerover", over);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("click", click);
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("click", click);
      el.removeEventListener("keydown", key);
      el.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const made = madeLeadKeys(comparison);
    for (const line of el.querySelectorAll("[data-lead]")) {
      const k = line.getAttribute("data-lead") ?? "";
      if (made.has(k)) line.setAttribute("data-made", "1");
      else line.removeAttribute("data-made");
    }
  }, [comparison]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    for (const part of el.querySelectorAll("[data-part]")) {
      if (part.getAttribute("data-part") === highlight) part.setAttribute("data-hl", "1");
      else part.removeAttribute("data-hl");
    }
  }, [highlight]);

  return (
    <figure style={{ margin: 0, ...style }}>
      <div ref={host} />
      {caption ? (
        <figcaption className="snap-label" style={{ fontSize: 13, textAlign: "center" }}>
          {OHMS_LAW_DIAGRAM_CAPTION}
        </figcaption>
      ) : null}
    </figure>
  );
}

export interface CompareToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  style?: CSSProperties;
}

/** "Compare with diagram": shows or hides the diagram beside the bench. The shell places it. */
export function CompareToggle({ on, onChange, style }: CompareToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: "0 14px",
        border: "1.5px solid var(--ink, #1d2430)",
        borderRadius: "var(--radius, 6px)",
        background: on ? "var(--ink, #1d2430)" : "var(--card, #f8f2e6)",
        color: on ? "var(--paper, #f4ecdc)" : "var(--ink, #1d2430)",
        font: "600 15px var(--f-cond, sans-serif)",
        letterSpacing: "0.04em",
        cursor: "pointer",
        ...style,
      }}
    >
      Compare with diagram
    </button>
  );
}
