# Snap your question (Nov 2)

## Goal
Add a first step to the Ohm's law flow: **"Snap your question"** or **"Use the app's question"** (Q3B, as today).
If she snaps, Meta's models read the photo, say which practical it is, find the parts in the diagram and read the
question word for word. The app then assembles that bench part by part, shows **her** question in the paper panel,
and she goes on to Watch, Practise or Exam exactly as now. Only Ohm's law has to work; anything else gets an honest
"not ready yet" with a button to use the app's question. Built and checked before deploy.

**Principle unchanged: the AI reads and judges, the engine decides.** The snap gives the experiment, the printed
question text, the apparatus named and the parts drawn. It never sets currents, voltages, the wire, the box values
or marks. In v1 the bench, the readings and the 21-mark scheme stay Q3B's (the only question we snap); values the
snap reads (e.g. R settings) are shown, not used.

## What exists (Explore map, Nov 2)
- Snap pipeline for the metre bridge: `?flow=1` → `pipeline/FlowPage.tsx`, capture `CaptureFlow.tsx` +
  `CameraView.tsx` (camera and file input), `pipeline/snapClient.ts` → `POST /api/snap` (SSE, `apps/api/src/snap.ts`):
  Spark 1.3 blueprint, SAM 3.1 outlines, Wonder readings. Server modes live | fixtures | golden-only
  (`apps/api/src/env.ts`), `RECORD_FIXTURES=1` records live responses, rate limit, spend cap, photo-hash cache.
- `SnapExperiment` excludes `ohms_law_vi`; the blueprint's component kinds have no ammeter, voltmeter or box.
  Nothing hands a snap to `learn/`.
- The Ohm's law question is data: `PracticalQuestion` (`learn/paper/types.ts`), `OHMS_LAW_QUESTION`. Watch v2's beats
  key on instruction index + a phrase, falling back to the sentence start when the phrase is missing, so a question
  with Q3B's shape drives the bench unchanged.

## The flow
1. Home, Ohm's law card: a new primary **Snap your question** button; Watch / Practise / Exam stay (app's question).
2. `?snap=question`: the snap page. One or two photos (question page, diagram page; one page holding
   both is fine). Camera on phones, file pick on laptops, plus **Try a sample** (our own typeset Q3B page rendered to
   JPEG, no WAEC scan, matching the paper's existing rule).
3. Upload → live "Meta is reading" panel: the photo with SAM outlines landing on each drawn part, Spark's parts list
   and the question text streaming in, real timings (the AI drawer shows each call).
4. Result: "Ohm's law (V–I) · WASSCE (SC) 2018 Paper 3 Q3B" (as printed), the parts it found, then **Build the bench**:
   the bench assembles part by part, each named from the snap.
5. The paper panel shows her question (the snapped text, her diagram photo beside our clean diagram), and the usual
   choice: Watch / Practise / Exam. Watch reads her text and drives the bench as now.
6. Not Ohm's law → "This looks like <practical>. Only Ohm's law is ready." + Use the app's question / Snap again.
   Unreadable or error → Snap again / Use the app's question. Never stuck.

## Contracts (docs PR, merged before the wave)
- `packages/contracts/src/question.ts` (merged with this plan):
  - `QuestionRead`, Spark's strict `practical_question` schema (`questionJsonSchema`): `experiment` first
    (`ohms_law_vi | meter_bridge | titration | glass_block | unknown`), `confidence`, `source_as_printed`,
    `title_as_printed`, `apparatus: {kind, text_as_printed}[]`, `instructions: {label, text}[]`,
    `diagram: {present, photo: 0|1, parts: {kind, label_as_printed, box: Box}[]}`. `ApparatusKind` = cells, key,
    ammeter, voltmeter, resistance_box, rheostat, wire_xy, metre_rule, connecting_wires, galvanometer, other.
  - `QuestionEvent` SSE union: `accepted {request_id, image_sha256[1..2]}`, `cache_hit`, `question {question}`,
    `part_outline {part, box, score}`, `timing` (same shape as the snap stream), `done {total_ms}`,
    `error {stage: input|rate_limit|budget|read|sam, message, fallback: app_question|retry_later|none}`.
    Order: accepted → question (or error read → done) → part_outline + timing per SAM call → done.
- `POST /api/question`: `multipart/form-data`, field `photos` appended once or twice, each `image/jpeg`
  (≤ 2048 px long side; the client re-encodes PNG and camera frames to JPEG). Same size checks, rate limit and
  spend cap as `/api/snap`. Responds `text/event-stream` of `QuestionEvent`, one JSON per `data:` line.
- Web (merged with this plan): `snapq/store.ts` (`SnappedPaper`, `setSnappedPaper`, `getSnappedPaper`,
  `SNAPPED_PRACTICAL_URL = "/?practical=ohms-law&question=snapped"`, `SNAP_QUESTION_URL = "/?snap=question"`,
  `SAMPLE_PHOTOS`); App routes `?snap=question` to `snapq/SnapQuestionPage.tsx` (placeholder for Muse);
  `snapq/FoundOverlay.tsx` (placeholder with the final `FoundOverlayProps`, for Gemini).
- The sample pages `public/samples/q3b-question.jpg` and `q3b-diagram.jpg` are rendered by the lead from our own
  paper and diagram.
- `learn/` (lead): `?question=snapped` reads `getSnappedPaper()`, maps it with a pure, tested
  `toPracticalQuestion` (apparatus kinds to bench parts), and falls back to Q3B with a short note when it is gone.

## Muse: snap page
Owns `apps/web/src/snapq/**` except `store.ts` and `FoundOverlay*`, plus the button in `apps/web/src/home/**`.
- `snapq/client.ts`: `streamQuestion(photos: Blob[], onEvent: (e: QuestionEvent) => void, signal?: AbortSignal):
  Promise<void>`, modelled on `pipeline/snapClient.ts` (validate every event with `QuestionEvent.safeParse`).
- `snapq/toJpeg.ts`: any image `Blob` → JPEG `Blob`, long side ≤ 2048 px (canvas), tested.
- `SnapQuestionPage.tsx` (default export; replace the placeholder):
  1. Pick: up to two photos (camera via the existing `capture/CameraView.tsx`, or a file input), thumbnails,
     remove one; **Try a sample** loads `SAMPLE_PHOTOS`; **Use the app's question** → `/?practical=ohms-law`.
  2. Read: send, show "Meta is reading your question…", stream in the title/source, the apparatus list and each
     instruction as the `question` event lands; `<FoundOverlay>` on the diagram photo with parts and outlines
     growing; a small "Show the AI" list of `timing` events (model, label, ms).
  3. Result: `ohms_law_vi` → "Ohm's law (V–I)" + source + parts found + **Build the bench**, which calls
     `setSnappedPaper(...)` and `navigate(SNAPPED_PRACTICAL_URL)`. Other experiment → "This looks like <name>. Only
     Ohm's law is ready." + Use the app's question / Snap again. `error` → its message + Snap again / Use the app's
     question. No dead ends; Back to home always visible.
- Home: on the Ohm's law card, a **Snap your question** button → `navigate(SNAP_QUESTION_URL)`, beside Watch /
  Practise / Exam (which keep using the app's question).
- Tests: client event parsing (good, bad line, error event), toJpeg size, the three result states.

## Gemini: found overlay
Owns `apps/web/src/snapq/FoundOverlay.tsx`, its CSS and test. Pure display from `FoundOverlayProps` (in the
placeholder): her photo at its aspect ratio; for each part an ink outline box (SAM's box when present, else Spark's)
that draws in as the part arrives, with a tag "A · ammeter" (printed label, plain kind name); `highlight` emphasises
one part and dims the rest; works at phone width. No model calls, no science.

## Work split
- **Lead (Claude)**: contracts; `/api/question` (Spark 1.3 strict `practical_question` schema over both images, then
  SAM 3.1 box prompts per drawn part; cache, rate limit, spend; tests with fixtures); record one live fixture from the
  user's two photos (`RECORD_FIXTURES=1`, the key stays in server env); `toPracticalQuestion` + LearnPage/paper using
  the snapped question; the assemble-on-snap 3D beat. Sample page JPEG from our own paper.
- **Muse Code `muse/snap-question`** (non-3D): the snap page and the home button ("Muse: snap page").
- **Gemini `gemini/found-overlay`**: `snapq/FoundOverlay.tsx` + test ("Gemini: found overlay").

Order: contracts PR → wave (lead API + fixture, Muse page, Gemini overlay) → lead wiring into learn + assemble beat →
`scripts/e2e/snap.mjs` (fixtures mode) → Chrome walk: home → snap sample → Ohm's → Watch, and → Practise → hand in.

## Done when
- Snapping the user's Q3B photos (live once, fixtures after) identifies Ohm's law, outlines the parts, reads the
  question; Build the bench assembles; the paper shows her text; Watch, Practise and Exam all run to the end.
- A metre bridge or blank photo gets the honest message with a way on. No dead ends.
- Use the app's question works exactly as today; the five existing E2E scripts still pass; four checks green.
- No key in the client; marks unchanged and only from `packages/rules`.

## Progress
- Nov 2: merged #131 (contracts), #132 (`/api/question`), #133 (snap page, Muse), #134 (live Q3B recording),
  #135 (practical on her question), #136 (overlay, Gemini), #137 (Watch → guided). Walked in Chrome: Home → Snap your
  question → Try a sample → Meta reads it → Build the bench → Watch (her words drive the bench).
- Open: `scripts/e2e/snap.mjs`; a live Spark read takes ~40 s (fixtures mode replays the recording for any photo).
