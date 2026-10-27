# Build log

## Oct 26, after the official rules
- The rules say the building period is Oct 27 – Nov 4. Everything above this entry (PRs #1–#12) was committed Oct 26, 11:05–13:56 WAT, before the 17:00 kickoff. The repo is now public, tag `pre-kickoff` marks that commit, and the README lists the work. docs/01 is updated from the official guide.

## Oct 26 (Day 1)
- First commit: planning docs, agent harness (`.claude/`, `.gemini/`, `.githooks/`), shared rulebook `AGENTS.md`, generic workspace config. No app code.
- PR #1 web shell (desk, lined page, ink glow, screenshot script). PR #3 Gemini's procedural metre bridge kit, merged after two review rounds on wire pointer handling (world vs local cm, R3F capture, lifting off the wire must not count as a drag).
- PR #5 contracts, #6 metre bridge engine (science-checked; corrected docs/07 on interchange-and-average), #7 engine drives the kit (`?kit=meter-bridge`), #8 Gemini's capture flow (corners within 1.5 px on a synthetic photo; its PR text first described code that wasn't there).
- Next: lead does the rectify + ink-mask shader and the Meta API spike; Gemini builds the "Show the AI" drawer (`docs/plans/ai-drawer.md`).
- PR #10 GPU flatten + ink mask + header pixelation (`?capture=1` shows all three).
- Meta API check (`scripts/meta-check.ts`, fixtures in `fixtures/spike/2026-10-26/`, synthetic page, no student data): the key works from Nigeria. Spark 1.3 (low) and Wonder 1.0 (medium) both accept our zod-generated strict schemas with the root `$schema` key removed (`type: [..,"null"]`, `minimum`/`maximum` and `anyOf` with null are all fine), and both outputs validate against the zod schemas. Latency: Spark hello 3.9 s, blueprint 7.8 s (664 reasoning tokens at low), Wonder readings 13.0 s, SAM 4.5 s. SAM "table" on the synthetic page returned no detections (empty text). Re-test it on real sketches. Spark copied NAME/SCHOOL into `notes`, so the header pixelation must run before every upload.
- Two-builder flow: lead on `claude/*` branches, Gemini in its own worktree on `gemini/*`, every PR reviewed by the lead before merging to `main`.
