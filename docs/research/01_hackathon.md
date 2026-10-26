# Meta Global AI Developer Hackathon: research findings

Researched 2026-10-21. Labels used below:
- **VERIFIED (official)**: read directly on a Meta or Cerebral Valley page.
- **REPORTED (secondary)**: found only in third-party articles. Treat as plausible, not confirmed.
- **UNVERIFIED**: claims in the SnapLab spec, or elsewhere, that no source supports.

**Bottom line:** the event is real. Meta and Cerebral Valley run it, it is virtual, and it lasts 10 days. The official pages confirm the $1M total, both tracks, both themes, the dates and the required models. They do **not** yet show the per-place prizes, the scoring weights or the submission rules. The Official Rules are due "before the Hackathon begins on October 26, 2026" and had not been published when this was checked. The $400K / $150K / $50K figures and the 30/25/20/25 weights come from a single secondary source (screenai.es). That source says they come from the application agreement (waiver). That page renders with JavaScript and could not be read here, so those figures stay REPORTED.

---

## 1. Official pages, organizer, dates, format, eligibility

**Official URLs**
- Meta event page: https://dev.meta.ai/events/global-hackathon
- Cerebral Valley page (where you apply; holds the most detail): https://cerebralvalley.ai/e/meta-ai-developer-hackathon (also available as `.md`: https://cerebralvalley.ai/e/meta-ai-developer-hackathon.md)
- Application overview and event waiver (renders client-side; could not be read): https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver
- Meta for Developers announcement on X: https://x.com/MetaforDevs/status/2110045152601633114 (search snippet: "taking place from Oct 26-Nov 4 ... share of $1M in prizes ... Each selected participant gets $150 in Meta Model API credits")
- Background, from the Connect 2026 recap: https://developers.meta.com/blog/meta-connect-recap/ (global and virtual; built on Meta Model API, Muse Code or open-weights models; free API credits; MSL engineers run workshops; tracks for indie developers and startup teams; $1M cash)

**Organizer (VERIFIED):** Meta, with Cerebral Valley handling applications and the event platform.

**Format (VERIFIED):** Virtual and worldwide. Page wording: "Ten days, access to our newest models and $1M in prizes." Entry is free if selected. Accepted applicants are capped at 20,000.

**Timeline (VERIFIED, cerebralvalley.ai and dev.meta.ai). WAT conversions computed with tz data. US DST ends Nov 1, 2026, so Nov 4 is EST (UTC-5).**

| Milestone | Official time (ET) | Abuja (WAT, UTC+1) |
|---|---|---|
| Applications open | Oct 13, 9:00 AM ET | Oct 13, 2:00 PM |
| Application deadline | Oct 25, 11:59 PM ET (earlier if 20,000 spots fill) | **Mon Oct 26, 4:59 AM** |
| Approval notifications | Oct 26, 9:00 AM ET | Oct 26, 2:00 PM |
| Hackathon start / kickoff livestream | Oct 26 (CV header: 12:00 PM ET) | Oct 26, 5:00 PM |
| Workshops and Discord office hours | Oct 27 to Nov 4 | |
| **Project submissions due** | **Nov 4, 9:00 PM ET** (CV header: "EST"; shown as Nov 5 UTC) | **Thu Nov 5, 3:00 AM WAT** |
| Judging | Nov 4 to Nov 8 | |
| Closing ceremony, live finals, winners | Nov 9 | |

> The spec says the deadline is "2:00 AM WAT / 9:00 PM EST". The WAT figure is **off by one hour**: 9:00 PM EST on Nov 4 is **3:00 AM WAT on Nov 5**. The spec's internal target of submitting by 8:00 PM WAT on Nov 4 still leaves a safe buffer.
> The page also says "Dates may change at Meta's sole discretion."

**Eligibility (VERIFIED):**
- Open worldwide, "except where local law prohibits participation or receipt of an award."
- Excluded: sanctioned persons and organizations, and anyone in Belarus, China, Russia, Ukraine, Syria, Crimea, Donetsk, Luhansk, Cuba, North Korea or Iran. **Nigeria is not excluded.**
- Also excluded: Meta and Cerebral Valley employees, contractors and interns, government-affiliated individuals, and their families and households.
- Duplicate applications, false identity information or spam can lead to disqualification.

**Application screening (VERIFIED):** two criteria, weighted equally: (1) the project idea (clarity, feasibility, theme fit) and (2) technical skill. The user is already accepted, so this no longer matters.

**Team size:**
- Official pages: **not stated** (VERIFIED absent).
- REPORTED (screenai.es, citing the agreement): Indie Developer is "an individual developer, student or member of a team of up to four people." Startup is for a technical founder with an enterprise product. One track per participant and one track per project.
- REPORTED (screenai.es): minimum age 18, or the age of majority where you live.

## 2. Tracks and prizes

**Tracks (VERIFIED, quoted from cerebralvalley.ai):**
- **Indie developer track:** "For individual builders and students. Judged on creativity, technical ambition, and whether it works."
- **Startup track:** "For teams and founders building a real product. Judged on technical execution and whether it holds up in production."
- Every project enters exactly one track.

**Themes (VERIFIED):**
- **Build for Your World:** bring Meta's models into your own domain and solve problems you know firsthand.
- **Push the Frontier:** software, robotics, manufacturing, energy, materials and beyond.

**Prize total (VERIFIED):** "$1,000,000 in total prizes", a cash pool split across both tracks. The official pages show **no per-place breakdown and no bonus prizes**.

**Per-place breakdown (REPORTED, screenai.es only, published 2026-10-14, citing the application agreement):** https://screenai.es/meta-global-ai-developer-hackathon-2026-premios-creditos-condiciones

| Place | Indie Developer | Startup |
|---|---|---|
| 1st | $150,000 | $250,000 |
| 2nd | $100,000 | $150,000 |
| 3rd | $75,000 | $75,000 |
| 4th | $50,000 | $50,000 |
| 5th | $25,000 | $25,000 |
| Total | **$400,000** | **$550,000** |

- Bonus, as quoted: "Los organizadores pueden repartir hasta otros 50.000 USD en premios adicionales" ("organizers may distribute up to another $50,000 in additional prizes"). $400K + $550K + $50K = $1M, which is internally consistent.
- **The source gives no criteria for the $50K bonus.** Nothing found describes a "community" or "viral" prize, or a bonus for tagging @MetaAI or @cerebral_valley. The spec's "$50,000 Community/Viral Bonus Pool" is **UNVERIFIED**. Treat the $50K as discretionary extra awards with unknown criteria.
- REPORTED: the winner pays any fees, currency conversion and taxes.
- Other secondary sources (thegenaimagazine.com, cryptoaimeta.com, resourify.com, coursejoiner.com, internshala.com) say only that the split has not been published. coursejoiner's headline mentions "relocation and housing support", but its own body says this is unconfirmed.

## 3. Judging criteria and weights

**Official wording (VERIFIED):** the only published criteria are the track lines quoted above. Indie: "creativity, technical ambition, and whether it works." No rubric or weights appear on the official pages.

**Weights (REPORTED, screenai.es, citing "el acuerdo"):** "el acuerdo indica impacto (30 %), uso de herramientas de IA de Meta (25 %), profundidad técnica y ejecución (20 %) y calidad de la demostración (25 %)." In English:

| Criterion | Weight |
|---|---|
| Impact | 30% |
| Use of Meta AI tools | 25% |
| Technical depth and execution | 20% |
| Demo quality | 25% |

- BizCrush, summarizing AI Times (https://bizcru.sh/en/news/article/20261014-6399), lists the criteria without weights: clarity and feasibility of the idea, technical implementation ability, and practical operability. It also says Meta wants "working outcomes rather than simple demos."

**Strong precedent (VERIFIED for that event, not this one).** Cerebral Valley's earlier "Built with Opus 4.6" virtual hackathon (Feb 2026) used almost the same template. A finalist's repo copied the rules (https://huggingface.co/datasets/introvoyz041/postvisit/blob/main/data/docs/hackathon-rules.md):
- Weights: Demo 30%, Impact 25%, model use 25%, Depth & Execution 20%.
- Stage 1: asynchronous scoring by judges.
- Stage 2: the top 6 present pre-recorded 3-minute demos.

So the reported Meta weights fit the house style of Cerebral Valley's virtual hackathons.

**On the spec's "25/25 on Use of Meta AI Tooling":** if the reported weights hold, Meta-tool use is worth 25% of the score. Impact (30%) is the largest criterion, and demo quality is worth just as much as tool use. Using more models does not guarantee a top score here. In the Opus 4.6 rules, the equivalent criterion rewarded creative use beyond basic integration.

## 4. Submission requirements

- **VERIFIED:** submissions are due Nov 4, 9:00 PM ET. Nothing else about submissions is on the official pages.
- **Not yet published (VERIFIED absent):** video length, repo or demo URL, open-source or licensing rules, and rules on pre-existing code.
- **REPORTED (thegenaimagazine.com, labelled "likely" by its author):** a working demo on the Meta Model API, a 2–3 minute video, a public or shared repo with setup instructions, a short write-up and track selection.
- **REPORTED IP and licensing terms (screenai.es, describing the agreement):**
  - Participants keep ownership of their submission.
  - They grant organizers and affiliates a "non-exclusive, worldwide, royalty-free, perpetual, irrevocable" license to use it for any purpose.
  - A separate "Release of Information" grants a broad, sublicensable license to materials and ideas shared during the event.
  - Recordings and likeness may be used without compensation.
  - California law governs.
- **Cerebral Valley precedent (Opus 4.6 rules), likely similar but not confirmed for Meta:**
  - 3-minute maximum demo video on YouTube or Loom.
  - Public GitHub repo.
  - 100–200 word summary.
  - **"All projects must be started from scratch during the hackathon. Pre-existing work is not allowed."**
  - Everything shown must be open source.
  - Teams of up to 2.
- **Implication for the spec's pre-hackathon plan (Oct 21–25):** filming notebook clips and setting up API keys or the CLI is probably fine. **Do not write application code before the kickoff on Oct 26** until the Official Rules confirm whether pre-existing code is allowed. Re-check https://dev.meta.ai/events/global-hackathon and the Cerebral Valley page on Oct 25–26.
- **Required tooling (VERIFIED, both pages):** build with Meta's models via the Meta Model API (CV page: "Muse Spark series, Muse Wonder, Muse Image, and SAM 3.1"; dev.meta.ai omits Wonder), Meta open-weights models, and the Muse Code coding agent. BizCrush: participants "must use Meta's latest models and development tools."

## 5. Meta models, APIs, credits and docs

**Credits:**
- VERIFIED via the Meta for Developers tweet snippet and multiple secondary sources: **$150 in Meta Model API credits per selected participant.**
- REPORTED (screenai.es): the acceptance email also mentions Muse Code access, but no specific plan.
- VERIFIED (CV page) partner credits for "select participants":

| Partner | Credit | For |
|---|---|---|
| Baseten | $100 and 2M TPM | open-weights models |
| Modal | $100 | Endpoints, GPUs, sandboxes |
| Fireworks | $25 | plus a workshop by Sinan Ozdemir |

**API basics (VERIFIED, https://dev.meta.ai/docs/overview):**
- Base URL `https://api.meta.ai/v1`. Auth with `Authorization: Bearer $MODEL_API_KEY`.
- "drop-in compatible with the OpenAI SDK, the Anthropic SDK, and OpenAI-compatible agent CLIs."
- Endpoints: `POST /v1/responses`, Chat Completions, Messages, `/v1/images/generations`, `/v1/images/edits`, `wss://api.meta.ai/v1/asr/realtime`, `POST /v1/asr/transcribe`, `POST /v1/files`.
- Muse Code install: `curl -fsSL https://dev.meta.ai/install.sh | sh` (Windows: `irm https://dev.meta.ai/install.ps1 | iex`). Run it with `muse`.

**Models (VERIFIED, https://dev.meta.ai/docs/models; prices from https://dev.meta.ai/docs/pricing-rate-limits):**

| Model ID | In → Out | Price | Notes |
|---|---|---|---|
| `muse-wonder-1.0` | text, image, video, audio, PDF → text | $4 in / $20 out per 1M tokens | **Preview**. 1M context. Reasoning effort "minimal" to "max". 3,000 RPM |
| `muse-spark-1.3` | same | $1.25 / $4.25 | "Recommended for new work". Audio input "not fully supported" (use 1.2 for audio) |
| `muse-spark-1.3-contributor` | same | $0.10 / $0.20 | Your data may train Meta models. 150 RPM |
| `muse-spark-1.2`, `-1.1` | same | $1.25 / $4.25 | |
| `muse-image-1.0` | text, image → image | $0.01 per image | generations and **edits**. 150 RPM |
| `muse-voice-transcribe-1.0` | audio → text | $0.18 per hour | realtime WS or WAV file (≤10 min, ≤32 MB) |
| `sam-3.1` | text, box or point prompt plus image or video → boxes and masks | $2.50 per 1k images; $0.20 per 1k video frames | 3,000 RPM |
| Muse Spark Open, Muse Glimmer | open weights, self-hosted | n/a | Glimmer is ~30B and runs on one GPU or a Mac Mini (Connect recap) |

**Doc URLs (VERIFIED, linked from the overview page):**

| Topic | URL |
|---|---|
| Quickstart | https://dev.meta.ai/docs/quickstart |
| Models | https://dev.meta.ai/docs/models |
| Pricing and rate limits | https://dev.meta.ai/docs/pricing-rate-limits |
| SAM overview | https://dev.meta.ai/docs/sam/overview |
| Media segmentation | https://dev.meta.ai/docs/media-segmentation |
| Image generation | https://dev.meta.ai/docs/image-generation |
| Image edit API | https://dev.meta.ai/docs/api-reference/images/edit-image |
| Speech to text | https://dev.meta.ai/docs/speech-to-text |
| Realtime voice API | https://dev.meta.ai/docs/api-reference/voice/realtime |
| File handling | https://dev.meta.ai/docs/file-handling |
| Structured output | https://dev.meta.ai/docs/structured-output |
| Muse Code | https://dev.meta.ai/docs/muse-code |
| SAM 3.1 model page | https://dev.meta.ai/models/sam-3-1 |
| Cookbook | https://github.com/meta-models |

**Facts that contradict or refine the SnapLab spec (VERIFIED from the docs):**

1. **SAM 3.1 output format**
   - Output is not JSON. It arrives as **special-token text in the `output_text` stream**, for example `<0f>0<|box;...|><|mask;...|>`. Boxes are in **source pixels, not normalized 0–1**.
   - Parse it with `@meta-sam/parser`:
     - `parseImageStream(events).finalResult`
     - `recordsOfKind(..., "mask")`
     - `decodeMaskToRaster`
   - The overview page does not mention confidence scores.
   - The rule of one short noun phrase per request is correct. Use parallel requests for multiple classes, as the spec does.
   - Zero matches comes back as an empty `output_text`.
   - Video input must be MP4 or MOV.
2. **Muse Voice Transcribe languages**
   - The 25 validated languages include English but **not Nigerian Pidgin, Yoruba, Hausa or Igbo**. The model was trained on "70+" languages, which are not listed.
   - Biasing uses `languageBias` and `keywords`, both set **at session start only**.
   - Realtime audio must be PCM16 mono at 16 or 24 kHz.
   - Sessions last at most 60 min. Send the handshake within 10 s.
   - Modes: PUSH_TO_TALK, ENDPOINTING, DIARIZATION.
   - Turn-level timestamps only.
   - A Pidgin "viva" may transcribe poorly. Test early and keep an English fallback.
3. **Structured output**
   - On the Responses API, the parameter is `text.format` (json_schema). `strict` defaults to false.
   - The strict subset requires `additionalProperties:false` on every object and every property listed in `required`.
   - No recursion. Nesting depth at most 10.
   - The docs do not say which models support it.
4. **Budget**
   - $150 in credits goes fast on Muse Wonder at high reasoning effort: about $0.50 for a call with 100K input and 5K output tokens (screenai's worked example).
   - Use Spark, or Spark-contributor, for iteration. Cache SAM results.

## 6. Judges

**Not announced** on any official page (VERIFIED absent as of 2026-10-21).
- Judging runs Nov 4–8, with live finals on Nov 9.
- Workshops are run by Meta Superintelligence Labs engineers (Connect recap) and partners (the Fireworks workshop by Sinan Ozdemir).

## 7. Past Meta, Llama and Cerebral Valley events

**Llama Impact Hackathon, London, Nov 2024 (Meta with Cerebral Valley).** Source: https://about.fb.com/news/2024/11/metas-llama-impact-hackathon-pioneering-ai-solutions-for-public-good/
- Themes were healthcare, clean energy and social mobility, aligned to UK government missions. The top 3 shared $50K plus mentorship.
- 1st, **Guardian:** an NHS A&E triage assistant with a multilingual patient agent.
- 2nd, **Gripmind:** Llama 3.2 Vision robotic arm control for assisted living.
- 3rd, **Pharmallama:** an on-device pharmacist and patient medication app.

**LlamaCon Hackathon, San Francisco, May 2025.** Source: https://ai.meta.com/blog/llamacon-hackathon/
- About $35K in prizes. 44 submissions were cut to 6 finalists over two judging rounds.
- 1st, **OrgLens:** knowledge-graph expert matching.
- 2nd, **Compliance Wizards:** fraud detection with a voice assistant.
- 3rd, **Llama CCTV Operator:** natural-language surveillance event detection using Llama 4 vision.
- Best Llama API Usage, **Geo-ML:** 400-page geology reports turned into structured data and 3D subsurface models. **This is the closest precedent to SnapLab's document-to-3D idea.**
- Common traits: practical domain problems, heavy multimodal use, public GitHub repos and recorded demos.

**First Meta Llama 3 Hackathon (Cerebral Valley, 2024).** Source: https://ai.meta.com/blog/llama-3-hackathon-recap-cerebral-valley/
- 1st, **OpenGlass:** $20 smart glasses that identify objects and calories.
- 2nd, **Deb8:** an agent debate arena.
- 3rd: activation-ablation jailbreak research.

**Llama Impact Grants, first global round.** Source: https://techeconomy.ng/meta-unveils-recipients-of-inaugural-llama-impact-grants
- $500K, **Digital Green:** Farmer Chat for African smallholders.
- $300K, **Jacaranda Health:** maternal health, Kenya and Ghana.
- $35K Innovation Awards:
  - **HelpMum:** Vax-Llama, a vaccine information tool. HelpMum is generally known as a Nigerian NGO, but the article states no country.
  - **Twiga (Tanzania AI Community):** a WhatsApp assistant that generates curriculum-aligned exams and lesson notes for Tanzanian teachers. **This is an education precedent from Africa.**
  - **phosoAI (Malawi):** Chichewa voice and WhatsApp food-price information.

**Llama Impact Accelerator, Sub-Saharan Africa 2025 (Meta with Data Science Africa).** Source: https://brandspurng.com/2025/11/03/meet-the-winners-of-the-meta-llama-impact-accelerator-program-from-sub-saharan-africa/

Nigeria's winners:

| Place | Winner | Project | Prize |
|---|---|---|---|
| 1st | MARMAR | AI EMR to prevent medication errors | $25K |
| 2nd | Purple Labs | MediSync diagnostics | $15K |
| 3rd | **DAWN AI Study** | **education:** early learner assessment and emotional and cognitive support | $10K |

- Other countries' winners include Kajou (Senegal, offline e-learning for health workers) and Four Minute Medicine (South Africa, AI simulation training).

**Cerebral Valley's "Built with Opus 4.6" virtual hackathon, Feb 2026: same organizer and format.** Source: https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon
- 13,000+ applicants, 500 selected, 227 projects, 6 finalists.
- Winners were mostly **domain experts solving problems from their own work**, and 4 of 5 were not professional developers.
- 2nd place, **Elisa:** a kids' visual IDE with an age-appropriate teaching engine. **This is an education winner.**
- Special prize, **TARA (Uganda):** dashcam footage turned into road investment appraisals. **This is an Africa winner.**

**Patterns across winners:**
1. The builder knew the problem firsthand. This matches the "Build for Your World" theme and suits a Nigerian WAEC builder.
2. A working, live-feeling demo with a tight 3-minute story.
3. Multimodal input (vision or documents) turned into a structured or 3D output.
4. A public repo and a recorded video.
5. A clear group of beneficiaries. Education and Africa projects have won prizes at Cerebral Valley and Meta events, but there is no evidence of a dedicated education or Africa prize in this hackathon.

## Status of the spec's claims

| Spec claim | Status |
|---|---|
| Dates Oct 26 – Nov 4, 2026 | VERIFIED |
| $1M in prizes | VERIFIED |
| Organized with Cerebral Valley | VERIFIED |
| Theme "Build for Your World" | VERIFIED |
| Indie track $400K, 1st place $150K | REPORTED (single secondary source citing the agreement) |
| $50K bonus pool | REPORTED (discretionary, no stated criteria) |
| $50K bonus is a "Community/Viral" prize won by tagging @MetaAI or @cerebral_valley | **UNVERIFIED** |
| Scoring "25/25 on Use of Meta AI Tooling" | Weight of 25% is REPORTED. Any judge's score is speculation |
| Deadline "2:00 AM WAT" | **Incorrect.** It is 3:00 AM WAT on Thu Nov 5 (9:00 PM EST Nov 4) |
| Kickoff 5:00 PM WAT | Consistent with the 12:00 PM ET header |
| Model IDs `sam-3.1`, `muse-wonder-1.0`, `muse-spark-1.3`, `muse-voice-transcribe-1.0`, `muse-image-1.0`; endpoints `/v1/responses`, `/v1/images/edits`, `wss://api.meta.ai/v1/asr/realtime`, `/v1/files` | VERIFIED |
| SAM returns JSON boxes in [0,1] with scores | **Incorrect.** Output is special-token text, boxes in source pixels, parsed with `@meta-sam/parser` |
| Muse Voice Transcribe handles Nigerian Pidgin | **UNVERIFIED.** Pidgin is not among the 25 validated languages |
| Judges in SF | No judges announced. Finals are a live, likely virtual, ceremony on Nov 9 |
