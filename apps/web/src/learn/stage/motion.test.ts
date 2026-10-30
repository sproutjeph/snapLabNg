import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAGRAM_LEADS, demoSeedFor } from "@snaplab/engine";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ROUTE_POINTS, routeCable } from "../../apparatus/ohms-law/Lead";
import { BENCH_FOOTPRINTS, CABLE_SEAT_M } from "../../apparatus/ohms-law/LeadParts";
import { LEAD_REST, NUT_SEAT_M, nutFoot } from "../../apparatus/ohms-law/layout";
import { fitShot, LOOK_DISTANCE_M, LOOK_ELEVATION_DEG } from "../../scene/look/LookCamera";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { OHMS_LAW_SCRIPT } from "../lessons/ohms-law/script";
import { emptyOhmsLawRecord } from "../readings/record";
import { createDirector } from "../script/createDirector";
import {
  BEAT_GAP_S,
  ENTER_DROP_S,
  ENTER_STAGGER_S,
  LEAD_S,
  LEAD_TAP_AT,
  NIB_TRAVEL_S,
} from "../script/timing";
import type { Script } from "../script/types";
import LessonShell, { type LessonShellProps, type StepStatus } from "../shell/LessonShell";
import type { BenchState, TerminalId } from "../types";
import type { VoiceGuide } from "../voice/types";
import { createOhmsLawBench } from "../wiring/bench";
import { bigHitRadius, HIT_NEIGHBOUR_SHARE } from "../wiring/TerminalMarks";
import { watchWrongTaps } from "../wiring/wrongTap";
import { BenchTools } from "./BenchTools";
import {
  actTaps,
  DROP_HEIGHT_M,
  type DropPose,
  dropAt,
  dropStartS,
  ENTRANCE_DELAY_S,
  ENTRANCE_MAX_S,
  entranceEndS,
  entranceOrder,
  fullEntranceEndS,
  inOutCubic,
  LEAD_DRAW_S,
  leadBeatS,
  leadDropStartS,
  MAX_TWEEN_S,
  PLUG_TAP_AT,
  STAGE_TWEENS,
  shakeAt,
  springStep,
} from "./motion";
import { BENCH_DRAG_DEG, BENCH_SHOT, spanAtAzimuth } from "./shots";
import { chipSpecAt, createEntrance, DROP_SLOTS, entranceFrame, stageBusy } from "./stageMotion";

// Watch and Practise motion on the live stage (docs/plans/wave-2-lean.md, 2b-motion). No textbook
// source: BC101's measured pace ("What we learned" 3) and screen choices, not science.

const DEG = Math.PI / 180;

/** The bench shot's camera, placed and fitted as LookCamera places it at rest, on a laptop. */
function benchCamera(width = 1373, height = 900) {
  const covered = { left: 0, right: 0, top: 60, bottom: 60 };
  const az = (BENCH_SHOT.azimuthDeg ?? 0) * DEG;
  const el = LOOK_ELEVATION_DEG * DEG;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const [fx, fy, fz] = BENCH_SHOT.focus;
  cam.position.set(
    fx + Math.sin(az) * Math.cos(el) * LOOK_DISTANCE_M,
    fy + Math.sin(el) * LOOK_DISTANCE_M,
    fz + Math.cos(az) * Math.cos(el) * LOOK_DISTANCE_M,
  );
  cam.lookAt(fx, fy, fz);
  const f = fitShot(BENCH_SHOT.spanM, covered, width, height, az, {
    halfW: 1,
    halfH: 1,
    offsetX: 0,
    offsetY: 0,
  });
  cam.left = -f.halfW;
  cam.right = f.halfW;
  cam.top = f.halfH;
  cam.bottom = -f.halfH;
  cam.setViewOffset(width, height, f.offsetX, f.offsetY, width, height);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return { cam, height };
}

/** The lowest screen point (CSS px from the top, so larger is lower) of a part's footprint. */
function lowestPx(slot: string, cam: THREE.Camera, height: number): number {
  let low = Number.NEGATIVE_INFINITY;
  const v = new THREE.Vector3();
  for (const f of BENCH_FOOTPRINTS) {
    if (f.slot !== slot) continue;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        v.set(f.cx + sx * f.hx, 0, f.cz + sz * f.hz).project(cam);
        low = Math.max(low, ((1 - v.y) / 2) * height);
      }
  }
  return low;
}

describe("the leads' entrance and the plug's tap (docs/plans/beauty-pass.md B2)", () => {
  it("leads drop one by one after the parts, and the entrance ends within 7 s", () => {
    const parts = DROP_SLOTS.length;
    const leads = LEAD_REST.length;
    // The first lead leaves the sky only once the last part has landed.
    expect(leadDropStartS(0, parts)).toBeGreaterThanOrEqual(entranceEndS(parts));
    for (let j = 1; j < leads; j++) {
      // One by one: each starts after the one before, never with it.
      expect(leadDropStartS(j, parts) - leadDropStartS(j - 1, parts)).toBeGreaterThan(0.1);
    }
    expect(fullEntranceEndS(parts, leads)).toBeLessThanOrEqual(ENTRANCE_MAX_S);
    expect(ENTRANCE_MAX_S).toBe(7);
  });

  it("under the paper, lays the leads only once every part is down, then lands them all", () => {
    const e = createEntrance();
    e.on = true;
    const parts = Object.fromEntries(DROP_SLOTS.map((s) => [s, { heightM: 0, k: 0 }])) as Record<
      (typeof DROP_SLOTS)[number],
      DropPose
    >;
    const leads: DropPose[] = LEAD_REST.map(() => ({ heightM: 0, k: 0 }));
    const order = entranceOrder(DROP_SLOTS);
    let t = 0;
    while (t < entranceEndS(DROP_SLOTS.length) - 0.05) {
      entranceFrame(e, order, 1 / 60, parts, leads);
      t += 1 / 60;
      expect(leads.every((l) => l.k === 0)).toBe(true);
    }
    for (let i = 0; i < 60 * 8; i++) entranceFrame(e, order, 1 / 60, parts, leads);
    expect(leads.every((l) => l.k === 1)).toBe(true);
    expect(e.landed).toBe(true);
  });

  it("a plug beat taps the nib once, as the plug moves; the key once; a lead twice", () => {
    const taps = (kind: string) => {
      let n = 0;
      let last = 0;
      for (let i = 0; i <= 100; i++) {
        const due = actTaps(kind, i / 100);
        if (due > last) n += due - last;
        last = due;
      }
      return n;
    };
    expect(taps("plug")).toBe(1);
    expect(taps("key")).toBe(1);
    expect(taps("lead")).toBe(2);
    expect(taps("loupe")).toBe(0);
    // The plug's tap comes after the nib has travelled to the box.
    expect(actTaps("plug", PLUG_TAP_AT - 0.01)).toBe(0);
    expect(actTaps("plug", PLUG_TAP_AT)).toBe(1);
  });
});

describe("the entrance", () => {
  it("the entrance drops parts lowest on screen first, 0.10 s apart", () => {
    const order = entranceOrder(DROP_SLOTS);
    expect([...order].sort()).toEqual([...DROP_SLOTS].sort());
    // Checked against the real bench shot: each part's footprint reaches no lower on screen
    // than the one before it.
    const { cam, height } = benchCamera();
    const lows = order.map((s) => lowestPx(s, cam, height));
    for (let i = 1; i < lows.length; i++) {
      expect(lows[i]).toBeLessThanOrEqual((lows[i - 1] ?? 0) + 1e-6);
    }
    // The series row stands nearest her (layout v4): its four parts drop first, then the wire
    // board, and the voltmeter behind it last.
    expect(order.slice(0, 4).sort()).toEqual(["ammeter", "box", "cells", "key"]);
    expect(order.slice(4)).toEqual(["wire", "voltmeter"]);
    // 0.9 s after Watch starts, then 0.10 s apart.
    expect(dropStartS(0)).toBeCloseTo(ENTRANCE_DELAY_S, 9);
    expect(ENTRANCE_DELAY_S).toBe(0.9);
    for (let i = 1; i < order.length; i++) {
      expect(dropStartS(i) - dropStartS(i - 1)).toBeCloseTo(0.1, 9);
    }
    expect(ENTER_STAGGER_S).toBe(0.1);
  });

  it("drops each part 2.2 BC101 units (0.22 m) with a 0.4 s bounce, hidden until it starts", () => {
    expect(DROP_HEIGHT_M).toBeCloseTo(0.22, 9);
    const pose: DropPose = { heightM: 0, k: 0 };
    dropAt(dropStartS(2) - 0.01, 2, pose);
    expect(pose.k).toBe(0);
    expect(pose.heightM).toBeCloseTo(DROP_HEIGHT_M, 9);
    dropAt(dropStartS(2) + ENTER_DROP_S / 2, 2, pose);
    expect(pose.k).toBeCloseTo(0.5, 9);
    expect(pose.heightM).toBeLessThan(DROP_HEIGHT_M);
    dropAt(dropStartS(2) + ENTER_DROP_S + 1e-6, 2, pose);
    expect(pose.k).toBe(1);
    expect(pose.heightM).toBeCloseTo(0, 9);
  });
});

/** A voice that ends each line `afterS` seconds of test time after it starts. */
function timedVoice(afterS: number) {
  let pending: { at: number; end: () => void } | null = null;
  let now = 0;
  const voice: VoiceGuide = {
    say(_t, o) {
      if (o?.onEnd) pending = { at: now + afterS, end: o.onEnd };
    },
    stop() {
      pending = null;
    },
    speaking: false,
    muted: false,
    rate: 0.95,
  };
  const tick = (t: number) => {
    now = t;
    if (pending && now >= pending.at - 1e-9) {
      const p = pending;
      pending = null;
      p.end();
    }
  };
  return { voice, tick };
}

const LONG_SAY = Array.from({ length: 80 }, () => "word").join(" ");

function leadScript(): Script {
  return {
    lessonId: "ohms_law_vi",
    shots: [{ id: "bench", focus: [0, 0, 0], spanM: 1 }],
    beats: [
      {
        id: "lead",
        stage: "connect",
        say: LONG_SAY,
        instruct: "",
        shot: "bench",
        act: { kind: "lead", from: "E+", to: "K1" },
      },
      { id: "after", stage: "connect", say: "", instruct: "", shot: "bench" },
    ],
  };
}

describe("a lead beat", () => {
  it("a lead beat's step length is max(narration, 0.6 + 1.0) s", () => {
    // The step is the lead's own: from the moment it starts to draw (the nib's second tap) to
    // the next beat. Narration runs from the beat's start, alongside the nib.
    expect(LEAD_DRAW_S).toBeCloseTo(0.6, 9);
    expect(BEAT_GAP_S).toBe(1);
    const DT = 1 / 240;
    for (const narrationS of [0, 0.5, 1.6, 2.4, 5]) {
      const bench = createOhmsLawBench(demoSeedFor(7));
      const { voice, tick } = timedVoice(narrationS);
      const record = emptyOhmsLawRecord("practice");
      const director = createDirector({
        script: leadScript(),
        voice,
        mode: "watch",
        bench,
        benchState: (): BenchState => ({
          comparison: bench.comparison,
          keyClosed: false,
          boxSettingOhm: 0,
          record,
          identified: new Set(),
        }),
      });
      director.play();
      let t = 0;
      let drawFrom: number | null = null;
      while (director.state.beat === 0 && t < 30) {
        t += DT;
        tick(t);
        bench.advance(DT);
        director.advance(DT);
        if (drawFrom === null && bench.visual.current.leads.length === 1) drawFrom = t;
      }
      expect(drawFrom).not.toBeNull();
      expect(drawFrom ?? 0).toBeCloseTo(LEAD_S * LEAD_TAP_AT[1], 1);
      const step = t - (drawFrom ?? 0);
      expect(Math.abs(step - Math.max(narrationS, LEAD_DRAW_S + BEAT_GAP_S))).toBeLessThan(0.02);
      // The same, counted from the beat's start (motion.ts).
      expect(Math.abs(t - leadBeatS(narrationS))).toBeLessThan(0.02);
      director.dispose();
    }
  });

  it("draws the lead with an inOut cubic, from nothing to whole", () => {
    expect(inOutCubic(0)).toBe(0);
    expect(inOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(inOutCubic(1)).toBe(1);
    expect(inOutCubic(0.1)).toBeLessThan(0.1);
    expect(inOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("the stage's tweens", () => {
  it("no tween exceeds 0.4 s except the lead draw", () => {
    expect(MAX_TWEEN_S).toBe(0.4);
    for (const [name, s] of Object.entries(STAGE_TWEENS)) {
      if (name === "leadDraw") continue;
      expect(s, name).toBeLessThanOrEqual(MAX_TWEEN_S + 1e-9);
    }
    expect(STAGE_TWEENS.leadDraw).toBeCloseTo(0.6, 9);
    expect(ENTER_DROP_S).toBeLessThanOrEqual(MAX_TWEEN_S);
    expect(NIB_TRAVEL_S).toBeLessThanOrEqual(MAX_TWEEN_S);
    // The shake lasts 0.3 s and ends at rest.
    expect(STAGE_TWEENS.shake).toBeCloseTo(0.3, 9);
    expect(shakeAt(0.3)).toBe(0);
    expect(shakeAt(-0.1)).toBe(0);
    expect(Math.abs(shakeAt(0.025))).toBeGreaterThan(0);
  });

  it("springs the chip onto its anchor within BC101's 0.35 s", () => {
    const s = { x: 0, v: 0 };
    let t = 0;
    while (t < 0.35) {
      springStep(s, 300, 1 / 60);
      t += 1 / 60;
    }
    expect(Math.abs(s.x - 300)).toBeLessThan(3);
  });
});

describe("the bench shot's drag", () => {
  it("turns at most ±8° and keeps the bench's size on screen while it turns", () => {
    expect(BENCH_DRAG_DEG).toBe(8);
    const covered = { left: 0, right: 0, top: 60, bottom: 60 };
    const base = BENCH_SHOT.azimuthDeg ?? 0;
    const f = { halfW: 1, halfH: 1, offsetX: 0, offsetY: 0 };
    const want = fitShot(BENCH_SHOT.spanM, covered, 1373, 900, base * DEG, f).halfW;
    for (const d of [-8, -4, 4, 8]) {
      const span = spanAtAzimuth(BENCH_SHOT, base + d, covered, 1373, 900);
      const got = fitShot(span, covered, 1373, 900, (base + d) * DEG, f).halfW;
      expect(got / want).toBeCloseTo(1, 3);
    }
  });
});

describe("Practise feel", () => {
  it("gives a far nut a bigger target than 44 px, and never reaches the next nut", () => {
    const mPerPx = 0.0008;
    expect(2 * bigHitRadius(mPerPx, 1)).toBeGreaterThan(44 * mPerPx);
    expect(bigHitRadius(0.01, 0.062)).toBeLessThanOrEqual(0.062 * HIT_NEIGHBOUR_SHARE);
    expect(2 * HIT_NEIGHBOUR_SHARE).toBeLessThan(1);
  });

  it("speaks a correction, with no digits, for a wrong lead and none for a right one", () => {
    const bench = createOhmsLawBench(7);
    const heard: Array<{ line: string; ends: readonly [TerminalId, TerminalId] }> = [];
    const off = watchWrongTaps(bench, {
      expected: () => ["E+", "K1"],
      onWrong: (line, ends) => heard.push({ line, ends }),
    });
    bench.tapTerminal("E+");
    bench.tapTerminal("K1");
    expect(heard).toEqual([]);
    bench.tapTerminal("E+");
    bench.tapTerminal("E-");
    expect(heard.length).toBe(1);
    expect(heard[0]?.ends).toEqual(["E+", "E-"]);
    expect(heard[0]?.line).not.toMatch(/\d/);
    // She takes the wrong lead off, then undoes that: the same lead comes back, but it is not a
    // new tap, so nothing is said again.
    const wrong = bench.visual.current.leads.find((l) => l.a === "E+" && l.b === "E-");
    expect(wrong).toBeDefined();
    bench.removeLead(wrong?.id ?? "");
    bench.undo();
    expect(bench.visual.current.leads.some((l) => l.id === wrong?.id)).toBe(true);
    expect(heard.length).toBe(1);
    // An undo that takes a lead away is not a tap either.
    bench.undo();
    expect(heard.length).toBe(1);
    off();
  });
});

describe("the bench tools", () => {
  const stage = createElement("div", { className: "stage-under-test" }, "bench");
  const props = (over: Partial<LessonShellProps>): LessonShellProps => ({
    lesson: OHMS_LAW_LESSON,
    mode: "practice",
    stepIndex: 0,
    onStepChange: () => {},
    stepStatus: OHMS_LAW_LESSON.steps.map(() => "todo" as StepStatus),
    tab: "instructions",
    onTabChange: () => {},
    children: stage,
    tools: createElement(BenchTools, { onGraph: () => {}, onUndo: () => {}, onReset: () => {} }),
    ...over,
  });

  it("render inside the shell's Tools pop-up, not over the stage", () => {
    const open = renderToStaticMarkup(createElement(LessonShell, props({ activePopup: "tools" })));
    const canvas = open.slice(open.indexOf('class="sh-canvas"'), open.indexOf("sh-callout-layer"));
    expect(canvas).toContain("stage-under-test");
    expect(canvas).not.toContain("Undo lead");
    const sheet = open.slice(open.indexOf("sh-sheet-tools"));
    expect(sheet).toContain("Graph paper");
    expect(sheet).toContain("Undo lead");
    expect(sheet).toContain("Reset bench");
    // Closed, nothing of them is on the page at all.
    const closed = renderToStaticMarkup(createElement(LessonShell, props({ activePopup: null })));
    expect(closed).not.toContain("Undo lead");
  });

  it("are no longer laid over the stage by the live page", () => {
    const src = readFileSync(join(__dirname, "..", "LearnPage.tsx"), "utf8");
    expect(src).not.toMatch(/className="ol-tools"/);
    expect(src).toMatch(/tools=\{/);
  });
});

describe("the frameloop while a director plays", () => {
  it("keeps the loop awake through a playing Practise narration beat, and lets it rest when paused", () => {
    // A narration-only Practise beat has no rings, no chip spring and nothing moving: only the
    // director's clock, which runs in advance() each frame, moves it on (and the hint ladder).
    expect(stageBusy({ mode: "practice", playing: true, finished: false }, 0, false, false)).toBe(
      true,
    );
    expect(stageBusy({ mode: "watch", playing: true, finished: false }, 0, false, false)).toBe(
      true,
    );
    expect(stageBusy({ mode: "practice", playing: false, finished: false }, 0, false, false)).toBe(
      false,
    );
    expect(stageBusy({ mode: "practice", playing: true, finished: true }, 0, false, false)).toBe(
      false,
    );
    expect(stageBusy({ mode: "exam", playing: true, finished: false }, 0, false, false)).toBe(
      false,
    );
    expect(stageBusy({ mode: "practice", playing: false, finished: false }, 2, false, false)).toBe(
      true,
    );
  });
});

describe("the callout chip after a seek", () => {
  it("shows the stage's last callout up to that beat, worked out from the script", () => {
    const beats = OHMS_LAW_SCRIPT.beats;
    const at = (id: string) => beats.findIndex((b) => b.id === id);
    // rule-write has no callout of its own: the stage's rule-open callout carries on.
    expect(chipSpecAt(beats, at("rule-write"))?.label).toBe(
      beats[at("rule-open")]?.callouts?.[0]?.label,
    );
    // A new stage with no callout yet shows none (the headings follow the leads).
    expect(chipSpecAt(beats, at("head-R"))).toBeNull();
    // The same answer from wherever playing came from: it is a function of the beat alone.
    expect(chipSpecAt(beats, at("row-1-i"))?.label).toBe("AMMETER, A");
  });
});

describe("the leads round the meters", () => {
  // Where each nut's top is: layout v4's own account of its nuts (layout.ts nutFoot), raised to
  // where the terminal registry seats a plug (TerminalNut NUT_TOP_M), for the wire at the left and
  // right ends of the rule and in the middle (the engine lays it from 1 to 99 cm).
  const WIRES = [
    { startCm: 1, lengthCm: 46 },
    { startCm: 25, lengthCm: 60 },
    { startCm: 53, lengthCm: 46 },
  ];
  const cases = BENCH_FOOTPRINTS.filter(
    (f) => (f.slot === "ammeter" || f.slot === "voltmeter") && f.top > 0.05,
  );

  it("never lays a diagram lead over a meter's case (its dial), whichever end she taps first", () => {
    for (const wire of WIRES) {
      const seat = (id: TerminalId) => {
        const [x, y, z] = nutFoot(id, wire);
        return new THREE.Vector3(x, y + NUT_SEAT_M + CABLE_SEAT_M, z);
      };
      for (const [a, b] of DIAGRAM_LEADS) {
        for (const [from, to] of [
          [a, b],
          [b, a],
        ] as const) {
          for (const bulge of [-1, 0, 1]) {
            const routed = Array.from({ length: ROUTE_POINTS }, () => new THREE.Vector3());
            const plain = Array.from({ length: 11 }, () => new THREE.Vector3());
            const pts = routeCable(routed, plain, from, to, seat(from), seat(to), bulge)
              ? routed
              : plain;
            expect(pts[0]?.distanceTo(seat(from)), `${from}`).toBeCloseTo(0, 9);
            expect(pts[pts.length - 1]?.distanceTo(seat(to)), `${to}`).toBeCloseTo(0, 9);
            const path = new THREE.CatmullRomCurve3(pts, false, "centripetal").getPoints(200);
            for (const p of path) {
              for (const f of cases) {
                const inside = Math.abs(p.x - f.cx) < f.hx && Math.abs(p.z - f.cz) < f.hz;
                expect(inside, `${from}→${to} bulge ${bulge} over the ${f.slot}`).toBe(false);
              }
            }
          }
        }
      }
    }
  });
});
