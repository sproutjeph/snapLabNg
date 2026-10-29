import type { LookShot } from "../../scene/look/types";
import type { ActorAction, Beat, Script } from "./types";

// The director's own sample script: it exercises every action the actor can perform, on the real
// demonstration bench, so the director's tests and the ?director=1 preview have something real
// to run. It is NOT the lesson's script: the WAEC-worded narration, shots and callouts are
// W2-watch's (learn/lessons/ohms-law/script.ts). Its narration is short and carries no reading.
//
// The graph scales fit every demonstration bench: over seeds 1 to 300 the first row reads 0.51
// to 0.84 A and 2.02 to 2.61 V, and the last 0.02 to 0.04 A and 0.07 to 0.12 V. So "2 cm to
// 0.1 A" puts the points 9 to 17 cm across an 18 cm sheet, and "1 cm to 0.2 V" puts them 10 to
// 13 cm up a 24 cm sheet: more than a third of the sheet each way.

export const SAMPLE_SHOTS: readonly LookShot[] = [
  { id: "bench", focus: [0, 0, 0], spanM: 1.3 },
  { id: "wire", focus: [0, 0, -0.25], spanM: 0.7 },
  { id: "meters", focus: [0.05, 0, 0.1], spanM: 0.55 },
  { id: "box", focus: [0.3, 0, -0.05], spanM: 0.55 },
  { id: "notes", focus: [0, 0, 0.4], spanM: 0.8 },
];

/** The question's rows: R = 0, 1, then 5, 10, 20, 40 and 60 Ω. */
export const SAMPLE_RESISTANCES = [0, 1, 5, 10, 20, 40, 60] as const;

const LEADS: ReadonlyArray<
  readonly [
    Extract<ActorAction, { kind: "lead" }>["from"],
    Extract<ActorAction, { kind: "lead" }>["to"],
    string,
  ]
> = [
  ["E+", "K1", "Join the cells to the key."],
  ["K2", "A+", "Join the key to the ammeter."],
  ["A-", "R1", "Join the ammeter to the resistance box."],
  ["R2", "X", "Join the resistance box to the wire."],
  ["Y", "E-", "Join the wire back to the cells."],
  ["V+", "X", "Put the voltmeter across the wire, at X."],
  ["V-", "Y", "and at Y."],
];

const PRECAUTIONS = [
  "The key was opened between readings.",
  "Parallax was avoided by reading each meter with the pointer over its image in the mirror.",
];
const LAW =
  "Ohm's law: the current flowing through a metallic conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions remain constant.";
const CALC =
  "A = πd²/4 = (22/7 × (0.2 × 10⁻³)²)/4 = 3.143 × 10⁻⁸ m²\nL = RA/ρ = (7 × 3.143 × 10⁻⁸)/(8.8 × 10⁻⁷) = 0.25 m";

function build(): Beat[] {
  const out: Beat[] = [];
  const add = (
    id: string,
    stage: string,
    say: string,
    shot: string,
    act?: ActorAction,
    extra: Partial<Beat> = {},
  ) => out.push({ id, stage, say, instruct: say, shot, ...(act ? { act } : {}), ...extra });

  add("enter", "identify", "These are the things on the bench.", "bench", {
    kind: "enter",
    parts: ["cells", "key", "ammeter", "voltmeter", "box", "wire"],
  });
  add("rule-open", "measure-xy", "Read the length XY on the metre rule.", "wire", {
    kind: "loupe",
    target: "rule",
  });
  add("rule-write", "measure-xy", "Write it in centimetres.", "wire", {
    kind: "write",
    field: { kind: "length" },
    value: { from: "rule" },
  });
  add("rule-close", "measure-xy", "Put the rule away.", "wire", { kind: "loupe", target: null });

  LEADS.forEach(([from, to, say], i) => {
    add(
      `lead-${i + 1}`,
      "connect",
      say,
      "bench",
      { kind: "lead", from, to },
      // Practise: done once that many of the diagram's leads are made, in any order.
      { showMe: true, done: (s) => s.comparison.missing.length <= LEADS.length - (i + 1) },
    );
  });

  for (const col of ["R", "I", "V"] as const) {
    add(`head-${col}`, "r0", `Head the ${col} column.`, "notes", {
      kind: "write",
      field: { kind: "header", col },
      value: { text: col === "R" ? "R/Ω" : col === "I" ? "I/A" : "V/V" },
    });
  }

  SAMPLE_RESISTANCES.forEach((ohm, row) => {
    const stage = row === 0 ? "r0" : row === 1 ? "r1" : "repeat";
    const r = `row-${row + 1}`;
    add(`${r}-loupe-off`, stage, "Look at the box.", "box", { kind: "loupe", target: null });
    add(
      `${r}-plug`,
      stage,
      `Set the box to ${ohm} ohms.`,
      "box",
      { kind: "plug", ohm },
      {
        showMe: true,
        done: (s) => s.boxSettingOhm === ohm,
      },
    );
    add(
      `${r}-key-on`,
      stage,
      "Close the key.",
      "bench",
      { kind: "key", closed: true },
      {
        showMe: true,
        done: (s) => s.keyClosed,
      },
    );
    add(`${r}-i-loupe`, stage, "Read the ammeter.", "meters", { kind: "loupe", target: "ammeter" });
    add(`${r}-i`, stage, "Write the current.", "notes", {
      kind: "write",
      field: { kind: "cell", row, col: "I" },
      value: { from: "ammeter" },
    });
    add(`${r}-v-loupe`, stage, "Read the voltmeter.", "meters", {
      kind: "loupe",
      target: "voltmeter",
    });
    add(`${r}-v`, stage, "Write the voltage.", "notes", {
      kind: "write",
      field: { kind: "cell", row, col: "V" },
      value: { from: "voltmeter" },
    });
    add(`${r}-r`, stage, "Write the box setting.", "notes", {
      kind: "write",
      field: { kind: "cell", row, col: "R" },
      value: { text: String(ohm) },
    });
    add(
      `${r}-key-off`,
      stage,
      "Open the key.",
      "bench",
      { kind: "key", closed: false },
      {
        showMe: true,
        done: (s) => !s.keyClosed,
      },
    );
  });

  add("axis-x", "plot", "Current goes across.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "axisX" },
    value: { text: "I/A" },
  });
  add("axis-y", "plot", "Voltage goes up.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "axisY" },
    value: { text: "V/V" },
  });
  add("scale-x", "plot", "Choose the scale across.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "scaleX" },
    value: { text: "2 cm to 0.1 A" },
  });
  add("scale-y", "plot", "Choose the scale up.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "scaleY" },
    value: { text: "1 cm to 0.2 V" },
  });
  SAMPLE_RESISTANCES.forEach((_, row) => {
    add(`plot-${row + 1}`, "plot", `Plot row ${row + 1}.`, "notes", { kind: "plot", row });
  });
  add("line", "plot", "Draw the line of best fit.", "notes", { kind: "line" });
  add("triangle", "slope", "Draw a large triangle on the line.", "notes", { kind: "triangle" });
  add("delta-v", "slope", "Read the height.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "deltaY" },
    value: { from: "rule" },
  });
  add("delta-i", "slope", "Read the base.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "deltaX" },
    value: { from: "rule" },
  });
  add("slope", "slope", "Divide the height by the base.", "notes", {
    kind: "write",
    field: { kind: "graph", part: "slope" },
    value: { from: "rule" },
  });
  PRECAUTIONS.forEach((text, index) => {
    add(`precaution-${index + 1}`, "precautions", "Write a precaution.", "notes", {
      kind: "write",
      field: { kind: "precaution", index },
      value: { text },
    });
  });
  add("law", "law", "Name and state the law.", "notes", {
    kind: "write",
    field: { kind: "law" },
    value: { text: LAW },
  });
  add("calc", "length", "Work out the length of the wire.", "notes", {
    kind: "write",
    field: { kind: "lengthCalc" },
    value: { text: CALC },
  });
  return out;
}

export const SAMPLE_SCRIPT: Script = {
  lessonId: "ohms_law_vi",
  shots: SAMPLE_SHOTS,
  beats: build(),
};
