# 13 · Kickoff Prompt and Agent Rules (replaces §9 of the old spec)

*Use these at kickoff (Oct 26, after 17:00 WAT) in Claude Code (and Muse Code if you use it). They point coding agents at the new docs, not the old spec, which would make an agent faithfully build the wrong things (Rust core, WebGPU, a glowing wire, broken SAM parsing).*

---

## Part A: Agent rules (already installed)

For **Claude Code**, the rules live in the harness that is already in the folder: `CLAUDE.md` plus `.claude/` (agents, hooks, rules, skills). See `14_AGENT_HARNESS.md`. Nothing to paste.

For **Muse Code** (if you also use it), paste the "Hard rules" and "Meta API gotchas" sections of `CLAUDE.md` into its project instructions. Keep the two in sync: CLAUDE.md is the master copy.

## Part B: Day-1 kickoff prompt (paste as the first message)

**When to paste:** since Oct 22 you may run steps 1, 3, 4 and 5 before kickoff (generic scaffolding, no git). Step 2 needs the dataset and your API key. **At kickoff (after 17:00 WAT on Oct 26):** in Terminal, run `cd ~/Desktop/SnapLabNG && git init && git config core.hooksPath .githooks`, then make the first commit. Put `MODEL_API_KEY=...` into `.env` yourself (Claude can't read it). Start `claude`, and check that `/model` says Opus and `/effort` says high.

```
We are building SnapLab NG for the Meta Global AI Developer Hackathon (Indie track).
The hero experiment is the metre bridge (docs/15_METRE_BRIDGE_HERO.md), titration is second.
Follow CLAUDE.md. Use the Explore agent to summarise docs/04 §4 and §7 (contracts and repo
shape) and docs/05 (stack) for you, instead of reading every doc into this session. Use
api-verifier for current install commands and versions of Vite, React 19, React Three Fiber,
drei, Hono, Biome, Vitest and zod.

Today is Day 1. Do ONLY these, in order, and stop for my review after each:

1. Initialise the monorepo exactly as in docs/04 §7 (apps/web, apps/api, packages/engine,
   packages/rules, packages/contracts, golden/, fixtures/), TypeScript strict, Bun workspaces,
   Vitest in each package, Biome with a biome.json, and .env.example with MODEL_API_KEY only.
   The harness in .claude/ needs these root scripts, named exactly: dev, typecheck, lint, test,
   build, shot. .gitignore: .env*, !.env.example, dataset/, .shots/, node_modules/, dist/,
   .claude/settings.local.json. Create docs/plans/ and docs/BUILD_LOG.md.
2. apps/api: a Bun + Hono server with GET /healthz, and a script that runs the Day-1 tests
   in docs/12_DAY1_TEST_SHEET.md (SAM labels incl. "graph", Spark blueprint, Wonder table +
   graph + precautions, voice clips) against dataset/ and dataset/audio/. It saves every raw
   Meta response into fixtures/ and prints a results table (hit rates, latencies, graph-area
   error). Use @meta-sam/parser for SAM. Never invent API fields: ask api-verifier.
3. packages/contracts: the Lab Blueprint and Page Readings schemas from docs/04 §4, as strict
   JSON schemas plus zod types: experiment first (meter_bridge | titration | glass_block |
   unknown), nullable per-experiment blocks, boxes as {x0,y0,x1,y1} objects,
   text_as_written on every reading, the nullable graph block, and precautions[] word for word.
4. apps/web: a Vite + React + R3F hello-world that shows a flat textured page on a 3D desk
   with bloom, deployable as static files. It sets window.__SNAPLAB_READY__ = true after the
   first rendered frame. Add scripts/shot.ts as specified in .claude/skills/verify-3d/SKILL.md,
   then run /verify-3d to prove headless WebGL screenshots work on this Mac.
5. Deployment config for Cloudflare Pages (web) and Fly.io with one always-on machine (api),
   with secrets set from the environment, never committed.

Steps 1, 3 and 4 are well specified: hand each to the implementer agent, one at a time
(never two at once). Write step 2's recording logic yourself. After each step, stop:
I will run /ship, then tell you to continue. No AI attribution in any commit.
Do not build any other features today.
```

## Part C: Prompt starters for later days (one line each, expand as needed)
- Start each with `/clear`, then `/plan-feature <the line below>`, then approve the plan.
- **Day 2:** "Build the capture flow from docs/04 §2 ① and packages/engine/meter-bridge from docs/07 §4 with tests; then the procedural metre bridge kit (doc 15)."
- **Day 3:** "Build POST /api/snap as SSE per docs/04 §4.3 with Spark ∥ SAM ∥ Wonder (table + graph) in parallel, validation and clamps, the template bench, the reveal choreography, and golden recording/replay."
- **Day 4:** "Build the metre bridge interaction (tap-to-contact jockey, galvanometer needle and slam, current-flow particles from solved currents, plug box, key and polarisation, scrape on drag, metre-rule parallax) driven only by packages/engine."
- **Day 5:** "Build packages/rules for the metre bridge scheme in docs/15 §4, readings and graph confirmation, and the red-ink overlay on table and graph; then the Show-the-AI drawer."
- **Day 6:** "Build packages/engine/titration from docs/07 §2 with tests, the titration kit, and hold-to-drip, swirl, indicator colour and overshoot."
- **Day 7:** "Add the titration marking rules to the existing overlay; then build the examiner questions per docs/06 §5.5: AudioWorklet PCM16, WS relay with key in the first message, Spark turns, captions, speechSynthesis, typed fallback."

## Part D: First commit, at kickoff
1. `git init` only after 17:00 WAT on Oct 26 (a pre-kickoff scaffold stays uncommitted until then), then `git config core.hooksPath .githooks` so the commit-msg hook rejects any AI attribution.
2. First commit: the docs folder, `CLAUDE.md`, `.claude/` (without `settings.local.json`), `.githooks/` and the scaffold from Part B, step 1. The guard hook unblocks git automatically at 17:00 WAT.
3. Keep `dataset/` (student photos and voices) **out of the public repo** (gitignore it). Only the three golden images, with consent, go into `golden/`.
4. Push to a public GitHub repo with a licence (MIT or Apache-2.0) when the rules require it; keep it private until then if allowed.
