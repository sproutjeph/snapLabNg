import type { ThreeEvent } from "@react-three/fiber";
import { type PartId as CircuitPartId, PART_TERMINALS, type TerminalId } from "@snaplab/engine";
import type { OhmsLawVisualState } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";

// Where everything sits on the V–I bench, in metres: x to the right, z toward the student,
// y = 0 on the desk top. The loop runs from the cells (back right) leftward through the key,
// ammeter and box to X (front left), along the wire to Y (front right) and back to the cells, so
// each part's incoming terminal is on its right: E+ left of the cells; K1, A+, R1 on the right.
// The voltmeter sits in front, between the two ends of the wire. Lead-owned (Wave 0).

export type BenchSlot = CircuitPartId | "tray";

export const OHMS_LAW_LAYOUT: Readonly<
  Record<BenchSlot, { position: readonly [number, number, number]; rotationY: number }>
> = {
  cells: { position: [0.42, 0, -0.22], rotationY: 0 },
  key: { position: [0.15, 0, -0.32], rotationY: 0 },
  ammeter: { position: [-0.15, 0, -0.34], rotationY: 0 },
  box: { position: [-0.42, 0, -0.22], rotationY: 0 },
  voltmeter: { position: [0, 0, -0.06], rotationY: 0 },
  wire: { position: [0, 0, 0.16], rotationY: 0 },
  tray: { position: [0.72, 0, 0.12], rotationY: 0 },
};

export const TERMINAL_LABELS: Readonly<Record<TerminalId, string>> = {
  "E+": "Cells +",
  "E-": "Cells −",
  K1: "Key, right terminal",
  K2: "Key, left terminal",
  "A+": "Ammeter +",
  "A-": "Ammeter −",
  "V+": "Voltmeter +",
  "V-": "Voltmeter −",
  R1: "Resistance box, right terminal",
  R2: "Resistance box, left terminal",
  X: "End X of the wire",
  Y: "End Y of the wire",
};

/** The part each terminal belongs to. */
export const TERMINAL_PART = Object.fromEntries(
  Object.entries(PART_TERMINALS).flatMap(([part, ids]) => ids.map((id) => [id, part])),
) as Readonly<Record<TerminalId, CircuitPartId>>;

/**
 * Fixed ink ids for the V–I bench (scene/ink/ink.tsx), so touching parts always differ and
 * keep the line between them. Each part owns a block of ten for its sub-parts: use the block's
 * first id for the body and the next ones for needles, plugs, screws and labels. Nuts and
 * leads get one id each, by index.
 */
export const INK_IDS = {
  cells: 10,
  key: 20,
  ammeter: 30,
  voltmeter: 40,
  box: 50,
  wire: 60,
  tray: 80,
  /** + TERMINAL_IDS index (0–11). */
  nutBase: 100,
  /** + lead index (0–19, wrapping). */
  leadBase: 140,
} as const;

/** Props every bench part takes. Parts read the visual state in useFrame, never as React state. */
export interface PartProps {
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  position: readonly [number, number, number];
  rotationY?: number;
}

/** A pointer-down handler that stops the event reaching parts behind, then calls fn. */
export const tapOnly = (fn?: () => void) => (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation();
  fn?.();
};
