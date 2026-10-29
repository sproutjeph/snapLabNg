// Four small sounds for the practical (docs/plans/exam-redesign.md, "The look": Sound): a lead
// snapping on, a plug going in, the key, a page turning. Synthesised with WebAudio, so there
// are no files. They are muted together with the voice: pass `() => voice.muted`.
//
// Nothing here is science, and nothing plays until the page asks, so the AudioContext (which
// browsers only allow after a gesture) is created on the first sound and resumed if suspended.

export interface Sfx {
  leadSnap(): void;
  plug(): void;
  key(): void;
  page(): void;
  dispose(): void;
}

type AudioContextCtor = new () => AudioContext;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Loudest a sound gets: these are small cues under the voice. */
const MASTER_GAIN = 0.22;

export function createSfx(isMuted: () => boolean = () => false): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let disposed = false;

  function ready(): AudioContext | null {
    if (disposed || isMuted()) return null;
    if (!ctx) {
      const Ctor = contextCtor();
      if (!Ctor) return null;
      try {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
        // One second of white noise from a fixed sequence (no Math.random, so every run sounds the same).
        const length = ctx.sampleRate;
        noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = noise.getChannelData(0);
        let x = 0x9e3779b9;
        for (let i = 0; i < length; i++) {
          x ^= x << 13;
          x ^= x >>> 17;
          x ^= x << 5;
          data[i] = ((x >>> 0) / 4294967296) * 2 - 1;
        }
      } catch {
        ctx = null;
        return null;
      }
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }

  /** A short burst of noise through a band-pass filter. */
  function burst(
    c: AudioContext,
    at: number,
    durS: number,
    fromHz: number,
    toHz: number,
    gain: number,
  ): void {
    if (!master || !noise) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(fromHz, at);
    filter.frequency.exponentialRampToValueAtTime(toHz, at + durS);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.01, durS / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + durS);
    src.connect(filter).connect(env).connect(master);
    src.start(at);
    src.stop(at + durS + 0.02);
  }

  /** A short tone that falls in pitch. */
  function tone(
    c: AudioContext,
    at: number,
    durS: number,
    fromHz: number,
    toHz: number,
    gain: number,
    type: OscillatorType = "sine",
  ): void {
    if (!master) return;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, at);
    osc.frequency.exponentialRampToValueAtTime(toHz, at + durS);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + durS);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(at + durS + 0.02);
  }

  return {
    leadSnap() {
      const c = ready();
      if (!c) return;
      const t = c.currentTime;
      tone(c, t, 0.07, 2200, 1500, 0.5, "triangle");
      burst(c, t, 0.05, 4000, 2500, 0.6);
    },
    plug() {
      const c = ready();
      if (!c) return;
      const t = c.currentTime;
      tone(c, t, 0.12, 220, 95, 0.9);
      burst(c, t, 0.04, 1800, 900, 0.5);
    },
    key() {
      const c = ready();
      if (!c) return;
      const t = c.currentTime;
      burst(c, t, 0.025, 3200, 2400, 0.8);
      tone(c, t, 0.03, 1200, 700, 0.35, "square");
      burst(c, t + 0.09, 0.03, 2400, 1800, 0.6);
    },
    page() {
      const c = ready();
      if (!c) return;
      burst(c, c.currentTime, 0.22, 1200, 3600, 0.5);
    },
    dispose() {
      disposed = true;
      const c = ctx;
      ctx = null;
      master = null;
      noise = null;
      if (c && c.state !== "closed") void c.close().catch(() => {});
    },
  };
}
