// Guided Watch's paper reads itself at once, but a browser refuses speech before a tap: it ends
// each sentence in a moment without a sound. These two checks tell a refused reading from a real
// one, so the paper asks for a tap instead of going on to Watch with the question unread.

/** How long the voice gets to start before the paper asks for a tap. */
export const SPEECH_START_WAIT_MS = 2500;
/** A whole reading that is audible and ends sooner than this was refused, not read. */
export const MIN_READING_MS = 3000;

export interface ReadingFacts {
  /** The voice is muted: the reading runs on its estimated clock, silently. */
  muted: boolean;
  /** The browser has speech synthesis at all. */
  speechAvailable: boolean;
  /** She has already tapped to start: the browser has let speech through. */
  tapped: boolean;
}

/** The reading ended after `elapsedMs`: was it refused (ask for a tap), or read (go on)? */
export function readingRefused(elapsedMs: number, f: ReadingFacts): boolean {
  return !f.tapped && !f.muted && f.speechAvailable && elapsedMs < MIN_READING_MS;
}

/**
 * `waitedMs` after the reading began and the voice has never been heard speaking: ask for a tap.
 * (A muted voice, a browser without speech and a reader who has tapped never need one.)
 */
export function voiceNeverStarted(waitedMs: number, heard: boolean, f: ReadingFacts): boolean {
  return !f.tapped && !f.muted && f.speechAvailable && !heard && waitedMs >= SPEECH_START_WAIT_MS;
}

/**
 * Whether the bench stays empty while the guided reading waits to be heard: a reading the browser
 * may yet refuse must not drop the parts (they drop on their names once she taps to start).
 */
export function benchHeld(heard: boolean, f: ReadingFacts): boolean {
  return !f.tapped && !f.muted && f.speechAvailable && !heard;
}

export interface GuidedWatch {
  /** One poll, `waitedMs` after the reading began. */
  tick(waitedMs: number): void;
  /** The reading ended; `refused` when it was refused (the tap prompt then shows). */
  readingEnded(refused: boolean): void;
  /** Nothing is left to watch for: polling can stop. */
  readonly finished: boolean;
}

/**
 * Watches a guided reading until the voice is heard: holds the bench empty while it may yet be
 * refused, offers the tap once it has not started in time, and lets the bench fill when the voice
 * is heard (however late), when she mutes it, when she taps, or when the reading ends unrefused.
 */
export function createGuidedWatch(o: {
  facts(): ReadingFacts;
  speaking(): boolean;
  hold(held: boolean): void;
  offerTap(show: boolean): void;
}): GuidedWatch {
  let held = benchHeld(false, o.facts());
  let offered = false;
  let finished = !held;
  if (held) o.hold(true);
  const release = () => {
    finished = true;
    if (!held) return;
    held = false;
    o.hold(false);
  };
  return {
    tick(waitedMs) {
      if (finished) return;
      const f = o.facts();
      // Muted, no speech, or her tap (which restarts the reading): the bench need not wait.
      if (f.muted || !f.speechAvailable || f.tapped) {
        release();
        return;
      }
      if (o.speaking()) {
        if (offered) {
          offered = false;
          o.offerTap(false);
        }
        release();
        return;
      }
      if (!offered && voiceNeverStarted(waitedMs, false, f)) {
        offered = true;
        o.offerTap(true);
      }
    },
    readingEnded(refused) {
      // Refused: the bench stays empty under the tap prompt (a later mute or tap still frees it).
      if (!refused) release();
    },
    get finished() {
      return finished;
    },
  };
}
