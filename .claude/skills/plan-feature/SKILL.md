---
name: plan-feature
description: "Write the plan file for a feature before any code — goal, files, contracts, tests, done-criteria and who implements it. Use when starting any feature or fix that touches more than one file."
argument-hint: "<feature name or one-line goal>"
---
Plan the feature: $ARGUMENTS

1. **Find the source.** Identify the doc sections that govern this feature (docs/04 architecture and contracts, 06 Meta API, 07 science, 09 build plan and cut lines). Read only those sections. Check docs/09 §1: if this is a SHOULD or COULD item while a MUST item is unfinished, say so and stop.
2. **Explore through subagents, not the main context.**
   - `Explore`: which files exist, what to reuse, the conventions to copy.
   - `api-verifier`: every library or Meta API call the feature needs that is not already verified in docs/06 or used in the repo.
   Run these two in parallel when both are needed. They are read-only, so this is safe.
3. **Write `docs/plans/<kebab-name>.md`** with exactly these sections:
   - **Goal**: one or two sentences, in the user's terms. Link the doc section.
   - **Out of scope**: what this plan deliberately does not do.
   - **Files**: each file to create or change, with one line on what changes.
   - **Contracts**: types, schemas, SSE events or props that cross a package boundary, written out exactly.
   - **Tests**: each test by name, with expected values and sources for science or rules.
   - **Done-criteria**: checkable statements, including the command that proves each one, and a `/verify-3d` screenshot for anything visible.
   - **Implementer**: `lead` if it touches packages/engine, packages/rules, shaders, the SSE/WS relay or a contract design; otherwise `implementer`. If mixed, split it into steps and mark each one.
   - **Risks**: at most 3, each with its fallback.
4. **Stop.** Show the plan path and a 5-line summary, and wait for the user's approval before writing code.
