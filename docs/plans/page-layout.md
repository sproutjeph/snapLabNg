# Plan: Wave 1b, the page layout: Backcountry's cards over a full-bleed stage, for Watch, Practise and Exam

Status: **APPROVED by the user on Oct 29** (D1 Peek, D2 the paper's source, D3 rings now and thumbnails later). Runs beside the asset pass (`docs/plans/asset-pass.md`) on disjoint paths.
Inputs:
- `docs/plans/exam-redesign.md`: "Page layout: Backcountry's", "Backcountry motion", "Wave 1 handoff notes", Contracts (director, player and callout types are frozen); `.claude/rules/web-3d.md`; `.claude/agents/ui-builder.md`.
- BC101 (`backcountry-101.vercel.app/?lesson=fire`), measured on Oct 29 in headless Chromium (Playwright): `getBoundingClientRect`, `getComputedStyle`, and the page's own layout script and CSS. We copy sizes and behaviour, never its markup, class names or code. Scripts and shots: `/private/tmp/claude-501/-Users-jephthah-Desktop-SnapLabNG/8964aabb-883d-4147-8e2d-29ca24475a17/scratchpad/bc101/` (session scratchpad; copy what you keep).

## Progress (a fresh session reads this first)
- [x] BC101 measured at 1728×907, 1440×900 and 390×844 (the phone was the unknown); its layout rules read from source (below)
- [x] The user approved this plan on Oct 29: **D1 Peek** by default on the phone; **D2** the credit slot shows the paper's source; **D3** numbered ink rings now, baked thumbnails after the asset pass
- [x] Lead adds the ownership row to AGENTS.md (with `LearnPage.tsx`'s `coveredPx` and `learn/script/DirectorPreview.tsx` granted to this slice); `ui-builder` builds in `claude/page-layout` (port 5181, worktree)
- [x] Gates, the user's look in Chrome beside BC101 (APPROVED Oct 30; on touch Watch drops Restart into the practical menu), merged as #90
- [ ] Lead follow-ups after the merge (see Needs from lead): `LearnPage` framing, `DirectorPreview`, baked thumbnails

## Goal
One page shell for Watch, Practise and Exam (the hands-on `?learn=ohms-law` page shares it): the canvas full-bleed behind everything, BC101's cards floating over it in our palette (paper, ink #1d2430, orange accent), at phone, laptop and wide-laptop sizes.
- The player card, status card, guide panel (tabs and sub-step checklist), step strip (thumbnail tabs) and caption pill replace today's header, panel and step bar and the Player's chip, ticks, panel and dock.
- **One breakpoint set** (BC101's four layout modes) replaces today's two (640 px in `usePhone`, 900 px in `stages.ts`), and `playerCovered` comes from it, so the camera frames what the cards leave free.
- Contracts do not change. The look stays flat (paper, ink, thin rules); the only gradient allowed is BC101's fade on the brand band.

## Out of scope
- Scene content, camera moves, callout chips (W2-callouts; this slice leaves their layer and variables), scripts and beats, the question paper, results and hand-in.
- BC101's compass and rotate buttons (our stage is fixed), its fullscreen button, topographic art, the DM Mono face, new dependencies, baked thumbnail art (the `thumbs` seam ships; the images come after the asset pass).

## Open decisions for the user (recommendation first)
- **D1. Phone stage height.** BC101's phone stack leaves the 3D stage a 390×234 window (y 120–354 of 844) between the player pill and the strip: too small to tap terminals on our bench. Build two guide states: **Open** (BC101's stacking exactly) and **Peek** (the guide folds to its tab row plus the active step's title and one line, as today's `sh-peek`; the window grows to about 390×497). **Recommend Peek by default in every mode**, Open on a tap of the active tab or a drag up.
- **D2. The status card's right slot** (BC101: "Designed by …"). Recommend the paper's source ("WASSCE (SC) 2018 · Physics 3 · Q3B", from `PracticalQuestion.source`) in the credit style; the brand already sits top left. Alternative: a "SnapLab NG" brand credit.
- **D3. Thumbnails.** Recommend numbered ink rings now and baked images later (the lead bakes them from the finished assets). Alternative: hold the layout until the images exist.

## BC101 measurements (CSS px, DPR 1)
**How it is built.** A design canvas of 1728×996 "design px" scaled by `ui` with CSS `zoom` on each floating layer (rail column `74·ui`). A resize script (rAF-throttled) sets `--ui`, `--lw` = width/ui, `--lh` = height/ui, `--label` and `data-layout` on the root; there are no layout media queries. The stage fills x = rail edge → right edge, full height; cards sit over it (z 3–4); the callout layer sits under them (z 2). Its own `--ui` read .911, .833 and .907 at the three sizes below, which our formula reproduces.

| Region | 1728×907 (ui .911) | 1440×900 (ui .833) | 390×844 (portrait, ui .907) |
|---|---|---|---|
| Rail | 0,0 67×907 | 0,0 62×900 | hidden |
| Brand | 89,16 423×77 | 82,14 387×70 | 13,9 231×44; flat full-width band 0–62 |
| Player card | 976,31 244×49 | 752,28 223×45 | 74,71 243×49, centred, row below the brand |
| Status card | 1234,16 478×78 | 988,15 437×72 | 279,9 99×44, no card: name, bar 71×9, count |
| Guide | 1246,109 467×494 | 999,100 428×452 | 0,490 390×355, no outer card |
| Tabs · inner card | 1260,110 440×64 · 1260,174 440×417 | 1012,101 402×58 · — | 9,490 372×49 · 9,539 372×296 (scrolls) |
| Step strip | 67,758 1661×149 | 62,763 1378×137 | 0,354 390×136 |
| Stage card · prev · next | 89,800 234×79 · 1559,800 57×70 · 1629,800 61×70 | 82,803 191×73 · 1285,803 52×64 · 1349,803 56×64 | 9,396 171×79 (row scrolls sideways) · 296,396 40×70 · 341,396 40×70 |
| Callout chip | 108×36 | 99×33 | 74×25 (`--label` .62) |

**Phone (mode `portrait`, width < 0.95·height).** Rail hidden. Brand band 0–68 design px, flat, full width: logo 46×48, title 27 px, tagline 11.5 px, and the status at the right without its card (name 12.5 px, bar 78×10, count 16 px). Player pill centred on the next row (y 78). Stage window from the pill to `sceneBottom`. Strip 150 high (tab, cards scrolling sideways with a hidden scrollbar, prev/next pinned right). Guide fills the rest: height `e` = clamp(0.42·lh, 280, 560), kept ≥ 240 and leaving the stage ≥ 230, so `sceneBottom` = lh − e − 150; tabs row 54, the card scrolls inside; no expand button.

**One breakpoint set** (`layoutFor(w, h)`, copied from BC101's script; it replaces `usePhone` and `WIDE_MIN_PX`):
- `w < 0.95·h` → **portrait**, `ui` = clamp(w/430, .72, 1.1).
- else `n` = min(w/1728, h/996); `n ≥ 0.7` → **wide**, `ui` = n.
- else `h < 540` → **short** (landscape phone: no rail or status, the guide full height at the right with `guideW` = clamp(lw·.4, 320, 420), strip 100 high with label-less cards), `ui` = clamp(h/430, .72, 1.15).
- otherwise **compact** (wide with the guide 446 wide, 12 from the edge, y 120 to strip − 12; the status folds to its mark), `ui` = clamp(min(w/1300, h/860), .5, .9).

**Mapping** (BC101's numbers are design px, ×`ui` on screen; ours after "→", and what moves from today's shell or Player):
- **Rail.** 74 wide, full height, `--ink`, shadow `1px 0 rgba(0,0,0,.08)`; toggle 44×45 at (14,40); items from y 125, 80 high, gap 10, icon 33 (active 30, accent, fill #141a23, 6 px accent bar); open = a 248 overlay with labels (600 17 uppercase .06em); foot motif 230×330 at 24%.
  → `Rail`; the six NAV items stay (Home, Metre bridge, Titration, Ohm's law, Notebook, About). From `.sh-rail` (76 px, stacked labels). Portrait and short have no rail: the brand logo becomes the menu button (today's NavList dropdown).
- **Brand.** At (24,17); logo 82×84; title 600 48.5/1 `--f-cond` uppercase .068em; tagline 500 20/1 .272em; band 640×103 at 75% paper fading out to the right, rule 1.5 at y 103.
  → `Brand`: mark, "SNAPLAB NG", "WATCH · PRACTISE · EXAM" (current mode in `--ink`, others `--muted`). From `.sh-head` (wordmark, title, badge). "Compare with diagram" and the Identify card move to a left column under the band (top 112, left 24, 340 wide, as `.sh-float`); on a phone the toggle is a 44 px icon button left of the player pill.
- **Player card.** Top 34, right 558 (16 left of the status card, grows leftwards); 54 high, padding 0 6, gap 6; border 1.5 `--line`, radius 10, card 97%, shadow `0 2px 6px rgba(60,45,25,.06)`; buttons ≥ 37×40 radius 8, icons 20; play filled ink 44 wide; speed 700 18.
  → `Player` card. Watch: restart, previous beat, play/pause, next beat, speed, mute. Practise: play/pause guide, say it again, show me, mute. Exam: clock (`role="timer"`) and mute. From `.dp-pill`, `.dp-chip`, `.dp-stage`.
- **Status card.** Top 18, right 17, 525×86, border 1.5, radius 10; inner card 280×70 (book icon 42, name 600 17.5 uppercase .04em, bar 137×14, count 700 20); credit: mark 36 and two lines 16.
  → `StatusCard`: "Ohm's law (V–I)", done/total from `stepStatus` ("3/11"; hidden in Exam), credit per D2. From `.sh-chip` and the Player's `.dp-track` bar (the bar now steps per stage with a width transition; no per-frame fill).
- **Guide.** Top 120, right 16, 513×542, padding 0 14, border 1.5, radius 10; tabs row 70 (600 19 uppercase .055em, gap 38, flat 5 px accent underline that slides); card 458, padding 16 18 0 29: title 700 38.5/1; text 400 19.5/24 `--muted`; rows 58 high, gap 8 (mark 26 · ring 46 · label 500 18.5/21 uppercase); current = accent tint, 1.7 accent border, chevron; done = green tick that pops in, green connector line.
  → `GuidePanel` (Instructions, Why it works, Precautions; Examiner asks only when `tabContent.examiner` is passed; the mode note at the foot) and `StageChecklist` (the stage's beats: `beat.instruct`, a ring glyph from `beat.act?.kind`, the active ring filled from `beatProgress()` through a ref, no per-frame setState). From `.sh-panel`, `.sh-handle`, `.sh-peek` and the Player's `.dp-panel`.
- **Step strip.** 164 high; plate fill + 1.5 `--line` stroke, path `M0 0 H247 C277 0 287 25 321 25 H… V… H0 Z` (a raised 247 tab at the left); selector at (18,4): icon 27 + "PRACTICAL: OHM'S LAW (V–I)" 700 17 + caret, opening a 360 menu upward (padding 8, items 64: icon 44, name 700 19, meta 500 14.5, tick); track top 47, left 24, right 42, gap 11; cards 87 high radius 8, art 70×70, label 500 17.5/20 uppercase with a bold number; current = 2.5 accent cursor that slides; done = green tick; locked = `--muted`; prev/next 62×77 and 67×77 (next filled ink).
  → `StepBar` (extended) and `PracticalMenu` (the rail's NAV targets). One card per lesson step = per script stage (11), so min card width 188 and sideways scroll in every mode, the current card kept in view. From `.sh-stepbar` and the Player's ticks. In Practise the cards are display-only and later ones locked.
- **Caption (BC101's toast).** 500 18 uppercase on dark, radius 8, bottom 186 (22 above the strip), centred in the free stage.
  → the Player's caption: ink pill (`aria-live`, always mounted), centred in the free stage; on a phone 58 above the strip. It counts in `covered.bottom` (+52) while a caption shows.
- **Callout chip.** 40 high, 500 18/1 uppercase .05em, `--ink` fill, 1 `--ink-2` border, radius 3, padding 0 19, shadow `0 2px 6px rgba(40,30,20,.12)`; ring 22 with a 2.6 paper border; leader 2.2 paper over 4.2 shadow.
  → built by W2-callouts; this slice gives `calloutLayerRef` (a div over the canvas, under the cards) and `--label` (between .62 and `ui`: `ui` on wide screens, .62 on the phone).

Colours: rail and brand → `--ink`; BC101's greens (bar, ticks) → `--green`; orange → `--accent`; peach and soft orange → `--accent` mixed into `--card` (22%, 55%); #6f6961 text → `--muted`; cards `--card` at 97%; lines `--line`. Fonts: Barlow 400–600 and Barlow Condensed 500–600 are loaded; the 700 weight is not, so `shell.css` imports `@fontsource/barlow-condensed/latin-700.css` (installed).

**`covered` for the new cards** (CSS px, canvas-local; the canvas is the shell minus the rail column, so `left` stays 0): wide and compact `{ left 0, right (guideW + edge)·ui [513+16 wide, 446+12 compact], top 104·ui (status bottom), bottom 164·ui }`; short `{ 0, (guideW + 6)·ui, 58·ui, 100·ui }`; portrait `{ 0, 0, 132·ui (player bottom), (e + 150)·ui }` Open, or with the guide 100 design px high for Peek. An optional third argument `{ guide, caption }` (defaults Open, none) keeps today's two-argument callers working.

## Files (all under `apps/web/src/learn/`; the writer owns these and nothing else)
- `shell/`: `LessonShell.tsx` (regions, additive props), `StepBar.tsx`, `Sheet.tsx`, `IdentifyFrame.tsx`, `icons.tsx`, `shell.css` (rewrite); new `layout.ts`, `layout.test.ts`, `useLayout.ts` (replaces `usePhone.ts`, deleted: only the shell imports it), `Rail.tsx`, `Brand.tsx`, `StatusCard.tsx`, `GuidePanel.tsx`, `PracticalMenu.tsx`, `shell.test.tsx`; `ShellPreview.tsx` extended.
- `player/`: `Player.tsx`, `player.css`, `stages.ts` (`playerCovered` delegates to `coveredFor`; `WIDE_MIN_PX` and `PANEL_WIDTH_PX` go), `icons.tsx`, `player.test.tsx`; new `StageChecklist.tsx`, `useStageNav.ts`, `stageNav.test.ts`.
- `?shell=1` (already routed) keeps `step`, `mode=exam`, `identify`, `diagram`, `lost`, and adds `director=1&mode=watch|practice|exam` (the real director on the sample script), `canvas=1` (the real bench through the look, as `scene/look/LookPreview.tsx` does; default a paper-grid placeholder) and `debug=1` (outlines the free rect `playerCovered` returns and prints the region rects as JSON).
- Anything else goes under Needs from lead.

## Contracts (additive only; `Director`, `DirectorState`, `DirectorHandle`, `CalloutSpec`, `CalloutsProps`, `PlayerProps`, `Covered`, today's `LessonShellProps`, `StepStatus` and `ShellTab` do not change)
```ts
// shell/layout.ts
export type LayoutMode = "wide" | "compact" | "short" | "portrait";
export interface LayoutInfo { mode: LayoutMode; ui: number; lw: number; lh: number; sceneBottom?: number; guideW?: number }
export function layoutFor(widthPx: number, heightPx: number): LayoutInfo;
export function coveredFor(l: LayoutInfo, o?: { guide?: "open" | "peek"; caption?: boolean }): Covered;
// player/stages.ts: playerCovered(w, h, o?) => coveredFor(layoutFor(w, h), o)
// LessonShellProps, all optional: overlay (the Player, same coordinate space), checklist (under the step text), status { credit?, hideCount? },
//   thumbs (Step.key → URL; missing → numbered ink ring), lockedFrom, readOnlyTabs, guide + onGuideChange (phone), note, calloutLayerRef
// player/: <StageChecklist director stageTitles? />; useStageNav(director, steps) → { stepIndex, stepStatus, onStepChange, lockedFrom, readOnlyTabs }
```
The shell sets `--ui`, `--lw`, `--lh`, `--label` and `data-layout` on its own root (a ref plus `useSyncExternalStore`; React re-renders only when the mode changes), and the root is `position: fixed; inset: 0`, not `100vh`, so iOS Safari's toolbar cannot hide the strip. The Player positions itself with the same `layoutFor`, so it still works alone in today's `DirectorPreview`.

## Tests (by name; no assertion is deleted or weakened, each moves with its element)
- `layout.test.ts`: `layoutFor` for 1728×907 (wide, .9106), 1440×900 (wide, .8333), 1024×768 (compact, .788), 390×844 (portrait, .907, `sceneBottom` 389.7), 844×390 (short), 768×1024 (portrait, clamped 1.1); `playerCovered` against the measured cards within 1.5 px, as (left, right, top, bottom): 1728×907 `{0, 481.7, 94.7, 149.3}`, 1440×900 `{0, 440.8, 86.7, 136.7}`, 390×844 `{0, 0, 119.7, 490.5}` (Peek: bottom 226.7); the caption variant.
- `stageNav.test.ts` (from `stagesOf(SAMPLE_SCRIPT)`): index per beat; statuses (all "todo" in Exam); `lockedFrom` (Practise = current + 1, Watch none); `onStepChange` seeks `stage.first` in Watch only.
- `shell.test.tsx` (`renderToStaticMarkup`, as the Player's tests do): six rail links with the current page marked; "3/11" for three done; tabs (no Examiner asks without content); 11 stage tabs with number, title and status words; Exam has no Why or Precautions tab, no "Do this next", no count when `hideCount`; every label hidden on a phone is clip-hidden, never `display: none` (the player test's rule, extended to `shell.css`).
- `player.test.tsx`: the stage-count assertion moves to the status card's test and the checklist to `StageChecklist`; the covered test is replaced by the numbers above.

## Done-criteria (each with its proof)
1. `bun run typecheck`, `lint`, `test` and `build` green, with a higher test count than before. Proof: the four exit codes.
2. Geometry matches BC101: at 1728×907, 1440×900 and 390×844 the `debug=1` rect dump is within ±2 px of the table for every row but the chip. Proof: the diff table in the report.
3. Shots, scored by `visual-qa` (≤ 8 lines each): phone 390×844 at DPR 3 (Watch Peek and Open, Practise, Exam); laptop 1440×900 and 1728×907 at DPR 2 (Watch, Practise, Exam); the lesson menu, the rail and the Why-it-works tab open; `?learn=ohms-law`; smoke at 1024×768 and 844×390. No overlap, clipping or sideways page scroll.
4. Behaviour: Arrow keys on the tabs and the strip, Escape closes the menus, the caption live region is mounted before any words, every icon-only button has a name, hit areas ≥ 44 px on touch (visual size as measured, a pseudo-element for the rest), `prefers-reduced-motion` stops the sliding cursors and pops, Exam shows no checklist, count or hint.
5. The user's look in real Chrome beside BC101 at 1728×907 and at phone size (`canvas=1`): APPROVE or FIX per region.
6. `git diff --stat` touches only the paths above; `boundary.test.ts` green.

## Implementer
`ui-builder` (Sonnet, max effort: the user opted in), `isolation: "worktree"`, branch `claude/page-layout`, dev server `bun run dev --port 5181 --strictPort` in `apps/web`, shots with `--base http://localhost:5181`. Brief of about 10 lines: read this file, AGENTS.md and `web-3d.md`; own only the Files above; order: `layout.ts` and its tests, then rail, brand and status, guide and checklist, strip and menu, Player, preview, geometry diff and shots, the four checks; small commits staged by name; report in ≤ 300 words.

## Context management
State lives here and in BUILD_LOG, not in chat. The lead never reads CSS or TSX: gates return verdicts (`verifier` failures only, `visual-qa` ≤ 8 lines, `code-reviewer` ≤ 25 lines); fixes go to the same writer by `SendMessage`, at most 2 FIX rounds; past 50% of context, stop and ask for `/clear`.

## Needs from lead (the writer must not touch these)
1. AGENTS.md "Who owns what": a row for `learn/shell/**` and `learn/player/**` (+ CSS), `ui-builder`, `claude/page-layout`, while it is open.
2. `LearnPage.tsx`: replace `coveredPx` with `playerCovered(w, h)`, or `?learn=ohms-law` frames its poses for the old panels.
3. `learn/script/DirectorPreview.tsx`: mount `LessonShell` with `overlay`, `checklist` and `useStageNav` over the full-bleed canvas (the working preview for Wave 2); `PracticalPage` does the same at Integration.
4. After the asset pass merges: bake the 11 stage thumbnails (70×70 design px at 2×, `apps/web/public/thumbs/ohms-law/<Step.key>.webp`) with a lead script. `scripts/shot.ts` needs `--size WxH` for the 1728×907 shots (the asset seam's `implementer` is already editing it).
5. Copy the BC101 reference shots (1728×907, 1440×900 at DPR 2; 390×844 at DPR 3) from the scratchpad into `docs/design/exam-redesign/` for the writer and `visual-qa`.
6. `docs/BUILD_LOG.md` line; the Wave 1b tick in `exam-redesign.md`; D1–D3 recorded in Progress.

## Risks
1. `zoom` (Chromium, Safari, Firefox ≥ 126) can report rects differently, so `covered` is computed, never measured; the geometry diff runs in Chromium and the user spot-checks an iPhone at sign-off.
2. BC101's pale greys fail WCAG AA (locked labels, tagline, menu meta); ours use `--muted`, and `--pencil` only on truly disabled controls.
3. Eleven stages and long checklists: the strip and the card scroll, and the active row stays in view.
