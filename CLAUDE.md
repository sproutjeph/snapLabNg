@AGENTS.md

# Claude Code notes (on top of AGENTS.md)

## How we work (model routing and context hygiene)
You, the main session, are the **lead**: Opus 5.5, high effort. Keep your context for decisions, so delegate the noisy work.
1. **Explore.** Use the `Explore` agent (Haiku) to find files. Use `api-verifier` (Sonnet) for any library or Meta API question. Don't read big files or docs into the main thread when a summary will do.
2. **Plan.** For anything over ~1 file, run `/plan-feature <goal>` first. It writes `docs/plans/<feature>.md` (goal, files, contracts, tests, done-criteria, who implements) and waits for approval.
3. **Implement.**
   - Write it yourself when the work is subtle: `packages/engine`, `packages/rules`, shaders, the SSE/WS relay, cross-package contracts.
   - Hand well-specified work to `implementer` (Sonnet 5.5): components, routes, wiring, schemas from a plan. Give it the plan file path.
   - **One writer per working tree.** Two agents never edit the same tree. Since Oct 28 (user's choice) the lead may run **up to 4 writer subagents in parallel**, each with `isolation: "worktree"` (its own tree under `.claude/worktrees/`, its own `claude/<slice>` branch and dev-server port 5177–5180), on disjoint paths listed in AGENTS.md "Who owns what", coding against contracts merged before the wave starts (`docs/plans/ohms-law-vi.md`). Subagents cannot launch subagents, so the lead runs every review gate. Gemini and Muse Code work in their own worktrees on paths they own; never edit those paths while their branch is open.
4. **Verify.** Use the `verifier` agent (it returns failures only). For visuals, run `/verify-3d`. For science or rules changes, use `science-verifier` (Opus).
5. **Review and commit** (what `/ship` runs, and the order to follow whenever you commit): verifier → science-verifier (if engine or rules) → `/verify-3d` (if visible) → `code-reviewer` (Opus, fresh context) → a small commit on a `claude/<feature>` branch → a BUILD_LOG line → PR. Push several times a day.
6. **Review Gemini's PRs** the same way, without touching its folder or your own branch: `git fetch origin && git worktree add --detach ../SnapLabNG-review origin/gemini/<feature>`, `bun install` there, run the four checks and the screenshot script there, give `code-reviewer` the output of `gh pr diff <n>`, post findings with `gh pr comment <n>`, and merge only on SHIP. Remove the review folder afterwards with `git worktree remove ../SnapLabNG-review`.
- After 2 failed attempts at the same fix, stop. Use the `debugger` agent, or `/clear` and re-plan.
- `/clear` between unrelated features. State lives in `docs/plans/` and `docs/BUILD_LOG.md`, not in chat. End each session with `/day-log`.
- Develop against `fixtures/` when possible, so outages don't block work.

## Enforcement
The `.claude/` hooks back up the rules in AGENTS.md for Claude: `guard-bash` (git before kickoff, destructive commands, `.env`, `git add -A`, other package managers, AI attribution), `protect-files` (lockfile, fixtures, golden, `.env`), and a Stop gate that keeps typecheck and tests green. `settings.json` sets attribution to empty strings.

## When compacting
Preserve: the current feature and its plan file path, the files modified this session, failing tests, and the next step.
