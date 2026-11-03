# Submission: Meta Global AI Developer Hackathon (draft answers)

Due **Wed Nov 4, 9:00 PM ET = Thu Nov 5, 3:00 AM Lagos**. Submit early (aim: Nov 4 afternoon, Lagos).
Form: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit
Rules and rubric: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details (read Nov 3).

## What the judges score (Stage Two, 0–10 each)
| Category | Weight | What it asks |
|---|---|---|
| Impact | 30% | Real-world potential, who benefits, could people actually use it, fits a problem statement |
| Use of Meta AI tooling | 25% | Creative, beyond a basic integration, capabilities that surprise Meta |
| Technical depth & execution | 20% | Sound, refined engineering, real craft |
| Demo | 25% | Working, impressive, holds up live, the video is genuinely cool to watch |

Stage One is pass/fail (fits a theme, really uses Meta models). Stage Three: the top 5 per track are re-ranked by final
judges watching the videos live. Hard rules: **public open-source repo**, a **3-minute video** showing only what was
built during the event (Oct 26–Nov 4), new work only, no assets we lack rights to.
Anti-projects to stay clear of: "simple AI for Education chatbots", "simple image analyzers", medical advice.
SnapLab is neither: a deterministic physics engine and 3D bench, with Meta's models reading paper and judging answers.

## The form, field by field

**Team Name** (required): `SnapLab NG`

**Team Members**: Jephthah Mbah (donjeph), solo.

**Track** (required): **Indie Developer Track** (individual builder; judged on creativity, technical ambition and
whether it works).

**Problem statement** (required): **Build for Your World**.

**Most Viral Track, X post link** (optional, $20K for the most engagement by Nov 8): post the demo video on X, paste
the post's link here.

**Project Description**:
> SnapLab turns a WAEC/WASSCE physics practical into a working lab on any phone. Nearly two million students sat the
> WASSCE in 2025 (1,973,253 school candidates from 23,554 schools), and many of their schools have no equipped lab: they
> learn a practical they have never touched. With SnapLab a student snaps the printed question and its diagram. Meta's
> Muse Spark reads it word for word, names the practical and finds every part in the diagram; SAM 3.1 outlines each one.
> The 3D bench then assembles itself: each apparatus drops as the question names it. She can **Watch** the practical
> done by the app as the question is read aloud (wiring on "Connect the circuit", readings as they're read), **Practise**
> it herself (wire the circuit lead by lead, take seven readings, plot V against I, find the slope), or sit it under
> **Exam** conditions and get WAEC-style marks. The AI reads and judges; a deterministic engine computes every current
> and voltage, and a fixed rule engine gives every mark, so the same work always scores the same and no expected
> answer is ever shown before she hands in. Live at https://snaplab-ng-2026.web.app

**Public GitHub Repository**: https://github.com/sproutjeph/snapLabNg (public; add a README and an MIT LICENSE first).

**3-Minute Demo Video**: YouTube link (public or unlisted), see "Video" below.

**Describe your use of Meta products to build the submitted project**:
> - **Muse Spark 1.3**, strict JSON-schema structured output, three jobs: (1) reads a snapped practical question and its
>   diagram (two photos), classifies the practical, copies every instruction word for word and boxes each drawn part
>   (`apps/api/src/question.ts`); (2) compiles a photographed notebook page into a lab blueprint, streamed over SSE
>   (`apps/api/src/snap.ts`); (3) judges a student's spoken or typed examiner answer, reading Nigerian English and Pidgin
>   charitably (`apps/api/src/examiner.ts`).
> - **SAM 3.1**: box-prompted segmentation of every part Spark found in the diagram, parsed with `@meta-sam/parser`,
>   drawn live as ink outlines over her photo.
> - **Muse Wonder 1.0**: reads a student's handwritten results table, every value with its exact text and position.
> - **Muse Voice Transcribe 1.0**: live captions of her spoken examiner answers over Meta's realtime ASR WebSocket,
>   relayed by our server (PCM16 16 kHz).
> - **Muse Code**: Meta's coding agent built 17 merged PRs as a teammate on its own branches (the snap page, the welcome
>   voice, the About page, the offline PWA, mic capture, teacher mode, golden replay, lab sounds, E2E suites…), each
>   commit signed "Built with Muse Code (Meta)".
> - Every call is shown to the student in a "Show the AI" panel with real timings; the key never leaves the server.

**Why are Meta's models important to your solution?**:
> The hard part of a practical isn't the physics, it's the paper: a printed WAEC question, a hand-drawn circuit, a
> student's handwriting. Spark reads all three reliably enough to build a bench from them, with strict structured
> output that a deterministic engine can trust; SAM grounds each component to its place on the page; Wonder reads
> handwriting where other OCR fails; Voice Transcribe lets a student answer the examiner out loud. Together they turn
> "a photo of a question" into "a lab you can run", while the physics and the marks stay in code that never guesses.

**Partner technologies feedback** (Fireworks, Modal, Baseten): we did not use them; say so honestly.

**Survey questions** (likelihood, opinion, recommend scores, biggest obstacle, comparison, what matters, switching,
production blockers): your own opinions. Facts from the build, if useful for "biggest obstacle": Spark's first live
question read was cut off at our 3,000-token cap (2,216 tokens went to reasoning); a live read took 13–40 s; SAM
returns special-token text that needs Meta's parser.

**Consent checkbox**: read it yourself and decide.

## Video (3:00, the primary artifact)
Record on https://snaplab-ng-2026.web.app at laptop size, sound on, mouse slow. Show only post-kickoff work (Ohm's law,
Snap your question, Watch/Practise/Exam, the examiner, the deploy); say "built during the hackathon, Oct 26 to Nov 4".
1. 0:00–0:15 Hook: "Nearly two million Nigerian students sat WASSCE this year. Many have never touched a lab." Home
   page, welcome voice, the live 3D bench turning.
2. 0:15–0:50 Snap your question → Try a sample → "Meta is reading your question…": open Show the AI (Muse Spark, SAM
   3.1, real timings), SAM's outlines landing on R, A, K, E, X, Y, V. "Ohm's law (V–I), WASSCE 2018 Q3B."
3. 0:50–1:40 Build the bench → Watch it done: parts drop as the question names them, wiring starts on "Connect the
   circuit", the key closes and the table fills as each row is read, the graph and slope. (Use 1.5× or cut.)
4. 1:40–2:10 Practise: wire one lead by hand, a reading. Exam: the clock. Hand in → Results with WAEC marks.
5. 2:10–2:35 The examiner: one question, answer by voice (captions stream live, Voice Transcribe), Spark's verdict and
   reply. "The AI judges the answer; the marks never move."
6. 2:35–2:50 Under the hood, fast: "AI reads and judges, the engine decides", 1,317 tests, Muse Code built 17 PRs,
   live on Google Cloud.
7. 2:50–3:00 Close: who it's for, the URL. (Optional 5 s: "See Meta mark a notebook" reading handwriting.)
