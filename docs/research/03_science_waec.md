# 03 — Science and WAEC content review: SnapLab NG

**Scope:** the science and education content of `SNAPLAB_NG_MASTER_ARCHITECTURE.md` (sections 1, 5, 6.2, 7) and the two concept images (`image.png` is the meter bridge, `image-2.png` is the titration). Infrastructure is out of scope.

**Labels:** a claim marked **VERIFIED** has a URL I fetched and read. A claim marked **REASONED** comes from physics/chemistry first principles or standard textbook knowledge and is not tied to a WAEC document. Where I searched and found nothing, the text says **UNVERIFIED**.

---

## 0. Verdict up front

1. **The meter bridge "short circuit" is physically wrong, and it is the centrepiece of the demo.** Setting R_box = 0 does not short the cell. It shorts one arm of the bridge. The 100 cm constantan wire cannot glow cherry red from a 1.5–2 V cell, and constantan is chosen precisely because its resistance barely changes with temperature. The code applies copper's temperature coefficient (0.004/K) to the unknown resistor, using the temperature of the bridge wire. Any Nigerian physics teacher will catch this. It also contradicts the textbook viva answer to "why is the bridge wire made of constantan?". (REASONED; constantan coefficient VERIFIED below.)
2. **The galvanometer model is dimensionally meaningless.** `(jockey − null)/50 × emf × 48` is not a current. Replace it with a 3-node nodal solve or a Thevenin equivalent that includes galvanometer resistance (section 1.4).
3. **The titration pH model teaches wrong chemistry for the experiment WAEC sets most often (Na₂CO₃ vs HCl).** It treats carbonate as hydroxide. With phenolphthalein it would put the end point at the full 2:1 titre, when in reality phenolphthalein changes at the *first* equivalence, which is half the titre. That is the classic exam question. The hard-coded "pH 3.85 if ratio > 1.5" uses the mole ratio as a stand-in for "is a carbonate" and gives wrong answers for Ca(OH)₂ + 2HCl and for H₂SO₄ + Na₂CO₃. (REASONED; two-stage carbonate VERIFIED.)
4. **The rubric in section 7 mixes real WAEC practice with invented thresholds and invented penalties.**
   - Real: 2 d.p. burette readings, averaging only concordant titres, keeping the key open between readings, large slope triangle, arrows on traces.
   - Invented or mis-stated: the "2/3 of graph sheet" rule (WAEC's own chief examiner wrote "at least 1/3"), the "slope triangle ≥ 2/3 of the line" rule, "−½ per missing arrow" (the real rule is −½ once if a trace lacks arrows), the per-column and −2 penalties, and a viva.
   - WAEC awards precautions as positive marks; it does not deduct for them. The scorecard "18/20 with Viva Voce" does not exist: Physics Paper 3 is 50 marks, two questions answered out of three, and there is no viva.
5. **The "70% of schools without functional labs" statistic is unsourced.** I found no national figure. The best sourced data point is state-level: in Katsina, 123 of 432 secondary schools had science labs (AFP, 2017). One older national survey contradicts the 70% claim. Use the verified WAEC candidate numbers and WAEC's own chief-examiner remedies instead.
6. **The product also has a factual error in its framing.** School candidates in labless schools do not sit "Alternative to Practical". That paper is for private candidates. School candidates sit a real hands-on practical, often meeting the apparatus for the first time on exam day. This is a stronger and true pitch.

---

## 1. Meter bridge physics (spec section 5, `step_meter_bridge_physics`)

### 1.1 What the spec gets right
- Balance condition `null = R/(R+X) × 100` is the correct ideal Wheatstone relation for R in the gap next to the end that l is measured from: R/X = l/(100 − l). (REASONED)
- The bridge wire is 100 cm of constantan, the jockey is brass, a Leclanché cell is used, and "open the key between readings" is a real precaution. (Precaution VERIFIED: "Open key when not taking readings" and "Avoid sliding jockey on wire", in the WAEC Nov/Dec 2013 Physics Paper 3 expected answers, https://waeconline.org.ng/E-Learning/Physics/Phys320nq3.html; also "keeping the key open between readings … not dragging the jockey", May/June 2018, https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html)
- Surprisingly, the heating constant `power_w × 1.8` (K/s per W) gives a heat capacity of 0.56 J/K, which matches a 1 m SWG 26 constantan wire: mass ≈ 1.46 g, c ≈ 390 J/(kg·K), so C ≈ 0.57 J/K. (REASONED) The constant is right, but it is applied to the wrong power (see 1.2).

### 1.2 What is wrong

| # | Spec behaviour | Problem | Label |
|---|---|---|---|
| a | `alpha = 0.0040` labelled "Constantan / Manganin vs Copper" | 0.004/K is **copper's** coefficient (≈3.9×10⁻³/K). Constantan's is about **8 ppm/K (8×10⁻⁶/K) at 20 °C**, and within ±40 ppm/K from −55 to 105 °C. Manganin is similar, a few ppm/K. That is roughly 500× smaller. The low coefficient is the textbook reason constantan is used for the bridge wire. | VERIFIED (constantan TCR: https://en.wikipedia.org/wiki/Constantan); rest REASONED |
| b | The temperature correction is applied to **the unknown resistor X**, using the **bridge wire's** temperature | Two different bodies are conflated. The bridge wire heats, but the code drifts X. If X is a coil of nichrome (α ≈ 4×10⁻⁴/K) it has its own power and its own temperature. | REASONED |
| c | "Short circuit" means `res_box_ohms ≤ 0.15`, and the whole bridge is replaced with 0.05 Ω | **R_box = 0 (all plugs in) shorts only the R arm.** The cell still sees the bridge wire (1–3 Ω) in parallel with X. The cell current rises only modestly. See 1.3. | REASONED |
| d | "The wire on the paper glows cherry red" | Visible glow starts at about 525 °C (Draper point) and cherry red is about 750–850 °C. A 1.5 V dry cell or 2 V accumulator across a 1–3 Ω wire delivers at most about 1.3–4 W into a 1 m wire. The steady temperature rise is P/(hA) ≈ 20–60 K. **The wire gets warm. It never glows.** The spec's own clamp of 220 °C cannot glow either, yet the shader starts the glow at 45 °C. | REASONED |
| e | `galvano_ua = (jockey − null)/50 × emf × 48` | Not a current. It ignores galvanometer resistance, arm resistances and wire resistance, and has invented constants. The real I_g is nonlinear in l and is milliamps far from balance, enough to pin a microamp needle. | REASONED |
| f | `null_cm.clamp(0.01, 0.99)` | Hides the most important real diagnostic: **no balance point on the wire**. The galvanometer deflects the same way at both ends. Students are taught to read this as a wrong connection or a badly chosen R. | REASONED |
| g | Newton cooling uses 0.45 s⁻¹ with the key open and 0.35 s⁻¹ with the key closed | The same body should have one cooling constant. Also τ ≈ 2–3 s is too fast for a thin wire in still air; C/(hA) gives roughly 10–40 s. | REASONED |
| h | `heating_rate = 38.0` °C/s when shorted | A constant with no physical basis. | REASONED |
| i | Power uses `parallel_branch_res`, the whole network | The wire's own power is V_AC²/r_wire, not I_total²·R_parallel. | REASONED |
| j | Sliding the jockey (spec §1.3, "Slide-Finger Jockey control") | **Dragging the jockey along the wire is a precaution WAEC explicitly marks against.** It scrapes the wire and makes it non-uniform. As specified, the app trains the forbidden technique. | VERIFIED (Phys320nq3, Phys327mq3A above) |
| k | No end corrections, no galvanometer resistance, no protective resistor | Without these the app cannot teach "interchange R and X and average", "balance near the middle", or "use a protective resistor or shunt first". These are standard meter bridge teaching points. | REASONED |
| l | Graph axis in rule PHYS-GRAPH-23: "R (Ω) against L⁻¹" | With the spec's own balance formula (R in the gap at the l = 0 end), R against 1/l is **not linear**. The straight-line forms are **1/l against 1/R** (slope X/100, intercept 1/100) or **l/(100 − l) against R** (slope 1/X). R against 1/l is linear only when R is in the other gap. The configuration and the graph contradict each other. | REASONED |

### 1.3 What R_box ≈ 0 actually does

Take a typical WAEC setup: a cell of EMF E with internal resistance r, connected through key K across the two ends A and C of the 100 cm wire (resistance r_w ≈ 1–3 Ω). The gaps are R (A to B) and X (B to C), and the galvanometer runs from B to the jockey J.

- **With all plugs in (R = 0):** point B sits at the potential of A. The potential at J is below A everywhere except at l = 0, so the galvanometer deflects **the same way at every jockey position**. Balance is at the very end of the wire, or off it. This is the real symptom. (REASONED)
- **Cell current** is E/(r + r_w ∥ X). With E = 1.5 V, r = 0.5 Ω, r_w = 2 Ω and X = 2 Ω, that is about 1.0 A, against about 0.82 A when R = X = 2 Ω. **It is not a short circuit.** (REASONED)
- **The bridge wire's power is barely changed.** With a low-resistance 2 V accumulator, V_AC ≈ E whatever the arms are. (REASONED)
- **The element that does heat more is X.** It now has the full V_AC across it. In the example its power rises from about 0.5 W to about 2 W, four times as much. If X is a bare nichrome or copper coil, this is where honest **thermal drift** happens. (REASONED)
- **The galvanometer.** With the jockey mid-wire, V_th ≈ 0.5 V and R_th ≈ 0.5 Ω. Against a galvanometer of about 50 Ω, I_g ≈ 10 mA, far beyond full scale for a school centre-zero galvanometer. **The real consequence is the needle slamming against the stop.** That is why a high protective resistor or a shunt is used until the student is near balance. School galvanometers generally do not have a "fuse" to pop. (REASONED)
- **A true short** happens when the cell terminals are bridged directly, for example a lead from A to C that bypasses everything. A Leclanché or dry cell then mostly heats itself through its internal resistance and drains or polarises. A lead-acid accumulator (r ≈ 0.01–0.05 Ω) can push tens to hundreds of amps, and **then a thin connecting lead can get dangerously hot**. That is the only honest version of a "glowing wire", and it belongs on a lab-safety card, not in the meter bridge physics. (REASONED)

### 1.4 Proposed correct model (prose and equations, no code)

**Circuit and nodes.** Ground C. The unknown node voltages are V_A, V_B and V_J, so this is a 3×3 linear solve every tick, which costs essentially nothing.
- The source is E in series with r, plus a rheostat R_h if present, plus the key. Model it as a Norton injection E/(r + R_h) into A, with conductance 1/(r + R_h) to C. With the key open, the source conductance is 0.
- The wire is two resistors: A to J is ρ′·l + e₁, and J to C is ρ′·(L − l) + e₂. Here ρ′ is the wire's resistance per cm, and e₁, e₂ are the end resistances at the brass strips, worth a few tenths of a cm to about 1 cm of equivalent length.
- The arms are R from A to B and X from B to C.
- The galvanometer is R_g (≈ 20–100 Ω) plus a protective resistor R_p (≈ 1–10 kΩ, switchable to 0) from B to J.
- To build the matrix, write Kirchhoff's current law at A, B and J (nodal analysis), and solve by Gaussian elimination.

**Thevenin form, for the UI and for intuition.** This assumes the source is stiff, which is fine near balance.
- V_AC = E · R_net / (R_net + r + R_h), where R_net = (R + X) ∥ (ρ′L + e₁ + e₂).
- V_B = V_AC · X / (R + X)
- V_J = V_AC · (ρ′(L − l) + e₂) / (ρ′L + e₁ + e₂)
- V_th = V_B − V_J
- R_th ≈ (R ∥ X) + [(ρ′l + e₁) ∥ (ρ′(L − l) + e₂)]
- I_g = V_th / (R_th + R_g + R_p)
- Needle deflection: θ = I_g / k_g (divisions per µA), saturating at ±N divisions. Raise a "needle slam" event when |I_g| exceeds about 1.2× full scale.

**Balance condition with end corrections.** I_g = 0 when R/X = (l + α₁)/(L − l + α₂), where α_i = e_i/ρ′. Ignoring end corrections, X = R(100 − l)/l. Teach the fix: **interchange R and X, take l₁ and l₂, and average.**

**Why balance near the middle.** For a reading uncertainty δl, the fractional error is δX/X = L·δl / [l(L − l)], which is smallest at l = L/2. Recommend R values that put l between 30 and 70 cm. (REASONED)

**Heating, per element k.**
- C_k dT_k/dt = P_k − G_k (T_k − T_amb), with P_k = V_k²/R_k(T) and R_k(T) = R_k0 [1 + α_k (T_k − T_0)].
- Coefficients (all VERIFIED or textbook):
  - copper ≈ 3.9×10⁻³/K
  - nichrome ≈ 4×10⁻⁴/K
  - constantan ≈ 1×10⁻⁵/K (VERIFIED: 8 ppm/K)
  - manganin ≈ 2–10×10⁻⁶/K
- For a 1 m SWG 26 constantan wire: C ≈ 0.6 J/K, G ≈ 0.02–0.06 W/K, τ = C/G ≈ 10–30 s. Use **one** G per body.
- Consequence: a 50 K rise changes the constantan wire's resistance by about 0.05%. The balance shift is far below the 0.1 cm reading resolution. Say this honestly in the viva. The real reasons to open the key are cell drain or polarisation (the Leclanché EMF sags and recovers), heating of X when it is a high-α coil, and safety. (REASONED)

**Cell polarisation.** E(t) decays slowly while the key is closed and recovers when it is open. The balance point is **independent of E**, because it is a null method. Only sensitivity drops. That makes a good viva question. (REASONED)

**Jockey wear.** If the jockey is dragged while pressed, increase ρ′ locally over the dragged segment. Later balances that cross that region then shift by a few tenths of a cm, so readings become inconsistent. This is an honest and visible consequence. (REASONED)

**Units.** Use SI internally and show cm only in the UI. Report l to 1 d.p. in cm, because WAEC expects d and l "to at least 1 d.p. in cm". (VERIFIED: Phys327mq3A, Phys320nq3)

---

## 2. Titration chemistry (`compute_titration_step`)

### 2.1 Equivalence volume and mole-ratio direction
- `V_eq = ratio × M_B × V_B / M_A` with `mole_ratio_acid_to_base = 2` for 2HCl + Na₂CO₃ is **correct as written**. It is the same as WAEC's C_A V_A / C_B V_B = n_A/n_B. (REASONED; WAEC uses this form: "Using CaVa/CbVb = na/nb", https://waeconline.org.ng/E-Learning/Chemistry/chem335jq1.html)
- **There is a direction risk.** The compiler schema field is just `stoichiometricRatio`, with no direction. An LLM may fill in base:acid, which silently halves or doubles V_eq. Rename it to `acidMolesPerBaseMole`, or better, have the model output the **balanced equation** and derive the ratio deterministically. "Wrong mole ratio" is a named WAEC examiner complaint. (VERIFIED: "lost marks for wrong mole ratio", https://waeconline.org.ng/E-Learning/Chemistry/chem321nq1.html)

### 2.2 The pH model is wrong in four ways
1. **Carbonate is treated as hydroxide.** Before equivalence, leftover Na₂CO₃ moles are used as [OH⁻]. 0.05 M Na₂CO₃ has pH ≈ 11.5, not 12.7. (REASONED, pK_b ≈ 3.67)
2. **There is no first equivalence point.** Na₂CO₃ + HCl has two: about pH 8.3 (CO₃²⁻ → HCO₃⁻, phenolphthalein) and about pH 3.7–3.9 (HCO₃⁻ → H₂CO₃/CO₂, methyl orange). (VERIFIED: "first equivalence point (pH ~ 8.3) using Phenolphthalein … second equivalence point (pH ~ 3.7) using Methyl Orange", https://riccachemical.com/pages/tech-tips/sodium-carbonate)
   - **Consequence:** with phenolphthalein, the spec turns the flask colourless only at the full 2:1 equivalence. In reality it decolourises at half the titre. This is a standard examination point (choosing methyl orange for carbonates), and the WAEC syllabus lists "double indicator" Na₂CO₃/NaHCO₃ analysis for Ghanaian candidates. (VERIFIED: https://rachel.core2learn.org/modules/en-wassce/WASSCESYLABUS/CHEMISTRY.pdf)
3. **The equivalence branch is unreachable.** `|n_added − n_eq| < 1e-6 mol` is narrower than one 0.05 cm³ drop of 0.1 M acid (5×10⁻⁶ mol), so the 3.85 / 7.0 branch is almost never hit. Also, "ratio > 1.5 means carbonate" is a bad proxy:
   - Ca(OH)₂ + 2HCl has ratio 2, so it gets 3.85; the correct answer is 7. WAEC 2019 used exactly this reaction. (VERIFIED: "Ca(OH)2 + 2HCl → CaCl2 + 2H2O", https://www.waeconline.org.ng/e-learning/Chemistry/chem328mq1B.html)
   - H₂SO₄ + Na₂CO₃ has ratio 1, so it gets 7.0; the correct answer is about 3.9.
   - For Ca(OH)₂ the code also divides [OH⁻] by the ratio, when it should multiply by 2 OH⁻ per formula unit.
4. **Weak acids are not handled.** The pH clamps of 7–13.3 and 1.1–7 cannot represent ethanoic acid against NaOH (equivalence pH ≈ 8.7) or any buffer region. The syllabus explicitly includes "combinations of weak and strong acids and bases with suitable indicators". (VERIFIED: rachel.core2learn syllabus above)

### 2.3 Indicators
- **Ranges** (VERIFIED, https://www.wiredchemist.com/chemistry/data/acid-base-indicators):
  - methyl orange 3.1–4.4, red to yellow, orange in between
  - phenolphthalein 8.0–10.0, colourless to pink
  - methyl red 4.4–6.2
- **The spec's colours are directionally right:** red to orange to yellow for methyl orange, and colourless/pink for phenolphthalein.
- **WAEC end-point wording:** "methyl orange from yellow to orange … phenolphthalein from pink to colourless". (VERIFIED, https://waeconline.org.ng/E-Learning/Chemistry/chem335jq1.html) The app must use this exact wording in feedback. "Yellow to red" means **overshot**.
- **The spec's "Henderson–Hasselbalch interpolation" is not Henderson–Hasselbalch.** It is a piecewise-linear RGB ramp. The real version:
  - The basic-form fraction is α = 1/(1 + 10^(pK_In − pH)). pK_In ≈ 3.46 for methyl orange and ≈ 9.3 for phenolphthalein.
  - Blend the acid-form and base-form colours by α. For realism, blend in absorbance space using Beer–Lambert, then convert to RGB.
  - This also produces the realistic "faint pink" phenolphthalein end point instead of a hard step at 8.3. (REASONED)
- **Methyl red** is permitted by the syllabus but missing from the schema enum. (VERIFIED, syllabus)

### 2.4 Parallax model (`0.24 × sin θ`)
- The constant is arbitrary. The code comment says tan while the code uses sin, and the sign is undefined.
- **Geometry.** The graduations are on the front of the tube, and the bottom of the meniscus is on the tube axis, a distance d_eff behind the scale. d_eff is about the bore radius, 0.5–0.6 cm, reduced somewhat by refraction. The apparent shift is Δh ≈ d_eff · tan θ, and ΔV = A_bore · Δh.
- A 50 cm³ burette has A_bore ≈ 0.9–1.0 cm², so **ΔV ≈ 0.4–0.6 · tan θ cm³**. That is about 0.08–0.1 cm³ at 10° and about 0.2–0.25 cm³ at 25°. The spec underestimates by roughly 2×, but the order of magnitude is right. (REASONED)
- **Sign.** The burette scale increases downward. An eye above the meniscus reads a **smaller** number (under-reads); an eye below over-reads. (REASONED)
- **Teaching gold.** A *consistent* viewing angle largely cancels in the titre (final − initial). The real damage comes from reading the initial and final values from different heights. This makes an excellent viva question. (REASONED)
- **Implementation note.** In a 3D scene the parallax angle is the **virtual camera's elevation relative to the meniscus**, not the phone's tilt. Compute it from scene geometry. (REASONED)
- **Rule refinements:** read the **bottom** of the meniscus for colourless solutions and the **top** for KMnO₄, which is a syllabus redox titrant. Record to 2 d.p. with the last digit 0 or 5, because the burette is graduated in 0.1 cm³ and estimated to ±0.05. The 0-or-5 practice is REASONED, but it is consistent with WAEC's own model table of 14.45, 26.60, 38.65, 12.65, 12.15 and 12.05 (VERIFIED chem335jq1).

### 2.5 Status logic conflates accuracy with concordance
- `|V − V_eq| ≤ 0.10 → "concordant_endpoint"` is wrong:
  - **Concordance** is agreement between the candidate's **own** titres.
  - **Accuracy** in WAEC is judged against the **teacher's or supervisor's** titre.
- (VERIFIED, indirectly: the WAEC chief examiner lists "deliberate alteration/cancellation of titre values … to agree with … the teacher's titre value(s)" and recommends "teachers/supervisors should not disclose their titre values", https://waeconline.org.ng/E-Learning/Chemistry/chem120mw.html. Physics uses the same mechanism: "within ±10% of the teacher's value", https://waeconline.org.ng/E-Learning/Physics/Phys333mq2B.html)
- The code uses 0.10 here while rubric rule 2 says 0.20. That is an internal inconsistency.

### 2.6 Recommended correct but simple chemistry model
- **Solve one charge-balance equation for [H⁺] by bisection** over pH 0–14. It is monotonic, about 50 iterations, and microseconds of work.
- Inputs are total analytical concentrations after mixing:
  - Na⁺/K⁺ from the base
  - Cl⁻/NO₃⁻ from strong acid
  - SO₄²⁻ from H₂SO₄ (treat both protons as strong at school level, or use pK_a2 ≈ 1.99)
  - total carbonate C_T (pK_a1 6.35, pK_a2 10.33)
  - ethanoate (pK_a 4.76)
  - Ca²⁺
  - K_w = 10⁻¹⁴
- Charge balance: [cations] + [H⁺] = [OH⁻] + [anions of strong acids] + [HCO₃⁻] + 2[CO₃²⁻] + [CH₃COO⁻].
- This one equation correctly covers every WAEC acid–base combination, both carbonate stages, weak acid against strong base, and the double-indicator method.
- **CO₂:** assume a closed system, so dissolved CO₂ gives pH ≈ 3.8–4.0 at the second equivalence. Optionally lose a little CO₂ while swirling to reproduce the "fading" methyl orange end point. (REASONED)
- **Drop volume:** 0.05 cm³. The end point is the first colour change that persists after about 30 s of swirling.
- **Redox titrations (KMnO₄/Fe²⁺, KMnO₄/oxalate, I₂/thiosulfate)** are in the syllabus, and the chief examiner asked teachers to extend teaching to them. (VERIFIED: "teaching of volumetric analysis should not be limited to acid-base titration only, but be extended to redox titration", https://waeconline.org.ng/E-Learning/Chemistry/chem327jw.html) Leave these as post-hackathon work.

---

## 3. Ray optics: minimum correct model and what WAEC actually examines

### 3.1 What WAEC sets in Physics Paper 3 optics (all VERIFIED)
- **Rectangular glass block, pin method** (May/June 2023, Q2A).
  - Trace the outline and the normal, set i = 10–50°, place P1/P2, then align P3/P4 with the images.
  - Measure r and the lateral displacement d, and plot d against (tan i − tan r).
  - Five traces, readings to 1 d.p. in cm, tangents to 3 d.p., accuracy ±10%.
  - Precautions: sharp pencil, pins about 5 cm apart, avoid parallax on the protractor, clean block.
  - Source: https://waeconline.org.ng/E-Learning/Physics/Phys340mq2A.html
- **Rectangular glass prism, pins** (2017 Q2B): plot cos θ against sin i. https://waeconline.org.ng/E-Learning/Physics/Phys326mq2B.html
- **Glass prism traces** (Nov/Dec 2015 Q2A). Here "Many candidates failed to attach their traces", and scales in multiples of 3 were "not accepted". https://waeconline.org.ng/e-Learning/Physics/Phys324nq2A.html
- **Converging lens, illuminated object and screen**, distances measured from the foci (Nov/Dec 2015). Plot n⁻¹ against m, which is Newton's form m·n = f². https://waeconline.org.ng/e-learning/Physics/Phys325nq2A.html
- **Converging lens, displacement method** (2021 Q2B). Find two lens positions for fixed D, with k = (D² − d²)/(4D) = f. https://waeconline.org.ng/E-Learning/Physics/Phys333mq2B.html

### 3.2 Minimum correct model
- **Refraction:** Snell's law, n₁ sin i = n₂ sin r, with n_glass ≈ 1.50–1.52.
  - The emergent ray is parallel to the incident ray.
  - Lateral displacement: d = t·sin(i − r)/cos r.
  - Critical angle: sin c = 1/n. Total internal reflection needs glass-to-air travel and i > c, both of which WAEC asks for (VERIFIED, Phys340mq2A part b).
  - The "pin alignment" check is the sight-line: P3 and P4 must be collinear with the refracted images of P1 and P2. This is exactly a ray trace, so no general ray tracer is needed. (REASONED)
- **Thin lens and mirror**, Nigerian convention "real is positive":
  - 1/f = 1/u + 1/v; f is positive for a converging lens or concave mirror; real image distances are positive and virtual ones negative; m = v/u.
  - (VERIFIED for a Nigerian SS2 lesson note: "Real images have positive image distances, virtual images have negative image distances", "Focal length of a converging lens is positive", https://www.headteacher.ng/light-waves-dispersion-lenses-lens-formula-for-sss-2)
  - The same page also states a direction-of-light rule and gives a confusing worked example. **Pick one convention, state it on screen, and never mix it with Cartesian (New Cartesian/CBSE) conventions**, which an LLM trained on Indian content will tend to emit. (REASONED)
  - When u < f, v is negative, which displays as "virtual, upright, magnified".
  - Also support the displacement method (needs D ≥ 4f), Newton's form x·x′ = f², and the no-parallax pin method for mirrors and lenses. (REASONED)
- **Schema gap.** The `apparatusType` enum has only `converging_lens` for optics. There is no glass block, optical pin, ray box, screen, plane or concave mirror, or prism. The most common optics practical cannot be represented. (REASONED, from the spec)
- **Key product insight.** The glass-block experiment *is natively a paper experiment*: the candidate's traces on drawing paper are attached to the answer booklet and marked. Scanning a student's real trace and grading it against the WAEC scheme items is the most honest "paper comes alive" story available. The scheme items are five complete traces, normal present, arrows, a separate outline per trace, pin marks visible, and pins ≥ 4–5 cm apart. (VERIFIED scheme items; REASONED product claim)

---

## 4. Rubric rules in section 7 checked against WAEC sources

**WAEC paper structure (VERIFIED):**
- **Physics Paper 3:** practical, "2¾ hours for 50 marks", three questions, answer "any two". Private candidates sit an "alternative to a practical work paper". https://studentship.com.ng/waec-physics-syllabus/
- **Chemistry Paper 3:** school candidates sit a 2-hour practical with three compulsory questions worth 50 marks. The three are quantitative analysis (titration), qualitative analysis, and familiarity with practical activities. Private candidates sit a 1½-hour alternative-to-practical. https://rachel.core2learn.org/modules/en-wassce/WASSCESYLABUS/CHEMISTRY.pdf
- A titration question carries roughly 20–25 marks, for example "Question 1 … total 22 marks" (2022 private candidates, chem335jq1). In 2019 Q1B the scheme gave "**Two concordant titres = 8 marks; Averaging = 2 marks**" (https://www.waeconline.org.ng/e-learning/Chemistry/chem328mq1B.html).
- WAEC papers come in "Alternative A / Alternative B" versions. These are parallel real practical papers, not "Alternative to Practical". (VERIFIED: Phys327mq3A and Phys333mq2B, where Alternative B uses a real ray box and lens)
- **There is no oral viva in the WASSCE practical scheme**, and JAMB/UTME has no practical. (REASONED, from the scheme of examination above, which lists no oral component)

| Spec rule | Verdict | Evidence |
|---|---|---|
| **CHEM-BUR-2DP** (2 d.p. readings and titres; −1 per column) | **Requirement REAL. Penalty INVENTED.** WAEC praises candidates who "record burette readings to two places of decimal". I found no "−1 per column" anywhere. Add the 0-or-5 last-digit convention as a recommendation. | VERIFIED https://waeconline.org.ng/E-Learning/Chemistry/chem340ms.html ; https://waeconline.org.ng/e-learning/Chemistry/chem335ms.html |
| **CHEM-CONCORD-020** (concordant within ±0.20; −2) | **Principle REAL. Tolerance UNVERIFIED. Penalty INVENTED. Wording wrong.** Averaging non-concordant titres is a listed WAEC weakness, and the scheme rewards concordance positively (8 marks). I could not find 0.20 cm³ written in any WAEC page. It is widely taught in Nigerian classrooms (REASONED), while Cambridge uses 0.10. "±0.20" is wrong: it means two titres differing by ≤ 0.20 cm³. Make the tolerance configurable, default 0.20, and praise ≤ 0.10. The code's 0.10 contradicts the rule. | VERIFIED: "averaging of non concordant titres" https://waeconline.org.ng/E-Learning/Chemistry/chem120mw.html ; "lost marks for using non-concordant titres" https://waeconline.org.ng/E-Learning/Chemistry/chem321nq1.html ; WAEC model answer averages 12.15 and 12.05 and rejects 12.65 (chem335jq1) |
| **CHEM-PARALLAX** (eye level, lower meniscus for colourless) | **REAL as good practice.** Add "upper meniscus for coloured solutions (KMnO₄)". Parallax is a standard stated precaution in WAEC physics schemes. | REASONED; precaution VERIFIED in Phys340mq2A, Phys325nq2A |
| **PHYS-KEY-OPEN** (−1) | **Precaution REAL. Penalty mechanism WRONG.** WAEC awards **any two valid precautions** as positive marks. It cannot observe whether you opened the key; it marks what you *write*. The "wire heating" rationale is weak for constantan (section 1). | VERIFIED Phys320nq3, Phys327mq3A |
| **PHYS-GRAPH-23** (points cover ≥ 2/3 of the sheet; triangle ≥ 2/3 of the line; −2) | **The 2/3 thresholds are INVENTED.** WAEC's own chief examiner remedy (Nov/Dec 2013) says "**graph should occupy at least 1/3 of graph page**". Schemes say "reasonable scales". For slopes WAEC says "**large right-angled triangle**", with no fraction stated. Scales in multiples of 3 were "not accepted". "Start graph from origin (0,0) where intercepts are required" is a real complaint. Axes labelled with quantity and unit is REAL ("correctly distinguished axes", "inability to state correct unit"). | VERIFIED https://waeconline.org.ng/e-Learning/Physics/Phys322nw.html (1/3) ; https://waeconline.org.ng/E-Learning/Physics/Phys319nw.html ("large right-angled triangle") ; https://waeconline.org.ng/e-Learning/Physics/Phys327aw.html (origin, scales, units) ; Phys324nq2A (multiples of 3) |
| **PHYS-OPTICS-ARROW** (−½ per missing arrow; virtual rays dotted) | **PARTLY REAL, with the wrong granularity.** The 2023 scheme deducts ½ mark "if no arrows on at least one trace", once, not per arrow. It also deducts ½ for **each wrong or missing trace**, 1 mark if **all traces are in one outline**, and **all observation marks** if there are no traces or no pin marks. "Dotted virtual rays" is a textbook ray-diagram convention for theory sketches; it is not in the practical scheme. | VERIFIED https://waeconline.org.ng/E-Learning/Physics/Phys340mq2A.html ; arrows in sketch answer, Phys324nq2A |

**Real WAEC marking items the spec omits (all VERIFIED on the pages cited above):**
- Precision:
  - Lengths "to at least 1 d.p. in cm".
  - Derived values (reciprocals, trig) "to 3 s.f./3 d.p.".
  - Chemistry answers "to 3 significant figures".
  - **The spec's physics scorecard says "Observation (2dp)", which is wrong for physics.**
- Tables and data:
  - A **composite table**.
  - **Trend** statements ("As D decreases, d decreases").
- Accuracy: within **±10% of the teacher's value**.
- Chemistry write-up:
  - Correct **state symbols** ("lost marks … writing wrong physical state").
  - Units on the average titre.
  - Distinguishing moles from concentration.
  - Water-of-crystallisation calculations for Na₂CO₃·yH₂O (chem120mw).
- Physics practice:
  - Pins vertical.
  - Tight connections and clean terminals.
  - Zero error.
  - Repeated readings *shown in the table*.
  - A **centre-zero galvanometer** is the specified apparatus (Phys340mq3B, https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html).
- **Chemistry Q2, qualitative analysis**, is about a third of Chemistry Paper 3. The app ignores it entirely. (VERIFIED syllabus)

---

## 5. Statistics: what the pitch can honestly say

| Claim | Status | Source |
|---|---|---|
| "Over 70% of students attend schools without functional labs" | **UNVERIFIED as stated.** I found no national source. A 2011 NISER survey (about 120 schools in 6 states, 438 questionnaires) found **over 90% of schools report separate Chemistry, Physics and Biology labs**. It recorded no figures for functionality and rated equipment quality mixed. **Drop the 70% figure.** | VERIFIED (contradicting): https://richtmann.org/journal/index.php/jesr/article/download/11991/11595/43817 |
| A defensible local figure | **Katsina State: 123 of 432 secondary schools had science labs** (≈72% without), AFP, Nov 2017 | VERIFIED: https://citizen.co.za/news/news-world/news-africa/nigeria-education-science |
| "Only 35% of public secondary schools have functional science labs" | Appears in a July 2025 education-news article attributed vaguely to "UNESCO and student surveys". No report is named. **Do not use it without the primary source.** | Seen at https://thenigeriaeducationnews.com/2025/07/01/the-silent-breakdown-in-nigerias-classrooms-no-labs-no-libraries-no-digital-tools/ |
| Infrastructure deficit, official | The Minister of Education says Nigeria's **13,921 public secondary schools** face "severe infrastructure deficits", and only 5.8% of the 2025 capital budget was released (Feb 2026) | VERIFIED: https://www.premiumtimesng.com/news/top-news/860233-2026-budget-education-ministry-proposes-n2-4trn-targets-teacher-shortage-infrastructure-gaps.html |
| WAEC itself says practical exposure is lacking | Chief examiner remedies: "**prolong exposure to laboratory practical works**", "**school laboratories should be adequately equiped**", "**Teachers to organize adequate practical classes**" | VERIFIED: https://waeconline.org.ng/E-Learning/Chemistry/chem120mw.html ; https://waeconline.org.ng/E-Learning/Physics/Phys319nw.html |
| WASSCE 2026 (Nigeria, school candidates) | **1,959,668 registered, 1,950,726 sat**, 24,207 schools; 61.54% got 5 credits including English and Maths | VERIFIED: https://allafrica.com/stories/202608060122.html ; https://techeconomy.ng/2026-wassce-results-385-fail-core-subject-benchmark-as-state-government-debts-block-access-for-thousands |
| WASSCE 2025 | 1,973,365 registered, 1,969,313 sat; 38.32% initially (2024: 72.12%), **revised to about 62.96%** after a WAEC grading error | VERIFIED: https://guardian.ng/education/waec-releases-2025-wassce-results-withholds-192089/ ; https://www.icirnigeria.org/waec-revised-results-show-62-96-pass-in-five-subjects-including-english-maths/ |
| Science practical cohort size and scores | **Chemistry Paper 3, 2023:** 842,030 candidates, mean 25.0/50 (SD 8.0), **worse** than 2022's 28.0. **Physics Paper 3, 2023:** 846,875 candidates, mean 29/50 (SD 7.28); 2022 had 801,212. | VERIFIED: https://waeconline.org.ng/E-Learning/Chemistry/chem340mc.html ; https://waeconline.org.ng/E-Learning/Physics/Phys340mc.html |
| Subject-level credit-pass rates for Physics or Chemistry | **Not found** in WAEC press releases. Do not invent them. | — |

**Suggested honest pitch line:** "Every year about 840,000 Nigerian students sit a hands-on WAEC Chemistry practical, and another 840,000 the Physics one. The Chemistry practical average was 25/50 in 2023. WAEC's own chief examiners keep asking schools for more laboratory practice. In Katsina, fewer than 3 in 10 secondary schools even had a science lab." (All figures VERIFIED above.)

---

## 6. Which experiments, in what order, and the hero

**Ranking by exam frequency and impact.**

1. **Acid–base titration (Chemistry Q1).**
   - It is compulsory every sitting: Chemistry Paper 3 has three compulsory questions, one of them quantitative. Physics candidates instead choose 2 of 3.
   - It is worth about 20–25 marks, with 8 marks for two concordant titres alone, across a cohort of about 842k.
   - The right answer is crisp, the visual is rich (colour change), and the real mistakes are well documented: non-concordant averaging, wrong mole ratio, 3 s.f., state symbols, overshoot. (VERIFIED, sources in sections 4 and 5)
2. **Refraction through a rectangular glass block, pin method (Physics optics question).**
   - It recurs often (2015, 2017 and 2023 seen) and is **the only practical whose real exam artifact is a drawing on paper**, which fits "scan your exercise book" perfectly.
   - The model is cheap and exact (Snell's law).
3. **Meter bridge or potentiometer (Physics electricity question).**
   - It recurs (2013 meter bridge, 2018 meter bridge, 2023 potentiometer), but the physics is subtler and the spec's current model is wrong.
   - If it is kept, the honest consequences are strong (section 1).
- **Cheap fallback:** the simple pendulum or loaded spring (Physics mechanics Q1). Trivial to simulate correctly. (REASONED)
- Converging lens is a strong alternative to item 2 (2015, 2021).

**Recommended hero: titration, with honest "mistakes have consequences".**
- One drop too many turns the flask permanently orange-red. Run 1 then gets discarded as non-concordant, and the auto-graded table shows the WAEC scheme line "Two concordant titres = 8 marks".
- **Indicator trap:** if the student picks phenolphthalein for Na₂CO₃, the flask decolourises at about half the expected titre. The examiner agent then asks "Why is your titre half of your classmate's?" This is scientifically exact, dramatic, and exactly what WAEC tests.
- A meniscus loupe shows the geometry of a parallax error with real magnitudes (about 0.1 cm³ at 10°).
- **Secondary demo, meter bridge, with honest drama:**
  - The centre-zero needle slams when the student taps far from balance without the protective resistor.
  - The jockey "scrape" leaves a mark on the wire, and the next balance drifts.
  - With all plugs in, there is "no balance point on the wire".
  - "Interchange R and X" removes end error.
- **Drop the cherry-red glowing constantan wire.** If a spark visual is essential, attach it only to an explicitly labelled "never short an accumulator" safety vignette where the connecting lead heats. (REASONED)

---

## 7. Pedagogy

**Is "mistakes have consequences" sound?**
- **Yes, if the consequences are the real ones.** Productive-failure and simulation-based learning work because the feedback is causally faithful. (REASONED)
- Fake consequences teach misconceptions that WAEC then penalises. A student who watches constantan glow and drift will write a wrong answer to "Why is the bridge wire made of constantan?" The textbook answer is "high resistivity, *low temperature coefficient*". (REASONED)
- Use consequences that cost marks in the real exam:
  - discarded titres
  - needle overload
  - scraped wire
  - no balance point
  - missing traces or arrows
  - bad scale (multiples of 3)
  - no origin when an intercept is needed
- Show both the exam-mark impact *and* the physical reason for each.

**What would make teachers trust it:**
1. **Deterministic grading.**
   - Rubric checks are rules, not LLM judgement: decimal places, concordance, scale, number of points, arrows, triangle size.
   - The LLM only asks questions and explains.
   - Every deduction links to the WAEC chief-examiner page it comes from (the URLs above).
   - Say "aligned with published WAEC Chief Examiner reports". **Never say "official WAEC rubric".** It isn't one, and WAEC is a real organisation. (REASONED)
2. **A teacher's-value mode** that mirrors WAEC: the teacher enters their own titre or result, and accuracy is graded against it (±10% in physics).
   - Never show students the "expected titre". WAEC explicitly complains about candidates altering titres to match the teacher's value. A tool that reveals V_eq becomes a cheating aid. (VERIFIED, chem120mw)
3. **Correct conventions.**
   - Nigerian IUPAC-style names (trioxocarbonate(IV), tetraoxosulphate(VI)).
   - The real-is-positive optics convention.
   - Pencil, not biro, for traces ("well-sharpened pencil" is a WAEC-accepted precaution, Phys340mq2A).
   - A centre-zero galvanometer.
   - Readings at WAEC precision.
4. **Show the model.** Publish the equations (sections 1.4 and 2.6) and their assumptions in a "Teacher notes" panel.
5. **Cover what actually costs marks** in Chief Examiner reports: scale reading, consistent decimal places, slope from a large triangle, precautions stated correctly, units, unit conversion using scale factors, 3 s.f., mole ratio. (VERIFIED, Phys327aw, Phys319nw, chem321nq1)

**What an examiner-style viva should ask.** Rename "WAEC Chief Examiner Viva" to "Examiner questions". There is no viva in WASSCE; these mirror the short-structured part (b) questions and Chemistry Q3. Each question below is grounded in a WAEC page or a standard textbook point.
- **Meter bridge or potentiometer:**
  - State two precautions (verified list above).
  - Why is the jockey not dragged?
  - Why open the key between readings?
  - Why should balance be near the middle?
  - How do you eliminate end error?
  - Why is the wire constantan?
  - Does a weakening cell change the balance point? (No, only sensitivity.)
  - State two factors affecting a wire's resistance. (VERIFIED, Phys327mq3A part b)
  - Explain why resistance rises with temperature, in terms of free electrons. (VERIFIED, Phys320nq3 part b)
- **Glass block:**
  - State Snell's law.
  - What does n = 1.65 mean? (VERIFIED, Phys326mq2B)
  - State the conditions for total internal reflection. (VERIFIED, Phys340mq2A)
  - Why space the pins about 5 cm apart?
  - Why look at the bottoms of the pins?
- **Lens:**
  - Distinguish real and virtual images.
  - Why is the reciprocal of the image distance zero for a distant object? (VERIFIED, Phys325nq2A, Phys333mq2B)
- **Titration:**
  - Why rinse the burette with the acid, and why *not* the conical flask with the base?
  - Why use a white tile?
  - Why remove the funnel before reading?
  - What makes titres concordant?
  - Why methyl orange, not phenolphthalein, for a carbonate?
  - Which part of the meniscus do you read?
  - Recover the salt formed (evaporation and crystallisation). (VERIFIED, chem335jq1 part c)
  - Name a suitable indicator and its end-point colour. (VERIFIED, chem335jq1 part d)
- **Language.** Accept Pidgin input, but model answers in clear formal English. WAEC flags candidates' inability to "express themselves clearly in simple language". (VERIFIED, Phys319nw)

---

## 8. The concept images

**image.png (meter bridge):**
- The galvanometer is drawn as a one-sided µA meter. WAEC specifies a **centre-zero** galvanometer. (VERIFIED, Phys340mq3B)
- The "Leclanché cell" is drawn as a modern alkaline AA. The 2.0 V EMF label suggests an accumulator. (REASONED)
- The graph's axis tick labels are garbled (x: "0, 8, 6, 9, 10, 19, 30…"). A judge will notice. (REASONED)
- The scorecard "18/20 … Viva Voce 4/5, Observation (2dp), Graph (2/3 scale)" contains three inventions (section 4).
- The animated "electron pulse" arrows suggest current flows around the whole loop, galvanometer included. At balance the galvanometer branch carries zero current. Pulses in the galvanometer lead should stop at null. That would make a lovely, honest visual cue. (REASONED)
- R_box = 5.0 Ω with L_balance = 62.4 cm gives X ≈ 3.01 Ω. That is consistent. (REASONED)

**image-2.png (titration):**
- A methyl orange flask showing orange at "pH 3.8 TRANSITION" is chemically consistent. (REASONED)
- The −1 penalty card for "24.5" is the real 2 d.p. principle, though the mark value is invented.
- The table has a single titration (Final 24.5, Initial 0.00). A WAEC table needs a rough titre plus at least two concordant titres. (VERIFIED, chem335jq1, chem328mq1B)
- "Eye-Level Alignment: OK" sits over a view that looks down at the burette from above. That is visually contradictory. (REASONED)
- Burette readings written in biro are fine for a table, but traces and diagrams should be in pencil. (VERIFIED for traces, Phys340mq2A)
