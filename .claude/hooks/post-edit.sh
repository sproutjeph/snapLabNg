#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit). Formats and lint-fixes the edited file
# with Biome. Silent on success, so it costs no context. Never blocks hard:
# leftover lint errors are reported once; the Stop gate does the real gating.

f=$(jq -r '.tool_input.file_path // ""')
[ -z "$f" ] || [ ! -f "$f" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[ -f package.json ] || exit 0          # before the scaffold exists, do nothing

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css)
    out=$(bunx --bun biome check --write --no-errors-on-unmatched "$f" 2>&1)
    if [ $? -ne 0 ]; then
      echo "Biome found problems it could not auto-fix in $f:" >&2
      echo "$out" | tail -20 >&2
      exit 2   # PostToolUse exit 2 shows this to Claude; the edit already happened
    fi
    ;;
esac
exit 0
