# 04 · Final Architecture: How Everything Fits Together

*This replaces sections 2, 3, 5 and 6 of the original spec. It describes the system in prose, tables and diagrams only. No code is written until kickoff on Oct 26.*

---

## 1. Architecture in one picture

```
                         ┌──────────────────────── BROWSER (Vite SPA, PWA) ─────────────────────────┐
                         │                                                                          │
  Exercise-book page ──► │  ① SNAP        camera / file → corner finder + drag handles →            │
                         │                homography → GPU rectify + ink mask       (local, <1 s)   │
                         │                     │                                                    │
                         │                     ├──► ③ BUILD starts instantly: page lies on desk,    │
                         │                     │       ink glows, lifts (no network needed)         │
                         │                     ▼                                                    │
                         │        POST /api/snap (≈250 KB JPEG + experiment hint)                   │
                         └─────────────────────┬────────────────────────────────────────────────────┘
                                               ▼
                 ┌────────────────── API SERVICE (Bun + Hono, one always-on instance) ─────────────────┐
                 │  hash / perceptual-hash → cache or golden hit? → replay recorded event stream       │
                 │  else, in PARALLEL:                                                                  │
                 │   ② READ  ├─ muse-spark-1.3  → Lab Blueprint (strict JSON schema, streamed)         │
                 │           ├─ sam-3.1 × N     → outlines of each drawn object (cosmetic + paper mask) │
                 │           └─ muse-wonder-1.0 → Page Readings: every handwritten value + its box     │
                 │                                 (speculative: ready before the student needs it)    │
                 │  → Server-Sent Events: mode · components · sam_box · params · readings · done       │
                 └──────────────────────────────┬──────────────────────────────────────────────────────┘
                                                ▼
                         ┌──────────────────────────────────────────────────────────────────────────┐
                         │  ③ BUILD   Blueprint → validate + clamp → template bench → materialise   │
                         │  ④ RUN     Science Engine (pure TypeScript, fixed 120 Hz steps)          │
                         │            → shader uniforms, needle springs, flask colour, sound        │
                         │  ⑤ MARK    Page Readings + lab readings → WAEC Rule Engine (deterministic)│
                         │            → marks; POST /api/mark → examiner comments (prose only)      │
                         │            → red-ink overlay on her own handwriting                      │
                         │  ⑥ DEFEND  mic → PCM16 → WS /ws/examiner ⇄ relay ⇄ muse-voice-transcribe     │
                         │            final transcript → muse-spark examiner turn → caption + voice │
                         └──────────────────────────────────────────────────────────────────────────┘
```

**The rule that shapes everything:** *the AI reads and judges; the engine decides.* AI output only ever **parameterises** the lab and **explains** the marks. It never computes a pH, a current, or a score.

## 2. The six stages

### ① SNAP: capture and rectify (client, local, under 1 second)

| Step | What happens | Why this way |
|---|---|---|
| Live preview | Camera preview with a page-shaped guide and a "hold steady" sharpness check. A file-picker fallback is always offered. | iOS can deny the camera; laptops may have none. |
| Find the page | A small dependency-free corner finder on a 256 px copy (bright, low-saturation "paper" blob → four extreme points). **Draggable corner handles** let the user confirm or fix, like CamScanner. | Bullet-proof on every phone; 0 KB of libraries instead of 8–10 MB of OpenCV.js. |
| Flatten | A homography from the four corners; the page is flattened in a GPU fragment shader. | Instant on any GPU. |
| Ink mask | In the same shader pass: keep dark, saturated biro strokes; reject faint ruled lines and the red margin; adapt to uneven lighting. Output is a 1024 px ink texture. | Drives the "ink lifts off the page" effect locally, before any AI answers. |
| Compress | Downscale to about 1280 px, JPEG quality ≈ 0.8 (≈ 150–300 KB). Blur the NAME/SCHOOL header. | Nigerian uplinks are slow; minors' privacy. |

### ② READ: Meta models understand the page (server, parallel, streamed)

Three calls start **at the same time**. None waits for another.

| Call | Model | Produces | On the critical path? |
|---|---|---|---|
| **Blueprint compile** | `muse-spark-1.3`, low effort, image in, strict JSON schema, streamed | Which experiment, which components, values written on the page, wiring or setup errors, approximate positions | **Yes**, but streamed: the experiment type arrives first and the bench starts building immediately |
| **Object outlines** | `sam-3.1`, one request per noun phrase, fanned out in parallel | Outline masks and boxes for each drawn object, plus the paper itself | **No.** Purely visual. If SAM finds nothing, outlines come from the blueprint's approximate boxes |
| **Page readings** | `muse-wonder-1.0`, medium effort, strict JSON schema | Every handwritten number in the results table with its row, column, exact text as written ("24.5"), and its location on the photo | **No.** Speculative: it finishes while the student is still titrating, so the marking step is instant |

The spec ran SAM first and fed its masks into the LLM. That made them **serial** and added 2–4 seconds. Muse models see images natively, so they read the photo directly.

### ③ BUILD: blueprint → 3D bench (client)

1. **Validate and clamp.** Every blueprint is checked against the schema and physical limits (molarity 0.01–2 mol/dm³, pipette 10–50 cm³, angles 0–90°). Out-of-range or missing values become defaults and are flagged in the "Show the AI" drawer.
2. **Template-snapped layout.** Each experiment has a canonical bench layout (which is how WAEC apparatus is physically arranged). The AI decides **what** is on the page and **which values**; the template decides **where** things stand. Exact per-component placement from a sketch is a research problem we do not need for the wow.
3. **Materialise.** Particles sampled from the ink mask flow towards each apparatus slot; each piece dissolves in with a noise threshold while rising out of the page. SAM outlines pulse green on the paper beneath.
4. **Values tick in.** Labels roll from 0 to the value read from her page ("0.100 mol/dm³ HCl").

### ④ RUN: the Science Engine (client, deterministic, offline)

- Pure TypeScript functions with no side effects, one module per experiment (metre bridge as the hero, titration second, glass block as stretch), each covered by unit tests against textbook values. Full models in `07_SCIENCE_ENGINE.md`.
- **Fixed 120 Hz physics steps** inside the render loop (several small steps per displayed frame), so physics is identical on a 60 Hz iPhone and a 120 Hz Android. Honest claim: *"physics at 120 Hz, rendering at your screen's refresh rate."*
- Engine outputs drive **shader uniforms** (branch currents → current-flow particle speed, pH → indicator colour blend), **particles** (current flow, drops, swirl), **springs** (galvanometer needle, stopcock) and **sound** (null click, needle slam, drip, glass ting) from one shared state object read every frame, never React state.
- Every reading the student takes (balance length, burette initial/final) is logged to a **lab notebook** in the app.

### ⑤ MARK: WAEC Rule Engine + Chief Examiner (hybrid)

| Part | Who does it | Output |
|---|---|---|
| Read her handwriting | Muse Wonder (stage ②, already done) | Values, exact text, locations |
| Confirm unclear values | The student | "We read 24.5. Is that right?" for anything low-confidence |
| Apply WAEC rules | **Deterministic Rule Engine** (TypeScript, shared by client and server) | Each marking-scheme item: earned or lost, rule code, which value, where on the page, and the WAEC report it comes from (WAEC awards marks positively, item by item) |
| Compute the score | **Deterministic** | Same page, same score, every time |
| Write the examiner's comments | Muse Spark (fast) or Muse Wonder (end-of-practical report) via `POST /api/mark` | One short comment per deduction plus an overall remark, in the chosen register |
| Draw the red ink | Client | Circles, brackets and margin notes drawn onto her photo at the value locations |

The spec let the LLM output `waecScoreOutOf20`. That is non-reproducible: a judge who reloads and gets a different score stops trusting the product. Marks are now computed; the AI explains them.

### ⑥ DEFEND: examiner questions (client + relay + Meta)

WASSCE has no oral viva, so this mirrors the short structured part (b) questions WAEC actually sets, asked out loud. Students may answer in Pidgin; the examiner models the answer in clear formal English, as WAEC expects.

```
mic ─► AudioWorklet (downsample to 16 kHz PCM16) ─► WS /ws/examiner ─► relay injects API key + keywords
   ◄─ live partial captions ◄─ muse-voice-transcribe-1.0 (PUSH_TO_TALK, English bias, WAEC keyword list)
final transcript ─► muse-spark-1.3 examiner turn (knows her deductions; asks about HER mistake)
   ─► caption on screen + browser speech synthesis (labelled) ─► next question (max 3 turns)
```

- Push-to-talk, not continuous listening: reliable in noisy rooms and cheap.
- For Pidgin answers, the relay can also send the short audio clip to `muse-spark-1.2` (the version recommended for audio input) so meaning is understood even when the transcript is rough.
- A typed answer box is always visible.

## 3. Components and responsibilities

### Browser app (Vite + React SPA, installable PWA)

| Module | Responsibility |
|---|---|
| `capture` | Camera, corner finder, handles, homography, rectify + ink-mask shader, compression, header blur |
| `pipeline` | Opens the SSE stream, applies events in order, plays golden replays with recorded timings, owns retries and fallbacks |
| `lab-scene` | The 3D desk, page plane, materialisation choreography, apparatus kits, lighting, quality tiers |
| `apparatus` | Procedural kits: metre bridge (wooden base, metre rule, wire, jockey), brass plug resistance box, centre-zero galvanometer, Leclanché cell, plug key, tube wires; burette, conical flask, pipette, retort stand and clamp, white tile, funnel; glass block, optical pins, drawing board, protractor overlay |
| `engine` | Science models (metre bridge circuit solve and galvanometer dynamics, titration; glass block as stretch), fixed-step loop, lab notebook |
| `rules` | WAEC Rule Engine and rubric data (shared package, also used by the server) |
| `marking` | Readings confirmation, red-ink overlay, score card |
| `examiner` | Mic capture worklet, WS client, captions, speech synthesis, typed fallback |
| `ai-drawer` | "Show the AI" lanes: per-model timing bars, request and response viewer, deterministic-engine lane |
| `audio` | Procedural sound from standard Web Audio nodes (drip, glass ting, crackle, hum) |
| `store` | One state store; transient reads inside the render loop |
| `lite` | 2D fallback renderer using the same engine, rules and examiner |

### API service (Bun + Hono, TypeScript, one instance always on)

| Endpoint | Purpose |
|---|---|
| `POST /api/snap` | Accepts the compressed photo and an experiment hint. Checks the cache and golden set. Otherwise fans out to Spark, SAM and Wonder in parallel. Returns a **Server-Sent Events** stream. |
| `POST /api/mark` | Accepts the deterministic rule hits and readings. Returns examiner comments (prose only). |
| `GET /ws/examiner` | WebSocket relay to Muse Voice Transcribe. Injects the key and config server-side, pipes audio and transcripts, runs examiner turns. |
| `POST /api/preview` | Optional: Muse Image "reality preview" for one page. |
| `GET /healthz` | Uptime monitor target; also reports credit spend and demo mode. |

Cross-cutting: per-IP rate limits, a daily spend cap, a `DEMO_MODE` switch (live · auto · golden-only), an in-memory LRU cache keyed by image hash, structured logs of each model's latency (which also feed the drawer).

### Static data (bundled, no database)

- **Rubric data:** WAEC rules with codes, descriptions, marks and fix text; versioned and sourced (see `07_SCIENCE_ENGINE.md`).
- **Golden packs:** for each demo notebook, the photo, ink mask and the **recorded event stream with real timings** from a live run.
- **Prompt and schema files:** versioned alongside the code.
- Student sessions live only in the browser (IndexedDB). Nothing about a minor is stored on the server.

## 4. Data contracts (described, not coded)

### 4.1 Lab Blueprint (Spark output, strict JSON schema)

Ordered so the useful parts stream first:

| Field (in order) | Meaning |
|---|---|
| `experiment` | `meter_bridge` · `titration` · `glass_block` · `unknown` |
| `confidence` | low · medium · high |
| `components[]` | Each: `kind` (from a fixed list per experiment), `label_as_written`, `approx_box` as an object `{x0, y0, x1, y1}` in 0–1 page coordinates |
| `values` | **Nullable** per-experiment objects: `meter_bridge` (the R values used, the unknown's label, the cell and galvanometer type, each with `as_written`), `titration` (acid and base **as named on the page**, concentrations, pipette volume, indicator, and the **balanced equation as written**, from which the mole ratio is derived deterministically, never guessed by the model) or `glass_block` (block dimensions, angles of incidence used), each value with `as_written` text |
| `setup_issues[]` | Setup errors seen in the drawing (e.g. "funnel left in the burette", "no white tile", "traces drawn in biro, not pencil"), each with a rule code if one applies |
| `notes` | One sentence for the drawer |

Changes from the spec's schema: no `waecScoreOutOf20` (computed instead); `paperBbox` becomes an object (strict schemas can't enforce array length); physics and chemistry blocks are **nullable**, not both required, so the model never has to invent values for the experiment that isn't on the page; experiment type comes first so the bench starts building while the rest streams.

### 4.2 Page Readings (Wonder output, strict JSON schema)

| Field | Meaning |
|---|---|
| `table_found` | true/false |
| `cells[]` | Each: `row` (reading number · or rough, 1st, 2nd, 3rd), `column` (R, l, R⁻¹, l⁻¹ for the metre bridge · final, initial, volume used for titration · i, r, d for the glass block), `text_as_written` (exactly as written, e.g. "24.5"), `value`, `unit_as_written`, `box` {x0,y0,x1,y1}, `legibility` (clear · unsure) |
| `average_as_written` | The student's stated average and which rows they averaged, if shown |
| `graph` | **Nullable.** `x_label_as_written`, `y_label_as_written` (with units, if any), `points[]` (x, y as plotted), `line_drawn`, `triangle` (corner coordinates), `slope_as_written`, `intercept_as_written`, `result_as_written` (e.g. "X = 3.0 Ω"), `box` |
| `precautions[]` | Each precaution **word for word** (the tense check reads the exact wording) |
| `other_marks[]` | Units missing from headers, crossed-out values, etc. |

The Rule Engine works on `text_as_written`: "57" fails the 1 d.p. rule even though it equals 57.0, and "24.5" fails the 2 d.p. rule even though it equals 24.50. GRAPH-SCALE uses SAM's mask of the graph (area ÷ page area).

### 4.3 Event stream (server → client, SSE)

`accepted` → `cache_hit?` → `mode` → `component` (one per item) → `sam_box` (one per label) → `values` → `setup_issues` → `readings` → `timing` (per model) → `done` · or `error{stage, fallback}` at any point.

Golden replays are simply **recordings of this exact stream with timestamps**. Replaying them reproduces the real experience offline.

## 5. "Nothing is a bottleneck": latency budget and how each wait is hidden

| Stage | Realistic time (judge on wifi / student on Lagos 4G) | What the user sees meanwhile | If it fails |
|---|---|---|---|
| Capture + rectify + ink mask | 0.1–0.4 s / 0.2–0.8 s | The page flattening | n/a (local) |
| Upload | 0.1–0.3 s / 0.5–3 s | Ink glowing and lifting | Retry once; offer golden demo |
| Spark blueprint | ≈ 2–6 s to complete, experiment type in ≈ 1–2 s | Bench template materialising, values ticking in | Template + defaults + "pick experiment" |
| SAM outlines | ≈ 1–4 s | Outlines snap on when ready | Outlines from blueprint boxes |
| Wonder readings | ≈ 5–20 s | **Nothing: the student is busy titrating** | Manual "type your readings" form |
| Physics frame | microseconds | Smooth lab | n/a |
| Examiner comments | ≈ 1–3 s | Red ink is drawn immediately from the deterministic marks; comments type in | Rule's built-in fix text |
| Examiner question turn | ≈ 1–2 s after she stops speaking | Live captions of her words, a "thinking" waveform | Typed answer path |

All times are estimates to be measured on Day 1 against the real API from Abuja. The spec's "< 2.2 s with Wonder at high effort" is not achievable; no Meta latency figures are published, and Wonder is in preview.

**Tricks that remove waiting entirely:**
1. **Local-first choreography:** the first second of magic needs no network.
2. **Parallel, not serial:** Spark, SAM and Wonder start together.
3. **Streaming + schema ordering:** the bench builds from the first field.
4. **Speculative marking:** handwriting is read while the student plays.
5. **Optimistic defaults:** the experiment hint lets the template appear at once.
6. **Cache by hash and perceptual hash:** re-photographs of golden pages return instantly.
7. **Golden replay:** recorded live runs, labelled honestly with *"Cached from a live run on Nov 3 · Run live again"*.
8. **Precompile shaders during the scan animation** so the first 3D frame doesn't stutter.

## 6. Reliability, cost and safety

| Concern | Design |
|---|---|
| Live demo must never fail | Golden replay works offline; PWA precache; `DEMO_MODE=auto` falls back to golden when the API errors or credits run low |
| Credit drain from a public link | Per-IP limits (e.g. 10 snaps/hour, 30 question turns/hour), daily spend cap, kill switch, cache. At list prices one full session costs roughly $0.05–0.20 |
| API key safety | Key only in server secrets; never in client bundles; secret scanning before the repo goes public |
| Wrong-but-valid AI output | Schema validation, physical clamps, rule-based marks, "confirm this reading" prompts, low temperature, few-shot examples from the golden pages |
| Minors' data | No accounts; header blur; no server-side storage of photos or audio; Meta's zero-data-retention option if available |
| Device range | WebGL2 only; quality tiers chosen from GPU, memory and a 2-second warm-up; WebGL context-loss recovery; Lite mode |
| Network and power outages during the build | Develop against recorded API fixtures; deploy continuously; push to GitHub several times a day |

## 7. Repository shape (for Day 1; no files are created before kickoff)

```
snaplab-ng/
├── apps/
│   ├── web/                 Vite + React SPA (capture, pipeline, lab-scene, apparatus, marking, examiner, ai-drawer, lite)
│   └── api/                 Bun + Hono service (snap, mark, examiner voice relay, preview, healthz)
├── packages/
│   ├── engine/              Science Engine: metre bridge, titration, glass block (pure TS + tests)
│   ├── rules/               WAEC Rule Engine + rubric data (shared by web and api)
│   └── contracts/           Blueprint, Readings and event-stream schemas (one source for both sides)
├── golden/                  Demo notebooks: photos, ink masks, recorded event streams
├── fixtures/                Recorded Meta API responses for offline development
├── docs/                    These documents
└── README.md                Submission-facing README (structure in 10_DEMO_AND_SUBMISSION.md)
```

One language (TypeScript), one bundler (Vite), one renderer (WebGL2), one server. Rust is an optional stretch item (a general circuit solver), never on the critical path.
