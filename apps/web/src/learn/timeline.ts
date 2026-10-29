// A tiny timeline for step reveals: tweens placed at absolute times, driven by seek().
// No allocation per seek, so it can run inside useFrame.

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  /** Overshoots a little, then settles at 1. */
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  /** Quadratic ease-in: starts slowly, like something let go. */
  quad: (t: number) => t * t,
  /** Falls to 1 and bounces back up three times, each bounce smaller (Penner's easeOutBounce). */
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) {
      const u = t - 1.5 / d1;
      return n1 * u * u + 0.75;
    }
    if (t < 2.5 / d1) {
      const u = t - 2.25 / d1;
      return n1 * u * u + 0.9375;
    }
    const u = t - 2.625 / d1;
    return n1 * u * u + 0.984375;
  },
} satisfies Record<string, Ease>;

export interface Timeline {
  /** Adds a tween from atS to atS + durS. `update` gets the eased progress, 0 to 1. */
  add(atS: number, durS: number, update: (k: number) => void, opts?: { ease?: Ease }): Timeline;
  /**
   * Moves to time tS and calls every tween with its progress at that time. Tweens that have
   * not started are applied first (latest start first), then the started ones in start order,
   * so tweens chained on one property end with the one that is playing. Two tweens on one
   * property must not share a start time.
   */
  seek(tS: number): void;
  readonly durationS: number;
}

interface Tween {
  atS: number;
  durS: number;
  update: (k: number) => void;
  ease: Ease;
}

const progress = (t: Tween, tS: number) => {
  const raw = t.durS === 0 ? (tS >= t.atS ? 1 : 0) : (tS - t.atS) / t.durS;
  return Math.min(1, Math.max(0, raw));
};

export function createTimeline(): Timeline {
  // Kept sorted by start time (stable for equal starts).
  const tweens: Tween[] = [];
  let durationS = 0;
  const tl: Timeline = {
    add(atS, durS, update, opts) {
      const tween = { atS, durS: Math.max(durS, 0), update, ease: opts?.ease ?? ease.inOut };
      let i = tweens.length;
      while (i > 0 && (tweens[i - 1]?.atS ?? 0) > atS) i--;
      tweens.splice(i, 0, tween);
      durationS = Math.max(durationS, atS + tween.durS);
      return tl;
    },
    seek(tS) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const t = tweens[i];
        if (t && tS < t.atS) t.update(t.ease(0));
      }
      for (const t of tweens) {
        if (tS >= t.atS) t.update(t.ease(progress(t, tS)));
      }
    },
    get durationS() {
      return durationS;
    },
  };
  return tl;
}

// ---- Motion helpers (docs/plans/exam-redesign.md, "The look": Motion) ----
// Backcountry 101's recipe: tweens of at most 0.4 s, objects drop with a bounce, pop with a
// little overshoot and arc to where they go. The helpers take callbacks, so they know nothing
// about the scene. Each tween is placed on the timeline, so seek() replays them exactly.

/** The longest a motion tween runs (docs/plans/exam-redesign-brief.md, research report 2). */
export const MAX_TWEEN_S = 0.4;
/** How far a dropped part falls, in world units (the brief: 2.2). */
export const DROP_HEIGHT = 2.2;
/** The share of a drop's time at which the part first touches down: the first bounce of outBounce. */
export const DROP_IMPACT_AT = 1 / 2.75;
/** How long the dust puff lasts after impact. */
export const PUFF_S = 0.35;
/** Gap between neighbours when parts enter one after another (the brief: .025 to .1 s). */
export const STAGGER_S = 0.1;

export interface DropCallbacks {
  /** Height above the resting place, from `height` down to 0, bouncing. */
  y?: (heightAboveRest: number) => void;
  /** False until the part first touches down, then true: the shadow switches on at impact. */
  shadow?: (on: boolean) => void;
  /** 0 to 1 over the dust puff that follows the impact; 0 before it. */
  puff?: (k: number) => void;
}

/** Start time of the i-th of several things that enter one after another. */
export const stagger = (atS: number, i: number, stepS: number = STAGGER_S): number =>
  atS + i * stepS;

/**
 * A part drops from `height` above its place and bounces to rest in at most 0.4 s. It casts no
 * shadow until it first touches down, where a dust puff fires.
 */
export function drop(
  tl: Timeline,
  atS: number,
  cb: DropCallbacks,
  opts: { height?: number; durS?: number } = {},
): Timeline {
  const height = opts.height ?? DROP_HEIGHT;
  const durS = Math.min(opts.durS ?? MAX_TWEEN_S, MAX_TWEEN_S);
  tl.add(atS, durS, (k) => cb.y?.(height * (1 - k)), { ease: ease.outBounce });
  if (cb.shadow) {
    const shadow = cb.shadow;
    // A zero-length tween: off before the impact, on from then on (seek-safe, unlike a flag).
    tl.add(atS + durS * DROP_IMPACT_AT, 0, (k) => shadow(k >= 1), { ease: ease.linear });
  }
  if (cb.puff) {
    tl.add(atS + durS * DROP_IMPACT_AT, PUFF_S, cb.puff, { ease: ease.linear });
  }
  return tl;
}

/** A part pops in: scale 0.01 to 1 with a little overshoot (outBack). */
export function pop(
  tl: Timeline,
  atS: number,
  set: (scale: number) => void,
  durS: number = 0.3,
): Timeline {
  return tl.add(atS, Math.min(durS, MAX_TWEEN_S), (k) => set(0.01 + 0.99 * k), {
    ease: ease.outBack,
  });
}

/** A part travels from one point to another along an arc that rises `lift` at mid-way. */
export function arc(
  tl: Timeline,
  atS: number,
  durS: number,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  lift: number,
  set: (x: number, y: number, z: number) => void,
): Timeline {
  return tl.add(
    atS,
    Math.min(durS, MAX_TWEEN_S),
    (k) => {
      const rise = Math.sin(Math.PI * k) * lift;
      set(
        from[0] + (to[0] - from[0]) * k,
        from[1] + (to[1] - from[1]) * k + rise,
        from[2] + (to[2] - from[2]) * k,
      );
    },
    { ease: ease.inOut },
  );
}
