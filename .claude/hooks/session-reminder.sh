#!/usr/bin/env bash
# SessionStart(startup|resume|compact). Prints a few lines that become context.
# Keep it short: everything printed here costs tokens every session.

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
KICKOFF_UTC=1792972800
now=$(date -u +%s)

echo "SnapLab NG reminders:"
if [ "$now" -lt "$KICKOFF_UTC" ]; then
  echo "- PRE-KICKOFF: build locally, but no git init, commits or pushes until Oct 26 2026, 17:00 WAT. Keep pre-kickoff work to generic scaffolding."
fi
echo "- You are the lead (Opus, high). Delegate reading and checks to subagents; keep one writer at a time."
echo "- The AI reads and judges; the engine decides. Marks only from packages/rules."
echo "- bun only. Key only in server env. Never weaken tests."

# Current feature, so a fresh or compacted session knows where it is.
if [ -f docs/BUILD_LOG.md ]; then   # newest entry is at the top
  echo "- Latest BUILD_LOG entry:"
  awk '/^## /{n++} n==1{print}' docs/BUILD_LOG.md | head -12 | sed 's/^/    /'
fi
if [ -d docs/plans ]; then
  latest=$(ls -t docs/plans/*.md 2>/dev/null | head -1)
  [ -n "$latest" ] && echo "- Most recent plan: $latest"
fi
exit 0
