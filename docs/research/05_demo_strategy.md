# SnapLab NG: Demo, Story and Submission Strategy

*Prepared 2026-10-21 for the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026). Indie Developer Track, theme "Build for Your World".*

> **TL;DR (opinionated)**
> 1. **Pick one experiment and make it bulletproof: acid–base titration.** Defer the meter bridge and cut ray optics. Titration's colour change reads instantly to a San Francisco judge, it is the experiment WAEC Chief Examiners complain about in writing, and the AI only has to find 2–3 objects in a drawing instead of working out how the wires in a circuit sketch connect.
> 2. **The hero is "your own page, marked like WAEC".** A student's exercise-book page goes in: the titration diagram plus her handwritten results table. Two things come out: a lab she can run, and her own page marked in red ink by an AI Chief Examiner, followed by a short viva in Nigerian English or Pidgin. The 3D "rising out of the paper" effect is the *hook*. The marking is the *product*.
> 3. **The video does almost all the judging.** Spend about 25% of the 10 days on the 2:30 video and the 60-second judge path, not on Rust/WASM, WebGPU, hand tracking or AR homography.
> 4. **Show every Meta model doing visible work** in a "Show the AI" pipeline drawer with real timings. Keep the principle *"the AI reads and judges; the physics engine decides what happens"* front and centre so the AI never looks like a gimmick.
> 5. **Strip every unverifiable claim from the spec before it reaches a judge.** That includes "70% of students have no lab", "99% accuracy", "120 FPS", "$150K first prize" and "$50K viral pool". Replace them with the numbers verified in section 6.

---

## 0. What the research changed (read first)

| Spec assumption | What I found | Action |
|---|---|---|
| Indie 1st prize $150K, $50K community/viral bonus | The official event page lists **only a $1M total split across two tracks**. It gives **no per-place breakdown and no bonus pool**. The page says official rules come "before Oct 26". [Cerebral Valley event page] | **Unverified.** Don't plan more than ~10% of effort around a viral pool until the rules confirm it. |
| Indie judging criteria | The official page says the Indie track is judged on **"creativity, technical ambition, and whether it works."** | Shape everything around these three. "Whether it works" means the live link must not break. |
| Muse Voice Transcribe supports Pidgin, with vocabulary biasing | Launch coverage says **70+ languages trained, 25 validated, with code-switching inside a sentence and streaming in 80 ms chunks, at $3 per 1,000 minutes**. **Pidgin is not named, and custom-vocabulary biasing is not documented.** The LiteLLM docs list it as **realtime-only** (`wss://api.meta.ai/v1/asr/realtime`) and say batch `/audio/transcriptions` is not supported. | **Test Pidgin on Day 1** with 10 recorded clips. Fallback: Nigerian English with Pidgin code-switching. Muse Spark can still *reply* in Pidgin. Drop the "99% accuracy" claim. |
| Examiner "speaks" | **I found no Meta text-to-speech model.** The voice suite announced at Connect is speech-to-text only. | The examiner's voice uses browser `speechSynthesis` (label it as such) or text only. Never dub a human voice and present it as AI. |
| `muse-wonder-1.0` model id | Muse Wonder launched about Oct 13–15, 2026. It takes text, image, audio and video input, has a 1M-token context, is priced at **$4 / $20 per M tokens**, and is on the public API. **Muse Wonder Full is not on the API.** Model ids were not published in the articles. | Confirm exact ids on dev.meta.ai on Day 1. |
| SAM 3.1 finds "resistor" and "burette" in biro sketches | SAM 3.1 is on the Responses API as `sam-3.1`: a short noun phrase plus an image returns boxes and masks. It is documented on *photos/video*. Results depend on contrast and prompt specificity, and **an empty result is normal behaviour**. Performance on line drawings is **unverified**. | **Highest technical demo risk.** Test on Day 1 with prompts like "burette", "drawing of a burette" and "conical flask sketch". Fallback: Muse Wonder vision returns bounding boxes using the same schema. |
| Deadline "2:00 AM WAT" | US DST ends Nov 1, 2026, so Nov 4 at 9:00 PM is **EST (UTC−5) = 02:00 UTC on Nov 5 = 03:00 WAT**. | The spec is an hour conservative, which is harmless. Still submit by 20:00 WAT on Nov 4 as planned. |

---

## 1. Core story, one-line pitch, hero user, emotional hook

### One-line pitch (pick one and repeat it everywhere)
- **Primary:** *"SnapLab NG turns the lab diagram in a Nigerian student's exercise book into a working 3D lab. Then an AI WAEC Chief Examiner marks her page and quizzes her in Pidgin."*
- **Judge-repeatable 6-word version:** *"Your exercise book becomes your lab."*
- **Tagline for the end card:** *"Draw am. Snap am. Do the practical."*

### The narrative arc (three acts, problem to proof)
1. **The gap.** Around 1.95 million Nigerian students sat WASSCE in 2026. Many write the chemistry practical having only ever *drawn* a burette. WAEC's own Chief Examiner reports candidates *"manipulat[ing] titre values to agree with those of the teachers"* and an *"inability to differentiate between significant figures and decimal places"*, and recommends *"more practical activities … before WASSCE begins"* (WASSCE Chemistry Paper 3, 2023, Weaknesses/Remedies, verified). They fake the readings because they never got to take them.
2. **The insight.** Every student already owns the lab bench: an exercise book with a carefully drawn diagram and a results table. That page is *exactly the artifact WAEC marks*. Don't make students learn a new app. Make their page come alive.
3. **The proof.** Snap the page and the apparatus rises out of the ink. Run the titration with real chemistry. Watch the Chief Examiner circle "24.5" in red: *"−1: burette readings to 2 d.p. (24.50)."* Then defend your result in a viva, in the English or Pidgin you actually speak.

### Hero user persona (composite: say so in the README)
**Amina Yusuf, 17, SS3 science class, public secondary school in Kubwa, Abuja (FCT).**
- She wants Medicine at ABU Zaria or UNILAG and needs a credit in Chemistry, Physics and Biology.
- Her school "lab" is a locked room. The few burettes come out on practical day, shared between many students. *(Use what your real filmed student actually tells you. Never script a statistic into a minor's mouth.)*
- She owns a shared family Android phone (Tecno/Infinix class) and buys data in small bundles.
- She has drawn the titration setup more times than she can count. She knows "read the bottom of the meniscus at eye level" as a sentence, not as a physical act.
- Her fear is not chemistry. It is losing marks for things nobody showed her: 2 d.p., concordant titres, units.

**Emotional hook (the first 10 seconds):** *"Amina has drawn this burette a hundred times. She has never touched one."* Then the burette rises out of her page. Dignity, not pity: she is already doing the work, and the tool meets her where she is.

**The developer as co-protagonist (≤10 seconds on camera):** "I'm [name], a developer in Kubwa." The theme is *Build for Your World*. Judges reward the "problem you know firsthand" angle, so a real face, place and accent are worth more than any shader. *(If you yourself sat WAEC practicals without a lab, say that in one sentence. Only if it is true.)*

---

## 2. Demo video: shot-by-shot script (target 2:30, hard cap 3:00)

**Principles.** Judges watch the video first, often only the video, and typically for 2–3 minutes across hundreds of entries. So: **product in the first 10 seconds**, one end-to-end path, no architecture diagrams before 2:00, burned-in subtitles throughout (Pidgin plus Nigerian accents plus judges watching on mute), and the developer's own voice for the voiceover (VO).

**Format.** 16:9 1080p master. Phone screen recordings inside a clean device frame. Laptop recordings at 1440p downscaled. Music: a low, warm Afrobeats-adjacent instrumental bed (royalty-free) at about −24 LUFS under the VO. Use real room tone for the opening.

| Time | On screen | Audio / VO (subtitled) |
|---|---|---|
| **0:00–0:04** | **Real footage.** Macro, top-down: a blue biro finishes the last line of a burette drawn over a conical flask on ruled exercise-book paper. Natural window light, slight handheld breath. | Room tone: generator hum, a distant okada horn, a pen scratch. On-screen text, white lower third: **"Amina has drawn this burette a hundred times."** |
| 0:04–0:07 | Hold on the drawing. Her hand rests beside it (hands only unless you hold consent). | Text replaces: **"She has never touched one."** Silence for one beat. |
| 0:07–0:10 | A phone enters frame and snaps → **hard cut to screen capture:** the ink outlines pulse green (SAM masks), and a glass burette and flask **rise out of the paper** in 3D. The camera tilts. | One glass "ting". Title card flashes for 0.7 s: **SnapLab NG**. |
| **0:10–0:28** | **Problem, real footage montage (≤2 s per shot):** Kubwa street and bus stop establishing shot; a school gate *(with permission)*; a closed lab door or bare shelves *(only if real)*; a stack of exercise books. Then a **quote card** in WAEC-report typography with its citation. | **VO:** "I'm [name], a developer in Kubwa, Abuja. This year about 1.95 million Nigerian students sat WAEC. Many write the chemistry practical having only ever *drawn* the apparatus. WAEC's own Chief Examiner reports students *'manipulating titre values to agree with those of the teachers.'* They fake the readings, because they never got to take them." |
| **0:28–0:48** | **Wow 1: Snap → Lab.** iPhone screen capture: tap "Snap my page", then the photo. The **"Show the AI" drawer** slides up: lane 1 **SAM 3.1** shows masks labelled `burette 0.91` and `conical flask 0.88`, lane 2 **Muse Wonder** streams the blueprint JSON *and reads her handwritten table*, and timings tick (e.g. 1.4 s, 2.9 s). The apparatus extrudes and settles. | **VO:** "So I built SnapLab. You snap your exercise book. Meta's SAM 3.1 finds each piece of apparatus in your ink. Muse Wonder reads your diagram *and your handwriting*, and compiles a lab. From here, real chemistry takes over." |
| **0:48–1:20** | **Wow 2: Do the practical.** Thumb holds the stopcock and drops fall (drip sound). The flask swirls; methyl orange shifts from yellow toward orange near the endpoint. A live pH readout. Release on the endpoint: "24.50 cm³ ✓". **Then cut to real footage:** her hand tilting the phone, intercut with the screen. The meniscus reading drifts and **"Parallax: read at eye level (+0.18 cm³)"** appears. She levels the phone and the reading snaps true. Optional 3 s overshoot: one drop too many, the flask goes red, "Overshot by 0.40 cm³". | **VO:** "The AI doesn't fake the chemistry. A deterministic engine computes the pH after every drop. Tilt your phone and you see the parallax error examiners punish. Mistakes have consequences here, before they cost you marks in May." |
| **1:20–1:50** | **Wow 3 (HERO): The Chief Examiner marks *her* page.** The photo of her **actual handwritten results table** fills the screen. Red-ink annotations draw on in order: a circle around "24.5" → **"−1 CHEM-BUR-2DP: record to 2 d.p. (24.50)"**; a bracket around the averaged rough titre → **"−2 CHEM-CONCORD: average only concordant titres (±0.20)"**; a missing unit → **"−1 units"**. The score counter ticks down: **20 → 16**. Each deduction expands to show the rule and the fix. | **VO:** "Then Muse Wonder becomes a WAEC Chief Examiner. It reads her real handwriting and marks it against the same rules examiners use. That '24.5'? One mark. Gone. Now she knows *why*, months before the exam." |
| **1:50–2:15** | **Viva, real footage plus screen split.** Left: Amina (or her hands and the phone) answering aloud. Right: the viva console. The examiner's question appears with a voice waveform. Her words stream in live (Muse Voice Transcribe lane lit). The examiner's reply appears (Muse Spark lane lit, about 0.9 s). | **Examiner (on-screen text plus browser TTS):** "Your titres no agree. Wetin you go do?" **Amina (live, real):** "I go repeat am until two readings agree within point two zero… then I go find the average." **Examiner:** "Correct! Two concordant titres. You don collect that mark." *(English subtitles burned in. Use whatever she actually says, unscripted; keep the take where transcription succeeds and don't edit the transcript.)* |
| **2:15–2:30** | **"How it works" in 15 s:** the full-screen pipeline visualiser shows 4 Meta-model lanes with real timings and the line **"AI reads & judges → physics engine decides"**. Then a 3 s clip of the **same notebook running on a ~₦100k Android in Lite mode**, and a "Works offline after first load" badge. A 2 s flash: "Built solo in 10 days with Muse Code." | **VO:** "Four Meta models, each doing one honest job. It runs in a browser, on a cheap Android, with no login. The lab even works offline." |
| **2:30–2:45** | **Close, real footage:** Amina turns the page and starts drawing the next practical (a meter bridge). Pull back to the desk and the window light. **End card:** URL, QR code, "Try Amina's notebook. No login, no camera needed." Meta model logos (if brand rules allow) and your name. | **VO:** "Every student in West Africa already owns the lab bench: an exercise book. SnapLab NG makes it work." Music resolves. |

**Cuts to make from the master:**
- **60 s cut** for X, LinkedIn and Threads (0:00–0:10, 0:28–1:50 compressed, end card).
- **30 s vertical 9:16** for Instagram Reels and TikTok: hook, extrusion, red-ink marking, then a Pidgin viva line.
- **8 s GIF** of the extrusion for the README header.

### Real-world footage plan: Kubwa, Oct 21–25 (shoot this before you write code)

**Permissions first (Oct 21–22):**
- **Minors:** you need written parental/guardian consent and the student's own assent for any face or voice. Simplest path: film **hands, the exercise book and the voice only**, or cast an 18+ recent leaver or older sibling who sat WAEC recently.
- **School:** get written permission from the principal before filming on premises. If refused, film at home: a desk, a uniform on a chair, window light. **Never caption a home as a school or stage an "empty lab" that isn't one.**
- **Teacher soundbite (optional, 10 s):** ask an open question, "How do your students prepare for the chemistry practical?", and use what they actually say.

**Gear:** your phone at 4K 30 fps with exposure and focus locked; a cheap clip-on lav or a second phone recording audio; a white A4 card as bounce. Shoot at 9–11 am or 3–5 pm window light; avoid fluorescent flicker.

**Shot list (about 2 hours of shooting total):**

| # | Shot | Purpose | Notes |
|---|---|---|---|
| 1 | Biro drawing a burette, retort stand and conical flask, top-down macro, 3 takes | Hook (0:00) | Use a real **blue biro** on a **real ruled exercise book**. Check today's actual shop price and use it if you mention it ("₦200" is unverified). |
| 2 | Hand writing the results table, including **"24.5"** and an averaged rough titre | Wow 3 setup | Make a **"flawed" page** (deliberate WAEC errors) **and a "clean" page**. The flawed page is the hero golden notebook. |
| 3 | Phone snapping the page: handheld, then flat top-down | Transition | Also capture **flat, evenly lit stills of each page (3 lighting conditions)**. These become the golden demo images. |
| 4 | Hand tilting the phone over the notebook, slowly, 3 takes | Parallax beat | Later intercut with the screen capture of the parallax warning. |
| 5 | Student answering the viva question aloud into the phone, 5+ natural takes in English, Pidgin and mixed | Viva | Also **save 10–20 raw audio clips** to test Muse Voice Transcribe on Day 1. |
| 6 | Kubwa establishing shots: road, bus stop, kiosk with exercise books, school gate (with permission) | Problem montage | 2–3 s each, no identifiable minors. |
| 7 | Stack of exercise books and a worn practical notebook | Problem/close | |
| 8 | You (developer) at your desk, two sentences to camera | Authenticity | "I'm [name], a developer in Kubwa…" |
| 9 | Low-end Android on the desk (Tecno/Infinix/itel) | "Works on cheap phones" shot | Re-shoot with the app running on Nov 2–3. |
| 10 | Room tone: 60 s each of generator, street and classroom ambience | Sound design | |
| 11 | Amina turning the page and drawing a meter bridge | Closing shot | |

**Draw the golden pages carefully:**
- **Titration page:** the standard WAEC-style labelled diagram (retort stand, burette, clamp, conical flask, white tile) and a 3-column table (Rough, 1st, 2nd, 3rd; Final, Initial, Volume used), with intentional errors: one reading at 1 d.p., the rough titre included in the average, one missing unit.
- **Meter bridge page** (stretch only): a clean circuit diagram matching image.png.
- **A "messy real" page** from a real student, to show robustness in the live demo.

---

## 3. The judge experience (anyone who opens the live link)

### Zero-friction flow (target: first "wow" within 5 s of page load, full story in 90 s)

1. **Landing (no login, no cookies banner beyond what's legally needed).** Above the fold: the 8 s extrusion loop, the one-line pitch, and **three big cards**:
   - **"Amina's titration"** (golden, flawed page): *"Start here, 60 seconds."*
   - **"Clean titration page"** (shows a high score, proving the grader isn't just always harsh).
   - **"Snap or upload your own"** (camera optional; file picker works on laptops).
   - *(Stretch: "Tunde's meter bridge" with a "Physics preview" badge.)*
2. **Click "Amina's titration"** to start the **Guided Run**: 5 coach-marked steps with "Next →", skippable at any time.
   1. *Watch it come alive* (Wow 1).
   2. *Drip to the endpoint* (Wow 2; there's an "Auto-titrate" button for the impatient).
   3. *Tilt or drag to read at eye level* (DeviceOrientation on phones, a slider on laptops).
   4. *See the Chief Examiner's marking* (Wow 3).
   5. *Try the viva*: speak, or **type** your answer.
3. **Persistent "Show the AI" toggle** (top-right) opens the pipeline drawer at any step (section 5).
4. **End screen:** "Your page, marked: 16/20". A share link, "Try your own page", and a link to the 2:30 video.

**Deep links:** `/?demo=amina` auto-starts the guided run, and `/?demo=amina&step=examiner` jumps straight to the marking. Put both in the README so a judge with 30 seconds can jump to the hero.

### The three wow moments, in order, and how to make each robust

| # | Moment | What the judge sees | Precomputed vs live | Robustness and speed |
|---|---|---|---|---|
| **1** | **It comes alive** | Green masks trace her ink, then glass apparatus extrudes out of the page (about 1.5 s animation) | **Golden notebooks:** SAM 3.1 and Muse Wonder outputs are **cached from real runs**, keyed by image hash, and replayed with the *recorded* timings. **Upload path:** fully live. | The cache is labelled honestly: *"Cached result from a live run on Nov 3, 14:02 WAT · [Run live again]"*. The **"Run live" button really calls the API.** If live SAM returns empty, Muse Wonder's vision boxes fill in; if both fail, fall back to a "Pick your apparatus" tap-to-place mode. The extrusion animation starts immediately on a placeholder silhouette while results stream in. |
| **2** | **Real chemistry** | Drop-by-drop titration, an indicator colour shift, a pH readout, parallax on tilt, overshoot consequences | **100% local and deterministic** (plain TypeScript: about 50 lines of stoichiometry and pH). No network needed. | 60 fps target on mid-range phones and 30 fps on low-end. Use one glass material, low-poly GLB models (Draco/meshopt, ≤1.5 MB total) and baked lighting. iOS: call `DeviceOrientationEvent.requestPermission()` on the user tap, and provide a **drag-slider fallback**. |
| **3** | **The Chief Examiner marks your page** | Red-ink circles and notes drawn onto the photo of the handwritten table, deductions citing rule codes, and a score animation | **Golden:** cached Muse Wonder audit, replayed with a streaming effect at its real speed. **Upload:** live Muse Wonder with JSON-schema output; arithmetic checks (2 d.p., ±0.20 concordance, averages) are **recomputed deterministically** from the extracted numbers. | The AI extracts the values and their bounding boxes; **code** applies the hard rules, and the AI writes the explanation. This removes most grading hallucination risk. Show an "Examiner confidence: low, please confirm these readings" step if handwriting OCR confidence is low. |
| (bonus) | **Viva** | A spoken question, live transcription of the judge's or student's voice, and a reply in about 1 s | **Always live** (it's the proof the AI is real). Muse Spark at low reasoning effort. | **A typed-answer box is always visible** (mic permission denied, noisy room, judges on mute). Pre-warm the WebSocket when step 5 opens. If STT fails, show "Couldn't hear you, type instead" instead of a spinner. Cap 3 turns. |

### Platform checklist
- **Laptop (Chrome, Safari, Edge) and iPhone Safari (iOS 17+), plus one low-end Android** (test on a real Tecno/Infinix/itel and record the fps in the README).
- **WebGL2 only.** Don't depend on WebGPU. Keep textures ≤2048 px (iOS tab memory). Resize notebook photos client-side to about 1600 px longest edge and ~250 KB JPEG before upload.
- **Mic and orientation permissions** are requested only on a user tap, inside the step that needs them, never on load.
- **No WebGL?** Auto-switch to **Lite mode**: a 2D SVG lab with the same engine, examiner and viva.
- **Abuse and credit protection** ($150 in API credits): the key stays server-side; rate-limit live runs per IP (e.g. 10/hour); cap image size; set a global daily spend kill-switch that flips the site to cached-only with a visible banner.
- **Keep it up through Nov 9** (live finals). Run an uptime monitor plus a scheduled "golden run" check every 30 min. Freeze dependencies after Nov 3.

---

## 4. CUT, DEFER, KEEP (opinionated)

The spec describes a platform. The judges reward **one complete working path** and "whether it works". Every subsystem that isn't visible in the 2:30 video is risk with no upside.

### Hero (protect at all costs)
**"Your own page, marked like WAEC" on titration.** Photo of the page, then SAM plus Wonder build the lab, a deterministic titration runs, the Chief Examiner red-inks *her handwriting*, and a 3-turn viva follows. It must work flawlessly on the golden notebook and acceptably on a fresh upload.

### CUT (do not build in these 10 days)
| Feature | Why cut |
|---|---|
| **Rust → WASM physics in a worker with SharedArrayBuffer at 120 Hz** | The titration and meter-bridge maths is microseconds in plain TypeScript. SharedArrayBuffer needs COOP/COEP headers, which break third-party embeds and are fiddly on iOS. Zero visible benefit, high build risk. *(Say "deterministic engine", not "Rust".)* |
| **WebGPU, 120 FPS, custom refraction shaders** | Judges can't see 120 vs 60 fps in a compressed video. iPhone and low-end Android need WebGL2 anyway. |
| **MediaPipe hand gestures ("pinch to pour")** | Flaky in varied lighting, kills battery and frame rate on low-end phones, and adds a camera permission. Touch-and-hold plus phone tilt reads better on camera. |
| **OpenCV live homography / AR tracking of the paper** | The hardest computer-vision piece and the most failure-prone live. Use a **still photo** mapped onto a 3D page. The video can still *feel* AR through editing (real shot to screen capture). |
| **Muse Image "corrected WAEC model diagram"** | Image models routinely mislabel technical diagrams. One wrong label in a "Chief Examiner model answer" destroys credibility with an education judge. It is also slow and expensive. |
| **Ray optics mode** | A third experiment dilutes the story, and drawing rays is the hardest to parse. |
| **Postgres/Drizzle, Cloudflare R2, Upstash, a separate Bun+Hono server** | Use one Next.js app with serverless API routes, rubrics as a static JSON file, and a hash-keyed JSON cache for golden runs. Fewer moving parts means fewer 2 a.m. outages. |
| **Procedural AudioWorklet synth** | Four short sound files (drip, glass ting, pen scratch, success chime), each under 30 KB. |
| **Glasses / Ray-Ban Display build** | Tempting given Connect 2026, but it's a separate platform and approval path. Put it in "What's next" only. |

### DEFER (stretch, only if the hero is done and the video is drafted by end of Day 6, Oct 31)
1. **Meter bridge (physics) golden notebook** with the cherry-red short-circuit wire. Great B-roll. **Only from the golden page**, with the wiring topology hand-verified in the cache. Live circuit-topology inference from sketches is not demo-safe.
2. **WAEC 2 mm graph sheet with slope-triangle check.** Needs several readings; meter bridge only.
3. **NECO toggle and Ghana/Sierra Leone/Gambia/Liberia framing** (copy-only change).
4. **Offline PWA caching** of the golden notebook and engine. Cheap, and strong for "Build for Your World". Do it if at all possible (section 8).

### KEEP but simplify
- **Viva:** 3 turns max, 1 question bank per rubric deduction (the examiner asks about *the mistake she made*), and a typed fallback.
- **Show the AI drawer:** essential (section 5). It's a UI component reading the same events the app already emits.

### Suggested 10-day shape (replaces section 8 of the spec)
| Days | Goal |
|---|---|
| **Oct 26 (D1)** | **API smoke tests:** SAM 3.1 on 5 sketch photos × 3 prompt phrasings; Muse Wonder handwriting extraction on the results table; Muse Voice Transcribe on 10 Pidgin/English clips; Spark latency. **Write down the results; they decide the fallbacks.** Scaffold one Next.js app. |
| D2–D3 | Upload → SAM/Wonder → blueprint → extrusion on the golden page, with caching. |
| D4 | Titration engine, interaction and parallax (tilt plus slider). |
| D5 | Chief Examiner: Wonder extraction, deterministic rule checks and red-ink overlay. **The hero is complete end-to-end at this point.** |
| D6 | Viva (STT WebSocket plus Spark plus typed fallback). Show the AI drawer. **Draft-cut the video with placeholder captures.** |
| D7 | Low-end Android and iPhone pass, Lite mode, offline cache, rate limits. Stretch: meter bridge golden page. |
| D8 | Final screen captures; record the VO; edit the video. Write the README. |
| D9 (Nov 3) | Freeze. Bug-fix only. Cut the social videos. Test the live link from three networks (MTN, Airtel, a VPN to US). |
| D10 (Nov 4) | Submit by 20:00 WAT. Post the launch. |

---

## 5. Making the Meta AI visibly central (without the gimmick)

### The principle to say out loud (README, video VO and UI footer)
> **"The AI reads and judges. The physics engine decides what happens."**
> Meta's models do what only models can do: see a sketch, read handwriting, apply an examiner's judgement, and understand a Nigerian student speaking Pidgin. The chemistry is computed, never generated.

This defuses the "AI gimmick" critique and the "LLM hallucinated a pH" critique at once.

### Model-to-job map (show this table verbatim in the README and as the drawer legend)

| Meta model | Job in SnapLab | What the judge *sees* in the drawer |
|---|---|---|
| **SAM 3.1** (`sam-3.1`, Responses API) | Finds each piece of apparatus in the ink drawing (one noun phrase per request, run in parallel) | The photo with coloured masks appearing per label, confidence scores, per-request ms, and an "empty results" row for prompts that matched nothing (honesty plays well) |
| **Muse Wonder** | (a) Compiles the diagram, the handwritten table and the SAM masks into a schema-validated lab blueprint. (b) The **Chief Examiner audit**: extracts every reading with its bounding box and writes rule-cited deductions and fixes. | Streaming JSON with the schema name, `strict: true` visible, and the extracted readings highlighted on the photo as they parse (e.g. `"final_1": "24.5" → bbox`) |
| **Muse Spark 1.3** (low effort) | Fast viva turns: asks about *her specific mistake*, judges her answer against the rubric, and replies in her register (English or Pidgin) | Per-turn latency, the rubric rule being probed, and a "pass/needs work" verdict chip |
| **Muse Voice Transcribe** | Live transcription of the student's spoken answer, code-switching English and Pidgin | Words streaming in 80 ms chunks, language-switch markers (EN↔PCM) if exposed, and running cost ("$0.0004 so far") |
| **Muse Code** | Used to build the app | A 2 s mention in the video; README section "How Muse Code built this" with 2–3 concrete examples (e.g. "generated the titration test suite") |

**The "Show the AI" drawer design:**
- **Four horizontal lanes**, one per model, laid out like a Gantt chart, with bars showing real start and end times for the current run.
- **Click a bar** to see the exact request (prompt and schema trimmed) and the response, with secrets redacted.
- A **"Deterministic engine"** lane in a different colour (grey) shows what code decided, e.g. "2 d.p. check: FAIL (24.5)" and "Concordance |24.50−24.70| = 0.20 ✓", making the AI/engine boundary visible.
- On golden runs there is a **"Cached from live run · timestamp · Run live"** badge.
- In the video, open the drawer **twice**: briefly at 0:28 (SAM and Wonder) and full-screen at 2:15.

**Anti-gimmick guardrails:**
- No chat box and no generic "Ask AI anything". The examiner only talks about this student's page.
- Every AI deduction must cite a rubric rule code and point to a region of her page. No vague feedback.
- If the model is unsure (low OCR confidence), the UI *asks the student to confirm the reading* instead of guessing. That's good pedagogy and good AI design.

---

## 6. Impact framing with credible numbers

**Rule: every number in the video and README has a source or an "estimate" label. Remove anything you can't source.**

| Claim | Number | Status / source |
|---|---|---|
| Nigerian students who sat WASSCE (school candidates) in 2026 | **1,950,726 sat** of 1,959,668 registered, from **24,207 schools** | **Verified** (allAfrica, reporting WAEC's Aug 2026 release) |
| 2025 WASSCE (Nigeria) | 1,969,313 sat; 1,973,253 registered from 23,554 schools | **Verified** (Guardian NG; Blueprint) |
| NECO SSCE 2025 internal | 1,367,210 registered; 1,358,339 sat | **Verified** (VON) |
| Combined senior-secondary exam sitters per year (Nigeria) | "~3.3 million WAEC + NECO sittings" | **Derived** (sum of the above). Note the overlap: many students sit both. Prefer "about 2 million WAEC candidates a year". |
| WAEC member countries | 5 (Nigeria, Ghana, Sierra Leone, Liberia, The Gambia) | Well known. Cite waecheadquarters if you use it. |
| Chief Examiner on titration practice | Quotes: *"manipulation of titre values to agree with those of the teachers"*; *"inability to differentiate between significant figures and decimal places"*; *"wrong units"*. Remedy: *"more practical activities should be carried out before WASSCE begins"* | **Verified, verbatim** (WAEC e-Learning, Chemistry Paper 3 WASSCE (SC) 2023, Weaknesses/Remedies). **This is your strongest impact evidence. Use it instead of lab-access percentages.** |
| Physics practical weaknesses | *"inconsistencies in number of d.p. and s.f."*, *"inability to make correct deductions from graph"* | **Verified** (WAEC e-Learning, Physics Paper 3 chief examiner report page) |
| "Over 70% of students attend schools without functional labs" (from the spec) | — | **UNVERIFIED. Remove.** |
| "Only ~35% of public secondary schools have functional science labs" | 35% | **Weakly sourced** (The Nigeria Education News, July 2025, citing "UNESCO and student surveys" without a report name). Don't put it in the video. If used in the README: "one 2025 report estimates…" plus a link. |
| State-level studies of inadequate lab equipment | Ondo, Oyo, Edo studies | Real academic literature exists; cite one specific paper if you use it, otherwise omit |
| Smartphone ownership in Nigeria | **75% (2025)**, up from 64% in 2023; more than a third of subscribers still on 2G | **Verified** (KPMG and Orange Group Nigeria study, 13,251 respondents in **12 major cities**, so it skews urban; say so) |
| Cost per full SnapLab session | **≈ $0.10–0.20**: STT $3/1,000 min (a 5-min viva ≈ $0.015) + 2 Muse Wonder calls at $4/$20 per M tokens (≈ $0.05 each at ~5k in / 1.5k out) + Spark + SAM | **Estimate.** SAM and Spark prices not verified. Compare: PraxiLabs full access $75/yr (2023 article). |
| Exercise book price "₦200" | — | **Unverified.** Check a Kubwa shop on Oct 21–25 and use the real price on camera. |
| WAEC chemistry practical always includes a titration | — | **Widely understood but unverified here.** Check 3–5 recent Paper 3 questions on waeconline.org.ng before saying "every year". |

**Suggested impact paragraph (README):**
> About 2 million Nigerian students sit WASSCE every year, across 24,000+ schools. WAEC's own Chief Examiner reports candidates manipulating titre values "to agree with those of the teachers", confusing decimal places with significant figures, and writing wrong units, and recommends more practical work before the exam. SnapLab NG gives every student practical reps on the lab bench they already own, their exercise book, for an estimated ~$0.15 of AI per session, on the phones three in four urban Nigerians already carry.

### Competitive landscape: what is genuinely new
| Player | What it is | What it doesn't do |
|---|---|---|
| **PhET** (CU Boulder) | Free, excellent interactive simulations; offline desktop app; translated into Yoruba and others | Not exam-aligned to WAEC; doesn't start from the student's own work; no marking or viva |
| **Labster** | Premium 3D virtual-lab scenarios, mostly higher education | Expensive and institution-sold; pre-built scenarios; not WAEC |
| **PraxiLabs** (Egypt) | 125+ 3D lab simulations, about 1M subscribers, $75/yr (2023) | University focus; no Nigeria presence reported; no handwriting marking |
| **StanLab** (Nigeria) | Unity 3D virtual lab for Nigerian secondary schools (titration etc.); British Council seed funding; distributed on CD for low connectivity | Desktop install; pre-built experiments; no AI marking |
| **Foris Labs** (Nigeria) | Gamified 3D virtual science lab on mobile and desktop; beta in Anambra schools; TC Startup Battlefield | Pre-built experiments; no input from the student's notebook |
| **Edu ScienceLAB** (Neovarsity Africa) | Virtual lab claiming WAEC/NECO alignment; offline; institutional subscriptions | Pre-built; no marking of student work |
| **uLesson, Class54, PrepClass, Gradely** | Video lessons, CBT past questions, AI explanations, tutors | No practicals or lab simulation |
| **Sketch2Sim / Img2Sim** (academic) | Hand-drawn circuit image → circuit simulation | Research tools; not education products; no examiner or viva |

**Defensible novelty claim** (don't say "first virtual lab in Nigeria", which is false):
> *"Existing virtual labs give students someone else's experiment. SnapLab NG starts from the student's own exercise-book page, the exact artifact WAEC marks, turns it into a lab they can run, and then marks their handwriting against Chief Examiner rules and quizzes them in the English or Pidgin they actually speak. We know of no other tool that does all three."*

**Precedent that this theme wins with Meta:** Meta's past Llama hackathons and grants have rewarded local-language, low-literacy and access-focused tools. Llama Impact Hackathon India's winners were mostly WhatsApp-based vernacular tools, plus *Evalssment* (AI grading with feedback). The 2025 Meta Llama Impact Accelerator's Nigerian winners included **DAWN AI Study** (education). LlamaCon's "Best Llama API Usage" went to *Geo-ML*, which turned domain documents into a structured DSL that drove 3D models. **That is essentially SnapLab's architecture** (AI → structured blueprint → deterministic 3D), so it's a useful framing for judges.

---

## 7. README / submission page, social plan, pitch checklist

### Submission page structure (assumes Devpost-style headings; adapt to the official form)
1. **Header:** an 8 s GIF of a page turning into a lab, the one-line pitch, and three buttons: **Watch (2:30)** · **Try Amina's notebook (no login)** · **Code**.
2. **Try it in 60 seconds:** the deep links (`/?demo=amina`, `/?demo=amina&step=examiner`), supported devices, and "no camera or mic needed (typed fallback)".
3. **The problem (Build for Your World):** 4 sentences, the WAEC quote, the 2026 candidate number, and Kubwa context. One photo of a real exercise book.
4. **What it does:** the three wow moments as numbered screenshots.
5. **How Meta's models power it:** the model-to-job table from section 5 plus a pipeline diagram (this is where architecture goes, *not* in the video). Include a "The AI reads and judges; the physics engine decides" callout.
6. **Built during the hackathon:** commit-history link, the day-by-day log, and what Muse Code did. Clearly separate anything pre-existing (footage, drawings).
7. **Grounding:** the WAEC rubric rules used (rule codes plus source links), and a statement that rubric rules are paraphrased from public WAEC chief examiner reports.
8. **Inclusive by design:** Pidgin, low-end phones, offline, Lite mode, typed viva, captions.
9. **Known limitations (be candid; judges reward it):** sketch detection works best on dark-ink, well-lit pages; Pidgin STT accuracy measured on N clips = X%; meter bridge is a preview; examiner marks are formative, not official WAEC marks.
10. **What's next:** a teacher dashboard; NECO and BECE; the meter bridge and the other Paper 3 practicals; Muse Glimmer open-weights on a school laptop for offline classrooms; WhatsApp "snap your page" entry; Ray-Ban Display web app for teachers.
11. **Impact numbers with sources** (section 6 table, trimmed).
12. **Ethics and safety:** minors' data is not stored by default; photos are deleted after the session unless the student saves; consent was obtained for all footage; not affiliated with or endorsed by WAEC. **Don't use the WAEC logo or official styling.** Say "WAEC-style marking" and "based on public Chief Examiner reports".
13. **Team:** you, solo, Kubwa, with links.

**Repo README specifics:** setup in ≤5 commands; `.env.example`; a `GOLDEN.md` describing how the cached runs were produced; a test for the titration engine and rule checks; MIT/Apache licence.

### Social and viral plan (treat the bonus pool as unverified; the posts also help the "community" impression)
**Channels:** X (tag @MetaforDevs, @AIatMeta, @cerebral_valley; check exact handles on the day), LinkedIn (native video), **Threads and Instagram Reels** (Meta's own platforms, so the hosts notice), and Nigerian tech communities (e.g. WhatsApp tech groups, Techpoint/TechCabal tip lines). Hashtags: use the official hackathon hashtag once published, plus #BuildForYourWorld (if official) and #NigeriaTech. Nothing more.

**Timing:** post at **14:00–15:00 WAT (9–10 am ET)**, which reaches the Nigerian afternoon and the US morning. Avoid weekends for LinkedIn.

| Date | Post | Asset |
|---|---|---|
| Oct 23–25 (pre-event, optional) | "Next week I'm turning this exercise book from Kubwa into a lab." | Photo of the drawn page (no code, idea only) |
| **Oct 26** kickoff | "Day 0. 10 days. One exercise book." Thread with the plan. | Hook shot 1 |
| Oct 28–29 | "Day 3: it rose out of the page." | 8 s extrusion clip (the most shareable asset) |
| Oct 30–31 | "Day 5: the AI Chief Examiner just took a mark off '24.5'. Every Nigerian student knows this pain." | 15 s red-ink clip. **Invite replies: "What did WAEC take marks off you for?"** to drive engagement. |
| Nov 1–2 | "Day 7: the examiner now asks in Pidgin." | 15 s viva clip, subtitled |
| **Nov 4** (after submitting, ~15:00 WAT) | Launch: full 2:30 video plus a link to try. X thread (5 posts: hook, problem with quote, 3 wows, Meta models, try it). LinkedIn long post. Reels and Threads vertical cut. | All cuts |
| Nov 5–8 (judging) | 1–2 follow-ups: "A teacher in [city] tried it…" (only if real), plus a "how it works" thread | Real feedback |
| Nov 9 | Finals/winners. Thank-you post regardless of result. | — |

**Amplifiers:** ask 5–10 Nigerian teachers and former WAEC candidates to *try it and quote-post their own score*. Personal stories ("WAEC took 2 marks from me for this exact thing in 2019") spread better than product posts. Never buy engagement and never use engagement pods; it can disqualify you and Meta will notice.

### Pitch checklist (score yourself the night of Nov 3)
**Official Indie criteria:**
- [ ] **Creativity:** is the idea unmistakably new in 10 seconds? (Page → lab → marked)
- [ ] **Technical ambition:** visible in the drawer (4 models, structured outputs, real-time STT, a deterministic engine, 3D on a cheap phone) without boasting about the stack.
- [ ] **Whether it works:** the live link loads in under 3 s on 4G; the golden run is 100% reliable; a fresh upload works on 3 new pages; viva works with a typed fallback; it has been tested from a US network.

**Theme and Meta fit:**
- [ ] "Build for Your World" is obvious: a real place (Kubwa), a real artifact (exercise book), a real accent and Pidgin, a real exam.
- [ ] Every Meta model has a distinct, visible, non-decorative job, and is named on screen when it works.
- [ ] Muse Code usage is mentioned.

**Video:**
- [ ] The product appears by 0:10. No logo intro, no market slide first.
- [ ] One end-to-end path; the hero moment (red ink on handwriting) lands before 1:50.
- [ ] Subtitles burned in; understandable on mute.
- [ ] ≤3:00 (target 2:30); 1080p; audio levels consistent; your own voice.
- [ ] Every number on screen is sourced.

**Submission:**
- [ ] README has the deep links, model table, limitations, "built during hackathon" section, and consent statement.
- [ ] No WAEC logo or impersonation; there is a "Not affiliated with WAEC" line.
- [ ] Repo is public with a licence; secrets are not committed.
- [ ] Track = Indie; theme = Build for Your World; submitted before 20:00 WAT on Nov 4.
- [ ] Site monitored and kept live through Nov 9.

**The repeatable sentence test:** could a judge say to another judge, "Oh, the one where the Nigerian kid's exercise book turns into a lab and the AI examiner takes a mark off for 24.5"? If yes, you've won the memory battle.

---

## 8. Accessibility and inclusion ("Build for Your World")

| Touch | Why it matters | Implementation note |
|---|---|---|
| **Pidgin and Nigerian English examiner register** | Students think and argue in code-switched speech; most viva practice tools assume standard English | A language toggle (English · Pidgin · Mixed). Have 2–3 Nigerian students review every Pidgin string; avoid caricature. Default to "Mixed". |
| **Accent-robust STT plus typed fallback** | Noisy classrooms, shared phones, shy students, deaf or hard-of-hearing users | Typed answer is always available. Show the transcript so students can correct it before submitting. |
| **Lite mode (2D SVG)** | Many devices lack good WebGL or RAM | Auto-detect: low `deviceMemory`, failed WebGL context, or under 20 fps for 3 s → offer Lite. Same engine and examiner. |
| **Data-light** | Students buy data in small bundles; more than a third of subscribers are still on 2G | First load ≤2 MB (lazy-load 3D); client-side image compression to ~250 KB; a "data used this session" counter in the footer is a nice touch. |
| **Offline-first lab** | Power cuts and patchy networks | A PWA caches the shell, models, engine and golden notebooks. Titration works fully offline; marking and viva queue until online ("We'll mark your page when you're back online"). |
| **Colour-independent indicators** | The phenolphthalein pink/colourless and methyl orange shifts are hard for colour-blind users | Always show pH as a number and a text label ("endpoint reached"); give the apparatus high-contrast outlines. |
| **Readable on small screens** | 5–6" budget phones | 16 px minimum body text, 44 px tap targets, one-hand thumb reach for the stopcock. |
| **Keyboard and screen reader basics** | Judges and teachers on laptops; visually impaired users | Arrow keys drip; spacebar stops. ARIA live region announces readings and deductions. |
| **Teacher mode (stretch)** | One phone, 40 students: a teacher projecting it serves the whole class | A "Classroom" toggle: big fonts, the examiner's questions shown for group discussion. |
| **Privacy for minors** | Photos of exercise books contain names and schools | Blur the "NAME / SCHOOL" header region before upload (Muse Wonder or SAM can locate it); no account; delete by default. |
| **West Africa, not just Nigeria** | WAEC serves 5 countries | Copy says "WAEC students across West Africa"; Ghanaian Pidgin is on the roadmap. |
| **Captions on all video** | Judges on mute; accents; Pidgin | Burned-in English subtitles plus Pidgin original where spoken. |

---

## Sources
- Meta Global AI Developer Hackathon event page (Cerebral Valley): https://cerebralvalley.ai/e/meta-ai-developer-hackathon and https://cerebralvalley.ai/e/meta-ai-developer-hackathon.md
- Meta Connect 2026 developer recap: https://developers.meta.com/blog/meta-connect-recap/
- The GenAI Magazine (unofficial hackathon expectations): https://thegenaimagazine.com/meta-global-ai-developer-hackathon-ideas-prizes
- Muse Voice Transcribe coverage: https://thenewstack.io/meta-muse-voice-transcribe/ ; https://propakistani.pk/2026/09/02/metas-muse-voice-transcribe-70-languages-and-20-speakers-simultaneously/
- LiteLLM Meta provider docs (model ids, realtime-only STT): https://docs.litellm.ai/docs/providers/meta.md
- Muse Wonder coverage: https://aimagazine.com/news/muse-wonder-how-is-meta-competing-at-the-frontier ; https://propakistani.pk/2026/10/13/meta-enters-ai-frontier-with-new-wonder-models/amp/
- SAM 3.1 on the Meta Model API: https://www.mind-verse.de/news/meta-sam-3-1-bild-video-analyse-api
- WAEC 2026 WASSCE results: https://allafrica.com/stories/202608060122.html
- WAEC 2025 WASSCE: https://guardian.ng/education/waec-releases-2025-wassce-results-withholds-192089/ ; https://blueprint.ng/2025-waec-registers-1973253-candidates-from-23554-schools-introduces-innovations-against-exam-malpractices/
- NECO 2025: https://von.gov.ng/neco-releases-2025-ssce-results/
- WAEC Chemistry Paper 3 (2023) Chief Examiner weaknesses: https://waeconline.org.ng/E-Learning/Chemistry/chem340mw.html ; strengths: https://waeconline.org.ng/E-Learning/Chemistry/chem340ms.html
- WAEC Physics Paper 3 Chief Examiner report: https://waeconline.org.ng/e-learning/Physics/Phys3223nw.html
- Lab-access claim (weak source): https://thenigeriaeducationnews.com/2025/07/01/the-silent-breakdown-in-nigerias-classrooms-no-labs-no-libraries-no-digital-tools/
- Smartphone ownership (KPMG and Orange): https://africa.com/top-10-news/nigerias-smartphone-ownership-climbs-to-75
- Competitors: StanLab https://www.britishcouncil.org/voices-magazine/virtual-lab-schools ; Foris Labs https://technext24.com/news/foris-labs-virtual-laboratory-soludo/ ; Edu ScienceLAB https://neovarsityafrica.com/edu-sciencelab-virtual-science-laboratory/ ; PraxiLabs https://al-fanarmedia.org/2023/01/praxilabs-an-egyptian-startup-that-puts-science-labs-online-expands-internationally/ ; Class54 https://www.thisdaylive.com/2026/01/02/class54-launches-ai-tools-to-support-jamb-and-waec-candidates-ahead-of-2026-exams/ ; Nigerian VR/edtech https://techpoint.africa/insight/virtual-reality-in-nigeria/ ; PhET report https://phet.colorado.edu/files/Yidan.Annual.Report.Jan-Dec.2021.pdf
- Past Meta/Llama winners: https://ai.meta.com/blog/llamacon-hackathon/ ; https://ai.meta.com/blog/llama-hackathon-india/ ; https://lablab.ai/blog/llama-impact-hackathon-sf-summary ; https://brandspurng.com/2025/11/03/meet-the-winners-of-the-meta-llama-impact-accelerator-program-from-sub-saharan-africa/
- Judging behaviour: https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l ; https://forum.trondao.org/t/tron-grand-hackathon-improving-your-devpost-judge-score/9393 ; https://sustained.substack.com/p/lessons-from-winning-five-hackathons ; https://intercom.help/builderbase/en/articles/14831464-hackathon-playbook-ch-15-judging-rubrics ; https://dev.to/jacklyn/how-to-make-your-devpost-submissions-not-suck-37i0
