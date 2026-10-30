import { DIAGRAM_LEADS } from "@snaplab/engine";
import type { LookShot } from "../../../scene/look/types";
import type { Beat, Script } from "../../script/types";
import type { PartId, TerminalId } from "../../types";

// The Ohm's law (V–I) Watch/Practise script (docs/plans/wave-2-lean.md slice 2a-script, against
// the frozen learn/script/types.ts). One enter beat drops every part in, then one lead beat per
// lead in WAEC connection order (DIAGRAM_LEADS: the series loop E → K → A → R → X–Y → E, then
// the voltmeter across X and Y), then plug, key, readings, table and graph. The stage is fixed:
// every beat uses the one bench shot and readings get their close look from the loupe action.
//
// Narration is WAEC wording and never carries a value from any bench: meter and rule values
// reach the record only through ValueSource, and the only numerals spoken are the question's
// own (R = 0, 1, 5, 10, 20, 40 and 60 Ω; diameter 0.2 mm; resistance 7 Ω;
// resistivity 8.8 × 10⁻⁷ Ω m; π = 22/7). script.test.ts scans for anything else.

/** The one fixed framing: the whole bench. The camera never cuts between beats. */
export const OHMS_LAW_SHOTS: readonly LookShot[] = [{ id: "bench", focus: [0, 0, 0], spanM: 1.3 }];

/** The question's rows, in the order they are taken: R = 0, 1, then 5, 10, 20, 40 and 60 Ω. */
export const OHMS_LAW_RESISTANCES = [0, 1, 5, 10, 20, 40, 60] as const;

/** Which part each terminal belongs to, for focus sets. Mirrors PART_TERMINALS in the engine. */
const TERMINAL_PART: Readonly<Record<TerminalId, PartId>> = {
  "E+": "cells",
  "E-": "cells",
  K1: "key",
  K2: "key",
  "A+": "ammeter",
  "A-": "ammeter",
  "V+": "voltmeter",
  "V-": "voltmeter",
  R1: "box",
  R2: "box",
  X: "wire",
  Y: "wire",
};

/** How each terminal is named in speech: words only, never a value and never a digit. */
export const TERMINAL_WORDS: Readonly<Record<TerminalId, string>> = {
  "E+": "the positive terminal of the cells",
  "E-": "the negative terminal of the cells",
  K1: "the first terminal of the plug key",
  K2: "the second terminal of the plug key",
  "A+": "the positive terminal of the ammeter",
  "A-": "the negative terminal of the ammeter",
  "V+": "the positive terminal of the voltmeter",
  "V-": "the negative terminal of the voltmeter",
  R1: "the first terminal of the resistance box",
  R2: "the second terminal of the resistance box",
  X: "the end X of the resistance wire",
  Y: "the end Y of the resistance wire",
};

/** Chip label for a lead beat: both ends, the way the callout names them on the bench. */
const LEAD_CHIPS: Readonly<Record<string, string>> = {
  "E+>K1": "CELLS + → KEY",
  "K2>A+": "KEY → AMMETER +",
  "A->R1": "AMMETER − → RESISTANCE BOX",
  "R2>X": "RESISTANCE BOX → WIRE X",
  "Y>E-": "WIRE Y → CELLS −",
  "V+>X": "VOLTMETER + → WIRE X",
  "V->Y": "VOLTMETER − → WIRE Y",
};

const LEAD_SAY: ReadonlyArray<readonly [string, string]> = [
  [
    "Connect the positive terminal of the cells to the plug key. Keep the key open while the circuit is connected, so no current can flow through a half-made circuit.",
    "Tap the positive terminal of the cells, then the first terminal of the plug key.",
  ],
  [
    "Join the second terminal of the key to the positive terminal of the ammeter. The ammeter goes in the main line, in series, with the current entering at its positive terminal.",
    "Tap the second terminal of the plug key, then the positive terminal of the ammeter.",
  ],
  [
    "Join the negative terminal of the ammeter to the resistance box.",
    "Tap the negative terminal of the ammeter, then the first terminal of the resistance box.",
  ],
  [
    "Join the second terminal of the resistance box to the end X of the resistance wire.",
    "Tap the second terminal of the resistance box, then the end X of the wire.",
  ],
  [
    "Join the end Y of the wire back to the negative terminal of the cells. The series loop is complete.",
    "Tap the end Y of the wire, then the negative terminal of the cells.",
  ],
  [
    "Now put the voltmeter across the wire alone: its positive terminal goes to the end X. In parallel, it reads the potential difference across XY and takes almost no current.",
    "Tap the positive terminal of the voltmeter, then the end X of the wire.",
  ],
  [
    "And the negative terminal of the voltmeter goes to the end Y. The circuit is connected as shown in the diagram.",
    "Tap the negative terminal of the voltmeter, then the end Y of the wire.",
  ],
];

const PRECAUTIONS = [
  "The key was opened between readings.",
  "Parallax was avoided by reading each meter with the pointer over its image in the mirror.",
] as const;

// Ohm's law, stated in full with its condition (WAEC expected answer; Nelkon & Parker).
const LAW =
  "Ohm's law: the current flowing through a metallic conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions remain constant.";

// (b)(ii): d = 0.2 mm, R = 7 Ω, ρ = 8.8 × 10⁻⁷ Ω m, π = 22/7. Watch writes the method — the
// formula and the substitution — and stops before the final value: the expected result is
// never shown before she hands in (AGENTS.md). She works the length out herself in Practise.
const LENGTH_CALC =
  "A = πd²/4 = (22/7 × (0.2 × 10⁻³)²)/4 = 3.143 × 10⁻⁸ m²\nL = RA/ρ = (7 × 3.143 × 10⁻⁸)/(8.8 × 10⁻⁷)";

/** A record field she has actually written something in. */
const filled = (t: string | null | undefined) => (t ?? "").trim().length > 0;

function build(): Beat[] {
  const out: Beat[] = [];
  const add = (beat: Beat) => out.push(beat);

  add({
    id: "enter",
    stage: "identify",
    say: "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials. Here they are on the bench: the dry cells, the plug key, the ammeter, the voltmeter, the resistance box and the resistance wire XY.",
    instruct: "Look at each part on the bench and find it in the diagram.",
    shot: "bench",
    act: { kind: "enter", parts: ["cells", "key", "ammeter", "voltmeter", "box", "wire"] },
    focus: ["cells", "key", "ammeter", "voltmeter", "box", "wire"],
    // One label at a time: the entrance names the apparatus, not six parts at once.
    callouts: [{ anchor: "cells", label: "APPARATUS", kind: "name" }],
  });

  add({
    id: "rule-open",
    stage: "measure-xy",
    say: "Measure and record the length XY of the resistance wire provided. Read the metre rule from X to Y, keeping the wire straight and your eye directly above each mark, so parallax does not shift the reading.",
    instruct: "Tap the metre rule and read the marks under X and Y.",
    shot: "bench",
    act: { kind: "loupe", target: "rule" },
    focus: ["wire"],
    callouts: [
      { anchor: "wire", label: "RESISTANCE WIRE XY", sub: "Read from X to Y", kind: "do" },
    ],
  });
  add({
    id: "rule-write",
    stage: "measure-xy",
    say: "Record the length XY in centimetres, to one decimal place.",
    instruct: "Write the length XY in your notebook, in centimetres.",
    shot: "bench",
    act: { kind: "write", field: { kind: "length" }, value: { from: "rule" } },
    done: (s) => filled(s.record.length_xy?.text_as_written),
    focus: ["wire"],
  });
  add({
    id: "rule-close",
    stage: "measure-xy",
    say: "Put the metre rule back on the bench. Now connect the circuit as shown in the diagram, with the key open.",
    instruct: "Put the metre rule back.",
    shot: "bench",
    act: { kind: "loupe", target: null },
    focus: ["wire"],
  });

  DIAGRAM_LEADS.forEach(([from, to], i) => {
    const words = LEAD_SAY[i];
    if (!words) return;
    const [say, instruct] = words;
    add({
      id: `lead-${i + 1}`,
      stage: "connect",
      say,
      instruct,
      shot: "bench",
      act: { kind: "lead", from, to },
      showMe: true,
      // Practise: done once this many of the diagram's leads exist, in any order.
      done: (s) => s.comparison.missing.length <= DIAGRAM_LEADS.length - (i + 1),
      focus: [TERMINAL_PART[from], TERMINAL_PART[to]],
      callouts: [{ anchor: from, label: LEAD_CHIPS[`${from}>${to}`] ?? "CONNECT", kind: "do" }],
    });
  });

  for (const col of ["R", "I", "V"] as const) {
    add({
      id: `head-${col}`,
      stage: "r0",
      say:
        col === "R"
          ? "Tabulate your results. Head the first column R, with its unit in the heading: the unit goes in the heading, not in the cells."
          : col === "I"
            ? "Head the next column I, for the current in amperes."
            : "Head the last column V, for the voltage drop across the wire, in volts.",
      instruct: `Head the ${col} column of your table, with its unit.`,
      shot: "bench",
      act: {
        kind: "write",
        field: { kind: "header", col },
        value: { text: col === "R" ? "R/Ω" : col === "I" ? "I/A" : "V/V" },
      },
      done: (s) => filled(s.record.headers[col]),
    });
  }

  OHMS_LAW_RESISTANCES.forEach((ohm, row) => {
    const stage = row === 0 ? "r0" : row === 1 ? "r1" : "repeat";
    const r = `row-${row + 1}`;
    add({
      id: `${r}-box`,
      stage,
      say:
        row === 0
          ? "Turn to the resistance box. Check the zero error of each meter before the key is closed."
          : "With the key open, turn back to the resistance box to change R.",
      instruct: "Look at the resistance box.",
      shot: "bench",
      act: { kind: "loupe", target: null },
      focus: ["box"],
      callouts: [{ anchor: "box", label: "RESISTANCE BOX, R", kind: "do" }],
    });
    add({
      id: `${r}-plug`,
      stage,
      say:
        ohm === 0
          ? "With R = 0 Ω, push every plug firmly into the resistance box. A plug that is pushed in bypasses its coil, so the box adds no resistance."
          : `Set R = ${ohm} Ω. Pull out the plugs whose coils add up to ${ohm} Ω, and push every other plug in firmly. R is the sum of the coils whose plugs are out.`,
      instruct:
        ohm === 0
          ? "Push every plug into the resistance box."
          : `Pull out the plugs that add up to ${ohm} Ω.`,
      shot: "bench",
      act: { kind: "plug", ohm },
      showMe: true,
      done: (s) => s.boxSettingOhm === ohm,
      focus: ["box"],
      callouts: [{ anchor: "box", label: `RESISTANCE BOX, R = ${ohm} Ω`, kind: "do" }],
    });
    add({
      id: `${r}-key-on`,
      stage,
      say: "Close the key K. Read both meters at the same moment, so the current and the voltage belong to the same state of the circuit.",
      instruct: "Put the plug into the key to close it.",
      shot: "bench",
      act: { kind: "key", closed: true },
      showMe: true,
      done: (s) => s.keyClosed,
      focus: ["key", "ammeter", "voltmeter"],
      callouts: [{ anchor: "key", label: "PLUG KEY, K", sub: "Close the key", kind: "do" }],
    });
    add({
      id: `${r}-i-loupe`,
      stage,
      say: "Read and record the current I on the ammeter. Read it with the pointer over its own image in the mirror strip, so parallax error is avoided.",
      instruct: "Tap the ammeter and read the current.",
      shot: "bench",
      act: { kind: "loupe", target: "ammeter" },
      focus: ["ammeter"],
      callouts: [
        { anchor: "ammeter", label: "AMMETER, A", sub: "Reads the current I", kind: "reading" },
      ],
    });
    add({
      id: `${r}-i`,
      stage,
      say: "Record the current I in the table, to the same number of decimal places each time.",
      instruct: "Write the current I in this row of your table.",
      shot: "bench",
      act: { kind: "write", field: { kind: "cell", row, col: "I" }, value: { from: "ammeter" } },
      // Rows are matched by their R value, the way checks.ts hasRow matches them.
      done: (s) => s.record.rows.some((r) => r.R.value === ohm && filled(r.I.text_as_written)),
      focus: ["ammeter"],
    });
    add({
      id: `${r}-v-loupe`,
      stage,
      say: "Read the corresponding voltage drop V across the wire on the voltmeter, the same way, with the pointer over its image.",
      instruct: "Tap the voltmeter and read the voltage drop across the wire.",
      shot: "bench",
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
    });
    add({
      id: `${r}-v`,
      stage,
      say: "Record the voltage V in the same row as its current.",
      instruct: "Write the voltage V in the same row.",
      shot: "bench",
      act: { kind: "write", field: { kind: "cell", row, col: "V" }, value: { from: "voltmeter" } },
      done: (s) => s.record.rows.some((r) => r.R.value === ohm && filled(r.V.text_as_written)),
      focus: ["voltmeter"],
    });
    add({
      id: `${r}-r`,
      stage,
      say: `Write R = ${ohm} Ω in the first column of the row.`,
      instruct: `Write ${ohm} in the R column of this row.`,
      shot: "bench",
      act: { kind: "write", field: { kind: "cell", row, col: "R" }, value: { text: String(ohm) } },
      done: (s) => s.record.rows.some((r) => r.R.value === ohm),
      focus: ["box"],
    });
    add({
      id: `${r}-key-off`,
      stage,
      say:
        row === OHMS_LAW_RESISTANCES.length - 1
          ? "Open the key. That is the last reading: the table is complete."
          : "Open the key between readings, so the cells rest and the readings do not drift.",
      instruct: "Pull the plug out of the key to open it.",
      shot: "bench",
      act: { kind: "key", closed: false },
      showMe: true,
      done: (s) => !s.keyClosed,
      focus: ["key"],
      callouts: [{ anchor: "key", label: "PLUG KEY, K", sub: "Open the key", kind: "do" }],
    });
  });

  add({
    id: "axis-x",
    stage: "plot",
    say: "Plot V (vertical) against I (horizontal), from your own table, as the question says.",
    instruct: "On your graph paper, mark the horizontal axis for the current.",
    shot: "bench",
    act: { kind: "write", field: { kind: "graph", part: "axisX" }, value: { text: "I/A" } },
    done: (s) => filled(s.record.graph?.x.label_as_written),
  });
  add({
    id: "axis-y",
    stage: "plot",
    say: "Mark the vertical axis for the voltage. Both axes carry the quantity and the unit.",
    instruct: "Mark the vertical axis for the voltage, with its unit.",
    shot: "bench",
    act: { kind: "write", field: { kind: "graph", part: "axisY" }, value: { text: "V/V" } },
    done: (s) => filled(s.record.graph?.y.label_as_written),
  });
  add({
    id: "scale-x",
    stage: "plot",
    // Scales confirmed for the demonstration benches by the science check recorded in
    // script.test.ts: they put every demo point more than a third of the sheet each way.
    say: "Choose the scale across the page: two centimetres to a tenth of an ampere, so the graph fills more than a third of the page.",
    instruct: "Write the scale for the current axis: two centimetres to a tenth of an ampere.",
    shot: "bench",
    act: {
      kind: "write",
      field: { kind: "graph", part: "scaleX" },
      value: { text: "2 cm to 0.1 A" },
    },
    done: (s) => filled(s.record.graph?.x.scale_as_written),
  });
  add({
    id: "scale-y",
    stage: "plot",
    say: "Up the page, take one centimetre to a fifth of a volt.",
    instruct: "Write the scale for the voltage axis: one centimetre to a fifth of a volt.",
    shot: "bench",
    act: {
      kind: "write",
      field: { kind: "graph", part: "scaleY" },
      value: { text: "1 cm to 0.2 V" },
    },
    done: (s) => filled(s.record.graph?.y.scale_as_written),
  });
  OHMS_LAW_RESISTANCES.forEach((_, row) => {
    add({
      id: `plot-${row + 1}`,
      stage: "plot",
      say: "Plot this row of your table: the current across, and its voltage up, with a sharp pencil.",
      instruct: "Plot this row of your table on the graph.",
      shot: "bench",
      act: { kind: "plot", row },
      done: (s) => (s.record.graph?.points.length ?? 0) > row,
    });
  });
  add({
    id: "line",
    stage: "plot",
    say: "Draw the line of best fit through the points, with the points scattered on both sides of it, so small reading errors cancel out.",
    instruct: "Draw the line of best fit through your points.",
    shot: "bench",
    act: { kind: "line" },
    done: (s) => s.record.graph?.line != null,
  });
  add({
    id: "triangle",
    stage: "slope",
    say: "Determine the slope s. Draw a large right-angled triangle on your line, so small reading errors matter less.",
    instruct: "Draw a large right-angled triangle on your line.",
    shot: "bench",
    act: { kind: "triangle" },
    done: (s) => s.record.graph?.triangle != null,
  });
  add({
    id: "delta-v",
    stage: "slope",
    say: "Read the change in V up the side of the triangle, from points on the line itself, not from the table.",
    instruct: "Read the change in V from your triangle, off the line.",
    shot: "bench",
    act: { kind: "write", field: { kind: "graph", part: "deltaY" }, value: { from: "rule" } },
    done: (s) => filled(s.record.graph?.delta_y_as_written),
  });
  add({
    id: "delta-i",
    stage: "slope",
    say: "Read the change in I along the base of the triangle, again from the line.",
    instruct: "Read the change in I along the base of your triangle.",
    shot: "bench",
    act: { kind: "write", field: { kind: "graph", part: "deltaX" }, value: { from: "rule" } },
    done: (s) => filled(s.record.graph?.delta_x_as_written),
  });
  add({
    id: "slope",
    stage: "slope",
    say: "The slope s is the change in V divided by the change in I, and its unit is the ohm. The slope gives the resistance of the wire XY.",
    instruct: "Work out the slope: change in V divided by change in I, with its unit.",
    shot: "bench",
    act: { kind: "write", field: { kind: "graph", part: "slope" }, value: { from: "rule" } },
    done: (s) => filled(s.record.graph?.slope_as_written),
  });

  PRECAUTIONS.forEach((text, index) => {
    add({
      id: `precaution-${index + 1}`,
      stage: "precautions",
      say: "State two precautions. Write each one as something that was done, not as an order.",
      instruct: "Write a precaution you took, as something you did.",
      shot: "bench",
      act: { kind: "write", field: { kind: "precaution", index }, value: { text } },
      done: (s) => filled(s.record.precautions[index]),
    });
  });
  add({
    id: "law",
    stage: "law",
    say: "Mention and state the law on which the experiment is based. Name the law, state it in full, and give the condition it needs.",
    instruct: "Name and state the law this experiment is based on.",
    shot: "bench",
    act: { kind: "write", field: { kind: "law" }, value: { text: LAW } },
    done: (s) => filled(s.record.law_as_written),
  });
  add({
    id: "length",
    stage: "length",
    say: "A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length, taking π = 22/7. Start from the resistivity formula, work out the area, and put the numbers in, in metres. The working is on the page; you work out the length.",
    instruct: "Calculate the length of the wire. Show your working and give the unit.",
    shot: "bench",
    act: { kind: "write", field: { kind: "lengthCalc" }, value: { text: LENGTH_CALC } },
    done: (s) => filled(s.record.length_calc_as_written),
  });

  return out;
}

export const OHMS_LAW_SCRIPT: Script = {
  lessonId: "ohms_law_vi",
  shots: OHMS_LAW_SHOTS,
  beats: build(),
};
