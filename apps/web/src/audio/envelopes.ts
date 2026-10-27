function clamp(value: number, lo: number, hi: number): number {
  if (Number.isNaN(value)) {
    return lo;
  }
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Gain of an ADSR envelope at time `t` seconds after the note starts.
 * Attack `a` rises 0 -> 1, decay `d` falls 1 -> sustain `s`, hold `holdS`
 * stays at `s`, then release `r` falls `s` -> 0. Always within [0, 1].
 */
export function adsr(t: number, a: number, d: number, s: number, r: number, holdS: number): number {
  if (!Number.isFinite(t) || t <= 0) {
    return 0;
  }
  const attack = Math.max(0, a);
  const decay = Math.max(0, d);
  const sustain = clamp(s, 0, 1);
  const release = Math.max(0, r);
  const hold = Math.max(0, holdS);

  let value: number;
  if (attack > 0 && t < attack) {
    value = t / attack;
  } else if (decay > 0 && t < attack + decay) {
    value = 1 - (1 - sustain) * ((t - attack) / decay);
  } else if (t < attack + decay + hold) {
    value = sustain;
  } else if (release > 0 && t < attack + decay + hold + release) {
    value = sustain * (1 - (t - attack - decay - hold) / release);
  } else {
    value = 0;
  }
  return clamp(value, 0, 1);
}

export interface SlamParams {
  freqHz: number;
  gain: number;
  decayS: number;
}

/**
 * Needle-slam voice parameters for `intensity` in [0, 1] (clamped).
 * Harder hits are louder, lower and longer.
 */
export function slamParams(intensity: number): SlamParams {
  const i = clamp(intensity, 0, 1);
  return {
    freqHz: 200 - 130 * i,
    gain: 0.25 + 0.55 * i,
    decayS: 0.06 + 0.3 * i,
  };
}

export interface ScrapeParams {
  durationS: number;
  q: number;
}

/** Clamps a scrape length to 0.1-1.5 s and picks its bandpass Q. */
export function scrapeParams(durationS: number): ScrapeParams {
  const clamped = clamp(durationS, 0.1, 1.5);
  const q = 1 + ((clamped - 0.1) / 1.4) * 1.5;
  return { durationS: clamped, q };
}

/**
 * Deterministic noise in [-1, 1] from a seeded PRNG (mulberry32).
 * Same length and seed always give the same samples. No Math.random.
 */
export function makeNoise(length: number, seed: number): Float32Array {
  const len = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  const out = new Float32Array(len);
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < len; i += 1) {
    out[i] = next() * 2 - 1;
  }
  return out;
}
