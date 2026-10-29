import type { VoiceGuide, VoiceOptions } from "./types";

// STUB (Wave 0): the real speech queue arrives in W1-director. Contract: learn/voice/types.ts.
export function createVoice(opts: VoiceOptions = {}): VoiceGuide {
  return {
    say(_text, o) {
      o?.onEnd?.();
    },
    stop() {},
    speaking: false,
    muted: false,
    rate: opts.rate ?? 0.95,
  };
}
