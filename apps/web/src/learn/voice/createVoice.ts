import { pickVoice } from "../../examiner/speak";
import { chunkSentences, estimateSpeechS } from "./chunk";
import type { VoiceGuide, VoiceOptions } from "./types";

// The voice that reads the question and guides her (docs/plans/exam-redesign.md). Browser
// speechSynthesis only; Meta has no TTS (AGENTS.md). One queue, one chunk at a time.
//
// Why the examiner's speak() is not used to speak: it cancels whatever is playing before every
// call and cannot set a rate or hear word boundaries, so a queue cannot sit on it. Its
// pickVoice (en-NG, then en-GB, then any English voice) is reused for the choice of voice.
//
// Risks #2 (speechSynthesis is unreliable), handled here:
//  - Text is chunked by sentence, so Chrome's cut-off after about 15 s never bites.
//  - `onend` is never trusted alone: every chunk has a timer set from the estimated duration
//    (a stuck or dropped utterance is cancelled and the queue moves on).
//  - Muted (or no speechSynthesis at all) speaks nothing but still ends each say() after the
//    estimated time, so beats and captions keep their pace.
//  - say() starts the first utterance synchronously, so a call made inside a tap handler
//    (iOS needs a gesture) is allowed to speak.

/** Speech rate bounds: browsers accept 0.1 to 10, but anything outside this is unintelligible. */
const MIN_RATE = 0.5;
const MAX_RATE = 2;
/** A real utterance may run this much longer than estimated (plus a few seconds) before it counts as stuck. */
const STUCK_FACTOR = 1.6;
const STUCK_EXTRA_S = 2;

interface Item {
  chunks: ReturnType<typeof chunkSentences>;
  next: number;
  onWord?: ((charIndex: number) => void) | undefined;
  onEnd?: (() => void) | undefined;
}

function synthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  const s = (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return s && typeof SpeechSynthesisUtterance !== "undefined" ? s : null;
}

function chooseVoice(
  voices: SpeechSynthesisVoice[],
  lang: string | undefined,
): SpeechSynthesisVoice | null {
  if (lang) {
    const want = lang.toLowerCase().replace(/_/g, "-");
    const exact = voices.find((v) => (v.lang || "").toLowerCase().replace(/_/g, "-") === want);
    if (exact) return exact;
  }
  return pickVoice(voices);
}

export function createVoice(opts: VoiceOptions = {}): VoiceGuide {
  const queue: Item[] = [];
  /** Bumped whenever the running chunk is abandoned, so a late event from it is ignored. */
  let token = 0;
  let running = false;
  let audible = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let muted = false;
  let rate = opts.rate ?? 0.95;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const cancelSynth = () => {
    try {
      synthesis()?.cancel();
    } catch {
      // A browser that throws on cancel has nothing playing that we could stop.
    }
  };

  function finishChunk(myToken: number): void {
    if (myToken !== token) return;
    token++;
    clearTimer();
    running = false;
    audible = false;
    pump();
  }

  function startChunk(item: Item): void {
    const chunk = item.chunks[item.next];
    if (!chunk) return;
    item.next++;
    const myToken = ++token;
    running = true;
    // The sentence-level highlight: a browser with no word boundaries still moves on by chunk.
    item.onWord?.(chunk.offset);
    const useRate = Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
    const estimateMs = estimateSpeechS(chunk.text, useRate) * 1000;
    const synth = muted ? null : synthesis();
    if (!synth) {
      audible = false;
      timer = setTimeout(() => finishChunk(myToken), estimateMs);
      return;
    }
    audible = true;
    // If speak() throws or the utterance never reports, this timer ends the chunk.
    timer = setTimeout(
      () => {
        if (myToken !== token) return;
        cancelSynth();
        finishChunk(myToken);
      },
      estimateMs * STUCK_FACTOR + STUCK_EXTRA_S * 1000,
    );
    try {
      const u = new SpeechSynthesisUtterance(chunk.text);
      const voice = chooseVoice(synth.getVoices(), opts.lang);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else if (opts.lang) {
        u.lang = opts.lang;
      }
      u.rate = useRate;
      u.onboundary = (e) => {
        if (myToken !== token) return;
        if (e.name === undefined || e.name === "word") item.onWord?.(chunk.offset + e.charIndex);
      };
      u.onend = () => finishChunk(myToken);
      u.onerror = () => finishChunk(myToken);
      synth.speak(u);
    } catch {
      finishChunk(myToken);
    }
  }

  function pump(): void {
    if (running) return;
    const item = queue[0];
    if (!item) return;
    if (item.next < item.chunks.length) {
      startChunk(item);
      return;
    }
    // Nothing is left in this say(): it has ended. Take it off first, so a callback that calls
    // say() or stop() sees a settled queue.
    queue.shift();
    item.onEnd?.();
    pump();
  }

  const voice: VoiceGuide = {
    // `onWord`'s charIndex is an index into `text` as given to this say() call: each chunk's
    // offset in `text` is added to the browser's chunk-relative boundary index (startChunk), and
    // nothing counts across earlier say() calls.
    say(text, o) {
      queue.push({ chunks: chunkSentences(text), next: 0, onWord: o?.onWord, onEnd: o?.onEnd });
      pump();
    },
    stop() {
      // Cancel the browser's speech only if it is ours: speechSynthesis is shared with the
      // examiner's speak() and anything else on the page, and a silent stop must not cut them off.
      const wasAudible = audible;
      queue.length = 0;
      token++;
      clearTimer();
      running = false;
      audible = false;
      if (wasAudible) cancelSynth();
    },
    get speaking() {
      return audible;
    },
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      if (value === muted) return;
      muted = value;
      if (muted && running && audible) {
        // Silence what is playing, and let a silent timer end the chunk on its estimated time.
        const item = queue[0];
        const chunk = item?.chunks[(item?.next ?? 1) - 1];
        token++;
        clearTimer();
        cancelSynth();
        audible = false;
        const myToken = token;
        timer = setTimeout(
          () => finishChunk(myToken),
          estimateSpeechS(chunk?.text ?? "", rate) * 1000,
        );
      }
    },
    get rate() {
      return rate;
    },
    set rate(value: number) {
      rate = value;
    },
  };
  return voice;
}
