#!/usr/bin/env bash
# PreToolUse(Bash). Blocks what permission patterns miss: git before kickoff,
# destructive commands in any spelling, and secrets leaving the machine.
# Exit 2 = block; stderr is shown to Claude. Regexes avoid \b so they work
# with both macOS (BSD) grep and GNU grep.

KICKOFF_UTC=1792972800   # Mon Oct 26 2026 00:00 UTC: the user chose to start building on the morning of kickoff day
S='(^|[;&|(`[:space:]])'  # start of a command word
E='([[:space:]]|$)'       # end of a word

cmd=$(jq -r '.tool_input.command // ""')
[ -z "$cmd" ] && exit 0

has()   { printf '%s' "$cmd" | grep -Eq "$1"; }
block() { echo "Blocked by guard-bash: $1" >&2; exit 2; }

# 1. No git init / commit / push before kickoff (user rule).
if [ "$(date -u +%s)" -lt "$KICKOFF_UTC" ]; then
  has "${S}git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+(init|commit|push|remote[[:space:]]+add)${E}" \
    && block "no git commits or pushes before kickoff (Oct 26 2026, 17:00 WAT). Work locally until then."
  has "${S}gh[[:space:]]+(repo|pr)[[:space:]]+create" \
    && block "no GitHub repos or PRs before kickoff (Oct 26 2026, 17:00 WAT)."
fi

# 2. Destructive commands, whatever the spelling.
if has "${S}(/bin/)?rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)"; then
  # Allow clearing build output only.
  has "${S}(/bin/)?rm[[:space:]]+-[a-zA-Z]+([[:space:]]+[^[:space:];&|]*(node_modules|dist|coverage|\.vite|\.cache)/?)+[[:space:]]*($|[;&|])" \
    || block "recursive rm. Only node_modules, dist, coverage, .vite or .cache may be removed this way. Ask the user for anything else."
fi
has "${S}git[[:space:]].*push.*(--force|[[:space:]]-f${E}|--force-with-lease)" \
  && block "force-push is never allowed."
has "${S}git[[:space:]].*(reset[[:space:]]+--hard|clean[[:space:]]+-[a-zA-Z]*f|checkout[[:space:]]+--[[:space:]]+\.|restore[[:space:]]+\.${E})" \
  && block "this discards work. Use git stash, or ask the user."

# 3. Secrets and private data.
if has '\.env(\.[a-z]+)?([[:space:]"'"'"';|&)]|$)' && ! has '\.env\.example'; then
  has "${S}(cat|less|more|head|tail|grep|rg|sed|awk|cp|mv|scp|curl|base64|xxd|od|strings|source|\.)[[:space:]]" \
    && block "do not read, copy or send .env. The key lives only in server env (MODEL_API_KEY)."
fi
has "${S}git[[:space:]]+add[[:space:]].*(\.env|dataset/)" && ! has '\.env\.example' \
  && block "never stage .env or dataset/ (student photos and audio)."
has "${S}git[[:space:]]+add[[:space:]]+(-A|--all|\.)${E}" \
  && block "stage files by name, not 'git add -A' or 'git add .', so .env and dataset/ can't slip in."
has 'MODEL_API_KEY=[^$[:space:]]' \
  && block "never write the key value on a command line. Put it in .env yourself (user), or use 'fly secrets set' interactively."

# 4. No AI attribution in commits or PRs (user rule): the author is the user alone.
if has "${S}(git[[:space:]].*(commit|tag)|gh[[:space:]]+(pr|release)[[:space:]]+(create|edit))"; then
  printf '%s' "$cmd" | grep -Eiq 'co-authored-by:.*(claude|anthropic|gemini|google)|noreply@anthropic\.com|generated (with|by) (\[)?(claude|gemini)|claude\.ai/code|claude-session:' \
    && block "no AI attribution in commits, tags or PRs (no Co-Authored-By Claude, no 'Generated with Claude Code', no session links). Remove those lines and retry."
fi

# 5. Package managers other than bun.
has "${S}(npm|npx|yarn|pnpm)${E}" \
  && block "this repo uses bun only (bun install / bun run / bunx)."

exit 0
