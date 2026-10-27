# Home page (the first screen a student or judge sees)

## Goal
A light, mobile-first page that says what SnapLab NG does in one look and sends people to the two working paths: snap their own practical (`/?flow=1`), or try the demo page (`/?flow=1&golden=note1`). No 3D on this page. It must load fast on a cheap Android phone on MTN data.

## Out of scope
- Any 3D, canvas or WebGL. Any network call. New dependencies.
- Making it the default route: the lead swaps it in later. Here it lives behind `?home=1`.
- WAEC logos, scans or the word "official" (AGENTS.md; docs/01 §0).

## Files
All under `apps/web/src/home/`. Owner: **Gemini (Flash)**, branch `gemini/home-page`, worktree `~/Desktop/SnapLabNG-gemini`.
- `links.ts` (pure): `ROUTES = { snap: "/?flow=1", demo: "/?flow=1&golden=note1" } as const`, and `withParam(path, key, value)`. `withParam` adds or replaces one query parameter and keeps the others.
- `HomePage.tsx`: the default export. Its sections, top to bottom, are below. Use plain React and inline styles, matching the flow page's dark look (`background: #0c0f14`, text `#f8fafc`, muted text `#94a3b8`, system-ui font).
  1. **Header:** "SnapLab NG" and the tagline "Snap your WAEC practical. Watch it come alive. Get marked like the exam."
  2. **Two big buttons** (real `<a href>` links, at least 48 px tall): "Snap my practical" (primary) → `ROUTES.snap`, and "Try a demo page" → `ROUTES.demo`.
  3. **How it works:** three numbered steps.
     - "Snap your notebook page."
     - "Your apparatus comes alive as a 3D lab."
     - "Get your marks in red ink, then answer examiner-style questions."
  4. **Experiments:** a short list with status chips. Metre bridge is "Ready". Titration is "Coming soon". Glass block is "Later".
  5. **Your privacy:** "Your name and school at the top of the page are blurred on your phone before upload. Your photo is not saved."
  6. **How marking works:** "Meta's Muse Spark, Muse Wonder and SAM 3.1 read your page. The marks come from a fixed rule engine, so the same page always gets the same score. The AI never decides your marks."
  7. **Teachers:** "After a snap, tap For teachers in the corner to enter your measured value and mark accuracy."
  8. **Footer:** "Not affiliated with WAEC. Built for the Meta Global AI Developer Hackathon, 2026."
- `HomePreview.tsx`: renders `HomePage` and sets `window.__SNAPLAB_READY__ = true` after mount.
- `links.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?home=1` switch, keeping every other switch.

## Rules for the page
- Mobile first. At 390 px wide, there is no horizontal scroll and the two buttons are visible without scrolling. On a laptop, the content column is at most 720 px wide and centred.
- Accessibility:
  - one `<h1>`, with `<h2>` for each section;
  - the buttons are links with clear text;
  - a visible focus ring on every link;
  - contrast of at least 4.5:1 for body text;
  - `lang` stays as set in `index.html`.
- Use Nigerian English spelling ("practical", "colour"). Write "metre bridge" (WAEC spelling).
- No images except optional inline SVG icons that you write by hand. No emoji in headings.

## Tests (`bun run --filter @snaplab/web test`)
- `ROUTES.snap === "/?flow=1"` and `ROUTES.demo === "/?flow=1&golden=note1"`.
- `withParam("/?flow=1", "teacher", "1")` gives `"/?flow=1&teacher=1"`.
- `withParam("/?flow=1&golden=note1", "golden", "g2")` replaces the value and keeps `flow=1`.
- `withParam("/", "home", "1")` gives `"/?home=1"`.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`.
- On port 5174, `bun run shot -- --route "/?home=1" --base http://localhost:5174` saves phone and laptop shots with no console errors. On the phone shot, both buttons are visible without scrolling. Describe both shots in the PR.
- The HomePreview chunk stays under 10 kB gzip.
- The PR `gemini/home-page` → `main` has the body sections from AGENTS.md, counts checked against the branch, and no AI attribution.

## Implementer
Gemini (Flash, fresh session). The lead later makes it the default route.
