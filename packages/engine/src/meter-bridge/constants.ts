// Default parameters for the metre bridge (docs/07 §4.2). Ohms, volts, amps,
// seconds, centimetres and degrees, as the names say.

/** Physics step: 120 Hz, independent of frame rate (.claude/rules/science-engine.md). */
export const DT_S = 1 / 120;

/** Wire length between the end strips A and C. */
export const WIRE_LENGTH_CM = 100;

// Constantan resistivity 4.9 × 10⁻⁷ Ω m (Kaye & Laby, NPL tables of physical
// constants). A 0.50 mm diameter school bridge wire then has
// R per cm = ρ / (π d² / 4) / 100 ≈ 0.0250 Ω/cm, about 2.5 Ω for the metre.
export const CONSTANTAN_RESISTIVITY_OHM_M = 4.9e-7;
export const WIRE_DIAMETER_M = 0.5e-3;
export const WIRE_OHM_PER_CM =
  CONSTANTAN_RESISTIVITY_OHM_M / ((Math.PI * WIRE_DIAMETER_M ** 2) / 4) / 100;

export interface WireParams {
  ohmPerCm: number;
  /** Resistance of the joint and strip at end A (the end error α₁ = endAOhm / ohmPerCm). */
  endAOhm: number;
  endCOhm: number;
  /** Fractional rise in resistance per cm over a segment the jockey was dragged along. */
  scrapeFactor: number;
}

// End errors of about 0.6 cm and 0.8 cm, the size WAEC's "end error" precaution
// is about. Dragging raises the scraped segment by 3%, so a 20 cm scrape moves
// an R = X balance by about 3 mm ("a few millimetres", docs/07 §4.2).
export const DEFAULT_WIRE: Readonly<WireParams> = Object.freeze({
  ohmPerCm: WIRE_OHM_PER_CM,
  endAOhm: 0.6 * WIRE_OHM_PER_CM,
  endCOhm: 0.8 * WIRE_OHM_PER_CM,
  scrapeFactor: 0.03,
});

/**
 * A box with every plug in still has a few milliohms of contact resistance, so R is never
 * exactly 0. It must stay below DEFAULT_WIRE.endAOhm: with R ≈ 0, B sits at A's potential and
 * the null would lie inside the end-A joint, off the wire (docs/07 §4.2). The model has no lead
 * resistance in the R arm; leads would add to the contact resistance here.
 */
export const PLUG_CONTACT_OHM = 0.002;

export interface CellParams {
  restEmfV: number;
  restInternalOhm: number;
  /** Where emf and internal resistance head while current flows (polarisation). */
  polarisedEmfV: number;
  polarisedInternalOhm: number;
  /** Polarisation time constant at a current of refCurrentA; faster at higher current. */
  polariseTauS: number;
  refCurrentA: number;
  /** Depolarisation time constant with the key open. */
  recoverTauS: number;
}

// Leclanché cell: emf ≈ 1.5 V and internal resistance of the order of 1 Ω
// (Nelkon & Parker, Advanced Level Physics, cells). The polarised values and time
// constants are illustrative: no WAEC or textbook figure exists, so tests check
// only the behaviour (emf sags while the key is closed and recovers when open).
export const DEFAULT_CELL: Readonly<CellParams> = Object.freeze({
  restEmfV: 1.5,
  restInternalOhm: 0.8,
  polarisedEmfV: 1.2,
  polarisedInternalOhm: 2.0,
  polariseTauS: 60,
  refCurrentA: 0.5,
  recoverTauS: 20,
});

export interface GalvoParams {
  coilOhm: number;
  /** Steady deflection per amp through the coil. */
  degPerA: number;
  /** The needle stops at ±fullScaleDeg. */
  fullScaleDeg: number;
  naturalFreqHz: number;
  dampingRatio: number;
  /** Fraction of the speed kept when the needle bounces off a stop. */
  restitution: number;
  /** Impact speed above which hitting a stop counts as a slam. */
  slamSpeedDegPerS: number;
}

// Not a catalogue instrument: tuned for the screen. With R = X = 3 Ω and the
// default cell, a tap 5 cm off balance deflects about half scale, 1 cm off is a
// few degrees, and 20 cm off slams the needle without a protective resistor.
export const DEFAULT_GALVO: Readonly<GalvoParams> = Object.freeze({
  coilOhm: 50,
  degPerA: 24_400,
  fullScaleDeg: 45,
  naturalFreqHz: 1.5,
  dampingRatio: 0.35,
  restitution: 0.25,
  slamSpeedDegPerS: 400,
});

/** Optional series resistor in the galvanometer branch (none by default, so careless taps slam). */
export const DEFAULT_PROTECT_OHM = 0;
