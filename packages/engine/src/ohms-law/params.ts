import { type CellParams, CONSTANTAN_RESISTIVITY_OHM_M, DEFAULT_CELL } from "../meter-bridge";
import type { MeterParams, NeedleDynamics, OhmsLawParams } from "./types";

// Constants of the Ohm's-law (V–I) bench, docs/07 §4.4 and docs/plans/ohms-law-vi.md
// ("Physics decisions"). Units are in the names. Where no textbook or WAEC figure exists the
// comment says so, and the tests check only behaviour.

/** Standard Wire Gauge diameters (BS 3737 / Imperial SWG: 0.0148, 0.0136 and 0.0124 in). */
export const SWG_DIAMETER_MM: Readonly<Record<28 | 29 | 30, number>> = Object.freeze({
  28: 0.3759,
  29: 0.3454,
  30: 0.315,
});

/** R_XY band (docs/plans/ohms-law-vi.md): keeps I(R=0) ≤ 0.92 A and V ≤ 2.8 V with fresh cells. */
export const WIRE_XY_MIN_OHM = 2.8;
export const WIRE_XY_MAX_OHM = 4.5;

/** Length range per gauge (docs/plans/ohms-law-vi.md, "Ammeter range"), clipped to the R band. */
export const SWG_LENGTH_RANGE_CM: Readonly<Record<28 | 29 | 30, readonly [number, number]>> =
  Object.freeze({
    28: [63.5, 100],
    29: [53, 86],
    30: [45, 72],
  });

/** The metre rule beside XY runs 0–100 cm; X and Y stay at least this far from its ends. */
export const RULE_LENGTH_CM = 100;
export const RULE_MARGIN_CM = 1;

// Constantan α ≈ 8 × 10⁻⁶ K⁻¹ (docs/07 §4.2; Kaye & Laby, NPL tables of physical constants).
export const CONSTANTAN_ALPHA_PER_K = 8e-6;
// Constantan density 8.9 g cm⁻³ and specific heat capacity ≈ 0.41 J g⁻¹ K⁻¹ (Kaye & Laby).
export const CONSTANTAN_DENSITY_KG_M3 = 8900;
export const CONSTANTAN_SPECIFIC_HEAT_J_PER_KG_K = 410;
// Heat-transfer coefficient of a sub-millimetre wire in still air (convection plus radiation).
// No textbook figure for this bench: an order-of-magnitude choice, so R = 0 warms XY by tens of
// kelvin with a time constant of a few seconds. Tests check behaviour only.
export const WIRE_COOLING_W_PER_M2_K = 80;

// A fresh dry (Leclanché-type) cell: emf 1.5–1.6 V (Nelkon & Parker, Advanced Level Physics,
// cells: emf ≈ 1.5 V; a fresh zinc–carbon cell reads up to about 1.6 V on open circuit) and
// internal resistance 0.3–0.6 Ω each (the plan's band; Nelkon & Parker give "of the order of
// 1 Ω" for the Leclanché cell, and a dry cell is lower).
export const CELL_EMF_RANGE_V = [1.5, 1.6] as const;
export const CELL_INTERNAL_RANGE_OHM = [0.3, 0.6] as const;
// Polarisation: ILLUSTRATIVE. There is no WAEC or textbook figure for it. The values are reasoned
// from zinc–carbon dry cells at heavy drain (several hundred mA), whose terminal voltage falls by
// about 0.1 V over minutes, not seconds. The emf heads for 0.2 V below rest and r doubles, with a
// time constant of 300 s at 0.5 A (faster at higher current, stepCell). At R = 0 on seed 3 that
// is about 0.010 A in 8 s (under a division while she reads) and about 0.06 A in a minute (a key
// left closed shows). Recovery on open circuit keeps the metre bridge's 20 s.
export const CELL_POLARISED_SAG_V = 0.2;
export const CELL_POLARISED_R_FACTOR = 2;
export const CELL_POLARISE_TAU_S = 300;
export const CELL_POLARISE_REF_CURRENT_A = 0.5;
export const CELL_RECOVER_TAU_S = DEFAULT_CELL.recoverTauS;

// Moving-coil needle: near-critically damped ("dead-beat", Nelkon & Parker, the moving-coil
// galvanometer: eddy-current damping in the aluminium former). Frequency, restitution and slam
// speed are screen choices (no textbook figure), the slam speed and restitution as for the
// metre bridge's galvanometer.
export const METER_NEEDLE: Readonly<NeedleDynamics> = Object.freeze({
  naturalFreqHz: 1.5,
  dampingRatio: 0.7,
  restitution: 0.25,
  slamSpeedDegPerS: 400,
});

// Ammeter 0–1 A in 0.02 A divisions, R_A ≈ 0.1 Ω; voltmeter 0–3 V in 0.05 V divisions at
// 1 kΩ/V, so R_V = 3 kΩ (docs/07 §4.4; a school moving-coil voltmeter of 1000 Ω per volt).
export const AMMETER_FULL_SCALE_A = 1;
export const AMMETER_DIVISION_A = 0.02;
export const AMMETER_OHM = 0.1;
export const VOLTMETER_FULL_SCALE_V = 3;
export const VOLTMETER_DIVISION_V = 0.05;
export const VOLTMETER_OHM_PER_V = 1000;

/** Resistance-box coils in plug order (docs/07 §4.4). */
export const BOX_COILS_OHM: readonly number[] = Object.freeze([1, 2, 2, 5, 10, 20, 20, 50]);

/** mulberry32: a small, fast, deterministic PRNG. Returns a function giving [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (lo: number, hi: number, u: number) => lo + (hi - lo) * u;

/** Resistance per metre of constantan of diameter d: ρ / (π d² / 4). */
export function constantanOhmPerM(diameterMm: number): number {
  const d = diameterMm * 1e-3;
  return CONSTANTAN_RESISTIVITY_OHM_M / ((Math.PI * d * d) / 4);
}

/** The lengths a gauge may take: its plan range, clipped so R_XY stays in the band and on the rule. */
export function gaugeLengthRangeCm(swg: 28 | 29 | 30): readonly [number, number] {
  const perCm = constantanOhmPerM(SWG_DIAMETER_MM[swg]) / 100;
  const [lo, hi] = SWG_LENGTH_RANGE_CM[swg];
  return [
    Math.max(lo, WIRE_XY_MIN_OHM / perCm),
    Math.min(hi, WIRE_XY_MAX_OHM / perCm, RULE_LENGTH_CM - 2 * RULE_MARGIN_CM),
  ];
}

const GAUGES = [28, 29, 30] as const;

/** Bench parameters for one session, chosen from the seed. Pure: the same seed gives the same bench. */
export function paramsFromSeed(seed: number): OhmsLawParams {
  const rand = mulberry32(seed);
  // Gauge first, then a length in that gauge's range, so the length she measures and the
  // resistance agree (docs/plans/ohms-law-vi.md).
  const swg = GAUGES[Math.min(2, Math.floor(rand() * 3))] ?? 28;
  const [loCm, hiCm] = gaugeLengthRangeCm(swg);
  const lengthCm = lerp(loCm, hiCm, rand());
  const startCm = lerp(RULE_MARGIN_CM, RULE_LENGTH_CM - RULE_MARGIN_CM - lengthCm, rand());
  const diameterMm = SWG_DIAMETER_MM[swg];
  const ohm = (constantanOhmPerM(diameterMm) * lengthCm) / 100;

  const restEmfV = lerp(CELL_EMF_RANGE_V[0], CELL_EMF_RANGE_V[1], rand());
  const restInternalOhm = lerp(CELL_INTERNAL_RANGE_OHM[0], CELL_INTERNAL_RANGE_OHM[1], rand());
  const cell: CellParams = {
    restEmfV,
    restInternalOhm,
    polarisedEmfV: restEmfV - CELL_POLARISED_SAG_V,
    polarisedInternalOhm: restInternalOhm * CELL_POLARISED_R_FACTOR,
    polariseTauS: CELL_POLARISE_TAU_S,
    refCurrentA: CELL_POLARISE_REF_CURRENT_A,
    recoverTauS: CELL_RECOVER_TAU_S,
  };

  // Ammeter zero error: none half the time, otherwise one division either way.
  const z = rand();
  const zeroDivisions = z < 0.5 ? 0 : z < 0.75 ? 1 : -1;

  const ammeter: MeterParams = {
    fullScale: AMMETER_FULL_SCALE_A,
    division: AMMETER_DIVISION_A,
    ohm: AMMETER_OHM,
    zeroError: zeroDivisions * AMMETER_DIVISION_A,
    needle: METER_NEEDLE,
  };
  const voltmeter: MeterParams = {
    fullScale: VOLTMETER_FULL_SCALE_V,
    division: VOLTMETER_DIVISION_V,
    ohm: VOLTMETER_OHM_PER_V * VOLTMETER_FULL_SCALE_V,
    zeroError: 0,
    needle: METER_NEEDLE,
  };

  return {
    seed,
    cell,
    ammeter,
    voltmeter,
    wire: { lengthCm, startCm, ohm, diameterMm, alphaPerK: CONSTANTAN_ALPHA_PER_K },
    boxCoilsOhm: BOX_COILS_OHM,
  };
}
