# 02 · Critique of `SNAPLAB_NG_MASTER_ARCHITECTURE.md`

*An honest, section-by-section review of the original spec by five parallel reviewers (hackathon rules, Meta API verification, science and WAEC accuracy, tech stack and risk, demo strategy). The aim is to win, so it is blunt. The spec's core idea is excellent; most of its problems are fixable, and the fixes are in documents 03 to 10.*

---

## 1. Verdict in one paragraph

**The idea is a winner; the plan as written would lose.** "A student's exercise-book drawing becomes a working lab, then an AI examiner marks it" is creative, rooted in a problem you know first-hand, and squarely on the "Build for Your World" theme. But the spec (a) builds a 3–4 person, 6-week system solo in 10 days, spending most of the effort on parts judges never see; (b) contains **science errors a Nigerian physics or chemistry teacher would catch in seconds**, including the centrepiece glowing wire; (c) has **API integration bugs that would silently break** the AI pipeline; and (d) quotes **unverified numbers and rules** (70% of schools, 99% accuracy, 120 FPS, invented WAEC penalties, a WAEC viva that doesn't exist). Every one of these is fixed below without losing the wow.

## 2. What the spec gets right (keep these)

| Strength | Why it matters |
|---|---|
| **"₦200 exercise book comes alive"** | A memorable, visual, emotional hook a judge can repeat. |
| **"LLMs are semantic compilers, not code generators"** | The right architecture: AI emits a schema-validated blueprint; a deterministic engine runs the science. We sharpen it to *"the AI reads and judges; the engine decides."* |
| **Strict JSON schema via `text.format`** | Verified correct for Meta's Responses API, and the schema obeys strict-mode rules. |
| **SAM 3.1 fan-out, one noun phrase per request** | Verified correct ("no multi-concept syntax"). |
| **Model IDs, endpoints, Muse Code install** | All verified real. |
| **Zustand with transient reads in the render loop** | Correct pattern for 3D. |
| **Golden demo notebooks for judges** | Exactly right; we extend them into recorded replays. |
| **WAEC grounding** | 2 d.p. burette readings, concordant titres, eye-level reading and the key-open precaution are real WAEC practice. |
| **Pidgin and Nigerian English** | Strong inclusion story (with honest limits, below). |
| **Submitting hours early** | Wise. |

## 3. Section-by-section critique

### Header and §0 (directives)
| Spec says | Problem | Fix |
|---|---|---|
| Indie pool $400K, 1st $150K, $50K "viral" bonus | Official pages confirm only $1M across two tracks. The per-place split is from one secondary source; nothing supports a viral/tagging bonus. | Treat as unverified; don't plan around a viral pool (`01_HACKATHON_BRIEF.md`). |
| "Zero-latency", "120 FPS", "< 2.2 s" | iPhones cap animation near 60 Hz; no Meta latency figures exist; Wonder at high effort is likely 8–30 s. | Honest targets and latency hiding (`04_ARCHITECTURE.md` §5). |
| Rust → WASM in a Worker with SharedArrayBuffer at a "locked 120 Hz" | The maths is microseconds in plain TypeScript; per-frame JSON across the WASM boundary makes it *slower*; `.unwrap()` panics kill physics for the session; SharedArrayBuffer needs COOP/COEP headers that break cross-origin assets and embeds, and Safari forces the strictest mode. At least a day of toolchain for nothing visible. | Pure TS engine with unit tests; fixed 120 Hz steps in the render loop. Rust only as an optional circuit solver later. |
| WebGPU with WebGL2 fallback | three.js's WebGPU renderer is still experimental and breaks GLSL `ShaderMaterial`, postprocessing and drei `Text`; no WebGPU on the PowerVR GPUs in many budget Nigerian phones. | WebGL2 only. |
| OpenCV.js homography at 60 FPS, or Python FastAPI | 8–10 MB of WASM, jitter, 2–3 days solo, CPU contention; a second runtime to deploy. | One-shot scan with drag handles + GPU rectify; gyro parallax for the "AR feel". |
| Postgres + Drizzle, Upstash Redis, Cloudflare R2 | Nothing needs them; more things to break at 2 a.m. | Static JSON, browser storage, in-memory cache. |

### §1 Product vision
| Spec says | Problem | Fix |
|---|---|---|
| "Over 70% of students attend schools without functional labs" | **No source found.** A 2011 national survey found over 90% of schools *report* having labs (functionality unmeasured). | Use verified numbers: ≈ 842K Chemistry practical candidates in 2023, mean 25/50; WAEC's own Chief Examiner quotes; Katsina 123 of 432 schools with labs (`10_DEMO_AND_SUBMISSION.md` §6). |
| Students "memorise Alternative to Practical diagrams" | Alternative to Practical is for **private** candidates. School candidates sit a **real hands-on practical**, often meeting the apparatus for the first time on exam day. | Use the true, stronger framing. |
| Short-circuit with R = 0 makes the wire glow cherry-red | **Physically wrong.** R = 0 shorts one arm of the bridge, not the cell; a 1.5–2 V cell warms the wire 20–60 °C at most (glow starts near 525 °C); constantan is chosen *because* its resistance barely changes with heat. Teaches a wrong answer to a standard exam question. | Meter bridge moved to "What's next" with honest consequences (needle slam, no balance point, scraped wire) (`07_SCIENCE_ENGINE.md` §4). |
| "Slide the jockey" with a finger gesture | Dragging the jockey is a precaution WAEC explicitly marks **against**; it scrapes the wire. | If the meter bridge returns, tap-to-contact, and dragging has a consequence. |
| Meniscus parallax warning | Good idea; the formula is wrong (see §5). | Corrected model; gyro-driven. |
| Muse Voice Transcribe "listens continuously in Nigerian English or Pidgin" | Pidgin is **not** among the 25 validated languages; no accuracy figures for Nigerian accents. | Push-to-talk, English bias, WAEC keywords, charitable interpretation, typed fallback, optional Spark 1.2 audio path. |
| "WAEC External Invigilator conducting a live Oral Viva" | **WASSCE has no oral viva.** | "Examiner questions" mirroring the short part (b) questions WAEC actually sets. |
| Muse Image generates a corrected "Chief Examiner Model Diagram" | No mask parameter; image models mislabel technical diagrams; one wrong label destroys credibility. | Muse Image only for a labelled "reality preview", never for marking. |
| Slope triangle ≥ 2/3 of the grid | Invented threshold (see §7). | Corrected rules. |

### §2 Tech stack matrix
Covered under §0. In addition: "4× faster than Node" is irrelevant because every request waits on Meta's API; Next.js App Router adds SSR complexity to an app that is one client-side canvas; an AudioWorklet synthesiser is unnecessary (standard Web Audio nodes suffice; AudioWorklet is needed only for mic capture). Full replacement table in `05_TECH_STACK.md`.

### §3 Repository structure
Reasonable shape, but it hard-codes the cut systems (Rust crate, Drizzle schema, Next.js app, optics, meter-bridge components). Replaced by a TypeScript monorepo with shared `engine`, `rules` and `contracts` packages, plus `golden/` and `fixtures/` (`04_ARCHITECTURE.md` §7).

### §4 Meta API integration
| Spec says | Reality | Severity |
|---|---|---|
| SAM output parsed with `JSON.parse` | Output is special-token text; the catch returns empty; **every scan silently shows zero detections** | **Breaks** |
| SAM boxes normalised 0–1 | Source pixels | **Breaks** (3D placement wrong) |
| SAM masks as RLE; scores always present | Base85 masks; confidence only on request | Breaks parsing |
| SAM image via `file_id` | Documented for video only; use URL or base64 | Likely breaks |
| Realtime ASR auth via HTTP header | Header ignored; key goes in the first JSON message within 10 s | **Breaks** |
| Relay browser audio as-is | Must be raw PCM16 at 16/24 kHz, paced in real time | **Breaks** |
| Biasing "hits 99%" | `keywords` exists but guarantees nothing; no accuracy figures | Overclaim |
| SAM 3.1 finds "resistor", "wire loop", "titration table" in biro | No evidence on sketches; a table is not an object | High risk |
| Serial pipeline: SAM masks → LLM | Muse models read images natively | +2–4 s latency |
| `waecScoreOutOf20` from the LLM | Non-reproducible; a reload can change the score | Trust risk |
| Both `physicsInit` and `chemistryInit` required | Forces the model to invent values for the absent experiment | Correctness risk |
| `stoichiometricRatio` with no direction | Can be filled backwards, halving or doubling the titre | Correctness risk |
| `paperBbox` as an array | Strict schemas can't enforce length | Minor |
| No TTS mentioned for a speaking examiner | **Meta's API has no TTS** | Gap |
| Spark 1.3 for audio | Spark 1.3 audio input "isn't fully supported"; use 1.2 | Minor |

All fixes in `06_META_AI_INTEGRATION.md` §4–5.

### §5 Rust physics core (science)
**Meter bridge:**
- α = 0.004/K is **copper's**; constantan's is ≈ 8×10⁻⁶/K (≈ 500× smaller).
- The bridge wire's temperature is applied to the **unknown resistor**: two bodies conflated.
- "Short circuit" replaces the bridge with 0.05 Ω: wrong; the cell current rises only ~20%.
- The galvanometer formula `(jockey − null)/50 × emf × 48` is not a current; the real one needs galvanometer and arm resistances.
- Clamping the null point to 1–99 cm hides the key diagnostic: **no balance point on the wire**.
- Two different cooling constants for one body; arbitrary 38 °C/s heating when shorted; wire power computed from the whole network.
- The graph axis "R against 1/l" is **not linear** for the spec's own configuration.

**Titration:**
- V_eq formula correct, but the ratio has no direction (see §4).
- Carbonate treated as hydroxide (0.05 M Na₂CO₃ is pH ≈ 11.5, not 12.7).
- **No first end point:** with phenolphthalein, Na₂CO₃ vs HCl decolourises at **half** the titre in reality; the spec puts it at the full titre. This is a classic exam question.
- The equivalence branch (`< 1e-6 mol`) is narrower than one drop: almost never reached.
- "Ratio > 1.5 means carbonate" gives wrong answers for Ca(OH)₂ + 2HCl (WAEC 2019) and H₂SO₄ + Na₂CO₃.
- Weak acids (ethanoic acid, equivalence ≈ pH 8.7) cannot be represented.
- The colour ramp is labelled Henderson–Hasselbalch but isn't; methyl red missing.
- Parallax 0.24·sin θ is arbitrary and about 2× too small; sign undefined; the comment says tan, the code says sin.
- "Concordant" status compares against the theoretical titre: that is **accuracy**, not concordance; and 0.10 in code vs 0.20 in the rubric.

Corrected models: `07_SCIENCE_ENGINE.md`.

### §6 3D engine and shaders
- Mapping boxes to the page plane is fine once boxes are normalised.
- A pure Y-scale extrusion "looks like a 2010 bar chart". Add the ink-particle flow and dissolve materialisation (`04_ARCHITECTURE.md` §2 ③).
- The thermal shader starts glowing at 45 °C, which is physically impossible; moot now that the glowing wire is cut.
- Glass with real transmission is expensive on phones: use fake glass on low tiers.

### §7 WAEC rubric
| Spec rule | Verdict |
|---|---|
| 2 d.p. burette readings, −1 per column | Requirement **real**; the penalty is **invented** (WAEC awards marks positively by scheme item). |
| Concordant within ±0.20, −2 | Principle **real**; 0.20 **not found on any WAEC page** (configurable); −2 invented; "±" wording wrong. |
| Meniscus at eye level | Real good practice. Add "top of meniscus for coloured solutions". |
| Key open, −1 | Precaution real; WAEC marks precautions **written**, positively, not unseen actions. |
| Points ≥ 2/3 of the grid; triangle ≥ 2/3 of the line, −2 | **Invented.** WAEC's own report says the graph should occupy **at least 1/3**; slopes need a "large" triangle. |
| −½ per missing ray arrow | Wrong granularity: −½ **once** if no arrows on at least one trace. |
| Scorecard "18/20, Viva Voce 4/5, Observation (2dp)" | Doesn't exist: Paper 3 is 50 marks; no viva; physics lengths are 1 d.p. |

Corrected rule table: `07_SCIENCE_ENGINE.md` §5.

### §8 Schedule
- The deadline is **3:00 AM WAT** on Nov 5, not 2:00 AM (US clocks change on Nov 1).
- Day 2 spends a full day on the Rust/WASM toolchain for nothing visible.
- Three experiments, gestures, live AR, voice, graph and image correction in 10 days leaves no time to polish one hero, and the demo isn't demo-able until the very end.
- No real-device testing, no fixture-based development for outages, no recorded backup video.
- "Install Muse Code and film clips" before kickoff is good; any pre-written code may break the rules (the official rules aren't out; Cerebral Valley's last event banned pre-existing work).
- Replaced by `09_BUILD_PLAN.md`: demo-able hero by **Day 5**, freeze on Day 8.

### §9 Kickoff prompt
Asking a coding agent to scaffold "the entire application automatically" from this spec would faithfully build the wrong things (Rust core, WebGPU, glowing wire, broken SAM parsing). A new Day-1 prompt should point agents at `04_ARCHITECTURE.md`, `05_TECH_STACK.md`, `06_META_AI_INTEGRATION.md` and `07_SCIENCE_ENGINE.md` instead.

### The concept images
- `image.png`: the galvanometer is a one-sided µA meter (WAEC specifies **centre-zero**); the "Leclanché cell" is an alkaline AA; the graph's tick labels are garbled; the scorecard shows three inventions. Current pulses should **stop** in the galvanometer lead at balance (a lovely, honest visual cue).
- `image-2.png`: a WAEC table needs a rough titre plus at least two concordant titres; "Eye-Level Alignment: OK" sits over a top-down view.
- Both are photoreal AI renders. Use them as *vision* in a pitch deck if at all, never as product screenshots.

## 4. The shape of the winning version

| Original spec | Winning version |
|---|---|
| Three experiments, shallow | **One hero (titration) flawless**, one second act (glass block) |
| Spectacle from fake physics | Spectacle from **honest** consequences (overshoot, indicator trap, parallax) |
| AI grades and scores | **AI reads and explains; rules mark**; reproducible scores with WAEC sources |
| "Viva" | Examiner questions WAEC actually asks |
| Rust/WASM, WebGPU, OpenCV, Postgres, R2, Python | TypeScript, WebGL2, one Bun service, static data |
| Serial AI pipeline, 2.2 s promise | Parallel + streamed + speculative + golden replay |
| Unsourced statistics | Verified WAEC numbers and Chief Examiner quotes |
| Demo at the end | Demo-able Day 5; video ≈ 25% of the effort |
