# Day-1 scaffold (step 1)

## Goal
Create the empty monorepo from docs/04 §7: Bun workspaces, TypeScript strict, Vitest in every package, Biome, and the root scripts the `.claude/` harness calls (`dev`, `typecheck`, `lint`, `test`, `build`, `shot`). Generic scaffolding only, allowed before kickoff by docs/09 §4 rule 3.

## Out of scope
- Any SnapLab logic: science, rules, schemas, scenes, routes. Steps 2–5 own those.
- `apps/web` index.html / Vite config / React (step 4). `apps/api` Hono server (step 2, after kickoff).
- `scripts/shot.ts` itself (step 4). The `shot` script entry is added now and fails until then.
- Dummy or placeholder tests. Packages use `--passWithNoTests`.
- git init, commits, deployment config.

## Files
Root:
- `package.json`: `"name": "snaplab-ng"`, `"private": true`, `"type": "module"`, `"workspaces": ["apps/*", "packages/*"]`. Scripts, exactly:
  - `"dev": "bun run --filter @snaplab/web --filter @snaplab/api dev"`
  - `"typecheck": "bun run --filter '@snaplab/*' typecheck"`
  - `"lint": "biome check ."`
  - `"test": "bun run --filter '@snaplab/*' test"`
  - `"build": "bun run --filter '@snaplab/*' build"`
  - `"shot": "bun scripts/shot.ts"`
  The root name `snaplab-ng` deliberately does not match `@snaplab/*`, so the root scripts never call themselves.
- devDependencies, installed with `bun add -d` at the root:
  - `typescript`: the latest 6.x (`bun pm view typescript versions`), not 7.x. TS 7 is the native port and is unverified with our tooling. If no 6.x exists, use the latest 5.9.x.
  - `@biomejs/biome@2.6.2`, exact (`-E`).
  - `vitest@^5.0.5`.
  - `@types/bun@1.4.3`.
  - `playwright@1.63.0`, exact (`-E`). It bundles Chromium 1243, which is already in `~/Library/Caches/ms-playwright`. Do not run `playwright install`.
- `tsconfig.base.json`: `compilerOptions`:
  - `target` ES2023, `module` ESNext, `moduleResolution` bundler;
  - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`;
  - `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`, `noEmit`;
  - `resolveJsonModule`, `forceConsistentCasingInFileNames`;
  - `lib` ["ES2023"], `types` [].
- `biome.json`:
  ```json
  {
    "$schema": "https://biomejs.dev/schemas/2.6.2/schema.json",
    "files": { "includes": ["**", "!**/dist", "!**/.shots", "!**/fixtures", "!**/golden", "!**/docs", "!**/dataset"] },
    "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
    "linter": { "enabled": true, "rules": { "recommended": true } },
    "assist": { "enabled": true, "actions": { "source": { "organizeImports": "on" } } }
  }
  ```
  If `biome check .` rejects any key, run `bunx biome migrate --write` and keep the result. Report what changed.
- `.env.example`: one line, `MODEL_API_KEY=`.
- `.gitignore`, exactly these lines: `.env*`, `!.env.example`, `dataset/`, `.shots/`, `node_modules/`, `dist/`, `.claude/settings.local.json`.
- `docs/BUILD_LOG.md`: just `# Build log` and a blank line.
- `golden/.gitkeep`, `fixtures/.gitkeep`: create with `mkdir -p golden fixtures && touch golden/.gitkeep fixtures/.gitkeep`. The protect-files hook blocks Write/Edit there.

Five workspace packages share one pattern: `apps/web`, `apps/api`, `packages/engine`, `packages/rules`, `packages/contracts`. Each gets:
- `package.json`: `"name": "@snaplab/<dir>"` (web, api, engine, rules, contracts), `"private": true`, `"type": "module"`, `"version": "0.0.0"`. Scripts: `"typecheck": "tsc --noEmit -p tsconfig.json"`, `"test": "vitest run --passWithNoTests"`. No `dev` or `build` yet; steps 2 and 4 add them for web and api.
- The three `packages/*` also get `"exports": { ".": "./src/index.ts" }` (source exports; Vite and Bun consume TS directly).
- `tsconfig.json`: `"extends": "../../tsconfig.base.json"`, `"include": ["src", "vitest.config.ts"]`. Overrides:
  - `apps/web`: `lib` ["ES2023","DOM","DOM.Iterable"], `jsx` "react-jsx".
  - `apps/api`: `types` ["bun"].
  - engine / rules / contracts: none. They stay pure TS with no DOM and no Bun types, which enforces "no I/O".
- `vitest.config.ts`: `import { defineConfig } from "vitest/config"; export default defineConfig({ test: {} });`. Add `environment` only if needed later.
- `src/index.ts`: `export {};`

## Contracts
None. This step creates no cross-package types.

## Tests
None added. Each package runs `vitest run --passWithNoTests`.

## Done-criteria
1. `bun install` exits 0 and creates `bun.lock`.
2. `bun run typecheck` exits 0 and runs in all 5 `@snaplab/*` packages.
3. `bun run lint` exits 0.
4. `bun run test` exits 0 in all 5 packages, with no tests found and passing.
5. `cat .gitignore` and `cat .env.example` match the Files section exactly.
6. The tree has `apps/{web,api}`, `packages/{engine,rules,contracts}`, `golden/`, `fixtures/`, `docs/plans/` and `docs/BUILD_LOG.md`.

## Implementer
`implementer` (generic config, no design decisions left open).

## Risks
1. **`bun run --filter` with zero matching scripts** (`dev`/`build` don't exist yet) errors. That's expected until steps 2 and 4. Don't add placeholder scripts.
2. **The Biome 2.6 config shape differs.** Fall back to `biome migrate --write`.
3. **TypeScript 6 deprecates an option above.** Drop the deprecated option, note it, and keep `strict`.
