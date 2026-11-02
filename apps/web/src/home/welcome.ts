import type { VoiceGuide } from "../learn/voice/types";

export const WELCOME_TEXT = "Welcome to SnapLab. Your practicals come to life.";
export const MUTED_KEY = "snaplab.muted";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadMuted(storage: StorageLike | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // A browser that blocks storage still gets a working mute for this visit.
  }
}

export interface WelcomeSpeaker {
  /** Try to speak on load. */
  start(): void;
  /** Speak on the first tap/keypress if the load attempt has not been heard. */
  onGesture(): void;
  dispose(): void;
  readonly spoken: boolean;
}

/**
 * Speaks the welcome once per visit. If the load attempt never produces a
 * word (autoplay blocked or speech failed), the first gesture stops that
 * attempt and speaks inside the gesture, where browsers allow sound.
 */
export function createWelcomeSpeaker(voice: VoiceGuide): WelcomeSpeaker {
  let attempted = false;
  let heard = false;
  let ended = false;
  let disposed = false;

  const speak = () => {
    attempted = true;
    voice.say(WELCOME_TEXT, {
      onWord: () => {
        heard = true;
      },
      onEnd: () => {
        ended = true;
      },
    });
  };

  return {
    start() {
      if (disposed || attempted || voice.muted) return;
      speak();
    },
    onGesture() {
      if (disposed || ended || voice.muted) return;
      if (!attempted) {
        speak();
        return;
      }
      if (heard) return;
      // The load attempt was blocked or dropped: restart inside the gesture.
      voice.stop();
      heard = false;
      ended = false;
      speak();
    },
    dispose() {
      disposed = true;
    },
    get spoken() {
      return heard || ended;
    },
  };
}
