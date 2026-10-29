# 09 · Build Plan: Pre-Hackathon Prep and the 10 Days

*Replaces section 8 of the original spec. Times are WAT. Scope as decided on Oct 22: **metre bridge hero, titration second, glass block stretch** (design in `15_METRE_BRIDGE_HERO.md`). **Changed Oct 28 (user's choice):** a hands-on **Ohm's law (V–I)** practical comes before the titration engine, and the whole app moves to an ink-and-paper look (`docs/plans/ohms-law-vi.md`, `docs/plans/ink-look.md`). Our submission target is **18:00 WAT on Wed Nov 4**; the official cutoff is 03:00 WAT on Thu Nov 5.*

---

## 1. Cut lines

**MUST (this is the demo):**
- Snap → 3D metre bridge bench, live and as golden replay
- Local-first reveal choreography (page flattens, ink glows and lifts, apparatus materialises)
- Metre bridge engine: circuit solve, tap-to-contact jockey, centre-zero galvanometer with damped needle and slam, current-flow particles from the solved currents, plug resistance box, key with Leclanché polarisation, scrape on drag, metre-rule parallax (gyro on phones, slider on laptops)
- Wonder reads her table **and graph** → deterministic Rule Engine (PHYS-1DP, PHYS-3SF, PHYS-TABLE, GRAPH-*, PRECAUTIONS with the tense check) → red-ink marking on her page, item by item
- "Show the AI" drawer with real per-model timings
- Golden notebooks G1 (flawed metre bridge) and G2 (clean metre bridge) with recorded event streams
- Deployed URL with rate limits, spend cap and `DEMO_MODE`
- The 2:30 video

**MUST (added Oct 28, by Fri Oct 30):** the ink-and-paper look on every canvas (outline pass, paper desk, no bloom, low-tier fallback); the Ohm's-law bench (`?learn=ohms-law`): MNA engine with the modelled mistakes, apparatus, tap-to-wire leads, the corrected diagram, meters and loupes, her typed table, DRAFT marking of the table, precautions and part (b), guided mode end to end.

**SHOULD:**
- Ohm's law, the rest: graph and slope sheet, Identify mode, the Why / Precautions / Examiner tabs, exam mode, callouts, tightening and sandpaper, zero error, the hero's draw-on reveal; restyle of the existing screens (Muse Code)
- Titration second act (kit preview exists; engine and marking moved to COULD on Oct 28): engine (charge-balance pH, indicators), kit, hold-to-drip, swirl, colour, overshoot; marking (2 d.p., concordance, rough titre, units, mole ratio); golden page G3
- Examiner questions (push-to-talk voice + typed fallback + browser voice)
- SAM outlines, including the graph mask for GRAPH-SCALE (fallback: Spark's approximate box)
- Quality tiers, Lite mode, PWA offline
- Teacher mode (teacher's value for PHYS-ACCURACY and titration accuracy)

**COULD:**
- Titration engine and marking (moved from SHOULD on Oct 28)
- Ohm's law extras: baked step thumbnails, drag-from-tray leads, rheostat and micrometer detail, no-WebGL learn fallback, live examiner judging
- Titration indicator trap (phenolphthalein with carbonate) and burette parallax
- Glass block (pins rising, beam refraction, trace marking)
- Potentiometer mode (same wire and solver, doc 07 §4.3)
- Interchange R and X animation with averaged end correction
- Muse Image reality preview; Wonder end-of-practical report; Spark 1.2 Pidgin audio path
- MediaPipe gestures on laptop (video flourish only; never for the jockey, since sliding is the mistake)

**Exam practical (Oct 29, `docs/plans/exam-redesign.md`).** The cut lines below replace the Day 5–8 rows for this work.
- **MUST (by the end of Nov 1):**
  - the picker; the question paper with read-aloud and the entrance;
  - Watch end to end, with player controls and callouts;
  - guided Practise end to end;
  - the results with the reading check (D1);
  - the look recipe on the V–I lab (camera, lights, shadows, ink, apparatus v2, ground);
  - the E2E scripts.
- **SHOULD (Nov 2):**
  - Exam polish (timer display);
  - the hero look (W2-hero);
  - sounds;
  - the DPR ladder and the demand frameloop;
  - the cached ground;
  - baked step thumbnails (with an ink-icon fallback).
- **COULD:**
  - the D3 viva with Muse Spark;
  - the "as printed" diagram beside ours;
  - merged static geometry;
  - focus fade on the hero.
- **Later:** metre-bridge Watch/Practise, titration, Variant B.

**WON'T (this hackathon):** free-form circuits from arbitrary drawings (we use the standard metre bridge template; her drawing feeds setup issues only), lens optics, live AR tracking, WebGPU, Rust/WASM, Postgres/Redis/R2/Python, continuous listening, 120 FPS claims.

## 2. Pre-hackathon: Oct 21–25 (generic scaffolding allowed from Oct 22; no git)

| Day | Do | Why |
|---|---|---|
| **Today, Oct 21** | Confirm your acceptance and that applications are complete. Log in to dev.meta.ai **from Nigeria**, create a key, make one manual test call, check the credit balance. Read the API docs (structured output, SAM, realtime voice). | The API launched as US-only; find out now, not on Day 1. |
| Oct 21–22 | **Permissions:** written parental/guardian consent and the student's assent for anyone under 18 on camera, or film hands only; written permission from a principal before filming in a school. | Minors and schools; legal and ethical. |
| Oct 22–24 | **Golden pages** (exact content in doc 11): (G1) Amina's metre bridge with deliberate WAEC errors ("57", "0.02", no units on l⁻¹, a small graph, a small slope triangle, precautions in the wrong tense, no key drawn); (G2) the same page done correctly; (G3) Amina's titration with "24.5" and the rough titre averaged. Graph pages on real graph paper. Glass block (G5) only if time. Plus 2–3 genuinely messy real student pages. | These become the golden demos and the video's hero. |
| Oct 21–24 | **Photo dataset:** 30+ photos of notebook pages (titration, glass block, other drawings) in different biros, light, angles and phones, including a Tecno/Infinix, and **10+ metre bridge pages with their graphs**. | The Day-1 spike runs on these. |
| Oct 22–24 | **Audio dataset:** 10–20 short spoken answers to examiner questions in Nigerian English, Pidgin and mixed, from consenting adults. | Tests Voice Transcribe on Day 1. |
| Oct 22–25 | **Video B-roll** (shot list in `10_DEMO_AND_SUBMISSION.md`): biro drawing the circuit and the metre bridge, writing "57", plotting the graph, snapping, tilting the phone, a real metre bridge and galvanometer in a school lab if a school allows it, Kubwa establishing shots, room tone, you at your desk. | Shoot in good window light now; the last two days are for editing. |
| Oct 23 | Check the real price of an exercise book in a Kubwa shop (the spec's "₦200" is unverified). | Every number on screen must be true. |
| Oct 23–25 | **Accounts:** GitHub, Cloudflare Pages, Fly.io (or Railway / Cloud Run), a domain. Install **Muse Code** (`curl -fsSL https://dev.meta.ai/install.sh \| sh`) and Claude Code. | No setup friction on Day 1. |
| Oct 23–25 | **Hardware and power:** a low-end Android test phone, access to an iPhone, UPS/inverter, power banks, two data SIMs. | Real-device testing; outages. |
| Oct 24–25 | **Learn by reading** (not writing project code): R3F render loop patterns, `TubeGeometry` for wires, `LatheGeometry`, drei `PerformanceMonitor` and `Lightformer`, selective bloom, Hono SSE, the Meta realtime voice handshake. Sketch bench layouts and the blueprint schema on paper. | Faster Days 1–3. |
| **Oct 25–26** | **Read the Official Rules** the moment they appear (pre-existing code, assets, data, video length, repo visibility). Adjust this plan if needed. | Disqualification risk. |
| Oct 23–25 (optional) | One social post: a photo of the drawn page, "Next week this exercise book from Kubwa becomes a lab." | Warm up an audience; idea only, no code. |

## 3. The 10 days

| Day | Date | Deliverable | Exit criterion |
|---|---|---|---|
| **1** | Mon Oct 26 (kickoff 17:00) | Scaffold the repo (Vite + R3F web, Bun + Hono api, shared engine/rules/contracts). **Day-1 spike** (`06_META_AI_INTEGRATION.md` §6) on the photo and audio datasets; save all responses as fixtures. Decide SAM Plan A/B/C. **Deploy hello-world** frontend and API with secrets. | A deployed URL exists; a written table of model quality and latency. |
| **2** | Tue Oct 27 | Capture flow: preview, corner finder, handles, homography, shader rectify + ink mask, compression, header blur. **Metre bridge engine** (3-node solve, balance, galvanometer dynamics, polarisation, scrape) + tests (lead writes it; science-verifier checks it). Procedural metre bridge kit (wooden base and metre rule, wire, jockey, brass plug box, centre-zero galvanometer, Leclanché cell, plug key, tube wires). | Photo → flat textured page on a 3D desk with the static bench; engine tests green. |
| **3** | Wed Oct 28 | `/api/snap` SSE pipeline (Spark compile ∥ SAM ∥ Wonder table + graph), validation and clamps, blueprint → template bench. **Reveal choreography** (ink glow, lift, particles, dissolve). Hash cache; **golden recording and replay**. | A real snap → animated bench on the deployed URL; golden replay works offline. |
| **4** | Thu Oct 29 | Interaction: tap-to-contact jockey, needle swing and slam, **current-flow particles** with the galvanometer branch going still at balance, plug box, key and polarisation, scrape on drag, metre-rule parallax with a loupe. Lab notebook of readings. Sounds (click at null). | Finding the null feels real on a laptop and a phone. |
| **5** | **Fri Oct 30** | **MILESTONE.** Rule Engine (PHYS-1DP, PHYS-3SF, PHYS-TABLE, GRAPH-AXES/SCALE/POINTS/LINE/SLOPE/INTERCEPT, PHYS-EVAL, PRECAUTIONS with the tense check) + readings and graph confirmation + **red-ink overlay on her table and graph** + score by scheme items. "Show the AI" drawer. Quality tiers. Test on the iPhone and the low-end Android. **Record a rough backup video today.** | **A stranger uses the URL on their phone, unaided, reaches the red ink, and says "wow".** If not, Day 6 fixes this instead of starting titration. |
| **6** | Sat Oct 31 | **Changed Oct 28:** Ohm's law Wave 3 (graph and slope sheet, lesson content and Identify cards, the hero's draw-on reveal) and the Muse Code restyle. *Was:* Titration second act: engine (charge-balance pH, indicators) + tests, kit (burette, flask, stand, tile), hold-to-drip, swirl, indicator colour, overshoot. Golden titration page G3. | Snap G3 → working titration bench. |
| **7** | Sun Nov 1 | **Changed Oct 28:** Ohm's law integration B (exam mode, Identify, graph in the flow, Examiner tab, no-leak check, visual QA). *Was:* Morning: titration marking rules (2 d.p., concordance, rough titre, units, mole ratio) on the existing red-ink overlay. Afternoon and evening: examiner questions (mic AudioWorklet → WS relay → Voice Transcribe; Spark turns with the WAEC persona and question bank; captions + browser voice; typed fallback; Pidgin/English/Mixed). | G3 is marked; a three-question exchange works on desktop Chrome and iPhone Safari, and by typing everywhere. |
| **8** | Mon Nov 2 | **Beauty pass** (lighting, ink lines, ink-and-paper UI, transitions). PWA offline. Lite mode. Teacher mode. COULD items only if everything is green (indicator trap, glass block, potentiometer mode, reality preview). A Nigerian **physics and chemistry** teacher reviews the golden runs. **Feature freeze at 23:59.** | Nothing new after this. |
| **9** | Tue Nov 3 | Bug bash across devices (desktop Chrome/Safari, iPhone, low-end Android, in-app browsers) and networks (MTN, Airtel, a US VPN). Rate limits, spend cap, kill switch tested. gitleaks; README; architecture diagram. **Final screen captures, voiceover and edit of the 2:30 video**; social cuts. | Final video exported; repo public and clean. |
| **10** | Wed Nov 4 | Buffer only. Final deploy; verify golden mode; **submit by 18:00 WAT**. Launch posts ~15:00 WAT after submitting. Keep `DEMO_MODE=auto` and monitor credits through Nov 9. | Submitted with 9+ hours of margin. |

## 4. Rules for the solo build
1. Develop against recorded fixtures so outages don't block you.
2. Deploy continuously from Day 1; a working build is always online.
3. **No git commits before kickoff (Oct 26, 17:00 WAT).** The repo is created and first committed at kickoff; from then on, commit and push several times a day (this also proves "built during the hackathon"). Since Oct 22, a **generic scaffold** (Day-1 prompt steps 1, 3, 4) may be built locally before kickoff; SnapLab-specific features wait for kickoff and the Official Rules.
4. Never start a SHOULD while a MUST is shaky.
5. The golden replay is a feature, not a cheat: present it as "offline demo mode for low-connectivity schools", which is true and on-theme.
6. Keep a short daily build log; it becomes the README's "Built during the hackathon" section and your social posts.
