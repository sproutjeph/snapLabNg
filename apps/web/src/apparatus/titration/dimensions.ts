/**
 * All real-world sizes in metres (1 scene unit = 1 real metre).
 * Origin (0, 0, 0) sits on the bench top, directly under the conical flask's centre.
 */

export const WHITE_TILE_DIMS = {
  size: 0.15,
  thickness: 0.008,
} as const;

export const FLASK_DIMS = {
  baseDiameter: 0.085,
  baseRadius: 0.0425,
  innerBaseRadius: 0.041,
  neckDiameter: 0.035,
  neckRadius: 0.0175,
  innerNeckRadius: 0.0165,
  totalHeight: 0.14,
  bodyHeight: 0.1,
  neckHeight: 0.04,
  wallThickness: 0.0015,
  baseY: WHITE_TILE_DIMS.thickness,
  mouthY: WHITE_TILE_DIMS.thickness + 0.14,
} as const;

export const BURETTE_DIMS = {
  totalLength: 0.75,
  boreDiameter: 0.011,
  innerRadius: 0.0055,
  outerRadius: 0.0068,
  gradLength: 0.5,
  // Jet tip sits ~2 cm inside the conical flask's mouth (0.148 m - 0.02 m = 0.128 m)
  jetTipY: FLASK_DIMS.mouthY - 0.02,
  jetTopY: 0.175,
  stopcockY: 0.195,
  tubeBottomY: 0.215,
  gradBottomY: 0.25, // 50 cm³ graduation
  gradTopY: 0.75, // 0 cm³ graduation
  topY: FLASK_DIMS.mouthY - 0.02 + 0.75, // 0.878 m
  meniscusDepth: 0.0022,
} as const;

export const FUNNEL_DIMS = {
  coneTopRadius: 0.026,
  coneBottomRadius: 0.0038,
  coneHeight: 0.044,
  stemRadius: 0.0036,
  stemLength: 0.038,
  insertOffsetY: -0.028, // stem extends inside the burette top
} as const;

export const RETORT_STAND_DIMS = {
  baseWidth: 0.16,
  baseDepth: 0.14,
  baseHeight: 0.014,
  rodRadius: 0.0055,
  rodHeight: 0.9,
  rodX: -0.095,
  rodZ: -0.125,
  clampY: 0.52,
} as const;

export const PIPETTE_DIMS = {
  totalLength: 0.45,
  stemRadius: 0.0032,
  tipRadius: 0.0012,
  bulbRadius: 0.0115,
  bulbLength: 0.095,
  restHeight: 0.014,
} as const;

export const BEAKER_DIMS = {
  diameter: 0.072,
  radius: 0.036,
  height: 0.095,
  wallThickness: 0.0016,
  liquidHeight: 0.056,
} as const;

export const TITRATION_LAYOUT = {
  flaskPos: [0, WHITE_TILE_DIMS.thickness, 0] as const,
  tilePos: [0, 0, 0] as const,
  beakerPos: [-0.165, 0, 0.045] as const,
  pipettePos: [0.185, 0, 0.025] as const,
} as const;

/**
 * Converts a burette reading in cm³ (0 at the top graduation, 50 at the bottom)
 * to scene y height in metres. Clamped to [0, 50].
 */
export function volumeToY(cm3: number): number {
  const clamped = Math.min(50, Math.max(0, cm3));
  return BURETTE_DIMS.gradTopY - (clamped / 50) * BURETTE_DIMS.gradLength;
}

/**
 * Converts a scene y height in metres back to a burette reading in cm³,
 * clamped to [0, 50].
 */
export function yToVolume(y: number): number {
  const cm3 = ((BURETTE_DIMS.gradTopY - y) / BURETTE_DIMS.gradLength) * 50;
  if (cm3 < 0) return 0;
  if (cm3 > 50) return 50;
  return cm3;
}

/**
 * Computes the liquid height in metres inside the 250 cm³ conical flask from its
 * frustum geometry. Returns 0 for 0 cm³ and increases strictly with volume,
 * remaining below the flask's body height at 250 cm³.
 */
export function flaskLiquidHeight(cm3: number): number {
  const clampedCm3 = Math.min(250, Math.max(0, cm3));
  if (clampedCm3 <= 0) return 0;

  const vM3 = clampedCm3 * 1e-6;
  const r0 = FLASK_DIMS.innerBaseRadius;
  const r1 = FLASK_DIMS.innerNeckRadius;
  const hBody = FLASK_DIMS.bodyHeight;
  const k = (r0 - r1) / hBody; // slope dr/dh (positive as radius narrows upwards)

  const r0Cubed = r0 * r0 * r0;
  const r1Cubed = r1 * r1 * r1;
  const term = Math.max(r1Cubed, r0Cubed - (3 * k * vM3) / Math.PI);
  const rAtH = Math.cbrt(term);
  return (r0 - rAtH) / k;
}

/**
 * Returns the inner radius of the conical flask frustum at height `h` above the inner base.
 */
export function flaskInnerRadiusAtHeight(h: number): number {
  const clampedH = Math.min(FLASK_DIMS.bodyHeight, Math.max(0, h));
  const t = clampedH / FLASK_DIMS.bodyHeight;
  return FLASK_DIMS.innerBaseRadius + (FLASK_DIMS.innerNeckRadius - FLASK_DIMS.innerBaseRadius) * t;
}
