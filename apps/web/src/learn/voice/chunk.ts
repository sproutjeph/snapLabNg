// Text helpers for the speech queue (docs/plans/exam-redesign.md, Risks #2: Chrome's
// speechSynthesis stops a long utterance after about 15 s, so text is chunked by sentence).

export interface Chunk {
  text: string;
  /** Where this chunk starts in the text given to say(), so word callbacks report the full text. */
  offset: number;
}

/** A chunk longer than this is cut at a comma or a space. No standard figure: well under 15 s of speech. */
export const MAX_CHUNK_CHARS = 180;

/**
 * Splits text into sentences (after . ! ? or a line break), keeping each chunk's offset in the
 * original text. A sentence longer than MAX_CHUNK_CHARS is cut at its last comma, semicolon or
 * space before that length. A full stop inside a number ("0.2 mm", "8.8 × 10⁻⁷") is not a
 * sentence end, because it is not followed by a space.
 */
export function chunkSentences(text: string, maxChars: number = MAX_CHUNK_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  const push = (start: number, end: number) => {
    let a = start;
    let b = end;
    while (a < b && /\s/.test(text[a] ?? "")) a++;
    while (b > a && /\s/.test(text[b - 1] ?? "")) b--;
    if (b > a) chunks.push({ text: text.slice(a, b), offset: a });
  };
  // A sentence ends at . ! ? followed by a space or the end, or at a line break.
  const sentenceEnd = /[.!?]+(?=\s|$)|\n+/g;
  let from = 0;
  for (let m = sentenceEnd.exec(text); m !== null; m = sentenceEnd.exec(text)) {
    cutLong(text, from, m.index + m[0].length, maxChars, push);
    from = m.index + m[0].length;
  }
  cutLong(text, from, text.length, maxChars, push);
  return chunks;
}

function cutLong(
  text: string,
  start: number,
  end: number,
  maxChars: number,
  push: (a: number, b: number) => void,
): void {
  let a = start;
  while (end - a > maxChars) {
    const window = text.slice(a, a + maxChars);
    let cut = Math.max(window.lastIndexOf(","), window.lastIndexOf(";")) + 1;
    if (cut <= maxChars / 3) cut = window.lastIndexOf(" ") + 1;
    if (cut <= 0) cut = maxChars;
    push(a, a + cut);
    a += cut;
  }
  push(a, end);
}

/**
 * Words per second of speechSynthesis at rate 1. No standard figure: browser voices speak
 * English at about 150 to 180 words a minute, and 2.6 words a second (156 a minute) is the
 * slower end, so an estimate is rarely shorter than the speech it stands in for.
 */
export const WORDS_PER_S = 2.6;
/** A short pause after each sentence. */
export const SENTENCE_PAUSE_S = 0.25;

/** How long text takes to say at `rate`: the fallback timer's clock, never the audio's. */
export function estimateSpeechS(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const sentences = Math.max(1, chunkSentences(text).length);
  return words / (WORDS_PER_S * Math.max(rate, 0.1)) + sentences * SENTENCE_PAUSE_S;
}
