import { useCallback, useEffect, useRef, useState } from "react";
import { Chunker, floatToPcm16 } from "./pcm16";
import pcmWorkletUrl from "./pcmWorklet.js?url&no-inline";
import { Resampler16k } from "./resample";

export type PushToTalkState = "idle" | "starting" | "recording" | "denied" | "unsupported";

export interface PushToTalkOptions {
  onChunk: (pcm: Int16Array) => void;
  onLevel?: (rms0to1: number) => void;
}

export interface PushToTalk {
  state: PushToTalkState;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Push-to-talk capture: mic -> AudioWorklet -> Resampler16k (16 kHz) ->
 * floatToPcm16 -> Chunker (100 ms) -> onChunk. No network in this slice.
 * start() must be called from a user gesture (iOS Safari AudioContext).
 */
export function usePushToTalk(options: PushToTalkOptions): PushToTalk {
  const [state, setState] = useState<PushToTalkState>("idle");
  const optionsRef = useRef(options);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const resamplerRef = useRef<Resampler16k | null>(null);
  const chunkerRef = useRef<Chunker | null>(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const lastLevelRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const teardown = useCallback((flush: boolean) => {
    if (flush && resamplerRef.current && chunkerRef.current) {
      try {
        const tail = resamplerRef.current.flush();
        if (tail.length > 0) {
          for (const chunk of chunkerRef.current.push(floatToPcm16(tail))) {
            optionsRef.current.onChunk(chunk);
          }
        }
        const rest = chunkerRef.current.flush();
        if (rest) optionsRef.current.onChunk(rest);
      } catch {
        // Best effort: still tear the graph down below.
      }
    }
    resamplerRef.current = null;
    chunkerRef.current = null;
    if (nodeRef.current) {
      try {
        nodeRef.current.port.onmessage = null;
        nodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      nodeRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      void ctx.close().catch(() => undefined);
    }
    busyRef.current = false;
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    teardown(true);
    setState("idle");
  }, [teardown]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      teardown(true);
    };
  }, [teardown]);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setState("unsupported");
      return;
    }
    const Ctor =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    busyRef.current = true;
    const generation = ++generationRef.current;
    setState("starting");
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    try {
      ctx = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;
      await ctx.resume();
      if (!ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== "function") {
        teardown(false);
        setState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        teardown(false);
        setState("denied");
        return;
      }
      if (generation !== generationRef.current) {
        for (const track of stream.getTracks()) track.stop();
        teardown(false);
        return;
      }
      streamRef.current = stream;
      await ctx.audioWorklet.addModule(pcmWorkletUrl);
      if (generation !== generationRef.current) {
        teardown(false);
        return;
      }
      const resampler = new Resampler16k(ctx.sampleRate);
      const chunker = new Chunker(1600);
      resamplerRef.current = resampler;
      chunkerRef.current = chunker;
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "snaplab-pcm");
      node.port.onmessage = (event: MessageEvent) => {
        const block = event.data as Float32Array;
        if (!block || block.length === 0) return;
        const resampled = resampler.push(block);
        if (resampled.length === 0) return;
        const onLevel = optionsRef.current.onLevel;
        if (onLevel) {
          const now = performance.now();
          if (now - lastLevelRef.current >= 50) {
            lastLevelRef.current = now;
            let sum = 0;
            for (let i = 0; i < resampled.length; i++) {
              const v = resampled[i] ?? 0;
              sum += v * v;
            }
            onLevel(Math.min(1, Math.sqrt(sum / resampled.length)));
          }
        }
        for (const chunk of chunker.push(floatToPcm16(resampled))) {
          optionsRef.current.onChunk(chunk);
        }
      };
      source.connect(node);
      // Safari only runs a worklet that reaches the destination; a muted gain keeps it silent.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(ctx.destination);
      sourceRef.current = source;
      nodeRef.current = node;
      setState("recording");
    } catch {
      teardown(false);
      if (generation === generationRef.current) setState("unsupported");
    }
  }, [teardown]);

  return { state, start, stop };
}
