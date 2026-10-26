# 01 · Hackathon Brief: What We Are Playing For

*Researched 2026-10-21. Every fact is labelled. **VERIFIED** means read on an official Meta or Cerebral Valley page. **REPORTED** means a single secondary source. **UNVERIFIED** means no source supports it. Full research notes with every URL are in `research/01_hackathon.md`.*

---

## 1. The event at a glance

| Item | Fact | Status |
|---|---|---|
| Name | Meta Global AI Developer Hackathon | VERIFIED |
| Organisers | Meta, with Cerebral Valley running applications and the platform | VERIFIED |
| Format | Virtual, worldwide, 10 days, up to 20,000 accepted builders | VERIFIED |
| Nigeria eligible? | Yes. Nigeria is not on the excluded-countries list | VERIFIED |
| Prize pool | $1,000,000 total, split across two tracks | VERIFIED |
| Tracks | **Indie Developer** ("for individual builders and students") and **Startup** | VERIFIED |
| Themes | **Build for Your World** (bring Meta's models into a problem you know first-hand) and **Push the Frontier** | VERIFIED |
| Indie split | $400K: 1st $150K, 2nd $100K, 3rd $75K, 4th $50K, 5th $25K | REPORTED (screenai.es, citing the application agreement) |
| Extra $50K | "Organisers may distribute up to another $50,000 in additional prizes." No criteria given | REPORTED |
| "Community/viral bonus for tagging @MetaAI" | Nothing supports this | **UNVERIFIED. Do not plan around it.** |
| Credits | $150 of Meta Model API credits per participant. Some participants also get Baseten $100, Modal $100, Fireworks $25 | VERIFIED (Meta for Developers post) |
| Official Rules | Due "before October 26". Not published as of Oct 21 | **Read them the moment they appear** |

Official pages: https://dev.meta.ai/events/global-hackathon and https://cerebralvalley.ai/e/meta-ai-developer-hackathon

## 2. The clock (Abuja time, WAT = UTC+1)

| Milestone | Official (ET) | Abuja (WAT) |
|---|---|---|
| Applications close | Sat Oct 25, 11:59 PM ET | Mon Oct 26, 4:59 AM |
| Acceptance emails | Oct 26, 9:00 AM ET | Oct 26, 2:00 PM |
| **Kickoff livestream** | Oct 26, 12:00 PM ET | **Mon Oct 26, 5:00 PM** |
| Workshops and Discord office hours | Oct 27 to Nov 4 | |
| **Submission deadline** | **Wed Nov 4, 9:00 PM EST** | **Thu Nov 5, 3:00 AM** |
| Judging | Nov 4 to Nov 8 | |
| Live finals and winners | Nov 9 | |

> **Correction to the spec:** the spec says the deadline is 2:00 AM WAT. US daylight saving ends on Nov 1, so 9:00 PM EST on Nov 4 is **3:00 AM WAT on Nov 5**. Our own target stays **6:00 PM WAT on Nov 4**, nine hours early.

## 3. How we will be judged

**The only official wording (VERIFIED):** the Indie track is *"judged on creativity, technical ambition, and whether it works."*

**Reported weights (REPORTED, one source citing the agreement):**

| Criterion | Weight | What it means for SnapLab |
|---|---|---|
| Impact | **30%** | The biggest slice. A real problem (WAEC practicals), real numbers (≈1.95 M WASSCE candidates in 2026), a real place (Kubwa). |
| Use of Meta AI tools | **25%** | Each Meta model must do a distinct, visible, non-decorative job. More models do not mean more points; *creative* use does. |
| Demo quality | **25%** | The video and the live link. Judges usually watch the video first and often only the video. |
| Technical depth and execution | **20%** | Ambition that **works**. A broken Rust/WebGPU stack scores lower than a polished WebGL one. |

These weights match Cerebral Valley's house template. Its Feb 2026 "Built with Opus 4.6" hackathon used Demo 30 / Impact 25 / Model use 25 / Depth 20, with async judge scoring followed by top-6 finalists presenting pre-recorded 3-minute demos.

**Translation:** *Impact + Demo = 55%.* The spec spends most of its effort on the 20% (technical depth) and on parts judges cannot see. This plan flips that.

## 4. Submission rules we expect (prepare for the strictest version)

The official rules are not out. Cerebral Valley's previous virtual hackathon required all of the following, so we assume the same until told otherwise:

1. A demo video of **3 minutes maximum** (we target 2:30).
2. A **public GitHub repo**, open source, with setup instructions.
3. A 100 to 200 word summary.
4. **"All projects must be started from scratch during the hackathon. Pre-existing work is not allowed."**
5. Track selection: Indie. Theme: Build for Your World.

> ⚠️ **Rule we must respect now:** write **no application code before kickoff on Oct 26**. Planning documents, photographs of notebooks, video B-roll, API keys and reading the docs are almost certainly fine. Re-check the Official Rules on Oct 25 to 26 for clauses about pre-existing code, assets and data.

**IP (REPORTED):** you keep ownership, but grant Meta and organisers a perpetual, royalty-free licence to use the submission, and recordings of you may be used without payment.

## 5. Required Meta tooling

The event page says to build with Meta's models via the **Meta Model API**: **Muse Spark series, Muse Wonder, Muse Image and SAM 3.1**, plus Meta's open-weights models and the **Muse Code** coding agent (VERIFIED). **Muse Voice Transcribe** is a real API model but is not named on the event page.

SnapLab uses all four named models plus Voice Transcribe, and builds with Muse Code. See `06_META_AI_INTEGRATION.md`.

> ⚠️ **Region check, do it today:** the Meta Model API launched in July 2026 as a US-only public preview. The current geographic policy neither lists Nigeria as enabled nor blocks it. Log in at dev.meta.ai **from Nigeria** and confirm you can create a key and make one call before Oct 26.

## 6. What has won before (pattern to copy)

| Event | Winner | Why it matters to us |
|---|---|---|
| LlamaCon Hackathon 2025, Best Llama API Usage | **Geo-ML**: 400-page geology reports turned into structured data and 3D subsurface models | Closest precedent to SnapLab's *document → structured blueprint → 3D* architecture |
| Llama Impact Grants | **Twiga** (Tanzania): curriculum-aligned exams for teachers | Education + Africa won with Meta before |
| Llama Impact Accelerator SSA 2025 (Nigeria) | **DAWN AI Study**, 3rd: early-learner assessment | Nigerian education project placed |
| CV "Built with Opus 4.6", Feb 2026 | **Elisa** (2nd, kids' coding) and **TARA** (Uganda, special prize) | Same organiser; domain experts with a tight demo won; 4 of 5 winners were not professional developers |
| Llama Impact Hackathon London 2024 | NHS triage assistant, robotic arm, pharmacist app | Practical, domain-specific, multimodal |

**Common traits of winners:**
1. The builder knows the problem first-hand ("Build for Your World").
2. A working, live-feeling demo with a tight 3-minute story.
3. Multimodal input (vision or documents) turned into structured output.
4. A public repo and a recorded video.
5. A clearly named group of people who benefit.

## 7. What this means for SnapLab (the five rules we design by)

1. **One flawless path beats three half-built ones.** "Whether it works" is literally a judging criterion.
2. **The video is the product for judging.** Budget about 25% of the 10 days for the video and the 60-second judge path.
3. **Show the AI working.** Every Meta model gets a visible job, timed and labelled on screen.
4. **Every number is sourced.** Remove "70% of schools", "99% accuracy", "120 FPS" and prize figures from anything a judge sees.
5. **The live link must never fail.** Golden replays, rate limits, a spend cap and an offline mode are features, not afterthoughts.
