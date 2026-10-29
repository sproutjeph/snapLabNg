import type { ThreeEvent } from "@react-three/fiber";
import { type PartId as CircuitPartId, PART_TERMINALS, type TerminalId } from "@snaplab/engine";
import type { OhmsLawVisualState } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";

// Where everything sits on the V-I bench, in metres: x to the right, z toward the student,
// y = 0 on the desk top. Layout v2 is compact: the box, ammeter, key and cells stand in a front
// arc, the wire board lies behind them, and the voltmeter and the tray stand behind the board.
// The board is low (2 cm), so from the front camera nothing hides it; the voltmeter would, if it
// stood in front of it. The loop still runs right to left (cells, key, ammeter, box, then X at
// the wire's left end, Y back to the cells), so each part's incoming terminal is on its right:
// E+ left of the cells; K1, A+, R1 on the right. The meters keep rotationY = 0 because the
// loupe poses (learn/readings/poses.ts) look straight at their dials; the voltmeter's x leaves a
// clear line of sight past the front parts at the loupe's +-30 degrees (layout.test.ts checks).
// The tray stays at the back, not in the front arc: it holds Identify items only, and in front
// it would add 0.3 m to the bench's width and shrink everything on a phone.

export type BenchSlot = CircuitPartId | "tray";

export const OHMS_LAW_LAYOUT: Readonly<
  Record<BenchSlot, { position: readonly [number, number, number]; rotationY: number }>
> = {
  cells: { position: [0.44, 0, 0.08], rotationY: 0 },
  key: { position: [0.2, 0, 0.12], rotationY: 0 },
  ammeter: { position: [-0.16, 0, 0.1], rotationY: 0 },
  box: { position: [-0.43, 0, 0.1], rotationY: 0 },
  voltmeter: { position: [0.14, 0, -0.28], rotationY: 0 },
  wire: { position: [0, 0, -0.13], rotationY: 0 },
  tray: { position: [0.38, 0, -0.4], rotationY: 0 },
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
  /** The Watch cursor (PenNib). */
  pen: 90,
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
