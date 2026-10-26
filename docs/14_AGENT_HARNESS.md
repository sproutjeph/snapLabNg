# 14 · Agent Harness: How Claude Code Builds SnapLab NG

*Prepared Oct 22, 2026. This is the setup for building with Claude Code in the terminal: the `CLAUDE.md` file, 7 subagents, 5 hooks, 5 path rules and 4 skills. It is configuration, not application code, so it can be installed before kickoff. The research behind every choice is in `research/06_harness_practices.md`.*

---

## 1. The idea in one paragraph

The main Claude Code session is the **lead**: Opus 5.5 at high effort. It makes the decisions and writes the subtle code (science engine, rule engine, shaders, the streaming relay, shared contracts). Everything noisy goes to a **subagent** with its own fresh context, which returns a short report of at most 300 words: searching files, checking API docs, running tests, reviewing the diff. Well-specified work (components, routes, wiring) goes to a **Sonnet 5.5 implementer**. **Hooks** enforce the rules that must never break (no commits before kickoff, no secrets, no destructive commands, no finishing with red tests), so they don't depend on the model remembering. This keeps the lead's context clean for ten days of decisions, and puts a check that doesn't trust the writer between every change and every commit.

## 2. Five design rules (and where each comes from)

| Rule | Why | Source |
|---|---|---|
| **Protect the lead's context** | Performance drops as the context fills. A subagent explores widely and returns 1–2k tokens. | Anthropic best practices; context-engineering post |
| **One writer at a time** | Parallel writers make conflicting hidden decisions. Read-only agents can run in parallel safely. | Anthropic subagents blog; Cognition, Apr 2026 |
| **Checks, not trust** | Agents "reliably skew positive when grading their own work". A reviewer in a fresh context, plus tests the model can't skip, close the loop. | Anthropic harness-design post |
| **Right model for the job** | Opus 5.5 at `high` gets most of the gain (95.3% vs 96.7% at `xhigh` for about 2.5× less cost). Sonnet 5.5 at `medium` handles well-specified tasks. Haiku only searches; it never judges. | Anthropic cost/effort guide; model prompting pages |
| **Musts go in hooks, not prose** | CLAUDE.md is advisory; hooks are deterministic. A short CLAUDE.md is followed better than a long one. | Anthropic best practices; HumanLayer |

## 3. What's in the folder

```
SnapLabNG/
├── CLAUDE.md                     ≈ 70 lines: principle, commands, hard rules, Meta gotchas, workflow
└── .claude/
    ├── settings.json             model + effort, permissions, hook wiring
    ├── agents/                   7 subagents (§5)
    │   ├── Explore.md            haiku   · read-only search
    │   ├── api-verifier.md       sonnet  · checks library and Meta API facts
    │   ├── implementer.md        sonnet  · writes well-specified code
    │   ├── verifier.md           sonnet  · runs checks, returns failures only
    │   ├── code-reviewer.md      opus    · fresh-context diff review
    │   ├── science-verifier.md   opus    · formulas, units, WAEC rules
    │   └── debugger.md           opus    · root-causes stubborn bugs
    ├── hooks/                    5 scripts (§6)
    ├── rules/                    5 rules that load only for matching files (§7)
    └── skills/                   /plan-feature  /ship  /verify-3d  /day-log (§8)
```

## 4. Who does what (the routing table)

| Work | Who | Model · effort | Why |
|---|---|---|---|
| Deciding, planning, cross-package design | **Lead** | Opus 5.5 · high | Long reasoning; owns the plan |
| `packages/engine`, `packages/rules` | **Lead** | Opus 5.5 · high | Silent errors cost marks with judges who are teachers |
| GLSL shaders, render-loop performance | **Lead** | Opus 5.5 · high | Visual and numeric bugs that typecheck can't catch |
| SSE `/api/snap`, WebSocket examiner relay | **Lead** (design and hard parts) | Opus 5.5 · high | Ordering, timeouts, reconnects |
| React components, Hono routes, wiring, schemas from a plan, tests from a listed plan | **implementer** | Sonnet 5.5 · medium | Well specified; much cheaper per turn |
| "Where is X?", "what pattern do we use for Y?" | **Explore** | Haiku 5.5 | Fast and cheap; the answer is easy to check |
| "Does this API/field/signature exist in our version?" | **api-verifier** | Sonnet 5.5 · medium | Models answer from memory unless made to look |
| "Is it green?" | **verifier** | Sonnet 5.5 · medium | Keeps 5,000-line logs out of the lead's context |
| Diff review before every commit | **code-reviewer** | Opus 5.5 · high | Reviewer quality matters more than speed |
| Engine or rules changed | **science-verifier** | Opus 5.5 · high | The demo's credibility rests on it |
| Stuck after 2 tries, flaky or async bug | **debugger** | Opus 5.5 · high | Reproduce, isolate, minimal fix, prove it |
| **Never Haiku for:** reviews, verdicts, science, security | — | — | Haiku skips checks at low and medium effort |

Built-in agents without their own model setting (general-purpose, Plan) run on **Sonnet** because `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` is set. Agents with `model:` in their file keep that model even if you `/model` switch the lead.

## 5. The seven subagents

| Agent | Writes code? | Tools | Returns (fixed format) |
|---|---|---|---|
| Explore | No | Read, Grep, Glob, read-only Bash | ANSWER · LOCATIONS `path:line` · NOT FOUND (≤250 words) |
| api-verifier | No | Read, Grep, Glob, Bash, WebFetch, WebSearch | CONFIRMED/WRONG per question · exact shape · version · source URL (≤300 words) |
| implementer | **Yes** | Read, Edit, Write, Bash, Grep, Glob | STATUS · files · checks with exit codes · plan items ✓/✗ (≤250 words) |
| verifier | No | Bash, Read, Grep, Glob | PASS/FAIL per stage · first errors at `file:line` · TEST TAMPERING (≤200 words) |
| code-reviewer | No | Read, Grep, Glob, Bash | SHIP / FIX FIRST · `[critical/major/minor] path:line — problem — fix` (≤300 words) |
| science-verifier | No | Read, Grep, Glob, Bash (Vitest only) | CORRECT / ERRORS FOUND · errors with the right value and source · missing tests (≤300 words) |
| debugger | **Yes** | Read, Edit, Write, Bash, Grep, Glob | ROOT CAUSE · EVIDENCE · FIX · CHECKS · RISK (≤250 words) |

Each agent's description says **when** to use it ("Use proactively when…"), which is how Claude Code decides to delegate. The two writing agents never run at the same time as each other or as the lead's own edits. The read-only ones (Explore, api-verifier) can run in parallel.

Things deliberately **not** built: an "architect" or "orchestrator" agent (that is the lead), per-package frontend/backend writers (parallel writers), language "pro" agents (the model already knows TypeScript), a doc-writer or commit-message agent (too small to be worth a handoff), agent teams (experimental and costly), and third-party agent collections (they confuse routing).

## 6. The five hooks (deterministic guards)

| Hook | When | What it does | Blocks? |
|---|---|---|---|
| `session-reminder.sh` | Session start, resume and after compaction | Prints 4–5 reminders plus the latest BUILD_LOG entry and plan file, so a fresh or compacted session knows where it is | No |
| `guard-bash.sh` | Before every shell command | **Before kickoff:** blocks `git init/commit/push` and `gh repo/pr create`. **Always:** blocks recursive `rm` (except node_modules, dist, coverage, .vite, .cache), force-push, `reset --hard`, `clean -f`, reading or sending `.env`, staging `.env` or `dataset/`, `git add -A` / `git add .`, a key value typed on a command line, npm/npx/yarn/pnpm, and **any AI attribution** in a commit, tag or PR (Co-Authored-By Claude, "Generated with Claude Code", session links) | Yes |
| `protect-files.sh` | Before every file edit | Blocks `.env*` (except `.env.example`), the lockfile, `dataset/`, `fixtures/`, `golden/` (recorded data is evidence; re-record it, never hand-edit it), the old spec and `.git/` | Yes |
| `post-edit.sh` | After every file edit | Runs `biome check --write` on that one file. Silent when clean; reports unfixable lint errors once | Reports only |
| `stop-gate.sh` | When Claude tries to finish a turn | If code changed, runs `bun run typecheck && bun run test`. If red, Claude must keep working (or say plainly it is stuck). Skips when nothing changed, before the scaffold exists, and on a repeat stop to avoid loops | Yes |

The hooks were tested here on Oct 22 against about 50 cases (blocked and allowed commands and paths, before and after kickoff). `settings.json` also sets `attribution` to empty strings, so Claude Code adds no trailer or PR line in the first place, and `.githooks/commit-msg` rejects attribution however a commit is made (enable it at kickoff with `git config core.hooksPath .githooks`). Permissions in `settings.json` back them up: `.env` reads are denied, `git push`, `fly` and `wrangler` ask first, and bun, git status/diff/add/commit run without prompts.

## 7. The five path rules (load only when needed)

A rule loads into context only when Claude touches a matching file, so the lead doesn't carry shader advice while writing the rule engine.

| Rule | Loads for | Key points |
|---|---|---|
| `science-engine.md` | `packages/engine/**`, `packages/rules/**` | Pure functions, units in names, fixed 120 Hz steps, rules read `text_as_written`, concordance tolerance configurable (default 0.20), each test cites its source |
| `web-3d.md` | `apps/web/**`, `*.glsl`, shaders | No allocations in `useFrame`, no per-frame React state, dispose, precision, performance budgets and a low-tier fallback, never show the expected titre |
| `api-server.md` | `apps/api/**` | Key read in one module and never logged, SSE event order, timeouts and aborts, validate then clamp, SAM parser, voice key in the first message, `RECORD_FIXTURES=1` |
| `contracts.md` | `packages/contracts/**` | zod and JSON schema change together, strict-schema rules, boxes as objects, `text_as_written` everywhere |
| `tests.md` | `*.test.ts(x)` | Behaviour names, never weaken, sources in comments, `toBeCloseTo`, fixtures not the live API |

## 8. The four skills (slash commands)

| Skill | You type | What happens |
|---|---|---|
| `/plan-feature <goal>` | At the start of any feature | Checks the MUST/SHOULD cut line, sends Explore and api-verifier in parallel, writes `docs/plans/<name>.md` (goal, out of scope, files, contracts, tests, done-criteria, **who implements**, risks), then waits for your OK |
| `/ship [plan]` | When a feature is done | verifier → science-verifier (if engine/rules) → `/verify-3d` (if visible) → code-reviewer → fixes → commit by file name → BUILD_LOG line → asks before push |
| `/verify-3d [route]` | After any visible change | Headless Chromium screenshots at phone and laptop sizes, console errors, an fps sample, compared with reference shots. Claude must look at the image before saying "it works" |
| `/day-log` | End of every session | Writes the top entry of `docs/BUILD_LOG.md`: shipped, MUST status, decisions, broken things, credits, the single next step |

`/ship` and `/day-log` only run when you type them (they commit and write logs). `/plan-feature` and `/verify-3d` can also be started by Claude itself.

## 9. A normal feature, start to finish

```
/clear
/plan-feature metre bridge circuit solve and galvanometer needle (docs/07 §4)
   → lead reads docs/07 §2, Explore maps the repo, api-verifier skipped (no external API)
   → docs/plans/meter-bridge-engine.md written; Implementer: lead
You: "approved"
   → lead writes packages/engine/meter-bridge.ts + tests (science-engine and tests rules load automatically)
   → post-edit formats each file; stop-gate blocks finishing until tests are green
/ship docs/plans/meter-bridge-engine.md
   → verifier PASS → science-verifier CORRECT → code-reviewer SHIP → commit a1b2c3d → BUILD_LOG
```

A UI feature looks the same, except the plan says `Implementer: implementer`, and the lead's message is: *"Use the implementer agent on docs/plans/capture-ui.md."* The lead then reads a 250-word report instead of watching 40 edits.

**Escalation:** two failed tries at the same fix → `debugger`, or `/clear` and re-plan with what you learned. Corrected the same mistake twice → add one line to CLAUDE.md. A side task flooding the chat → send it to a subagent next time.

## 10. Setup

### Now (Oct 22–25): allowed, because this is configuration, not app code
1. `CLAUDE.md` is already in `SnapLabNG/`. The rest arrived as `SnapLabNG/_claude/`, because remote tools may not write into a `.claude` folder. Rename it and make the hooks executable, once:
   `cd ~/Desktop/SnapLabNG && mv _claude .claude && chmod +x .claude/hooks/*.sh .githooks/commit-msg`
2. Check the tools the hooks need: `claude --version`, `jq --version` (install with `brew install jq` if missing), `bun --version`.
3. Open Claude Code in the folder (`cd ~/Desktop/SnapLabNG && claude`) and check:
   - `/agents` lists the 7 agents with the right models.
   - `/hooks` shows SessionStart, PreToolUse (Bash; Edit|Write|MultiEdit), PostToolUse and Stop.
   - `/permissions` shows the allow, ask and deny lists.
   - `/model` shows Opus and `/effort` shows high. If not, run `/model opus` and `/effort high`.
   - `/memory` shows CLAUDE.md loaded. `/context` shows how much it all costs (expect a few thousand tokens).
4. Test the guards: ask Claude to "run git init". It must be blocked with the kickoff message. Ask it to "create apps/web/src/main.tsx". It must be blocked too.
5. Optional: install a TypeScript code-intelligence (LSP) plugin from `/plugin`, so Claude sees type errors right after each edit.

### At kickoff (Oct 26, after 17:00 WAT)
The Day-1 prompt in doc 13 now asks the scaffold to create what the harness expects:
- Root scripts named exactly `dev`, `typecheck`, `lint`, `test`, `build` and `shot`.
- Biome as a dev dependency with a `biome.json`; Vitest in each package.
- `scripts/shot.ts` (Playwright screenshot script, spec in `.claude/skills/verify-3d/SKILL.md`), and the app sets `window.__SNAPLAB_READY__ = true` after the first frame.
- `.gitignore` with `.env*`, `!.env.example`, `dataset/`, `.shots/`, `.claude/settings.local.json`, `node_modules/`, `dist/`.
- `docs/plans/` and `docs/BUILD_LOG.md`.
The first commit then includes CLAUDE.md and `.claude/` (not `settings.local.json`).

## 11. Usage limits and cost

- Opus costs several times more per turn than Sonnet on a Claude subscription. The routing above spends Opus where mistakes are expensive and Sonnet where the work is specified. If you hit your limit mid-day, switch the lead to `/model sonnet` for UI wiring and keep reviews on the Opus agents.
- Don't change `/effort` in the middle of a session (it throws away the prompt cache). Start a new session instead.
- Keep `xhigh` and `max` for one-off hard problems. `max` tends to overthink.
- Personal overrides (for example a different default model) go in `.claude/settings.local.json`, which is not committed.

## 12. When something goes wrong

| Symptom | Fix |
|---|---|
| Claude keeps trying to stop and the stop gate blocks it | Tests are red. Read the last 40 lines it shows. After 2 tries, call `debugger` |
| A hook blocks something you really want | Run that command yourself in your own terminal, or edit the hook. Don't ask Claude to work around it |
| Biome isn't installed yet (before the scaffold) | `post-edit` and `stop-gate` do nothing until `package.json` exists |
| An agent returns a long dump instead of its format | Tell it "follow your return format", or tighten that agent's last section |
| Claude doesn't delegate when it should | Name the agent: "use the verifier agent", "use Explore to find…" |
| The context feels heavy | `/context` to see what's using it; `/clear` and restart from `docs/BUILD_LOG.md` |
| Two Explore agents in `/agents` | Our override didn't replace the built-in. Rename ours to `scout` (file and `name:`) and update CLAUDE.md |

## 13. Still to check on your machine (couldn't be verified from here)
- That a project agent named `Explore` replaces the built-in one (the docs say it can).
- The exact effect of `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` (meant to stop subagents spawning their own subagents). Remove it if `/doctor` complains.
- Headless WebGL on macOS with the SwiftShader flags (test on Day 1 with the hello-world scene).
- That `bun run test` stays under about 60 s, so the stop gate stays fast. If it grows, scope the gate to changed packages.

## 14. Sources
Anthropic: Claude Code best practices, subagents, hooks guide and reference, memory, permissions, model configuration (code.claude.com/docs/en/…); "How and when to use subagents" (Apr 2026); "Steering Claude Code" (Jun 2026); effective context engineering; multi-agent research system; harness design for long-running apps (Mar 2026); optimizing for cost and intelligence; prompting Opus 5.5, Sonnet 5.5 and Haiku 5.5. Practitioners: HumanLayer on CLAUDE.md, Cognition on multi-agent systems (Apr 2026), Shrivu Shankar's feature tour, Tembo's subagent guide. Full URLs and the claim-by-claim notes are in `research/06_harness_practices.md`.
