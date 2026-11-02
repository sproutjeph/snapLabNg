import { demoSeedFor } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { watchPose } from "../../LearnPage";
import { OHMS_LAW_QUESTION } from "../../paper/ohmsLawQuestion";
import { toSpoken } from "../../paper/readAloud";
import { emptyOhmsLawRecord } from "../../readings/record";
import { slopeNumber } from "../../script/actor";
import { createDirector } from "../../script/createDirector";
import { BASE_RATE } from "../../script/timing";
import { IDENTIFY_SHOT_NAMES, isIdentifyShot } from "../../stage/shots";
import { estimateSpeechS } from "../../voice/chunk";
import type { VoiceGuide } from "../../voice/types";
import { createOhmsLawBench } from "../../wiring/bench";
import {
  CLAUSE_GAP_S,
  cardAt,
  GUIDED_STAGES,
  guidedConclusionLines,
  OHMS_LAW_GUIDED_SCRIPT,
  SENTENCE_GAP_S,
} from "./guidedScript";
import { OHMS_LAW_LESSON } from "./lesson";
import { OHMS_LAW_SCRIPT } from "./script";

// The guided script (docs/plans/guided-demo.md): its shape from the script alone, then played by
// the real director on a demonstration bench with a voice that takes as long as the estimate
// (what a muted voice takes), which is how its length is measured.

const G = OHMS_LAW_GUIDED_SCRIPT;
const words = (t: string) => t.trim().split(/\s+/).length;
/** The first beat of a stage. */
const firstOf = (stage: string) => G.beats.findIndex((b) => b.stage === stage);
/** The printed text of the question's step `i`. */
const Q_TEXT = (i: number) => OHMS_LAW_QUESTION.instructions[i]?.text ?? "";

/**
 * A voice that ends each say() after the estimated speech time at its own rate (the question is
 * read at 0.85 of it), on a clock the test advances. It records what it was asked to say and counts
 * a say() that came while an earlier one was still being said.
 */
function timedVoice() {
  let now = 0;
  let endAt: number | null = null;
  let onEnd: (() => void) | undefined;
  let overlaps = 0;
  const said: string[] = [];
  const voice: VoiceGuide = {
    say(text, o) {
      const est = estimateSpeechS(text, voice.rate);
      if (est === 0) {
        o?.onEnd?.();
        return;
      }
      if (endAt !== null) overlaps++;
      said.push(text);
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
    said,
    overlaps: () => overlaps,
    voiceActive: () => endAt !== null,
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
  return {
    bench,
    director,
    tick: v.tick,
    said: v.said,
    overlaps: v.overlaps,
    voiceActive: v.voiceActive,
  };
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
  it("has every beat in a lesson stage, a known shot and a unique id", () => {
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

  it("goes through the question's eleven steps in order, each opening on its own sentence", () => {
    const order: string[] = [];
    for (const b of G.beats) if (order[order.length - 1] !== b.stage) order.push(b.stage);
    expect(order).toEqual(OHMS_LAW_LESSON.steps.map((s) => s.key));
    expect(order).toEqual([...GUIDED_STAGES]);
    order.forEach((stage, i) => {
      const first = G.beats.find((b) => b.stage === stage);
      expect(first?.read?.instr, stage).toBe(i);
    });
  });

  it("reads every sentence of the question, word for word and in order, in calm clauses", () => {
    const Q = OHMS_LAW_QUESTION.instructions;
    Q.forEach((ins, i) => {
      const clauses = G.beats.filter((b) => b.read?.instr === i);
      expect(clauses.length, ins.label).toBeGreaterThan(0);
      // The clauses run on from each other with no gap and no overlap, from the first character to the last.
      let at = 0;
      for (const b of clauses) {
        expect(b.read?.from, b.id).toBe(at);
        at = b.read?.to ?? -1;
        expect(b.spoken, b.id).toBe(toSpoken(ins.text.slice(b.read?.from, b.read?.to)).spoken);
      }
      expect(at, ins.label).toBe(ins.text.length);
    });
    // A calm pace; about 0.6 s after a sentence, a breath between its clauses, and no pause
    // before a step's work (the work starts with the sentence).
    for (const b of G.beats.filter((x) => x.read)) {
      expect(b.rateX, b.id).toBe(0.85);
      const last = b.read?.to === Q[b.read?.instr ?? 0]?.text.length;
      // (The first sentence also waits for the two parts it never names to land.)
      const gap = b.id === "q1" ? 1 : last ? SENTENCE_GAP_S : CLAUSE_GAP_S;
      expect(b.gapS, b.id).toBe(gap);
      expect(b.say, b.id).toBe("");
    }
    expect(SENTENCE_GAP_S).toBeCloseTo(0.6, 5);
    expect(G.beats.some((b) => b.act?.kind === "wait")).toBe(false);
  });

  it("starts each step's work as its sentence begins, at its key phrase", () => {
    const by = (id: string) => G.beats.find((b) => b.id === id);
    // 2: the metre rule opens on "Measure and record the length XY".
    expect(by("q2")?.act).toEqual({ kind: "loupe", target: "rule" });
    // 3: the first lead is drawn on "Connect the circuit".
    expect(by("q3")?.act?.kind).toBe("lead");
    // 4: the plugs on "With R = 0 Ω,", the key on "close the key K.", the ammeter on "Read and record".
    expect(by("q4-plug")?.act).toEqual({ kind: "plug", ohm: 0 });
    expect(by("q4-key")?.act).toEqual({ kind: "key", closed: true });
    expect(by("q4-read")?.act).toEqual({ kind: "loupe", target: "ammeter" });
    expect(OHMS_LAW_QUESTION.instructions[3]?.text.slice(by("q4-key")?.read?.from)).toMatch(
      /^close the key K\./,
    );
    // 5: the same for R = 1 Ω.
    expect(by("q5-plug")?.act).toEqual({ kind: "plug", ohm: 1 });
    expect(by("q5-key")?.act).toEqual({ kind: "key", closed: true });
    expect(by("q5-read")?.act).toEqual({ kind: "loupe", target: "ammeter" });
    // 6: two of the five values are taken as the sentence is read.
    expect(by("q6-values")?.act).toEqual({ kind: "row", row: 2, ohm: 5 });
    expect(by("q6-tabulate")?.act).toEqual({ kind: "row", row: 3, ohm: 10 });
    // 7: V is headed as "Plot V (vertical)" is read, I as "against I (horizontal)" is.
    expect(by("q7-v")?.act?.kind).toBe("write");
    expect(by("q7-i")?.act?.kind).toBe("write");
    // 8: the triangle on "Determine the slope s."
    expect(by("q8")?.act).toEqual({ kind: "triangle" });
  });

  it("identifies the parts one by one, each framed and tagged, then all together", () => {
    const identify = G.beats.filter((b) => b.stage === "identify" && !b.read);
    // The sentence is read first; then E, K, A, V, R, wire XY and the leads, then every tag at once.
    expect(G.beats[0]?.id).toBe("q1");
    expect(G.beats.slice(1, identify.length + 1)).toEqual(identify);
    expect(identify.map((b) => b.id)).toEqual([...IDENTIFY_SHOT_NAMES, "id-all"]);
    const single = identify.slice(0, -1);
    expect(single.map((b) => b.tags?.[0]?.anchor)).toEqual([
      "cells",
      "key",
      "ammeter",
      "voltmeter",
      "box",
      "wire",
      "leads",
    ]);
    for (const b of single) {
      expect(b.tags, b.id).toHaveLength(1);
      expect(isIdentifyShot(b.id), b.id).toBe(true);
      // The one plain line is on the tag; the voice and the caption say only the name.
      expect(b.tags?.[0]?.sub, b.id).toBeTruthy();
      expect(words(b.tags?.[0]?.sub ?? ""), b.id).toBeLessThanOrEqual(14);
      expect(words(b.say), b.id).toBeLessThanOrEqual(3);
      expect(b.callouts, b.id).toBeUndefined();
    }
    const all = identify[identify.length - 1];
    expect(all?.tags?.map((t) => t.anchor)).toEqual(single.map((b) => b.tags?.[0]?.anchor));
    expect(all?.tags?.every((t) => t.sub === undefined)).toBe(true);
    // The parts drop in on the first sentence, as it names them, so a seek to any later beat finds them down.
    expect(G.beats.filter((b) => b.act?.kind === "enter").map((b) => b.id)).toEqual(["q1"]);
  });

  it("words the ammeter and voltmeter tags as series and parallel", () => {
    const line = (id: string) => G.beats.find((b) => b.id === id)?.tags?.[0]?.sub;
    expect(line("id-ammeter")).toBe("Ammeter A: measures the current; it goes in series.");
    expect(line("id-voltmeter")).toBe(
      "Voltmeter V: measures the p.d. across XY; it goes in parallel.",
    );
    expect(line("id-cells")).toBe("Cells E: drive the current.");
  });

  it("frames each identify beat with its own shot, the box for plugs and the key, the rest on the bench", () => {
    for (const b of G.beats) {
      const pose = watchPose(b, null);
      if (b.stage === "identify" && !b.read && b.id !== "id-all") expect(pose, b.id).toBe(b.id);
      else expect(isIdentifyShot(pose), b.id).toBe(false);
    }
    // A question beat that works the box or the key looks at them even with a dial still open.
    for (const id of ["q4-plug", "q4-key", "q5-plug", "q5-key", "q6-values"]) {
      const b = G.beats.find((x) => x.id === id);
      expect(watchPose(b, "voltmeter"), id).toBe("box");
    }
  });

  it("makes all 7 leads, in WAEC order, the first as the sentence is read", () => {
    const leads = G.beats.filter((b) => b.act?.kind === "lead");
    expect(leads).toHaveLength(7);
    expect(leads[0]?.read?.instr).toBe(2);
    for (const b of leads.slice(1)) expect(b.read).toBeUndefined();
  });

  it("keeps every caption to 18 words or fewer", () => {
    for (const b of G.beats) expect(words(b.say), b.id).toBeLessThanOrEqual(18);
  });

  it("does readings rows 1 and 2 in full, rows 3 and 4 with the sentence and 5 to 7 as quick beats", () => {
    const rows = G.beats.filter((b) => b.act?.kind === "row");
    expect(rows.map((b) => (b.act?.kind === "row" ? b.act.ohm : -1))).toEqual([5, 10, 20, 40, 60]);
    for (const b of rows.filter((x) => !x.read)) {
      expect(words(b.say), b.id).toBeLessThanOrEqual(8);
      expect(b.gapS, b.id).toBeLessThanOrEqual(0.2);
    }
    // Rows 1 and 2: the plugs, the key and the ammeter as the sentence is read; then R, I, the
    // voltmeter, V and the key again.
    for (const r of ["row-1", "row-2"]) {
      expect(G.beats.filter((b) => b.id.startsWith(`${r}-`))).toHaveLength(5);
    }
    const ids = G.beats.map((b) => b.id);
    expect(ids.indexOf("q4-read")).toBeLessThan(ids.indexOf("row-1-i"));
    expect(ids.indexOf("row-1-key-off")).toBeLessThan(ids.indexOf("q5-plug"));
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

  it("states two precautions, the law and the working as cards beside the paper", () => {
    const at = (id: string) => G.beats.findIndex((b) => b.id === id);
    const card = (id: string) => cardAt(G.beats, at(id));
    expect(card("q9")).toBeNull();
    expect(card("prec-1")?.lines).toEqual(["The key was opened between readings."]);
    expect(card("prec-2")?.lines).toHaveLength(2);
    expect(card("prec-2")?.lines.join(" ")).toMatch(/parallax/);
    expect(G.beats[at("prec-1")]?.say).toMatch(/key was opened/);
    expect(card("law-line")?.lines.join(" ")).toMatch(/straight line through the origin/);
    expect(G.beats[at("law-line")]?.say).toMatch(/proportional to I/);
    expect(card("law-state")?.lines.join(" ")).toMatch(/directly proportional to the potential/);
    expect(G.beats[at("law-state")]?.say).toMatch(/Ohm's law/);
    // (b)(ii): the working only, to the line L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷).
    expect(card("length-work")?.lines.at(-1)).toBe("L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷)");
    expect(G.beats[at("length-work")]?.say).toMatch(/Work out L yourself/);
    // The slope's meaning is said at the end of step 8, with the demonstration's own number.
    expect(G.beats[at("slope-meaning")]?.say).toContain("{slope}");
    expect(G.beats.at(-1)?.stage).toBe("length");
  });

  it("never shows or says the (b)(ii) answer: the expected result is not shown before hand-in", () => {
    // Mirrors script.test.ts: Watch's record carries the method and never "0.25".
    for (const b of G.beats) {
      const texts = [b.say, b.spoken ?? "", ...(b.card?.lines ?? []), b.card?.title ?? ""];
      for (const text of texts) {
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
  it("fills in all seven rows, the graph and the slope, in three to four minutes at 1x", () => {
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
    // Three to four minutes at 1x, with the voice taking as long as the estimate at its own rate
    // (the question at 0.85 of it).
    expect(seconds).toBeGreaterThan(180);
    expect(seconds).toBeLessThan(225);
    console.info(`guided run at 1x: ${seconds.toFixed(1)} s`);
  }, 60_000);

  it("works while the sentence is read, and the two voices never overlap", () => {
    const r = rig();
    const DT = 1 / 60;
    const firstLeadAt = { leads: -1, voice: false };
    r.director.play();
    // Run to "Connect the circuit as shown in the diagram." and watch its first lead appear.
    let t = 0;
    while (r.director.state.beat < 12 && t < 300) {
      r.bench.advance(DT);
      r.tick(DT);
      r.director.advance(DT);
      t += DT;
    }
    expect(r.director.state.beat).toBe(12);
    while (r.director.state.beat === 12 && t < 300) {
      r.bench.advance(DT);
      r.tick(DT);
      r.director.advance(DT);
      t += DT;
      if (firstLeadAt.leads < 0 && r.bench.visual.current.leads.length > 0) {
        firstLeadAt.leads = r.bench.visual.current.leads.length;
        firstLeadAt.voice = r.voiceActive();
      }
    }
    // The lead was made while the sentence was still being said.
    expect(firstLeadAt.leads).toBe(1);
    expect(firstLeadAt.voice).toBe(true);
    // And one voice at a time, over the whole run.
    playThrough(r);
    expect(r.overlaps()).toBe(0);
  }, 60_000);

  it("reads the same sentence aloud again when Back or Next lands on its step", () => {
    const r = rig();
    r.director.play();
    const said = r.said;
    r.director.seek(firstOf("connect"));
    expect(said.at(-1)).toBe(toSpoken(Q_TEXT(2)).spoken);
    // Back from a step's sentence goes to the start of the step before, which reads its sentence.
    r.director.seek(firstOf("repeat"));
    r.director.prev();
    expect(r.director.state.beat).toBe(firstOf("r1"));
    expect(said.at(-1)).toBe(G.beats[firstOf("r1")]?.spoken);
    // Next steps on one beat at a time (no beat is skipped, so no sentence is missed).
    r.director.next();
    expect(r.director.state.beat).toBe(firstOf("r1") + 1);
  });

  it("Skip to the work stops the voice for the sentence but not the work", () => {
    const r = rig();
    r.director.play();
    r.director.seek(firstOf("r0"));
    const say = r.said.length;
    r.director.skipVoice();
    // Silent from here on in this sentence: its later clauses are not said...
    const before = r.said.length;
    expect(before).toBe(say);
    const DT = 1 / 60;
    let t = 0;
    while (G.beats[r.director.state.beat]?.read?.instr === 3 && t < 60) {
      r.bench.advance(DT);
      r.tick(DT);
      r.director.advance(DT);
      t += DT;
    }
    expect(r.said.slice(before).some((x) => /close the key/.test(x))).toBe(false);
    // ...and the work went on: the plugs were pulled and the key closed.
    expect(r.bench.visual.current.keyClosed).toBe(true);
    // Going back to the step reads it again.
    r.director.seek(firstOf("r0"));
    expect(r.said.at(-1)).toBe(G.beats[firstOf("r0")]?.spoken);
  }, 60_000);

  it("pausing cuts the voice and playing reads the clause again", () => {
    const r = rig();
    r.director.play();
    r.director.seek(firstOf("r1"));
    const n = r.said.length;
    r.director.pause();
    r.director.play();
    expect(r.said.length).toBe(n + 1);
    expect(r.said.at(-1)).toBe(G.beats[firstOf("r1")]?.spoken);
  });

  it("tells the paper where the voice is: a clause begins, a word is said, it ends or is cut off", () => {
    const r = rig();
    const events: string[] = [];
    r.director.onSpeech((e) => events.push(`${e.kind}:${G.beats[e.beat]?.id}`));
    r.director.play();
    r.director.seek(firstOf("measure-xy"));
    expect(events).toContain("start:q2");
    r.director.pause();
    expect(events.at(-1)).toBe("stop:q2");
  });

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

  it("Back and Next move between steps without sticking, each landing on a sentence", () => {
    const r = rig();
    r.director.play();
    for (const stage of ["connect", "r0", "repeat", "plot", "slope", "law"]) {
      const at = firstOf(stage);
      const before = firstOf(
        GUIDED_STAGES[GUIDED_STAGES.indexOf(stage as never) - 1] ?? "identify",
      );
      r.director.seek(at);
      expect(r.director.state.beat).toBe(at);
      expect(G.beats[at]?.read, stage).toBeDefined();
      r.director.prev();
      expect(r.director.state.beat).toBe(before);
      expect(G.beats[before]?.read, stage).toBeDefined();
      r.director.seek(at);
      r.director.next();
      expect(r.director.state.beat).toBe(at + 1);
    }
    // Back from the first sentence stays on it; from the step strip, a seek to a step starts at its sentence.
    r.director.seek(0);
    r.director.prev();
    expect(r.director.state.beat).toBe(0);
  });
});

describe("the slope working as written", () => {
  // The working must check on paper (a WAEC examiner redoes the arithmetic as printed): the
  // difference of the two corner readings printed, and the quotient of the two differences printed.
  const num = (t: string | undefined, re: RegExp) => Number(re.exec(t ?? "")?.[1]);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  for (const [name, script] of [
    ["guided", G],
    ["Watch", OHMS_LAW_SCRIPT],
  ] as const) {
    it(`prints ΔV, ΔI and s = ΔV/ΔI that agree with each other, ${name}`, () => {
      for (const seed of [1, 2, 3, 7, 11, 19]) {
        const r = rig(seed, script);
        playThrough(r);
        const g = r.director.demoRecord.graph;
        const dv = g?.delta_y_as_written ?? "";
        const di = g?.delta_x_as_written ?? "";
        const s = g?.slope_as_written ?? "";
        const [vHi, vLo, vD] = [/= ([\d.]+) −/, /− ([\d.]+) =/, /= ([\d.]+) V$/].map((re) =>
          num(dv, re),
        ) as [number, number, number];
        const [iHi, iLo, iD] = [/= ([\d.]+) −/, /− ([\d.]+) =/, /= ([\d.]+) A$/].map((re) =>
          num(di, re),
        ) as [number, number, number];
        const m = /^s = ΔV\/ΔI = ([\d.]+)\/([\d.]+) = ([\d.]+) Ω$/.exec(s);
        expect(m, `${name} seed ${seed}: ${s}`).not.toBeNull();
        const [a, b, q] = [Number(m?.[1]), Number(m?.[2]), Number(m?.[3])];
        // The differences are of the readings as printed; the working repeats them; the quotient
        // is of those, to 2 d.p.
        expect(r2(vHi - vLo), `${name} ${seed} ${dv}`).toBe(vD);
        expect(r2(iHi - iLo), `${name} ${seed} ${di}`).toBe(iD);
        expect([a, b], `${name} ${seed} ${s}`).toEqual([vD, iD]);
        expect(r2(a / b), `${name} ${seed} ${s}`).toBe(q);
      }
    }, 120_000);
  }
});
