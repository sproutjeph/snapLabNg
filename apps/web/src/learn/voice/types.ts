// The voice that reads the question and guides her (docs/plans/exam-redesign.md). Browser
// speechSynthesis only: Meta has no TTS (AGENTS.md). FROZEN for Waves 1–2; ask the lead.

export interface VoiceGuide {
  /** Queues text after anything already queued. Long text is chunked by sentence. */
  say(text: string, opts?: { onWord?: (charIndex: number) => void; onEnd?: () => void }): void;
  /** Stops speaking and clears the queue. */
  stop(): void;
  readonly speaking: boolean;
  muted: boolean;
  /** Speech rate; default 0.95. */
  rate: number;
}

export interface VoiceOptions {
  rate?: number;
  /** BCP 47 tag; the voice prefers en-NG, then en-GB, then any English voice. */
  lang?: string;
}
