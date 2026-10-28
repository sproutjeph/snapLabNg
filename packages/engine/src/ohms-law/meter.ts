import type { NeedleState } from "../meter-bridge";
import {
  METER_FULL_DEG,
  METER_STOP_DEG,
  METER_ZERO_DEG,
  type MeterParams,
  type NeedleDynamics,
} from "./types";

/** Dial degrees per unit of reading: zero at METER_ZERO_DEG, full scale at METER_FULL_DEG. */
export const METER_SPAN_DEG = METER_FULL_DEG - METER_ZERO_DEG;

/**
 * Where the needle settles for a reading (amperes or volts through the meter, + to −). The seeded
 * zero error offsets every reading; the zero-adjust trim moves the needle back. Nothing clamps it
 * here: a reversed or over-range meter asks for an angle past a stop, and stepMeter hits the stop.
 */
export function meterTargetDeg(m: MeterParams, reading: number, trimDeg: number): number {
  // A non-finite reading or trim counts as 0, so one bad value never leaves the needle NaN.
  const r = Number.isFinite(reading) ? reading : 0;
  const trim = Number.isFinite(trimDeg) ? trimDeg : 0;
  return METER_ZERO_DEG + (METER_SPAN_DEG * (r + m.zeroError)) / m.fullScale + trim;
}

/** Where the needle rests with no current and no trim. */
export const meterRestDeg = (m: MeterParams): number => meterTargetDeg(m, 0, 0);

/**
 * One 120 Hz step of a left-zero moving-coil needle: the metre bridge's stepNeedle dynamics
 * (θ'' + 2ζω₀θ' + ω₀²θ = ω₀²·θ_target, semi-implicit Euler) on the dial's own angles, with stops
 * at ±METER_STOP_DEG. A needle that meets a stop bounces back with `restitution`; it slams when
 * it arrives faster than slamSpeedDegPerS. A reversed meter is driven below zero by the same
 * physics, and reaches the −45° stop only above 1/16 of full scale (5° of the 80° span).
 * A non-finite target counts as a zero reading (METER_ZERO_DEG), so the needle never goes NaN.
 */
export function stepMeter(
  n: NeedleState,
  targetDeg: number,
  d: NeedleDynamics,
  dtS: number,
): NeedleState {
  const w0 = 2 * Math.PI * d.naturalFreqHz;
  const target = Number.isFinite(targetDeg) ? targetDeg : METER_ZERO_DEG;
  const accel = w0 * w0 * (target - n.thetaDeg) - 2 * d.dampingRatio * w0 * n.omegaDegPerS;
  let omega = n.omegaDegPerS + accel * dtS;
  let theta = n.thetaDeg + omega * dtS;
  let slammed = false;
  if (Math.abs(theta) >= METER_STOP_DEG) {
    const side = Math.sign(theta);
    theta = side * METER_STOP_DEG;
    if (omega * side > 0) {
      slammed = Math.abs(omega) > d.slamSpeedDegPerS;
      omega = -omega * d.restitution;
    }
  }
  return { thetaDeg: theta, omegaDegPerS: omega, slammed };
}
