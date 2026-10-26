# 08 · Risks, Bottlenecks and Mitigations

*Ranked by likelihood × impact. "Nothing should be a bottleneck" means every risk below has a named owner-action and a fallback that keeps the demo alive.*

---

## 1. Top risks

| # | Risk | Likelihood | Impact | Mitigation | Fallback if it still happens |
|---|---|---|---|---|---|
| 1 | **Scope overload.** The spec is a 3–4 person, 6-week system. Solo in 10 days you end with five half-features and no polished hero. | Very high | Critical | Cut lines in `09_BUILD_PLAN.md`. One experiment flawless by **Day 5**. Feature freeze end of Day 8. Never start a SHOULD while a MUST is shaky. | Ship the hero alone; the second experiment becomes a "preview" card. |
| 2 | **SAM 3.1 does not recognise biro sketches.** It is trained on photos; schematic symbols are out of distribution. | High | Medium (SAM is cosmetic in this design) | Day-1 spike on 30 real photos. Plan B: Spark boxes → SAM **box prompts**. | Outlines from blueprint boxes; honest "no match" row in the drawer. |
| 3 | **Spark misreads the page** (wrong experiment, invented values) | Medium | High | Experiment hint tap; few-shot golden examples; schema + physical clamps; `as_written` text; confidence field. | Template bench with defaults; "Is this a titration?" confirm. |
| 4 | **Wonder misreads handwriting** ("57" read as "57.0", "24.5" as "24.50", graph points or axis labels misread) | Medium | **Critical** (the hero moment depends on it) | Ask for `text_as_written` explicitly; legibility flag; confirmation step for unsure cells; golden pages written clearly. | Student types the readings; marking still works. |
| 5 | **Latency**: snap-to-lab 5–12 s from Lagos; Wonder 8–30 s | High | High | Local-first choreography; parallel calls; streaming; speculative readings; cache; golden replay. | Golden demos are instant and labelled honestly. |
| 6 | **The live demo fails during judging** (API outage, judge's network, credits drained) | Medium | Critical | Golden replay works offline; PWA precache; per-IP limits; daily spend cap; `DEMO_MODE` auto-switch; uptime monitor; check credits daily Nov 4–9. | Site flips to golden-only with a visible banner; recorded video exists from Day 5. |
| 7 | **Low-end Android performance** (PowerVR/Mali-G52, 2–3 GB RAM) | High | Medium–High | WebGL2 only; quality tiers; fake glass; DPR clamp; particle caps; context-loss recovery. **Get a ₦80–150k test phone before Oct 26.** | Lite mode (2D). |
| 8 | **iOS Safari quirks** on judges' iPhones (camera, audio unlock, gyro permission, in-app browsers, memory) | Medium–High | High | One "Start lab" tap unlocks audio and gyro; in-app-browser banner; file-picker fallback; test on a real iPhone on Day 5 and Day 9. | Slider instead of gyro; typed answers instead of voice. |
| 9 | **Voice quality**: Pidgin not supported, accents, noisy rooms, no Meta TTS | High | Medium | Push-to-talk; WAEC keywords; charitable interpretation prompt; optional Spark 1.2 audio path; browser TTS + captions. | Typed answers (always visible). |
| 10 | **Scientific errors a teacher spots** | Medium (High with the spec's model) | High | The corrected engine in `07_SCIENCE_ENGINE.md`; unit tests against textbook and WAEC model answers; a Nigerian science teacher reviews the golden runs on Day 8. | "Teacher notes" panel shows assumptions openly. |
| 11 | **Rules and eligibility**: pre-existing code clause, API access from Nigeria, filming minors, deadline time zone | Medium | Critical | No app code before Oct 26; confirm a working key from Nigeria now; written consent or hands-only footage; submit by 18:00 WAT Nov 4. | If the API is geo-blocked, ask organisers on Discord immediately; a VPN is a last resort only if the rules allow it. |
| 12 | **Toolchain time sinks** (Rust/wasm-pack, Next.js SSR, COOP/COEP, WebGPU/TSL, OpenCV.js) | High if kept | High | All cut. One language, one bundler, one renderer, one server. | — |
| 13 | **Visuals fall short of the concept images** (photoreal AI renders vs a web build) | High | High | "Holographic lab" art direction; a budgeted one-day beauty pass (Day 8); never show the concept renders as product screenshots. | Lean on choreography and bloom, not realism. |
| 14 | **Power and internet outages** during the build | Medium–High | High | UPS or inverter, power banks, two data SIMs (MTN + Airtel). Record API responses on Day 1 and **develop against local fixtures**. Push to GitHub several times a day; continuous deploys. | A deployed working build always exists. |
| 15 | **API key leak** via a `VITE_` variable or git history | Low–Medium | High | Key only in server secrets; gitleaks; GitHub secret scanning before the repo goes public. | Rotate the key immediately. |
| 16 | **Cheating-aid perception** (showing the expected titre or X) | Low | High with teachers | Never reveal the expected result; Teacher mode for accuracy. | — |
| 17 | **Metre bridge hero is harder than titration** (circuit solve, graph reading; decided Oct 22) | Medium | High | Opus writes the engine; science-verifier checks it; standard template circuit only; graph checked against her own table; "confirm your graph" step. Titration's trap and parallax drop to COULD. | Golden G1/G2 replays; on fresh uploads, mark the table only and show the graph checks as "confirm to mark". |

## 2. Bottleneck map ("nothing should be a bottleneck")

| Potential bottleneck | Where it would bite | How the design removes it |
|---|---|---|
| Network round trip before anything happens | First impression | The first second of magic is fully local |
| SAM before LLM (serial) | Snap-to-lab latency | Parallel calls; LLM reads the image directly |
| One big blueprint at the end | Perceived wait | Streamed, experiment type first, bench builds immediately |
| Handwriting reading at marking time | The hero moment | Speculative: started at snap time |
| Physics on the main thread | Frame rate | Microsecond pure functions; no worker needed |
| Shader compile on the first 3D frame | Stutter | Precompiled during the scan animation |
| Large downloads | Nigerian data costs | ≤ 2.5 MB first load; procedural assets; lazy chunks |
| A single API failure | Demo reliability | Every stage has a fallback; golden replay offline |
| Credits | Judging week | Rate limits, cache, spend cap, auto golden mode |
| One person's time | Everything | Hard cut lines and a Day-5 demo milestone |
