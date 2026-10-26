#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit). Blocks edits to files that must not be
# hand-edited by an agent. Exit 2 = block; stderr is shown to Claude.

f=$(jq -r '.tool_input.file_path // ""')
[ -z "$f" ] && exit 0
rel="${f#"$CLAUDE_PROJECT_DIR"/}"

block() { echo "Blocked by protect-files: $rel — $1" >&2; exit 2; }

case "$rel" in
  .env.example|*/.env.example) ;;
  .env|.env.*|*/.env|*/.env.*)
    block "secrets file. Ask the user to edit it." ;;
  bun.lock|bun.lockb|*/bun.lock)
    block "lockfile. Change dependencies with 'bun add' / 'bun remove'." ;;
  dataset/*)
    block "student photos and audio are read-only and never leave the machine." ;;
  golden/*|fixtures/*)
    # Recorded Meta responses and golden streams are evidence, not code.
    block "recorded data. Re-record it with the recording script, never hand-edit it to make a test pass. If it truly needs a manual fix, ask the user." ;;
  SNAPLAB_NG_MASTER_ARCHITECTURE.md)
    block "superseded spec; leave it alone." ;;
  .git/*|*/.git/*)
    block "git internals." ;;
esac

exit 0
