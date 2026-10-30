# Plan: the beauty pass (the V–I practical)

Status: **DONE Oct 30 (main b8a9e68)**. APPROVED by the user on Oct 30, with D1–D3 as recommended. Written after Integration closed on main e380677.

## Goal
Make the Ohm's-law practical (`/?practical=ohms-law`) look and move like Backcountry 101 from the first tap to the results. This plan clears the polish queued in Waves 1b and 2 and in Integration, then runs a bug bash on main and freezes. It is the last row of `docs/plans/exam-redesign.md` Progress ("Beauty pass and bug bash; freeze at 23:59 on Nov 2"), and its done-criterion 5.

## Out of scope
- The hero look (2c, a SHOULD), the viva, thumbnails baked from renders, and titration.
- Any change to `packages/engine`, `packages/rules` or `packages/contracts`. Marks and numbers stay as they are.
- New lesson copy, except shortening the entrance line (B2).
- The video and the deploy, which are separate tasks.

## Step 0: the walk-through (done Oct 30)
The user compared `/?practical=ohms-law` with `backcountry-101.vercel.app` in Chrome and added three items:
1. **A steps strip at the bottom, BC101's way** (chosen over an apparatus list): one card per step, with a small ink outline of the part that step uses, the step's name, and a tick when it's done.
2. **The leads are apparatus.** Today they appear only when she connects. They must lie on the bench with the other parts, drop in **one by one** in the entrance, and be picked up from there when connected.
3. **An organised bench:** arrange the apparatus so that, once wired, no lead crosses or covers any part.

## Slices (each one runs in its own worktree, owns disjoint paths and opens one PR)
Paths are under `apps/web/src/` unless rooted at `scripts/`.

**B1: apparatus look.** Claude `apparatus-modeller`, Opus, high effort, `claude/beauty-look`, port 5177. Paths: `apparatus/ohms-law/{TrayParts.ts,Tray.tsx,ResistanceBox.tsx,TerminalNut.tsx,WireBoardTextures.ts}` and their tests.

| # | Item | Where |
|---|---|---|
| 1 | A deeper tray rim | `TrayParts.ts:55–57` (WALL_H 0.014) |
| 2 | Bevelled resistance-box parts | `ResistanceBox.tsx:203–216` (radii 0.005 / 0.0015 / 0.002) |
| 3 | The nut cap gets its own ink id, so its outline reads. Don't edit `layout.ts` (B2 owns it); offset the id inside `TerminalNut.tsx` | `TerminalNut.tsx:288, 363` |
| 4 | cm numerals readable at phone size | `WireBoardTextures.ts:56, 208–220` (9.2 mm and 29 mm) |

**B2: the bench and the leads.** Claude `general-purpose`, Opus, high effort, `claude/beauty-bench`, port 5178. Paths: `apparatus/ohms-law/{layout.ts,poseTargets.ts,Lead.tsx,LeadParts.ts}` and their tests, `learn/stage/**`, `learn/lessons/ohms-law/script.ts` (the enter beat's `say` only).

| # | Item | Where |
|---|---|---|
| 1 | **Organised bench (Step 0 item 3).** Lay the parts out in the circuit's own order (cells → key → ammeter → resistance box → wire XY, voltmeter across XY), so every lead is short and none crosses a part, a dial or another lead. Keep the student's-seat camera (azimuth 12°), with the meters facing her | `layout.ts`, `poseTargets.ts`, `stage/shots.ts` |
| 2 | **Leads on the bench (Step 0 item 2).** Every lead the practical needs lies in a neat row on the bench (or in the tray, if the tray comes onto the bench), each one visible. In the entrance they drop one by one after the parts. Connecting (Watch or Practise) lifts that lead from its rest place to the terminals; removing it puts it back | `Lead.tsx`, `stage/motion.ts`, `stage/Choreo.tsx` |
| 3 | No side loops: a lead never runs down the side of a meter case. The layout should remove most detours; the rest go over the case top | `Lead.tsx:302–372` (`METER_CASES`, `caseCrossed`, `detour`, CASE_CLEAR_M 0.022) |
| 4 | Dark ink dots where the cable meets the plugs | `Lead.tsx:574–586`, `LeadParts.ts:25` CABLE_SEAT_M |
| 5 | Croc-clip jaws with teeth and a bevel | `LeadParts.ts:477–500` (plain BoxGeometry today) |
| 6 | The phone bench shot is a thin strip. Frame it taller: the bench fills at least 45% of the stage height at 390×844 | `stage/shots.ts:176` `phoneBenchCorners`, `:288` `stageShot` |
| 7 | Entrance timing. Parts, then leads one by one, all finished within 7 s. The enter `say` names the connecting leads and fits that time (today: 20 words, about 8.3 s) | `script.ts:122–124`, `script/timing.ts:54`, `stage/motion.ts:26` |
| 8 | Plug beats get nib taps, like the leads and the key | `stage/Choreo.tsx:222–224` (`nib.tap++`) |
| 9 | Readings in Watch use the loupe shot, not the meters shot | `stage/shots.ts:50–51` (`readings: "meters"`) |

**B4: the page.** Claude `implementer`, Sonnet, high effort, `claude/beauty-page`, port 5179. Path: `learn/LearnPage.tsx` and its tests.

| # | Item | Where |
|---|---|---|
| 1 | **D1.** In Watch, the graph opens by itself on the plot and slope beats and closes on the next beat. In Practise she opens it herself | `LearnPage.tsx` (the code removed in a2f4add, Watch only), plot event `createDirector.ts:300` (read only) |
| 2 | **D2.** Choosing Watch on the paper starts playing straight away. Practise and Exam don't autoplay | `LearnPage.tsx:264–296` (fresh director) |
| 3 | The canvas flashes on a mode change. Keep the Canvas mounted: no `return null` while the rig rebuilds, and no `key={run.n}` on the Canvas tree | `LearnPage.tsx:159, 364, 370` |

**B3: UI and tools (non-3D).** Muse Code, `muse/beauty-ui`, port 5176. The lead switches its folder to a new branch from origin/main first. Paths: `learn/shell/**`, `learn/player/**`, `learn/script/{types.ts,createDirector.ts}`, `learn/paper/desk.css`, `scripts/shot.ts`, `apps/web/scripts/e2e/**`.

| # | Item | Where |
|---|---|---|
| 1 | **The steps strip (Step 0 item 1).** Always visible at the bottom of the practical, like BC101's: one card per step, with an ink-outline SVG icon of the part it uses (cells, key, ammeter, voltmeter, resistance box, wire XY, leads, graph), the step's short name, and a tick when done. It scrolls sideways on the phone, with ‹ › on the laptop. Tapping a card does what the StepBar does today. The stage sits above the strip, never under it | `shell/StepBar.tsx` (the `thumbs` slot, `:126–153`), `shell/LessonShell.tsx:272` |
| 2 | The caption gets a "3/11 · " prefix (beat number / beat count) | `player/Player.tsx:216–218`; add `beatIndex` and `beatCount` to the director state if missing |
| 3 | **D3.** The paper's serif face: self-host Tinos (metric-matched to Times, like a printed WAEC paper) through `--f-serif` | `paper/desk.css:7` (`@fontsource/tinos` added in the seam) |
| 4 | `shot.ts --size WxH`, and a ready wait of 45 s (today a literal 15000) | `scripts/shot.ts:5–8, 60–61, 115` |

The paths are disjoint. B4 reads the plot event from `createDirector.ts` and doesn't edit it.

## Contracts
None cross a package. One in-app type changes, and only B3 changes it:
```ts
// learn/script/types.ts, the director's state (only if missing)
beatIndex: number; // 0-based index of the current beat
beatCount: number; // beats in this script
```

## Tests
- B2, `layout.test.ts` "no wired lead crosses a part": for the full circuit, no route point lies inside any part's x-z footprint except at its own two terminals, and no two routes cross in plan view.
- B2, "every lead has a rest place on the bench, inside the bench shot, and none overlaps a part".
- B2, `motion.test.ts` "leads drop one by one after the parts, and the entrance ends ≤ 7 s"; script timing "the enter beat's speech ≤ 7 s".
- B2, `shots.test.ts` "phone bench shot fills ≥ 45% of stage height at 390×844" (the writer logs today's value first); "a readings beat in Watch uses the loupe shot".
- B2, `Choreo` "a plug beat taps the nib once"; `Lead` "a route past a meter case never runs down its side".
- B4, `LearnPage`: "Watch opens the graph on plot and slope and closes it after; Practise never does"; "choosing Watch plays once, Practise and Exam don't"; "a mode change keeps the same Canvas" (Stage mount count stays 1).
- B3, `StepBar` "renders one card per step with an icon, a name and a tick for done steps"; `Player` "the caption reads `3/11 · <say>`".
- The E2E scripts stay green. If a slice breaks a selector in `scripts/e2e/**`, the lead routes the fix to Muse (the owner).

## Done-criteria
1. B1–B4 are merged; the four checks are green on main (`bun run typecheck && bun run lint && bun run test && bun run build`); the test count has not dropped.
2. The user signs off each visible slice in real Chrome beside BC101 (`/?practical=ohms-law`, phone and laptop; B1 also on `/?kit=ohms-law&turn=1`).
3. Bug bash: `bun apps/web/scripts/e2e/{watch,practise,exam,noleak}.mjs` all pass on the final main, on phone and laptop.
4. fps: one `/verify-3d` run on `/?practical=ohms-law&mode=watch`: laptop ≥ 55, phone `quality=low` ≥ 30, no console errors. Then a **real phone** check: the user opens the LAN dev URL (`bun run dev -- --host`) and judges the smoothness.
5. Progress in this file and in `exam-redesign.md` is ticked, with a BUILD_LOG line. Freeze.

## Implementer and gates (lean)
- B1, B2 and B4 are Claude subagents (3D stays with Claude); B3 is Muse Code. All four run in parallel; Muse runs on its own account.
- **Seam (lead, small):** the AGENTS.md "Who owns what" rows, `bun add @fontsource/tinos` in `apps/web`, and Muse's folder on a new branch.
- **Gates per PR:** the four checks; one fresh `code-reviewer` on B2 and B4 (logic); the user's Chrome sign-off; **one fix round at most**. No visual-qa per slice, and no science-verifier (no engine or rules change).
- **Context:** the lead holds this file and reports of ≤ 30 lines. Briefs say "Read AGENTS.md, then docs/plans/beauty-pass.md, slice Bn."
- **Rough cost:** B1 about 0.3M tokens, B2 about 0.7M, B4 about 0.2M, the reviewers about 0.2M.

## Decisions (the user, Oct 30)
- **D1.** In Watch the graph opens by itself on plot and slope, then closes.
- **D2.** Watch plays as soon as she picks it.
- **D3.** The paper uses Tinos.
- **Bottom strip:** steps (BC101's way), not an apparatus list.

## Risks
1. **The new layout moves every terminal**, so the Watch script, the Practise rings and the phone shots shift with it. Fallback: B2 keeps the terminal registry's ids and only moves positions, and runs `watch.mjs` and `practise.mjs` once before its PR.
2. **The steps strip takes height from the bench**, especially on the phone. Fallback: on the phone the strip collapses to a 40 px row of icons, with names on the current card only.
3. **Keeping the Canvas mounted could leak the old rig's state into the new mode** (noleak). Fallback: keep the remount and cover it with a 150 ms paper-coloured cross-fade.

## Progress
- [x] Plan approved (Oct 30), D1–D3 as recommended
- [x] Step 0: three items from the user (steps strip, leads as apparatus, organised bench)
- [x] Seam: ownership rows, `@fontsource/tinos`
- [x] B1 merged (#110, signed off) · [x] B2 merged (#113: user approved in Chrome, review SHIP; fix round for the muted entrance timing, benchFrame v4 and three Lead minors; phone bench 37.6%, accepted by the user, no steeper camera) · [x] B3 merged (#112, Muse, signed off) · [x] B4 merged (#111, review FIX round, signed off; noleak and watch E2E green)
- [x] Bug bash and fps; freeze (Oct 30): four checks green on main (1,129 tests; web 845); exam, noleak, practise and watch E2E pass on phone and laptop; fps on M1 Pro: laptop DPR 2 about 59 after the first 5 s (34 while loading), phone `quality=low` DPR 3 57–60; no console errors (one THREE.Clock deprecation warning); the user checked a real phone over LAN and it looked good.
- Later (not in this pass): a steeper phone camera for 45% (`elevationDeg` on `LookShot`); the THREE.Clock warning; the small cm numerals beside the tens.
