import type { ThreeEvent } from "@react-three/fiber";
import { type PartId as CircuitPartId, PART_TERMINALS, type TerminalId } from "@snaplab/engine";
import type { LeadColour, OhmsLawVisualState } from "../../learn/types";
import { BOX_NUTS, CELLS_NUTS, KEY_NUTS } from "../materials/benchSpec";
import { cmToX } from "../meter-bridge/dimensions";
import type { QualityTier } from "../meter-bridge/types";

// Where everything sits on the V-I bench, in metres: x to the right, z toward the student,
// y = 0 on the desk top. Layout v4 (Oct 30, docs/plans/beauty-pass.md B2) is set out in the
// circuit's own order, for the student's seat (the live stage looks from about 12 degrees right of
// square, learn/stage/shots.ts), so that once it is wired no lead crosses a part, a dial or
// another lead (layout.test.ts checks):
//   - front, nearest her: the seven leads, lying side by side before she connects them;
//   - the series row: the resistance box, the ammeter, the plug key and the cells, left to right,
//     their nuts on one line, so the loop's leads run straight from each part to its neighbour
//     (cells + to the key, the key to ammeter +, ammeter − to the box); the ammeter is square to
//     her, so its dial faces her (and the loupe poses in learn/readings/poses.ts look straight at
//     it);
//   - the wire board, low (2 cm), behind the row, with a lane in front of it: R2 runs back from
//     the box's left end and along that lane to X, and Y along it to the cells' − at the right;
//   - the voltmeter, square to her, behind the board's right half, its leads reaching X and Y
//     over the board's back. Its + nut is on its right and X is on the wire's left, so two
//     straight leads would cross: V+ leaves backward instead, tucked between the − nut and the
//     case along the ledge, off the ledge's left end, and along a lane behind V−'s to X (Lead.tsx,
//     leadWaypoints). X is never right of 3 cm (the engine's wire starts by 53 cm), so V+'s lane
//     always runs left, clear of V−'s.
// Nothing in front of the board is tall enough to hide it (layout.test.ts checks). The tray holds
// Identify items only: it stands behind the board on the left, beside the voltmeter and clear of
// the leads' lanes, inside the compact 1.3 x 1.1 m bench, and the live stage does not draw it.

export type BenchSlot = CircuitPartId | "tray";

/** The series row's nut line, and the board's and the voltmeter's depths (z, metres). */
const ROW_Z = 0.115;
const BOARD_Z = -0.195;
const VOLTMETER_Z = -0.38;

export const OHMS_LAW_LAYOUT: Readonly<
  Record<BenchSlot, { position: readonly [number, number, number]; rotationY: number }>
> = {
  // A meter's nuts stand 4.5 cm in front of its position (Meter.tsx NUT_Z): on the row's line.
  ammeter: { position: [-0.08, 0, ROW_Z - 0.045], rotationY: 0 },
  voltmeter: { position: [0.15, 0, VOLTMETER_Z], rotationY: 0 },
  // The box's nuts stand 6 mm behind its middle (BOX_NUTS); the key's and the cells' on it.
  box: { position: [-0.33, 0, ROW_Z + 0.006], rotationY: 0 },
  key: { position: [0.13, 0, ROW_Z], rotationY: 0 },
  cells: { position: [0.4, 0, ROW_Z], rotationY: 0 },
  wire: { position: [0, 0, BOARD_Z], rotationY: 0 },
  tray: { position: [-0.42, 0, -0.485], rotationY: 0 },
};

/**
 * The lanes the routed leads lie along (z, metres; Lead.tsx leadRoute): in front of the board the
 * loop's R2–X and Y–E−; behind it V−–Y nearer the board, and V+–X behind that, nearer the
 * voltmeter. Each is 2 cm clear of the parts beside it, past floorAt's 1.5 cm ramp, so a lead on a
 * lane lies on the desk.
 */
export const LEAD_LANES = {
  front: BOARD_Z + 0.06 + 0.02,
  backNear: BOARD_Z - 0.06 - 0.02,
  backFar: VOLTMETER_Z + 0.065 + 0.02,
} as const;

/**
 * Where a lead lies before she connects it (Step 0 item 2): a row in front of the series row, each
 * lead straight toward her with a plug lying at each end, pin outward. `z0` and `z1` are the two
 * plugs' feet (where the brass collar meets the pin), back and front.
 */
export interface LeadRest {
  x: number;
  z0: number;
  z1: number;
  colour: LeadColour;
}

/** One rest place per lead of the diagram, coloured as the bench hands them out (wiring/bench.ts). */
export const LEAD_REST_COUNT = 7;
const REST_COLOURS: readonly LeadColour[] = ["red", "black", "yellow"];
const REST_Z0 = ROW_Z + 0.125;
const REST_LEN_M = 0.175;
const REST_PITCH_M = 0.13;

export const LEAD_REST: readonly LeadRest[] = Array.from({ length: LEAD_REST_COUNT }, (_, i) => ({
  x: (i - (LEAD_REST_COUNT - 1) / 2) * REST_PITCH_M,
  z0: REST_Z0,
  z1: REST_Z0 + REST_LEN_M,
  colour: REST_COLOURS[i % REST_COLOURS.length] ?? "red",
}));

// ---- Where each nut stands ----------------------------------------------------------------------
// A nut's foot in its part's frame: the box's, key's and cells' from materials/benchSpec.ts, a
// meter's from Meter.tsx (±3.5 cm, on the 1.2 cm ledge, 4.5 cm in front of the meter's position),
// the board's from WireBoard.tsx (at the wire's ends, 1.5 cm behind the board's middle, on blocks
// 3.4 cm up). A plug seats NUT_SEAT_M (TerminalNut.tsx NUT_TOP_M) above the foot.

const METER_NUT = { x: 0.035, y: 0.012, z: 0.045 } as const;
const BOARD_NUT = { y: 0.034, z: -0.015 } as const;
export const NUT_SEAT_M = 0.0237;

type FixedTerminal = Exclude<TerminalId, "X" | "Y">;
const LOCAL_NUTS: Readonly<Record<FixedTerminal, readonly [number, number, number]>> = {
  "E+": CELLS_NUTS["E+"],
  "E-": CELLS_NUTS["E-"],
  K1: KEY_NUTS.K1,
  K2: KEY_NUTS.K2,
  R1: BOX_NUTS.R1,
  R2: BOX_NUTS.R2,
  "A+": [METER_NUT.x, METER_NUT.y, METER_NUT.z],
  "A-": [-METER_NUT.x, METER_NUT.y, METER_NUT.z],
  "V+": [METER_NUT.x, METER_NUT.y, METER_NUT.z],
  "V-": [-METER_NUT.x, METER_NUT.y, METER_NUT.z],
};

/**
 * Where terminal `id`'s nut foot stands, in metres, for a wire laid from `startCm` for `lengthCm`
 * on the rule. The live bench reads the same places from the terminal registry; this is the
 * layout's own account of them, for its tests and the bench shots.
 */
export function nutFoot(
  id: TerminalId,
  wire: { startCm: number; lengthCm: number },
): [number, number, number] {
  if (id === "X" || id === "Y") {
    const [px, py, pz] = OHMS_LAW_LAYOUT.wire.position;
    const cm = id === "X" ? wire.startCm : wire.startCm + wire.lengthCm;
    return [px + cmToX(cm), py + BOARD_NUT.y, pz + BOARD_NUT.z];
  }
  const [px, py, pz] = OHMS_LAW_LAYOUT[TERMINAL_PART[id]].position;
  const [lx, ly, lz] = LOCAL_NUTS[id];
  return [px + lx, py + ly, pz + lz];
}

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
