# About page (for judges, teachers and curious students)

## Goal
One plain page that explains, honestly and briefly, what SnapLab NG is, how it works, which Meta models it uses, what the AI does and does not decide, and what was built when. Judges will open it from the home page. No 3D.

## Out of scope
- 3D, canvas, network calls, new dependencies.
- Linking it from the home page: the lead does that later. Here it lives behind `?about=1`.
- WAEC logos or scans, and the word "official".

## Files
All under `apps/web/src/about/`. Owner: **Gemini (Flash)**, branch `gemini/about-page`, worktree `~/Desktop/SnapLabNG-gemini`.
- `content.ts` (pure data): `ABOUT_SECTIONS: Array<{ id: string; heading: string; paragraphs: string[]; bullets?: string[] }>`. The text is exactly as below. Fix nothing in it, and add nothing to it.
- `AboutPage.tsx`: the default export. It renders the sections in order: one `<h1>` "About SnapLab NG", then an `<h2>` per section. Use the same look as `apps/web/src/home/HomePage.tsx` (dark background `#0c0f14`, text `#f8fafc`, body text `#cbd5e1`, column of at most 720 px, centred, 20 px side padding). Add a "Back to home" link to `/?home=1` at the top.
- `AboutPreview.tsx`: renders `AboutPage` and sets `window.__SNAPLAB_READY__ = true` after mount, like `apps/web/src/home/HomePreview.tsx`.
- `content.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?about=1` switch, keeping every other switch.

## The text (copy exactly)
1. **id `what`, heading "What it does"**
   - "A student snaps the metre bridge practical in their exercise book. The apparatus they drew rises out of the ink as a working 3D lab they can use. Their own handwriting is then marked in red ink, item by item, and an examiner-style voice asks them about their own mistakes."
2. **id `how`, heading "How it works"**
   - Paragraph: "Everything that decides a number is ordinary, tested code. The AI reads and explains."
   - Bullets:
     - "Muse Spark reads the drawing: which experiment it is, and where each part is."
     - "Muse Wonder reads the table and the graph exactly as written, including mistakes like 57 instead of 57.0."
     - "SAM 3.1 outlines the parts she drew, so they can lift off the page."
     - "A physics engine runs the circuit: the balance point, the galvanometer needle and the cell."
     - "A fixed rule engine gives the marks, so the same page always gets the same score."
     - "Muse Spark judges her spoken or typed answers to the examiner's questions. It never changes a mark."
3. **id `honest`, heading "What the AI does not do"**
   - Bullets:
     - "It never decides marks. The rules do."
     - "It never shows the expected answer. Accuracy is only marked against a value a teacher measured."
     - "It is not a human and not an official WAEC examiner."
4. **id `privacy`, heading "Privacy"**
   - "Your name and school at the top of the page are blurred on your phone before upload. Your photo is not saved. Spending on the AI has a hard daily limit."
5. **id `built`, heading "When it was built"**
   - "Built solo for the Meta Global AI Developer Hackathon, October 26 to November 4, 2026, with Claude Code, Gemini and Muse Code, Meta's coding agent. Planning and design were done before the event; a small amount of setup code was written a few hours before kickoff on October 26, and is disclosed in the project's README."
6. **id `credits`, heading "Credits"**
   - "Meta Model API (Muse Spark, Muse Wonder, SAM 3.1). three.js and React Three Fiber. WAEC practical requirements are taken from WAEC's public e-Learning pages. Not affiliated with WAEC."

## Tests (`bun run --filter @snaplab/web test`)
- There are 6 sections, with ids in this order: what, how, honest, privacy, built, credits.
- Every section has a heading, and at least one paragraph or bullet.
- No text contains "official WAEC examiner" except the "not an official WAEC examiner" bullet. That is, every match of `/official/i` is in a sentence that also contains "not".

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`.
- On port 5174, `bun run shot -- --route "/?about=1" --base http://localhost:5174` saves phone and laptop shots with no console errors, no horizontal scroll and readable text.
- The AboutPreview chunk stays under 10 kB gzip.
- The PR `gemini/about-page` → `main` has the body sections from AGENTS.md, counts checked against the branch, and no AI attribution.

## Implementer
Gemini (Flash, fresh session).
