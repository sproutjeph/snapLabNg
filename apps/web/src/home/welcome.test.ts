import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VoiceGuide } from "../learn/voice/types";
import HomePage from "./HomePage";
import { createWelcomeSpeaker, loadMuted, MUTED_KEY, saveMuted, WELCOME_TEXT } from "./welcome";

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
    calls[0]?.onWord?.(0);
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
