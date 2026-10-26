# 06 — Claude Code harness practices for a 10-day solo hackathon (multi-subagent)

Researched 2026-10-22. Project context: solo dev; TypeScript monorepo (Vite + React Three Fiber/three.js + GLSL web app; Bun + Hono API with SSE and a WebSocket relay; pure-TS science engine with Vitest; deterministic rules engine; external LLM API calls with strict JSON schemas). Target routing: Opus 5.5 at high effort for complex work, Sonnet 5.5 for medium work.

Labels used below:
- **[DOC]**: stated in official Anthropic docs or engineering posts (URL given).
- **[PRAC]**: practitioner source (URL given). These are opinions, not benchmarks.
- **[REC]**: my recommendation for this project, combining the sources. Not taken from any single source.
- **[UNVERIFIED]**: I could not confirm it in a primary source during this research.

---

## 0. TL;DR

1. Context is the scarce resource. Every harness decision should protect the main session's context: subagents for reading many files, hooks for deterministic checks (zero context cost unless they print output), skills and path-scoped rules for knowledge needed only some of the time, and a short CLAUDE.md.
2. Keep writes single-threaded. Subagents pay off when they are **read-heavy or judgment-only**: explore, research or verify docs, review, run tests and summarise the output. Parallel writer subagents make conflicting implicit decisions. Anthropic, Cognition and Anthropic's own blog all say so.
3. Verification closes the loop, not the model. You need tests, typecheck, a build and screenshots, enforced by a Stop hook and checked by a reviewer in a fresh context. Agents "reliably skew positive when grading their own work."
4. Install about 5 focused subagents, not 100. Large collections cause routing ambiguity and context bloat.
5. Routing: plan and review with Opus 5.5 at `high`. Implement well-specified work with Sonnet 5.5 at `medium`, and use `high` for longer tasks. Use Haiku 5.5 only for search and summarising checkable output. `opusplan` gives you most of this automatically. On the Opus 5.5 effort curve, `high` is the sweet spot: `xhigh` costs about 2.5x more for about 1.4 percentage points.

---

## 1. Key principles

### 1.1 Context isolation is the main reason subagents exist
- "Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills." [DOC] https://code.claude.com/docs/en/best-practices
- A non-fork subagent starts fresh. It gets its own system prompt, the delegation message, CLAUDE.md (unless `omitClaudeMd`), git status and any preloaded skills. "Only its final summary returns to your main conversation." [DOC] https://code.claude.com/docs/en/sub-agents
- Good context engineering means "finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome." Context rot means recall degrades as context grows. [DOC] https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Forks inherit the full conversation and share the parent's prompt cache, so they are cheaper than a fresh subagent when the task needs the same context. Start one with `/subtask <task>`. [DOC] sub-agents page.

### 1.2 Subagents return condensed summaries
- Sub-agents "explore extensively" but return a condensed summary, "often 1,000-2,000 tokens." [DOC] context-engineering post.
- Specify the output format in the subagent's system prompt, because the parent relies on the result's shape. [PRAC] https://tembo.io/blog/claude-code-subagents
- For large outputs, have subagents write to files and "pass lightweight references back to the coordinator." [DOC] https://www.anthropic.com/engineering/multi-agent-research-system
- [REC] Every custom agent prompt should end with a fixed return contract, e.g. "Return ≤300 words: VERDICT, top findings with file:line, commands run with exit codes, and anything not checked."

### 1.3 Explore, then plan, then implement, then verify (and commit)
- The four phases are Explore (plan mode), Plan (`Ctrl+G` edits the plan), Implement, and Commit. "If you could describe the diff in one sentence, skip the plan." [DOC] best-practices.
- For larger features, have Claude interview you with `AskUserQuestion` and write `SPEC.md`. Then "start a fresh session to execute it." The best specs "name the files and interfaces involved, state what is out of scope, and end with an end-to-end verification step." [DOC] best-practices.
- Opus 5.5 "tends to get to work quickly, and on loosely specified tasks it helps to tell the model to look through the relevant sources before acting." This is a model-level reason to keep the explore step. [DOC] https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5

### 1.4 Tests and checks are the source of truth
- "Give Claude a check it can run: tests, a build, a screenshot to compare. It's the difference between a session you watch and one you walk away from." [DOC] best-practices.
- There are four levels of gating: ask in the prompt; a `/goal` condition re-checked by a separate evaluator each turn; a **Stop hook** as a deterministic gate; and a **verification subagent** "so the agent doing the work isn't the one grading it." [DOC] best-practices.
- "Have Claude show evidence rather than asserting success." [DOC] best-practices.
- Test-first variant: "have one Claude write tests, then another write code to pass them." [DOC] best-practices.
- Sonnet 5.5 "at `low` effort … sometimes reports a change as done without running a check." Haiku 5.5 does the same at low and medium effort. [DOC] Sonnet 5.5 and Haiku 5.5 prompting pages (§3).

### 1.5 Small diffs and tight loops
- "If you've corrected Claude more than twice on the same issue … run `/clear` and start fresh with a more specific prompt." [DOC] best-practices.
- Checkpoints (`Esc Esc` or `/rewind`) only track Claude's file-edit tools, not Bash side-effects. "This isn't a replacement for git." [DOC] best-practices.
- [REC] Commit after every green check. One feature per session, named with `/rename`. `/clear` between unrelated tasks.

### 1.6 Independent reviewer in a fresh context
- "A reviewer running in a fresh subagent context sees only the diff and the criteria you give it, not the reasoning that produced the change." The bundled `/code-review` skill does this. [DOC] best-practices, "Add an adversarial review step."
- Caveat: "A reviewer prompted to find gaps will usually report some, even when the work is sound … Chasing every finding leads to over-engineering. … Tell the reviewer to flag only gaps that affect correctness or the stated requirements." [DOC] best-practices.
- Anthropic's harness work found "agents reliably skew positive when grading their own work." Separately, "tuning a standalone evaluator to be skeptical turns out to be far more tractable." The evaluator used Playwright to click through the live app. [DOC] https://anthropic.com/engineering/harness-design-long-running-apps (Mar 24 2026)
- Cognition, Apr 2026: generator-verifier loops with a clean-context reviewer work, and Devin Review catches about 2 bugs per PR on average. [PRAC] https://cognition.com/blog/multi-agents-working

### 1.7 Avoid over-delegation
- Don't use subagents for: sequential dependent work; same-file edits ("a recipe for conflict"); small tasks; "Too many specialists: flooding Claude with options makes automatic delegation less reliable"; agents that must talk to each other. "Start conversational, automate later." Rule of thumb: delegate when a task touches about 10+ files or has 3+ independent pieces. [DOC] https://claude.com/blog/how-and-when-to-use-subagents-in-claude-code (Apr 7 2026)
- The multi-agent research system used about 15x the tokens of chat. "Coding tasks are a weaker match because they contain fewer parallelizable subtasks than research." Early failure modes included spawning excessive subagents for simple queries. [DOC] multi-agent research post.
- Anthropic's measured routing guidance: "When the work is one dependent chain, or fits in a single context without a long cost tail, the orchestrator's model alone at lower effort came out ahead in every case measured." Delegation saved money only for "routine work with a long cost tail" or "work larger than one context window." [DOC] https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- Cognition: "Actions carry implicit decisions." Parallel-writer swarms still fail. "Keep writes in one thread and let other agents add intelligence instead of actions." [PRAC] Cognition, above.
- Sonnet 5.5 at xhigh or max "can start its own rounds of review and verification, sometimes with subagents." Anthropic supplies a prompt to suppress this: "don't launch reviewer sub-agents unless the user asked for a review." [DOC] Sonnet 5.5 prompting page.
- A dissenting practitioner view: "Custom subagents are a brittle solution." They "gatekeep context" and "force human workflows." This author prefers "Master-Clone", where the main agent spawns general-purpose clones, over "Lead-Specialist." [PRAC] Shrivu Shankar, https://blog.sshh.io/p/how-i-use-every-claude-code-feature. [REC] Take the middle path: a few custom agents where tool restriction or a fixed checklist matters (reviewer, verifiers), and general-purpose or fork delegation for ad-hoc work.

### 1.8 Subagent description quality is the routing mechanism
- "Claude delegates based on the request, each subagent's `description`, and current context." Include "use proactively" to encourage auto-delegation. Keep descriptions brief: Claude Code warns when all descriptions together exceed 15,000 tokens. Put the detail in the body, which loads only when the agent runs. [DOC] sub-agents page.
- "Write descriptions that single out one subagent." "Design focused subagents." "Limit tool access." "Check into version control." [DOC] sub-agents page, Best practices.
- Describe trigger conditions, not capability: "Reviews code for security issues before commits" routes better than "security expert." [DOC] subagents blog.
- From tool-design guidance, which applies equally here: describe it as you would "to a new hire on your team." Use unambiguous names. Return concise, high-signal responses. [DOC] https://www.anthropic.com/engineering/writing-tools-for-agents
- The orchestrator's delegation message needs "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries." Vague delegation causes duplicated work. [DOC] multi-agent research post.

### 1.9 Keep CLAUDE.md short and high-signal
- For each line, ask: "Would removing this cause Claude to make mistakes?" If not, cut it. "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" [DOC] best-practices.
- Target **under 200 lines** per file. [DOC] https://code.claude.com/docs/en/memory and https://code.claude.com/docs/en/features-overview. HumanLayer: frontier models reliably follow about 150-200 instructions, the system prompt already uses about a third of that, keep the file under 300 lines, and their root file is under 60. [PRAC] https://www.humanlayer.dev/blog/writing-a-good-claude-md
- Include: bash commands Claude can't guess, non-default style rules, the test runner, repo etiquette, project-specific architecture decisions, env quirks, and gotchas. Exclude: what Claude can learn from the code, standard conventions, long API docs, frequently changing info, and file-by-file descriptions. [DOC] best-practices table.
- Put "IMPORTANT" emphasis on one line only. "If you emphasize many lines, none of them stands out." [DOC]
- Use hooks, not CLAUDE.md, for "every time X, always do Y" and for "never do this." [DOC] https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more (Jun 18 2026)
- Don't use the LLM as a linter. Use Biome, ESLint or Prettier through hooks. [PRAC] HumanLayer.
- Project-root CLAUDE.md is re-read after `/compact`. [DOC] memory page. Add a line such as "When compacting, always preserve the list of modified files and test commands." [DOC] best-practices.

### 1.10 Progressive disclosure: skills, path-scoped rules, nested CLAUDE.md
- **Important correction:** `@path` imports **do not** reduce context. "Imports help you organize a long file but don't reduce its context cost, because imported files also load at launch." [DOC] memory page. Progressive disclosure comes from:
  - **Path-scoped rules**: `.claude/rules/*.md` with `paths:` frontmatter load only when Claude touches matching files. [DOC] memory page.
  - **Nested CLAUDE.md** in `apps/web/`, `apps/api/` and `packages/science/` load on demand when Claude works in that subtree. [DOC] memory page.
  - **Skills**: only the name and description load at startup. The body loads when invoked, and linked files load "only as needed." [DOC] https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills. Set `disable-model-invocation: true` for side-effect workflows; the description then costs zero context. [DOC] features-overview.
  - **Plain path references** in CLAUDE.md (write `docs/agent/shaders.md`, not `@docs/agent/shaders.md`) that Claude reads when relevant. This is the HumanLayer `agent_docs/` pattern. [PRAC]
- Build the setup over time, triggered by real problems: "Claude gets a convention or command wrong twice → add it to CLAUDE.md"; "a side task floods your conversation → route it through a subagent"; "you want something to happen every time → write a hook." [DOC] features-overview, "Build your setup over time".
- Use HTML block comments in CLAUDE.md for human-only notes. They are stripped before injection. [DOC] memory page.

---

## 2. Concrete patterns for this project

### 2.1 Proposed layout [REC]
```
CLAUDE.md                         # ≤80 lines: stack, commands, invariants, workflow
apps/web/CLAUDE.md                # R3F/three conventions, perf budget, screenshot loop (loads on demand)
apps/api/CLAUDE.md                # Hono+Bun, SSE/WS relay contracts (on demand)
packages/science/CLAUDE.md        # units, numerical tolerances, reference sources (on demand)
packages/rules/CLAUDE.md          # determinism rules (no Date.now/Math.random; seeded RNG; pure fns)
.claude/rules/glsl.md             # paths: ["**/*.glsl","**/*.vert","**/*.frag","**/shaders/**"]
.claude/rules/llm-schemas.md      # paths: ["**/llm/**","**/schemas/**"]
.claude/skills/verify-3d/SKILL.md # run dev server, headless screenshot, compare; WebGL flags
.claude/skills/llm-contract/SKILL.md # how to change a JSON schema + fixtures + validator tests
.claude/agents/{code-reviewer,verifier,debugger,docs-verifier,science-verifier}.md
.claude/hooks/*.sh                # format, protect, guard-bash, stop-gate
.claude/settings.json             # hooks + permissions (checked in)
```

### 2.2 Specialist subagents, ranked by value for this project

| # | Agent | Value | Model / effort | Tools | Notes |
|---|---|---|---|---|---|
| 1 | **code-reviewer** (diff vs plan) | Very high | `opus`, `effort: high` | Read, Grep, Glob, Bash (git diff, test) | Fresh context. Checks correctness and requirements only. Severity-ranked. Tells you to ignore style. Anthropic's own example is read-only. [DOC] Run before each commit or PR, or use bundled `/code-review`. |
| 2 | **verifier / test-runner** | Very high | `sonnet`, `effort: medium` (or `haiku` for pure summarising) | Bash, Read, Grep | Runs `bun run typecheck`, `vitest run`, lint and build, then returns **only** failing tests, first error and file:line. Keeps 5k-line logs out of main context. Read-only: it reports and does not fix. |
| 3 | **debugger** | High | `inherit` (Opus high when main is Opus) | Read, Edit, Bash, Grep, Glob | Anthropic's example pattern: reproduce, isolate, minimal fix, verify. [DOC] Use for flaky SSE/WS reconnects, render-loop bugs, and non-determinism in the rules engine. Edits: only one writer at a time. |
| 4 | **docs-verifier / API-verifier** | High | `sonnet`, `effort: medium` | WebSearch, WebFetch, Read, Grep (+ a docs MCP if you use one) | Verifies the *installed* versions' APIs: three.js (breaking changes between releases), @react-three/fiber / drei, Hono SSE (`streamSSE`) and the Bun WebSocket upgrade, the external LLM's structured-output or JSON-schema rules. Returns "API X exists in vN: signature, source URL". It is cheap insurance against hallucinated APIs. Models answer from training data instead of searching. [DOC: Sonnet 5.5 and Haiku 5.5 pages] |
| 5 | **science-verifier** | High (domain-specific) | `opus`, `effort: high` | Read, Grep, Bash (vitest only) | Checks formulas, units, dimensional consistency, edge cases and reference values against cited sources. Proposes property-based and golden-value tests. Read-only, so the main session writes the tests. Suits the "evaluator is worth it when the task sits beyond what the model does reliably solo" criterion. [DOC harness-design] |
| 6 | Built-in **Explore** | High, free | built-in | read-only | Already exists. Use "use subagents to investigate X". Skips CLAUDE.md and git status for speed. [DOC] You can override with your own agent named `Explore` (e.g. `model: haiku`). [DOC] |
| 7 | **security / secret reviewer** | Medium, one-off | `opus` | read-only | Don't keep it as an always-on agent. Use the bundled `/security-review` skill before the demo or deploy, plus hooks and permission denies (§4). Anthropic's best-practices page shows a security-reviewer example if you prefer an agent. [DOC] |
| 8 | **3D / shader specialist** | Medium. **Make it a skill, not an agent** | n/a | n/a | Shader work is iterative and visual and needs the main context plus screenshots. Encode GLSL/R3F conventions (precision qualifiers, uniforms via `useFrame` refs not state, dispose geometries/materials, no allocations in the frame loop, `extend()` for custom materials) as `.claude/rules/glsl.md` and a `verify-3d` skill. Optionally add a read-only "render-perf reviewer" later if perf regressions appear. [REC] Community R3F/three skills exist (e.g. https://claudemarketplaces.com/skills/enzed/r3f-skills/r3f-shaders). Their quality is **[UNVERIFIED]**, so audit them before installing. [DOC: skills post on auditing third-party skills] |
| 9 | **UI polish** | Low as an agent | n/a | n/a | Do it in the main session with a screenshot-compare loop ("take a screenshot of the result and compare it to the original. list differences and fix them"). [DOC best-practices] At most, run a one-off `design-critique` pass. |

Commonly over-engineered, so skip these:
- **Language "pro" agents** (typescript-pro, react-pro, python-pro). One practitioner analysis of a 184-agent collection found many are "too broad, very generic," capability lists rather than deep specialists. [PRAC] https://www.heyuan110.com/posts/ai/2026-04-20-wshobson-agents-deep-dive/ (on https://github.com/wshobson/agents). The model already knows TypeScript.
- **Installing whole collections** (e.g. VoltAgent awesome-claude-code-subagents, 100+ agents: https://dev.to/voltagent/100-claude-code-subagent-collection-1eb0). They cause routing ambiguity, overlapping descriptions and context cost (one estimate is 5-10K tokens for 20 plugins [PRAC]). Cherry-pick 1-2 files and rewrite them for your repo.
- **Architect / PM / orchestrator / "tech-lead" agents.** Plan mode plus Opus already does this, and an orchestrator agent duplicates the main session.
- **Per-package implementer agents** (frontend-dev, backend-dev) writing in parallel. These are parallel writers, which "still fail" [PRAC Cognition]. Same-file conflicts and inconsistent conventions follow.
- **Doc-writer, changelog and commit-message agents.** Too small to justify a delegation round-trip. Use a skill or just ask.
- **Agent teams** (experimental, off by default, "heavier and more expensive"). [DOC] Not worth it for a solo 10-day build.
- **Dynamic workflows / `/batch`** are for codebase-wide migrations or audits ("outgrows a handful of subagents"). [DOC] Possibly useful once, for a final audit; otherwise skip.

### 2.3 Example agent files [REC, based on the DOC templates]

`.claude/agents/code-reviewer.md`
```markdown
---
name: code-reviewer
description: Reviews the current git diff against the task's plan/spec for correctness bugs and missed requirements. Use proactively after a feature or fix is implemented and checks pass, before committing.
tools: Read, Grep, Glob, Bash
model: opus
effort: high
---
You review a diff you did not write. You have no knowledge of the reasoning behind it.
1. Run `git diff --stat` and `git diff` (or against the base branch if given). Read the plan/spec file if named.
2. Check: requirements met; edge cases (empty/NaN/units/time zones/reconnects); determinism of packages/rules; JSON-schema contract changes have matching fixtures + validator tests; no secrets; no unrelated changes.
3. Do NOT report style, naming, or "could add more tests" unless it affects correctness or a stated requirement.
Return ≤300 words: VERDICT (ship / fix-first), then findings as `[critical|major] file:line — problem — concrete fix`, then "Not checked: …".
```

`.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Runs typecheck, lint, unit tests and build for the affected workspace packages and reports only failures. Use proactively whenever you need to know whether the code is green, instead of running the commands in the main conversation.
tools: Bash, Read, Grep, Glob
model: sonnet
effort: medium
---
Run, in order, stopping at the first failing stage: `bun run typecheck`, `bun run lint`, `bunx vitest run --changed` (or the package given), `bun run build` if asked.
Never edit files. Never weaken, skip, or delete tests.
Return ≤200 words: PASS/FAIL per stage with exit code; for failures, the test name, the first assertion/error message, and file:line. No full logs.
```
(The `--changed` flag of Vitest and the script names are assumptions about your repo. Adjust them.)

---

## 3. Model routing heuristics

### 3.1 What the aliases resolve to (Anthropic API) [DOC] https://code.claude.com/docs/en/model-config
- `opus` = Opus 5.5, `sonnet` = Sonnet 5.5, `haiku` = Haiku 5.5. `default` = Opus 5.5 on Pro, Max, Team, Enterprise and the API. On Bedrock and Vertex, `sonnet` maps to an older Sonnet, so check before relying on it.
- `opusplan` = "uses `opus` during plan mode, then switches to `sonnet` for execution." `opusplan[1m]` is available. Switching does not clear the conversation, so Sonnet sees Opus's plan. [DOC] https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code
- **Effort defaults:** Opus 5.5, Sonnet 5.5 and Haiku 5.5 default to **`medium`** in Claude Code. You must raise Opus to `high` explicitly. Set it with `/effort high`, `--effort`, `CLAUDE_CODE_EFFORT_LEVEL`, `effortLevel` or per-model `modelSettings` in settings, or the `effort:` frontmatter on agents and skills. "`max` isn't accepted as a level in either key." [DOC] model-config. The exact JSON shape of `modelSettings` is **[UNVERIFIED]**; check `/config` or the settings reference.
- Subagent model resolution order: per-invocation `model` parameter, then frontmatter `model` (`inherit` = main model), then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. Gotcha: if the main session is Opus and an agent says `model: opus`, it runs on the main conversation's exact Opus, including `[1m]`. [DOC] sub-agents page.
- `/model` switches also reach subagents that inherit. "To keep a custom subagent on a smaller model, set `model` in its definition." [DOC] model-config.

### 3.2 Quantitative anchor: Opus 5.5 effort curve [DOC] optimizing-for-cost page (SWE-bench Pro subset)
| Effort | Solved | Cost/task |
|---|---|---|
| low | 87.4% | $0.11 |
| medium (default) | 92.8% | $0.21 |
| **high** | **95.3%** | **$0.29** |
| xhigh | 96.7% | $0.74 |

- `high` captures most of the gain. `xhigh` is about 2.5x the cost for about 1.4 percentage points. `max` "may show diminishing returns and is prone to overthinking." [DOC model-config]
- "Run every task at a low setting and re-run only the failures at a higher one" gave about 97% solved at about $0.17-0.24 per task. **This needs a failure signal such as tests**, which your Vitest science and rules engine provide. [DOC]
- "Tuning effort is often a better lever than switching models." "Compare models on cost per completed task, not per token." [DOC] choosing-a-model and optimizing pages.
- Subscription quota: "Opus costs several times more per turn than Sonnet." Spending Opus on routine work is "the fastest way to drain a daily limit." [DOC] support article.

### 3.3 Routing table for this project [REC, grounded in the DOC model descriptions]

| Task | Model / effort | Why |
|---|---|---|
| Architecture, SPEC and plan for each feature; cross-package interfaces (web↔api↔science↔rules) | **Opus 5.5 high** (plan mode / opusplan) | Long-horizon reasoning. Opus is listed for "complex systems engineering." [DOC] |
| Science engine numerics and models; rules-engine semantics and determinism | **Opus 5.5 high** | Correctness-critical, subtle, where errors are silent |
| GLSL shaders, shader math, R3F render-loop perf, instancing | **Opus 5.5 high** for new shader or perf work; Sonnet for tweaks | Visual and numerical bugs aren't caught by typecheck |
| SSE/WS relay: backpressure, reconnection, ordering, multi-client fan-out | **Opus 5.5 high** for design and debugging; Sonnet for wiring | Concurrency bugs |
| Hard or intermittent debugging; anything after 2 failed Sonnet attempts | **Opus 5.5 high** (fresh session with a better prompt) | Escalation rule |
| Code review before commit; science-verifier | **Opus 5.5 high** subagent | Reviewer quality matters more than speed |
| Well-specified implementation: React components, Hono routes, zod/JSON schemas, wiring, tests from a spec, refactors with a clear target | **Sonnet 5.5 medium**; **high** for multi-file or longer tasks | Sonnet 5.5 docs: "start at `medium` for well-specified tasks and move to `high` for harder or longer ones." [DOC] |
| Docs/API verification, test-runner summarising | Sonnet 5.5 medium | Needs judgment on what is relevant |
| Code search, file location, log or JSON summarising, fixture formatting | Haiku 5.5 (or built-in Explore) | "Lowest latency and price … subagent tasks." Outputs are checkable. [DOC] |
| Never route to Haiku | Verification verdicts, reviews, security, science checks | Skips checks and follows instructions less reliably (below) |

### 3.4 Typical failure modes by model [DOC unless marked]
- **Opus 5.5:** thinks more per turn at xhigh and max, giving longer turns and more tokens. Can **end turns early** with text instead of a tool call in unattended loops. **Gets to work quickly on loosely specified tasks**, so tell it to explore sources first. "Under time pressure the model might search and verify a little less." Can act on instructions inside pasted text (injection risk from fetched docs). https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- **Sonnet 5.5:** at low and medium effort it "sometimes checks in before the work is done" or stops after one part of a multipart task. "Tends to add tests, documentation, and small supporting files … even when you don't ask," and more so at higher effort. At xhigh and max it starts extra review rounds and spawns reviewer subagents. At low effort it reports done without running checks. It answers from training knowledge instead of searching. https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5. Anthropic's recommended guard snippets: "Keep working until everything the user asked for is done …" and "Don't add features, tests, files, docs or refactors that weren't asked for."
- **Haiku 5.5:** stops early on long agent prompts at low effort. Skips checks at low and medium. Holds system-prompt rules less reliably under pushback, so use `high` for strict instruction following. Skips needed tool calls with JSON output and thinking disabled. https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 (Spanish URL fetched; content is the same doc)
- **Practitioner caveats [PRAC, tembo]:** Haiku is weak at multi-step reasoning. Sonnet gets costly on long multi-file edits. Opus is overkill for cleanup. `inherit` "can surprise you if the parent switches mid-session."
- **Reward-hacking risk, any model:** agents may weaken or special-case tests to go green. [UNVERIFIED as a measured rate for 5.5-generation models.] Mitigate with a hook that protects test files or fixtures from edits during "make it pass" tasks, a reviewer check for "no test weakened," and the verifier rule "Never weaken, skip, or delete tests."

### 3.5 Practical session recipe [REC]
- Default to `/model opusplan` with Opus at `high`. Plan in plan mode, approve, and Sonnet executes. For a pure-Sonnet day of UI wiring, use `/model sonnet` with `/effort medium`.
- Pin custom agent models in frontmatter (`opus` + `effort: high` for reviewer and science-verifier; `sonnet` + `medium` for verifier and docs-verifier). Don't rely on `inherit` for them.
- Don't change effort mid-session if you care about cost: "changing top-level effort mid-session invalidates the cache." [DOC] Prefer a new session or a subagent with its own effort.

---

## 4. Hook patterns that improve quality

General rules from the docs:
- "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens." "Put guardrails in hooks." [DOC] best-practices and features-overview.
- Exit code 2 from **PreToolUse** blocks the call and stderr goes to Claude. From **PostToolUse** it "Shows stderr to Claude; the tool already ran." From **Stop** it "Prevents Claude from stopping." [DOC] https://code.claude.com/docs/en/hooks
- A blocking hook (exit 2) beats allow rules. Hook "allow" does **not** bypass deny or ask rules. [DOC] https://code.claude.com/docs/en/permissions
- Hooks have zero context cost unless they print output, so make them **silent on success**. [DOC] features-overview.

### 4.1 Auto-format and lint the edited file (PostToolUse, fast, per-file)
```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command",
                    "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-edit.sh" }] }
    ]
  }
}
```
`post-edit.sh` [REC]: read `.tool_input.file_path` with jq. For `*.ts|*.tsx`, run `bunx biome check --write "$f"` (or prettier plus `eslint --fix`). Exit 2 with the remaining errors on stderr only if unfixable errors remain. The official Prettier example is `jq -r '.tool_input.file_path' | xargs npx prettier --write`. [DOC] https://code.claude.com/docs/en/hooks-guide
- **Typecheck placement:** a full `tsc` on every edit is slow in a monorepo. Options:
  - (a) per-file and per-tsconfig checking with caching, as in https://github.com/bartolli/claude-code-typescript-hooks [PRAC]
  - (b) `tsc --noEmit --incremental`. One practitioner reports 8-12s dropping to 2-3s with `--incremental`, with no methodology given. [PRAC] https://understandingdata.com/posts/claude-code-hooks-quality-gates/
  - (c) [REC] run the package-scoped incremental typecheck in the **Stop** hook (once per turn), not per edit.
  - Install a TypeScript **code-intelligence (LSP) plugin**. It gives "type errors and warnings after each file edit" at low context cost and may make a per-edit tsc hook unnecessary. [DOC] features-overview.
- A practitioner counterpoint: one author "intentionally do[es] not use 'block-at-write' hooks," because "Blocking an agent mid-plan confuses or even 'frustrates' it." He gates at commit time instead. [PRAC] Shrivu Shankar. [REC] Keep PostToolUse to auto-fix plus a short feedback message. Do the hard gating at Stop or commit.
- Bash can also modify files without triggering an `Edit|Write` matcher. For full coverage, scan `git status --porcelain` in a Stop hook. [DOC] hooks-guide.

### 4.2 Stop-hook verification gate (the biggest quality lever for unattended runs)
```bash
#!/bin/bash
# .claude/hooks/stop-gate.sh  [REC, pattern from DOC]
INPUT=$(cat)
[ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ] && exit 0   # avoid loops (DOC)
cd "$CLAUDE_PROJECT_DIR" || exit 0
git diff --quiet HEAD -- '*.ts' '*.tsx' '*.glsl' 2>/dev/null && exit 0  # nothing changed → allow stop
OUT=$( (bun run typecheck && bunx vitest run --changed --reporter=dot) 2>&1 | tail -40 )
if [ $? -ne 0 ]; then echo "Checks failing — fix before finishing:\n$OUT" >&2; exit 2; fi
exit 0
```
- Claude Code overrides a Stop hook after **8 consecutive blocks** with no tool call in between. Guard with `stop_hook_active`. [DOC] hooks-guide troubleshooting.
- "`Stop` hooks fire whenever Claude finishes responding, not only at task completion." Keep the gate fast and skip it when nothing changed. [DOC]
- Alternatives: a `type: "agent"` Stop hook ("Verify that all unit tests pass…", 60s default timeout, up to 50 tool turns; **experimental**), or a `type: "prompt"` Stop hook asking "are all tasks complete?" [DOC] Prefer command hooks for production. [DOC]
- `/goal <condition>` is a softer, evaluator-based version for whole-session objectives. [DOC] best-practices.
- For slow suites (e.g. a full science-engine regression), use `"async": true, "asyncRewake": true`. It runs in the background and wakes Claude on exit 2. [DOC] hooks reference.
- Also consider a `SubagentStop` gate for the debugger agent, so it can't return "fixed" with red tests. [REC]

### 4.3 Block secret access and protected-file edits
- Use permissions first, which are cheap and enforced:
  ```json
  "permissions": { "deny": [
    "Read(./.env)", "Read(./.env.*)", "Read(**/.env*)", "Read(./secrets/**)",
    "Edit(./.env*)", "Edit(**/bun.lock)"
  ] }
  ```
  `Read(./.env)` and `Read(./secrets/**)` are the documented forms. Read and Edit denies also cover `cat/head/tail/sed/tee` and redirections, but **not** `grep -r` or scripts that open files themselves. "For OS-level enforcement … enable the sandbox." `.claudeignore` "has no effect." [DOC] https://code.claude.com/docs/en/permissions. (The exact combined glob coverage of the lines above is **[UNVERIFIED]**; check with `/permissions`.)
- Add a PreToolUse `Edit|Write` hook for patterns with logic: `.env*`, `bun.lock`, generated schema output, `.git/`, and optionally `**/__fixtures__/**` and `*.test.ts` during "make-it-pass" tasks. The official example `protect-files.sh` exits 2 with "Blocked: … matches protected pattern". [DOC] hooks-guide.
- Keep the external LLM API key only in env or `.env`, never in the client bundle. Add a PreToolUse or Stop scan (e.g. gitleaks or a regex for key prefixes) over `git diff` before commit. [REC]

### 4.4 Block destructive commands
- Use deny rules for `Bash(rm -rf *)`, `Bash(git push --force *)`, `Bash(git reset --hard *)` and `Bash(git clean *)`, and an ask rule for `Bash(git push *)`. **Caveat:** Bash rules don't match `/bin/rm`, `bash -c '…'`, `git -C . push` and similar. "Bash permission patterns that try to constrain command arguments are fragile." [DOC] permissions page.
- So pair them with a PreToolUse `Bash` hook that parses `.tool_input.command` (the docs example denies `rm -rf` with exit 2). The `if: "Bash(rm *)"` field filters when the hook runs. Set `onFailure: "block"` so a crashing guard fails closed. [DOC] hooks-guide and hooks reference.
- Enable `/sandbox` for OS-level filesystem and network isolation. "Use both for defense-in-depth." [DOC]

### 4.5 Other useful hooks
- `SessionStart` with matcher `compact`: echo 3-5 critical reminders after compaction (e.g. "use bun not npm; rules engine must stay pure; run verifier before commit"). [DOC] hooks-guide.
- `Notification`: desktop ping when Claude waits for input, useful for running sessions in parallel. [DOC]
- `PostToolUse` with `additionalContext` on generated files: "This file is generated. Edit src/schema.ts and run `bun generate` instead." This is the docs' own example and fits your JSON-schema pipeline. [DOC] hooks reference.
- `InstructionsLoaded`: debug which CLAUDE.md and rules actually loaded. [DOC] memory page.

---

## 5. Anti-patterns to avoid

1. **Kitchen-sink sessions.** Mixing unrelated tasks fills context. `/clear` between tasks. [DOC]
2. **Correcting over and over.** After 2 failed corrections, `/clear` and re-prompt with what you learned. [DOC]
3. **Over-specified CLAUDE.md** (more than 200 lines, emphasis everywhere, file-by-file tours, generic "write clean code"). Rules get lost. "If Claude already does something correctly without the instruction, delete it or convert it to a hook." [DOC] HumanLayer also warns against blindly keeping `/init` output. [PRAC]
4. **Thinking `@imports` save context.** They don't. Use path-scoped rules, nested CLAUDE.md or skills. [DOC]
5. **"Always/never" rules in prose** instead of hooks or permissions. [DOC Steering blog]
6. **Trust-then-verify gap.** Plausible code with no check. "If you can't verify it, don't ship it." [DOC] For WebGL, typecheck passing says nothing about the render, so use screenshots.
7. **Infinite exploration.** Unscoped "investigate"; scope it or delegate it. [DOC]
8. **Self-grading.** The implementer declares success. Use a fresh-context reviewer or verifier. [DOC harness-design]
9. **Chasing every reviewer nit.** This leads to over-engineering. Restrict reviewers to correctness and requirements. [DOC]
10. **Parallel writer subagents** on coupled code or the same file. [DOC subagents blog; PRAC Cognition]
11. **Agent zoo.** 20-100 agents with overlapping descriptions make auto-delegation unreliable. [DOC subagents blog; PRAC]
12. **Vague subagent descriptions** ("TypeScript expert"). Write trigger conditions, an output contract and restricted tools. [DOC]
13. **Subagents returning raw logs.** This defeats isolation. Enforce a summary contract. [PRAC tembo; DOC]
14. **Opus for everything, or xhigh/max by default.** Drains quota, gives longer turns and overthinking. Measure first. [DOC]
15. **Haiku as a judge.** It skips checks and is less reliable at instruction following. [DOC]
16. **Unguarded Stop hooks.** Without `stop_hook_active` you get loops and the 8-block cap. A slow Stop hook runs on every reply. [DOC]
17. **Relying on Bash permission patterns alone** for safety. Use them with hooks and the sandbox. [DOC]
18. **Installing third-party skills or agents unaudited.** Skills can run code and fetch from the network. [DOC skills post]
19. **Adding harness complexity the model doesn't need.** "Every component in a harness encodes an assumption about what the model can't do on its own." The full planner/generator/evaluator harness cost about $200 over 6h against $9 over 20 min solo in one Anthropic experiment. Use the evaluator only where the task exceeds solo reliability. [DOC harness-design]
20. **Unrequested scope creep** (extra files, docs, tests, refactors), especially with Sonnet 5.5 at higher effort. Add the "don't add what wasn't asked" line to CLAUDE.md or the session prompt. [DOC Sonnet 5.5 page]

---

## 6. Suggested 10-day rollout [REC]
- **Day 0 (≤2h):** CLAUDE.md (≤80 lines) and nested package CLAUDE.md stubs. `settings.json` with permissions denies, protect-files, guard-bash, post-edit format, Stop gate and the SessionStart-compact reminder. Agents: `code-reviewer`, `verifier`, `docs-verifier`. Install a TS LSP plugin. Set `/model opusplan` with Opus effort `high`.
- **Days 1-2:** Add `science-verifier` when the science engine lands. Add the `verify-3d` skill and the `.claude/rules/glsl.md` rule when the first shader lands.
- **Ongoing:** Use the triggers. Mistake twice → CLAUDE.md line. Repeated prompt → skill. Noisy side task → subagent. "Must always happen" → hook. [DOC features-overview]
- **Day 9:** Run `/security-review` and a full `code-reviewer` pass over the main diff. Optionally run one dynamic-workflow audit.

---

## 7. Discrepancies and unverified items
- **Subagent nesting depth:** docs say subagents can spawn subagents "up to three layers by default" (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). The Steering blog (Jun 2026) says "up to five levels." Tembo says subagents cannot spawn subagents, which is outdated. **Trust the docs page.**
- **Explore's model:** the current docs say Explore uses the main conversation's model (overridable by defining your own `Explore`). Older practitioner posts say Haiku. **Trust the docs.**
- **`modelSettings` JSON shape** for per-model effort: named in the docs but the exact schema is not captured here. **[UNVERIFIED]**
- **Vitest `--changed`** and the `bun run typecheck/lint` script names are assumptions about your repo. **[UNVERIFIED for your setup]**
- **Headless WebGL screenshots** usually need GPU or SwiftShader flags in headless Chromium (e.g. `--use-angle=swiftshader` / `--enable-unsafe-swiftshader`). This is from general knowledge, **[UNVERIFIED]** in this research. Test it early.
- **Practitioner timing claims** (incremental tsc 8-12s→2-3s; 60-70% time savings; bartolli's cache numbers) come with no methodology. **Treat them as anecdotal.**
- **Community R3F/three skills** quality: **[UNVERIFIED]**.

## 8. Sources
Official / Anthropic:
- Best practices for Claude Code: https://code.claude.com/docs/en/best-practices (the old URL https://www.anthropic.com/engineering/claude-code-best-practices redirects here)
- Subagents: https://code.claude.com/docs/en/sub-agents
- Model configuration: https://code.claude.com/docs/en/model-config
- Hooks guide: https://code.claude.com/docs/en/hooks-guide · Hooks reference: https://code.claude.com/docs/en/hooks
- Memory / CLAUDE.md: https://code.claude.com/docs/en/memory
- Extend Claude Code (features overview): https://code.claude.com/docs/en/features-overview
- Permissions: https://code.claude.com/docs/en/permissions
- How and when to use subagents (Apr 7 2026): https://claude.com/blog/how-and-when-to-use-subagents-in-claude-code
- Steering Claude Code (Jun 18 2026): https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
- Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Building effective agents: https://www.anthropic.com/research/building-effective-agents
- Equipping agents for the real world with Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Harness design for long-running application development (Mar 24 2026): https://anthropic.com/engineering/harness-design-long-running-apps
- Choosing a model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- Optimizing for cost and intelligence: https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- Effort: https://platform.claude.com/docs/en/build-with-claude/effort
- Prompting Opus 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- Prompting Sonnet 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- Prompting Haiku 5.5 (es): https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
- Models, usage and limits in Claude Code: https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code

Practitioner / community:
- HumanLayer, Writing a good CLAUDE.md: https://www.humanlayer.dev/blog/writing-a-good-claude-md (mirror: https://understandingdata.com/posts/writing-a-good-claude-md)
- Shrivu Shankar, How I Use Every Claude Code Feature: https://blog.sshh.io/p/how-i-use-every-claude-code-feature
- Cognition, Multi-Agents: What's Actually Working (Apr 22 2026): https://cognition.com/blog/multi-agents-working
- Tembo, Claude Code Subagents 2026 guide: https://tembo.io/blog/claude-code-subagents
- wshobson/agents deep dive: https://www.heyuan110.com/posts/ai/2026-04-20-wshobson-agents-deep-dive/
- VoltAgent 100+ subagent collection: https://dev.to/voltagent/100-claude-code-subagent-collection-1eb0
- Hooks as quality gates: https://understandingdata.com/posts/claude-code-hooks-quality-gates/
- TypeScript hooks: https://github.com/bartolli/claude-code-typescript-hooks
- R3F shader skill (unaudited): https://claudemarketplaces.com/skills/enzed/r3f-skills/r3f-shaders
