# Ohm's law (V-I): lesson copy, DRAFT for science review

Status: draft text only. Nothing here is wired into the app.

House rules followed in this draft:
- Nigerian/WAEC wording: metre rule, dry cells, plug key, resistance box, trioxocarbonate(IV) style naming where relevant.
- No expected reading, expected current or voltage at any R, resistance of XY, or slope value appears anywhere. Feedback is about procedure and technique.
- Precautions are stated as things that WERE done (tense rule, `packages/rules/src/precautions.ts`).
- Source hints in square brackets. Anything unsure is marked CHECK.
- Circuit (corrected): cell + to K; K to A(+); A(-) to R; R to X; Y to cell -; V(+) to X; V(-) to Y.
- Plug box rule used throughout: plug IN = coil bypassed (adds nothing). Plug PULLED OUT = coil added. R = 0 means every plug is in.

---

## 1. Steps

Fields per step: `title`, `instruction` (question's own words), `plain`, `whyItWorks`, `precautions` (ids refer to section 3).

### 1.0 Identify

- **title:** Identify the apparatus
- **instruction:** You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.
- **plain:** Tap each of the 11 items on the bench and match it to its name before you start wiring.
- **whyItWorks:**
  - You must know which meter goes in series and which goes across the wire before any lead is connected. [Nelkon & Parker]
  - The ammeter and voltmeter look alike, so the letter on the dial is the only safe check.
  - Seeing the plug box and the plug key first makes the later steps (pulling plugs, closing the key) easy to follow.
- **precautions:** none at this step.

### 1.1 Measure the length XY

- **title:** Measure the length of the wire XY
- **instruction:** Measure and record the length XY of the resistance wire provided.
- **plain:** Tap the metre rule to zoom in, line your eye up over the X end and read it, do the same at the Y end, then write XY in cm to 1 decimal place.
- **whyItWorks:**
  - The length is read between the two terminals X and Y, because only that piece of wire is across the voltmeter.
  - Lengths are written to at least 1 d.p. in cm. [WAEC Phys P3 expected answers; PHYS-1DP in docs/07 5.2]
  - With the eye straight above each mark, parallax does not shift the reading. [Nelkon & Parker]
- **precautions:** P8 (wire straight, eye directly above the rule), P3 (parallax avoided).

### 1.2 Connect the circuit (7 sub-steps, one per lead)

Shared instruction for 2a to 2g: *Connect the circuit as shown in the diagram.*
Tip shown once above the sub-steps: keep the key open (plug out) the whole time you are wiring.

#### 1.2a Cell + to key

- **title:** Lead 1: cells to key
- **instruction:** Connect the circuit as shown in the diagram. (Lead 1 of 7)
- **plain:** Tap the + terminal of the cells, then the left terminal of the key.
- **whyItWorks:**
  - Current is taken to flow out of the + terminal of the cells, so the circuit is built from there. [Nelkon & Parker]
  - Putting the key first lets one plug switch the whole circuit on or off.
- **precautions:** P1 (key open while wiring), P2 (ends of leads cleaned, connections tight).

#### 1.2b Key to ammeter +

- **title:** Lead 2: key to ammeter
- **instruction:** Connect the circuit as shown in the diagram. (Lead 2 of 7)
- **plain:** Tap the right terminal of the key, then the + terminal of the ammeter.
- **whyItWorks:**
  - The ammeter must carry all the current, so it sits in the main line, in series. [Nelkon & Parker]
  - Current enters at the + terminal, so the pointer moves the right way. A reversed meter pushes the pointer against its stop.
- **precautions:** P6 (ammeter in series, + terminal on the cell's positive side).

#### 1.2c Ammeter - to resistance box

- **title:** Lead 3: ammeter to resistance box
- **instruction:** Connect the circuit as shown in the diagram. (Lead 3 of 7)
- **plain:** Tap the - terminal of the ammeter, then one terminal of the resistance box.
- **whyItWorks:**
  - The box is in series with the wire, so changing R changes the current in the whole loop. [Nelkon & Parker]
  - Current leaves the ammeter at its - terminal and carries on round the loop.
- **precautions:** P7 (box plugs firm, contacts tight and clean).

#### 1.2d Resistance box to X

- **title:** Lead 4: resistance box to X
- **instruction:** Connect the circuit as shown in the diagram. (Lead 4 of 7)
- **plain:** Tap the other terminal of the resistance box, then terminal X on the wire board.
- **whyItWorks:**
  - Current enters the wire at X, so X is the end nearer the cell's + side. [Nelkon & Parker]
  - The wire XY is now in series with the box and the ammeter.
- **precautions:** P2 (connections tight, terminals clean).

#### 1.2e Y to cell -

- **title:** Lead 5: Y back to the cells
- **instruction:** Connect the circuit as shown in the diagram. (Lead 5 of 7)
- **plain:** Tap terminal Y on the wire board, then the - terminal of the cells.
- **whyItWorks:**
  - This lead completes the loop, so current can flow once the key is closed.
  - A loop with a gap anywhere reads zero on the ammeter.
- **precautions:** P2 (connections tight, terminals clean).

#### 1.2f Voltmeter + to X

- **title:** Lead 6: voltmeter to X
- **instruction:** Connect the circuit as shown in the diagram. (Lead 6 of 7)
- **plain:** Tap the + terminal of the voltmeter, then terminal X on the wire board.
- **whyItWorks:**
  - X is the end of the wire at the higher potential, so the voltmeter's + terminal goes there. [Nelkon & Parker]
  - Joining the voltmeter at X puts it in parallel with the wire, not in the main line.
- **precautions:** P6 (voltmeter in parallel across the wire, + terminal towards the cell's positive side).

#### 1.2g Voltmeter - to Y

- **title:** Lead 7: voltmeter to Y
- **instruction:** Connect the circuit as shown in the diagram. (Lead 7 of 7)
- **plain:** Tap the - terminal of the voltmeter, then terminal Y on the wire board.
- **whyItWorks:**
  - The voltmeter now reads the potential difference across XY only, not across the box. [Nelkon & Parker]
  - A voltmeter has a very high resistance, so it takes almost no current from the wire. [Nelkon & Parker]
- **precautions:** P6 (voltmeter in parallel across the wire), P2 (connections tight).

### 1.3 R = 0

- **title:** First reading, R = 0 ohm
- **instruction:** With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.
- **plain:** Check every plug in the resistance box is pushed in (that makes R = 0), then push the plug into the key, read the ammeter, read the voltmeter, and pull the plug out of the key.
- **whyItWorks:**
  - A plug that is pushed in bypasses its coil, so with every plug in the box adds no resistance. [Nelkon & Parker]
  - With no resistance from the box, the current is at its greatest for this experiment, so the key is closed only long enough to read both meters. CHECK: qualitative direction only, remove if the reviewer thinks it hints at the reading.
  - The two meters are read at the same moment so I and V belong to the same state of the circuit.
  - Readings are recorded as the scale allows: 0.02 A divisions on the ammeter and 0.05 V divisions on the voltmeter, so 2 d.p. is natural for each. CHECK: WAEC wording on decimal places for meter readings (docs/07 5.2 lists lengths and derived values only).
- **precautions:** P4 (zero errors checked with the key still open), P1 (key opened after the reading), P3 (parallax avoided on both meters).

### 1.4 R = 1 ohm

- **title:** Second reading, R = 1 ohm
- **instruction:** Set R = 1 Ω, close the key, read and record I and V.
- **plain:** With the key open, pull the 1 Ω plug out of the box, then close the key, read the ammeter and voltmeter, and open the key again.
- **whyItWorks:**
  - Pulling a plug adds that coil to the circuit, so R is now the 1 Ω coil. [Nelkon & Parker]
  - More resistance in series changes the current, which gives a new pair of I and V values for the graph.
  - Changing the plugs with the key open keeps the contacts from sparking and the wire from warming.
- **precautions:** P1 (key opened before changing plugs and after reading), P7 (plugs firm), P3 (parallax avoided).

### 1.5 Remaining R values and the table

- **title:** Repeat for R = 5, 10, 20, 40 and 60 ohm, then tabulate
- **instruction:** Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate.
- **plain:** For each value, open the key, push the old plugs back in, pull the plugs listed below, close the key, read I then V, open the key, and type the row into the table.
  - R = 5 Ω: pull the 5 Ω plug.
  - R = 10 Ω: pull the 10 Ω plug.
  - R = 20 Ω: pull one 20 Ω plug.
  - R = 40 Ω: pull both 20 Ω plugs.
  - R = 60 Ω: pull the 50 Ω plug and the 10 Ω plug.
  - Table headings: R / Ω, I / A, V / V. Units go in the headings, not in the cells.
- **whyItWorks:**
  - A plug box adds the pulled coils together, so each total above is exact. [Nelkon & Parker]
  - Seven pairs of readings spread over a wide range of R give a better straight line than two or three pairs. [Nelkon & Parker]
  - A table with the quantity and unit in each heading, and every value to a consistent number of decimal places, earns the table mark. [WAEC Phys P3 2011, 2018, 2023; PHYS-TABLE in docs/07 5.2]
- **precautions:** P1 (key opened between readings), P7 (plugs firm), P5 (readings repeated or checked), P3 (parallax avoided).
- CHECK: whether to add a V/I column. Not asked by the question, so left out. A derived column would need 3 s.f. (PHYS-3SF).

### 1.6 Plot V against I

- **title:** Plot the graph of V against I
- **instruction:** Plot V (vertical) against I (horizontal).
- **plain:** Tap the graph paper, write V / V on the vertical axis and I / A on the horizontal axis, choose a scale that fills more than a third of the page, mark each point with a small cross, and draw one straight best-fit line with a ruler and sharp pencil.
- **whyItWorks:**
  - V goes on the vertical axis and I on the horizontal axis because the question says so, and the slope is then V divided by I. [Nelkon & Parker]
  - Both axes need the quantity and the unit. [WAEC Phys P3 2023 Q3B; GRAPH-AXES]
  - The graph must fill at least a third of the page, with an easy scale (not multiples of 3). [WAEC Phys P3 Nov/Dec 2013 and others; GRAPH-SCALE]
  - A best-fit line has points scattered on both sides of it, so small reading errors cancel out. [Nelkon & Parker]
- **precautions:** none at this step.
- CHECK: whether to tell the student to show the origin. docs/07 says "origin shown when an intercept is needed". Left out so it does not hint at the shape of the line.

### 1.7 Slope s

- **title:** Find the slope s
- **instruction:** Determine the slope s.
- **plain:** Tap two points far apart on your line (read them off the line, not from the table), write down their V and I, and work out change in V divided by change in I.
- **whyItWorks:**
  - Slope = change in V divided by change in I, so it has the unit V per A, which is the ohm. [Nelkon & Parker]
  - From Ohm's law, the slope gives the resistance of the wire XY.
  - A large right-angled triangle makes small reading errors matter less. [WAEC Phys P3 reports; GRAPH-SLOPE]
  - Using points on the line, not table points, is what makes it a best-fit slope. [WAEC Chief Examiner's report] CHECK: exact report wording.
- **precautions:** none at this step.

### 1.8 Two precautions

- **title:** State two precautions
- **instruction:** State two precautions.
- **plain:** Write two precautions in your exercise book as things that were done, using "was" or "were", for example "The key was opened between readings."
- **whyItWorks:**
  - WAEC credits a precaution when it is written as something done, not as an order. [docs/07 5.2 PRECAUTIONS; WAEC Phys P3 2008, 2014, 2018, 2023 expected answers]
  - Any two valid precautions earn the marks, so pick the two you are surest you did. [docs/07 5.1]
- **precautions:** the answer step itself; the accepted list is in section 3.

### 1.9 (b)(i) The law

- **title:** State Ohm's law
- **instruction:** Mention and state the law on which the experiment is based.
- **plain:** Write the name of the law and its statement in your exercise book, and add the condition that must hold for it to be true.
- **whyItWorks:**
  - The experiment checks that the current and the voltage across the wire go up together in the same proportion. [Nelkon & Parker]
  - A complete answer names the law and gives its condition, because the law holds only if the conditions stay constant. [WAEC Chief Examiner's report] CHECK: whether WAEC awards the condition as a separate mark.
- **precautions:** none.

### 1.10 (b)(ii) Calculate the length

- **title:** Calculate the length of the wire
- **instruction:** A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).
- **plain:** Write R = ρL/A, find the area A from the diameter (after changing mm to m), rearrange for L, and give the answer with its unit.
- **whyItWorks:**
  - Resistance of a wire = resistivity times length divided by cross-sectional area. [Nelkon & Parker]
  - The cross-section is a circle, so A = πd²/4. Resistivity is in Ω m, so d must be in metres. [Nelkon & Parker]
  - WAEC gives marks for the formula, the substitution and the answer with its unit. [WAEC marking style] CHECK: exact mark split.
- **precautions:** none.

---

## 2. Identify cards

### 2.1 Dry cells x2 and holder (E)

- **name:** Dry cells (two) and holder, E
- **symbol:** One long thin line (the positive terminal) next to one short thick line (the negative terminal). Two cells in series are drawn as two such pairs one after the other, labelled E.
- **whatItDoes:** The cells give the voltage that pushes current round the circuit. The holder joins the two cells in series and brings out one + and one - terminal.
- **howToUse:** Press each cell in with its + end on the + contact. Take the + terminal to the plug key and the - terminal to Y on the wire board.
- **commonMistake:** Drawing the cell symbol with the long line as the negative terminal, or fitting a cell the wrong way round.

### 2.2 Plug key K

- **name:** Plug key, K
- **symbol:** A gap in the line between two small thick bars, labelled K. The gap is filled when the plug is in (key closed) and empty when the plug is out (key open). CHECK: WAEC drawing convention for the plug key.
- **whatItDoes:** It switches the circuit on and off. Current flows only while the brass plug sits between the two brass blocks.
- **howToUse:** Push the plug in with a small twist to close the key. Pull it right out to open it, and keep it open whenever you are not reading.
- **commonMistake:** Leaving the key closed between readings, so the wire warms and the cells run down.

### 2.3 Ammeter A

- **name:** Ammeter, A (0 to 1 A, 0.02 A per small division)
- **symbol:** A circle with the letter A inside, drawn in the main line (in series).
- **whatItDoes:** It measures the current in the circuit in amperes. It has a very low resistance, so it hardly changes the current. [Nelkon & Parker]
- **howToUse:** Connect it in series with its + terminal on the cell's positive side, check the zero before closing the key, and read with your eye directly in front of the pointer.
- **commonMistake:** Connecting the ammeter in parallel across the wire, or with its terminals reversed.

### 2.4 Voltmeter V

- **name:** Voltmeter, V (0 to 3 V, 0.05 V per small division)
- **symbol:** A circle with the letter V inside, drawn in a branch across the component (in parallel).
- **whatItDoes:** It measures the potential difference between two points in volts. It has a very high resistance, so it takes almost no current. [Nelkon & Parker]
- **howToUse:** Connect it across X and Y only, with the + terminal at X. Check the zero before closing the key and read with your eye directly in front of the pointer.
- **commonMistake:** Connecting the voltmeter across the wire and the resistance box together, or in series with the wire.

### 2.5 Resistance box R

- **name:** Plug-type resistance box, R (coils 1, 2, 2, 5, 10, 20, 20, 50 ohm)
- **symbol:** A narrow rectangle in the line, labelled R. The variable-resistance symbol is the same rectangle with an arrow drawn diagonally across it. The arrow says the resistance can be changed. Some textbooks draw the arrow pointing at the side of the rectangle, which means a sliding contact. CHECK: which form WAEC diagrams use.
- **whatItDoes:** It gives a known resistance in steps. A plug that is pushed in bypasses its coil. When a plug is pulled out, that coil is added to the circuit, and R is the sum of the coils whose plugs are out. [Nelkon & Parker]
- **howToUse:** Pull only the plugs whose coils add up to the R you want, and push every other plug in firmly. Open the key before changing a plug.
- **commonMistake:** Thinking a pulled plug removes a coil, when it adds that coil, or leaving a plug loose so the box does not give the R written in the table.
- **rheostat note (shown with this card):** A rheostat is a variable resistor. It is a long coil of resistance wire wound on an insulating tube, with a sliding contact on top. Sliding the contact changes how much wire is in the circuit, so the resistance changes smoothly. You cannot read its exact value from the scale, so a plug box is used here where known values are needed. Both are drawn with the arrow symbol. [Nelkon & Parker]

### 2.6 Resistance wire XY on its board with the metre rule

- **name:** Resistance wire XY on a board, with the metre rule
- **symbol:** A long narrow rectangle in the line with X written at one end and Y at the other. Some diagrams draw a zigzag instead.
- **whatItDoes:** The wire is constantan (a copper-nickel alloy), whose resistance changes very little with temperature, so it behaves well in this experiment. [Nelkon & Parker] The graph slope gives the resistance of this wire.
- **howToUse:** Keep the wire straight. Measure XY along the metre rule from X to Y with your eye directly above each mark, and do not touch or bend the wire.
- **commonMistake:** Measuring the length from the end of the board instead of from X to Y, or reading the metre rule with the eye to one side.

### 2.7 Connecting leads (with crocodile clips)

- **name:** Connecting leads and crocodile clips
- **symbol:** A plain straight line. A dot is drawn where two wires join. Wires that cross with no dot are not joined.
- **whatItDoes:** Insulated copper wires carry current between the parts with very little resistance. A crocodile clip is a spring jaw at the end of a lead that grips a terminal or a bare wire.
- **howToUse:** Rub the bare ends with sandpaper, fix them under the terminals, and clip the jaws onto clean metal, never onto plastic. Keep the leads short and untangled.
- **commonMistake:** A loose clip, or a clip gripping the insulation, so the pointer flickers or sits at zero.

### 2.8 Terminal screws

- **name:** Terminal screws
- **symbol:** A small circle (or dot) at the end of each part's symbol. On the meters they are marked + and -.
- **whatItDoes:** Each is a metal post where a lead is fixed so current can enter or leave the instrument.
- **howToUse:** Loosen the screw, slide the cleaned bare end around the post, and tighten by hand until firm. Check that no stray strand touches the next terminal.
- **commonMistake:** Tightening on the plastic insulation or on a dirty, oxidised end, which leaves a poor contact.

### 2.9 Sandpaper strip

- **name:** Sandpaper strip
- **symbol:** None. It is not drawn in a circuit diagram.
- **whatItDoes:** It rubs oxide and dirt off the bare ends of leads and off the terminals. Oxide adds resistance at a contact. [Nelkon & Parker]
- **howToUse:** Rub the end of each lead and the terminal contacts a few times before connecting, then wipe off the dust.
- **commonMistake:** Skipping the cleaning and leaving oxide on the ends, which gives unsteady readings.

### 2.10 Graph paper, pencil and exercise book

- **name:** Graph paper, pencil and exercise book
- **symbol:** None.
- **whatItDoes:** The exercise book holds the length, the table and the answers to part (b). The graph paper holds the plot, and a sharp pencil gives thin, accurate points and a thin line.
- **howToUse:** Draw the table with headings and units. Plot V on the vertical axis and I on the horizontal axis, with a ruler and a scale that fills more than a third of the page.
- **commonMistake:** A small, cramped graph or an axis with no quantity or unit. [WAEC Phys P3 reports; GRAPH-AXES, GRAPH-SCALE]

### 2.11 Micrometer screw gauge

- **name:** Micrometer screw gauge
- **symbol:** None.
- **whatItDoes:** It measures a small thickness, such as the diameter of the wire, to 0.01 mm. [Nelkon & Parker] It is not needed in steps 1 to 8. It is here for the wire diameter used in part (b)(ii). CHECK: confirm the micrometer is part of this practical's bench.
- **howToUse:** Close the jaws with the ratchet and note the zero error. Place the wire between the jaws, turn the ratchet until it clicks, and read the sleeve and the thimble. Measure at three places along the wire, in two directions at right angles, and take the average.
- **commonMistake:** Forgetting the zero error, or squeezing the wire by turning the thimble instead of the ratchet.

---

## 3. Precautions (reported / past tense)

Each line is written so it passes the tense rule in `packages/rules/src/precautions.ts`: it contains "was" or "were", does not start with an instruction word, and has no modal (should, must, will, can, could, may, would) and no "not".

| Id | Precaution (as the student writes it) | Why it matters |
|---|---|---|
| P1 | The key was opened between readings. | Current heats the wire, and a warm metal has a different resistance, so the temperature would no longer be constant. It also saves the cells. [Nelkon & Parker; WAEC Phys P3 expected answers] |
| P2 | All connections were tight and the terminals were cleaned with sandpaper. | Loose or dirty contacts add resistance and make the pointers flicker. [WAEC Phys P3 2008, 2014, 2018, 2023] |
| P3 | Parallax error was avoided by reading the pointers and the metre rule with the eye directly in front of the mark. | An eye to one side reads a different division from the true one. [Nelkon & Parker; WAEC Phys P3 expected answers] |
| P4 | The zero error of each meter was checked and corrected before the readings were taken. | A pointer that rests off zero shifts every reading by the same amount. [Nelkon & Parker] |
| P5 | Each reading was repeated to check it. | A repeat shows up a slip in reading and makes the point on the graph more reliable. [WAEC Phys P3 expected answers] CHECK: whether WAEC credits "readings repeated" in a single-run V-I experiment. |
| P6 | The ammeter was connected in series and the voltmeter in parallel across the wire, with both + terminals on the cell's positive side. | The wrong connection gives a wrong reading or can damage the meter. [Nelkon & Parker] |
| P7 | The plugs of the resistance box were pushed in firmly so the contacts were tight and clean. | A loose plug adds extra resistance, so R is not the value written down. [Nelkon & Parker] |
| P8 | The wire XY was straight while its length was measured with the eye directly above the rule. | A bent wire or an eye to one side gives the wrong length. [Nelkon & Parker] |

CHECK: engine coverage. In `precautions.ts`, only P1 (`key_opened`), P2 and P7 (`tight_clean_connections`), P3 (`parallax_avoided`), P4 (`zero_error`) and P5 (`repeated_readings`) match a listed topic. P6 and P8 would return `not_a_listed_precaution`. P2 and P7 map to the same topic, which the rules owner may want to treat as one precaution. The `jockey_not_dragged` topic does not apply to this practical.

CHECK: P4 uses the singular "zero error" on purpose, because the topic regex is `\bzero error\b` and "zero errors" does not match.

---

## 4. Examiner asks

1. **Question:** Why was the key opened between readings?
   **Model answer:** The current heats the wire, and the resistance of a metal rises with temperature, so Ohm's law would no longer hold. Opening the key also saves the cells. [Nelkon & Parker]

2. **Question:** Why is the voltmeter connected across X and Y and not across the resistance box as well?
   **Model answer:** V is the potential difference across the wire only, so the voltmeter must be in parallel with the wire alone. If the box were included, the reading would also contain the voltage across the box. [Nelkon & Parker]

3. **Question:** Why is the wire made of constantan?
   **Model answer:** Constantan's resistance changes very little with temperature, so the wire keeps a steady resistance even if it warms a little. [Nelkon & Parker] CHECK: WAEC also accepts "high resistivity" as a reason.

4. **Question:** What does the slope of your V-I graph represent?
   **Model answer:** The slope is V divided by I, so it gives the resistance of the wire XY, and its unit is the ohm. [Nelkon & Parker]

5. **Question:** What would the graph look like if the wire warmed up as the current grew?
   **Model answer:** The line would curve and the slope would grow, because the resistance of a metal rises as it warms, so Ohm's law would no longer hold. [Nelkon & Parker] CHECK: the curve bends upward when V is vertical and I is horizontal.

6. **Question:** Why do you find the slope with a large triangle?
   **Model answer:** A large triangle uses points far apart on the best-fit line, so a small error in reading a point changes the slope by only a small fraction. [WAEC Phys P3 reports; GRAPH-SLOPE]

---

## 5. (b) answers

### (b)(i) Ohm's law

The current through a metallic conductor is directly proportional to the potential difference across its ends, provided temperature and other physical conditions remain constant. [Nelkon & Parker; WAEC Chief Examiner's report] CHECK: exact accepted wording in the WAEC scheme.

### (b)(ii) Length of the wire

Working, with the formula, the substitution and the unit shown:

- Resistance of a wire: R = ρL/A, so L = RA/ρ.
- d = 0.2 mm = 0.2 × 10⁻³ m.
- A = πd²/4 = (22/7) × (0.2 × 10⁻³)² / 4 = 3.143 × 10⁻⁸ m².
- L = RA/ρ = (7 × 3.143 × 10⁻⁸) / (8.8 × 10⁻⁷) = 0.25 m.

Check of the arithmetic: (0.2 × 10⁻³)² = 4 × 10⁻⁸; (22/7) × 4 × 10⁻⁸ / 4 = 3.143 × 10⁻⁸; 7 × 3.143 × 10⁻⁸ = 2.2 × 10⁻⁷; 2.2 × 10⁻⁷ / 8.8 × 10⁻⁷ = 0.25. [Nelkon & Parker]

---

## 6. CHECK index (for the science reviewer)

1. Meter-reading decimal places (step 1.3): is 2 d.p. the WAEC expectation for 0.02 A and 0.05 V divisions?
2. Qualitative direction statements (step 1.3 "current at its greatest", Examiner ask 5 "line would curve"): remove if they hint too much.
3. Whether to add a V/I column (step 1.5) and whether to mention the origin (step 1.6).
4. Plug key and variable-resistance symbol conventions in WAEC diagrams (cards 2.2, 2.5).
5. Terminal names "left" and "right" of the key (steps 1.2a, 1.2b) and UI verbs ("tap", "zoom") must match the 3D model and the actual controls.
6. Precaution P5 (repeated readings) for a single-run V-I experiment.
7. Engine topic coverage for P6 and P8, and P2/P7 sharing one topic (section 3).
8. Micrometer: confirm it is on the bench (card 2.11).
9. Wording of the WAEC mark split for (b)(i) condition and (b)(ii) working.
10. Constantan card: WAEC may also accept "high resistivity" (Examiner ask 3).
