# SnapLab NG

Snap your WAEC physics practical question — the bench assembles itself in 3D, then Watch it, Practise it, or sit it as an Exam for WAEC-style marks.

**Live:** https://snaplab-ng-2026.web.app

Demo video: (link)

Built solo for the Meta Global AI Developer Hackathon (Indie track), Oct 26 – Nov 4, 2026. The git history starts Oct 26, 2026.

## The problem

WAEC/WASSCE physics practicals are hands-on exams, but many schools have no equipped lab, so students learn a practical they have never touched.

1,973,253 school candidates sat the May/June 2025 WASSCE ([Newstrends](https://newstrends.ng/waec-denies-cancellation-of-may-june-2025-wassce)).

## What it does

1. **Snap your question.** Photograph the printed practical question and its diagram.
2. **The bench assembles.** Each apparatus part lands as the question names it.
3. **Watch / Practise / Exam.** Watch the practical done step by step as the question is read aloud, Practise it yourself at the bench, or sit it under Exam conditions with a clock.
4. **WAEC-style marks.** Hand in your table, graph and answers for marks from a fixed rule engine.

The live practical is Ohm's law (V–I). Metre bridge and titration are shown as "Coming soon" on the home page.

## Principle

**The AI reads and judges. The engine decides.**

- Physics lives in `packages/engine` (pure TypeScript, no I/O). AI output only parameterises the lab; it never computes currents, voltages or balance points.
- Marks come only from `packages/rules`. The same work always scores the same.
- No expected answer is shown before hand-in. On a simulated bench, the engine's own meters are the supervisor's values.

## How we use Meta's models

Every model call uses strict structured output where it returns data: `text.format = { type: "json_schema", name, schema, strict: true }`. The "Show the AI" panel (`apps/web/src/ai-drawer/`) shows each call, its model and its timing to the student. The API key (`MODEL_API_KEY`) exists only in the server environment; it never reaches client code.

| Model | Job | File |
|---|---|---|
| `muse-spark-1.3` | Question reading: classifies the practical, copies instructions word for word, boxes each drawn part | `apps/api/src/question.ts` |
| `muse-spark-1.3` | Notebook blueprint: compiles a photographed notebook page into a lab blueprint, streamed over SSE | `apps/api/src/snap.ts` |
| `muse-spark-1.3` | Examiner judging: judges a spoken or typed examiner answer | `apps/api/src/examiner.ts` |
| `sam-3.1` | Outlines each part Spark found in the diagram; special-token output parsed with `@meta-sam/parser` | `apps/api/src/question.ts`, `apps/api/src/snap.ts` |
| `muse-wonder-1.0` | Handwritten readings: reads a student's handwritten results table, value by value | `apps/api/src/snap.ts` |
| `muse-voice-transcribe-1.0` | Live captions of spoken examiner answers over the realtime ASR WebSocket (PCM16 mono 16 kHz, relayed by our server) | `apps/api/src/voice.ts` |

Model ids are defined once in `apps/api/src/snap.ts` (`MODELS`) and `apps/api/src/voice.ts` (`VOICE_MODEL`).

## Built with Muse Code

Meta's coding agent Muse Code worked as a teammate on its own `muse/*` branches. These merged PRs carry "Built with Muse Code" in their body (via `gh pr list --state merged --limit 300 --json number,title,body`):

- #133 — Snap your question: snap page and home button
- #129 — Guided-mode E2E: guided.mjs
- #127 — About page leads with Ohm's law (V-I) practical
- #118 — feat(home): guided home — welcome voice, mute, guided Watch card
- #112 — Beauty B3: steps strip, caption count, Tinos, shot --size
- #107 — E2E: the four integration scripts (watch, practise, exam, noleak)
- #97 — Wave 2a-script: Ohm's law Watch script and Practise guide
- #73 — Restyle existing screens to ink-and-paper tokens
- #47 — feat(deploy): Fly.io deploy files and static web serving
- #43 — feat(web): installable offline PWA with hand-written service worker
- #40 — feat(web): push-to-talk mic capture (PCM16 16 kHz mono)
- #37 — feat(web): quality tiers, performance step-down and context-loss recovery
- #31 — feat(web): teacher mode and teacher notes (?teacher=1)
- #26 — Add golden recording and offline replay
- #24 — Add lab notebook for metre bridge readings
- #19 — Add procedural lab sounds (Web Audio)
- #16 — Let Muse Code credit itself

## Architecture

| Path | What |
|---|---|
| `apps/web` | Vite + React 19 SPA with React Three Fiber (WebGL2) for the 3D bench |
| `apps/api` | Bun + Hono server: SSE streams (`/api/snap`, `/api/question`), JSON (`/api/examiner`), a WebSocket relay (`/ws/examiner`), `GET /healthz` |
| `packages/engine` | Pure TypeScript science: metre bridge and Ohm's law circuits. No I/O, no randomness |
| `packages/rules` | Deterministic WAEC rule engine and marking schemes |
| `packages/contracts` | JSON schemas and zod types shared by web and api |
| `golden/`, `fixtures/` | Demo notebooks and recorded Meta API responses for fixtures mode |

Deploy is Cloud Run (API) + Firebase Hosting (site), per `docs/plans/deploy-gcp.md`.

## Run locally

```sh
bun install
bun run dev
```

The API defaults to fixtures mode and needs no key: it replays the recorded responses in `fixtures/`. Live mode reads `MODEL_API_KEY` from the server environment only.

## Tests

```sh
bun run test
```

124 test files, 1,317 tests, all passing (Vitest across web, api, engine, rules and contracts; counted from a real `bun run test` run).

Other checks:

```sh
bun run typecheck
bun run lint
bun run build
```

## Built before kickoff

The hackathon kicked off on Mon Oct 26, 2026. Research, planning and design (`docs/`, dated Oct 21–25) predate it, and the repository's first commit is on Oct 26. A few hours before kickoff on Oct 26, the first 13 commits (up to `aef17f2`) set up the workspace, the 3D desk and metre bridge kit, the shared schemas, the circuit engine, the capture flow and the "Show the AI" drawer. Everything after `aef17f2` was built during the hackathon; the commit dates on `main` are the record.

## License

MIT. See [LICENSE](LICENSE).
