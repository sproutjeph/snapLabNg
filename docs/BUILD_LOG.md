# Build log

## Oct 26 (Day 1)
- First commit: planning docs, agent harness (`.claude/`, `.gemini/`, `.githooks/`), shared rulebook `AGENTS.md`, generic workspace config. No app code.
- PR #1 web shell (desk, lined page, ink glow, screenshot script). PR #3 Gemini's procedural metre bridge kit, merged after two review rounds on wire pointer handling (world vs local cm, R3F capture, lifting off the wire must not count as a drag).
- PR #5 contracts, #6 metre bridge engine (science-checked; corrected docs/07 on interchange-and-average), #7 engine drives the kit (`?kit=meter-bridge`), #8 Gemini's capture flow (corners within 1.5 px on a synthetic photo; its PR text first described code that wasn't there).
- Next: lead does the rectify + ink-mask shader and the Meta API spike; Gemini builds the "Show the AI" drawer (`docs/plans/ai-drawer.md`).
- Two-builder flow: lead on `claude/*` branches, Gemini in its own worktree on `gemini/*`, every PR reviewed by the lead before merging to `main`.
