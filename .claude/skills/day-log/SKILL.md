---
name: day-log
description: "Write the end-of-session entry in docs/BUILD_LOG.md so the next session (or a compacted one) knows exactly where things stand."
disable-model-invocation: true
---
Write a new entry at the **top** of `docs/BUILD_LOG.md` (create the file with a `# Build log` heading if it does not exist). Keep it under 15 lines:

```
## <date, e.g. Tue Oct 27> — <one-line theme>
- Shipped: <features, with commit hashes>
- MUST items (docs/09 §1): <done / in progress / not started, one line>
- Decisions: <anything decided today that the docs don't say yet>
- Day-1 test results that changed the plan: <if any>
- Broken or flaky: <failing tests, known bugs>
- Meta credits left: <amount, if the user said>
- Next step: <the single first thing to do next session, with the plan file path>
```

Then check whether a decision belongs in the docs themselves (for example a SAM plan A/B/C choice belongs in docs/06). If so, list the doc and the line to change, and ask the user before editing it.
