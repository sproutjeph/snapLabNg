import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPlainLeftClick, navigate, subscribeLocation } from "./navigate";

// Home's Watch goes to the guided paper without a page load, so Chrome keeps the click's
// activation and the question is read aloud at once (docs/plans/guided-demo.md).

describe("navigate", () => {
  let pushed: string[];
  beforeEach(() => {
    pushed = [];
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("history", {
      pushState: (_s: unknown, _t: string, url: string) => pushed.push(url),
    });
    vi.stubGlobal("PopStateEvent", class extends Event {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pushes the URL and tells App to route again, without a page load", () => {
    const seen = vi.fn();
    const off = subscribeLocation(seen);
    navigate("/?practical=ohms-law&mode=guided");
    expect(pushed).toEqual(["/?practical=ohms-law&mode=guided"]);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    navigate("/");
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("which clicks the Watch link keeps in the page", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("keeps a plain left click", () => {
    expect(isPlainLeftClick({ ...click, defaultPrevented: false })).toBe(true);
  });

  it("leaves a new-tab click (middle, Cmd, Ctrl, Shift, Alt) to the browser", () => {
    const d = { defaultPrevented: false };
    expect(isPlainLeftClick({ ...click, ...d, button: 1 })).toBe(false);
    expect(isPlainLeftClick({ ...click, ...d, metaKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, ...d, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, ...d, shiftKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, ...d, altKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, defaultPrevented: true })).toBe(false);
  });
});
