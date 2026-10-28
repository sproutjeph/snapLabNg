# 03 · Product and Experience: What the Judge Feels

*This document defines what SnapLab NG **is**, who it is for, and the exact experience a judge and a student have, moment by moment. Architecture follows from this, not the other way round.*

---

## 1. The product in one breath

> **"Your exercise book becomes your lab."**
>
> A student snaps the practical diagram and results table in her exercise book. The apparatus rises out of her ink as a working 3D lab with real chemistry and physics. Then an AI Chief Examiner marks **her own handwriting** in red ink against WAEC rules and quizzes her in the English or Pidgin she actually speaks.

**Tagline for the end card:** *"Draw am. Snap am. Do the practical."*

**The design principle we repeat everywhere** (README, video, UI footer):

> **"The AI reads and judges. The engine decides."**
> Meta's models do what only models can do: see a sketch, read handwriting, judge like an examiner, and understand a Nigerian student speaking. What happens in the lab (pH, current, heat) is **computed** by a deterministic engine, never generated.

This single sentence answers the two questions every AI judge asks: *"Is the AI a gimmick?"* and *"What if it hallucinates the science?"*

## 2. Why this wins (mapped to the judging criteria)

| Criterion | What SnapLab shows |
|---|---|
| **Impact (30%)** | About 1.95 million Nigerian students sat WASSCE in 2026 across 24,207 schools. In 2023 about **842,000** sat the hands-on Chemistry practical (mean **25/50**, down from 28) and about **847,000** the Physics practical. WAEC's own Chief Examiner reports complain that candidates *"manipulate titre values to agree with those of the teachers"* and confuse decimal places with significant figures, and keep asking schools for more laboratory practice. In Katsina, only 123 of 432 secondary schools had a science lab (AFP, 2017). School candidates sit a **real hands-on practical**, often meeting the apparatus for the first time on exam day. |
| **Creativity** | Nobody else starts from the student's own page. Existing virtual labs (PhET, Labster, PraxiLabs, and the Nigerian StanLab, Foris Labs and Edu ScienceLAB) give students *someone else's* pre-built experiment. None marks the student's own handwriting or asks examiner-style questions about her mistakes. |
| **Use of Meta AI (25%)** | Five Meta models, each with one honest, visible job, shown live in a "Show the AI" drawer with real timings. |
| **Technical ambition** | Sketch to structured blueprint to procedural 3D, a deterministic science engine, realtime speech, and it runs on a ₦100k Android phone and offline. |
| **Whether it works** | Golden replays that cannot fail, a typed fallback for every voice step, Lite mode for weak phones. |

**Do not claim** "first virtual lab in Nigeria". It is false. The defensible claim:

> *"Existing virtual labs give students someone else's experiment. SnapLab starts from the student's own exercise-book page, the exact thing WAEC marks, turns it into a lab she can run, marks her handwriting against Chief Examiner rules, and quizzes her in the English or Pidgin she speaks. We know of no other tool that does all three."*

## 3. Hero user

**Amina, 17, SS3 science, a public secondary school in Kubwa, Abuja** (a composite persona; say so in the README).

- Wants Medicine. Needs credits in Chemistry, Physics and Biology.
- Her school lab is a locked room; the few burettes come out on practical day and are shared.
- Uses a shared family Tecno or Infinix phone and buys data in small bundles.
- Has drawn the metre bridge circuit many times. Knows "the jockey was not dragged along the wire" as a sentence to memorise, not as something she has done.
- Her fear is not physics. It is losing marks for things nobody showed her: 1 decimal place for lengths, 3 significant figures, units on the axes, a big enough graph, precautions in the right tense.

**Emotional hook (first 10 seconds of the video):** *"Amina has drawn this circuit a hundred times. She has never touched a jockey."* Then the metre bridge rises out of her page. Dignity, not pity: she already does the work, and the tool meets her where she is.

**The builder is a co-protagonist.** Ten seconds of you on camera: *"I'm [name], a developer in Kubwa."* The theme is *Build for Your World*; a real face, place and accent are worth more than any shader.

## 4. Scope: the hero, the second act, and what we cut

> **Decided Oct 22 (replacing Oct 21):** **the metre bridge is the hero; titration is the second act; the glass block is a stretch item.** Full design: `15_METRE_BRIDGE_HERO.md`.

### HERO (protect at all costs): Metre bridge, "find the null, then get marked like WAEC"
Photo of the page → the bench rises out of her ink → she taps the jockey and the centre-zero needle swings through zero → the Chief Examiner red-inks her handwritten table **and her graph** → three examiner questions. It must be **flawless on the golden notebooks** and **good on a fresh upload**.

Why the metre bridge leads: it is the most visual practical in the syllabus, it recurs in WAEC Physics Paper 3 (metre bridge 2011 and 2018, slide-wire balance 2023, potentiometer 2008 and 2014), about 847,000 candidates sat Physics Paper 3 in 2023 (mean 29/50), and its marking scheme is concrete and checkable: lengths to 1 d.p., derived values to 3 s.f., a composite table, a graph with labelled axes and a large slope triangle, and two precautions "in acceptable tense".

**The honest "mistakes have consequences" moments** (all real physics; the old "glowing wire" is gone):
- **Tap far from balance:** with no protective resistor, the needle **slams** against its stop.
- **Drag the jockey:** the wire gets a visible scrape, and later balance points drift by millimetres. This is exactly what WAEC's precaution "the jockey was not dragged along the wire" is about.
- **Leave the key closed:** the Leclanché cell polarises, the needle gets lazy, and the balance point does not move. "Why open the key between readings?" now has a visible answer.
- **All plugs in (R = 0):** there is **no balance point on the wire**. The needle stays on one side wherever she taps.
- **Parallax:** read the metre rule from an angle and the reading shifts by millimetres.

### SECOND ACT: Titration, "your own page, marked like WAEC"
Compulsory in Chemistry Paper 3 every sitting (about 842,000 candidates in 2023, mean 25/50). It keeps drip, swirl, indicator colour and overshoot ("one drop too many" turns the flask permanently red-orange), and its marking: "24.5" fails 2 d.p., and the rough titre must not be averaged. The **indicator trap** (phenolphthalein with a carbonate gives half the titre) and **burette parallax** move to COULD.

### STRETCH: Rectangular glass block
Pins rise from her pin-holes and light bends through her traces. Built only if the hero and the second act are green on Day 7.

### CUT for these 10 days (moved to "What's next")
| Feature | Why |
|---|---|
| Lens and ray-diagram optics | A fourth experiment dilutes the story. |
| Free-form circuits from any drawing | Not demo-safe. The bench uses the standard metre bridge template; her drawing feeds setup issues (a missing key, the galvanometer in the wrong branch). |
| Live AR paper tracking (OpenCV.js homography at 60 FPS) | 8–10 MB, jittery, 2–3 days solo. A one-shot scan plus gyro parallax gives the same feeling. |
| MediaPipe hand gestures as a core control | Slow on budget phones, adds a camera permission. Kept as an optional laptop-only flourish for the video. |
| Rust/WASM worker with SharedArrayBuffer at 120 Hz | The maths is microseconds in TypeScript; the headers break Safari and embeds. |
| WebGPU, "120 FPS" | iPhones cap at 60 Hz; WebGPU breaks the shaders and postprocessing we need. |
| Postgres, Redis, R2, Python | Nothing needs them. |
| Muse Image "corrected model diagram" used for grading | Image models mislabel technical diagrams. Replaced by a safe, clearly labelled role (see §6, moment 6). |

## 5. The judge's path: zero friction, first wow in 5 seconds

**Landing page (no login, no camera required):**
- Above the fold: an 8-second loop of a page turning into a lab, the one-line pitch, and three big cards:
  1. **"Amina's metre bridge"** (golden page with deliberate mistakes) → *"Start here, 60 seconds"*
  2. **"Amina's titration"** (golden page) → *"Drip to the end point"*
  3. **"Snap or upload your own page"** (camera optional; file picker on laptops)
- A persistent **"Show the AI"** toggle, top right.

**Deep links for the README:** `/?demo=amina` auto-starts the guided run; `/?demo=amina&step=examiner` jumps straight to the marking. A judge with 30 seconds sees the hero immediately.

**Guided run (5 coach-marked steps, skippable):**
1. *Watch it come alive*
2. *Find the null* (tap the jockey; an "Auto-balance" button for the impatient)
3. *Read the metre rule at eye level* (tilt your phone, or drag a slider on a laptop)
4. *See the Chief Examiner's marking*
5. *Answer the examiner's questions* (speak, or type)

**End screen:** "Question 3, your page: 15½/21 marks", with each lost mark linked to the rule and the WAEC report it comes from, plus *Try your own page*, *Watch the 2:30 video*, and a share link. (The image's and spec's "18/20 with Viva Voce, Observation (2dp), Graph (2/3 scale)" card does not exist in WAEC: Physics Paper 3 is 50 marks with two questions answered out of three, physics lengths are 1 d.p., WAEC asks for a graph of at least 1/3 of the page, and there is no oral viva in WASSCE. We mirror the real scheme structure of WAEC's May/June 2023 Q3.)

## 6. The six moments, in order

| # | Moment | What the user sees | Meta model at work | Live or precomputed | Never-fails fallback |
|---|---|---|---|---|---|
| 1 | **It reads my page** | The photo flattens onto a 3D desk; a scan line sweeps; her ink lines glow cyan and lift off the paper (*changing in the ink look, Oct 28: the apparatus outlines draw themselves on in pen ink, then the fills fade in; `docs/plans/ink-look.md`*) | (local, instant) then **SAM 3.1** green outlines snap onto each drawn object | Local animation starts at 0 ms; AI streams in | Animation never waits for the network |
| 2 | **It comes alive** | Glowing particles flow from the ink into brass, Bakelite and a long wooden metre bridge that materialise in place; wires route along her drawn lines; her values ("R = 1–5 Ω") set the plug box | **Muse Spark 1.3** compiles the blueprint (experiment, components, values) | Live on uploads; recorded replay on golden pages | Template bench with default values plus "pick your experiment" |
| 3 | **Real science: find the null** | Tap the jockey: the centre-zero needle swings, current particles flow at the solved speed, and at balance the galvanometer branch goes **still and dark** with a soft click. Pull a plug and the null moves; drag the jockey and the wire scrapes | None. **The engine decides.** | 100% local, works offline | n/a |
| 4 | **The parallax trick** | Tilt the phone: the metre-rule reading under the jockey drifts ("+0.3 cm, read at eye level"); level the phone and it snaps true | None (gyro + optics) | Local | Slider on laptops |
| 5 | **⭐ HERO: the Chief Examiner marks her handwriting** | Her real handwritten table and graph fill the screen; red-ink marks draw on: a circle on "57" ("lengths to at least 1 d.p.: 57.0"), a box showing her graph covers about ¼ of the sheet ("at least ⅓"), her small slope triangle redrawn large, a strike through "Avoid parallax error" ("state precautions as things you did"); marks fill in item by item like a real marking scheme; each lost mark expands to the rule, the fix, and a link to the WAEC Chief Examiner report it comes from | **Muse Wonder** reads every handwritten value, axis label, plotted point and precaution with its location and writes the examiner's comments; **SAM 3.1** measures the graph's share of the page; **deterministic rules** decide the marks | Started speculatively the moment the page is snapped, so it is ready before the student finishes titrating | "Please confirm these readings" step if the handwriting is unclear |
| 6 | **Examiner questions** (the spec's "viva"; WASSCE has no oral viva, so we mirror the short part (b) questions WAEC actually sets) | The examiner asks about **her** mistake ("You wrote that you slid the jockey. Why must you not?"); she answers aloud in English or Pidgin; her words stream in; the examiner replies in about a second and models the answer in clear formal English, as WAEC expects | **Muse Voice Transcribe** (live captions) + **Muse Spark** (examiner turn) | Always live: the proof the AI is real | Typed answer box always visible |
| ✨ | **Reality preview** (optional card after marking) | "See your setup in a real lab": a photo-style image of her exact apparatus on a school bench, labelled *"Artist's impression by Muse Image, not for marking"* | **Muse Image** edits her page photo into a realistic lab scene (like the concept images) | Live, 1 image | Card simply hidden |

**Titration (second act) has its own moments 3 and 4:** hold the stopcock, drops fall, the flask swirls, methyl orange shifts colour with a live pH readout, and one drop too many turns it permanently red-orange. Moments 1, 2, 5 and 6 apply to her titration table ("24.5" circled, the rough titre bracketed).

**Teacher trust rules (non-negotiable):**
- **Never show the expected result** (the expected titre, or the true X of the resistor). WAEC explicitly complains about candidates altering titres to match the teacher's value; a tool that reveals the answer becomes a cheating aid. Accuracy is judged against a **teacher's value** the teacher enters (Teacher mode), as WAEC does.
- Say **"WAEC-style marking based on published Chief Examiner reports"**, never "official WAEC rubric".
- Use Nigerian names and conventions: trioxocarbonate(IV), tetraoxosulphate(VI), "real is positive" for lenses, a centre-zero galvanometer, pencil for traces.
- Publish the equations in a "Teacher notes" panel.

## 7. Inclusion by design (this is "Build for Your World")

| Touch | Why | How |
|---|---|---|
| Pidgin and Nigerian-English examiner | Students think and argue in code-switched speech | Toggle: English · Pidgin · Mixed (default Mixed). Have 2–3 Nigerian students review every Pidgin line; avoid caricature. |
| Typed fallback for every voice step | Noisy classrooms, shy students, deaf users, judges on mute | Always visible. Show the transcript so students can correct it. |
| **Lite mode** (2D) | Weak GPUs, low RAM | Auto-offered on low memory, lost WebGL context, or under 20 fps for 3 seconds. Same engine, examiner and questions. |
| Data-light | Data is bought in small bundles; a third of subscribers are on 2G | First load ≤ 2.5 MB; photos compressed to ~250 KB before upload; a "data used" counter. |
| **Offline lab** | Power cuts and patchy networks | PWA caches the app, the engine and golden notebooks. The lab works offline; marking and examiner questions queue until back online. |
| Colour-independent indicators | Colour-blind users | pH as a number plus a text label ("endpoint reached"). |
| Small screens | 5–6" budget phones | 16 px minimum text, 44 px tap targets, one-thumb stopcock. |
| Privacy for minors | Exercise books carry names and schools | Blur the NAME/SCHOOL header before upload; no accounts; nothing stored server-side by default. |
| Honest marking | Trust from teachers | "WAEC-style marking based on public Chief Examiner reports. Not affiliated with WAEC." No WAEC logo. |
| West Africa, not only Nigeria | WAEC serves 5 countries | Copy says "WAEC students across West Africa". |

## 8. Success criteria for the experience (we test against these on Nov 3)

1. A stranger opens the link on an iPhone and reaches the red-ink marking in **under 60 seconds** without help.
2. The golden runs work **100%** of the time, including with the network off after the first load.
3. Three fresh, never-seen notebook pages produce a usable lab.
4. Examiner questions work by voice on desktop Chrome and iPhone Safari, and by typing everywhere.
5. The lab holds **≥ 30 fps** on a low-end Tecno/Infinix/itel phone in its default tier.
6. A judge can repeat the product in one sentence: *"the one where the Nigerian student's exercise book turns into a metre bridge, the needle swings through zero, and the AI examiner takes half a mark off for 57."*
