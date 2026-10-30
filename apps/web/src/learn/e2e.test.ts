import { afterEach, describe, expect, it } from "vitest";
import { e2eHost, installE2E, type SnaplabE2E, speedFrom } from "./e2e";

// The E2E hook (docs/plans/integration.md, "Contracts"). No textbook source: a page contract.

const fake = (): SnaplabE2E => ({
  screen: () => "paper",
  progress: () => ({ beat: 0, beats: 1, done: false }),
  targets: () => [],
  tap: () => {},
  type: () => {},
  meters: () => ({ i: 0, v: 0 }),
  wireOhm: () => 1,
  handIn: () => {},
  result: () => null,
  play: () => {},
  setR: () => {},
  key: () => {},
});

afterEach(() => {
  delete e2eHost.__snaplab;
});

describe("the E2E hook", () => {
  it("the e2e hook is absent without e2e=1", () => {
    installE2E(new URLSearchParams("practical=ohms-law"), fake);
    expect(e2eHost.__snaplab).toBeUndefined();
    installE2E(new URLSearchParams("practical=ohms-law&e2e=0"), fake);
    expect(e2eHost.__snaplab).toBeUndefined();
    // Without it, the fast speeds are not accepted either.
    expect(speedFrom(new URLSearchParams("speed=8"))).toBeNull();
    expect(speedFrom(new URLSearchParams("speed=2"))).toBe(2);
  });

  it("with e2e=1 forwards to the screen on show, and uninstalls", () => {
    let current = fake();
    const off = installE2E(new URLSearchParams("practical=ohms-law&e2e=1"), () => current);
    const hook = e2eHost.__snaplab;
    expect(hook?.screen()).toBe("paper");
    current = { ...fake(), screen: () => "exam" };
    expect(e2eHost.__snaplab).toBe(hook);
    expect(hook?.screen()).toBe("exam");
    expect(speedFrom(new URLSearchParams("e2e=1&speed=8"))).toBe(8);
    expect(speedFrom(new URLSearchParams("e2e=1&speed=4"))).toBe(4);
    off();
    expect(e2eHost.__snaplab).toBeUndefined();
  });
});
