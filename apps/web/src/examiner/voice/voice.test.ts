import { describe, expect, it } from "vitest";
import { Chunker, floatToPcm16 } from "./pcm16";
import { Resampler16k } from "./resample";
import { pcm16ToWav } from "./wav";

function collect(resampler: Resampler16k, input: Float32Array, block: number): Float32Array {
  const parts: Float32Array[] = [];
  for (let i = 0; i < input.length; i += block) {
    parts.push(resampler.push(input.subarray(i, i + block)));
  }
  parts.push(resampler.flush());
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("Resampler16k", () => {
  it("downsamples 48000 Hz by 3: 4800 samples in give 1600 out", () => {
    const resampler = new Resampler16k(48000);
    const out = resampler.push(new Float32Array(4800).fill(0.25));
    expect(out.length).toBe(1600);
  });

  it("passes a constant 0.5 through at 0.5", () => {
    const resampler = new Resampler16k(48000);
    const out = resampler.push(new Float32Array(4800).fill(0.5));
    expect(out.length).toBe(1600);
    for (const v of out) expect(v).toBeCloseTo(0.5, 6);
  });

  it("handles 44100 Hz in blocks of 128 and gives 16000 ± 1 samples", () => {
    const input = new Float32Array(44100);
    for (let i = 0; i < input.length; i++) input[i] = Math.sin(i * 0.01);
    const out = collect(new Resampler16k(44100), input, 128);
    expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(1);
  });

  it("gives the same samples for blocks of 128 and blocks of 1000 at 44100 Hz", () => {
    const input = new Float32Array(44100);
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin(i * 0.013) * 0.6 + Math.sin(i * 0.0011) * 0.3;
    }
    const a = collect(new Resampler16k(44100), input, 128);
    const b = collect(new Resampler16k(44100), input, 1000);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i] ?? 0, 6);
  });

  it("keeps a 1 kHz tone at about 2000 zero crossings per second", () => {
    const input = new Float32Array(48000);
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin(2 * Math.PI * 1000 * (i / 48000));
    }
    const out = collect(new Resampler16k(48000), input, 48000);
    expect(out.length).toBe(16000);
    let crossings = 0;
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1] ?? 0;
      const cur = out[i] ?? 0;
      if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) crossings += 1;
    }
    expect(crossings).toBeGreaterThanOrEqual(2000 * 0.98);
    expect(crossings).toBeLessThanOrEqual(2000 * 1.02);
  });

  it("throws for an input rate below 16000 Hz", () => {
    expect(() => new Resampler16k(8000)).toThrow();
  });
});

describe("floatToPcm16", () => {
  it("clamps to [-1, 1] and scales -1 to -32768 and 1 to 32767", () => {
    const out = floatToPcm16(new Float32Array([-1, 0, 1, 2, -3]));
    expect(Array.from(out)).toEqual([-32768, 0, 32767, 32767, -32768]);
  });
});

describe("Chunker", () => {
  it("gives two 1600 chunks from 4000 samples and flushes 800", () => {
    const chunker = new Chunker(1600);
    const chunks = chunker.push(new Int16Array(4000).fill(7));
    expect(chunks.length).toBe(2);
    for (const c of chunks) expect(c.length).toBe(1600);
    const rest = chunker.flush();
    expect(rest?.length).toBe(800);
  });

  it("gives one chunk from 1600 samples and flush returns null", () => {
    const chunker = new Chunker(1600);
    const chunks = chunker.push(new Int16Array(1600));
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.length).toBe(1600);
    expect(chunker.flush()).toBeNull();
  });
});

describe("pcm16ToWav", () => {
  it("writes a 44-byte RIFF/WAVE header for 16000 samples", async () => {
    const blob = pcm16ToWav([new Int16Array(16000)]);
    expect(blob.size).toBe(44 + 32000);
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    const text = (off: number, len: number) =>
      new TextDecoder().decode(new Uint8Array(buf, off, len));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
  });
});
