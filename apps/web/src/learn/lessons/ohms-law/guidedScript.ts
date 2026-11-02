import { DIAGRAM_LEADS } from "@snaplab/engine";
import { OHMS_LAW_QUESTION } from "../../paper/ohmsLawQuestion";
import { toSpoken } from "../../paper/readAloud";
import type { Beat, Script } from "../../script/types";
import type { PartId } from "../../types";
import { LEAD_CHIPS, OHMS_LAW_RESISTANCES, OHMS_LAW_SHOTS, TERMINAL_PART } from "./script";

// The guided demonstration (?practical=ohms-law&mode=guided; docs/plans/guided-demo.md, "Watch v2:
// the question drives the bench"): the question is read one sentence at a time and the bench does
// what each sentence says, alongside the voice.
//
// For each of the question's eleven steps (the lesson's eleven stages) the script has first the
// step's sentence, as one beat or a few clauses, each read aloud at a calm pace with its work
// starting at once (a lead drawn, the key closed, a plug pulled, a meter opened): the beat lasts
// as long as the longer of the voice and the work. Then the step's own short captions, which
// wait for the sentence to end so two voices never overlap, finish the work: the readings written,
// the points plotted, the slope worked, the precautions, the law and the working. Captions are at
// most 18 words. Narration carries no bench value except the demonstration's own slope, through
// the `{slope}` token the director fills in once the actor has written it. Watch's own script
// (script.ts) is untouched.

/** The hold after an ordinary guided beat, after a quick one, and after a conclusion line. */
const GAP_S = 0.35;
const QUICK_GAP_S = 0.15;
const CONCLUSION_GAP_S = 0.6;
/** The hold after an identify beat: its tag is read in this time and the voice's. */
const IDENTIFY_GAP_S = 0.4;
/** The pause after a question sentence, and between its clauses. */
export const SENTENCE_GAP_S = 0.6;
export const CLAUSE_GAP_S = 0.15;
/** The question is read at this share of the voice's pace: calm. */
export const READ_RATE_X = 0.85;
/**
 * After the first sentence the two parts it never names (the key and the wire XY) drop on the
 * timed drop, up to 1.8 s after the voice ends (stage/stageMotion.ts); the first part's tag waits.
 */
const FIRST_SENTENCE_GAP_S = 1;

/** The question's steps, in order: each is one lesson stage. */
export const GUIDED_STAGES = [
  "identify",
  "measure-xy",
  "connect",
  "r0",
  "r1",
  "repeat",
  "plot",
  "slope",
  "precautions",
  "law",
  "length",
] as const;

const Q = OHMS_LAW_QUESTION.instructions;

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

/** The two precautions the demonstration states (the reported tense, as lesson.ts has them). */
const PRECAUTIONS = [
  "The key was opened between readings.",
  "Each meter was read with the eye directly above the pointer, to avoid parallax.",
] as const;

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
  card?: Beat["card"];
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
  ...(s.card ? { card: s.card } : {}),
});

/**
 * Where in step `instr`'s printed sentence a clause starts: the first place `phrase` occurs
 * (the sentence's start when none is given).
 */
function charAt(instr: number, phrase?: string): number {
  if (phrase === undefined) return 0;
  const at = Q[instr]?.text.indexOf(phrase) ?? -1;
  if (at < 0) throw new Error(`"${phrase}" is not in step ${instr + 1}`);
  return at;
}

interface ReadSpec {
  id: string;
  /** The step: an index into the question's instructions. */
  instr: number;
  /** The clause is the sentence from here ... */
  from?: string;
  /** ... up to here (the sentence's end when none is given). */
  until?: string;
  /** The work that starts as the clause begins. */
  act?: Beat["act"];
  focus?: Beat["focus"];
  callouts?: Beat["callouts"];
  gapS?: number;
}

/**
 * A question beat: the voice reads this clause of the step's sentence (the paper marks it), at a
 * calm pace, and the beat's `act` starts as the voice does. It has no caption: the paper shows the
 * words. The pause after the sentence's last clause is longer than between clauses.
 */
function read(r: ReadSpec): Beat {
  const text = Q[r.instr]?.text ?? "";
  const from = charAt(r.instr, r.from);
  const to = r.until === undefined ? text.length : charAt(r.instr, r.until);
  const last = to === text.length;
  return {
    id: r.id,
    stage: GUIDED_STAGES[r.instr] ?? "identify",
    say: "",
    instruct: "",
    spoken: toSpoken(text.slice(from, to)).spoken,
    read: { instr: r.instr, from, to },
    rateX: READ_RATE_X,
    shot: "bench",
    gapS: r.gapS ?? (last ? SENTENCE_GAP_S : CLAUSE_GAP_S),
    ...(r.act ? { act: r.act } : {}),
    ...(r.focus ? { focus: r.focus } : {}),
    ...(r.callouts ? { callouts: r.callouts } : {}),
  };
}

/**
 * Step 1, then identify, part by part (docs/plans/guided-demo.md): the first sentence is read
 * while each part drops as it is named (the stage's entrance, driven by the paper's tracker); then
 * for each part the camera eases to it (learn/stage/shots.ts IDENTIFY_SHOT_NAMES, the shot named
 * by the beat's id) and a tag beside it names it with one plain line. The voice says only the
 * name, about two seconds a part; the tag carries the line to read. A last beat shows every tag
 * at once on the whole bench.
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
  const sentence: Beat = {
    ...read({
      id: "q1",
      instr: 0,
      // The six parts land here, as the sentence names them (the stage's entrance); a seek past
      // this beat finds them down. The key and the wire XY, which it never names, drop after it.
      act: { kind: "enter", parts: ["cells", "key", "ammeter", "voltmeter", "box", "wire"] },
      gapS: FIRST_SENTENCE_GAP_S,
    }),
  };
  const parts = IDENTIFY_PARTS.map((p) =>
    beat({
      id: p.id,
      stage: "identify",
      say: p.say,
      ...(p.spoken !== undefined ? { spoken: p.spoken } : {}),
      gapS: IDENTIFY_GAP_S,
      tags: [{ anchor: p.part, label: p.label, sub: p.line, kind: "name" }],
      focus: [p.part],
    }),
  );
  return [
    sentence,
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

/** Step 2: the rule opens as "Measure and record the length XY" begins; XY is written after. */
function measureBeats(): Beat[] {
  return [
    read({
      id: "q2",
      instr: 1,
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
      say: "The length XY is recorded.",
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

/**
 * Step 3: the first lead is drawn as "Connect the circuit as shown in the diagram." begins; the
 * other six follow, each with its short caption, and the diagram in the paper turns each line
 * from pencil to ink as its lead is made.
 */
function connectBeats(): Beat[] {
  return DIAGRAM_LEADS.map(([from, to], i) => {
    const focus = [TERMINAL_PART[from], TERMINAL_PART[to]];
    const callouts: Beat["callouts"] = [
      { anchor: from, label: LEAD_CHIPS[`${from}>${to}`] ?? "CONNECT", kind: "do" },
    ];
    if (i === 0) {
      return read({ id: "q3", instr: 2, act: { kind: "lead", from, to }, focus, callouts });
    }
    return beat({
      id: `lead-${i + 1}`,
      stage: "connect",
      say: LEAD_SAY[i] ?? "Connect the next lead.",
      act: { kind: "lead", from, to },
      focus,
      callouts,
    });
  });
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

/** The plug, key and meter work a reading sentence starts, clause by clause. */
function readingClauses(
  ohm: number,
  instr: number,
  ids: readonly [string, string, string],
  froms: readonly [string, string],
): Beat[] {
  const box = ["box"] as const;
  return [
    read({
      id: ids[0],
      instr,
      until: froms[0],
      act: { kind: "plug", ohm },
      focus: box,
      callouts: [{ anchor: "box", label: `RESISTANCE BOX, R = ${ohm} Ω`, kind: "do" }],
    }),
    read({
      id: ids[1],
      instr,
      from: froms[0],
      until: froms[1],
      act: { kind: "key", closed: true },
      focus: ["key", "ammeter", "voltmeter"],
      callouts: [{ anchor: "key", label: "PLUG KEY, K", sub: "Close the key", kind: "do" }],
    }),
    read({
      id: ids[2],
      instr,
      from: froms[1],
      act: { kind: "loupe", target: "ammeter" },
      focus: ["ammeter"],
      callouts: [
        { anchor: "ammeter", label: "AMMETER, A", sub: "Reads the current I", kind: "reading" },
      ],
    }),
  ];
}

/** What is written once the sentence is read: R, I, then the voltmeter and V, then the key opens. */
function rowWork(row: number, ohm: number, withHeads: boolean): Beat[] {
  const stage = row === 0 ? "r0" : "r1";
  const r = `row-${row + 1}`;
  return [
    ...(withHeads ? headBeats() : []),
    beat({
      id: `${r}-r`,
      stage,
      say: `Write R = ${ohm} Ω.`,
      spoken: `Write R.`,
      act: { kind: "write", field: { kind: "cell", row, col: "R" }, value: { text: String(ohm) } },
      focus: ["box"],
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
function quickRow(row: number, ohm: number, id = `row-${row + 1}`): Beat {
  return beat({
    id,
    stage: "repeat",
    say: `R = ${ohm} Ω: I and V recorded.`,
    spoken: `R equals ${OHM_WORDS[ohm] ?? ohm} ohms.`,
    act: { kind: "row", row, ohm },
    gapS: QUICK_GAP_S,
    focus: ["box", "ammeter", "voltmeter"],
  });
}

/** Steps 4, 5 and 6: R = 0, R = 1, then the five other values. */
function readingBeats(): Beat[] {
  const rows = OHMS_LAW_RESISTANCES;
  return [
    // 4: "With R = 0 Ω," pulls the plugs, "close the key K." closes it, "Read and record ..." opens
    // the ammeter; then the table is headed and the first row written.
    ...readingClauses(0, 3, ["q4-plug", "q4-key", "q4-read"], ["close", "Read"]),
    ...rowWork(0, rows[0], true),
    // 5: the same for R = 1 Ω.
    ...readingClauses(1, 4, ["q5-plug", "q5-key", "q5-read"], ["close", "read"]),
    ...rowWork(1, rows[1], false),
    // 6: the first two of the five other values are taken as the sentence is read; the rest follow.
    read({
      id: "q6-values",
      instr: 5,
      until: "Tabulate",
      act: { kind: "row", row: 2, ohm: rows[2] },
      focus: ["box", "ammeter", "voltmeter"],
    }),
    read({
      id: "q6-tabulate",
      instr: 5,
      from: "Tabulate",
      act: { kind: "row", row: 3, ohm: rows[3] },
      focus: ["box", "ammeter", "voltmeter"],
    }),
    quickRow(4, rows[4]),
    quickRow(5, rows[5]),
    quickRow(6, rows[6]),
  ];
}

/** Steps 7: V is headed as "Plot V (vertical)" is read, I as "against I (horizontal)" is. */
function plotBeats(): Beat[] {
  const out: Beat[] = [
    read({
      id: "q7-v",
      instr: 6,
      until: "against",
      act: { kind: "write", field: { kind: "graph", part: "axisY" }, value: { text: "V/V" } },
    }),
    read({
      id: "q7-i",
      instr: 6,
      from: "against",
      act: { kind: "write", field: { kind: "graph", part: "axisX" }, value: { text: "I/A" } },
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

/** Step 8: the triangle is drawn as "Determine the slope s." is read; the working follows. */
function slopeBeats(): Beat[] {
  return [
    read({ id: "q8", instr: 7, act: { kind: "triangle" } }),
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
    beat({
      id: "slope-meaning",
      stage: "slope",
      say: "The slope s = ΔV/ΔI is the resistance of wire XY: about {slope} Ω.",
      spoken: "The slope is the resistance of wire X Y: about {slope} ohms.",
      gapS: CONCLUSION_GAP_S,
    }),
  ];
}

/** Steps 9, (b)(i) and (b)(ii): read, then said and shown on a card of lines beside the paper. */
function closingBeats(): Beat[] {
  const precautions = "Two precautions";
  const law = "(b)(i) The law";
  const working = "(b)(ii) The working";
  const line = "V rises in step with I: the points lie on a straight line through the origin.";
  return [
    read({ id: "q9", instr: 8 }),
    beat({
      id: "prec-1",
      stage: "precautions",
      say: "Precaution one: the key was opened between readings.",
      spoken: "Precaution one: the key was opened between readings.",
      gapS: CONCLUSION_GAP_S,
      card: { title: precautions, lines: [PRECAUTIONS[0]] },
    }),
    beat({
      id: "prec-2",
      stage: "precautions",
      say: "Precaution two: each meter was read with the eye above the pointer.",
      spoken: "Precaution two: each meter was read with the eye directly above the pointer.",
      gapS: CONCLUSION_GAP_S,
      card: { title: precautions, lines: [...PRECAUTIONS] },
    }),
    read({ id: "qbi", instr: 9 }),
    beat({
      id: "law-line",
      stage: "law",
      say: "V rises in step with I: a straight line through the origin, so V is proportional to I.",
      spoken: "A straight line through the origin: V is proportional to I.",
      gapS: CONCLUSION_GAP_S,
      card: { title: law, lines: [line] },
    }),
    beat({
      id: "law-state",
      stage: "law",
      say: "Ohm's law: current in a metallic conductor is proportional to the p.d. across it, at constant temperature.",
      spoken:
        "Ohm's law: current is proportional to the potential difference, at constant temperature.",
      gapS: CONCLUSION_GAP_S,
      card: { title: law, lines: [line, LAW_LINE] },
    }),
    read({ id: "qbii", instr: 10 }),
    beat({
      id: "length-area",
      stage: "length",
      say: "The area of the wire is πd²/4, with d = 0.2 mm.",
      spoken: "The area of the wire is pi d squared over 4, with d equal to 0.2 millimetres.",
      gapS: CONCLUSION_GAP_S,
      card: { title: working, lines: ["A = πd²/4 = 3.143 × 10⁻⁸ m²"] },
    }),
    beat({
      id: "length-work",
      stage: "length",
      say: "(b)(ii) L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷). Work out L yourself.",
      spoken: "Part b two: the length is R A over rho. Work it out yourself.",
      gapS: CONCLUSION_GAP_S,
      card: {
        title: working,
        lines: ["A = πd²/4 = 3.143 × 10⁻⁸ m²", "L = RA/ρ = (7 × 3.143 × 10⁻⁸) ÷ (8.8 × 10⁻⁷)"],
      },
    }),
  ];
}

/** The card of lines for beat `i`: its own, or the last one before it in the same stage; or none. */
export function cardAt(beats: readonly Beat[], i: number): Beat["card"] | null {
  const stage = beats[i]?.stage;
  for (let j = i; j >= 0; j--) {
    const b = beats[j];
    if (!b || b.stage !== stage) return null;
    if (b.card) return b.card;
  }
  return null;
}

export const OHMS_LAW_GUIDED_SCRIPT: Script = {
  lessonId: "ohms_law_vi",
  shots: OHMS_LAW_SHOTS,
  beats: [
    ...identifyBeats(),
    ...measureBeats(),
    ...connectBeats(),
    ...readingBeats(),
    ...plotBeats(),
    ...slopeBeats(),
    ...closingBeats(),
  ],
};
