/** Float samples in [-1, 1] to signed 16-bit PCM. */
export function floatToPcm16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const raw = f[i] ?? 0;
    const v = Number.isNaN(raw) ? 0 : Math.max(-1, Math.min(1, raw));
    out[i] = Math.round(v * (v < 0 ? 32768 : 32767));
  }
  return out;
}

/** Groups a PCM16 stream into fixed-size chunks (100 ms = 1600 at 16 kHz). */
export class Chunker {
  private readonly size: number;
  private pending: number[] = [];

  constructor(samplesPerChunk = 1600) {
    if (!Number.isInteger(samplesPerChunk) || samplesPerChunk <= 0) {
      throw new Error(
        `Chunker: samplesPerChunk must be a positive integer, got ${samplesPerChunk}`,
      );
    }
    this.size = samplesPerChunk;
  }

  push(s: Int16Array): Int16Array[] {
    for (let i = 0; i < s.length; i++) {
      this.pending.push(s[i] ?? 0);
    }
    const chunks: Int16Array[] = [];
    while (this.pending.length >= this.size) {
      chunks.push(new Int16Array(this.pending.splice(0, this.size)));
    }
    return chunks;
  }

  flush(): Int16Array | null {
    if (this.pending.length === 0) return null;
    const out = new Int16Array(this.pending);
    this.pending = [];
    return out;
  }
}
