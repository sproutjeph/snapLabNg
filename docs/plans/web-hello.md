# Web hello-world + screenshot script (step 4)

## Goal
Prove the 3D stack end to end. A Vite + React 19 + R3F v9 page shows a flat textured exercise-book page lying on a 3D desk, with bloom, and builds to static files. `scripts/shot.ts` (spec: `.claude/skills/verify-3d/SKILL.md`) proves headless WebGL screenshots work on this Mac.

## Out of scope
- Capture, pipeline, apparatus, marking UI, Zustand stores, routes, PWA, and `?golden=` handling. The app ignores the query string.
- Quality tiers and Lite mode. Bloom's low-tier fallback (`.claude/rules/web-3d.md`) arrives with the tier system. Today, bloom is always on.
- Environment HDRs or any network asset. The texture is drawn in code.
- Web tests. Vitest stays `--passWithNoTests`.
- Reference shots in `.shots/ref/`. Those are copied only after the user approves the look.

## Files
**apps/web**
- `package.json`:
  - Dependencies via `bun add`: `react@19.3.1`, `react-dom@19.3.1`, `three@~0.186.1`, `@react-three/fiber@^9.8.2`, `@react-three/drei@^10.7.9`, `@react-three/postprocessing@^3.2.2`, `postprocessing@^6.39.5`. Keep three on 0.186.x; postprocessing requires three < 0.187.
  - Dev dependencies: `vite@^8.3.5`, `@vitejs/plugin-react@^6.1.2`, `@types/react@^19.3.0`, `@types/react-dom@^19.3.0`, `@types/three@~0.186.0`.
  - Scripts to add: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`.
- `index.html`: `<div id="root">`, `<title>SnapLab NG</title>`, viewport meta, and `<script type="module" src="/src/main.tsx">`. The body is full-bleed with a dark background.
- `vite.config.ts`: `defineConfig({ plugins: [react()] })`. Add it to the tsconfig `include`.
- `src/main.tsx`: `createRoot(...).render(<StrictMode><App/></StrictMode>)`.
- `src/App.tsx`: a full-viewport container. It lazy-loads the scene with `React.lazy(() => import("./scene/Scene"))` inside `<Suspense fallback={null}>`, so three.js lands in its own chunk (budget: initial JS ≤ 350 KB compressed).
- `src/scene/Scene.tsx`: the default export.
  - `<Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 40, position: [0, 5.5, 4.5] }}>` with a dark background colour (`<color attach="background">`).
  - Children: `<Lights/>` (inline: `hemisphereLight` + one shadow-casting `directionalLight`), `<Desk/>`, `<Page/>`, `<InkStroke/>`, `<ContactShadows/>` (drei), `<CameraRig/>`, `<ReadySignal/>`.
  - Then `<EffectComposer><Bloom luminanceThreshold={1} mipmapBlur intensity={1.2} /></EffectComposer>`.
- `src/scene/Desk.tsx`: a wide flat box (≈ 8 × 0.3 × 5) with a warm wood-brown `meshStandardMaterial` (roughness ≈ 0.7). It receives shadows.
- `src/scene/Page.tsx`: a plane lying flat just above the desk, in exercise-book proportions (≈ 2.1 × 2.97). Its `meshStandardMaterial` map is a `CanvasTexture`:
  - built once in `useMemo` at 1024 × 1448;
  - off-white paper, faint blue ruled lines, a red margin line;
  - `colorSpace = SRGBColorSpace`;
  - `.dispose()`d on unmount.
- `src/scene/InkStroke.tsx`: one thin ribbon (a narrow plane, or a drei `Line`) written across the page. It uses `meshBasicMaterial` with `toneMapped={false}` and a colour pushed above 1 (e.g. `[0.4, 1.6, 2.4]`). Only this crosses the bloom threshold, standing in for the "ink rising" glow.
- `src/scene/CameraRig.tsx`: frames the whole page at both aspect ratios.
  - On `size` change (in `useEffect`, never per frame), it pulls the camera back for portrait: `distance = base / Math.min(aspect, 1)`, then calls `lookAt(0, 0, 0)` and `updateProjectionMatrix()`.
  - No allocations per frame.
- `src/scene/ReadySignal.tsx`: a `useFrame` counter in a `useRef`. On the 2nd callback, the first frame has been rendered, so it sets `window.__SNAPLAB_READY__ = true` once and stops writing. No setState.
- `src/global.d.ts`: `declare global { interface Window { __SNAPLAB_READY__?: boolean } } export {};`
- `tsconfig.json`: add `"vite.config.ts"` and `"index.html"`-adjacent sources to `include` as needed, plus `"types": ["vite/client"]`.

**Root**
- `scripts/shot.ts` (runs with Bun; uses the root dev dependency `playwright@1.63.0`):
  - **Args:** `--route <path>` (default `/`), `--name <slug>`, `--base <url>` (default `http://localhost:5173`). The default name is the route slugified (`/` → `home`, `/?golden=g1` → `golden-g1`).
  - **Launch:** `chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })`.
  - **For each viewport** (`phone` 390×844, `laptop` 1440×900), in a new context:
    - collect `console` messages of type `error` and any message containing `WebGL` or `GL_`, plus `pageerror` and `requestfailed`;
    - `goto(base + route)`;
    - `waitForFunction(() => window.__SNAPLAB_READY__ === true, { timeout: 15000 })`;
    - measure fps in-page by counting `requestAnimationFrame` callbacks over 2000 ms;
    - screenshot to `.shots/<name>-<viewport>.png`, creating `.shots/` if needed.
  - **Output:** one JSON object per viewport on stdout: `{ viewport, file, ready, fps, consoleErrors[], webglWarnings[], failedRequests[] }`.
  - **Exit code:** 1 if any viewport failed to become ready; otherwise 0.
- `tsconfig.json` (new; it typechecks `scripts/`): extends `./tsconfig.base.json`, with `"types": ["bun"]`, `"lib": ["ES2023", "DOM"]` (for the `window` access inside `waitForFunction`) and `"include": ["scripts"]`.
- `package.json`: change the `typecheck` script to `"tsc --noEmit -p tsconfig.json && bun run --filter '@snaplab/*' typecheck"`.

## Contracts
`window.__SNAPLAB_READY__: boolean`. The web app writes it; `scripts/shot.ts` reads it (and `/verify-3d` relies on it).

## Tests
None added (see Out of scope). Proof is visual, through `/verify-3d`.

## Done-criteria
1. `bun run typecheck`, `bun run lint` and `bun run test` exit 0, repo-wide.
2. `bun run build` exits 0 and writes static files to `apps/web/dist/`. Report the initial-chunk gzip size and the scene-chunk gzip size; the initial chunk must be ≤ 350 KB gzip.
3. With `bun run dev` running in the background, `bun run shot -- --route "/"` exits 0. It writes `.shots/home-phone.png` and `.shots/home-laptop.png`, and its JSON shows `ready: true`, with no console errors and no failed requests.
4. Lead runs `/verify-3d` with `/` and reads both PNGs. The desk and the lined page are visible, the whole page is in frame on the phone size, and the ink stroke glows.

## Implementer
`implementer` does steps 1–3. The lead runs `/verify-3d` (criterion 4).

## Risks
1. **Playwright 1.63's headless shell isn't in the cache.** Stop and report the missing path. Do not run `playwright install` without asking.
2. **`bun run dev` errors because `@snaplab/api` has no `dev` script.** If bun refuses, report it. The fallback is running `bun run --filter @snaplab/web dev` directly; do not add a placeholder api script.
3. **SwiftShader can't create a WebGL2 context** (blank canvas or a timeout). Report it plainly. The user checks in their own browser.
