import type { OhmsLawRecord } from "@snaplab/contracts";
import { demoSeedFor } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { describe, expect, it, vi } from "vitest";
import { emptyOhmsLawRecord } from "../readings/record";
import type { BenchState, OhmsLawBench } from "../types";
import type { VoiceGuide } from "../voice/types";
import { createOhmsLawBench, type OhmsLawBenchController } from "../wiring/bench";
import {
  createDirector,
  type DirectorHandle,
  HINT_HIGHLIGHT_S,
  HINT_REPEAT_S,
} from "./createDirector";
import { SAMPLE_SCRIPT, SAMPLE_SHOTS } from "./sampleScript";
import { BEAT_GAP_S, voiceCapS } from "./timing";
import type { Beat, DirectorOptions, Script } from "./types";

// The director against a real demonstration bench, with a fake voice. No real speech and no
// real clock: time is whatever the test feeds advance(). The marks come from packages/rules.

/** A voice that says nothing aloud. `endsAfter: "never"` is a browser whose onend never fires. */
function fakeVoice(endsAfter: "now" | "never" = "now") {
  const said: string[] = [];
  let stops = 0;
  const voice: VoiceGuide = {
    say(text, o) {
      said.push(text);
      if (endsAfter === "now") o?.onEnd?.();
    },
    stop() {
      stops++;
    },
    speaking: false,
    muted: false,
    rate: 0.95,
  };
  return { voice, said, stops: () => stops };
}

const DT = 1 / 60;

interface Rig {
  bench: OhmsLawBenchController;
  director: DirectorHandle;
  said: string[];
  stops: () => number;
  voice: VoiceGuide;
  /** Feeds both clocks, the way the page does every frame. */
  run(seconds: number): void;
  /** Runs until `until()` holds, or fails after `maxS`. */
  runUntil(until: () => boolean, maxS?: number): number;
}

/** Her notebook's record keeps its identity until she edits it (see createDirector). */
function benchState(bench: OhmsLawBenchController, record: OhmsLawRecord): BenchState {
  return {
    comparison: bench.comparison,
    keyClosed: bench.visual.current.keyClosed,
    boxSettingOhm: bench.boxSettingOhm,
    record,
    identified: new Set(),
  };
}

function rig(
  script: Script,
  o: {
    mode?: "watch" | "practice" | "exam";
    seed?: number;
    voice?: "now" | "never";
    done?: () => BenchState;
    hideSupervisor?: boolean;
  } = {},
): Rig {
  const mode = o.mode ?? "watch";
  const bench = createOhmsLawBench(o.seed ?? demoSeedFor(7));
  const { voice, said, stops } = fakeVoice(o.voice ?? "now");
  // Her bench has no supervisor: touching one is an error, in the type and at run time.
  const herBench = new Proxy(bench, {
    get(target, prop, receiver) {
      if (prop === "supervisor") throw new Error("the director read her bench's supervisor");
      return Reflect.get(target, prop, receiver);
    },
  }) as Omit<OhmsLawBench, "supervisor">;
  const record = emptyOhmsLawRecord("practice");
  const base = { script, voice, benchState: o.done ?? (() => benchState(bench, record)) };
  const options: DirectorOptions =
    mode === "watch"
      ? { ...base, mode, bench }
      : { ...base, mode, bench: o.hideSupervisor === false ? bench : herBench };
  const director = createDirector(options);
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += DT) {
      bench.advance(DT);
      director.advance(DT);
    }
  };
  const runUntil = (until: () => boolean, maxS = 600) => {
    let t = 0;
    while (!until() && t < maxS) {
      bench.advance(DT);
      director.advance(DT);
      t += DT;
    }
    expect(until()).toBe(true);
    return t;
  };
  return { bench, director, said, stops, voice, run, runUntil };
}

const beat = (id: string, say: string, extra: Partial<Beat> = {}): Beat => ({
  id,
  stage: "connect",
  say,
  instruct: say,
  shot: "bench",
  ...extra,
});
const script = (...beats: Beat[]): Script => ({
  lessonId: "ohms_law_vi",
  shots: SAMPLE_SHOTS,
  beats,
});

const leadBeat = (id: string, extra: Partial<Beat> = {}): Beat =>
  beat(id, "Join them.", { act: { kind: "lead", from: "E+", to: "K1" }, ...extra });

describe("Watch", () => {
  it("performs a lead through the bench's own taps, and the lead exists afterwards", () => {
    const r = rig(script(leadBeat("a")));
    r.director.play();
    expect(r.bench.visual.current.leads).toHaveLength(0);
    r.runUntil(() => r.director.state.finished);
    const leads = r.bench.visual.current.leads;
    expect(leads).toHaveLength(1);
    expect([leads[0]?.a, leads[0]?.b]).toEqual(["E+", "K1"]);
  });

  it("narrates each beat and shows the narration as the caption", () => {
    const r = rig(script(beat("a", "First words."), beat("b", "Second words.")));
    expect(r.director.state.caption).toBe("First words.");
    r.director.play();
    expect(r.said).toEqual(["First words."]);
    r.runUntil(() => r.director.state.beat === 1);
    expect(r.director.state.caption).toBe("Second words.");
    expect(r.said).toEqual(["First words.", "Second words."]);
  });

  it("a beat ends on the voice fallback when onEnd never fires", () => {
    const say = "Now join the ammeter to the resistance box, in series.";
    const r = rig(script(beat("a", say), beat("b", "Next.")), { voice: "never" });
    r.director.play();
    const cap = voiceCapS(say);
    r.run(cap - 0.3);
    expect(r.director.state.beat).toBe(0);
    const t = r.runUntil(() => r.director.state.beat === 1, 60);
    // Not before the cap, and within a gap and a frame or two of it.
    expect(t + cap - 0.3).toBeGreaterThanOrEqual(cap + BEAT_GAP_S - 2 * DT);
    expect(t + cap - 0.3).toBeLessThanOrEqual(cap + BEAT_GAP_S + 3 * DT);
  });

  it("speed 2 halves beat time", () => {
    const timeAt = (speed: 1 | 2) => {
      const r = rig(script(beat("a", "Join the cells to the key now."), beat("b", "Next.")), {
        voice: "never",
      });
      r.director.setSpeed(speed);
      r.director.play();
      return r.runUntil(() => r.director.state.beat === 1, 60);
    };
    const slow = timeAt(1);
    const fast = timeAt(2);
    expect(fast).toBeGreaterThan(slow / 2 - 3 * DT);
    expect(fast).toBeLessThan(slow / 2 + 3 * DT);
  });

  it("asks the voice to speak faster at speed 2 and restores its rate on dispose", () => {
    const r = rig(script(beat("a", "Hello.")));
    r.director.setSpeed(2);
    expect(r.voice.rate).toBeCloseTo(1.9, 10);
    r.director.setSpeed(1);
    expect(r.voice.rate).toBeCloseTo(0.95, 10);
    r.director.setSpeed(1.5);
    r.director.dispose();
    expect(r.voice.rate).toBeCloseTo(0.95, 10);
  });

  it("play() while already playing does not say the narration twice", () => {
    const r = rig(script(beat("a", "Say this once."), beat("b", "Then this.")), { voice: "never" });
    r.director.play();
    r.director.play();
    r.run(0.2);
    r.director.play();
    expect(r.said).toEqual(["Say this once."]);
  });

  it("pauses and resumes: pause stops the voice and holds the beat, play says it again", () => {
    const r = rig(script(beat("a", "Say this."), beat("b", "Then this.")), { voice: "never" });
    r.director.play();
    r.run(0.3);
    r.director.pause();
    expect(r.director.state.playing).toBe(false);
    expect(r.stops()).toBeGreaterThan(0);
    r.run(30);
    expect(r.director.state.beat).toBe(0);
    r.director.play();
    expect(r.said).toEqual(["Say this.", "Say this."]);
    r.runUntil(() => r.director.state.beat === 1, 30);
  });

  it("finishes after the last beat, and play starts again from the first", () => {
    const r = rig(script(leadBeat("a")));
    r.director.play();
    r.runUntil(() => r.director.state.finished);
    expect(r.director.state.playing).toBe(false);
    r.director.play();
    expect(r.director.state.finished).toBe(false);
    expect(r.director.state.beat).toBe(0);
    expect(r.bench.visual.current.leads).toHaveLength(0);
    r.runUntil(() => r.director.state.finished);
    expect(r.bench.visual.current.leads).toHaveLength(1);
  });

  it("moves the plugs until the box shows the resistance, with the fewest moves", () => {
    const plug = (id: string, ohm: number) =>
      beat(id, `Set ${ohm}.`, { act: { kind: "plug", ohm } });
    const r = rig(script(plug("a", 5), plug("b", 10), plug("c", 0)));
    r.director.play();
    r.runUntil(() => r.director.state.beat === 1);
    expect(r.bench.boxSettingOhm).toBe(5);
    r.runUntil(() => r.director.state.beat === 2);
    expect(r.bench.boxSettingOhm).toBe(10);
    r.runUntil(() => r.director.state.finished);
    expect(r.bench.boxSettingOhm).toBe(0);
    r.director.seek(2);
    expect(r.bench.boxSettingOhm).toBe(10);
  });

  it("closes and opens the key", () => {
    const key = (id: string, closed: boolean) => beat(id, "Key.", { act: { kind: "key", closed } });
    const r = rig(script(key("a", true), key("b", false)));
    r.director.play();
    r.runUntil(() => r.director.state.beat === 1);
    r.runUntil(() => r.bench.visual.current.keyClosed);
    r.runUntil(() => r.director.state.finished);
    expect(r.bench.visual.current.keyClosed).toBe(false);
  });

  it("reports act and its progress while an action runs, then 1 when it is done", () => {
    const r = rig(script(leadBeat("a")), { voice: "never" });
    r.director.play();
    expect(r.director.state.act?.kind).toBe("lead");
    r.run(0.5);
    expect(r.director.state.actT).toBeGreaterThan(0);
    expect(r.director.state.actT).toBeLessThan(1);
    r.run(2);
    expect(r.director.state.actT).toBe(1);
  });

  it("sends an event for each thing the actor does, and none while seeking", () => {
    const r = rig(
      script(
        leadBeat("a"),
        beat("b", "Key.", { act: { kind: "key", closed: true } }),
        beat("c", "Plug.", { act: { kind: "plug", ohm: 1 } }),
      ),
    );
    const kinds: string[] = [];
    r.director.onEvent((e) => kinds.push(e.kind));
    r.director.play();
    r.runUntil(() => r.director.state.finished);
    expect(kinds).toEqual(["lead", "key", "plug"]);
    r.director.seek(2);
    expect(kinds).toEqual(["lead", "key", "plug"]);
  });
});

describe("seek", () => {
  const snapshot = (r: Rig) => ({
    leads: r.bench.visual.current.leads.map((l) => [l.a, l.b, l.colour]),
    plugsIn: [...r.bench.visual.current.plugsIn],
    keyClosed: r.bench.visual.current.keyClosed,
    record: r.director.demoRecord,
    loupe: r.director.state.loupe,
    beat: r.director.state.beat,
  });

  const lastBeat = SAMPLE_SCRIPT.beats.length - 1;
  // Beats that are not a reading being written (those are checked on their own below).
  const AT = [3, 9, 14, 17, 22, 40, 66, 80, 96];

  /** Everything about the bench and notebook except the digits the dials gave. */
  const shape = (r: Rig) => {
    const snap = snapshot(r);
    const rec = snap.record;
    return {
      ...snap,
      record: {
        ...rec,
        rows: rec.rows.map((row) => [
          row.R.text_as_written,
          row.I.text_as_written !== "",
          row.V.text_as_written !== "",
        ]),
        graph: rec.graph && {
          axes: [rec.graph.x.scale_as_written, rec.graph.y.scale_as_written],
          points: rec.graph.points.length,
          line: rec.graph.line !== null,
          triangle: rec.graph.triangle !== null,
          deltas: [rec.graph.delta_y_as_written !== null, rec.graph.delta_x_as_written !== null],
        },
      },
    };
  };

  it.each(AT)("seek(%i) gives the same bench and notebook as playing to it", (n) => {
    const played = rig(SAMPLE_SCRIPT);
    let atBeat: ReturnType<typeof shape> | null = null;
    played.director.subscribe(() => {
      if (atBeat === null && played.director.state.beat === n) atBeat = shape(played);
    });
    played.director.setSpeed(2);
    played.director.play();
    played.runUntil(() => atBeat !== null || played.director.state.finished);

    const sought = rig(SAMPLE_SCRIPT);
    sought.director.setSpeed(2);
    sought.director.play();
    sought.run(1);
    sought.director.seek(n);
    expect(atBeat).not.toBeNull();
    expect(shape(sought)).toEqual(atBeat);
  });

  it.each([1, 2] as const)(
    "a fresh seek reads the dials to within a division of what playing wrote, at %ix",
    (speed) => {
      // The cells polarise and the wire warms (engine, params.ts), so the same circuit reads a
      // hundredth or two differently after a different history. Divisions: 0.02 A and 0.05 V.
      // Measured over 10 benches and both speeds, the worst gap is 0.01 A and 0.02 V.
      for (const seed of [1, 7, 99, 250]) {
        const played = rig(SAMPLE_SCRIPT, { seed });
        played.director.setSpeed(speed);
        played.director.play();
        played.runUntil(() => played.director.state.beat === 80);
        const sought = rig(SAMPLE_SCRIPT, { seed });
        sought.director.seek(80);
        const a = played.director.demoRecord.rows;
        const b = sought.director.demoRecord.rows;
        expect(b).toHaveLength(a.length);
        for (let i = 0; i < a.length; i++) {
          const dI = Math.abs((a[i]?.I.value ?? 0) - (b[i]?.I.value ?? 99));
          const dV = Math.abs((a[i]?.V.value ?? 0) - (b[i]?.V.value ?? 99));
          expect(dI).toBeLessThanOrEqual(0.02 + 1e-9);
          expect(dV).toBeLessThanOrEqual(0.05 + 1e-9);
        }
      }
    },
  );

  it("a live replay of a reading waits for the needle, and writes what the dial shows now", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.setSpeed(2);
    r.director.play();
    // Beat 18 writes the first current. Play through it, so the beat has a cached reading.
    r.runUntil(() => r.director.state.beat === 19);
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toMatch(/^\d\.\d\d$/);
    r.director.pause();
    // A seek past it writes the cached text at once ...
    r.director.seek(19);
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toMatch(/^\d\.\d\d$/);
    // ... but playing the beat live again starts with an empty cell, waits for the bench to be
    // left alone (QUIET_S = 2 s), then writes the dial's reading, not the cache.
    r.director.seek(18);
    r.director.play();
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toBe("");
    r.run(0.5);
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toBe("");
    r.runUntil(() => r.director.demoRecord.rows[0]?.I.text_as_written !== "", 30);
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toBe(
      r.bench.supervisor.reading("ammeter"),
    );
  });

  it("scrubbing never changes a reading she has seen written", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.setSpeed(2);
    r.director.play();
    r.runUntil(() => r.director.state.beat === 60);
    const seen = r.director.demoRecord.rows.map((row) => [
      row.I.text_as_written,
      row.V.text_as_written,
    ]);
    expect(seen.filter(([i, v]) => i && v).length).toBeGreaterThanOrEqual(4);
    r.director.seek(0);
    expect(r.director.demoRecord.rows[0]?.I.text_as_written).toBe("");
    r.director.seek(80);
    const again = r.director.demoRecord.rows.map((row) => [
      row.I.text_as_written,
      row.V.text_as_written,
    ]);
    for (let i = 0; i < seen.length; i++) {
      if (seen[i]?.[0]) expect(again[i]).toEqual(seen[i]);
    }
  });

  it("seeks while paused to the start of a beat, then plays on from there", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.seek(9);
    expect(r.director.state.beat).toBe(9);
    expect(r.director.state.playing).toBe(false);
    // Beats 4 to 8 are the first five leads.
    expect(r.bench.visual.current.leads).toHaveLength(5);
    expect(r.said).toEqual([]);
    r.director.play();
    expect(r.said).toHaveLength(1);
  });

  it("goes back: the bench and notebook lose everything after the beat", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.seek(lastBeat);
    expect(r.bench.visual.current.leads).toHaveLength(7);
    expect(r.director.demoRecord.law_as_written).not.toBeNull();
    r.director.seek(2);
    expect(r.bench.visual.current.leads).toHaveLength(0);
    expect(r.director.demoRecord.law_as_written).toBeNull();
    expect(r.director.demoRecord.length_xy).toBeNull();
    expect(r.director.state.loupe).toBe("rule");
  });

  it("previous restarts a beat that has run a while, and goes back from one that has just begun", () => {
    const r = rig(script(beat("a", "One."), beat("b", "Two."), beat("c", "Three.")), {
      voice: "never",
    });
    r.director.seek(2);
    r.director.play();
    r.run(0.3);
    r.director.prev();
    expect(r.director.state.beat).toBe(1);
    r.run(2);
    r.director.prev();
    expect(r.director.state.beat).toBe(1);
  });

  it("next skips ahead, and from the last beat finishes with everything done", () => {
    const r = rig(script(leadBeat("a"), beat("b", "Key.", { act: { kind: "key", closed: true } })));
    r.director.next();
    expect(r.director.state.beat).toBe(1);
    expect(r.bench.visual.current.leads).toHaveLength(1);
    r.director.next();
    expect(r.director.state.finished).toBe(true);
    expect(r.bench.visual.current.keyClosed).toBe(true);
  });
});

describe("the sample script, played by the actor on the demonstration bench", () => {
  it("fills in a record that scores 20/20, and 21/21 with the bench's own effective resistance", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.setSpeed(2);
    r.director.play();
    r.runUntil(() => r.director.state.finished);
    const record = r.director.demoRecord;
    const student = markOhmsLaw(record);
    expect(student.earned).toBe(20);
    const supervised = markOhmsLaw(record, { teacherXyOhm: r.bench.supervisor.effectiveOhm() });
    expect(supervised.earned).toBe(21);
  });

  it("writes what the dials showed: the readings are the supervisor's, not the script's", () => {
    const r = rig(SAMPLE_SCRIPT);
    r.director.seek(SAMPLE_SCRIPT.beats.length - 1);
    r.director.next();
    const rows = r.director.demoRecord.rows;
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.I.text_as_written).toMatch(/^-?\d\.\d\d$/);
      expect(row.V.text_as_written).toMatch(/^-?\d\.\d\d$/);
    }
    // The last row read the log's last entry at that box setting.
    const log = r.bench.supervisor.log();
    const at60 = log.filter((e) => e.boxOhm === 60).at(-1);
    expect(rows[6]?.I.text_as_written).toBe(at60?.iShown);
    expect(rows[6]?.V.text_as_written).toBe(at60?.vShown);
  });

  it("gives different readings on a different demonstration bench", () => {
    const a = rig(SAMPLE_SCRIPT, { seed: 3 });
    const b = rig(SAMPLE_SCRIPT, { seed: 4 });
    a.director.seek(SAMPLE_SCRIPT.beats.length - 1);
    a.director.next();
    b.director.seek(SAMPLE_SCRIPT.beats.length - 1);
    b.director.next();
    expect(a.director.demoRecord.rows[0]?.I.text_as_written).not.toBe(
      b.director.demoRecord.rows[0]?.I.text_as_written,
    );
  });

  it("scores 20/20 on a spread of demonstration benches", () => {
    for (const seed of [1, 2, 5, 11, 40, 99, 123, 250]) {
      const r = rig(SAMPLE_SCRIPT, { seed });
      r.director.seek(SAMPLE_SCRIPT.beats.length - 1);
      r.director.next();
      const sheet = markOhmsLaw(r.director.demoRecord);
      const lost = sheet.items.filter((i) => i.outcome === "lost").map((i) => i.id);
      expect({ seed, lost }).toEqual({ seed, lost: [] });
      expect(sheet.earned).toBe(20);
    }
  });
});

describe("Practise", () => {
  const withDone = (doneRef: { v: boolean }) =>
    script(leadBeat("a", { done: () => doneRef.v }), beat("b", "Next one.", { done: () => false }));

  it("waits for done() and never runs act", () => {
    const flag = { v: false };
    const r = rig(withDone(flag), { mode: "practice" });
    r.director.play();
    expect(r.said).toEqual(["Join them."]);
    expect(r.director.state.waiting).toBe(true);
    r.run(120);
    expect(r.director.state.beat).toBe(0);
    expect(r.director.state.act).toBeNull();
    expect(r.bench.visual.current.leads).toHaveLength(0);
    flag.v = true;
    r.runUntil(() => r.director.state.beat === 1);
    expect(r.director.state.waiting).toBe(true);
    expect(r.bench.visual.current.leads).toHaveLength(0);
  });

  it("speaks the instruction and shows it as the caption", () => {
    const r = rig(script(beat("a", "Narration.", { instruct: "Do this." })), { mode: "practice" });
    expect(r.director.state.caption).toBe("Do this.");
    r.director.play();
    expect(r.said).toEqual(["Do this."]);
  });

  it("never reads her bench's supervisor", () => {
    const flag = { v: false };
    const r = rig(withDone(flag), { mode: "practice" });
    r.director.setSpeed(2);
    r.director.play();
    r.run(30);
    flag.v = true;
    r.run(5);
    r.director.next();
    r.director.prev();
    r.director.seek(1);
    r.director.showMe();
    expect(r.director.demoRecord.length_xy).toBeNull();
  });

  it("goes on after a narration-only beat's voice ends", () => {
    const r = rig(script(beat("a", "Look at the bench."), beat("b", "Now this.")), {
      mode: "practice",
    });
    r.director.play();
    r.runUntil(() => r.director.state.beat === 1, 10);
  });

  it("climbs the hint ladder: repeat at 20 s, highlight at 40 s", () => {
    const flag = { v: false };
    const r = rig(withDone(flag), { mode: "practice" });
    r.director.play();
    r.run(HINT_REPEAT_S - 1);
    expect(r.director.state.hint).toBe(0);
    r.run(2);
    expect(r.director.state.hint).toBe(1);
    expect(r.said).toEqual(["Join them.", "Join them."]);
    r.run(HINT_HIGHLIGHT_S - HINT_REPEAT_S - 3);
    expect(r.director.state.hint).toBe(1);
    r.run(4);
    expect(r.director.state.hint).toBe(2);
    expect(r.bench.visual.current.leads).toHaveLength(0);
  });

  it("counts idle time from her last touch of the bench", () => {
    const flag = { v: false };
    const r = rig(withDone(flag), { mode: "practice" });
    r.director.play();
    r.run(HINT_REPEAT_S - 2);
    r.bench.tapTerminal("E+");
    r.run(HINT_REPEAT_S - 2);
    expect(r.director.state.hint).toBe(0);
    r.run(4);
    expect(r.director.state.hint).toBe(1);
  });

  it("counts her writing in the notebook as activity, not idleness", () => {
    const flag = { v: false };
    const mine = { record: emptyOhmsLawRecord("practice") };
    const r: Rig = rig(withDone(flag), {
      mode: "practice",
      done: () => benchState(r.bench, mine.record),
    });
    r.director.play();
    r.run(HINT_REPEAT_S - 5);
    // She edits her notebook: the page hands back a new record object.
    mine.record = { ...mine.record, law_as_written: "Ohm's law" };
    r.run(HINT_REPEAT_S - 5);
    expect(r.director.state.hint).toBe(0);
    r.run(10);
    expect(r.director.state.hint).toBe(1);
  });

  describe("Show me and a lead she has half made", () => {
    const showMeBeat = () => leadBeat("a", { showMe: true, done: () => false });
    const leadsOf = (r: Rig) =>
      r.bench.visual.current.leads.map((l) => [l.a, l.b].sort().join("-"));

    it("puts down her pending terminal, so the lead made is the beat's and no other", () => {
      const r = rig(script(showMeBeat()), { mode: "practice" });
      r.director.play();
      r.bench.tapTerminal("A+");
      r.director.showMe();
      r.run(3);
      expect(leadsOf(r)).toEqual(["E+-K1"]);
      expect(r.bench.visual.current.pendingFrom).toBeNull();
    });

    it("still makes the lead when her pending terminal is the beat's first", () => {
      const r = rig(script(showMeBeat()), { mode: "practice" });
      r.director.play();
      r.bench.tapTerminal("E+");
      r.director.showMe();
      r.run(3);
      expect(leadsOf(r)).toEqual(["E+-K1"]);
      expect(r.bench.visual.current.pendingFrom).toBeNull();
    });

    it("does not finish a lead of its own if she tapped elsewhere between its two taps", () => {
      const r = rig(script(showMeBeat()), { mode: "practice" });
      r.director.play();
      r.director.showMe();
      // The first tap is at a quarter of the action (0.35 s of 1.4 s): E+ is now pending.
      r.run(0.5);
      expect(r.bench.visual.current.pendingFrom).toBe("E+");
      r.bench.tapTerminal("V+");
      r.run(3);
      expect(leadsOf(r)).toEqual(["E+-V+"]);
      expect(r.bench.visual.current.pendingFrom).toBeNull();
    });

    it("does nothing once her action is done and the beat is only waiting out its gap", () => {
      const flag = { v: false };
      const r = rig(script(leadBeat("a", { showMe: true, done: () => flag.v })), {
        mode: "practice",
      });
      r.director.play();
      flag.v = true;
      r.run(2 * DT);
      r.director.showMe();
      expect(r.director.state.hint).toBe(0);
      r.run(0.5);
      expect(r.bench.visual.current.leads).toHaveLength(0);
    });

    it("show me on a full terminal emits no lead event", () => {
      const r = rig(script(showMeBeat()), { mode: "practice" });
      // K1, the beat's second terminal, already takes as many leads as a nut holds (3).
      for (const other of ["A+", "V+", "V-"] as const) {
        r.bench.tapTerminal(other);
        r.bench.tapTerminal("K1");
      }
      expect(r.bench.visual.current.leads).toHaveLength(3);
      const kinds: string[] = [];
      r.director.onEvent((e) => kinds.push(e.kind));
      r.director.play();
      r.director.showMe();
      r.run(3);
      expect(r.bench.visual.current.leads).toHaveLength(3);
      expect(kinds).not.toContain("lead");
    });
  });

  it("Show me runs only on showMe beats", () => {
    const flag = { v: false };
    const r = rig(
      script(
        leadBeat("a", { done: () => flag.v }),
        leadBeat("b", { showMe: true, done: () => r.bench.visual.current.leads.length > 0 }),
      ),
      { mode: "practice" },
    );
    r.director.play();
    r.director.showMe();
    r.run(5);
    expect(r.bench.visual.current.leads).toHaveLength(0);
    expect(r.director.state.hint).toBe(0);
    flag.v = true;
    r.runUntil(() => r.director.state.beat === 1);
    r.director.showMe();
    expect(r.director.state.hint).toBe(3);
    r.run(3);
    expect(r.bench.visual.current.leads).toHaveLength(1);
    // Once per beat.
    r.director.showMe();
    r.run(3);
    expect(r.bench.visual.current.leads.length).toBeLessThanOrEqual(1);
  });

  it("Show me never performs a reading or a graph action", () => {
    const flag = { v: false };
    const r = rig(
      script(
        beat("read", "Read the ammeter.", {
          showMe: true,
          done: () => flag.v,
          act: {
            kind: "write",
            field: { kind: "cell", row: 0, col: "I" },
            value: { from: "ammeter" },
          },
        }),
      ),
      { mode: "practice" },
    );
    r.director.play();
    r.director.showMe();
    r.run(5);
    expect(r.director.state.hint).toBe(0);
    expect(r.director.state.act).toBeNull();
  });

  it("goes on to the end, and finishes", () => {
    const r = rig(script(beat("a", "Only."), beat("b", "Last.")), { mode: "practice" });
    r.director.play();
    r.runUntil(() => r.director.state.finished, 30);
  });
});

describe("Exam", () => {
  it("ignores beats: no voice, no actions, no hints, no caption", () => {
    const r = rig(script(leadBeat("a", { showMe: true, done: () => true })), { mode: "exam" });
    r.director.play();
    r.director.showMe();
    r.director.next();
    r.director.seek(0);
    r.run(120);
    const s = r.director.state;
    expect([s.beat, s.playing, s.caption, s.waiting, s.hint, s.finished, s.act]).toEqual([
      0,
      false,
      "",
      false,
      0,
      false,
      null,
    ]);
    expect(r.said).toEqual([]);
    expect(r.bench.visual.current.leads).toHaveLength(0);
  });
});

describe("lifecycle", () => {
  it("tells subscribers about discrete changes, and stops after unsubscribe and dispose", () => {
    const r = rig(script(beat("a", "One."), beat("b", "Two.")));
    const fn = vi.fn();
    const off = r.director.subscribe(fn);
    r.director.play();
    expect(fn).toHaveBeenCalled();
    fn.mockClear();
    off();
    r.director.pause();
    expect(fn).not.toHaveBeenCalled();
    r.director.dispose();
    r.director.play();
    r.run(5);
    expect(r.director.state.playing).toBe(false);
  });

  it("an empty script is harmless", () => {
    const r = rig(script());
    r.director.play();
    r.run(1);
    r.director.next();
    r.director.seek(3);
    expect(r.director.state.beat).toBe(0);
  });
});
