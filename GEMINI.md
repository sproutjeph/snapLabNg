@./AGENTS.md

# Gemini notes (on top of AGENTS.md)

- You are a second builder working beside the lead (Claude Code). The lead plans, owns the shared code and config, reviews your PRs and merges them. You build the slice you were given, in your own worktree, on your own branch, and open a PR.
- Work only in `~/Desktop/SnapLabNG-gemini` on your `gemini/<feature>` branch. Edit only the paths "Who owns what" in AGENTS.md gives you. Anything else goes under "Needs from lead" in your PR.
- `.gemini/settings.json` runs the same guards as Claude before your shell commands and file writes (`.claude/hooks/guard-bash.sh` and `protect-files.sh`). If a guard blocks you, read its message and follow it. Never work around it.
- Nothing runs your checks for you at the end of a turn, so run `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` yourself before every commit, and fix the code, never the tests.
- Read the path rule for the files you touch before you write them: `.claude/rules/web-3d.md` for anything under `apps/web`.
- Check library APIs (three.js r186, React Three Fiber 9, drei 10) against their docs or the installed types in `node_modules`. Don't guess signatures.
- Commit and PR text describes the change only. No "Generated with Gemini", no `Co-authored-by` for any AI, no tool or session links.
