# 07 · Science Engine and WAEC Rule Engine

*The physics, chemistry and marking rules SnapLab computes. Described in words and equations only; no code before Oct 26. Every claim is backed in `research/03_science_waec.md` (VERIFIED = WAEC page or reference fetched; REASONED = first principles or standard textbook).*

> **Why this document matters most for winning:** an education judge, or any Nigerian science teacher who tries the demo, will test the science first. The original spec's science had errors a teacher would catch in seconds (a glowing constantan wire, carbonate treated as hydroxide, invented WAEC penalties). Scientific honesty is our credibility. The engine below is small, exact and unit-tested.

---

## 1. Engine principles

1. **Deterministic.** Same inputs, same outputs, every time. No randomness except clearly cosmetic effects (smoke wisps, swirl noise).
2. **Pure functions in TypeScript**, one module per experiment, no side effects, unit-tested against textbook and WAEC model-answer values.
3. **Fixed 120 Hz steps** inside the render loop; rendering at the device's refresh rate.
4. **SI units internally**; WAEC units and precision in the UI (cm³ to 2 d.p., cm to 1 d.p., derived values to 3 s.f.).
5. **AI never computes science.** The AI supplies parameters read from the page (with `as_written` text); the engine computes; the Rule Engine marks.
6. **Teacher notes panel** shows the equations and assumptions for each experiment.

---

## 2. Titration (second act, since Oct 22)

### 2.1 What the student does
Fill the burette (acid), pipette the base into the conical flask, add indicator, run titrant drop by drop (0.05 cm³ per drop; a stream when the stopcock is fully open), swirl, stop at the first colour change that **persists about 30 seconds**, read the burette, repeat until **two titres are concordant**, average only the concordant ones.

### 2.2 The pH model: one charge-balance solve
The spec's model is wrong in four ways (it treats carbonate as hydroxide, has no first end point, its equivalence branch is unreachable, and its "ratio > 1.5 means carbonate" shortcut breaks for Ca(OH)₂ + 2HCl, which WAEC set in 2019). Replace it with **one equation solved for [H⁺] by bisection** over pH 0–14 (monotonic, about 50 iterations, microseconds):

> [Na⁺ or K⁺] + 2[Ca²⁺] + [H⁺] = [OH⁻] + [Cl⁻ or NO₃⁻] + 2[SO₄²⁻] + [HCO₃⁻] + 2[CO₃²⁻] + [CH₃COO⁻]

with total analytical concentrations after mixing (moles ÷ total volume), K_w = 10⁻¹⁴, carbonate pK_a1 = 6.35 and pK_a2 = 10.33, ethanoic acid pK_a = 4.76, and H₂SO₄ treated as fully dissociated at school level. Closed system (no CO₂ loss) by default; an optional small CO₂ loss on swirling reproduces the slightly "fading" methyl orange end point.

**This single equation correctly covers** every WAEC acid–base pair: HCl/NaOH, H₂SO₄/NaOH, HCl/Na₂CO₃ (both end points, ≈ pH 8.3 and ≈ pH 3.8), HCl/Ca(OH)₂, ethanoic acid/NaOH (equivalence ≈ pH 8.7) and the double-indicator method.

### 2.3 Mole ratio: derived, never guessed
- The equivalence volume is V_eq = (n_A/n_B) × C_B × V_B / C_A, i.e. WAEC's own C_A V_A / C_B V_B = n_A / n_B.
- The spec's `stoichiometricRatio` field has no direction, so the model could fill it backwards and silently halve or double the titre. "Wrong mole ratio" is a named WAEC complaint.
- **Fix:** the AI returns the **balanced equation as written**; the engine parses it and derives n_A/n_B deterministically, cross-checked against a small table of known WAEC reactions.

### 2.4 Indicators (real colour model)
| Indicator | Range | Colours | WAEC end-point wording |
|---|---|---|---|
| Methyl orange | pH 3.1–4.4 (pK_In ≈ 3.46) | red → orange → yellow | "from yellow to orange" (yellow to **red** means overshot) |
| Phenolphthalein | pH 8.0–10.0 (pK_In ≈ 9.3) | colourless → pink | "from pink to colourless" |
| Methyl red | pH 4.4–6.2 | red → yellow | (in the syllabus; missing from the spec) |

Colour = blend of acid-form and base-form colours by the fraction α = 1 / (1 + 10^(pK_In − pH)), blended in absorbance space (Beer–Lambert) and converted to RGB. This gives the realistic **faint-pink** phenolphthalein end point, not a hard step. The spec's piecewise RGB ramp was labelled "Henderson–Hasselbalch" but wasn't.

### 2.5 The indicator trap (our best honest drama)
Pick phenolphthalein for sodium trioxocarbonate(IV) against HCl and the flask decolourises at the **first** end point, about **half** the titre. The examiner question: *"Why is your titre half of your classmate's?"* Answer: carbonate has two end points; methyl orange detects the second.

### 2.6 Parallax (the phone-tilt mechanic)
- The graduations are on the front of the tube; the meniscus bottom is about one bore radius behind. Apparent shift Δh ≈ d_eff · tan θ, so **ΔV ≈ 0.4–0.6 · tan θ cm³** for a 50 cm³ burette: about **0.08–0.1 cm³ at 10°** and **0.2–0.25 cm³ at 25°**. (The spec's 0.24·sin θ was arbitrary and about 2× too small.)
- **Sign:** the scale increases downward, so an eye **above** the meniscus reads a **smaller** number; below reads larger.
- θ is the **virtual camera's elevation relative to the meniscus**, computed from scene geometry (the gyro moves the camera; the camera angle decides the error).
- Read the **bottom** of the meniscus for colourless solutions, the **top** for coloured ones such as KMnO₄.
- **Teaching gold:** a consistent angle largely cancels in the titre (final − initial); reading initial and final from different heights is the real damage.

### 2.7 Readings and status
- Burette readings recorded to 2 d.p., the last digit 0 or 5 (burette graduated in 0.1 cm³, estimated to ±0.05). WAEC's own model table uses 14.45, 26.60, 38.65, 12.65, 12.15, 12.05.
- **Concordance** is agreement between the student's **own** titres. **Accuracy** is closeness to the **teacher's** titre. The spec conflated them (and used 0.10 in code but 0.20 in the rubric). We keep them separate.
- **The expected titre is never shown to the student.**

---

## 3. Rectangular glass block, pin method (stretch, since Oct 22)

### 3.1 What WAEC sets (VERIFIED, May/June 2023 Q2A and others)
Trace the block outline and draw the normal; set the angle of incidence i between 10° and 50°; place pins P1, P2 on the incident ray; looking through the block, place P3, P4 in line with the images of P1, P2; remove the block; join to get the refracted ray; measure r and the lateral displacement d. Five traces, lengths to 1 d.p. in cm, tangents to 3 d.p., accuracy ±10% of the teacher's value. The 2023 question plots d against (tan i − tan r).

### 3.2 Model
- Snell's law: n₁ sin i = n₂ sin r, with n_glass ≈ 1.50–1.52 (configurable).
- The emergent ray is parallel to the incident ray.
- Lateral displacement: d = t · sin(i − r) / cos r, for block thickness t.
- Critical angle: sin c = 1/n; total internal reflection needs glass-to-air travel **and** an angle above c.
- Pin alignment is a sight-line check: P3 and P4 must be collinear with the refracted images of P1 and P2. No general ray tracer is needed.

### 3.3 What the examiner checks on her traces (VERIFIED scheme items)
Five complete traces; a **separate outline per trace** (−1 if all traces share one outline); normals drawn; arrows on traces (−½ **once** if no arrows on at least one trace, **not** per arrow as the spec said); pin marks visible (no traces or no pin marks loses **all** observation marks); pins about 5 cm apart; readings to 1 d.p.; traces in **pencil**, not biro.

---

## 4. Metre bridge (the hero, since Oct 22)

*Design, golden question and marking scheme: `15_METRE_BRIDGE_HERO.md`. WAEC sets it as the Physics Paper 3 electricity question (metre bridge 2011 and 2018; slide-wire balance with a centre-zero galvanometer 2023; potentiometer 2008 and 2014). All VERIFIED on WAEC e-Learning pages listed in doc 15 §9.*

### 4.1 What the student does
Connect a Leclanché cell and key across the ends A and C of the 100 cm wire; put the resistance box R in the left gap and the unknown X in the right gap; connect the centre-zero galvanometer from the R–X junction B to the jockey J. Close the key, **tap** the jockey on the wire to find the point of no deflection, record l = AB to 1 d.p. in cm, open the key, change R, repeat. Evaluate R⁻¹ and l⁻¹ to 3 s.f., plot l⁻¹ against R⁻¹, find slope s and intercept c, evaluate X = s/c.

### 4.2 Model
- **Circuit solve:** 3 unknown node voltages (A, B and the jockey J, with C grounded), Kirchhoff's current law at each, solved by Gaussian elimination whenever an input changes (jockey position or contact, plugs, key). Elements: cell emf E and internal resistance r (through the key); the wire as two resistors ρ·l + e₁ and ρ·(100 − l) + e₂ split at the jockey (e₁, e₂ = small end resistances); arms R and X; the galvanometer r_g plus an optional protective resistor, present only while the jockey touches the wire.
- **Balance with end corrections:** R/X = (l + α₁)/(100 − l + α₂). "Interchange R and X and average" (the mean of l₁ and 100 − l₂) cancels the unequal part α₂ − α₁ exactly and leaves (k − 1)(α₁ + α₂)/(2(1 + k)) with k = R/X, which is zero at R = X and small near the middle. So a balance near the middle minimises both the end error and the percentage error.
- **Galvanometer:** centre-zero. I_g = V_Th / (R_Th + r_g + r_protect). The needle is a damped oscillator, θ'' + 2ζω₀θ' + ω₀²θ = k·I_g, stepped at the fixed 120 Hz and clamped at full scale, so a far-from-balance tap **slams** it against the stop.
- **Leclanché polarisation:** while the key is closed, E sags slowly and r rises; with the key open both recover. Sensitivity drops; the balance point does not move. This is the reason for "the key was opened between readings".
- **Scraping:** dragging the jockey raises ρ by a few percent over the dragged segment, so later balance points shift by a few millimetres. Shown as a visible scratch.
- **R = 0 (all plugs in):** B sits at A's potential, so there is **no balance point on the wire**; the needle stays to one side wherever she taps.
- **Temperature:** copper ≈ 3.9×10⁻³ /K, nichrome ≈ 4×10⁻⁴ /K, **constantan ≈ 8×10⁻⁶ /K**. The wire warms by a few degrees and **never glows**; the element that warms most when R = 0 is X.
- **Current display:** particle speed per branch ∝ the solved current (log-scaled for visibility), direction = conventional current. At balance the galvanometer branch carries no particles.
- **Graph:** l⁻¹ = (X/100)·R⁻¹ + 1/100, so s = X/100, c = 1/100 cm⁻¹, X = s/c. (The spec's "R against 1/l" is not linear for its configuration.)
- **Golden values** (X = 3.0 Ω): ideal l = 25.0, 40.0, 50.0, 57.1, 62.5 cm for R = 1–5 Ω. The golden page's points give a best-fit slope 0.0294 Ω cm⁻¹ and intercept 0.0102 cm⁻¹.

### 4.3 Potentiometer mode (COULD)
The same wire and solver with a driver cell across AC and a test cell through the galvanometer to the jockey: E₁/E₂ = l₁/l₂ at balance; internal resistance r = R(l₀/l − 1) with a shunt R. No new physics, only a different template.

---

## 5. WAEC Rule Engine

### 5.1 How marking works
- WAEC awards marks **positively, item by item** (e.g. 2019 titration scheme: *"Two concordant titres = 8 marks; Averaging = 2 marks"*). It does not deduct for unseen actions such as "you didn't open the key"; it marks what is **written**.
- Our engine runs each scheme item against the extracted readings and the lab log, returning **earned / lost**, the rule code, the value and its location on the page, and the WAEC report link.
- The AI writes the explanation only. The score is reproducible.
- Totals mirror the real paper: Chemistry Paper 3 is 50 marks over three compulsory questions; the titration question is about 20–25. Physics Paper 3 is 50 marks, answer 2 of 3.

### 5.2 Rule table (spec rules corrected)

| Code | Rule | Status | Source |
|---|---|---|---|
| CHEM-BUR-2DP | Burette readings and titres recorded to 2 d.p. ("24.5" fails; "24.50" passes). Recommend last digit 0 or 5 | **Requirement real.** The spec's "−1 per column" is invented; marks follow the scheme items | WAEC Chem P3 2023 strengths/weaknesses pages |
| CHEM-CONCORD | Average only concordant titres (agreeing within a tolerance) | **Principle real.** The 0.20 cm³ figure is widely taught but **not found on any WAEC page**: make it configurable (default 0.20), praise ≤ 0.10. "±0.20" wording is wrong: it is a maximum difference between titres. Spec's "−2" invented | WAEC weaknesses ("averaging of non concordant titres"); model answer averages 12.15 and 12.05, rejects 12.65 |
| CHEM-ROUGH | Rough titre not included in the average | Real (part of concordance) | Same |
| CHEM-PARALLAX | Read at eye level; bottom of meniscus (colourless), top (coloured) | Real good practice; marked when stated as a precaution | WAEC physics precaution lists |
| CHEM-MOLE-RATIO | Correct mole ratio from the balanced equation | Real, a named complaint | WAEC Chem P3 report |
| CHEM-3SF | Final answers to 3 significant figures; units on the average titre; state symbols in equations | Real | WAEC Chem P3 reports |
| CHEM-ENDPOINT | Correct indicator and end-point colour change wording | Real | WAEC 2022 model answer |
| PHYS-OPT-TRACES | Five traces, separate outline each, normals, pin marks, pencil | Real | WAEC Phys P3 2023 Q2A |
| PHYS-OPT-ARROW | Arrows on traces: −½ **once** if no arrows on at least one trace | Real (spec's per-arrow penalty wrong) | Same |
| PHYS-1DP | Lengths to at least 1 d.p. in cm (½ per value) | Real (the spec's physics "Observation (2dp)" is wrong) | WAEC Phys P3 2011, 2018, 2023 expected answers |
| PHYS-3SF | Derived values (R⁻¹, l⁻¹) to at least 3 s.f. (½ per value) | Real | WAEC Phys P3 May/June 2018 Q3A |
| PHYS-TABLE | Composite table showing all measured and derived quantities, with units in the headers | Real | WAEC Phys P3 2011, 2018, 2023 |
| GRAPH-AXES | Both axes labelled with quantity and unit | Real | WAEC Phys P3 2023 Q3B; Phys327aw |
| GRAPH-POINTS | Points correctly plotted (checked against her own table) | Real | WAEC Phys P3 2023 Q3B |
| GRAPH-LINE | Line of best fit | Real | WAEC Phys P3 2011, 2018, 2023 |
| GRAPH-INTERCEPT | Intercept correctly shown and read | Real | WAEC Phys P3 2023 Q3B |
| PHYS-EVAL | Final quantity (X = s/c) evaluated correctly from her own s and c | Real | WAEC Phys P3 schemes |
| PHYS-ACCURACY | Result within ±10% of the teacher's value (Teacher mode only) | Real | WAEC Phys P3 2023 Q3B |
| GRAPH-SCALE | Graph occupies **at least 1/3** of the page; reasonable scale (not multiples of 3); axes labelled with quantity and unit; origin shown when an intercept is needed | Real. **The spec's "2/3 of the grid" is invented**; WAEC's own report says at least 1/3 | WAEC Phys P3 Nov/Dec 2013 and others |
| GRAPH-SLOPE | Slope from a **large** right-angled triangle | Real. The spec's "≥ 2/3 of the line" is invented | WAEC Phys P3 reports |
| PRECAUTIONS | Any two valid precautions, **in acceptable tense** (stated as things done: "the key was opened between readings"), awarded positively. Metre bridge list: key opened between readings; jockey not dragged along the wire; tight connections, clean terminals; parallax avoided at the metre rule; zero error noted or corrected; repeated readings shown | Real | WAEC Phys P3 2008, 2014, 2018, 2023 expected answers |
| ~~VIVA~~ | Oral viva | **Does not exist in WASSCE.** Our "examiner questions" mirror written part (b) questions | WASSCE scheme of examination |

### 5.3 Rubric data file (shape, not code)
Each rule: code, subject, question type, description, how it is checked (which extracted fields), marks as in the scheme, the fix text in English and Pidgin, the WAEC source URL, and a status flag (verified / configurable / teacher-set). Stored as one versioned JSON file shared by client and server.

---

## 6. Examiner question bank (seed list, all grounded)

**Metre bridge (hero):** Why must you not slide the jockey along the wire? Why is the bridge wire made of constantan? Why open the key between readings? Why is a balance point near the middle of the wire better? How do you eliminate end error? What does the galvanometer show at balance, and why is it centre-zero? Does a weakening cell change the balance point?

**Titration:** Why rinse the burette with the acid, and why *not* the conical flask with the base? Why use a white tile? Why remove the funnel before reading? What makes titres concordant? Why methyl orange, not phenolphthalein, for a carbonate? Which part of the meniscus do you read? Name a suitable indicator and its end-point colour. How would you recover the salt formed?

**Glass block:** State Snell's law. What does n = 1.65 mean? State the conditions for total internal reflection. Why space the pins about 5 cm apart? Why look at the bottoms of the pins?


**Rule for the examiner:** ask about **her** specific mistake first; accept Pidgin answers; model the answer in clear formal English (WAEC flags candidates who cannot "express themselves clearly in simple language").

---

## 7. Test plan for the engine (written Day 2 onwards)
- Metre bridge: balance at 50.0 cm when R = X; l = 100R/(R + X) with zero end resistance; interchange-and-average cancels α₂ − α₁ and, at R = X, the whole end error; R = 0 gives no balance on the wire; I_g = 0 at balance; needle clamps at full scale; polarisation changes sensitivity but not l; scraping shifts l by the expected few mm; the golden points give s = 0.0294 Ω cm⁻¹, c = 0.0102 cm⁻¹ (least squares).
- Titration: V_eq for each WAEC reaction against hand-worked answers (including 2HCl + Na₂CO₃, Ca(OH)₂ + 2HCl, H₂SO₄ + 2NaOH); pH at both carbonate end points; ethanoic acid equivalence ≈ 8.7; indicator colours at key pH values; parallax magnitude and sign at 10° and 25°.
- Glass block: r from i and n; d from t, i, r; TIR threshold; parallel emergent ray.
- Rule Engine: the golden pages produce exactly the expected item-by-item marks (metre bridge G1 15½/21, G2 21/21, doc 15 §5); "57" fails PHYS-1DP; "0.02" fails PHYS-3SF; "Avoid parallax error" fails the tense check; "I slid the jockey…" is not accepted; "24.5" fails 2 d.p.; a rough titre in the average fails concordance.
