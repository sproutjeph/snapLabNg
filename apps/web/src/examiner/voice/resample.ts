/**
 * Streaming downsampler to 16 kHz (box filter).
 *
 * Each output sample is the weighted average of the input samples that
 * overlap its window [(j * ratio), ((j + 1) * ratio)), where input sample i
 * is treated as covering [i, i + 1). That gives no aliasing from plain
 * decimation and works for integer and non-integer ratios alike.
 * Leftover input carries over between push() calls, so a stream gives the
 * same output however it is split into blocks.
 */
export class Resampler16k {
  private readonly ratio: number;
  private pending: number[] = [];
  private pendingStart = 0;
  private totalIn = 0;
  private nextOut = 0;

  constructor(inRate: number) {
    if (!Number.isFinite(inRate) || inRate < 16000) {
      throw new Error(`Resampler16k: input rate ${inRate} is below 16000 Hz`);
    }
    this.ratio = inRate / 16000;
  }

  push(input: Float32Array): Float32Array {
    for (let i = 0; i < input.length; i++) {
      this.pending.push(input[i] ?? 0);
    }
    this.totalIn += input.length;
    const out: number[] = [];
    for (;;) {
      const end = (this.nextOut + 1) * this.ratio;
      if (end > this.totalIn) break;
      out.push(this.average(this.nextOut, end));
      this.nextOut += 1;
    }
    this.prune();
    return new Float32Array(out);
  }

  flush(): Float32Array {
    const out: number[] = [];
    while (this.nextOut * this.ratio < this.totalIn) {
      const start = this.nextOut * this.ratio;
      const end = Math.min((this.nextOut + 1) * this.ratio, this.totalIn);
      if (end <= start) break;
      out.push(this.average(this.nextOut, end));
      this.nextOut += 1;
    }
    this.pending = [];
    this.pendingStart = this.totalIn;
    return new Float32Array(out);
  }

  private average(outIndex: number, end: number): number {
    const start = outIndex * this.ratio;
    let sum = 0;
    const first = Math.floor(start);
    const last = Math.ceil(end) - 1;
    for (let i = first; i <= last; i++) {
      const overlap = Math.min(end, i + 1) - Math.max(start, i);
      if (overlap <= 0) continue;
      const value = this.pending[i - this.pendingStart] ?? 0;
      sum += value * overlap;
    }
    return sum / (end - start);
  }

  private prune(): void {
    const keepFrom = Math.floor(this.nextOut * this.ratio);
    const drop = keepFrom - this.pendingStart;
    if (drop > 0) {
      this.pending.splice(0, drop);
      this.pendingStart = keepFrom;
    }
  }
}
