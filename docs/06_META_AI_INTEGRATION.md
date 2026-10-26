# 06 · Meta AI Integration: Every Model, Its Job, and How Not to Break It

*Verified against the public Meta Model API docs at https://dev.meta.ai/docs on 2026-10-21. Full claim-by-claim table with sources: `research/02_meta_apis.md`. Described in prose and tables; no code before kickoff.*

---

## 1. The principle

> **The AI reads and judges. The engine decides.**

Each Meta model gets **one honest job** that only a model can do, and the judge **sees** it happen in the "Show the AI" drawer with real timings. No generic chat box, no "ask AI anything".

## 2. Model-to-job map (this table goes in the README and the drawer legend)

| Meta model | Exact ID | Job in SnapLab | What the judge sees | Critical path? |
|---|---|---|---|---|
| **Muse Spark 1.3** | `muse-spark-1.3` | (a) **Blueprint compile**: reads the photo and returns which experiment, components, values written on the page, setup errors. (b) **Examiner question turns** | Streaming JSON with `strict: true`; per-turn latency; which rule the question probes | (a) Yes, streamed; (b) yes |
| **SAM 3.1** | `sam-3.1` | **Outlines** of each drawn object and of the paper itself | Coloured masks appearing per label with per-request timings, and an honest "no match" row | No (cosmetic) |
| **Muse Wonder 1.0** | `muse-wonder-1.0` (Preview) | (a) **Reads her handwriting**: every value in the results table with its exact text and location. (b) **End-of-practical Chief Examiner report** | Extracted values highlighting on the photo as they parse | No (speculative, ready before needed) |
| **Muse Voice Transcribe** | `muse-voice-transcribe-1.0` | **Live captions** of the student's spoken answers | Words streaming in as she speaks | Yes (with typed fallback) |
| **Muse Image** | `muse-image-1.0` | Optional **"Reality preview"**: her setup re-imagined as a photo of a real school lab bench, labelled "Artist's impression, not for marking" | One image card after marking | No |
| **Muse Spark 1.2** | `muse-spark-1.2` | Optional: understand **Pidgin** answers straight from the short audio clip (1.2 is the version Meta recommends for audio input) | A "heard in Pidgin" chip on the turn | No |
| **Muse Code** | (CLI agent) | Used to **build** the app | README section "How Muse Code built this" with concrete examples; 2 seconds in the video | — |

All four models named on the event page (Spark, Wonder, Image, SAM 3.1) plus Voice Transcribe and Muse Code are used, each visibly.

## 3. Platform facts we rely on (VERIFIED)

- Base URL `https://api.meta.ai/v1`; header `Authorization: Bearer <key>`; keys start with `LLM_` and belong to a team that shares rate limits. **Never put the key in browser code.**
- OpenAI-SDK compatible (Responses and Chat Completions); also an Anthropic-compatible Messages API.
- Endpoints: `POST /v1/responses` (Spark, Wonder, SAM), `POST /v1/images/generations`, `POST /v1/images/edits`, `wss://api.meta.ai/v1/asr/realtime`, `POST /v1/asr/transcribe`, `POST /v1/files`.
- Reasoning effort values: `minimal`, `low`, `medium`, `high`, `xhigh`, `max` (`none` returns an error). Reasoning tokens bill as output and delay the first visible token.
- Structured output on the Responses API: `text.format = { type: "json_schema", name, schema, strict }`. `response_format` is ignored there. Strict mode: root is an object, `additionalProperties: false` on every object, every key listed in `required`, no recursion, nesting ≤ 10.

**Prices and limits (per team):**

| Model | Price | Rate limit |
|---|---|---|
| Muse Wonder 1.0 | $4 in / $20 out per M tokens | 3,000 RPM |
| Muse Spark 1.3 | $1.25 / $4.25 per M tokens | 3,000 RPM |
| Muse Spark Contributor | $0.10 / $0.20 (Meta may train on your data) | 150 RPM |
| Muse Image | $0.01 per image | 150 RPM |
| Voice Transcribe | $0.18 per audio hour | 256 concurrent streams |
| SAM 3.1 | $2.50 per 1,000 images | 3,000 RPM |

**Budget:** one full session (snap, SAM fan-out, Spark compile, Wonder readings, a few question turns) costs roughly **$0.05–0.20** at list prices. $150 is ample for development and judging **if** the public link is rate-limited and Wonder is never run at `max` in a loop. Use **Spark Contributor** for bulk development testing on non-personal test images only.

## 4. Where the original spec's API usage would break (and the fix)

| # | Spec assumption | Reality | Fix |
|---|---|---|---|
| 1 | SAM returns JSON with boxes, masks, scores | Returns **special-token text** in the output stream (e.g. `<0f>0<|box;x1=…;…|><|mask;…|>`). `JSON.parse` throws, the spec's catch returns empty, and **every scan silently shows zero detections** | Use Meta's official **`@meta-sam/parser`** (`parseImageStream`, `recordsOfKind`, `decodeMaskToRaster` / `decodeMaskToSVGPath`) |
| 2 | Boxes normalised 0–1 | Boxes are **in source pixels** with the frame's w and h attached | Normalise ourselves before placing anything on the page |
| 3 | Masks as RLE; scores always present | Masks use a custom **base85** encoding; confidence only with `metadata.include_confidence: "true"` | Decode with the parser (SVG path is ideal for glowing outlines); request confidence |
| 4 | Send the image by `file_id` | `file_id` is documented for SAM **video** only; images go as a public URL or **base64 data URL** | Send a base64 data URL of the ~250 KB JPEG |
| 5 | Video in any format | MP4/MOV only; browser-recorded WebM is rejected | We don't send video |
| 6 | Realtime ASR auth via HTTP header | **The header is ignored.** The key goes inside the **first JSON message**, sent within 10 seconds | The relay injects the key server-side in the handshake |
| 7 | Relay browser mic audio as-is | Must be **raw 16-bit mono PCM at 16 or 24 kHz**, paced at about real time (more than 5 s ahead closes the socket) | AudioWorklet downsamples to 16 kHz PCM16 and sends small frames in real time |
| 8 | Vocabulary biasing field, "99% accuracy" | Field is **`keywords`**, set **once** at session start, "biases recognition but doesn't guarantee exact spelling"; no accuracy figures published | Use the WAEC keyword list; drop the 99% claim |
| 9 | Listens in Nigerian English **or Pidgin** | The 25 validated languages include English but **not Pidgin, Yoruba, Hausa or Igbo** | Bias to English; let Spark interpret a messy transcript charitably; optional Spark 1.2 audio path for Pidgin; typed fallback |
| 10 | The examiner speaks | **No text-to-speech on the Meta API** | Browser `speechSynthesis` (labelled) + captions. Meta's open MMS-TTS lists Pidgin but is non-commercial and needs self-hosting: roadmap only |
| 11 | Muse Image edits a "corrected WAEC model diagram" with a mask | **No mask parameter** (returns 400), and nothing guarantees a correct diagram | Never use images for marking; only the labelled "reality preview" |
| 12 | Spark in < 1.2 s, Wonder blueprint in < 2.2 s | **No latency figures published**; Wonder at high effort with an image and a big schema is likely 8–30 s | Spark (low) on the interactive path, streamed; Wonder off the critical path |
| 13 | SAM reliably finds "resistor", "burette", "wire loop", "titration table" in biro sketches | **No evidence** SAM works on hand-drawn schematics; the SAM 3 paper admits weakness on out-of-domain concepts; a table of readings is not an object | Treat SAM as cosmetic; **Day-1 test**; fallback below |
| 14 | Spark 1.3 for audio | Spark 1.3 "audio input isn't fully supported" | Use Spark 1.2 for any audio input |

## 5. Call designs (described)

### 5.1 Blueprint compile (`muse-spark-1.3`)
- **Input:** the rectified page as a data URL, the experiment hint if the user tapped one, a short system prompt with the WAEC apparatus vocabulary and Nigerian naming conventions, and 2–3 few-shot examples from the golden pages.
- **Output:** the Lab Blueprint (`04_ARCHITECTURE.md` §4.1), strict schema, **streamed**, experiment type first.
- **Settings:** reasoning `low`, low temperature, `store: false` for minors' data.
- **Guards:** schema validation + physical clamps; the balanced equation is parsed by our code to get the mole ratio.

### 5.2 Object outlines (`sam-3.1`)
- **Plan A (text prompts):** one request per noun phrase, in parallel: metre bridge → "galvanometer", "resistance box", "long straight wire", "cell", "key", **"graph"** (its mask area scores GRAPH-SCALE), "table"; titration → "burette", "conical flask", "retort stand", "pipette", "white tile", plus "sheet of paper"; glass block → "rectangle", "pin", "line". Also try "drawing of a burette" style phrasings on Day 1.
- **Plan B (box prompts):** if text prompts fail on sketches, take Spark's approximate boxes and send them to SAM as **box prompts** (up to 16 per request) to get clean masks of the ink inside each box. This keeps SAM doing real, visible work even when its text grounding fails on drawings.
- **Plan C:** if SAM adds nothing, outlines come from the blueprint boxes and the drawer says so honestly.

### 5.3 Page readings (`muse-wonder-1.0`)
- **Input:** the rectified page (and the graph sheet, if photographed separately); a schema asking for every table cell with its `text_as_written`, value, unit, location and legibility, plus the graph block (axis labels, points, triangle, s, c, result) and every precaution word for word (doc 04 §4.2).
- **Settings:** reasoning `medium`; started **in parallel** with the compile, so it is done long before the student reaches marking.
- **Guards:** any cell marked "unsure" goes to the student as "We read 24.5. Is that right?"; the Rule Engine works on `text_as_written`.

### 5.4 Examiner comments and report (`muse-spark-1.3`, optionally `muse-wonder-1.0`)
- **Input:** the deterministic rule results (codes, values, earned/lost, WAEC source), never raw permission to change marks.
- **Output:** one short comment per item plus an overall remark, in English, Pidgin or Mixed.
- Wonder produces the fuller end-of-practical report asynchronously; Spark is used when speed matters.

### 5.5 Examiner questions (Voice Transcribe + Spark)
- Relay handshake: model `muse-voice-transcribe-1.0`, `audioEncoding: PCM_16KHZ`, `mode: PUSH_TO_TALK`, `languageBias: ["English"]`, `keywords`: the WAEC list (jockey, galvanometer, metre bridge, constantan, balance point, resistance box, Leclanché, burette, pipette, conical flask, meniscus, concordant titre, methyl orange, phenolphthalein, trioxocarbonate, tetraoxosulphate, normal, refraction, Snell's law, lateral displacement, critical angle…).
- On a final transcript: Spark (low) gets the student's deductions, the question asked, the transcript, and the instruction to interpret Nigerian English and Pidgin charitably; returns a verdict chip (correct / partly / needs work), a short reply, and the model answer in formal English.
- Cap at 3 turns; pre-warm the socket when the step opens.

### 5.6 Reality preview (`muse-image-1.0`)
- One edit of the page photo with a prompt describing the extracted apparatus on a real school lab bench. Shown only after marking, labelled as an artist's impression. Never used for grading. Skip silently on any error.

## 6. Day-1 spike (the first 3 hours of the hackathon decide the pipeline)

Run against the **30+ real notebook photos** shot before kickoff and save every response as a fixture:

| Test | Measure | Decision it drives |
|---|---|---|
| SAM text prompts on sketches (3 phrasings × 6 labels × 10 pages) | Hit rate, box quality, latency | Plan A vs B vs C for outlines |
| SAM box prompts from Spark boxes | Mask quality | Plan B viability |
| Spark blueprint (low effort) | Correct experiment, values, latency to first field and to done | Prompt and schema tuning |
| Wonder handwriting extraction on results tables | Cell accuracy on "24.5" vs "24.50", latency | Confirmation-step threshold |
| Voice Transcribe on 10–20 Nigerian English and Pidgin clips | Word accuracy on WAEC keywords | Whether to add the Spark 1.2 audio path |
| Latency from Abuja and from the chosen server region | p50 / p95 | Server region; timeouts |

Also confirm on **Oct 21–25**: a key can be created and used **from Nigeria** (the API launched as a US-only preview; Nigeria is neither listed nor blocked), and the credit balance shows.
