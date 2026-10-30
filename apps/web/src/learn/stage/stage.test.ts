import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { INK_IDS } from "../../apparatus/ohms-law/layout";
import type { OhmsLawVisualState } from "../types";
import {
  benchBusy,
  createPoseMemo,
  createStageLoop,
  poseChanged,
  stageFocusIds,
} from "./frameloop";

// The live stage (docs/plans/wave-2-lean.md, 2a-stage). No textbook source: these test layout,
// code boundaries and the frameloop's bookkeeping, not science.

const SRC = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function visual(over: Partial<OhmsLawVisualState> = {}): OhmsLawVisualState {
  return {
    readout: { ammeterDeg: 0, voltmeterDeg: 0 } as OhmsLawVisualState["readout"],
    keyClosed: false,
    plugsIn: [true, true, true, true],
    leads: [],
    pendingFrom: null,
    pointer: new THREE.Vector3(),
    ring: null,
    highlight: null,
    hintMissing: [],
    hintExtra: [],
    ...over,
  };
}

describe("the stage's chrome", () => {
  // The free area (width minus left and right, height minus top and bottom) over the screen.
  // Today's shell covers 59% of a phone (guide peek) and 47% of a laptop (the guide card); 2a-shell
  // (Gemini) changes those values so only the always-on chrome counts. Turn this into a real test
  // when 2a-shell merges:
  //   const c = playerCovered(390, 844, { guide: "peek" });
  //   expect(((390 - c.left - c.right) * (844 - c.top - c.bottom)) / (390 * 844)).toBeGreaterThanOrEqual(0.7);
  //   and the same at 1728 × 907 with 0.85.
  it.todo(
    "playerCovered leaves at least 70% of a 390×844 phone and 85% of a 1728×907 laptop (waits on 2a-shell)",
  );
});

describe("DeskProps is gone", () => {
  it("has no source file and no import of it resolves anywhere in the app", () => {
    expect(existsSync(join(SRC, "scene", "look", "DeskProps.tsx"))).toBe(false);
    const importers = files(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("stage.test.ts"))
      .filter((f) => /from\s+["'][^"']*\/DeskProps["']/.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([]);
  });
});

describe("the stage's focus", () => {
  it("keeps every terminal nut (100+) and every lead (140+) in focus with any part", () => {
    const ids = stageFocusIds(["ammeter"]);
    expect(ids).not.toBeNull();
    for (let i = 0; i < 12; i++) expect(ids?.has(INK_IDS.nutBase + i)).toBe(true);
    for (let i = 0; i < 20; i++) expect(ids?.has(INK_IDS.leadBase + i)).toBe(true);
    expect(ids?.has(INK_IDS.ammeter)).toBe(true);
    expect(ids?.has(INK_IDS.box)).toBe(false);
  });

  it("puts everything in focus when no part is named", () => {
    expect(stageFocusIds(null)).toBeNull();
    expect(stageFocusIds([])).toBeNull();
  });
});

describe("the demand frameloop", () => {
  it("stays awake for the longest wake, then rests", () => {
    const loop = createStageLoop();
    let asked = 0;
    loop.invalidate = () => {
      asked++;
    };
    loop.wake(0.15);
    loop.wake(0.05);
    expect(asked).toBe(2);
    expect(loop.tick(0.1)).toBe(true);
    expect(loop.tick(0.1)).toBe(false);
  });

  it("counts a slow frame as at most a tenth of a second, so a wake always buys frames", () => {
    const loop = createStageLoop();
    loop.wake(0.15);
    expect(loop.tick(10)).toBe(true);
    expect(loop.tick(10)).toBe(false);
  });

  it("keeps rendering while the key is closed, a ring pulses or a lead is pending", () => {
    expect(benchBusy(visual())).toBe(false);
    expect(benchBusy(visual({ keyClosed: true }))).toBe(true);
    expect(benchBusy(visual({ ring: "cell+" as OhmsLawVisualState["ring"] }))).toBe(true);
    expect(benchBusy(visual({ pendingFrom: "cell+" as OhmsLawVisualState["pendingFrom"] }))).toBe(
      true,
    );
  });

  it("sees a needle, the key, a plug or a new lead move, and nothing when all is still", () => {
    const memo = createPoseMemo();
    const v = visual();
    expect(poseChanged(memo, v)).toBe(true);
    expect(poseChanged(memo, v)).toBe(false);
    v.readout.ammeterDeg = 3;
    expect(poseChanged(memo, v)).toBe(true);
    v.plugsIn = [true, false, true, true];
    expect(poseChanged(memo, v)).toBe(true);
    v.keyClosed = true;
    expect(poseChanged(memo, v)).toBe(true);
    expect(poseChanged(memo, v)).toBe(false);
  });
});
