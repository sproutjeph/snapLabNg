---
name: ship
description: "Verify, review and commit the current change, then log it. Run after a feature or fix is implemented."
disable-model-invocation: true
argument-hint: "[plan file path]"
---
Ship the current change. Plan file: $ARGUMENTS (if empty, use the most recent file in docs/plans/ that matches the diff).

1. **Verify.** Run the `verifier` agent. If anything fails, fix it (or hand it to `implementer` or `debugger`) and run `verifier` again. Do not continue while red.
2. **Science check.** If the diff touches packages/engine, packages/rules or a rubric file, run `science-verifier`. Fix every ERROR it reports.
3. **Visual check.** If the diff changes anything visible, run `/verify-3d` and look at the screenshot.
4. **Review.** Run `code-reviewer` with the plan file path. Fix every critical and major finding. For a minor finding, fix it only if it is one line; otherwise note it in the log. If you disagree with a finding, say why in one line.
5. **Commit.** `git status`, then stage files by name (never `git add -A`, never .env, dataset/ or student media). One commit per logical change, with a message like `feat(engine): titration pH by charge-balance bisection`. No AI attribution: no Co-Authored-By trailer, no "Generated with" line, no session link. If git is blocked because it is before kickoff, say so and stop here.
6. **Log.** Add 2–4 lines to the top entry of docs/BUILD_LOG.md: what shipped, the commit hash, anything deferred.
7. Ask the user before `git push`.

Report at the end in at most 8 lines: checks, review verdict, commit hash, anything deferred.
