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

/** True when a gesture landed on (or inside) the home mute button. */
export function isMuteTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === "function"
    ? Boolean(el.closest('[data-testid="home-mute"]'))
    : false;
}

export interface WelcomeSpeaker {
  /** Try to speak on load. */
  start(): void;
  /** Speak on the first tap/keypress if the load attempt has not been heard. */
  onGesture(): void;
  dispose(): void;
  readonly spoken: boolean;
}

export interface WelcomeSpeakerOptions {
  /** Defaults to `navigator.userActivation?.hasBeenActive`. */
  hasBeenActive?: () => boolean | undefined;
  /** Called once the welcome has been heard or has ended. */
  onSpoken?: () => void;
}

function defaultHasBeenActive(): boolean | undefined {
  try {
    return typeof navigator === "undefined" ? undefined : navigator.userActivation?.hasBeenActive;
  } catch {
    return undefined;
  }
}

/**
 * Speaks the welcome once per visit. With no user activation yet the load
 * attempt is not even made — browsers would drop it — and the first gesture
 * speaks instead. `createVoice` reports the first chunk synchronously via
 * `onWord(chunk.offset)` before any sound, so only a later word or the end
 * of the say() counts as heard.
 */
export function createWelcomeSpeaker(
  voice: VoiceGuide,
  opts: WelcomeSpeakerOptions = {},
): WelcomeSpeaker {
  let attempted = false;
  let heard = false;
  let ended = false;
  let disposed = false;
  let wordCalls = 0;
  let notified = false;

  const notify = () => {
    if (notified || (!heard && !ended)) return;
    notified = true;
    opts.onSpoken?.();
  };

  const speak = () => {
    attempted = true;
    wordCalls = 0;
    notified = false;
    voice.say(WELCOME_TEXT, {
      onWord: () => {
        wordCalls++;
        // The first call is createVoice's synchronous chunk announcement.
        if (wordCalls > 1) {
          heard = true;
          notify();
        }
      },
      onEnd: () => {
        ended = true;
        notify();
      },
    });
  };

  return {
    start() {
      if (disposed || attempted || voice.muted) return;
      if ((opts.hasBeenActive ?? defaultHasBeenActive)() === false) return;
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
