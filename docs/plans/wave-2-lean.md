# Plan: Wave 2, lean: a clear full-screen bench, BC101 realism, and a Watch you can follow

Replaces the W2-watch, W2-guide, W2-callouts and W2-hero rows of `docs/plans/exam-redesign.md` (and most of its Integration wave). The contracts in that plan (director, script types, callouts types) stay frozen. Status: **approved by the user on Oct 30** (always on screen: the player, progress and caption).

## Goal
A student opens the practical. The stage fills the screen. Every part drops onto the empty bench, one after another, then the demonstration connects the circuit **one lead at a time**, drawn from terminal to terminal, with a label naming both ends and narration she can follow. Instructions, the question, the guide and the checklist open as pop-ups when she taps them. The apparatus looks as real as BC101's logs.

## What we learned (Oct 30; scratch evidence in the session scratchpad `gap/` and `timing/`)
1. **The realism gap is mostly an integration gap.** The live page (`?learn=ohms-law`, `?practical=ohms-law`, both `learn/LearnPage.tsx`) still renders the old pipeline: a perspective camera with OrbitControls, `InkLights` with the room environment washing matte parts, a blurry ruled `PaperDesk`, shadows re-rendered every frame, and a fixed `[1,2]` DPR. The BC101-matched pipeline (`LookCamera`, `LookLights`, `LookGround`, `dprLadder`, `InkComposer`) appears only on `?look=` and `?kit=` previews. Switching the live canvas over is the biggest single win.
2. **Still missing beside BC101:** no bump or roughness maps anywhere (BC101 bumps its bark at scale 5); our ink is 3 px with one opacity (BC101 2.1 px, thin parts ×.55, soft parts .55–.65); low segment counts on dials, plugs and cells.
3. **BC101's pace** (measured from its bundle and live clock): every tween ≤ 0.4 s; the scene builds in step 1 with 0.4 s `outBounce` drops from 2.2 units, 0.10–0.12 s apart, lowest on screen first; actions inside a step overlap; **every step then holds 1.0 s**; steps 1–4 total 8.5 s. The chip moves at the step's start (spring rate ≈ 20, ≈ 0.35 s to settle; text out 130 ms, in 250 ms after a 91 ms delay; first-show pop 0.3 s, 0.3 → 1.12 → 1). Speed 1×/1.5×/2× scales the timeline and the hold, not the chip. BC101 has no drawn rope, so our lead draw is ours to set.
4. **Viewport:** our laptop bench already fills more than BC101's hero; the phone is the problem (a 340 px strip with 40 px parts under four floating buttons). The `?look=` portrait camera fills 90% × 85% of a phone.

## The experience
- **Always on screen:** the stage (full-bleed, under everything); a slim top bar (brand mark, the player pill: restart, previous, play/pause, next, 1×; progress "3/11"); the caption pill at the bottom carrying the step ("3/11 · Connect the ammeter"); one callout chip. On laptop the 67 px rail stays; on phone it folds into the menu.
- **Pop-ups (tap to open, tap outside or ✕ to close; never open by themselves except the question at the start):** Question paper; Instructions (the guide with its checklist, why it works, precautions); Steps (the step bar with thumbnails); Graph sheet; Answer sheet; Tools (Compare, Notebook, Undo, Reset, which leave the stage). Phone: bottom sheets. Laptop: cards that slide in from the right, over the stage.
- **Desk props removed** (pencil, answer booklet, eraser, calculator). The graph and answer sheets are on screen.
- **Watch, beat by beat (one idea per beat):**
  1. Empty bench; 0.9 s after load the parts drop in: 0.4 s `outBounce` from 2.2 units, 0.10 s apart, nearest the student first; hold 1.0 s. The chip names each part as it lands only if narration names it; otherwise one chip, "APPARATUS".
  2. **One lead per beat:** the chip springs to the start terminal at t = 0 ("CELL + → AMMETER +"); the pen nib taps the first terminal; the lead draws to the other terminal in **0.6 s** (`inOut` cubic; the one tween allowed past BC101's 0.4 s cap, because a lead crosses the bench); the nib taps the second terminal (snap sound); the beat holds until its narration ends and never less than 1.0 s. About 2–3 s per lead, about 15 s for the circuit.
  3. Plug, key, readings, table, graph as in `exam-redesign.md` "Backcountry motion", each ≤ 0.4 s with a 1.0 s hold. The camera never moves except the meter loupe.
  4. Speed scales tweens and holds; narration chunks are never cut (the beat waits for speech or its estimated duration, whichever is longer).
- **Practise:** the same stage and chip. She taps terminal, then terminal; the lead draws in 0.6 s from where she tapped; both target terminals are ringed; a wrong tap shakes (0.3 s) and the voice says why (no digits).

## Slices (Wave 2a runs in parallel; 2b starts when 2a is merged)
| Slice | Who | Owns (under `apps/web/src/` unless rooted) | Delivers |
|---|---|---|---|
| **0. Seam** (now) | lead | `learn/script/timing.ts`, this plan, AGENTS.md rows | The hold and lead-draw timing below; port and path rows; Gemini's and Muse's worktrees |
| **2a-stage** | Opus subagent (worktree, port 5177) | `learn/LearnPage.tsx` (canvas part only), new `learn/stage/**`, `scene/look/**` (delete `DeskProps.tsx` and its uses, incl. `apparatus/ohms-law/kitParams.ts` import) | The live canvas moves to the look pipeline in a `learn/stage/Stage.tsx`: `LookTier.Provider`, `LookCamera` (fixed stage, drag-azimuth only, `covered` from `playerCovered`), `LookLights`, `LookGround`, `InkComposer`, `dprLadder`, `shadowsDirty`, demand frameloop. Old `InkLights`/`PaperDesk`/OrbitControls leave the live path. Phone portrait camera fills the stage. |
| **2a-real** | Opus subagent (worktree, port 5178) | `apparatus/materials/**`, `apparatus/ohms-law/**` (not `Lead.tsx`, `PenNib.tsx`, `kitParams.ts`), `scene/ink/InkEffect.ts` | Seeded fbm `bumpMap` + roughness variation on wood, mahogany and bakelite (BC101 bark recipe, scale ≈ 5, cached, anisotropy 8); ink 2.1–2.3 px, `inkThin` on leads, wires and labels, per-part ink opacity; more segments on dials, plugs, cells and terminal nuts. Signed off on `?kit=ohms-law` beside the references. |
| **2a-shell** | **Gemini 3.8 Flash** (`../SnapLabNG-gemini`, port 5174) | `learn/shell/**` (incl. the values in `layout.ts`), `learn/player/**` (not `stages.ts`'s exports), `learn/callouts/Callouts.tsx` + CSS | The pop-up layout above, keeping `LessonShell`'s props (so `LearnPage` needs no change) plus one optional `tools?: ReactNode` prop that the Tools pop-up shows (2b moves `LearnPage`'s `ol-tools` buttons into it); phone sheets; the callout chip as DOM (props: label, screen x/y, visible) with BC101's spring, text swap and first-show pop. Keyboard and focus trap in pop-ups. |
| **2a-script** | **Muse Code** (`../SnapLabNG-muse`, port 5176) | `learn/lessons/ohms-law/{script.ts,script.test.ts,guide.ts,guide.test.ts}` | The Watch script against the frozen `learn/script/types.ts`: an `enter` beat for all parts, one `lead` beat per lead in the WAEC connection order, then plug, key, readings, table, graph; narration in WAEC wording (Nigerian naming); `instruct` lines; `callouts` per beat; `guide.ts`: wrong-tap → spoken correction (no digits), the hint ladder, which beats allow Show me. |
| **2b-motion** | Opus subagent (worktree, port 5177) | `learn/stage/**`, `learn/wiring/**`, `apparatus/ohms-law/{Lead.tsx,PenNib.tsx}`, `learn/LearnPage.tsx` | The director drives the live stage: entrance drops, `Lead.drawn` 0 → 1 over 0.6 s, the nib on the bench, chip anchors projected per frame onto 2a-shell's chip, the loupe; Practise feel (ringed targets, hover, wrong-tap shake, bigger hit targets, the lead drawing from her tap). The player and caption on the live page; `ol-tools` moves into the shell's `tools` slot. |
| **2c-hero** (SHOULD) | Opus subagent | `lab/LabBench.tsx`, `apparatus/meter-bridge/**` | The look pipeline and realism recipe on the metre bridge; reveal and golden marks unchanged. |

Owners never edit another slice's paths. Anything needed outside them goes under "Needs from lead" in the PR.

## Contracts (the seam merges before 2a starts; frozen until 2b)
- The camera fit: `playerCovered(w, h, o?)` in `learn/player/stages.ts` (from `coveredFor`/`layoutFor` in `learn/shell/layout.ts`) keeps its signature. 2a-shell changes its values so it returns only the always-on chrome (top bar, rail on laptop, caption); pop-ups overlay the stage and never refit it. 2a-stage consumes it.
- Callout chip (2a-shell → 2b): `<CalloutChip label: string, x: number, y: number, visible: boolean />` with x, y the ringed dot in CSS px; the leader line goes from the dot to the chip. Placement (flip near edges) is the chip's job.
- Timing (`learn/script/timing.ts`, already used by the director): `ENTER_DROP_S` .4, `ENTER_STAGGER_S` .1, `NIB_TRAVEL_S` .4, `LEAD_S` 1.6 with taps at `LEAD_TAP_AT` [.22, .625] (so the draw is the last 0.6 s), `BEAT_GAP_S` 1.0 (BC101's hold; was 0.4). The scene adds the drop height 2.2 units and the 0.9 s start delay in `learn/stage/**`.

## Tests (by name)
- 2a-script: `the entrance beat enters every part once`; `each lead beat draws exactly one lead, in WAEC order, and the leads make the circuit in lesson.ts`; `no beat's narration contains a practice-bench value`; `each wrong tap yields a spoken correction with no digits in it`; `every non-exam beat has done() or is narration-only`; `Show me never covers readings or the graph`. The scales "2 cm to 0.1 A" and "1 cm to 0.2 V" go to science-verifier before the script uses them.
- 2a-stage: `playerCovered leaves at least 70% of a 390×844 phone and 85% of a 1728×907 laptop`; `DeskProps is gone` (no import resolves).
- 2a-shell: `a pop-up opens only from a tap and closes on Escape and outside tap`; `the chip keeps inside the stage at every edge`.
- 2b-motion: `the entrance drops parts lowest on screen first, 0.10 s apart`; `a lead beat's step length is max(narration, 0.6 + 1.0) s`; `no tween exceeds 0.4 s except the lead draw`.

## Done-criteria
- `?practical=ohms-law` on laptop and phone: full-screen stage, the look pipeline, no desk props, pop-ups for everything else. **The user signs off in Chrome.**
- Watch plays end to end: the drop-in, six leads one by one, then readings and graph, at a pace the user approves (the lead-draw time is one constant).
- Practise: she wires the circuit with ringed targets and spoken corrections.
- The four checks green on every branch before its PR.

## Gates (lean, per the user's Oct 30 direction)
- Per PR: the four checks; one fresh `code-reviewer` (Opus) on logic slices (2a-stage, 2a-script, 2b); `science-verifier` once on 2a-script; **one fix round at most**; visual polish goes to the beauty pass.
- Visual sign-off: the user in Chrome. The lead takes one phone and one laptop shot per visible PR, no shoot loops.
- No Workflow tool. Opus slices run as plain Agent subagents with `isolation: "worktree"`, high effort.
- Rough cost: about 0.4–0.7M tokens per Opus slice (three slices plus the hero), plus the gates. Gemini and Muse run on their own accounts.

## Context management
- The lead holds only this plan and short reports (≤ 40 lines). Subagents read the code; briefs point at this file's sections.
- Gemini and Muse each start from one line: "Read AGENTS.md, then docs/plans/wave-2-lean.md, slice 2a-shell (or 2a-script). Work in your worktree; open a PR." The lead creates their worktrees and adds their rows to AGENTS.md "Who owns what".
- `/clear` after 2a merges; 2b resumes from this file's Progress.

## 2b additions (found in 2a; the 2b writer owns these too)
- `learn/LearnPage.tsx`'s `ol-tools` (Compare, Notebook, Graph paper, Undo, Reset) move into the shell's `tools` slot; nothing floats over the stage.
- Laptop bench shot: stop reserving the ±25° drag margin, so the bench fills the free area (about 1.3× today); drag turns at most ±8°.
- Phone steps R = 1 Ω and Repeat: the box-and-key shot must include both meters (she reads them on those steps).
- Script (`learn/lessons/ohms-law/script.ts`): write R before the key closes (close the key only to read).
- `Lead.tsx`: `thin: true` on the cable's ink tag and `userData.inkStrength = 0.55` (2a-real).
- The demand frameloop stays awake while a beat plays.

## Progress
- [x] Plan approved by the user (Oct 30)
- [ ] Seam merged (chrome.ts, timing constants, ownership rows, worktrees for Gemini and Muse)
- [x] 2a merged Oct 30: real #95, shell #98 (Gemini), script #97 (Muse), stage #96. The user rejected the 45° golden camera (meter dials edge-on) and approved the student's-seat stage: azimuth 12°, layout v3 (meters front row, box/key/cells middle, wire board back, tray off the bench), sloping-front meters (dial aspect 0.97), named shots in `learn/stage/shots.ts` (bench; meters for readings; phone: board, box and key).
- [x] 2b merged Oct 30 (#100), signed off by the user in Chrome: the entrance drop, one lead per beat (nib taps, 0.6 s draw, one chip), the player and caption live, the meters zoom for readings, Practise rings/hover/shake/spoken corrections, leads routed around the dials, tools in the Tools pop-up with Undo lead under the player, wire removal made obvious (hover or tap → "✕ Remove"; on touch tap to select then tap to remove; a wrong lead comes pre-selected).
- Beauty-pass backlog from Wave 2: dark ink dots where a lead's cable pieces join; the leads' side loops around the meter cases; the phone bench shot is a thin strip; the entrance line is about 7.5 s (target 5 s); no "3/11 · step" prefix on the caption; plug beats have no nib taps; Watch uses the meters shot, not the loupe; graph pop-ups no longer open by themselves on the plot steps.
- [ ] 2c: hero (SHOULD)
