import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VoiceGuide } from "../voice/types";
import {
  MIN_READING_MS,
  readingRefused,
  SPEECH_START_WAIT_MS,
  voiceNeverStarted,
} from "./guidedReading";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import { QuestionPaper } from "./QuestionPaper";
import { createReadAloud } from "./readAloud";

// Guided Watch's paper (docs/plans/guided-demo.md): it reads at once, offers Skip instead of the
// three modes, goes on when the reading ends, and asks for a tap when the browser refuses speech.

const voice: VoiceGuide = {
  say() {},
  stop() {},
  speaking: false,
  muted: false,
  rate: 1,
};

const markup = (guided: boolean) =>
  renderToStaticMarkup(
    createElement(QuestionPaper, {
      question: OHMS_LAW_QUESTION,
      voice,
      onChoose: () => {},
      ...(guided ? { guided: { onDone: () => {}, onSkip: () => {} } } : {}),
    }),
  );

describe("the guided paper", () => {
  it("has Skip and no mode choices or Read button", () => {
    const html = markup(true);
    expect(html).toContain('data-testid="paper-skip"');
    expect(html).not.toContain("paper-choice-");
    expect(html).not.toContain('data-testid="paper-read"');
  });

  it("is unchanged when not guided: the three choices and Read it to me, no Skip", () => {
    const html = markup(false);
    for (const m of ["watch", "practice", "exam"]) expect(html).toContain(`paper-choice-${m}`);
    expect(html).toContain('data-testid="paper-read"');
    expect(html).not.toContain("paper-skip");
  });

  it("shows no Tap to start until speech has been refused", () => {
    expect(markup(true)).not.toContain("paper-tap");
  });
});

describe("the reading's end goes on to Watch", () => {
  function setup() {
    const onDone = vi.fn();
    const ends: Array<() => void> = [];
    const v: VoiceGuide = {
      ...voice,
      say(_t, o) {
        if (o?.onEnd) ends.push(o.onEnd);
      },
    };
    const reader = createReadAloud({
      question: OHMS_LAW_QUESTION,
      voice: v,
      onChange: () => {},
      onDone,
    });
    return { reader, ends, onDone };
  }

  it("calls onDone once, after the last instruction has been read", () => {
    const { reader, ends, onDone } = setup();
    reader.start();
    for (const end of ends.slice(0, -1)) end();
    expect(onDone).not.toHaveBeenCalled();
    ends.at(-1)?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not call onDone for a reading that was stopped (Skip)", () => {
    const { reader, ends, onDone } = setup();
    reader.start();
    reader.stop();
    for (const end of ends) end();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("a browser that refuses speech until a tap", () => {
  const audible = { muted: false, speechAvailable: true, tapped: false };

  it("treats an audible reading that ends within moments as refused, not read", () => {
    expect(readingRefused(40, audible)).toBe(true);
    expect(readingRefused(MIN_READING_MS - 1, audible)).toBe(true);
    expect(readingRefused(MIN_READING_MS, audible)).toBe(false);
  });

  it("never calls a muted, speechless or already-tapped reading refused", () => {
    expect(readingRefused(40, { ...audible, muted: true })).toBe(false);
    expect(readingRefused(40, { ...audible, speechAvailable: false })).toBe(false);
    expect(readingRefused(40, { ...audible, tapped: true })).toBe(false);
  });

  it("asks for a tap when the voice has not been heard within about 1.2 s", () => {
    expect(voiceNeverStarted(SPEECH_START_WAIT_MS - 100, false, audible)).toBe(false);
    expect(voiceNeverStarted(SPEECH_START_WAIT_MS, false, audible)).toBe(true);
    expect(voiceNeverStarted(SPEECH_START_WAIT_MS, true, audible)).toBe(false);
    expect(voiceNeverStarted(SPEECH_START_WAIT_MS, false, { ...audible, muted: true })).toBe(false);
  });
});
