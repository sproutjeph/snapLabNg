import { BRIDGE_WIRE, METRE_RULE } from "../apparatus/meter-bridge/dimensions";

/** How far the eye is from the scale in the close-up, in metres. */
const EYE_DISTANCE_M = 0.16;
/** She can lean at most this far either side. */
export const MAX_EYE_DEG = 30;

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * The close-up camera at jockey position `jx` (scene metres): it looks at the strip between
 * the wire and the rule, square to the scale (eyeDeg = 0) or leaning sideways along the
 * wire. At 0 the jockey's edge sits over the true mark; leaning shifts which mark it seems
 * to meet. That is the parallax WAEC asks students to avoid. Writes into `out` (no
 * allocation in the render loop).
 */
export function loupePose(
  jx: number,
  eyeDeg: number,
  out: Pose = { position: [0, 0, 0], target: [0, 0, 0] },
): Pose {
  const a = (Math.max(-MAX_EYE_DEG, Math.min(MAX_EYE_DEG, eyeDeg)) * Math.PI) / 180;
  out.target[0] = jx;
  out.target[1] = BRIDGE_WIRE.y;
  out.target[2] = (BRIDGE_WIRE.z + METRE_RULE.z) / 2;
  // From the student's side of the bench and above, so the jockey's handle falls towards
  // her (down the screen) and leaves the scale behind the knife-edge in view.
  out.position[0] = jx + Math.sin(a) * EYE_DISTANCE_M;
  out.position[1] = out.target[1] + Math.cos(a) * EYE_DISTANCE_M * 0.75;
  out.position[2] = out.target[2] + EYE_DISTANCE_M * 0.65;
  return out;
}
