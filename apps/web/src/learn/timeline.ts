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
  /** Moves to time tS and calls every tween with its progress at that time. */
  seek(tS: number): void;
  readonly durationS: number;
}

interface Tween {
  atS: number;
  durS: number;
  update: (k: number) => void;
  ease: Ease;
}

export function createTimeline(): Timeline {
  const tweens: Tween[] = [];
  let durationS = 0;
  const tl: Timeline = {
    add(atS, durS, update, opts) {
      tweens.push({ atS, durS: Math.max(durS, 0), update, ease: opts?.ease ?? ease.inOut });
      durationS = Math.max(durationS, atS + Math.max(durS, 0));
      return tl;
    },
    seek(tS) {
      for (const t of tweens) {
        const raw = t.durS === 0 ? (tS >= t.atS ? 1 : 0) : (tS - t.atS) / t.durS;
        const k = Math.min(1, Math.max(0, raw));
        t.update(t.ease(k));
      }
    },
    get durationS() {
      return durationS;
    },
  };
  return tl;
}
