import type { Lesson, Step } from "../../types";

// The Ohm's-law (V–I) lesson. STUB (Wave 0): step keys, titles and the question's own words.
// The lesson-content slice (Wave 3) adds plain lines, callouts, why-it-works, Identify cards,
// poses and the done() checks; the wiring slice supplies the diagram SVG.

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
    ),
    step(
      "measure-xy",
      "Measure XY",
      "Measure and record the length XY of the resistance wire provided.",
    ),
    step("connect", "Connect", "Connect the circuit as shown in the diagram."),
    step(
      "r0",
      "R = 0 Ω",
      "With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.",
    ),
    step("r1", "R = 1 Ω", "Set R = 1 Ω, close the key, read and record I and V."),
    step(
      "repeat",
      "Repeat",
      "Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate.",
    ),
    step("plot", "Plot", "Plot V (vertical) against I (horizontal)."),
    step("slope", "Slope", "Determine the slope s."),
    step("precautions", "Precautions", "State two precautions."),
    step("law", "(b)(i)", "Mention and state the law on which the experiment is based."),
    step(
      "length",
      "(b)(ii)",
      "A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).",
    ),
  ],
  poses: { bench: { azimuthDeg: 0, elevationDeg: 42, target: [0, 0, -0.05], distanceM: 1.4 } },
  thumbnails: {},
  identify: [],
};
