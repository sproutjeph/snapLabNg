# SnapLab NG: rules for every coding agent

This file is the one rulebook for every agent that writes code here (Claude Code, Gemini, anyone else). `CLAUDE.md` and `GEMINI.md` import it and add only tool-specific notes. Change the rules here, not there.

A student snaps the WAEC practical in their exercise book. The apparatus rises out of the ink as a working 3D lab. An AI examiner then marks the student's own handwriting and asks examiner questions. Meta Global AI Developer Hackathon, Indie track. Built solo, Oct 26 – Nov 4, 2026. Hero experiment: **metre bridge** (doc 15). Second: titration. Stretch: glass block.

**Principle: the AI reads and judges. The engine decides.** AI output only parameterises the lab and explains marks. It never computes currents, balance points, pH or scores.

## Source of truth (read the relevant doc before planning a feature)
- `docs/04_ARCHITECTURE.md`: stages, components, data contracts, SSE events
- `docs/05_TECH_STACK.md`: what we use and what is banned
- `docs/06_META_AI_INTEGRATION.md`: verified Meta API facts and call designs
- `docs/15_METRE_BRIDGE_HERO.md`: the hero's design, golden question and marking scheme
- `docs/07_SCIENCE_ENGINE.md`: the science models and WAEC rule table
- `docs/09_BUILD_PLAN.md`: day plan and MUST / SHOULD / COULD cut lines
- `docs/plans/`: one plan file per feature (written before coding)
- `.claude/rules/*.md`: path rules (web/3D, API server, contracts, science engine, tests). They apply to every agent, not only Claude. Read the one for the files you touch.
- Ignore `SNAPLAB_NG_MASTER_ARCHITECTURE.md`. It is superseded and contains known errors.

## Repo map
- `apps/web`: Vite + React 19 SPA, React Three Fiber (WebGL2), Zustand, GLSL shaders, PWA
- `apps/api`: Bun + Hono. `POST /api/snap` (SSE), `POST /api/mark`, `GET /ws/examiner`, `POST /api/preview`, `GET /healthz`
- `packages/engine`: pure TS science (metre bridge, titration, glass block). No I/O, no randomness
- `packages/rules`: deterministic WAEC rule engine + rubric JSON
- `packages/contracts`: JSON schemas + zod types shared by web and api
- `golden/`: demo notebooks and recorded event streams. `fixtures/`: recorded Meta API responses

## Commands (bun only; never npm, npx, yarn or pnpm)
- `bun install` · `bun run dev` (web + api)
- `bun run typecheck` · `bun run lint` (Biome) · `bun run test` (Vitest) · `bun run build`
- One package: `bun run --filter @snaplab/engine test`
- Screenshots: `bun run shot -- --route "/?golden=g1"` (phone and laptop PNGs in `.shots/`)
- Record Meta fixtures: `RECORD_FIXTURES=1 bun run dev`

## Hard rules
- IMPORTANT: the Meta API key exists only in server env (`MODEL_API_KEY`). Never put it in client code, a `VITE_` variable, a fixture or a log. Never read, print or copy `.env`.
- Banned: Rust/WASM, WebGPU/TSL, Next.js, OpenCV.js, any database, Python services, SharedArrayBuffer.
- Never show the student the expected result (the true X, or the expected titre). Accuracy is judged against a teacher-entered value.
- Same page → same score. Marks come only from `packages/rules`.
- Never weaken, skip or delete a test to make it pass. Fix the code, or stop and explain.
- Don't add features, files, docs, tests or refactors that weren't asked for. Do finish everything that was asked.
- Science changes need a test with a textbook or WAEC value, and the source cited in a comment.
- Use Nigerian naming in UI and prompts: trioxocarbonate(IV), tetraoxosulphate(VI). Use "metre bridge" (WAEC spelling) in UI text; the code identifier is `meter_bridge`.
- Never hand-edit `fixtures/`, `golden/`, `bun.lock`, `.env*` (except `.env.example`) or `SNAPLAB_NG_MASTER_ARCHITECTURE.md`. Change dependencies with `bun add` / `bun remove`.
- Never delete recursively (`rm -r`) anything except `node_modules`, `dist`, `coverage`, `.vite` or `.cache`.

## Meta API gotchas (verified; details in docs/06)
- Structured output: `text.format = {type:"json_schema", name, schema, strict:true}`. Not `response_format`.
- `sam-3.1` returns special-token text, not JSON. Parse with `@meta-sam/parser`. Boxes are in source pixels. One noun phrase per request.
- Realtime voice: the key goes in the first JSON message, not the header. Audio is raw PCM16 mono 16 kHz, paced in real time.
- There is no Meta TTS. Use browser `speechSynthesis`. Use `muse-spark-1.2` (not 1.3) for audio input.
- Don't guess API shapes. Check dev.meta.ai/docs and the installed package versions.

## Git
- The build started on Oct 26, 2026. Commits, pushes and PRs are allowed from then on; the guard hook only blocks them before Oct 26, 00:00 UTC.
- Never force-push, `reset --hard`, `clean`, or rewrite pushed history (no rebase of a pushed branch; merge `origin/main` into it instead).
- Stage files by name. Never `git add -A` or `git add .`. Never commit `.env`, `dataset/` or student photos and audio.
- No AI attribution anywhere in git or GitHub: no `Co-Authored-By` trailer for any AI, no "Generated with …" line, no session links, in commits, tags or PR text. The user is the only author.
- Turn on the shared git hooks once per clone: `git config core.hooksPath .githooks`. `pre-commit` blocks secrets, `dataset/` and other package managers' lockfiles; `commit-msg` blocks AI attribution. Both apply to every agent and every worktree.

## Branches, worktrees and pull requests
- `main` is always green and is only changed by merging a reviewed PR. Nobody commits to `main` directly after the first commit.
- One branch per feature, named for its owner: `claude/<feature>` or `gemini/<feature>` (kebab-case).
- Each agent works in its own folder, so two writers never share a working tree:
  - Claude (lead): `~/Desktop/SnapLabNG`, the main checkout.
  - Gemini: `~/Desktop/SnapLabNG-gemini`, a git worktree. The lead creates it with `git worktree add ../SnapLabNG-gemini -b gemini/<feature> origin/main`. Run `bun install` inside it. It has no `.env`, and needs none for client work.
  - Dev servers must not collide: the lead uses the default port 5173. Gemini runs `bun run dev --port 5174 --strictPort` inside `apps/web` and screenshots with `bun run shot -- --route "<route>" --base http://localhost:5174`.
  - Lead reviews: `~/Desktop/SnapLabNG-review`, a throwaway detached worktree of the PR branch, used only to run checks and screenshots, then removed.
  - Never edit files in another agent's folder and never check out its branch.
- Stay inside the paths your task owns (see "Who owns what"). If you need a change outside them (a dependency, a contract, a shared config), don't make it. Write it in the PR description under "Needs from lead".
- Before opening a PR, all four must pass in your folder: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`. For anything visible, also run the screenshot script and attach or describe the shots.
- Keep `main` merged in: `git fetch origin && git merge origin/main`. Resolve conflicts only in files you own; otherwise stop and say so in the PR.
- Push with `git push -u origin <branch>`. Open the PR with `gh pr create --base main --head <branch>`, small and about one thing. Body sections: **What**, **Why** (link the plan or doc section), **How I checked it** (commands and results, screenshots), **Needs from lead**, **Not done**.
- The lead reviews every PR, its own included, against this file and the plan: a fresh-context code review, the checks above, a science check if `packages/engine` or `packages/rules` changed, and screenshots if it's visible. Review comments go on the PR with `gh pr comment`. The author fixes them with new commits on the same branch (no force-push).
- The lead merges with `gh pr merge <n> --squash --delete-branch` once the review says ship. Then every other open branch merges `origin/main` in.

## Who owns what (one writer per path)
| Paths | Owner |
|---|---|
| `packages/engine`, `packages/rules`, `packages/contracts`, shaders (`*.glsl`), the SSE/WS relay in `apps/api` | Claude (lead) only |
| Root config (`package.json`, `bun.lock`, `tsconfig*.json`, `biome.json`), `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/`, `.gemini/`, `.githooks/`, `docs/` | Claude (lead) only |
| `apps/web/src/capture/**`, plus only the `?capture=1` preview switch in `apps/web/src/App.tsx` (plan: `docs/plans/capture-flow.md`) | Gemini, while `gemini/capture-flow` is open |
| Everything else | Claude (lead) unless a plan file assigns it |

The lead updates this table when it hands out a new slice.
