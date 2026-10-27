# 01 · Hackathon Brief: What We Are Playing For

*Researched 2026-10-21. **Updated 2026-10-26 from the official Participant Guide** (cerebralvalley.ai/e/meta-ai-developer-hackathon/details, visible only to logged-in participants; jephthah pasted the full text into the project). Every fact is labelled. **OFFICIAL** means it is in the Participant Guide. **VERIFIED** means read on another official Meta or Cerebral Valley page. **REPORTED** means a single secondary source. Older research notes are in `research/01_hackathon.md`.*

---

## 0. What the official rules changed (Oct 26)

| # | Rule (OFFICIAL) | What it means for us |
|---|---|---|
| 1 | **New work only.** "What you present at this Hackathon must have been built during the event." Only startups may build on existing code. The demo "must only highlight the specific features, code, and functionality that you built during the Hackathon", and judges must be able to tell what was built during it, or the project is disqualified. The guide lists the **building period as Oct 27 – Nov 4**; kickoff is Oct 26, 12:00 PM ET (5 PM WAT). | **Biggest risk.** All 13 commits on `main` (PRs #1–#12: the 3D kit, engine, contracts, capture, ink shader, Meta API check, drawer) are timestamped Oct 26, 11:05–13:56 WAT, which is **before kickoff**. Ask Cerebral Valley in Discord `#questions` and follow their answer. Never alter commit dates. **Decided Oct 26:** keep this repo (now public), tag the last pre-kickoff commit `pre-kickoff`, and list that work in the README's "What was built before the hackathon began" section. |
| 2 | **Repositories must be public.** Submission needs a public repo, an accessible video link, and every contributor listed. | As planned. Make the repo public before submitting. |
| 3 | **Three-minute demo video** that highlights what was built during the hackathon. Judges use it alongside the code and the live product. | Our script runs to 2:45. Fine. |
| 4 | **Must use Meta's models.** Stage One of judging is pass/fail on theme fit and use of the Meta Model API or Meta open-weight models. Muse Voice Transcribe and the open-weight models **Muse Glimmer** and **Muse Spark Open** are now named. | We use five Model API models. We pass. |
| 5 | **Judging weights confirmed:** Impact 30%, Use of Meta AI Tooling 25%, Technical Depth & Execution 20%, Demo 25%, each scored 0–10. Top 5 per track go to a live final on Nov 9. | Matches what we planned for. "Did they surface capabilities that surprised even us?" rewards the visible "Show the AI" drawer. |
| 6 | **Anti-projects** (disqualified as generic) include *Simple Image Analyzers* and *simple "AI for Education" chatbots*. | We are neither, but the first 10 s of the video and the submission summary must show the 3D lab and the engine, not "an AI tutor that reads photos". |
| 7 | **Banned:** using "code, data, or assets you do not have the rights to". | Golden pages are our own handwriting (fine). Quote WAEC Chief Examiner reports briefly with citations; do not ship WAEC past-paper scans, logos or official styling. Footage needs consent. |
| 8 | **Bonus prizes ($50K) are real** (see §1). Most Viral Project ($20K) is judged on X engagement up to Nov 8 EOD, and the X post link is submitted through the platform. | Post the demo on X right after submitting and submit the link. Best Creative Build ($5K) covers Muse Wonder, so we may qualify automatically. |
| 9 | **API credits must be claimed** through a form by Nov 4, 9 PM ET. A card must be on file, and the spend limit is only a notification: spending past $150 is charged. | jephthah claims the credits; watch the Billing page. |
| 10 | Community vote runs until **Nov 16**. | Keep the live link up through Nov 16, not Nov 9. |

## 1. The event at a glance

| Item | Fact | Status |
|---|---|---|
| Name | Meta Global AI Developer Hackathon | VERIFIED |
| Organisers | Meta, with Cerebral Valley running applications and the platform | VERIFIED |
| Format | Virtual, worldwide, up to 20,000 accepted builders | VERIFIED |
| Nigeria eligible? | Yes. Nigeria is not on the excluded-countries list | VERIFIED |
| Team size | Max 4. Solo allowed. One "Representative" submits | OFFICIAL |
| Problem statements | **Build for Your World** (a problem you know first-hand) or **Push the Frontier**. The project must build toward one | OFFICIAL |
| Indie track ($400K) | 1st $150K, 2nd $100K, 3rd $75K, 4th $50K, 5th $25K | OFFICIAL |
| Startup track ($550K) | 1st $250K, 2nd $150K, 3rd $75K, 4th $50K, 5th $25K | OFFICIAL |
| Bonus prizes ($50K) | Most Viral Project $20K (X engagement to Nov 8 EOD; submit the post link) · Best Build on Meta Open Weight Models $10K (Muse Glimmer or Muse Spark Open) · Community Vote $10K (public gallery, winner Nov 16) · Best Agentic Use-Case $5K · Best Creative Build $5K (Muse Image or Muse Wonder) | OFFICIAL |
| Credits | $150 Meta Model API credits, claimed individually through a form by Nov 4, 9 PM ET. Optional partner credits: Baseten $100 (use `meta-models/muse-spark-open-1026`), Modal $100, Fireworks $25 | OFFICIAL |

Official pages: https://cerebralvalley.ai/e/meta-ai-developer-hackathon (guide at `/details`, login needed) and https://dev.meta.ai/events/global-hackathon

## 2. The clock (Abuja time, WAT = UTC+1)

| Milestone | Official (ET) | Abuja (WAT) |
|---|---|---|
| **Kickoff livestream** | Mon Oct 26, 12:00 PM ET | **Mon Oct 26, 5:00 PM** |
| Building period | Oct 27 – Nov 4 | |
| Live sessions | Oct 27, 28, 30, 12:00–1:00 PM ET | 5:00–6:00 PM |
| Discord office hours (weekdays, `#office-hours`, text only) | 10–11 AM ET | 3–4 PM (4–5 PM after Nov 1) |
| Last day for submission questions | Tue Nov 3 | |
| **Submission deadline** | **Wed Nov 4, 9:00 PM EST** | **Thu Nov 5, 3:00 AM** |
| Judging | Nov 5 – Nov 8 | |
| Closing ceremony, top 10 (5 per track), live final judging, winners | Mon Nov 9, 12:00 PM ET | Mon Nov 9, 6:00 PM |
| Community vote winner | Mon Nov 16 | |

US daylight saving ends on Nov 1, so 9:00 PM EST on Nov 4 is **3:00 AM WAT on Nov 5**. Our own target stays **6:00 PM WAT on Nov 4**.

## 3. How we will be judged (OFFICIAL)

**Stage One (pass/fail):** does the project reasonably fit a problem statement, and did it reasonably use the Meta Model API or Meta's open-weight models during the hackathon?

**Stage Two (0–10 per criterion):**

| Criterion | Weight | Official question | What it means for SnapLab |
|---|---|---|---|
| Impact | **30%** | Real-world potential? Who benefits, and how much? Could people actually use it? Fits a problem statement? | WAEC practicals, ≈1.95 M WASSCE candidates in 2026, Kubwa, Build for Your World. |
| Use of Meta AI Tooling | **25%** | How creatively? Beyond a basic integration? Capabilities that "surprised even us"? | Each model does a distinct, visible job in the "Show the AI" drawer. Creative use beats model count. |
| Technical Depth & Execution | **20%** | Sound, refined engineering, real craft? | The deterministic engine and rule table, tested against textbook values. |
| Demo | **25%** | Working and impressive? Holds up live? Video "genuinely cool to watch"? | The video and the live link. |

**Stage Three:** the top 5 per track are re-ranked by final judges who watch the videos live, using the same rubric.

The Indie track's one-line lens is still *"creativity, technical ambition, and whether it works"* (VERIFIED).

## 4. Submission rules (OFFICIAL)

1. Submit on the Cerebral Valley platform by **Nov 4, 9:00 PM EST**. Late entries are not considered.
2. A **three-minute demo video** highlighting what was built during the hackathon (we target 2:30, hard cap 3:00). The video link must be publicly accessible.
3. A **public repository**.
4. Everyone who worked on the project is listed (solo: just jephthah).
5. **New work only**, and judges must be able to clearly identify what was built during the hackathon. See §0 row 1.
6. Not an anti-project, and nothing we lack the rights to (§0 rows 6 and 7).
7. Optional: the X post link for the Most Viral Project prize.

**IP (REPORTED):** you keep ownership, but grant Meta and the organisers a perpetual, royalty-free licence to use the submission, and recordings of you may be used without payment.

## 5. Required Meta tooling (OFFICIAL)

"Your project must incorporate Meta's models": the Muse Spark series, Muse Wonder, Muse Image, Muse Voice Transcribe and SAM 3.1 through the Meta Model API; the open-weight models Muse Glimmer and Muse Spark Open; and the Muse Code coding agent.

SnapLab uses SAM 3.1, Muse Spark, Muse Wonder, Muse Image and Muse Voice Transcribe, and builds with Muse Code. See `06_META_AI_INTEGRATION.md`. We use no open-weight model, so the $10K open-weight bonus is out of reach unless we add one (not planned).

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
