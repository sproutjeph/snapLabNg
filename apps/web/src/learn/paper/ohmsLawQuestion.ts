import type { PracticalQuestion } from "./types";

// The V–I question as printed on the paper (docs/plans/exam-redesign.md, "The experience", step 2;
// docs/07 §4.4). The instructions are the lesson's own words (lesson.test.ts's sibling test here
// keeps the two in step). "WASSCE-style": our own typesetting, no WAEC logo or scan.
// Nothing here is a reading, a current, a voltage or the wire's resistance.

export const OHMS_LAW_QUESTION: PracticalQuestion = {
  source: "WASSCE (SC) 2018, Physics Paper 3, Question 3B",
  title: "Ohm's law (V–I)",
  // Each text must appear word for word in an instruction; the first place it appears is where the
  // voice names it, and that is when the item lands on the bench. The plug key and the wire are
  // named by the paper only as "other necessary materials" and "the resistance wire".
  apparatus: [
    { part: "ammeter", text: "an ammeter" },
    { part: "voltmeter", text: "a voltmeter" },
    { part: "box", text: "a resistance box" },
    { part: "leads", text: "connecting wires" },
    { part: "cells", text: "dry cells" },
    { part: "key", text: "other necessary materials" },
    { part: "wire", text: "the resistance wire" },
  ],
  instructions: [
    {
      label: "1",
      text: "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.",
    },
    { label: "2", text: "Measure and record the length XY of the resistance wire provided." },
    { label: "3", text: "Connect the circuit as shown in the diagram." },
    {
      label: "4",
      text: "With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.",
    },
    { label: "5", text: "Set R = 1 Ω, close the key, read and record I and V." },
    { label: "6", text: "Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate." },
    { label: "7", text: "Plot V (vertical) against I (horizontal)." },
    { label: "8", text: "Determine the slope s." },
    { label: "9", text: "State two precautions." },
    { label: "(b)(i)", text: "Mention and state the law on which the experiment is based." },
    {
      label: "(b)(ii)",
      text: "A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).",
    },
  ],
};
