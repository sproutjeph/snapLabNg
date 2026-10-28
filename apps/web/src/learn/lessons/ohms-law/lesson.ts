import type { Lesson, Step } from "../../types";

// The Ohm's-law (V–I) lesson: step keys, titles, the question's own words and one plain line
// per step (from the science-checked draft, docs/plans/ohms-law-lesson-draft.md and -review.md).
// The lesson-content slice (Wave 3) adds callouts, why-it-works, Identify cards and poses.
// Plain lines are about procedure only and never give a value; exam mode hides them.

const step = (key: string, title: string, instruction: string, plain = ""): Step => ({
  key,
  title,
  instruction,
  plain,
  pose: "bench",
});

export const OHMS_LAW_LESSON: Lesson = {
  id: "ohms_law_vi",
  title: "Ohm's law (V–I)",
  diagram: { svg: "", caption: "Circuit for this practical" },
  steps: [
    step(
      "identify",
      "Identify",
      "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.",
      "Tap each item on the bench to see what it is, then open the diagram to see how they join.",
    ),
    step(
      "measure-xy",
      "Measure XY",
      "Measure and record the length XY of the resistance wire provided.",
      "Tap the metre rule for a close look. Read the marks under X and Y, then type the length XY in your notebook.",
    ),
    step(
      "connect",
      "Connect",
      "Connect the circuit as shown in the diagram.",
      "Tap a terminal, then the terminal it joins in the diagram. The ringed terminal is the next one.",
    ),
    step(
      "r0",
      "R = 0 Ω",
      "With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.",
      "Push every plug into the box and put the plug into the key. Tap each meter to read it, then type I and V.",
    ),
    step(
      "r1",
      "R = 1 Ω",
      "Set R = 1 Ω, close the key, read and record I and V.",
      "Open the key, pull out the 1 Ω plug, close the key again and read both meters.",
    ),
    step(
      "repeat",
      "Repeat",
      "Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate.",
      "Do the same for R = 5, 10, 20, 40 and 60 Ω. Open the key between readings.",
    ),
    step(
      "plot",
      "Plot",
      "Plot V (vertical) against I (horizontal).",
      "From your own table, plot V up the page and I across it.",
    ),
    step(
      "slope",
      "Slope",
      "Determine the slope s.",
      "Draw a large triangle on your line and work out s = ΔV ÷ ΔI, with its unit.",
    ),
    step(
      "precautions",
      "Precautions",
      "State two precautions.",
      "Write two precautions you took, stated as things you did.",
    ),
    step(
      "law",
      "(b)(i)",
      "Mention and state the law on which the experiment is based.",
      "Name the law the experiment is based on, then state it with its condition.",
    ),
    step(
      "length",
      "(b)(ii)",
      "A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).",
      "Show your working from the formula to the answer, and give the unit.",
    ),
  ],
  poses: { bench: { azimuthDeg: 0, elevationDeg: 42, target: [0, 0, -0.05], distanceM: 1.4 } },
  thumbnails: {},
  identify: [],
};
