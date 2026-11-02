import { DIAGRAM_LEADS } from "@snaplab/engine";
import type { Beat, Script } from "../../script/types";
import type { PartId } from "../../types";
import { LEAD_CHIPS, OHMS_LAW_RESISTANCES, OHMS_LAW_SHOTS, TERMINAL_PART } from "./script";

// The guided demonstration (?practical=ohms-law&mode=guided; docs/plans/guided-demo.md): the same
// practical as Watch's script, told in about two minutes. Readings rows 1 and 2 are shown beat by
// beat; rows 3 to 7 are one quick beat each (the `row` action); points 1 and 2 are narrated and
// 3 to 7 are quick. Precautions, the law and the length are not separate stages here: they close
// the demonstration as the conclusion. Captions are at most 18 words. Narration carries no bench
// value except the demonstration's own slope, through the `{slope}` token the director fills in
// once the actor has written it. Watch's own script (script.ts) is untouched.

/** The hold after an ordinary guided beat, after a quick one, and after a conclusion line. */
const GAP_S = 0.35;
const QUICK_GAP_S = 0.15;
const CONCLUSION_GAP_S = 0.6;
/** The hold after an identify beat: its tag is read in this time and the voice's. */
const IDENTIFY_GAP_S = 0.4;

/** R as a word, for the voice. */
const OHM_WORDS: Readonly<Record<number, string>> = {
  0: "zero",
  1: "one",
  5: "five",
  10: "ten",
  20: "twenty",
  40: "forty",
  60: "sixty",
};

/**
 * Ohm's law, as the conclusion states it (WAEC expected answer; Nelkon & Parker, A Level
 * Physics): the current in a metallic conductor is directly proportional to the potential
 * difference across it, provided the temperature and other physical conditions stay constant.
 */
const LAW_LINE =
  "This is Ohm's law: the current in a metallic conductor is directly proportional to the potential difference across it, provided the temperature and other physical conditions stay constant.";

/**
 * The lines that close the demonstration, in order, for the end panel. `slope` is the number the
 * demonstration wrote for s (`slopeNumber`), null before it has.
 */
export function guidedConclusionLines(slope: string | null): string[] {
  return [
    "V rises in step with I: the points lie on a straight line through the origin, so V is proportional to I.",
    LAW_LINE,
    `The slope s = ΔV/ΔI is the resistance of wire XY: about ${slope ?? "…"} Ω.`,
    "Precautions: the key was opened between readings, and the meters were read with the eye directly above the pointer to avoid parallax.",
    // (b)(ii): A = πd²/4 = 3.143 × 10⁻⁸ m² (d = 0.2 mm, π = 22/7); L = RA/ρ with R = 7 Ω and
    // ρ = 8.8 × 10⁻⁷ Ω m. Like Watch's LENGTH_CALC it stops before the answer: the expected
    // result is never shown before hand-in (AGENTS.md).
    "(b)(ii) L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷): work out the length yourself.",
  ];
}

interface Spec {
  id: string;
  stage: string;
  /** The caption. */
  say: string;
  spoken?: string | undefined;
  act?: Beat["act"];
  gapS?: number;
  focus?: Beat["focus"];
  callouts?: Beat["callouts"];
  tags?: Beat["tags"];
}

/** A guided beat: Practise never plays it, so `instruct` repeats the caption. */
const beat = (s: Spec): Beat => ({
  id: s.id,
  stage: s.stage,
  say: s.say,
  instruct: s.say,
  shot: "bench",
  gapS: s.gapS ?? GAP_S,
  ...(s.spoken !== undefined ? { spoken: s.spoken } : {}),
  ...(s.act ? { act: s.act } : {}),
  ...(s.focus ? { focus: s.focus } : {}),
  ...(s.callouts ? { callouts: s.callouts } : {}),
  ...(s.tags ? { tags: s.tags } : {}),
});

/**
 * Identify, part by part (docs/plans/guided-demo.md): for each part the camera eases to it
 * (learn/stage/shots.ts IDENTIFY_SHOT_NAMES, the shot named by the beat's id) and a tag beside it
 * names it with one plain line. The voice says only the name, about two seconds a part; the tag
 * carries the line to read. A last beat shows every tag at once on the whole bench.
 */
interface IdentifySpec {
  id: string;
  part: PartId;
  /** The caption. */
  say: string;
  /** What the voice says when it differs from the caption. */
  spoken?: string;
  /** The tag's name, and the one plain line under it. */
  label: string;
  line: string;
}

const IDENTIFY_PARTS: readonly IdentifySpec[] = [
  {
    id: "id-cells",
    part: "cells",
    say: "Cells, E.",
    label: "CELLS, E",
    line: "Cells E: drive the current.",
  },
  {
    id: "id-key",
    part: "key",
    say: "Plug key, K.",
    label: "PLUG KEY, K",
    line: "Plug key K: opens and closes the circuit.",
  },
  {
    id: "id-ammeter",
    part: "ammeter",
    say: "Ammeter, A.",
    label: "AMMETER, A",
    line: "Ammeter A: measures the current; it goes in series.",
  },
  {
    id: "id-voltmeter",
    part: "voltmeter",
    say: "Voltmeter, V.",
    label: "VOLTMETER, V",
    line: "Voltmeter V: measures the p.d. across XY; it goes in parallel.",
  },
  {
    id: "id-box",
    part: "box",
    say: "Resistance box, R.",
    label: "RESISTANCE BOX, R",
    line: "Resistance box R: sets the resistance in the circuit.",
  },
  {
    id: "id-wire",
    part: "wire",
    say: "Wire XY.",
    spoken: "Wire X Y.",
    label: "WIRE XY",
    line: "Wire XY: the resistance wire under test, on a metre rule.",
  },
  {
    id: "id-leads",
    part: "leads",
    say: "Connecting leads.",
    label: "LEADS",
    line: "Leads: join the parts.",
  },
];

/** Every part's name, for the beat that shows them together. */
const ALL_TAGS: NonNullable<Beat["tags"]> = IDENTIFY_PARTS.map((p) => ({
  anchor: p.part,
  label: p.label,
  kind: "name",
}));

function identifyBeats(): Beat[] {
  const parts = IDENTIFY_PARTS.map((p, i) =>
    beat({
      id: p.id,
      stage: "identify",
      say: p.say,
      ...(p.spoken !== undefined ? { spoken: p.spoken } : {}),
      gapS: IDENTIFY_GAP_S,
      // The first beat sets the bench: every part drops in (a replay shows it; after the paper
      // they are already down).
      ...(i === 0
        ? {
            act: {
              kind: "enter" as const,
              parts: ["cells", "key", "ammeter", "voltmeter", "box", "wire"] as PartId[],
            },
          }
        : {}),
      tags: [{ anchor: p.part, label: p.label, sub: p.line, kind: "name" }],
      focus: [p.part],
    }),
  );
  return [
    ...parts,
    beat({
      id: "id-all",
      stage: "identify",
      say: "The whole apparatus.",
      gapS: IDENTIFY_GAP_S,
      tags: ALL_TAGS,
    }),
  ];
}

function measureBeats(): Beat[] {
  return [
    beat({
      id: "rule-open",
      stage: "measure-xy",
      say: "Measure XY with the metre rule.",
      act: { kind: "loupe", target: "rule" },
      focus: ["wire"],
      callouts: [
        { anchor: "wire", label: "RESISTANCE WIRE XY", sub: "Read from X to Y", kind: "do" },
      ],
    }),
    beat({
      id: "rule-write",
      stage: "measure-xy",
      say: "Record XY in centimetres.",
      spoken: "Record XY.",
      act: { kind: "write", field: { kind: "length" }, value: { from: "rule" } },
      focus: ["wire"],
    }),
    beat({
      id: "rule-close",
      stage: "measure-xy",
      say: "Now connect the circuit.",
      spoken: "",
      gapS: QUICK_GAP_S,
      act: { kind: "loupe", target: null },
    }),
  ];
}

const LEAD_SAY: readonly string[] = [
  "Cells positive to the key.",
  "Key to the ammeter, in series.",
  "Ammeter negative to the box.",
  "Box to end X of the wire.",
  "End Y back to the cells.",
  "Voltmeter positive to X.",
  "Voltmeter negative to Y: circuit complete.",
];

function connectBeats(): Beat[] {
  return DIAGRAM_LEADS.map(([from, to], i) =>
    beat({
      id: `lead-${i + 1}`,
      stage: "connect",
      say: LEAD_SAY[i] ?? "Connect the next lead.",
      act: { kind: "lead", from, to },
      focus: [TERMINAL_PART[from], TERMINAL_PART[to]],
      callouts: [{ anchor: from, label: LEAD_CHIPS[`${from}>${to}`] ?? "CONNECT", kind: "do" }],
    }),
  );
}

function headBeats(): Beat[] {
  const heads = [
    { col: "R", text: "R/Ω", say: "Table headings: R, I and V, with units.", quiet: false },
    { col: "I", text: "I/A", say: "I in amperes.", quiet: true },
    { col: "V", text: "V/V", say: "V in volts.", quiet: true },
  ] as const;
  return heads.map((h) =>
    beat({
      id: `head-${h.col}`,
      stage: "r0",
      say: h.say,
      ...(h.quiet ? { spoken: "", gapS: QUICK_GAP_S } : {}),
      act: { kind: "write", field: { kind: "header", col: h.col }, value: { text: h.text } },
    }),
  );
}

/** One row, beat by beat (rows 1 and 2). */
function detailedRow(row: number, ohm: number): Beat[] {
  const stage = row === 0 ? "r0" : "r1";
  const r = `row-${row + 1}`;
  const unit = ohm === 1 ? "ohm" : "ohms";
  return [
    beat({
      id: `${r}-plug`,
      stage,
      say: ohm === 0 ? "R = 0 Ω: every plug in." : `R = ${ohm} Ω.`,
      spoken: ohm === 0 ? "R is zero: every plug in." : `R is ${OHM_WORDS[ohm] ?? ohm} ${unit}.`,
      act: { kind: "plug", ohm },
      focus: ["box"],
      callouts: [{ anchor: "box", label: `RESISTANCE BOX, R = ${ohm} Ω`, kind: "do" }],
    }),
    beat({
      id: `${r}-r`,
      stage,
      say: "Write R.",
      act: { kind: "write", field: { kind: "cell", row, col: "R" }, value: { text: String(ohm) } },
      focus: ["box"],
    }),
    beat({
      id: `${r}-key-on`,
      stage,
      say: "Close the key.",
      act: { kind: "key", closed: true },
      focus: ["key", "ammeter", "voltmeter"],
      callouts: [{ anchor: "key", label: "PLUG KEY, K", sub: "Close the key", kind: "do" }],
    }),
    beat({
      id: `${r}-i-loupe`,
      stage,
      say: "Read the ammeter.",
      act: { kind: "loupe", target: "ammeter" },
      focus: ["ammeter"],
      callouts: [
        { anchor: "ammeter", label: "AMMETER, A", sub: "Reads the current I", kind: "reading" },
      ],
    }),
    beat({
      id: `${r}-i`,
      stage,
      say: "Record I.",
      act: { kind: "write", field: { kind: "cell", row, col: "I" }, value: { from: "ammeter" } },
      focus: ["ammeter"],
    }),
    beat({
      id: `${r}-v-loupe`,
      stage,
      say: "Read the voltmeter.",
      act: { kind: "loupe", target: "voltmeter" },
      focus: ["voltmeter"],
      callouts: [
        {
          anchor: "voltmeter",
          label: "VOLTMETER, V",
          sub: "Reads the voltage drop V across XY",
          kind: "reading",
        },
      ],
    }),
    beat({
      id: `${r}-v`,
      stage,
      say: "Record V.",
      act: { kind: "write", field: { kind: "cell", row, col: "V" }, value: { from: "voltmeter" } },
      focus: ["voltmeter"],
    }),
    beat({
      id: `${r}-key-off`,
      stage,
      say: "Open the key.",
      act: { kind: "key", closed: false },
      focus: ["key"],
      callouts: [{ anchor: "key", label: "PLUG KEY, K", sub: "Open the key", kind: "do" }],
    }),
  ];
}

/** One whole row in one quick beat (rows 3 to 7). */
function quickRow(row: number, ohm: number): Beat {
  return beat({
    id: `row-${row + 1}`,
    stage: "repeat",
    say: `R = ${ohm} Ω: I and V recorded.`,
    spoken: `R equals ${OHM_WORDS[ohm] ?? ohm} ohms.`,
    act: { kind: "row", row, ohm },
    gapS: QUICK_GAP_S,
    focus: ["box", "ammeter", "voltmeter"],
  });
}

function readingBeats(): Beat[] {
  const out: Beat[] = [];
  OHMS_LAW_RESISTANCES.forEach((ohm, row) => {
    if (row < 2) out.push(...detailedRow(row, ohm));
    else out.push(quickRow(row, ohm));
  });
  return out;
}

function plotBeats(): Beat[] {
  const out: Beat[] = [
    beat({
      id: "axis-x",
      stage: "plot",
      say: "Plot V against I.",
      act: { kind: "write", field: { kind: "graph", part: "axisX" }, value: { text: "I/A" } },
    }),
    beat({
      id: "axis-y",
      stage: "plot",
      say: "V up the page.",
      spoken: "",
      act: { kind: "write", field: { kind: "graph", part: "axisY" }, value: { text: "V/V" } },
      gapS: QUICK_GAP_S,
    }),
    beat({
      id: "scale-x",
      stage: "plot",
      say: "Scales: 2 cm to 0.1 A across, 1 cm to 0.2 V up.",
      spoken: "Choose the scales.",
      act: {
        kind: "write",
        field: { kind: "graph", part: "scaleX" },
        value: { text: "2 cm to 0.1 A" },
      },
    }),
    beat({
      id: "scale-y",
      stage: "plot",
      say: "1 cm to 0.2 V.",
      spoken: "",
      act: {
        kind: "write",
        field: { kind: "graph", part: "scaleY" },
        value: { text: "1 cm to 0.2 V" },
      },
      gapS: QUICK_GAP_S,
    }),
  ];
  OHMS_LAW_RESISTANCES.forEach((_, row) => {
    const n = row + 1;
    out.push(
      beat({
        id: `plot-${n}`,
        stage: "plot",
        say: n === 1 ? "Plot the first point." : `Point ${n}.`,
        spoken: n === 1 ? undefined : n === 2 ? "And the second." : "",
        act: { kind: "plot", row },
        gapS: n <= 2 ? GAP_S : QUICK_GAP_S,
      }),
    );
  });
  out.push(
    beat({
      id: "line",
      stage: "plot",
      say: "Draw the best-fit line.",
      act: { kind: "line" },
    }),
  );
  return out;
}

function slopeBeats(): Beat[] {
  return [
    beat({
      id: "triangle",
      stage: "slope",
      say: "Draw a large triangle.",
      act: { kind: "triangle" },
    }),
    beat({
      id: "delta-v",
      stage: "slope",
      say: "Read ΔV.",
      spoken: "Read delta V.",
      act: { kind: "write", field: { kind: "graph", part: "deltaY" }, value: { from: "rule" } },
    }),
    beat({
      id: "delta-i",
      stage: "slope",
      say: "Read ΔI.",
      spoken: "Read delta I.",
      act: { kind: "write", field: { kind: "graph", part: "deltaX" }, value: { from: "rule" } },
    }),
    beat({
      id: "slope",
      stage: "slope",
      say: "Slope s = ΔV/ΔI.",
      spoken: "Slope s equals delta V over delta I.",
      act: { kind: "write", field: { kind: "graph", part: "slope" }, value: { from: "rule" } },
    }),
  ];
}

/** The conclusion: what the demonstration shows, said and then shown on the end panel. */
function conclusionBeats(): Beat[] {
  const c = (id: string, say: string, spoken?: string): Beat =>
    beat({ id, stage: "law", say, spoken, gapS: CONCLUSION_GAP_S });
  return [
    c(
      "conclude-line",
      "V rises in step with I: a straight line through the origin, so V is proportional to I.",
      "A straight line through the origin: V is proportional to I.",
    ),
    c(
      "conclude-law",
      "Ohm's law: current in a metallic conductor is proportional to the p.d. across it, at constant temperature.",
      "Ohm's law: current is proportional to the potential difference, at constant temperature.",
    ),
    c(
      "conclude-slope",
      "The slope s = ΔV/ΔI is the resistance of wire XY: about {slope} Ω.",
      "The slope is the resistance of wire X Y: about {slope} ohms.",
    ),
    c(
      "conclude-precautions",
      "Precautions: key opened between readings; meters read with the eye above the pointer, avoiding parallax.",
      "Precautions: the key was opened between readings, and parallax was avoided.",
    ),
    c(
      "conclude-length",
      "(b)(ii) L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷). Work out L yourself.",
      "Part b two: the length is R A over rho. Work it out yourself.",
    ),
  ];
}

export const OHMS_LAW_GUIDED_SCRIPT: Script = {
  lessonId: "ohms_law_vi",
  shots: OHMS_LAW_SHOTS,
  beats: [
    ...identifyBeats(),
    ...measureBeats(),
    ...connectBeats(),
    ...headBeats(),
    ...readingBeats(),
    ...plotBeats(),
    ...slopeBeats(),
    ...conclusionBeats(),
  ],
};
