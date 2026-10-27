import type { SnapEvent } from "@snaplab/contracts";

/** Finished event streams by photo SHA-256, least recently used evicted first (docs/04 §3). */
export class StreamCache {
  private map = new Map<string, SnapEvent[]>();

  constructor(private readonly max = 50) {}

  get(sha: string): SnapEvent[] | undefined {
    const v = this.map.get(sha);
    if (v) {
      this.map.delete(sha);
      this.map.set(sha, v);
    }
    return v;
  }

  set(sha: string, events: SnapEvent[]): void {
    this.map.delete(sha);
    this.map.set(sha, events);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
