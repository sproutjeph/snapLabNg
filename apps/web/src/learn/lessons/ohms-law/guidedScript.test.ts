import { demoSeedFor } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../../readings/record";
import { slopeNumber } from "../../script/actor";
import { createDirector } from "../../script/createDirector";
import { BASE_RATE } from "../../script/timing";
import { estimateSpeechS } from "../../voice/chunk";
import type { VoiceGuide } from "../../voice/types";
import { createOhmsLawBench } from "../../wiring/bench";
import { guidedConclusionLines, OHMS_LAW_GUIDED_SCRIPT } from "./guidedScript";
import { OHMS_LAW_LESSON } from "./lesson";
import { OHMS_LAW_SCRIPT } from "./script";

// The guided script (docs/plans/guided-demo.md): its shape from the script alone, then played by
// the real director on a demonstration bench with a voice that takes as long as the estimate
// (what a muted voice takes), which is how its length is measured.

const G = OHMS_LAW_GUIDED_SCRIPT;
const words = (t: string) => t.trim().split(/\s+/).length;

/** A voice that ends each say() after the estimated speech time, on a clock the test advances. */
function timedVoice() {
  let now = 0;
  let endAt: number | null = null;
  let onEnd: (() => void) | undefined;
  const voice: VoiceGuide = {
    say(text, o) {
      const est = estimateSpeechS(text, BASE_RATE);
      if (est === 0) {
        o?.onEnd?.();
        return;
      }
      endAt = now + est;
      onEnd = o?.onEnd;
    },
    stop() {
      endAt = null;
      onEnd = undefined;
    },
    speaking: false,
    muted: false,
    rate: BASE_RATE,
  };
  return {
    voice,
    tick(dt: number) {
      now += dt;
      if (endAt !== null && now >= endAt) {
        const fn = onEnd;
        endAt = null;
        onEnd = undefined;
        fn?.();
      }
    },
  };
}

function rig(seed = 7, script = G) {
  const bench = createOhmsLawBench(demoSeedFor(seed));
  const v = timedVoice();
  const record = emptyOhmsLawRecord("practice");
  const director = createDirector({
    mode: "watch",
    script,
    voice: v.voice,
    bench,
    benchState: () => ({
      comparison: bench.comparison,
      keyClosed: bench.visual.current.keyClosed,
      boxSettingOhm: bench.boxSettingOhm,
      record,
      identified: new Set(),
    }),
  });
  return { bench, director, tick: v.tick };
}

function playThrough(r: ReturnType<typeof rig>): number {
  const DT = 1 / 60;
  let t = 0;
  r.director.play();
  while (!r.director.state.finished && t < 900) {
    r.bench.advance(DT);
    r.tick(DT);
    r.director.advance(DT);
    t += DT;
  }
  return t;
}

describe("the guided script's shape", () => {
  it("is far shorter than Watch's, with every beat in a lesson stage, a known shot and a unique id", () => {
    expect(G.beats.length).toBeLessThan(OHMS_LAW_SCRIPT.beats.length * 0.7);
    const stages = new Set(OHMS_LAW_LESSON.steps.map((s) => s.key));
    const shots = new Set(G.shots.map((s) => s.id));
    const ids = new Set<string>();
    for (const b of G.beats) {
      expect(stages.has(b.stage), b.id).toBe(true);
      expect(shots.has(b.shot), b.id).toBe(true);
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
    }
  });

  it("keeps the identify stage first, as one beat that enters every part", () => {
    const identify = G.beats.filter((b) => b.stage === "identify");
    expect(identify).toHaveLength(1);
    expect(G.beats[0]?.act?.kind).toBe("enter");
  });

  it("makes all 7 leads, in WAEC order", () => {
    expect(G.beats.filter((b) => b.act?.kind === "lead")).toHaveLength(7);
  });

  it("keeps every caption to 18 words or fewer", () => {
    for (const b of G.beats) expect(words(b.say), b.id).toBeLessThanOrEqual(18);
  });

  it("does readings rows 1 and 2 in full and rows 3 to 7 as one quick beat each", () => {
    const quick = G.beats.filter((b) => b.act?.kind === "row");
    expect(quick.map((b) => (b.act?.kind === "row" ? b.act.ohm : -1))).toEqual([5, 10, 20, 40, 60]);
    for (const b of quick) {
      expect(words(b.say), b.id).toBeLessThanOrEqual(8);
      expect(b.gapS, b.id).toBeLessThanOrEqual(0.2);
    }
    // Rows 1 and 2: a beat for the plugs, R, the key, each meter and the key again.
    for (const r of ["row-1", "row-2"]) {
      expect(G.beats.filter((b) => b.id.startsWith(`${r}-`))).toHaveLength(8);
    }
  });

  it("narrates plot points 1 and 2 and plots 3 to 7 quickly and silently", () => {
    const plots = G.beats.filter((b) => b.act?.kind === "plot");
    expect(plots).toHaveLength(7);
    expect(plots[0]?.spoken).toBeUndefined();
    expect(plots[1]?.spoken).toBeTruthy();
    for (const b of plots.slice(2)) {
      expect(b.spoken, b.id).toBe("");
      expect(b.gapS, b.id).toBeLessThanOrEqual(0.2);
    }
  });

  it("draws the line and the triangle, and writes ΔV, ΔI and s", () => {
    const acts = G.beats.map((b) =>
      b.act?.kind === "write" && b.act.field.kind === "graph" ? b.act.field.part : b.act?.kind,
    );
    for (const a of ["line", "triangle", "deltaY", "deltaX", "slope"]) expect(acts).toContain(a);
  });

  it("ends on the conclusion: proportionality, Ohm's law, the slope, precautions and (b)(ii)", () => {
    const tail = G.beats.slice(-5);
    expect(tail.map((b) => b.id)).toEqual([
      "conclude-line",
      "conclude-law",
      "conclude-slope",
      "conclude-precautions",
      "conclude-length",
    ]);
    expect(tail[0]?.say).toMatch(/proportional to I/);
    expect(tail[1]?.say).toMatch(/Ohm's law/);
    expect(tail[2]?.say).toContain("{slope}");
    expect(tail[3]?.say).toMatch(/parallax/);
    expect(tail[4]?.say).toMatch(/L = RA\/ρ = \(7 × 3\.143 × 10⁻⁸\) ÷ \(8\.8 × 10⁻⁷\)/);
    // The separate precautions, law and length stages of Watch are gone.
    expect(G.beats.some((b) => b.stage === "precautions" || b.stage === "length")).toBe(false);
  });

  it("never shows or says the (b)(ii) answer: the expected result is not shown before hand-in", () => {
    // Mirrors script.test.ts: Watch's record carries the method and never "0.25".
    for (const b of G.beats) {
      for (const text of [b.say, b.spoken ?? ""]) {
        expect(text, b.id).not.toContain("0.25");
        expect(text, b.id).not.toMatch(/nought point two five|zero point two five/i);
      }
    }
    for (const line of guidedConclusionLines("3.00")) expect(line).not.toContain("0.25");
  });

  it("gives the end panel the five lines, the slope as the demonstration wrote it", () => {
    const lines = guidedConclusionLines("3.00");
    expect(lines).toHaveLength(5);
    expect(lines[2]).toBe("The slope s = ΔV/ΔI is the resistance of wire XY: about 3.00 Ω.");
    expect(lines[4]).toBe(
      "(b)(ii) L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷): work out the length yourself.",
    );
  });
});

describe("the guided script, played by the director", () => {
  it("fills in all seven rows, the graph and the slope, and runs in about two minutes at 1x", () => {
    const r = rig();
    const seconds = playThrough(r);
    expect(r.director.state.finished).toBe(true);
    const rec = r.director.demoRecord;
    expect(rec.rows).toHaveLength(7);
    for (const row of rec.rows) {
      expect(row.R.text_as_written).toBeTruthy();
      expect(row.I.text_as_written).toBeTruthy();
      expect(row.V.text_as_written).toBeTruthy();
    }
    expect(rec.graph?.points).toHaveLength(7);
    expect(rec.graph?.line).not.toBeNull();
    expect(rec.graph?.triangle).not.toBeNull();
    expect(rec.graph?.slope_as_written).toMatch(/Ω$/);
    expect(rec.length_xy?.text_as_written).toBeTruthy();
    // The key is open at the end, as it is between readings.
    expect(r.bench.visual.current.keyClosed).toBe(false);
    // About two minutes at 1x, with the voice taking as long as the estimate.
    expect(seconds).toBeGreaterThan(100);
    expect(seconds).toBeLessThan(145);
  }, 60_000);

  it("says the demonstration's own slope in the conclusion, and nothing unfilled", () => {
    const r = rig();
    const captions: string[] = [];
    r.director.subscribe(() => captions.push(r.director.state.caption));
    playThrough(r);
    const slope = slopeNumber(r.director.demoRecord);
    expect(slope).toMatch(/^\d+\.\d\d$/);
    expect(captions).toContain(
      `The slope s = ΔV/ΔI is the resistance of wire XY: about ${slope} Ω.`,
    );
    expect(captions.some((c) => c.includes("{slope}"))).toBe(false);
  }, 60_000);

  it("a quick row writes the same table whether played or reached by a seek", () => {
    const r = rig();
    playThrough(r);
    const played = r.director.demoRecord.rows.map((x) => [
      x.R.text_as_written,
      x.I.text_as_written,
      x.V.text_as_written,
    ]);
    const last = G.beats.length - 1;
    r.director.seek(last);
    const sought = r.director.demoRecord.rows.map((x) => [
      x.R.text_as_written,
      x.I.text_as_written,
      x.V.text_as_written,
    ]);
    expect(sought).toEqual(played);
    expect(r.bench.visual.current.keyClosed).toBe(false);
  }, 60_000);

  it("Back and Next move between stages without sticking", () => {
    const r = rig();
    r.director.play();
    const firstOf = (stage: string) => G.beats.findIndex((b) => b.stage === stage);
    for (const stage of ["connect", "r0", "repeat", "plot", "slope", "law"]) {
      r.director.seek(firstOf(stage));
      expect(r.director.state.beat).toBe(firstOf(stage));
      r.director.prev();
      expect(r.director.state.beat).toBe(firstOf(stage) - 1);
      r.director.next();
      expect(r.director.state.beat).toBe(firstOf(stage));
    }
    r.director.next();
    r.director.next();
    expect(r.director.state.beat).toBe(firstOf("law") + 2);
  });
});
