import { compareWithDiagram, DIAGRAM_LEADS, demoSeedFor, type Lead } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../../readings/record";
import { createDirector } from "../../script/createDirector";
import type { VoiceGuide } from "../../voice/types";
import { createOhmsLawBench } from "../../wiring/bench";
import { OHMS_LAW_LESSON } from "./lesson";
import { OHMS_LAW_SCRIPT } from "./script";

// The Watch script (docs/plans/wave-2-lean.md, slice 2a-script tests). Structure is checked
// from the script alone; the 20/20 check plays it through the real director on a real
// demonstration bench, the way Watch does.

const S = OHMS_LAW_SCRIPT;
const leadBeats = S.beats.filter((b) => b.act?.kind === "lead");

/** Numerals the question itself prints: nothing else may be spoken. */
const QUESTION_NUMBERS = new Set(["0", "1", "5", "10", "20", "40", "60", "0.2", "7", "8.8", "22"]);

describe("ohms-law script", () => {
  it("the entrance beat enters every part once", () => {
    const first = S.beats[0];
    expect(first?.act?.kind).toBe("enter");
    if (first?.act?.kind !== "enter") return;
    expect([...first.act.parts].sort()).toEqual(
      ["ammeter", "box", "cells", "key", "voltmeter", "wire"].sort(),
    );
    expect(new Set(first.act.parts).size).toBe(first.act.parts.length);
    // And no later beat enters anything again.
    expect(S.beats.slice(1).filter((b) => b.act?.kind === "enter")).toHaveLength(0);
  });

  it("each lead beat draws exactly one lead, in WAEC order, and the leads make the circuit in lesson.ts", () => {
    expect(leadBeats).toHaveLength(DIAGRAM_LEADS.length);
    const drawn = leadBeats.map((b) => {
      if (b.act?.kind !== "lead") throw new Error("filtered above");
      return [b.act.from, b.act.to];
    });
    expect(drawn).toEqual(DIAGRAM_LEADS.map(([a, b]) => [a, b]));
    // The circuit they make is the lesson's circuit: the diagram comparison matches in full.
    const leads: Lead[] = drawn.map(([a, b], i) => {
      if (!a || !b) throw new Error("pair");
      return {
        id: `L${i + 1}`,
        a,
        b,
        jointA: { tightened: true, clean: true },
        jointB: { tightened: true, clean: true },
      };
    });
    const comparison = compareWithDiagram(leads);
    expect(comparison.matches).toBe(true);
    expect(comparison.missing).toHaveLength(0);
    // The beats belong to the lesson's connect stage, in the lesson's own wording.
    for (const b of leadBeats) expect(b.stage).toBe("connect");
    expect(OHMS_LAW_LESSON.steps.map((s) => s.key)).toContain("connect");
  });

  it("no beat's narration contains a practice-bench value", () => {
    for (const b of S.beats) {
      for (const text of [b.say, b.instruct]) {
        const numerals = text.match(/\d+(?:\.\d+)?/g) ?? [];
        for (const n of numerals) expect(QUESTION_NUMBERS.has(n), `${b.id}: ${n}`).toBe(true);
        // A meter reading as written (two decimal places) is a bench value, never narration.
        expect(text, b.id).not.toMatch(/\d\.\d\d/);
      }
    }
  });

  it("every beat has a shot that exists, WAEC narration and a lesson stage", () => {
    const shotIds = new Set(S.shots.map((s) => s.id));
    const stages = new Set(OHMS_LAW_LESSON.steps.map((s) => s.key));
    const ids = new Set<string>();
    for (const b of S.beats) {
      expect(b.say.trim().length, b.id).toBeGreaterThan(0);
      expect(b.instruct.trim().length, b.id).toBeGreaterThan(0);
      expect(shotIds.has(b.shot), b.id).toBe(true);
      expect(stages.has(b.stage), b.id).toBe(true);
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
    }
    expect(S.lessonId).toBe("ohms_law_vi");
  });

  it("Watch on the demo bench scores 20/20, and 21/21 with the bench's own effective resistance", () => {
    const bench = createOhmsLawBench(demoSeedFor(7));
    const voice: VoiceGuide = {
      say(_text, o) {
        o?.onEnd?.();
      },
      stop() {},
      speaking: false,
      muted: false,
      rate: 0.95,
    };
    const record = emptyOhmsLawRecord("practice");
    const director = createDirector({
      mode: "watch",
      script: S,
      voice,
      bench,
      benchState: () => ({
        comparison: bench.comparison,
        keyClosed: bench.visual.current.keyClosed,
        boxSettingOhm: bench.boxSettingOhm,
        record,
        identified: new Set(),
      }),
    });
    director.setSpeed(2);
    director.play();
    const DT = 1 / 60;
    let t = 0;
    while (!director.state.finished && t < 1200) {
      bench.advance(DT);
      director.advance(DT);
      t += DT;
    }
    expect(director.state.finished).toBe(true);
    expect(markOhmsLaw(director.demoRecord).earned).toBe(20);
    expect(
      markOhmsLaw(director.demoRecord, { teacherXyOhm: bench.supervisor.effectiveOhm() }).earned,
    ).toBe(21);
  });
});
