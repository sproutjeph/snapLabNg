import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { emptyOhmsLawRecord } from "../readings/record";
import { createDirector } from "../script/createDirector";
import { SAMPLE_SCRIPT } from "../script/sampleScript";
import type { Director } from "../script/types";
import type { BenchState } from "../types";
import type { VoiceGuide } from "../voice/types";
import { createOhmsLawBench } from "../wiring/bench";
import { stageIndexOf, stagesOf } from "./stages";
import { stageNavOf, useStageNav } from "./useStageNav";

// The strip's props from the director. The lesson's steps and the script's stages are the same
// eleven question stages (one per Step.key), so these run on the real lesson and the director's
// own sample script.

const quiet: VoiceGuide = {
  say: (_t, o) => o?.onEnd?.(),
  stop: () => {},
  speaking: false,
  muted: false,
  rate: 0.95,
};

const steps = OHMS_LAW_LESSON.steps;
const stages = stagesOf(SAMPLE_SCRIPT);

function directorAt(mode: "watch" | "practice" | "exam", beat = 0) {
  const bench = createOhmsLawBench(5);
  const record = emptyOhmsLawRecord("practice");
  const benchState = (): BenchState => ({
    comparison: bench.comparison,
    keyClosed: false,
    boxSettingOhm: 0,
    record,
    identified: new Set(),
  });
  const base = { script: SAMPLE_SCRIPT, voice: quiet, bench, benchState };
  const director = createDirector(mode === "watch" ? { ...base, mode } : { ...base, mode });
  director.seek(beat);
  return director;
}

describe("the lesson's steps and the script's stages", () => {
  it("are the same stages in the same order", () => {
    expect(steps.map((s) => s.key)).toEqual(stages.map((s) => s.key));
  });
});

describe("stageNavOf", () => {
  it("gives the step of the beat's stage", () => {
    for (const beat of [0, 1, 3, 4, 10, 11, SAMPLE_SCRIPT.beats.length - 1]) {
      const nav = stageNavOf(directorAt("watch", beat), steps);
      expect(nav.stepIndex).toBe(stageIndexOf(stages, beat));
    }
    expect(stageNavOf(directorAt("watch", 4), steps).stepIndex).toBe(2);
  });

  it("Watch marks the stages before the current one done, and the rest not", () => {
    const nav = stageNavOf(directorAt("watch", 4), steps);
    expect(nav.stepStatus.slice(0, 3)).toEqual(["done", "done", "todo"]);
    expect(nav.stepStatus.slice(3).every((s) => s === "todo")).toBe(true);
    expect(nav.stepStatus).toHaveLength(steps.length);
  });

  it("marks every stage done once the demonstration has finished", () => {
    const d = directorAt("watch", SAMPLE_SCRIPT.beats.length - 1);
    d.next();
    expect(d.state.finished).toBe(true);
    expect(stageNavOf(d, steps).stepStatus.every((s) => s === "done")).toBe(true);
  });

  it("leaves every stage not done in Exam", () => {
    const nav = stageNavOf(directorAt("exam", 0), steps);
    expect(nav.stepStatus.every((s) => s === "todo")).toBe(true);
    expect(nav.stepStatus).toHaveLength(steps.length);
  });

  it("Practise locks the cards after the current one; Watch and Exam lock none", () => {
    expect(stageNavOf(directorAt("practice", 4), steps).lockedFrom).toBe(3);
    expect(stageNavOf(directorAt("practice", 0), steps).lockedFrom).toBe(1);
    expect(stageNavOf(directorAt("watch", 4), steps).lockedFrom).toBeUndefined();
    expect(stageNavOf(directorAt("exam", 0), steps).lockedFrom).toBeUndefined();
  });

  it("the cards are selectable in Watch only", () => {
    expect(stageNavOf(directorAt("watch"), steps).readOnlyTabs).toBe(false);
    expect(stageNavOf(directorAt("practice"), steps).readOnlyTabs).toBe(true);
    expect(stageNavOf(directorAt("exam"), steps).readOnlyTabs).toBe(true);
  });

  it("choosing a stage seeks its first beat in Watch", () => {
    const d = directorAt("watch", 0);
    const nav = stageNavOf(d, steps);
    nav.onStepChange(5);
    expect(d.state.beat).toBe(stages[5]?.first);
    nav.onStepChange(0);
    expect(d.state.beat).toBe(0);
  });

  it("choosing a stage does nothing in Practise or Exam", () => {
    for (const mode of ["practice", "exam"] as const) {
      const d = directorAt(mode, 4);
      const before = d.state.beat;
      stageNavOf(d, steps).onStepChange(8);
      expect(d.state.beat).toBe(before);
    }
  });

  it("a director without a script reads as the first step with nothing done", () => {
    const bare: Director = {
      state: {
        mode: "watch",
        beat: 0,
        playing: false,
        speed: 1,
        caption: "",
        waiting: false,
        hint: 0,
        finished: false,
        act: null,
        actT: 0,
        loupe: null,
      },
      demoRecord: emptyOhmsLawRecord("practice"),
      play() {},
      pause() {},
      next() {},
      prev() {},
      seek() {},
      setSpeed() {},
      showMe() {},
      advance() {},
      subscribe: () => () => {},
      dispose() {},
    };
    const nav = stageNavOf(bare, steps);
    expect(nav.stepIndex).toBe(0);
    expect(nav.stepStatus.every((s) => s === "todo")).toBe(true);
    expect(() => nav.onStepChange(3)).not.toThrow();
  });
});

/** Prints what the hook returns, so a render can show it. */
function Probe({ director }: { director: Director }) {
  const nav = useStageNav(director, steps);
  return createElement("span", null, `${nav.stepIndex}|${nav.lockedFrom}|${nav.readOnlyTabs}`);
}

describe("useStageNav", () => {
  it("returns the same strip props as stageNavOf", () => {
    const director = directorAt("practice", 4);
    expect(renderToStaticMarkup(createElement(Probe, { director }))).toBe("<span>2|3|true</span>");
  });
});
