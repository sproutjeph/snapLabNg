# SnapLab NG · Winning Plan (Docs Index)

*Prepared 2026-10-21 for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026, Indie Developer track, theme "Build for Your World"). Planning only: no code is written before kickoff. The original spec, `SNAPLAB_NG_MASTER_ARCHITECTURE.md`, is left unchanged one folder up; these documents supersede it.*

---

## Executive summary

**The idea wins; the original plan would not.** "Your exercise book becomes your lab, and an AI examiner marks your own handwriting" is creative, personal and exactly on theme. But the spec built a 6-week team system solo, spent most effort on parts judges never see, had science errors a teacher would catch (a glowing constantan wire, carbonate treated as hydroxide, invented WAEC penalties, a WAEC viva that doesn't exist), and had API bugs that would silently break the AI pipeline.

**The winning version:**
1. **Hero: the metre bridge** (decided Oct 22, from `image.png`), flawless end to end: snap the page → brass and Bakelite rise out of the ink → real physics (tap the jockey, the centre-zero needle swings through zero, current you can watch, a scraped wire if you drag) → **the Chief Examiner red-inks her own handwritten table and graph**, item by item, with WAEC sources → three spoken examiner questions in English or Pidgin. Design: doc 15.
2. **Second act: titration** (drip, colour, overshoot, "24.5" marked). The glass block is a stretch item.
3. **"The AI reads and judges. The engine decides."** Five Meta models, each with one visible job (Spark compiles and questions, SAM outlines, Wonder reads handwriting, Voice Transcribe listens, Image previews), shown live in a "Show the AI" drawer. The science and the marks are deterministic and reproducible.
4. **Nothing is a bottleneck:** local-first animation, parallel and streamed AI calls, speculative handwriting reading, cache, and recorded golden replays that work offline.
5. **One language, one bundler, one renderer, one server:** TypeScript, Vite, WebGL2 (React Three Fiber), Bun + Hono. Rust/WASM, WebGPU, OpenCV.js, Postgres, Redis, R2 and Python are cut.
6. **Demo-able by Day 5**, feature freeze Day 8, submit **18:00 WAT Nov 4** (official cutoff 03:00 WAT Nov 5).

## Read in this order

| # | Document | What it answers |
|---|---|---|
| 01 | [Hackathon brief](01_HACKATHON_BRIEF.md) | Dates, tracks, judging criteria and weights, required Meta tooling, rules risk, past winners |
| 02 | [Spec critique](02_SPEC_CRITIQUE.md) | What the original spec gets right and wrong, section by section |
| 03 | [Product and experience](03_PRODUCT_AND_EXPERIENCE.md) | The story, hero user, scope, the six moments, judge path, inclusion |
| 04 | [Architecture](04_ARCHITECTURE.md) | How everything fits: six stages, components, data contracts, latency budget, reliability |
| 05 | [Tech stack](05_TECH_STACK.md) | Every layer, why, what was cut, performance budgets, iOS realities |
| 06 | [Meta AI integration](06_META_AI_INTEGRATION.md) | Each model's job, verified API facts, the 14 places the spec would break, call designs, Day-1 spike |
| 07 | [Science engine and WAEC rules](07_SCIENCE_ENGINE.md) | Correct titration, glass-block and meter-bridge models; verified WAEC rule table; examiner question bank |
| 08 | [Risks and mitigations](08_RISKS_AND_MITIGATIONS.md) | Top 16 risks and the bottleneck map |
| 09 | [Build plan](09_BUILD_PLAN.md) | Cut lines, pre-hackathon prep (Oct 21–25), day-by-day plan |
| 10 | [Demo and submission](10_DEMO_AND_SUBMISSION.md) | 2:30 video script, footage shot list, judge link, README structure, verified impact numbers, social plan, self-scoring checklist |
| 11 | [Golden pages guide](11_GOLDEN_PAGES_GUIDE.md) | Exactly what to draw on the demo pages (with the mistakes the examiner must catch), how to photograph them, the 30+ photo and audio test set |
| 12 | [Day-1 test sheet](12_DAY1_TEST_SHEET.md) | The access check to do now, and the Day-1 measurements that decide the pipeline |
| 13 | [Kickoff prompt](13_KICKOFF_PROMPT.md) | The Day-1 prompt for Claude Code, prompt starters for Days 2–7, and the first-commit steps |
| 14 | [Agent harness](14_AGENT_HARNESS.md) | How Claude Code builds it: CLAUDE.md, 7 subagents and which model does what, hooks, rules, skills, setup |
| 15 | [Metre bridge hero](15_METRE_BRIDGE_HERO.md) | **Read first.** The Oct 22 scope change: why the metre bridge leads, what beats the image, the golden question and its marking scheme, WAEC sources |
| — | `research/` | The six raw research reports, with every source URL |

## Do these before Oct 26

1. **Confirm a Meta API key works from Nigeria** (the API launched as a US-only preview). Check your credits.
2. **Scaffold locally if you like (changed Oct 22), but keep it generic boilerplate** (repo layout, tooling, hello-world). Build the SnapLab-specific features after kickoff, and check the Official Rules on pre-existing work as soon as they're out.
3. **Draw the golden pages** (metre bridge G1 and G2 with graph sheets, titration G3; doc 11) and **photograph 30+ notebook pages**; record 10–20 spoken answers (consenting adults).
4. **Get consent** for anyone under 18 on camera, or film hands only; principal's permission to film in a school.
5. **Shoot the B-roll** in `10_DEMO_AND_SUBMISSION.md` §3.
6. **Get a low-end Android test phone**, iPhone access, backup power and two data SIMs.

## Project rules

- **Rule (set Oct 21): no git commits before kickoff.** Everything stays local until Oct 26, 5:00 PM WAT; the repo and its first commit start at kickoff.
- **Rule (set Oct 22): no AI attribution in commits or PRs.** No `Co-Authored-By: Claude`, no "Generated with Claude Code", no session links. The author is jephthah alone. Enforced by `.claude/settings.json` (`attribution`), the guard hook and `.githooks/commit-msg`.
- **Rule change (Oct 22): local scaffolding is allowed before kickoff;** git still is not. The guard hook blocks `git init`, commits and pushes until Oct 26, 17:00 WAT (doc 14). The first commit happens at kickoff.

## Verified vs unverified (how to read numbers in these docs)
**VERIFIED** = read on an official Meta, Cerebral Valley or WAEC page, or a cited reference. **REPORTED** = one secondary source. **UNVERIFIED** = no source; never shown to judges.
