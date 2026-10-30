import type { ThreeEvent } from "@react-three/fiber";
import { type PartId as CircuitPartId, PART_TERMINALS, type TerminalId } from "@snaplab/engine";
import type { OhmsLawVisualState } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";

// Where everything sits on the V-I bench, in metres: x to the right, z toward the student,
// y = 0 on the desk top. Layout v3 (Oct 30) is set out for the student's seat, as the live stage
// sees it (a camera about 12 degrees right of square, learn/stage/shots.ts), in three rows:
//   - front, nearest her: the ammeter and the voltmeter, square to her, so their dials face her
//     (and the loupe poses in learn/readings/poses.ts look straight at them);
//   - middle: the resistance box, the plug key and the cells;
//   - back: the wire board, low (2 cm) and far enough behind the middle row that nothing in front
//     hides it from the front camera (layout.test.ts checks).
// The loop still runs right to left (cells, key, ammeter, box, then X at the wire's left end, Y
// back to the cells), so each part's incoming terminal is on its right. The rows stand 20 and
// 19 cm apart, room for the leads to lie between them; the key stands behind the gap between the
// meters. The tray holds Identify items only: it stands far behind the board on the right, inside
// the compact 1.3 x 1.1 m bench, and the live stage does not draw it.

export type BenchSlot = CircuitPartId | "tray";

export const OHMS_LAW_LAYOUT: Readonly<
  Record<BenchSlot, { position: readonly [number, number, number]; rotationY: number }>
> = {
  ammeter: { position: [-0.15, 0, 0.14], rotationY: 0 },
  voltmeter: { position: [0.15, 0, 0.14], rotationY: 0 },
  box: { position: [-0.38, 0, -0.06], rotationY: 0 },
  key: { position: [0, 0, -0.06], rotationY: 0 },
  cells: { position: [0.4, 0, -0.06], rotationY: 0 },
  wire: { position: [0, 0, -0.25], rotationY: 0 },
  tray: { position: [0.6, 0, -0.72], rotationY: 0 },
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
