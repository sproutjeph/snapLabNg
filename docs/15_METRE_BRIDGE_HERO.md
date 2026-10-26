# 15 · The Metre Bridge Hero: Your Image, Done Right

*Decided Oct 22, 2026: the **metre bridge** (the practical in `image.png`) is the hero. **Titration** is the second act and the **glass block** is a stretch item. This document is the design for the new hero. Docs 00, 03, 04, 06, 07, 09, 10, 11, 12 and 13 were updated to match. WAEC facts below come from WAEC's own e-Learning pages (links in §9). "Metre bridge" is WAEC's spelling.*

---

## 1. What changed and why

| | Before (Oct 21) | Now (Oct 22) |
|---|---|---|
| Hero | Titration | **Metre bridge** (Physics Paper 3, electricity question) |
| Second act | Glass block | **Titration** (Chemistry Paper 3) |
| Stretch | — | Glass block; potentiometer mode |
| Hero line | "The examiner took a mark off for 24.5" | "The examiner took half a mark off for **57**, and asked why she **dragged the jockey**" |

**Why it works.** The metre bridge is the most visual practical in the syllabus: brass, a needle, a long wire and current you can watch move. It recurs in WAEC Physics Paper 3 as a metre bridge in 2011 and 2018, and as a potentiometer-style bridge in 2014 and 2023. Its marking scheme is concrete: lengths to 1 d.p., derived values to 3 s.f., a composite table, a graph with a large triangle, and precautions in the right tense. About **847,000** candidates sat Physics Paper 3 in 2023 (mean 29/50). Pairing it with titration puts both sciences in the demo.

**The cost, said plainly.** Titration was the most researched part of the plan, and the metre bridge has the harder engine (a circuit solve rather than one formula). Titration now gets about 1.5 build days instead of 3, so its indicator trap and burette parallax drop to COULD (doc 09). The examiner questions stay SHOULD.

**About "potentiometer".** `image.png` is labelled "PHY PRACTICAL – METER BRIDGE". It shows a resistance box, a galvanometer, a slide wire, a jockey, a Leclanché cell and a key, so the hero is the metre bridge. A potentiometer uses the same 1 m wire, jockey and galvanometer. WAEC's 2023 question was a slide-wire balance with a centre-zero galvanometer. The engine is a general wire-and-resistors solver, so a **potentiometer mode** (compare two emfs: E₁/E₂ = l₁/l₂) is a COULD item that needs no new physics.

## 2. Better than the image

The image is a strong mood board. Built literally, it would teach wrong physics and show a WAEC score card that doesn't exist. Here is what we keep and what we fix.

| In the image | Problem | What we build instead |
|---|---|---|
| Glowing blue current pulses along every wire | Decorative. It implies the wire glows and current is the same everywhere | **Current you can trust.** Particles move at a speed set by the *solved* current in each branch, in the direction of conventional current. At balance, the **galvanometer branch goes still and dark** while current keeps flowing through the wire. The null point is the hero visual |
| A µA meter as a plain dial | Fine, but static | A **centre-zero galvanometer** whose needle is a damped spring at 120 Hz. It swings through zero as you tap closer to balance, and **slams against its stop** if you tap far away with no protective resistor |
| "Gesture-control" finger sliding the jockey | **Sliding the jockey is a mistake WAEC marks** ("the jockey was not dragged along the wire") | **Tap to contact.** If you drag, the wire gets a visible scrape and later balance points drift. The examiner asks about it |
| "WAEC SCORE 18/20: Apparatus Connection, Observation (2dp), Viva Voce, Graph (2/3 Scale)" | Physics lengths are 1 d.p. There is no viva in WASSCE, and "2/3 scale" is invented (WAEC says at least 1/3). It is not a real question structure | A **scheme-style card** modelled on WAEC's May/June 2023 Q3: observations 9, graph 6, slope 2, intercept 1, evaluation 1, accuracy 1, precautions 2. Each lost half-mark links to the WAEC page it comes from |
| A graph that floats as decoration | Not hers | **Her own graph, marked.** SAM 3.1 outlines the graph on her page, and the engine measures whether it fills at least 1/3 of the page. Wonder reads her axes, points and slope triangle. The engine checks the triangle is large and her slope matches her own points |
| "Brass resistance box" as a prop | — | A **working plug box**. Pull a plug and that coil enters the circuit. With every plug in (R = 0) there is **no balance point on the wire**, and the needle stays pinned to one side. That is the honest version of the old "short circuit" scene |
| "Hand-drawn components" boxes | — | Her ink diagram is checked: is there a **key**? Is the galvanometer between the R–X junction and the jockey? Spark reports setup issues, and the examiner circles them on her drawing |

We keep the image's look: green SAM outlines rising from the ink, brass and Bakelite, glass panels, the desk and the exercise book. Every moving thing is computed.

## 3. The physics engine (summary; full model in doc 07 §4)

- **Circuit:** a 3-node solve (wire end A, the R–X junction B, the jockey J; the far end C is ground) by Kirchhoff's current law, run whenever something changes. It includes the cell's emf and internal resistance, the wire split at the jockey (ρ·l and ρ·(100 − l)) plus small end resistances, the R and X arms, and the galvanometer with an optional protective resistor.
- **Balance:** R/X = (l + α₁)/(100 − l + α₂), with end corrections α₁ and α₂. "Interchange R and X and average" cancels them. A balance near the middle of the wire gives the smallest error.
- **Galvanometer:** current through it = Thevenin voltage ÷ (Thevenin resistance + galvanometer + protective resistance). The needle is a damped oscillator stepped at a fixed 120 Hz and clamped at full scale, which gives the slam.
- **Leclanché cell:** with the key closed, the emf sags and the internal resistance rises (polarisation). This lowers sensitivity but not the balance point. Opening the key lets it recover, which is why WAEC wants "the key was opened between readings".
- **Wire:** constantan (α ≈ 8×10⁻⁶ /K). It warms by a few degrees and **never glows**. Scrapes raise local resistance by a few percent, so later balance points shift.
- **Golden values** (X = 3.0 Ω, R = 1 to 5 Ω): ideal balance lengths 25.0, 40.0, 50.0, 57.1 and 62.5 cm. With a small end correction they come out near 24.5, 39.8, 50.0, 57.3 and 62.8 cm.

## 4. The golden question (written WAEC-style, our own wording)

> **3.** You are provided with a metre bridge AC, a resistance box R, a resistor X, a Leclanché cell E, a centre-zero galvanometer G, a key K, a jockey J and connecting wires.
> (i) Connect the circuit as shown in the diagram. (ii) With R = 1 Ω, close K and use the jockey to find the balance point B. Measure and record l = AB. (iii) Repeat for R = 2, 3, 4 and 5 Ω. (iv) Evaluate R⁻¹ and l⁻¹ in each case. (v) Tabulate your results. (vi) Plot l⁻¹ on the vertical axis against R⁻¹ on the horizontal axis. (vii) Determine the slope, s, and the intercept, c, on the vertical axis. (viii) Evaluate X = s/c. (ix) State two precautions taken to ensure accurate results.

The science: R/X = l/(100 − l) gives l⁻¹ = (X/100)·R⁻¹ + 1/100. So s = X/100 and c = 1/100, and X = s/c. The 100 cancels, so the student never has to assume the wire is exactly 100 cm.

**Scheme-style marking** (structure from WAEC May/June 2023 Q3; item wording from the 2011, 2014, 2018 and 2023 expected answers):

| Item | Marks | Rule code |
|---|---|---|
| Five values of l, each to at least 1 d.p. in cm (½ each) | 2½ | PHYS-1DP |
| Five values of R⁻¹ and five of l⁻¹, each to at least 3 s.f. (½ each, capped) | 5 | PHYS-3SF |
| A composite table showing R, l, R⁻¹ and l⁻¹, with units | 1½ | PHYS-TABLE |
| Both axes correctly labelled, with quantity and unit | 1½ | GRAPH-AXES |
| Reasonable scales; the graph fills at least 1/3 of the page; no scales in multiples of 3 | 1½ | GRAPH-SCALE |
| Five points correctly plotted (checked against her table) | 1½ | GRAPH-POINTS |
| Line of best fit | 1½ | GRAPH-LINE |
| Slope from a large right-angled triangle, Δ values shown | 2 | GRAPH-SLOPE |
| Intercept correctly shown and read | 1 | GRAPH-INTERCEPT |
| X = s/c evaluated correctly from her own s and c | 1 | PHYS-EVAL |
| X within ±10% of the teacher's value (Teacher mode only; never shown to students otherwise) | 1 | PHYS-ACCURACY |
| Any two correct precautions, **in acceptable tense** (1 each) | 2 | PRECAUTIONS |
| **Total** | **22** (21 without Teacher mode) | |

Accepted precautions (from WAEC expected answers): the key was opened between readings; the jockey was not dragged along the wire; connections were tight and terminals clean; parallax was avoided when reading the metre rule; zero error was noted or corrected; repeated readings were shown in the table.

## 5. The golden page, Amina's metre bridge (exact content in doc 11 §2)

Flawed version G1. Her readings:

| R (Ω) | l (cm) | R⁻¹ (Ω⁻¹) | l⁻¹ |
|---|---|---|---|
| 1.0 | 25.3 | 1.00 | 0.0395 |
| 2.0 | 39.8 | 0.500 | 0.0251 |
| 3.0 | 50.2 | 0.333 | **0.02** |
| 4.0 | **57** | 0.250 | 0.0175 |
| 5.0 | 62.4 | 0.200 | 0.0160 |

**The answer key** (what the examiner must catch):

| Mistake on the page | Rule | Marks lost |
|---|---|---|
| "57", not to 1 d.p. | PHYS-1DP | ½ |
| l⁻¹ = "0.02", not to 3 s.f. | PHYS-3SF | ½ |
| The l⁻¹ column and the vertical axis have no unit (cm⁻¹) | PHYS-TABLE, GRAPH-AXES | ½ + ½ |
| The graph is about a quarter of the page | GRAPH-SCALE | ½ |
| Slope from a small triangle between two neighbouring points | GRAPH-SLOPE | 1 |
| Precaution "Avoid parallax error" is an instruction, not a past-tense statement | PRECAUTIONS | 1 |
| Precaution "I slid the jockey gently along the wire to find the balance point" describes the mistake WAEC penalises | PRECAUTIONS | 1 |
| No key drawn in the circuit | Setup issue (circled, no mark) | — |

**Result: 15½/21** in student mode (accuracy is only marked when a teacher enters a value). The clean version G2 scores **21/21**.

Reference values for tests (never shown to students): the best-fit slope of her points is 0.0294 Ω cm⁻¹ and the intercept is 0.0102 cm⁻¹. Reading c as 0.0100 from a good graph gives X = 2.94 Ω. Using the best-fit intercept gives X = 2.88 Ω. Both are within ±10% of the true 3.0 Ω.

## 6. The experience, moment by moment

1. **It reads my page.** Her photo flattens onto the desk, and her ink circuit glows and lifts. SAM 3.1 outlines the cell, key, resistance box, galvanometer, wire and her graph.
2. **It comes alive.** Brass, Bakelite and a long wooden metre bridge rise out of the ink, and the wires route along her drawn lines. Spark's blueprint puts her values ("R = 1, 2, 3, 4, 5 Ω") into the box's plugs.
3. **⚡ Find the null.** She taps the jockey on the wire. The needle swings left, then right, and she homes in. At balance the galvanometer branch goes **still and dark**, a soft click plays, and the reading appears on her lab notebook. Pull a plug and the balance point moves. Drag the jockey and the wire scrapes.
4. **Read the metre rule at eye level.** Tilt the phone (or use a slider on a laptop) and the jockey's reading drifts: "+0.3 cm, read at eye level". The same parallax mechanic is reused for the burette in act two.
5. **⭐ The examiner marks her page.** Her real table and graph fill the screen. Red ink circles "57" (*"lengths to at least 1 d.p.: 57.0"*), draws a box showing the graph covers about 1/4 of the page (*"at least 1/3"*), redraws her slope triangle large, and strikes "Avoid parallax error" (*"state precautions as things you did: 'Parallax was avoided…'"*). Marks fill in item by item: **"Question 3: 15½/21"**.
6. **Examiner questions,** chosen from her mistakes: *"Why must you not slide the jockey?"* · *"Why is the bridge wire made of constantan?"* · *"Why open the key between readings?"* · *"Why is a balance point near the middle better?"*

## 7. What each Meta model does here

| Model | Job on the metre bridge page |
|---|---|
| **Muse Spark 1.3** | Compiles the blueprint: `experiment: "meter_bridge"`, components, the R values and her circuit's setup issues (a missing key, the galvanometer in the wrong branch) |
| **SAM 3.1** | Outlines each drawn component and **her graph**. The engine turns the graph mask's area into the GRAPH-SCALE check, so SAM has a real, scored job |
| **Muse Wonder 1.0** | Reads the table (`text_as_written`, so "57" stays "57"), the axis labels and units, her plotted points, her triangle's corners, s, c and X, and her precautions word for word |
| **Voice Transcribe + Spark** | The examiner questions (unchanged) |
| **Muse Image** | Optional "your setup in a real lab" card (unchanged) |

Contract additions (doc 04 §4): the experiment enum gains `meter_bridge`; Lab Blueprint `values.meter_bridge` holds the R values, the unknown's label, the cell and the galvanometer type, each with `as_written`; Page Readings gains a nullable `graph` block (axis labels and units, points, triangle corners, s, c, box) and `precautions[]` as written.

## 8. Risks specific to the hero

| Risk | Mitigation |
|---|---|
| Wonder misreads graph points or triangle corners | Golden pages are recorded. A "confirm your graph" step lets her drag points. Points are checked against her own table, so a misread shows up as a mismatch to confirm, never as a silent mark |
| SAM doesn't find "graph" on fresh pages | Fall back to Spark's approximate box for the area check, and say so in the drawer |
| The circuit solve is subtle (signs, end corrections) | Opus writes it; `science-verifier` checks it; tests use textbook values (balance at 50.0 cm when R = X; R = 0 gives no balance; the 1/l–1/R line has slope X/100) |
| Titration is squeezed | Titration keeps drip, colour, overshoot and the 2 d.p./concordance marking. The indicator trap and burette parallax move to COULD |
| The hand-drawn circuit has unusual topology | Templates, not free-form wiring: the bench is always the standard metre bridge circuit, and her drawing only feeds setup issues |

## 9. Sources (WAEC e-Learning, fetched Oct 22, 2026)
- May/June 2023 Q3B (slide-wire balance, centre-zero galvanometer; mark split; precautions "in acceptable tense"; accuracy ±10%): https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html
- May/June 2018 Q3A (metre bridge; d to 1 d.p. in cm; I⁻¹ to 3 s.f.; composite table; "the jockey was not dragged along the wire"; "Performance was poor"): https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html
- Nov/Dec 2011 Q3 (metre bridge with standard resistor; lengths to 1 d.p.; "Their graphs were poorly drawn"): https://waeconline.org.ng/E-Learning/Physics/Phys320nq3.html
- May/June 2014 Q3 (potentiometer; x⁻¹ to 3 d.p.; "do not slide the jockey or let it scratch the wire"): https://waeconline.org.ng/E-Learning/Physics/Phys3223nq3.html
- 2008 Q3 (potentiometer; "Jockey not allowed to scratch resistance wire"; precautions "in acceptable form of speech"): https://waeconline.org.ng/E-Learning/Physics/Phys217mq3.html
- Graph at least 1/3 of the page; large right-angled triangle; scales in multiples of 3 not accepted: see `research/03_science_waec.md`
- Physics Paper 3 2023: 846,875 candidates, mean 29/50: https://waeconline.org.ng/E-Learning/Physics/Phys340mc.html
