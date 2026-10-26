#!/usr/bin/env bash
# Stop. Claude may not finish a turn with red typecheck or tests when code
# changed. Skips fast when nothing changed. Exit 2 = keep working.

input=$(cat)
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[ -f package.json ] || exit 0                    # no scaffold yet (pre-kickoff)

# What changed? Use git when it exists, otherwise files touched in the last 30 min.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed=$(git status --porcelain -- '*.ts' '*.tsx' '*.glsl' '*.json' 2>/dev/null | grep -v 'fixtures/\|golden/')
else
  changed=$(find apps packages -newer package.json -mmin -30 \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.glsl' \) -not -path '*/node_modules/*' 2>/dev/null | head -1)
fi
[ -z "$changed" ] && exit 0

out=$( { bun run typecheck && bun run test; } 2>&1 )
if [ $? -ne 0 ]; then
  {
    echo "Stop gate: typecheck or tests are failing. Fix the code (never the tests) before finishing,"
    echo "or, if you are stuck after 2 attempts, say so plainly and stop."
    echo "---- last 40 lines ----"
    echo "$out" | tail -40
  } >&2
  exit 2
fi
exit 0
