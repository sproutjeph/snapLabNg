import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVoice } from "../learn/voice/createVoice";
import type { VoiceGuide } from "../learn/voice/types";
import HomePage from "./HomePage";
import {
  createWelcomeSpeaker,
  isMuteTarget,
  loadMuted,
  MUTED_KEY,
  saveMuted,
  WELCOME_TEXT,
} from "./welcome";

class FakeStorage {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => {
    this.map.set(k, v);
  };
}

function fakeVoice() {
  const calls: Array<{
    text: string;
    onWord?: (i: number) => void;
    onEnd?: () => void;
  }> = [];
  const voice: VoiceGuide & { stops: number } = {
    stops: 0,
    muted: false,
    rate: 0.95,
    get speaking() {
      return false;
    },
    say(text, opts) {
      calls.push({
        text,
        ...(opts?.onWord ? { onWord: opts.onWord } : {}),
        ...(opts?.onEnd ? { onEnd: opts.onEnd } : {}),
      });
    },
    stop() {
      this.stops++;
    },
  };
  return { voice, calls };
}

describe("mute persistence", () => {
  it("round-trips through snaplab.muted", () => {
    const storage = new FakeStorage();
    expect(loadMuted(storage)).toBe(false);
    saveMuted(true, storage);
    expect(storage.map.get(MUTED_KEY)).toBe("1");
    expect(loadMuted(storage)).toBe(true);
    saveMuted(false, storage);
    expect(loadMuted(storage)).toBe(false);
  });

  it("does not throw when storage throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadMuted(throwing)).toBe(false);
    expect(() => saveMuted(true, throwing)).not.toThrow();
  });
});

describe("welcome speaker", () => {
  it("speaks the welcome on load and not again on tap once heard", () => {
    const { voice, calls } = fakeVoice();
    const welcome = createWelcomeSpeaker(voice);
    welcome.start();
    expect(calls.map((c) => c.text)).toEqual([WELCOME_TEXT]);
    // First onWord is the synchronous chunk announcement; a later one is hearing it.
    calls[0]?.onWord?.(0);
    calls[0]?.onWord?.(7);
    welcome.onGesture();
    welcome.start();
    expect(calls).toHaveLength(1);
    expect(voice.stops).toBe(0);
  });

  it("first-tap fallback: restarts inside the gesture when load was not heard", () => {
    const { voice, calls } = fakeVoice();
    const welcome = createWelcomeSpeaker(voice);
    welcome.start();
    expect(calls).toHaveLength(1);
    // Blocked: no word and no end from the load attempt.
    welcome.onGesture();
    expect(voice.stops).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.text).toBe(WELCOME_TEXT);
    calls[1]?.onWord?.(0);
    calls[1]?.onWord?.(7);
    welcome.onGesture();
    expect(calls).toHaveLength(2);
  });

  it("does not speak again after the welcome has ended", () => {
    const { voice, calls } = fakeVoice();
    const welcome = createWelcomeSpeaker(voice);
    welcome.start();
    calls[0]?.onEnd?.();
    welcome.onGesture();
    expect(calls).toHaveLength(1);
  });

  it("stays silent while muted", () => {
    const { voice, calls } = fakeVoice();
    voice.muted = true;
    const welcome = createWelcomeSpeaker(voice);
    welcome.start();
    welcome.onGesture();
    expect(calls).toHaveLength(0);
  });
});

describe("welcome with the real createVoice (autoplay blocked)", () => {
  class FakeUtterance {
    text: string;
    rate = 1;
    lang = "";
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onboundary: ((e: { name?: string; charIndex: number }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for the first gesture, then speaks even though utterances error not-allowed", () => {
    const spoken: FakeUtterance[] = [];
    const synth = {
      speak(u: FakeUtterance) {
        spoken.push(u);
        // Chrome's not-allowed path: the utterance reports an error at once.
        u.onerror?.({ error: "not-allowed" });
      },
      cancel: vi.fn(),
      getVoices: () => [],
    };
    vi.stubGlobal("window", { speechSynthesis: synth });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    let active = false;
    const voice = createVoice();
    const welcome = createWelcomeSpeaker(voice, { hasBeenActive: () => active });

    welcome.start();
    // No user activation yet: nothing is spoken on load.
    expect(spoken).toHaveLength(0);

    // The first pointerdown: the gesture itself is the activation.
    active = true;
    welcome.onGesture();
    expect(spoken.map((u) => u.text)).toContain("Welcome to SnapLab.");
  });

  it("does not count the synchronous onWord from createVoice as heard", () => {
    const spoken: FakeUtterance[] = [];
    const synth = {
      speak(u: FakeUtterance) {
        spoken.push(u);
      },
      cancel: vi.fn(),
      getVoices: () => [],
    };
    vi.stubGlobal("window", { speechSynthesis: synth });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    const voice = createVoice();
    const welcome = createWelcomeSpeaker(voice, { hasBeenActive: () => true });
    welcome.start();
    // createVoice fired onWord(chunk.offset) synchronously; that alone is not hearing it.
    expect(spoken).toHaveLength(1);
    expect(welcome.spoken).toBe(false);
  });

  it("ignores a gesture that lands on the mute button", () => {
    const inside = { closest: (s: string) => (s === '[data-testid="home-mute"]' ? {} : null) };
    const outside = { closest: () => null };
    expect(isMuteTarget(inside as unknown as EventTarget)).toBe(true);
    expect(isMuteTarget(outside as unknown as EventTarget)).toBe(false);
    expect(isMuteTarget(null)).toBe(false);
  });
});

describe("home page markup", () => {
  it("Watch links to guided, Practise and Exam stay, mute and stills are present", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('href="/?practical=ohms-law&amp;mode=guided"');
    expect(html).toContain('href="/?practical=ohms-law&amp;mode=practice"');
    expect(html).toContain('href="/?practical=ohms-law&amp;mode=exam"');
    expect(html).toContain('data-testid="home-mute"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('src="/home/meter-bridge.webp"');
    expect(html).toContain('src="/home/titration.webp"');
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Snap my practical");
    expect(html).not.toContain("Try a demo page");
  });
});
