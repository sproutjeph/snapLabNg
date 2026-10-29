# SnapLab NG: rules for every coding agent

This file is the one rulebook for every agent that writes code here (Claude Code, Gemini, Muse Code, anyone else). `CLAUDE.md` and `GEMINI.md` import it and add only tool-specific notes; Muse Code reads this file directly. Change the rules here, not there.

A student snaps the WAEC practical in their exercise book. The apparatus rises out of the ink as a working 3D lab. An AI examiner then marks the student's own handwriting and asks examiner questions. Meta Global AI Developer Hackathon, Indie track. Built solo, Oct 26 – Nov 4, 2026. Hero experiment: **metre bridge** (doc 15). Second: titration. Stretch: glass block. Since Oct 28: a hands-on **Ohm's law (V–I)** practical (`?learn=ohms-law`, `docs/plans/ohms-law-vi.md`) comes before the titration engine, and the app moves to an ink-and-paper look (`docs/plans/ink-look.md`). **Current direction (Oct 29): the exam practical** (question → Watch → Practise → Exam), in `docs/plans/exam-redesign.md`.

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
- Never show the student the expected result before she hands in. On a snapped page, accuracy is judged against a teacher-entered value; on a simulated bench, the engine's own meters are the supervisor's values.
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
- No AI attribution in git or GitHub for Claude or Gemini: no `Co-Authored-By` trailer, no "Generated with …" line, no session links, in commits, tags or PR text.
- **Exception, by the user's choice: Muse Code credits itself.** Its commits end with a `Built with Muse Code (Meta)` line, and its PR bodies start with `_Built with Muse Code, Meta's coding agent._` so judges can see where Meta's agent did the work. Only Muse Code does this, and only on its own `muse/*` branches.
- Turn on the shared git hooks once per clone: `git config core.hooksPath .githooks`. `pre-commit` blocks secrets, `dataset/` and other package managers' lockfiles; `commit-msg` blocks AI attribution. Both apply to every agent and every worktree.

## Branches, worktrees and pull requests
- `main` is always green and is only changed by merging a reviewed PR. Nobody commits to `main` directly after the first commit.
- One branch per feature, named for its owner: `claude/<feature>`, `gemini/<feature>` or `muse/<feature>` (kebab-case).
- Each agent works in its own folder, so two writers never share a working tree:
  - Claude (lead): `~/Desktop/SnapLabNG`, the main checkout.
  - Gemini: `~/Desktop/SnapLabNG-gemini`, a git worktree. The lead creates it with `git worktree add ../SnapLabNG-gemini -b gemini/<feature> origin/main`. Run `bun install` inside it. It has no `.env`, and needs none for client work.
  - Muse Code: `~/Desktop/SnapLabNG-muse`, a git worktree created the same way (`git worktree add ../SnapLabNG-muse -b muse/<feature> origin/main`). Nothing runs Claude's hooks for Muse Code, so the shared git hooks are its guard: check `git config core.hooksPath` prints `.githooks`, and run the four checks yourself before every commit.
  - Claude's parallel writer subagents: worktrees under `.claude/worktrees/`, created by the lead's Agent tool, one `claude/<slice>` branch each. The lead pushes, opens and merges their PRs.
  - Dev servers must not collide: the lead uses the default port 5173, Gemini 5174, Muse Code 5176 (the lead's reviews use 5175), and the lead's parallel writer slots 5177, 5178, 5179, 5180 and 5181. Run `bun run dev --port <yours> --strictPort` inside `apps/web` and screenshot with `bun run shot -- --route "<route>" --base http://localhost:<yours>`.
  - Lead reviews: `~/Desktop/SnapLabNG-review`, a throwaway detached worktree of the PR branch, used only to run checks and screenshots, then removed.
  - Never edit files in another agent's folder and never check out its branch.
- Stay inside the paths your task owns (see "Who owns what"). If you need a change outside them (a dependency, a contract, a shared config), don't make it. Write it in the PR description under "Needs from lead".
- Before opening a PR, all four must pass in your folder: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`. For anything visible, also run the screenshot script and attach or describe the shots.
- Keep `main` merged in: `git fetch origin && git merge origin/main`, then **`bun install`** (merges can bring new dependencies; without it, checks fail with errors that look like `main` is broken). Resolve conflicts only in files you own; otherwise stop and say so in the PR. One shared exception: when two slices each added a preview switch to `apps/web/src/App.tsx`, keep both switches.
- Push with `git push -u origin <branch>`. Open the PR with `gh pr create --base main --head <branch>`, small and about one thing. Body sections: **What**, **Why** (link the plan or doc section), **How I checked it** (commands and results, screenshots), **Needs from lead**, **Not done**.
- The lead reviews every PR, its own included, against this file and the plan: a fresh-context code review, the checks above, a science check if `packages/engine` or `packages/rules` changed, and screenshots if it's visible. Review comments go on the PR with `gh pr comment`. The author fixes them with new commits on the same branch (no force-push).
- The lead merges with `gh pr merge <n> --squash --delete-branch` once the review says ship. Then every other open branch merges `origin/main` in.

## Who owns what (one writer per path)
| Paths | Owner |
|---|---|
| `packages/engine`, `packages/rules`, `packages/contracts`, shaders (`*.glsl`), the SSE/WS relay in `apps/api` | Claude (lead) only |
| Root config (`package.json`, `bun.lock`, `tsconfig*.json`, `biome.json`), `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/`, `.gemini/`, `.githooks/`, `docs/` | Claude (lead) only |
| `scene/ink/**`, `scene/look/**` (except `types.ts`, plus `scene/look/LookPreview.tsx`), additive `quality/tier.ts` (plan: `docs/plans/exam-redesign.md`, Wave 1) | Claude subagent `shader-artist`, while `claude/look` is open |
| `apparatus/ohms-law/**`, new `apparatus/materials/**`, `layout.ts` v2 (additive only), a `PenNib` cursor prop (plan: `docs/plans/exam-redesign.md`, Wave 1) | Claude subagent `apparatus-modeller`, while `claude/apparatus-v2` is open |
| `learn/script/**`, `learn/voice/**` (both except `types.ts`), `learn/player/**`, additive `learn/timeline.ts`, `learn/script/DirectorPreview.tsx` (plan: `docs/plans/exam-redesign.md`, Wave 1) | Claude subagent `general-purpose`, while `claude/director` is open |
| `home/**`, `learn/paper/**` (except `types.ts`, plus `learn/paper/PaperPreview.tsx`), `learn/results/**` (except `types.ts`, plus `learn/results/ResultsPreview.tsx`) (plan: `docs/plans/exam-redesign.md`, Wave 1) | Claude subagent `ui-builder`, while `claude/paper` is open |
| Everything else | Claude (lead) unless a plan file assigns it |

No Wave 1 slice edits `App.tsx`; the preview switches are already in place. All paths above are under `apps/web/src/`.

The lead updates this table when it hands out a new slice. **All 3D work (scene, kits, reveal, particles, shaders) stays with the lead**: from Oct 27, Gemini runs as Gemini Flash and gets UI and logic slices only, and Muse Code gets non-3D slices only.
