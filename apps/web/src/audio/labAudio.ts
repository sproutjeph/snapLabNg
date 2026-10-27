import { makeNoise, scrapeParams, slamParams } from "./envelopes";

export interface LabAudio {
  unlock(): Promise<void>;
  nullClick(): void;
  needleSlam(intensity: number): void;
  scrape(durationS: number): void;
  plug(inserted: boolean): void;
  keyToggle(closed: boolean): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

const MASTER_GAIN = 10 ** (-12 / 20);
const MAX_SCRAPES = 4;

interface LiveScrape {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

export function createLabAudio(): LabAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let muted = false;
  const scrapes: LiveScrape[] = [];

  function masterLevel(): number {
    return muted ? 0 : MASTER_GAIN;
  }

  function sharedNoise(c: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) {
      return noiseBuffer;
    }
    const length = c.sampleRate;
    const buffer = c.createBuffer(1, length, c.sampleRate);
    buffer.getChannelData(0).set(makeNoise(length, 12345));
    noiseBuffer = buffer;
    return buffer;
  }

  function tone(freqHz: number, peakGain: number, durationS: number, type: OscillatorType): void {
    if (!ctx || !master) {
      return;
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freqHz;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
    osc.connect(gain);
    gain.connect(master);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + durationS + 0.02);
  }

  return {
    async unlock(): Promise<void> {
      if (!ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          return;
        }
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = masterLevel();
        master.connect(ctx.destination);
        sharedNoise(ctx);
      }
      if (master && ctx) {
        master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.01);
      }
      if (ctx.state !== "running") {
        await ctx.resume();
      }
    },

    nullClick(): void {
      tone(1400, 0.5, 0.06, "triangle");
    },

    needleSlam(intensity: number): void {
      if (!ctx || !master) {
        return;
      }
      const params = slamParams(intensity);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = params.freqHz;
      filter.type = "lowpass";
      filter.frequency.value = 800;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(params.gain, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + params.decayS);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + params.decayS + 0.02);
    },

    scrape(durationS: number): void {
      if (!ctx || !master) {
        return;
      }
      const params = scrapeParams(durationS);
      while (scrapes.length >= MAX_SCRAPES) {
        const oldest = scrapes.shift();
        if (!oldest) {
          break;
        }
        const t = ctx.currentTime;
        const g = oldest.gain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + 0.015);
        oldest.source.stop(t + 0.02);
      }
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = sharedNoise(ctx);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900;
      filter.Q.value = params.q;
      const gain = ctx.createGain();
      const dur = params.durationS;
      const releaseS = Math.min(0.05, dur / 3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
      gain.gain.setValueAtTime(0.6, now + Math.max(0.01, dur - releaseS));
      gain.gain.linearRampToValueAtTime(0, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      const voice: LiveScrape = { source, gain, filter };
      scrapes.push(voice);
      source.onended = () => {
        const idx = scrapes.indexOf(voice);
        if (idx >= 0) {
          scrapes.splice(idx, 1);
        }
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      source.start(now);
      source.stop(now + dur);
    },

    plug(inserted: boolean): void {
      tone(inserted ? 750 : 1250, 0.6, 0.08, "square");
    },

    keyToggle(closed: boolean): void {
      tone(closed ? 500 : 850, 0.55, 0.07, "square");
    },

    setMuted(next: boolean): void {
      muted = next;
      if (master && ctx) {
        master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.01);
      } else if (master) {
        master.gain.value = masterLevel();
      }
    },

    dispose(): void {
      for (const voice of scrapes) {
        try {
          voice.source.stop();
        } catch {
          // Voice already ended.
        }
        voice.source.disconnect();
        voice.filter.disconnect();
        voice.gain.disconnect();
      }
      scrapes.length = 0;
      const current = ctx;
      ctx = null;
      master = null;
      noiseBuffer = null;
      if (current) {
        void current.close();
      }
    },
  };
}
