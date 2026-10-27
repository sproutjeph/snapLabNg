/**
 * Speech synthesis utility for reading examiner questions and replies aloud.
 * Prefers Nigerian English (en-NG), then British English (en-GB), then any English voice.
 * Safe no-op when SpeechSynthesis is unavailable (e.g. unsupported browser or SSR).
 */

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const normalized = voices.map((v) => ({
    voice: v,
    code: (v.lang || "").toLowerCase().replace(/_/g, "-"),
  }));

  // 1. Prefer en-NG
  const ng = normalized.find((item) => item.code === "en-ng" || item.code.startsWith("en-ng-"));
  if (ng) return ng.voice;

  // 2. Prefer en-GB
  const gb = normalized.find((item) => item.code === "en-gb" || item.code.startsWith("en-gb-"));
  if (gb) return gb.voice;

  // 3. Fall back to any English voice
  const anyEn = normalized.find((item) => item.code.startsWith("en"));
  if (anyEn) return anyEn.voice;

  return null;
}

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function cancelSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
}

export function speak(text: string, opts?: SpeakOptions): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !window.speechSynthesis) {
    return;
  }

  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);

  const selectedVoice =
    opts?.voice !== undefined ? opts.voice : pickVoice(window.speechSynthesis.getVoices());

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  if (opts?.onEnd) {
    utterance.onend = () => opts.onEnd?.();
  }
  if (opts?.onError) {
    utterance.onerror = (e) => opts.onError?.(e);
  }

  window.speechSynthesis.speak(utterance);
}
