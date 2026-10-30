import { cmToX } from "../../apparatus/meter-bridge/dimensions";
import { OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { METER_DIAL_CENTER, METER_FACE_NORMAL } from "../../apparatus/ohms-law/MeterImage";

// Close-up camera poses for the readings loupe (like lab/loupe.ts, for the V–I bench).

/** She can lean at most this far either side. */
export const MAX_EYE_DEG = 30;
/** Past this many degrees off square, a reading counts as taken from the side. */
export const SQUARE_TOLERANCE_DEG = 5;

export type LoupeTarget = "ammeter" | "voltmeter" | "rule";
export type RuleEnd = "X" | "Y";

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
}

export const newPose = (): Pose => ({ position: [0, 0, 0], target: [0, 0, 0] });

export function clampEye(eyeDeg: number): number {
  return Math.max(-MAX_EYE_DEG, Math.min(MAX_EYE_DEG, Number.isFinite(eyeDeg) ? eyeDeg : 0));
}

/**
 * How far the camera sits from what it looks at so `widthM` of it fits across the screen
 * (vertical field of view `fovDeg`, screen `aspect`), never closer than `minM`.
 */
export function fitDistance(widthM: number, heightM: number, fovDeg: number, aspect: number) {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const forHeight = heightM / (2 * t);
  const forWidth = widthM / (2 * t * Math.max(aspect, 0.2));
  return Math.min(0.45, Math.max(forHeight, forWidth));
}

/**
 * Square to a meter's dial, along the sloping face's normal; the eye swings sideways about the
 * dial centre.
 */
export function meterPose(
  kind: "ammeter" | "voltmeter",
  eyeDeg: number,
  distanceM: number,
  out: Pose,
): Pose {
  const at = OHMS_LAW_LAYOUT[kind].position;
  const a = (clampEye(eyeDeg) * Math.PI) / 180;
  const cx = at[0];
  const cy = at[1] + METER_DIAL_CENTER.y;
  const cz = at[2] + METER_DIAL_CENTER.z;
  out.target[0] = cx;
  out.target[1] = cy;
  out.target[2] = cz;
  out.position[0] = cx + Math.sin(a) * distanceM;
  out.position[1] = cy + Math.cos(a) * distanceM * METER_FACE_NORMAL.y;
  out.position[2] = cz + Math.cos(a) * distanceM * METER_FACE_NORMAL.z;
  return out;
}

// The wire board's rule: its top face and the strip between the wire and the scale (WireBoard:
// board height 0.02 + rule thickness 0.003; rule z 0.019; wire z -0.015).
const RULE_TOP_Y = 0.023;
const RULE_Z = 0.019;
const WIRE_Z = -0.015;

/** Above and in front of the rule at X or Y, leaning along the wire with the eye angle. */
export function rulePose(
  wire: { startCm: number; lengthCm: number },
  end: RuleEnd,
  eyeDeg: number,
  distanceM: number,
  out: Pose,
): Pose {
  const at = OHMS_LAW_LAYOUT.wire.position;
  const a = (clampEye(eyeDeg) * Math.PI) / 180;
  const cm = end === "X" ? wire.startCm : wire.startCm + wire.lengthCm;
  const x = at[0] + cmToX(cm);
  out.target[0] = x;
  out.target[1] = RULE_TOP_Y + 0.002;
  out.target[2] = at[2] + (RULE_Z + WIRE_Z) / 2;
  out.position[0] = x + Math.sin(a) * distanceM;
  out.position[1] = out.target[1] + Math.cos(a) * distanceM * 0.75;
  out.position[2] = out.target[2] + distanceM * 0.65;
  return out;
}
