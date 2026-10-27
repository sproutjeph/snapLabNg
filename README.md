# SnapLab NG

A student snaps the WAEC practical in their exercise book. The apparatus rises out of the ink as a working 3D lab, a deterministic science engine runs it, and an AI examiner marks the student's own handwriting. Built for the Meta Global AI Developer Hackathon (Indie track). The hero experiment is the **metre bridge**.

**The AI reads and judges. The engine decides.** Meta's models read the page and explain the marks. Every current, balance point and mark comes from deterministic, tested code.

## What was built before the hackathon began

To keep things clear for the judges, this section states exactly what existed before the building period.

**Before Oct 26 (no code):** the planning documents in `docs/` (the product, the architecture, the science model and the build plan) and the agent configuration in `.claude/`, `.gemini/` and `.githooks/`.

**Oct 26, 11:05–13:56 WAT, a few hours before the 17:00 WAT kickoff livestream.** These are the first 13 commits on `main` (the initial commit and PRs #1–#12), tagged [`pre-kickoff`](../../tree/pre-kickoff). That's roughly 15% of the planned build:

| PR | What |
|---|---|
| initial | Planning docs, agent guardrails, workspace config |
| #1 | Web shell: desk, lined page, ink glow, screenshot script |
| #2, #4, #9 | Docs and plans only |
| #3 | Procedural 3D metre bridge apparatus (`?kit=meter-bridge`) |
| #5 | Data contracts for the Meta model outputs (zod and JSON Schema) |
| #6 | Metre bridge science engine: circuit solve, galvanometer, cell, scrapes |
| #7 | Engine wired to the 3D apparatus |
| #8 | Capture: page corner finder, corner editor, homography (`?capture=1`) |
| #10 | GPU page flattening, ink mask, header pixelation |
| #11 | First live Meta API calls and recorded responses |
| #12 | "Show the AI" drawer (`?drawer=1`) |

Everything committed after the `pre-kickoff` tag was built during the hackathon.

## Run it

```sh
bun install
cd apps/web && bun run dev
```

Then open http://localhost:5173/?kit=meter-bridge, `/?capture=1` or `/?drawer=1`.

Checks: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
