export const VIEWBOX_WIDTH = 1200;
export const VIEWBOX_HEIGHT = 700;
export const WIRE_Y = 420;
export const WIRE_START_X = 100;
export const WIRE_END_X = 1100;

/**
 * Converts wire position in cm (0–100) to SVG x coordinate (100–1100),
 * clamping to the wire ends.
 */
export function cmToSvgX(cm: number): number {
  const clampedCm = Math.max(0, Math.min(100, cm));
  return WIRE_START_X + clampedCm * 10;
}

/**
 * Converts SVG x coordinate to wire position in cm (0–100),
 * clamping to the wire bounds.
 */
export function svgXToCm(x: number): number {
  const clampedX = Math.max(WIRE_START_X, Math.min(WIRE_END_X, x));
  return (clampedX - WIRE_START_X) / 10;
}

/**
 * Maps pointer clientX coordinate on the rendered SVG element to cm on the wire.
 * Uses the 1200px viewBox coordinate space to scale proportionally at any rendered size.
 */
export function clientXToCm(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) return 0;
  const svgX = ((clientX - rectLeft) / rectWidth) * VIEWBOX_WIDTH;
  return svgXToCm(svgX);
}

/**
 * Clamps galvanometer needle deflection to ±45 degrees.
 */
export function needleAngle(deg: number): number {
  return Math.max(-45, Math.min(45, deg));
}

/**
 * Evaluates whether pointer movement constitutes a drag (exceeds 4 px threshold).
 */
export function isDrag(dxPx: number): boolean {
  return Math.abs(dxPx) > 4;
}
