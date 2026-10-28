import type { CameraPose, IdentifyCard, Lesson, Step } from "../../types";
import { OHMS_LAW_DIAGRAM_CAPTION, OHMS_LAW_DIAGRAM_SVG } from "../../wiring/diagram";

// The Ohm's-law (V–I) lesson (docs/plans/ohms-law-lesson-draft.md with the corrections of
// docs/plans/ohms-law-lesson-review.md applied). Instructions are the question's own words.
// Plain lines, callouts, Why it works, Precautions and Identify are hidden in exam mode by the
// shell. Nothing here states a reading, a current, a voltage, the resistance of the wire or the
// slope: feedback is about procedure and technique. Precautions are in the reported tense and
// pass judgePrecaution(text, "ohms_law_vi") (lesson.test.ts).

type Extra = Pick<Step, "ring" | "callouts" | "whyItWorks" | "precautions"> & { pose?: string };

const step = (
  key: string,
  title: string,
  instruction: string,
  plain: string,
  extra: Extra = {},
): Step => ({ key, title, instruction, plain, ...extra, pose: extra.pose ?? "bench" });

/** Precautions the student can write, as things that were done (docs plan section 3). */
const P = {
  keyOpened: "The key was opened between readings.",
  keyOpenWiring: "The key was kept open while the circuit was connected.",
  connections: "All connections were tight and the terminals were cleaned with sandpaper.",
  parallax:
    "Parallax error was avoided by reading each pointer over its own image in the mirror strip.",
  parallaxRule:
    "Parallax error was avoided by reading the metre rule with the eye directly above each mark.",
  zeroError: "The zero error of each meter was checked before the key was closed.",
  plugs: "The plugs of the resistance box were pushed in firmly.",
  wireStraight: "The wire XY was kept straight.",
  repeated: "Each reading was repeated to check it.",
} as const;

export const OHMS_LAW_LESSON: Lesson = {
  id: "ohms_law_vi",
  title: "Ohm's law (V–I)",
  diagram: { svg: OHMS_LAW_DIAGRAM_SVG, caption: OHMS_LAW_DIAGRAM_CAPTION },
  steps: [
    step(
      "identify",
      "Identify",
      "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.",
      "Tap each item on the bench to see what it is, then open the diagram to see how they join.",
      {
        pose: "bench",
        callouts: [
          { part: "cells", label: "Dry cells and holder, E" },
          { part: "key", label: "Plug key, K" },
          { part: "ammeter", label: "Ammeter, A" },
          { part: "box", label: "Resistance box, R" },
          { part: "voltmeter", label: "Voltmeter, V" },
          { part: "wire", label: "Resistance wire XY" },
        ],
        whyItWorks: [
          "You must know which meter goes in series and which goes across the wire before any lead is connected. [Nelkon & Parker]",
          "The ammeter and the voltmeter look alike, so the letter on the dial is the only safe check.",
          "Seeing the resistance box and the plug key first makes the later steps (pulling plugs, closing the key) easy to follow.",
        ],
      },
    ),
    step(
      "measure-xy",
      "Measure XY",
      "Measure and record the length XY of the resistance wire provided.",
      "Tap the metre rule for a close look. Read the marks under X and Y, then type the length XY in your notebook.",
      {
        pose: "wire",
        ring: "wire",
        callouts: [
          {
            part: "wire",
            label: "Resistance wire XY",
            sub: "Read from X to Y, not from the end of the board",
          },
        ],
        whyItWorks: [
          "The length is read between the terminals X and Y, because only that piece of wire is across the voltmeter.",
          "Lengths are written in centimetres to at least one decimal place. [WAEC Phys P3 expected answers; PHYS-1DP in docs/07 5.2]",
          "With the eye straight above each mark, parallax does not shift the reading. [Nelkon & Parker]",
        ],
        precautions: [P.wireStraight, P.parallaxRule],
      },
    ),
    step(
      "connect",
      "Connect",
      "Connect the circuit as shown in the diagram.",
      "Tap a terminal, then the terminal it joins in the diagram. The ringed terminal is the next one.",
      {
        pose: "connect",
        callouts: [
          { part: "cells", label: "Dry cells, E", sub: "Current is taken to leave the + terminal" },
          {
            part: "key",
            label: "Plug key, K",
            sub: "Right terminal from the cells, left terminal to the ammeter",
          },
          {
            part: "ammeter",
            label: "Ammeter, A",
            sub: "In series, + terminal towards the cells' + side",
          },
          { part: "box", label: "Resistance box, R", sub: "In series with the wire" },
          { part: "voltmeter", label: "Voltmeter, V", sub: "In parallel, across X and Y only" },
          { part: "wire", label: "Wire XY" },
        ],
        whyItWorks: [
          "Building with the key open means no current can flow through a half-made or wrongly made circuit, for example a stray lead across the cells. [Nelkon & Parker]",
          "The ammeter carries all the current, so it sits in the main line, in series. Current enters at its + terminal, and a reversed meter kicks backwards below zero. [Nelkon & Parker]",
          "The voltmeter joins at X and Y, in parallel with the wire alone, so it reads the potential difference across XY and not across the box. [Nelkon & Parker]",
          "A voltmeter has a very high resistance, so it takes almost no current from the wire. [Nelkon & Parker]",
          "A loop with a gap anywhere reads zero on the ammeter.",
        ],
        precautions: [P.keyOpenWiring, P.connections],
      },
    ),
    step(
      "r0",
      "R = 0 Ω",
      "With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.",
      "Push every plug into the box and put the plug into the key. Tap each meter to read it, then type I and V.",
      {
        pose: "readings",
        ring: "ammeter",
        callouts: [
          { part: "box", label: "Resistance box, R", sub: "Every plug pushed in" },
          { part: "key", label: "Plug key, K" },
          { part: "ammeter", label: "Ammeter, A", sub: "Reads the current I" },
          {
            part: "voltmeter",
            label: "Voltmeter, V",
            sub: "Reads the voltage drop V across the wire",
          },
        ],
        whyItWorks: [
          "A plug that is pushed in bypasses its coil, so with every plug in the box adds no resistance. [Nelkon & Parker]",
          "The key is closed only long enough to read both meters, so the cells are not run down. [Nelkon & Parker]",
          "Both meters are read at the same moment, so I and V belong to the same state of the circuit.",
          "Each meter is read with the pointer covering its image in the mirror strip, which removes parallax. [Nelkon & Parker]",
          // CHECK: two decimal places for both meters (half a small division) follows
          // [DRAFT PHYS-2DP, docs/07 §5.2]; no WAEC claim is made.
          "Each reading is written to the same number of decimal places, as the scale allows.",
        ],
        precautions: [P.zeroError, P.parallax, P.keyOpened],
      },
    ),
    step(
      "r1",
      "R = 1 Ω",
      "Set R = 1 Ω, close the key, read and record I and V.",
      "Open the key, pull out the 1 Ω plug, close the key again and read both meters.",
      {
        pose: "box",
        ring: "box",
        callouts: [
          { part: "box", label: "Resistance box, R", sub: "A pulled plug adds its coil" },
          { part: "ammeter", label: "Ammeter, A" },
          { part: "voltmeter", label: "Voltmeter, V" },
        ],
        whyItWorks: [
          "Pulling a plug adds that coil to the circuit, so R is now the coil whose plug was pulled. [Nelkon & Parker]",
          "More resistance in series changes the current, which gives a new pair of I and V values for the graph.",
          "No current flows while the plugs are changed, and the cells rest between readings. [Nelkon & Parker]",
        ],
        precautions: [P.keyOpened, P.plugs, P.parallax],
      },
    ),
    step(
      "repeat",
      "Repeat",
      "Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate.",
      "Do the same for R = 5, 10, 20, 40 and 60 Ω. Open the key between readings.",
      {
        pose: "box",
        ring: "box",
        callouts: [
          {
            part: "box",
            label: "Resistance box, R",
            sub: "R is the sum of the coils whose plugs are out",
          },
        ],
        whyItWorks: [
          "A plug box adds the pulled coils together, so each R is made up from the coils whose plugs are out. [Nelkon & Parker]",
          "Readings spread over a wide range of R give a better best-fit line than a few close together. [Nelkon & Parker]",
          "A table with the quantity and unit in each heading, and every value to a consistent number of decimal places, earns the table mark. Units go in the headings, not in the cells. [WAEC Phys P3 2011, 2018, 2023; PHYS-TABLE in docs/07 5.2]",
        ],
        precautions: [P.keyOpened, P.plugs, P.repeated, P.parallax],
      },
    ),
    step(
      "plot",
      "Plot",
      "Plot V (vertical) against I (horizontal).",
      "From your own table, plot V up the page and I across it.",
      {
        whyItWorks: [
          "V goes on the vertical axis and I on the horizontal axis because the question says so. [the question]",
          "Both axes need the quantity and the unit. [WAEC Phys P3 2023 Q3B; GRAPH-AXES]",
          "The graph fills more than a third of the page, with an easy scale. [WAEC Phys P3 reports; GRAPH-SCALE]",
          "A best-fit line has points scattered on both sides of it, so small reading errors cancel out. [Nelkon & Parker]",
        ],
      },
    ),
    step(
      "slope",
      "Slope",
      "Determine the slope s.",
      "Draw a large triangle on your line and work out s = ΔV ÷ ΔI, with its unit.",
      {
        whyItWorks: [
          "The slope is the change in V divided by the change in I, so work out its unit as well as its size. [Nelkon & Parker]",
          "The slope gives the resistance of the wire XY.",
          "A large right-angled triangle makes small reading errors matter less. [WAEC Phys P3 reports; GRAPH-SLOPE]",
          // CHECK: points off the line, not the table [WAEC Phys P3 Chief Examiner's reports; GRAPH-SLOPE]; no wording quoted.
          "Points are read off the line, not from the table, which is what makes it a best-fit slope. [WAEC Phys P3 Chief Examiner's reports; GRAPH-SLOPE]",
        ],
      },
    ),
    step(
      "precautions",
      "Precautions",
      "State two precautions.",
      "Write two precautions you took, stated as things you did.",
      {
        whyItWorks: [
          "WAEC credits a precaution when it is written as something done, not as an order. [docs/07 5.2 PRECAUTIONS; WAEC Phys P3 2008, 2014, 2018, 2023 expected answers]",
          "Think back to what you did to keep your readings reliable. Any two valid precautions earn the marks, but the two must be different ideas: tight connections and plugs pushed in count as one. [docs/07 5.1]",
        ],
      },
    ),
    step(
      "law",
      "(b)(i)",
      "Mention and state the law on which the experiment is based.",
      "Name the law the experiment is based on, then state it in full.",
      {
        whyItWorks: [
          // CHECK: the condition is a separate DRAFT mark; the split stays DRAFT until the official scheme.
          "One law links V and I for a metal wire. A full answer names it, states it and gives the condition it needs.",
        ],
      },
    ),
    step(
      "length",
      "(b)(ii)",
      "A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).",
      "Show your working from the formula to the answer, and give the unit.",
      {
        whyItWorks: [
          // CHECK: (b)(ii) mark split, DRAFT: formula, area, value, unit.
          "Start from the resistivity formula, work in metres, and give the unit.",
        ],
      },
    ),
  ],
  poses: {
    bench: { azimuthDeg: 0, elevationDeg: 42, target: [0, 0, -0.05], distanceM: 1.4 },
    wire: { azimuthDeg: 0, elevationDeg: 50, target: [0, 0, 0.16], distanceM: 0.7 },
    connect: { azimuthDeg: 0, elevationDeg: 48, target: [0, 0, -0.08], distanceM: 1.5 },
    readings: { azimuthDeg: 0, elevationDeg: 40, target: [-0.1, 0, -0.2], distanceM: 0.95 },
    box: { azimuthDeg: 0, elevationDeg: 38, target: [-0.3, 0, -0.25], distanceM: 0.8 },
  } satisfies Record<string, CameraPose>,
  thumbnails: {},
  identify: [
    {
      part: "cells",
      name: "Dry cells (two) and holder, E",
      symbol:
        "One long thin line (the positive terminal) next to one short thick line (the negative terminal). Two cells in series are drawn as two such pairs one after the other, labelled E.",
      whatItDoes:
        "The cells provide the e.m.f. that pushes current round the circuit. The holder joins the two cells in series and brings out one + and one − terminal.",
      howToUse:
        "Press each cell in with its + end on the + contact. Take the + terminal to the plug key and the − terminal to Y on the wire board.",
      commonMistake:
        "Drawing the cell symbol with the long line as the negative terminal, or fitting a cell the wrong way round.",
    },
    {
      // CHECK: plug key symbol (two terminal dots with a gap, plug bar when closed) is kept; WAEC convention to confirm.
      part: "key",
      name: "Plug key, K",
      symbol:
        "Two terminal dots with a gap between them, labelled K. A plug bar is drawn across the gap when the key is closed.",
      whatItDoes:
        "It switches the circuit on and off. Current flows only while the brass plug sits between the two brass blocks.",
      howToUse:
        "Push the plug in with a small twist to close the key. Pull it right out to open it, and keep it open whenever you are not reading.",
      commonMistake:
        "Leaving the key closed between readings, so the cells run down and the readings drift.",
    },
    {
      part: "ammeter",
      name: "Ammeter, A",
      symbol: "A circle with the letter A inside, drawn in the main line (in series).",
      whatItDoes:
        "It measures the current in the circuit in amperes. It has a very low resistance, so it hardly changes the current. [Nelkon & Parker]",
      howToUse:
        "Connect it in series with its + terminal on the cells' positive side. Check the zero before closing the key, and read with the pointer covering its image in the mirror strip.",
      commonMistake:
        "Connecting the ammeter in parallel across the wire, or with its terminals reversed.",
    },
    {
      part: "voltmeter",
      name: "Voltmeter, V",
      symbol:
        "A circle with the letter V inside, drawn in a branch across the component (in parallel).",
      whatItDoes:
        "It measures the potential difference between two points in volts. It has a very high resistance, so it takes almost no current. [Nelkon & Parker]",
      howToUse:
        "Connect it across X and Y only, with the + terminal at X. Check the zero before closing the key, and read with the pointer covering its image in the mirror strip.",
      commonMistake:
        "Connecting the voltmeter across the wire and the resistance box together, or in series with the wire.",
    },
    {
      // CHECK: arrow-box variable resistor is kept, zigzag also accepted; WAEC form to confirm.
      part: "box",
      name: "Plug-type resistance box, R",
      symbol:
        "A narrow rectangle in the line, labelled R. The variable-resistance symbol is the same rectangle with an arrow drawn diagonally across it. The arrow says the resistance can be changed. A zigzag is also accepted.",
      whatItDoes:
        "It gives a known resistance in steps. A plug that is pushed in bypasses its coil. When a plug is pulled out, that coil is added to the circuit, and R is the sum of the coils whose plugs are out. A rheostat is also a variable resistor: a long coil of resistance wire with a sliding contact, so its resistance changes smoothly but cannot be read exactly from the scale, which is why a plug box is used here. Both are drawn with the arrow symbol. [Nelkon & Parker]",
      howToUse:
        "Pull only the plugs whose coils add up to the R you want, and push every other plug in firmly. Open the key before changing a plug.",
      commonMistake:
        "Thinking a pulled plug removes a coil when it adds that coil, or leaving a plug loose so the box does not give the R written in the table.",
    },
    {
      part: "wire",
      name: "Resistance wire XY on its board, with the metre rule",
      symbol:
        "A long narrow rectangle in the line with X written at one end and Y at the other. Some diagrams draw a zigzag instead.",
      whatItDoes:
        "The wire is constantan, a copper-nickel alloy. Its resistance changes very little with temperature and its resistivity is high, so it behaves well in this experiment. [Nelkon & Parker] The graph slope gives the resistance of this wire.",
      howToUse:
        "Keep the wire straight. Measure XY along the metre rule from X to Y with the eye directly above each mark, and do not touch or bend the wire.",
      commonMistake:
        "Measuring the length from the end of the board instead of from X to Y, or reading the metre rule with the eye to one side.",
    },
    {
      part: "leads",
      name: "Connecting leads and crocodile clips",
      symbol:
        "A plain straight line. A dot is drawn where two wires join. Wires that cross with no dot are not joined.",
      whatItDoes:
        "Insulated copper wires carry current between the parts with very little resistance. A crocodile clip is a spring jaw at the end of a lead that grips a terminal or a bare wire.",
      howToUse:
        "Rub the bare ends with sandpaper, fix them under the terminals, and clip the jaws onto clean metal, never onto plastic. Keep the leads short and untangled.",
      commonMistake:
        "A loose clip, or a clip gripping the insulation, so the pointer flickers or sits at zero.",
    },
    {
      part: "nuts",
      name: "Terminal screws",
      symbol:
        "A small circle (or dot) at the end of each part's symbol. On the meters they are marked + and −.",
      whatItDoes:
        "Each is a metal post where a lead is fixed so current can enter or leave the instrument.",
      howToUse:
        "Loosen the screw, slide the cleaned bare end around the post, and tighten by hand until firm. Check that no stray strand touches the next terminal.",
      commonMistake:
        "Tightening on the plastic insulation or on a dirty, oxidised end, which leaves a poor contact.",
    },
    {
      part: "sandpaper",
      name: "Sandpaper strip",
      symbol: "None. It is not drawn in a circuit diagram.",
      whatItDoes:
        "It rubs oxide and dirt off the bare ends of leads and off the terminals. Oxide adds resistance at a contact. [Nelkon & Parker]",
      howToUse:
        "Rub the end of each lead and the terminal contacts a few times before connecting, then wipe off the dust.",
      commonMistake:
        "Skipping the cleaning and leaving oxide on the ends, which gives unsteady readings.",
    },
    {
      part: "paper",
      name: "Graph paper, pencil and exercise book",
      symbol: "None.",
      whatItDoes:
        "The exercise book holds the length, the table and the answers to part (b). The graph paper holds the plot, and a sharp pencil gives thin, accurate points and a thin line.",
      howToUse:
        "Draw the table with headings and units. Plot V on the vertical axis and I on the horizontal axis, with a ruler and a scale that fills more than a third of the page.",
      commonMistake:
        "A small, cramped graph or an axis with no quantity or unit. [WAEC Phys P3 reports; GRAPH-AXES, GRAPH-SCALE]",
    },
    {
      part: "micrometer",
      name: "Micrometer screw gauge (identification only)",
      symbol: "None.",
      whatItDoes:
        "It measures a small thickness, such as the diameter of a wire, to a hundredth of a millimetre. [Nelkon & Parker] It is on the tray for identification only: part (b)(ii) gives the diameter, so nothing is measured with it in this practical.",
      howToUse:
        "Close the jaws with the ratchet and note the zero error. Place the wire between the jaws, turn the ratchet until it clicks, and read the sleeve and the thimble.",
      commonMistake:
        "Forgetting the zero error, or squeezing the wire by turning the thimble instead of the ratchet.",
    },
  ] satisfies IdentifyCard[],
};
