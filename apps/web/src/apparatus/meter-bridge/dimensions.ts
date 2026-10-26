/**
 * All real-world sizes in metres (1 scene unit = 1 real metre).
 * Origin (0, 0, 0) sits at the centre of the top face of the metre bridge wooden base.
 * The 100 cm constantan wire runs along +x from x = -0.5 (0 cm, end A) to x = +0.5 (100 cm, end C).
 */

export const BRIDGE_BASE = {
  length: 1.1,
  height: 0.03,
  depth: 0.15,
} as const;

export const BRIDGE_WIRE = {
  length: 1.0,
  startX: -0.5,
  endX: 0.5,
  y: 0.0025,
  z: 0.052,
  diameter: 0.0005,
  renderRadius: 0.0014,
  hitBoxHeight: 0.024,
  hitBoxDepth: 0.028,
} as const;

export const METRE_RULE = {
  length: 1.0,
  thickness: 0.0025,
  depth: 0.028,
  z: 0.028,
} as const;

export const COPPER_STRIP = {
  width: 0.02,
  thickness: 0.003,
  gapWidth: 0.03,
  backZ: -0.048,
  frontZ: 0.052,
  leftGapCenterX: -0.24,
  rightGapCenterX: 0.24,
} as const;

export const TERMINAL_SCREW = {
  baseRadius: 0.006,
  baseHeight: 0.004,
  postRadius: 0.0032,
  postHeight: 0.011,
  capRadius: 0.0055,
  capHeight: 0.005,
} as const;

export const JOCKEY_DIMS = {
  bladeWidth: 0.008,
  bladeHeight: 0.018,
  bladeThickness: 0.0018,
  collarRadius: 0.0065,
  collarHeight: 0.01,
  handleRadiusBottom: 0.007,
  handleRadiusTop: 0.0085,
  handleHeight: 0.065,
  liftOffset: 0.014,
} as const;

export const PLUG_BOX_DIMS = {
  width: 0.2,
  height: 0.06,
  depth: 0.1,
  topThickness: 0.006,
  blockHeight: 0.006,
  blockDepth: 0.026,
  blockGap: 0.004,
  plugShaftRadiusTop: 0.0042,
  plugShaftRadiusBottom: 0.003,
  plugShaftHeight: 0.018,
  plugHeadRadius: 0.007,
  plugHeadHeight: 0.016,
  marginX: 0.024,
} as const;

export const GALVANOMETER_DIMS = {
  diameter: 0.12,
  radius: 0.06,
  height: 0.072,
  dialRadius: 0.048,
  needleLength: 0.042,
  maxDeg: 45,
} as const;

export const LECLANCHE_DIMS = {
  jarDiameter: 0.1,
  jarRadius: 0.05,
  jarHeight: 0.15,
  potDiameter: 0.046,
  potRadius: 0.023,
  potHeight: 0.142,
  carbonRadius: 0.0065,
  carbonHeight: 0.162,
  zincRadius: 0.004,
  zincHeight: 0.158,
  zincOffsetX: -0.034,
} as const;

export const PLUG_KEY_DIMS = {
  width: 0.08,
  height: 0.016,
  depth: 0.05,
  blockWidth: 0.026,
  blockHeight: 0.008,
  blockDepth: 0.024,
  gap: 0.005,
} as const;

export const UNKNOWN_RESISTOR_DIMS = {
  bobbinRadius: 0.012,
  bobbinLength: 0.048,
  flangeRadius: 0.016,
  flangeThickness: 0.003,
} as const;

export const BENCH_LAYOUT = {
  plugBoxPos: [-0.24, 0, -0.19] as const,
  unknownPos: [0.24, 0, -0.15] as const,
  galvanometerPos: [0, 0, -0.21] as const,
  cellPos: [-0.46, 0, -0.21] as const,
  plugKeyPos: [0.44, 0, -0.18] as const,
} as const;

/**
 * Converts a metre-bridge wire reading in cm (0 at end A, 100 at end C) to scene x in metres.
 */
export function cmToX(cm: number): number {
  return cm / 100 - 0.5;
}

/**
 * Converts a scene x coordinate in metres back to cm on the wire, clamped to [0, 100].
 */
export function xToCm(x: number): number {
  const cm = (x + 0.5) * 100;
  if (cm < 0) return 0;
  if (cm > 100) return 100;
  return cm;
}

/**
 * Returns `n` evenly spaced, non-overlapping x positions (in local box coordinates)
 * inside `[-boxWidth / 2, +boxWidth / 2]` for `n` plugs.
 */
export function plugPositions(
  n: number,
  boxWidth: number = PLUG_BOX_DIMS.width,
  margin: number = PLUG_BOX_DIMS.marginX,
): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const usableWidth = Math.max(0.02, boxWidth - margin * 2);
  const step = usableWidth / (n - 1);
  const start = -usableWidth / 2;
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    positions.push(start + i * step);
  }
  return positions;
}
