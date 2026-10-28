# Plan: restyle the existing screens to the ink-and-paper look (Muse Code)

Wave 3 of `docs/plans/ink-look.md`. **Owner: Muse Code**, on branch `muse/ink-restyle` in `~/Desktop/SnapLabNG-muse`, port 5176. The user chose Muse Code for this slice on Oct 28. It is DOM and CSS only: no 3D, no science, no marks.

## Goal
Every existing screen uses the same calm, ink-on-paper look as the new lesson page `?learn=ohms-law`:
- warm paper backgrounds;
- blue-black ink text;
- thin rules;
- uppercase condensed labels (Barlow Condensed);
- red ink only for examiner marks.

No glassmorphism, blur, gradients, glow or emoji. Behaviour, text and layout logic stay exactly as they are.

## The look (use only these)
- **Tokens** in `apps/web/src/styles/tokens.css`: `--paper`, `--paper-2`, `--card`, `--line`, `--ink`, `--ink-2`, `--muted`, `--red-ink`, `--green`, `--rail`, `--accent`, `--pencil`, `--f-cond`, `--f-body`, `--rule`, `--radius`, `--tap`.
- **Reference look:** open `/?learn=ohms-law` and `/?shell=1`. Their styles are in `apps/web/src/learn/learn.css` and `apps/web/src/learn/shell/shell.css`. Read them; don't edit them.
- **Buttons:**
  - Secondary: ink text on `--card`, a 1 px `--ink-2` border, `--radius`, `--f-cond` 600 uppercase, at least `--tap` (44 px) high.
  - Primary: an `--ink` background with `--paper` text.
- **Panels and cards:** a `--card` background, `var(--rule)` borders and no shadow (or one very soft shadow at most).
- **Red ink:** `--red-ink` only for examiner marks and lost marks. Earned marks use `--green` and a ✓, never colour alone.

## Files (Muse Code owns these for this slice)
- `apps/web/index.html`: the body background becomes `#f4ecdc` (paper) and the text `#1d2430`.
- `apps/web/src/home/**`, `apps/web/src/about/**`.
- `apps/web/src/ai-drawer/**`.
- `apps/web/src/marking/{ScoreCard,MarkDetail,MarkingPreview}.tsx`. `RedInkOverlay.tsx` keeps its red-ink marks; only its panel and label styles may change.
- `apps/web/src/notebook/**` (the metre bridge's notebook).
- `apps/web/src/teacher/**` and `apps/web/src/examiner/**`, including `voice/MicPreview.tsx`.
- `apps/web/src/capture/{CaptureFlow,CameraView,CornerEditor,CapturePreview}.tsx`: styles only. Camera and homography logic is untouched.
- `apps/web/src/pwa/OfflineNotice.tsx` and `apps/web/src/quality/{QualityPreview,ContextLossOverlay}.tsx`. In `QualityPreview`, show "Ink outline" in place of "Bloom".
- `apps/web/src/pipeline/FlowPage.tsx` and `apps/web/src/lab/LabBench.tsx`: **the DOM overlay styles only** (the instruction bubble, the "Read the scale", "2D", "Skip" and "Replay" buttons, the drawer toggle). Don't touch anything inside `<Canvas>`, the reveal, the engine wiring or any logic.
- `apps/web/src/lite/LiteBench.tsx`: the SVG colours move to ink on paper, for example ink strokes and paper fills. Geometry and logic stay the same.

**Off limits:** everything else, especially `apps/web/src/learn/**`, `apps/web/src/scene/**`, `apps/web/src/apparatus/**`, `lab/` files other than the `LabBench.tsx` overlay, `packages/**`, `apps/api/**`, tests' expected values, `tokens.css`, `package.json` and `bun.lock`. If you need a new token or a dependency, write it under "Needs from lead".

## How to do it
1. **Style mechanism.** Most screens use inline `style={{…}}` objects with hard-coded hex colours. Replace each hex with the matching token (`"var(--ink)"` works inside inline styles), or move a screen's styles into a co-located CSS file with screen-scoped class names (for example `home.css` with `.hm-` classes), as `learn.css` does.
2. **Colour mapping:**
   - Dark backgrounds (#0b0d12, #11151c, slate) become `--paper` or `--card`.
   - Light-on-dark text becomes `--ink` or `--ink-2`.
   - Cyan and sky accents (#38bdf8) become `--ink` for emphasis or `--accent` sparingly.
   - Greys become `--muted` or `--line`.
3. **Keep every behaviour, aria label, text string and test as it is.** Existing tests must pass unchanged. If a test asserts a colour, stop and say so under "Needs from lead"; don't edit the test.
4. **Phone first.** Check 390×844 and 1440×900: no horizontal scroll, tap targets ≥ 44 px, visible focus rings.

## Checks
- **Four checks:** `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` all pass. No test changes.
- **Screenshots at phone and laptop size, before and after:** shoot each route with `bun run shot -- --route "<route>" --base http://localhost:5176`. Put the "before" set in the PR as file names, and describe what changed.
  - `/`
  - `/?about=1`
  - `/?flow=1&golden=note1` (press "Skip the wait")
  - `/?drawer=1`
  - `/?marking=1`
  - `/?notebook=1`
  - `/?teacher=1`
  - `/?examiner=1`
  - `/?capture=1`
  - `/?lite=1`
  - `/?quality=1`
  - `/?pwa=1`
- **No console errors** on any route.

## Done
- Every listed screen reads as ink on paper, with no dark slate backgrounds left.
- Red ink appears only on marks.
- Nothing behaves differently, and all four checks pass.

## PR
- `git push -u origin muse/ink-restyle`, then `gh pr create --base main --head muse/ink-restyle`.
- The body starts with `_Built with Muse Code, Meta's coding agent._`, then the sections What, Why (link this plan), How I checked it (the commands, results and screenshots), Needs from lead, and Not done.
- Commits end with the line `Built with Muse Code (Meta)`.
