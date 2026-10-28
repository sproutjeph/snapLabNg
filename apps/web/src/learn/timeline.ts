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
