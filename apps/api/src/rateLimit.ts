/** Fixed one-hour windows per key (an IP). In memory: one instance, always on (docs/04 §3). */
export class RateLimiter {
  private hits = new Map<string, { windowStartMs: number; count: number }>();

  constructor(
    private readonly perHour: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Counts one request; false if this key has used up its hour. */
  allow(key: string): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || t - h.windowStartMs >= 3_600_000) {
      this.hits.set(key, { windowStartMs: t, count: 1 });
      return this.perHour >= 1;
    }
    if (h.count >= this.perHour) return false;
    h.count += 1;
    return true;
  }
}
