import type { GalvoParams } from "./constants";

export interface NeedleState {
  thetaDeg: number;
  omegaDegPerS: number;
  /** True on the step in which the needle hit a stop faster than slamSpeedDegPerS. */
  slammed: boolean;
}

export const NEEDLE_AT_REST: Readonly<NeedleState> = Object.freeze({
  thetaDeg: 0,
  omegaDegPerS: 0,
  slammed: false,
});

/**
 * One step of the centre-zero needle (docs/07 §4.2): a damped oscillator
 * θ'' + 2ζω₀θ' + ω₀²θ = ω₀²·S·I, so a steady current gives θ = S·I. Semi-implicit
 * Euler. At ±fullScaleDeg the needle stops and bounces back with `restitution`.
 * Positive current (B→J) deflects to +θ.
 */
export function stepNeedle(
  n: NeedleState,
  currentA: number,
  g: GalvoParams,
  dtS: number,
): NeedleState {
  const w0 = 2 * Math.PI * g.naturalFreqHz;
  const accel =
    w0 * w0 * (g.degPerA * currentA - n.thetaDeg) - 2 * g.dampingRatio * w0 * n.omegaDegPerS;
  let omega = n.omegaDegPerS + accel * dtS;
  let theta = n.thetaDeg + omega * dtS;
  let slammed = false;
  if (Math.abs(theta) >= g.fullScaleDeg) {
    const side = Math.sign(theta);
    theta = side * g.fullScaleDeg;
    if (omega * side > 0) {
      slammed = Math.abs(omega) > g.slamSpeedDegPerS;
      omega = -omega * g.restitution;
    }
  }
  return { thetaDeg: theta, omegaDegPerS: omega, slammed };
}
