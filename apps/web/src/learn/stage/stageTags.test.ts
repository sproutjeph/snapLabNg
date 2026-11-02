import { describe, expect, it } from "vitest";
import { dockedCovered } from "../shell/dock";
import { tagArea } from "./StageTags";

// Where the guided part tags may stand (docs/plans/guided-demo.md): inside what the page's cards
// leave free. The paper is docked while the page loads and closes before the tags show, so the
// area must follow `covered` (StageTags measures again when it changes).

const base = { left: 0, right: 0, top: 68, bottom: 0 };

describe("tagArea", () => {
  it("keeps clear of the paper's column while it is docked, and takes it back when it closes", () => {
    const docked = tagArea(1440, 830, dockedCovered(base, "paper", 1440, 900));
    const closed = tagArea(1440, 830, dockedCovered(base, null, 1440, 900));
    expect(docked.right).toBeLessThan(1440 - 520);
    expect(closed.right).toBeGreaterThan(1440 - 20);
    expect(closed.right).toBeGreaterThan(docked.right + 500);
    // The rest of the area does not move.
    expect(closed.left).toBe(docked.left);
    expect(closed.top).toBe(docked.top);
  });

  it("on a phone gives the foot back too, and keeps below the player's pill", () => {
    const docked = tagArea(390, 617, dockedCovered({ ...base, top: 100 }, "paper", 390, 844, 617));
    const closed = tagArea(390, 617, dockedCovered({ ...base, top: 100 }, null, 390, 844, 617));
    expect(docked.bottom).toBeLessThan(closed.bottom - 200);
    expect(closed.top).toBeGreaterThan(100 + 10);
  });
});
