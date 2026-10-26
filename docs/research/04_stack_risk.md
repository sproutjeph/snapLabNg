# SnapLab NG — Tech Stack & Risk Review (Principal Engineer)

**Reviewed:** `SNAPLAB_NG_MASTER_ARCHITECTURE.md`, plus the concept renders `image.png` (meter bridge) and `image-2.png` (titration).
**Date:** 2026-10-21. **Build window:** Oct 26 – Nov 4, 2026, solo.
**Bottom line:** The product idea is strong and very demo-able. The architecture is not. Built as specified, it is a 3–4 person, 6-week system. Its biggest costs (Rust/WASM worker, SharedArrayBuffer, Next.js SSR, WebGPU/TSL, OpenCV.js live homography, Postgres/Redis/R2/Python) are invisible to judges and would use up the days that should go into the parts judges *see*: the snap-to-3D moment, the short-circuit spectacle, and the examiner. Cut hard, keep the story, and make the live demo impossible to break.

---

## 0. Facts checked before the review (things the spec gets wrong or leaves unverified)

| Spec claim | What the evidence shows | Consequence |
|---|---|---|
| Models `muse-wonder-1.0`, `muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`, `muse-image-1.0` on `api.meta.ai/v1` | **Confirmed** in the Meta Model API model docs. Spark 1.3 is "recommended for new work". Its doc says *"Audio input isn't fully supported — use muse-spark-1.2 for audio."* SAM 3.1 is on `POST /v1/responses`, with clips via the Files API. | The API plan is viable. If you send audio to an LLM, use Spark 1.2 for that. |
| "SAM 3.1 accepts **one** noun phrase per request" | Not stated in the docs. They only say a "short noun phrase" ("yellow school bus"). One prompt can return several instances. Results arrive in a text channel with markers, and **an empty result is valid**. | Fan-out is plausible, but check it on Day 1. Expect empty results on hand-drawn symbols (see Risk #2). |
| Voice Transcribe "listens continuously in Nigerian English **or Pidgin**", "99% accuracy" | 25 bias languages. **Pidgin and Nigerian languages are not listed**, and unlisted languages fall back to auto-detect. Keyword biasing exists (`keywords`) but "does not guarantee spelling". Modes are `ENDPOINTING`, `PUSH_TO_TALK` and `DIARIZATION`. The key goes in the **first handshake frame**, sessions are capped at 60 minutes, and audio is 16/24 kHz. | Promise Nigerian English with WAEC keyword biasing. Treat Pidgin as best-effort, and let the LLM interpret a messy transcript. The 99% claim should not appear in the pitch. |
| "Examiner speaks" (`vivaSpokenPrompt`) | **There is no Meta TTS model** in the catalogue. | The examiner's voice must come from the browser's `speechSynthesis`, or the examiner stays text-only. Plan for this. |
| Rate limits | About 3,000 RPM and 4M TPM per model per team for Wonder and Spark (third-party summary). 429 responses carry `x-ratelimit-*` and `Retry-After`. Spark 1.3 costs about a third of Wonder. Hackathon gives **$150 in credits** per participant. | Throughput is not the problem. **Latency and credit burn from a public URL** are. |
| Compile in "< 2.2 s" with `muse-wonder-1.0` at `reasoning: high` | No published latency. A multimodal request with high reasoning and a big strict schema realistically takes **5–30 s**. | Use Spark 1.3 at low effort for the interactive compile. Use Wonder only for the slower background audit (§5). |
| Deadline "2:00 AM WAT / 9:00 PM EST" | Official: **Nov 4, 9:00 PM ET**. US DST ends Nov 1, so that is EST = **03:00 WAT on Nov 5**. | The spec's time is harmless because it is one hour early. Aim for 18:00 WAT on Nov 4 anyway. |
| "Indie track $400k pool, 1st $150k, $50k viral bonus" | The official page confirms a $1M total across **Indie** and **Startup** tracks. **No per-track split is published.** Indie is judged on *"creativity, technical ambition, and whether the project works."* | "Whether it works" is a stated judging criterion, which strongly favours the reliability changes below. Don't quote unverified prize numbers in the pitch. |
| Pre-written code | **Not addressed** on the event page. The Official Rules were "to be published before Oct 26". Applications close **Oct 25, 11:59 PM ET**. | **Action today:** confirm the application is submitted. When the rules appear, read the pre-existing-code clause before writing anything (§9). |

---

## 1. Overengineering vs value: Rust/WASM, Worker, SharedArrayBuffer, 120 Hz

### Verdict: cut it. Everything in the spec's physics core is closed-form and runs in under 1 µs in plain TypeScript.

- **What the spec's Rust actually computes.** The meter bridge is roughly 15 floating-point operations: a balance ratio, a parallel resistance, one Euler step of Newton cooling. The titration is about 10 operations plus a `log10` and an RGB lerp. Plain TS does this in well under a microsecond. **The 0.08 ms per-frame budget is already met about 100× over by plain TS.** Nothing here involves a "differential equation solver".
- **The JSON boundary makes WASM slower than TS.** `step_meter_bridge_physics(input_json: &str) -> String` would do this every tick: `JSON.stringify` in JS, copy UTF-16 to UTF-8 into linear memory, `serde_json::from_str`, compute, `serde_json::to_string`, copy back, then `JSON.parse`. That is **two allocations and two parses per frame, around 10–50 µs**, which creates the very GC pressure the spec says it avoids. One 2026 write-up measured Rust/WASM at **2.2–4.6× slower** than equivalent TS for this pattern, and found `serde-wasm-bindgen` a further ~30% slower ("the boundary was the bottleneck"). There is also a correctness hazard: `.unwrap()` on a parse error **panics, the WASM module traps, and the physics stops for the rest of the session.**
- **A Worker plus SharedArrayBuffer at "locked 120 Hz" doesn't fit the use case.** A worker's `setInterval` drifts. Locking needs `Atomics.wait` busy-loops, which burn battery on a phone. The renderer reads at the display rate anyway (60 Hz on iOS, see §2). The right pattern is a **fixed-step accumulator inside `useFrame`**: run N substeps of `dt = 1/120` per rendered frame. That gives deterministic 120 Hz physics with no thread, no SAB and no headers.
- **What COOP/COEP costs you.** SharedArrayBuffer needs cross-origin isolation: `Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`.
  - **Safari does not support `credentialless`**, and judges use Safari, so you are forced into `require-corp`. Then every cross-origin image, script or model without a CORP or CORS header fails silently. That includes R2 public URLs, MediaPipe's `.task` and `.wasm` files from the Google CDN, any drei `Environment` preset pulled from a CDN, analytics, and a YouTube embed of your own demo video.
  - `COOP: same-origin` cuts `window.opener`, which breaks OAuth and payment popups if you ever add sign-in.
  - It also adds config to Next, Vercel or Pages and the dev server, and causes "works locally, blank in prod" debugging. It buys nothing visible.
- **Toolchain cost for a solo dev.** You would need wasm-pack, a wasm target in the bundler (Next and Turbopack have historically had friction with `wasm-bindgen` output), a Rust toolchain in CI and in the Docker build, plus two languages to debug at 2 a.m. **That is at least one full day, about 10% of the build, for zero visible output.** The plan has Day 2 doing exactly this.

### What, if anything, should be Rust/WASM?
| Candidate | Worth WASM? | Reasoning |
|---|---|---|
| Meter bridge, Wheatstone, potentiometer formulas | **No** | Closed form. |
| Titration pH and indicator colour | **No** | Closed form. A proper charge-balance solver (bisection on [H⁺] for carbonate's two pKa values) is ~40 lines of TS and takes microseconds. It is also **easier to correct in TS** when a chemistry-literate judge notices that the spec's pH curve for Na₂CO₃ ignores the buffer regions. |
| WAEC least-squares graph, 2/3 slope-triangle check | **No** | Fewer than 20 points. |
| **General MNA solver for arbitrary hand-drawn circuits** | **Defensible but not needed** | Dense LU on a 10–50 node MNA matrix is ≤ ~40k FLOPs, still microseconds in TS. It only becomes a WASM case at hundreds of nodes, or with transient simulation of many reactive elements. If you want a "systems" talking point, write MNA in Rust and **call it only when topology or parameters change** (not per frame), with `Float64Array` in and out, on the main thread, no SAB. It is a **Could** item, Day 9 at the earliest, and only if everything else is done. |
| Image processing (rectification, ink extraction) | **No** | Do it in a WebGL fragment shader or on a 512 px canvas in JS. The GPU is already there. |

**Recommendation:** use a `physics/` folder of pure, side-effect-free TS functions (`stepMeterBridge(state, dt)`, `titrationPh(params, vAdded)`), covered by **Vitest property tests**, which is a stronger determinism story than "Rust". Keep the state in a mutable object read inside `useFrame`, not React state. Describe it in the pitch as a "deterministic, unit-tested physics core separated from the AI".

---

## 2. Frontend: Next.js vs Vite, R3F stack, WebGPU vs WebGL2, FPS, bundle, 3D assets

### 2.1 Next.js 15 App Router vs Vite SPA → **Vite + React 19 SPA**
- The app is a single full-screen canvas with camera, mic and WebGL. There is **nothing to server-render**. Every 3D component would need `"use client"` plus `dynamic(..., { ssr: false })`, and you would spend time on hydration warnings, `window is undefined` errors, RSC/client boundary mistakes, and adding COOP/COEP and wasm to `next.config`.
- Vite produces a plain static `dist/` that deploys anywhere (Cloudflare Pages has a Lagos PoP), integrates trivially with `vite-plugin-pwa`, and gives faster HMR with heavy `three` imports.
- SEO and a marketing landing page are not judging criteria. A static `index.html` hero section is enough.
- **Keep Zustand**, with transient `subscribe`/`getState()` reads inside `useFrame`. That part of the spec is right.

### 2.2 React Three Fiber + drei + postprocessing → **keep, on the classic `WebGLRenderer`**
- R3F v9, drei (import only what you use), and `@react-three/postprocessing` with **selective Bloom** for the glowing wire, sparks and SAM footprints.
- The cheapest high-impact effects are Bloom, an `Environment` built from **`<Lightformer>`s** (procedural, no HDRI download, no CDN), `ContactShadows`, a fresnel "hologram" rim, and a scanline/dissolve shader for materialisation.
- **Glass is expensive.** drei's `MeshTransmissionMaterial` and `MeshPhysicalMaterial.transmission` add an extra scene render per frame. Use them on the high tier only, and a fresnel plus env-map plus opacity "fake glass" shader on low and mid tiers. A burette reads as glass mostly from **thin bright rim highlights and graduation markings**, not true refraction.

### 2.3 WebGPU (WebGPURenderer + TSL) vs WebGL2 → **WebGL2 now, no WebGPU**
- **Device reality:**
  - Chrome Android has WebGPU on **Android 12+ with Qualcomm or ARM (Mali) GPUs**. Imagination **PowerVR** GPUs are not on that list; they appear in many budget MediaTek Helio A/G-series (e.g. GE8320 on Helio G35/G37/A22) phones sold as itel, Tecno Pop/Spark and Infinix Smart. Many of those phones also run Android 11 Go.
  - Chrome 146 started a WebGPU "compatibility mode" on GLES 3.1, but that requires opt-in and has restrictions.
  - Safari has WebGPU since **iOS/macOS 26**. Older iPhones fall back. Firefox Android has none.
  - Nigeria's phone market is Tecno 23.6%, Infinix 21.7%, Samsung 12.4%, Apple 9.4%, Xiaomi 7.2%, itel 5.4% (StatCounter, Feb 2025). **Roughly half your target users are on Transsion budget hardware.**
- **three.js's own manual** still calls `WebGPURenderer` *experimental* and recommends `WebGLRenderer` for pure WebGL2 projects. On `WebGPURenderer`:
  - `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` **don't work on either backend**, and the mesh renders nothing. The spec's `wireThermal.glsl` and `flaskSwirl.glsl` would have to be rewritten in TSL.
  - `@react-three/postprocessing`, drei `Text`, and `Environment` with children **do not work**.
  - First-use pipeline compile stutters unless you `compileAsync`.
- This scene is under 100 draw calls with a few thousand particles. **WebGPU buys no visible frame time here.** It costs a shader rewrite, loses the pmndrs ecosystem, and adds a second backend to test.
- Mentioning "WebGPU" impresses no judge if the demo hitches. **Decision: `WebGLRenderer` + GLSL.** Revisit only after the hackathon.

### 2.4 FPS targets (drop "120 FPS" from the pitch)
- **iOS Safari caps `requestAnimationFrame` at ~60 Hz by default.** The "Prefer Page Rendering Updates near 60fps" flag is on, and a macOS 26 web app was reported stuck at 60 even with it off. 120 FPS is only reachable on 120 Hz desktop or Android displays in Chrome. A judge with an FPS overlay on an iPhone would show the claim is false.
- **Realistic, credible targets:**
  - 60 FPS on MacBook and iPhone.
  - 45–60 FPS on mid-range Android (Helio G85–G99, Snapdragon 6-series).
  - **30 FPS** on low tier (Helio G35/A22 PowerVR, 2–3 GB RAM), with bloom off, DPR 1 and fake glass.
  - Physics at a fixed 120 Hz substep regardless of display rate. That is the honest claim: *"physics at 120 Hz, rendering at your display's refresh rate."*
- **Mechanism:** drei `<PerformanceMonitor>` with `onDecline` stepping down tiers, `<AdaptiveDpr>`, `dpr={[1, 1.5]}` on mobile, `frameloop="demand"` on idle screens, and **WebGL context-loss handling** (`webglcontextlost` → show a "tap to reload scene" overlay). Low-RAM Android tabs do get killed.

### 2.5 Bundle and asset budget (Nigerian data is roughly ₦300–750 per GB after the Jan 2025 50% tariff hike)
| Item | Budget (gz/br over the wire) | Notes |
|---|---|---|
| App JS (React, R3F, three, drei subset, postprocessing, zustand) | **≤ 350 KB** initial | Route-split capture, lab, graph and viva. three is the biggest chunk. |
| 3D models + textures | **≤ 1.5 MB** total | Mostly procedural, so close to 0 KB. |
| Environment lighting | **0 KB** | `<Lightformer>`s, no HDRI. |
| Golden demo pack (3 notebook images at 1024 px WebP plus blueprint JSON) | ≤ 600 KB | Prefetched after first paint. |
| MediaPipe hand landmarker (lazy, only if the gesture toggle is on) | ~7.8 MB `.task` + several MB of wasm | **Never in the default path.** |
| OpenCV.js | ~8–10 MB | **Not shipped** (see §3). |
| **First visit to the golden demo** | **≤ 2.5 MB** | ≈ ₦1–2 of data. The spec's stack (OpenCV + MediaPipe + WASM + HDRIs) would be 20 MB+. |

### 2.6 3D asset pipeline: **procedural first, AI-generated for one or two hero props, CC0 as backup**
- **Procedural (recommended for 90% of apparatus, about 1 day total).** Procedural geometry is crisp at any scale, weighs 0 KB, and is trivially animatable for the "extrude from ink" dissolve.
  - `LatheGeometry` from a 2D profile: burette, conical flask, pipette, beaker, measuring cylinder.
  - `TubeGeometry` along a `CatmullRomCurve3`: wires and the constantan wire.
  - `RoundedBox` plus cylinders: resistance box (brass plugs, ebonite top), meter bridge base with metre-rule texture (CanvasTexture graduations), jockey, plug key, Leclanché cell, retort stand and clamp.
  - Galvanometer: a rounded box, a `CanvasTexture` dial drawn at runtime with the µA scale, and a needle mesh driven by a damped spring.
- **AI 3D for one or two hero props, offline and pre-baked.** Meta's own **SAM 3D Objects** (open weights; hosted on Runware, Scenario and Layer) turns a photo of a real galvanometer or resistance box into a mesh. That is a bonus Meta-tooling story ("even our assets came from SAM 3D"). Alternatives are Meshy, Tripo or Hunyuan3D. Expect to clean up topology and UVs in Blender, so cap this at **half a day**. If the mesh is ugly, fall back to procedural.
- **CC0/low-cost backups:** Sketchfab (CC-BY or CC0 filter), Poly Pizza, CGTrader free lab sets, OpenGameArt "lab assets". Check each licence.
- **Optimisation:**
  - `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp`. **Meshopt's decoder is about 20 KB; Draco's is about 300 KB**, so prefer Meshopt.
  - Use KTX2/Basis only if GPU memory on 2–3 GB phones becomes the problem. It needs the Basis transcoder (~200 KB wasm).
  - `gltfjsx --transform` generates typed R3F components.
- **Art direction protects you from the "toy" look.** The concept renders (`image.png`, `image-2.png`) are photoreal AI images that no 10-day web build will match. Instead go deliberately **"holographic lab"**: fresnel rims, bloom, scanline materialisation, cyan and green footprints, emissive wire pulses. Then brass and glass only need to look good, not real. It reads as intentional and stays fast on low-end GPUs.

---

## 3. Computer vision: what's actually needed

### 3.1 Live AR tracking of the paper → **not needed. Use a one-shot scan plus a virtual desk.**
- The spec has OpenCV.js computing homography at 60 FPS.
  - **Cost:** about 8–10 MB of wasm, more than a second of compile on mid-range phones, a separate CPU pipeline competing with WebGL on 4–8 slow cores, jitter that needs filtering, and corner loss whenever a hand covers the page. Solo, that is 2–3 days to get stable.
  - **Benefit:** the apparatus "stays locked" as the camera moves. That is a nice-to-have nobody uses while reading a burette.
- **WebXR is no help.** Chrome Android's WebXR AR needs ARCore-certified devices (few Tecno, Infinix or itel models) and **does not support image tracking** (Augmented Images is not in WebXR). iOS Safari has no WebXR AR at all.
- **Recommended capture flow (robust on every device):**
  1. `getUserMedia` live preview with a page-shaped guide overlay and a "hold steady" indicator (simple frame-difference sharpness check). Capture a full-resolution frame. Offer a file-picker fallback, since iOS can deny the camera.
  2. **Corner detection with no dependencies, about 150 lines of TS.**
     - Downscale to 256 px. Classify "paper" pixels as bright and low-saturation. Keep the largest connected blob. Take the quad from its extreme points (min/max of x+y and x−y), then refine.
     - Always show **draggable corner handles** so the user can confirm or fix, like CamScanner. That makes it bullet-proof.
     - Optionally ask SAM 3.1 for `"sheet of paper"` in the server fan-out to validate the quad.
     - If you want a library, jscanify does this but pulls in OpenCV.js. Lazy-load it only on the capture screen, if at all.
  3. **Homography by DLT:** an 8×8 linear solve in TS (about 40 lines). **Rectify in a fragment shader** using a projective texture lookup, which is instant on GPU.
  4. **Ink extraction in the same shader pass.**
     - Biro is darker and more saturated than the faint ruled lines.
     - Hue-reject the red margin line.
     - Use a local-mean adaptive threshold to cancel lighting gradients.
     - Output is an **ink mask texture** at 1024 px. Tune the thresholds on the 30 real photos from the pre-hackathon shoot (§9).
- **Optional "AR feel" for under half a day:** after building, show the live camera feed behind a semi-transparent desk and drive the virtual camera with **DeviceOrientation** (3-DoF gyro parallax). Small hand movements make the hologram feel anchored. iOS needs `DeviceOrientationEvent.requestPermission()` from a tap. This also gives the meniscus-parallax mechanic for free: tilt the phone to eye level.

### 3.2 Making "apparatus extrudes out of the ink lines" look magical but robust
The magic comes from **choreography**, not detection accuracy. Decouple the two:
1. **Instant, local, zero network (0–800 ms):**
   - The rectified page flies from the camera view and lays flat onto a 3D desk, with the camera tilting to a 3/4 view.
   - A scan line sweeps across. **Ink pixels glow cyan** as it passes (ink mask × emissive).
   - The ink lines lift a few millimetres as a displaced height field or GPU point sprites sampled from the ink mask.
   - This happens **before the server answers** and works with no network at all.
2. **When `experimentMode` streams in (1–3 s):** particles sampled from the ink mask **flow toward the template positions** of each apparatus, and each apparatus **materialises** with a noise-threshold dissolve plus `uExtrusionProgress` rising from the page plane. The spec's vertex-Y scale is fine, but add the dissolve, because a pure Y-scale looks like a 2010 bar chart.
3. **When SAM boxes arrive (opportunistic):** green footprint rectangles snap onto the matching ink regions with a pulse ("SAM 3.1" label). If SAM returns nothing for a component, place it on its **template slot** and show the footprint around the LLM's approximate box instead.
4. **Layout = template-snapped, AI-parameterised.** Each experiment has a canonical bench layout, which is how WAEC apparatus is physically arranged anyway. The AI decides *which* experiment and components are present, the *values* written on the page (R = 5.0 Ω, 0.1 M HCl), the *topology errors* (ammeter in parallel), and the *approximate* page positions used for the footprints and particle sources. Exact per-component placement from sketches is a research problem; you don't need it for the wow.

### 3.3 Hand tracking (MediaPipe Tasks Vision HandLandmarker) → **Could tier, desktop-first**
- **Costs:** a 7.8 MB `hand_landmarker.task` plus several MB of wasm.
- **Performance:** historical numbers are roughly 60 FPS on a 2019 MacBook, but Pixel 5 at 15–19 FPS and iPhone 11 at 5–8 FPS, before you also render a bloom scene. Current Tasks Vision is faster, but on Helio-class phones expect contention with WebGL.
- **Use it for:** "slide finger to move jockey" and "pinch to open stopcock" on a **laptop webcam** in the demo video. Primary control everywhere is **touch and drag**, which is more precise, especially for dropwise burette control.
- **Implementation notes:** `runningMode: "VIDEO"`, lite model, run detection every other frame, add a One-Euro filter on the pinch distance, lazy-load on toggle. **Skip it entirely** if Day 8 is behind.

---

## 4. Backend: what to cut and what to deploy

| Spec component | Keep? | Why |
|---|---|---|
| **Bun + Hono (TypeScript)** | **Keep** | Small, fast to write, and Hono is portable (Bun, Node, Workers). "4× faster than Node" is irrelevant, because every request is bound by Meta API latency. |
| PostgreSQL + Drizzle | **Cut** | The rubrics are a static JSON file bundled with the server (and client). Student sessions can live in client IndexedDB. Nothing needs relational queries, and a database adds migrations, connection limits and another thing to break. |
| Upstash Redis | **Cut** | Use an in-memory LRU (`Map` with a cap) keyed by image hash on a single always-on instance, plus **static golden files**. |
| Cloudflare R2 | **Cut** | Send the compressed JPEG (≤ 300 KB) straight to `POST /v1/files` (one upload, then reuse the `file_id` across the SAM fan-out and the LLM call), or inline as base64. R2 adds signed URLs, CORS and CORP headers, and a bucket to secure. |
| Python FastAPI + OpenCV | **Cut** | All CV is client-side (§3). A second runtime and deploy is pure overhead. |
| WebSocket ASR relay | **Keep, minimal** | The key must not reach the browser, and the API takes the bearer in the first frame with no ephemeral-token mechanism documented. The relay is about 60 lines: accept the client WS, open the upstream WS, send the config frame (model, `language: English`, `keywords: WAEC list`, `mode: PUSH_TO_TALK`), then pipe binary PCM16 frames both ways. |

**Endpoints (the entire API):**
- `POST /api/snap` returns a **Server-Sent Events** stream of pipeline events (§5).
- `GET /ws/viva` is the ASR relay. On a final transcript the server calls Spark 1.3 (low effort) and pushes the examiner turn down the same socket.
- `POST /api/audit` sends the deterministic audit results plus the readings table to Spark 1.3 for examiner-style feedback text. Wonder is optional here, since this path is not latency-critical.
- `GET /healthz`.

**Deploy:**
- **Frontend:** Cloudflare Pages (free, global CDN with a Lagos PoP, custom headers file, instant rollbacks). Vercel is equivalent, but **Vercel functions cannot host WebSocket servers**, so the API cannot go there.
- **API:** one Bun container on **Fly.io** (`min_machines_running = 1`, `auto_stop_machines = false`, so **no cold starts**), or **Railway**, or **Cloud Run** (`--min-instances=1`, WebSockets supported, 60-minute request timeout).
  - **Avoid Render's free tier**, which sleeps and takes about 50 s to cold start; that would kill a live demo.
  - **Region:** measure from Lagos on Day 1 with a 10-line curl timing script against the Meta API from candidate regions (US-East, London/Amsterdam, Johannesburg). Generally put the server **near the Meta API**, because one client hop is cheaper than 5–8 fan-out hops.
  - Alternative: Hono on **Cloudflare Workers** (near-zero cold start, supports outbound WebSockets). This needs the $5 paid plan, because the free plan's 10 ms CPU limit is too tight for parsing mask JSON, and Bun-specific APIs are off-limits. A good choice if you prefer a single platform.
- **Secrets:**
  - `MODEL_API_KEY` lives only in Fly/Railway secrets, never under a `VITE_` prefix (Vite inlines `VITE_*` into the bundle, which is the most common key-leak mistake).
  - `.env` is gitignored, with `.env.example` committed. Run **gitleaks** or GitHub secret scanning before making the repo public.
- **Protect the $150 credit:**
  - Per-IP token bucket (e.g. 10 snaps per hour, 30 viva turns per hour) in memory.
  - A global daily spend cap counter.
  - A `DEMO_MODE=golden` kill switch that serves only cached and golden results.
  - Without this, a viral post of your demo URL can **drain the credits in hours**, and the live demo dies during judging.
- **Privacy:** the users are minors. Don't store photos or voice server-side. Use the documented `zdr_override` option if it applies, and say "we don't store your notebook or voice" in the UI. That is good for the "responsible" angle.

---

## 5. End-to-end latency budget for "snap to 3D", and how to hide it

### 5.1 Realistic budget (P50 to P95)
| Step | Judge (US/EU, wifi) | Student (Lagos 4G) | Notes |
|---|---|---|---|
| Capture, local rectify, ink mask, JPEG compress (1280 px, q≈0.8, ~200–300 KB) | 0.1–0.4 s | 0.2–0.8 s | All GPU or canvas. |
| Upload to API | 0.1–0.3 s | 0.5–3 s | Nigerian uplinks are often 1–5 Mbps. Never upload full-resolution camera frames (3–5 MB). |
| Server → Meta Files upload | 0.2–0.6 s | same | Or inline base64 to skip it. |
| **In parallel:** SAM 3.1 fan-out (5–8 prompts) **and** Spark 1.3 compile | SAM ~1–4 s; Spark (low effort, image + strict schema, ~1–1.5k output tokens) ~2–6 s | same | Unmeasured; the Day-1 spike measures them. |
| Wonder 1.0 high-effort compile (spec) | **8–30 s** | same | **Not on the interactive path.** |
| Client builds scene (procedural meshes, shader precompile) | 0.1–0.5 s | 0.3–1.5 s | Precompile all materials during the scan animation (`gl.compile(scene, camera)`). |
| **Total to fully parameterised lab** | **~3–8 s** | **~5–12 s** | The spec's "< 2.2 s" is not achievable. |

**Key structural fix.** The spec runs SAM, then feeds the masks into the LLM: **serial**. Muse models are natively multimodal, so give the LLM the **image directly** and run SAM **concurrently** only for the visual footprints. Merge on the client. That removes about 2–4 s from the critical path.

### 5.2 Hiding latency
1. **Choreographed progressive reveal.** The local animation in §3.2 fills 0–3 s with real, meaningful motion (page flattening, ink glowing). Users perceive this as the AI "reading" the page.
2. **Stream the compile.** Put `experimentMode` and the component list **first in the schema property order**. Use streaming responses and incrementally parse the partial JSON (a tolerant partial-JSON parser; re-parse only the tail). Start materialising the bench template as soon as `experimentMode` arrives.
3. **SSE event protocol from the server:** `page_ok`, `mode`, `component[i]`, `sam_box[label]`, `params`, `deductions`, `done`, `error{stage}`. The client renders each event as it lands.
4. **Optimistic local defaults.** The user may pick "Meter Bridge / Titration" before snapping (one tap, and it also shrinks the SAM vocabulary). The template then appears at about 1 s with default values, and AI values "tick in" when they arrive (the counter roll from 0 to 5.0 Ω looks great).
5. **Cache by hash.** SHA-256 of the downscaled JPEG catches exact re-submits. A **perceptual hash** (dHash of a 9×8 grayscale of the rectified page) recognises re-photographs of the golden notebooks, so a judge photographing your printed demo sheet gets instant results.
6. **Golden replay, not golden static.** Record the real SSE event stream, with timestamps, for the 3 demo notebooks and ship it as JSON. "Try a demo notebook" replays the **exact live experience** (same staggered reveal) with no network. Judges see the real pipeline's behaviour, and the demo cannot fail.

### 5.3 Failure modes and mitigations
| Failure | Detection | Fallback |
|---|---|---|
| 429 / 5xx | Status code | Retry once with jitter (≥ 500 ms, honour `Retry-After`). Then serve the cache, golden data, or the template with defaults plus a banner: "Examiner is busy; using standard values". |
| Timeout | Hard 12 s budget on compile, 6 s on SAM | Same as above. SAM missing means no footprints, never a blocked build. |
| Schema-valid nonsense (R = −3 Ω, 40 M HCl, wrong mode) | **zod validation plus physical clamps** (R ∈ [0.1, 1000] Ω, M ∈ [0.01, 2]) | Clamp, substitute the default, and log. |
| SAM empty on sketches | Empty `boxes` | Use the LLM's approximate boxes or template slots. |
| ASR socket drop | `onclose` | Auto-reconnect once. Text input fallback ("type your answer"). |
| Credits exhausted | Spend counter or 402/403 | `DEMO_MODE=golden` automatically. |
| No network at the judging venue | `navigator.onLine` or fetch failure | The PWA has cached the app plus golden packs, and golden replay works offline. |

**Schema fixes to make strict mode reliable:**
- Replace `paperBbox: number[]` with an object `{x0,y0,x1,y1}`. Strict schemas often can't enforce `minItems`/`maxItems`.
- Don't make **both** `physicsInit` and `chemistryInit` required. Doing so forces the model to invent values for the experiment that isn't on the page. Make them nullable, or use a two-call flow: classify (fast), then a mode-specific schema.
- **Don't let the LLM output `waecScoreOutOf20`.** Compute the score deterministically from rubric hits (§8). LLM-generated marks are non-reproducible, and a judge who reloads and sees a different score loses trust.

---

## 6. Low-bandwidth / low-end reality and what judges actually run

**Nigeria:**
- Data costs roughly ₦300–750 per GB (Airtel after the Jan 2025 hike: 2 GB for ₦1,500, 10 GB for ₦4,000, 25 GB for ₦8,000).
- About 45% of phones are Tecno or Infinix, plus itel. Power and network drop often.
- **PWA (`vite-plugin-pwa`, Workbox):**
  - Precache the app shell, procedural code, golden packs, and the rubric JSON (about 3 MB total).
  - The lab runs **fully offline after first visit**. Only snap-new-page, viva and audit need network.
  - Show a "Lite mode / data saver" toggle that defaults on when `navigator.connection.saveData` is set or `effectiveType` is `2g`/`3g`.
- **Uploads:** 1280 px JPEG at q 0.75–0.8 (≈150–300 KB). Never video. The spec's "5-second video clips" are for the demo film, not the upload path.
- **Progressive loading:** first paint shows the landing page and "Try demo notebook" in under 300 KB. Download the 3D chunk on interaction intent (hover/tap). MediaPipe loads only when its toggle is on.
- **Device tiering:** detect via `WEBGL_debug_renderer_info` (PowerVR, Mali-G52, Adreno), `navigator.deviceMemory`, and `hardwareConcurrency`, plus a 2-second warm-up FPS sample.

**Judges (assume desktop Chrome, macOS Safari, iPhone Safari):**
| Concern | iOS Safari status / action |
|---|---|
| WebGPU | iOS 26+ only. Irrelevant, because we ship WebGL2. |
| `getUserMedia` | Works over HTTPS. Needs a user gesture plus a permission prompt. In **in-app browsers** (X, LinkedIn, WhatsApp webviews) the camera often fails, so detect them and show an "Open in Safari/Chrome" banner. **This matters for the viral-bonus traffic.** |
| Audio | `AudioContext` must be created or resumed **inside a tap handler**. Do this on the "Start lab" button. Synthesise sparks and hum with standard nodes (oscillators, noise buffer, BiquadFilter, gain envelopes). **No AudioWorklet is needed for synthesis.** |
| AudioWorklet | Supported (14.5+). **Use it only for mic capture** (downsample 48 kHz to 16 kHz PCM16 for ASR). |
| SharedArrayBuffer | Needs COOP/COEP with `require-corp`, since Safari lacks `credentialless`. Not needed after the cuts. |
| 120 Hz | rAF is capped near 60 Hz by default. Don't claim 120 FPS. |
| DeviceOrientation | Needs `requestPermission()` from a tap. |
| WebXR AR | Not available. Not used. |
| PWA storage | About 50 MB cache cap, evicted after about 7 days unused. Fine for a 3 MB app. |
| Memory | Mobile Safari kills tabs over ~1–1.5 GB. Keep textures ≤ 2048 px, dispose old scenes on re-snap. |

---

## 7. Top 12 risks and bottlenecks (ranked)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Scope overload.** Three experiments, voice viva, gestures, graph auditor, Muse Image, Rust core and live CV, solo in 10 days. You end with five half-features and no polished hero moment. | Very high | Critical | The must/should/could cut lines in §9. **One experiment (meter bridge) must be flawless by Day 5.** Feature freeze at end of Day 8. |
| 2 | **SAM 3.1 zero-shot on biro schematic symbols** ("galvanometer" = a circle with a G) returns empty or wrong boxes. SAM is trained on natural images, and concept prompts for drawn symbols are out of distribution. | High | High | The **Day-1 spike** measures SAM and Spark on 30 real photos. The layout is LLM-first and template-snapped (§3.2), so SAM is cosmetic. Try primitive prompts ("circle", "rectangle", "handwritten text", "drawing") and "sheet of paper". If SAM is useless on sketches, use it for the paper mask plus the **photo-of-real-apparatus** path, and say so honestly. |
| 3 | **Snap-to-3D latency** of 5–12 s (Lagos) against the claimed 2.2 s. Wonder at high effort is 8–30 s. | High | High | Run Spark 1.3 at low effort in parallel with SAM, stream SSE, use the choreographed local reveal (§5), hash caching and golden replay. Wonder only off the critical path. |
| 4 | **Live demo fails during judging** (API outage, judge's network, rate limits, **credits drained** by a public URL). | Medium | Critical | Golden SSE replay works offline. PWA precache. Per-IP limits, a spend cap and the `DEMO_MODE` kill switch. Monitor credits daily. A recorded video exists by Day 5. |
| 5 | **Low-end Android performance and crashes** (PowerVR or Mali-G52 with 2–3 GB RAM; bloom plus transmission glass plus particles drops to 10 FPS or loses the WebGL context). | High | Medium–High | WebGL2 only, tiered quality, fake glass on low tier, DPR clamp, particle caps, context-loss recovery. **Buy or borrow one ₦80–150k Tecno/Infinix/itel test phone** before Oct 26. |
| 6 | **iOS Safari quirks on judges' iPhones** (camera prompts, audio unlock, in-app webviews, gyro permission, memory kills, 60 Hz cap). | Medium–High | High | A single "Start lab" tap unlocks audio and orientation. In-app-browser detection. File-picker fallback. Test on a real iPhone on Day 5 and Day 9 (borrow one; BrowserStack or LambdaTest as a stopgap, since their camera emulation is limited). |
| 7 | **Voice viva quality**: Pidgin unsupported, accent errors, noisy rooms, relay bugs, **no Meta TTS**. | High | Medium | Push-to-talk mode, WAEC keyword biasing, and an LLM prompt instructed to interpret noisy Nigerian-English/Pidgin transcripts charitably. Text fallback. Examiner voice via `speechSynthesis` (pick an en-GB/en-NG voice if present) plus on-screen captions. Optionally send a short **audio clip to `muse-spark-1.2`** (audio understanding) for Pidgin turns. |
| 8 | **LLM structured output wrong but valid** (invented values, mode confusion, deductions that contradict the page, non-deterministic scores). | Medium | High | Fix the schema (§5.3), use zod plus physical clamps, compute scores deterministically from rules, and the LLM writes only prose feedback. A few-shot prompt with the 3 golden notebooks. Temperature low. |
| 9 | **Rules, eligibility and logistics**: application deadline (Oct 25 11:59 PM ET), unknown pre-existing-code rule, filming **minors** in the video, deadline timezone, Nigeria "local law" clause. | Medium | Critical | Confirm acceptance by Oct 26 09:00 ET. Read the Official Rules the moment they're posted. Signed parent/school consent for any student on camera, or film hands only. Submit by 18:00 WAT Nov 4. |
| 10 | **Toolchain time sinks**: Rust/wasm-pack integration, Next.js SSR plus `dynamic()` boundaries, COOP/COEP breakage, WebGPU/TSL ports, OpenCV.js builds. | High if kept | High | **Cut all of them** (§1–3). One language (TS), one bundler (Vite), one renderer (WebGL). |
| 11 | **Visual quality falls short of the concept renders** (photoreal AI images vs procedural meshes, a "toy" look). | High | High (judging is "jaw-dropping") | Holographic art direction (§2.6), with lighting (Lightformers, bloom, contact shadows) budgeted as a real task. A one-day "beauty pass" (Day 8). Show the AI renders as *vision* only, never as screenshots of the product. |
| 12 | **Power and connectivity outages in Nigeria during the build**, plus API dependency while coding. | Medium–High | High | UPS or inverter plus power banks. Two data SIMs or MiFi (MTN and Airtel). **Record Meta API responses on Day 1 and develop against local mocks** (a fixtures folder), so most days need no network. Push to GitHub several times a day. Continuous deploys mean a working build always exists online. |

Also worth tracking: API key leakage via `VITE_` env vars or git history (gitleaks); chemistry or physics inaccuracies a judge notices (unit tests against textbook values, e.g. Na₂CO₃ + 2HCl endpoint volumes); Muse Image producing wrong circuit symbols (keep it out of grading, see §8).

---

## 8. Recommended final tech stack

| Layer | Choice | Why | Cut / changed from spec, and why |
|---|---|---|---|
| Build / shell | **Vite 6 + React 19 + TypeScript (strict)** | A static SPA fits a canvas app. Fast HMR, deploys anywhere. | **Next.js 15 App Router**: SSR is useless for a canvas, and you'd pay for `use client`/`dynamic`/hydration and header plumbing. |
| State | **Zustand** (transient `getState`/`subscribe` in `useFrame`) | As the spec says, correct. | — |
| 3D | **three (WebGLRenderer, WebGL2) + R3F v9 + drei (subset) + @react-three/postprocessing** | Universal device coverage, GLSL works, pmndrs ecosystem works. | **WebGPURenderer/TSL**: experimental, breaks ShaderMaterial and postprocessing, no WebGPU on PowerVR or older iOS, no visible gain at this scene size. |
| Shaders | GLSL `ShaderMaterial` / `onBeforeCompile`: thermal wire, ink glow, dissolve, fresnel hologram, indicator swirl | Spec shaders reused nearly as-is. | WGSL dropped. |
| Assets | **Procedural geometry** (Lathe, Tube, RoundedBox, CanvasTexture dials). 1–2 hero props via **SAM 3D Objects** or Meshy, then Blender cleanup, then `gltf-transform` (Meshopt + WebP). `<Lightformer>` environment. | 0 KB, crisp, animatable, fast to iterate. | Photoreal glTF libraries, Draco and HDRIs: weight and pipeline time. |
| Physics / chemistry / graph | **Pure TS modules + Vitest**, fixed-step 120 Hz accumulator in `useFrame` | Closed-form maths takes microseconds, is testable and has no boundary cost. | **Rust → WASM worker + SharedArrayBuffer + COOP/COEP**: no benefit, JSON boundary slower than TS, panic risk, at least a day of toolchain. A Rust MNA solver is optional (Could). |
| Capture / CV | `getUserMedia` + TS corner finder + **manual corner handles** + DLT homography + **fragment-shader rectify and ink extraction**. Optional SAM "sheet of paper". | Robust, around 0 KB of dependencies, works on every phone. | **OpenCV.js live 60 FPS homography** (8–10 MB, jitter, CPU contention). **Python FastAPI CV.** **WebXR** (no image tracking, no iOS). |
| "AR feel" | Optional DeviceOrientation 3-DoF parallax over the live camera | Cheap and magical. Also drives the meniscus eye-level mechanic. | Live tracking. |
| Gestures | MediaPipe Tasks Vision HandLandmarker (lite), lazy, desktop-first | Demo-video moment. | Not on by default (7.8 MB+ and slow on low-end). |
| Audio | Web Audio standard nodes for synthesis. **AudioWorklet only for mic PCM capture.** `speechSynthesis` for the examiner's voice. | Zero assets, iOS-safe. | AudioWorklet synthesiser (unnecessary). |
| Graph sheet | SVG/Canvas 2D React component. Deterministic least squares, 2/3-scale and 2/3-triangle checks, 2-decimal-place checks in TS. LLM writes the feedback prose only. | Reproducible marks. | Using SAM + Wonder to "audit" geometry that can simply be computed. |
| AI: compile | **`muse-spark-1.3`** (low effort), image input, strict `json_schema` via `text.format`, streamed | Latency on the interactive path. | `muse-wonder-1.0` high effort on the critical path. |
| AI: segmentation | **`sam-3.1`** fan-out in parallel with compile. Results are cosmetic footprints and the paper mask. | Visible "Meta tooling", off the critical path. | SAM output as a **prerequisite** for the LLM. |
| AI: viva | `muse-voice-transcribe-1.0` realtime (PUSH_TO_TALK, keywords) → `muse-spark-1.3` turns. Optional `muse-spark-1.2` for audio clips. | Five Meta capabilities overall. | "Continuous Pidgin listening at 99%" claim. |
| AI: audit and image | `muse-wonder-1.0` for the end-of-practical Chief Examiner report (async, a few seconds is fine). `muse-image-1.0` (**Could**) for a stylised "model diagram" card, clearly labelled as illustrative, never used for grading. | Shows depth without blocking. | Muse Image as an authoritative correction. A **deterministic SVG** of the correct WAEC diagram is the grading artefact. |
| API server | **Bun + Hono**, one service: `/api/snap` (SSE), `/ws/viva`, `/api/audit`. In-memory LRU, per-IP rate limits, spend cap, `DEMO_MODE`. | Minimal and portable. | Drizzle/Postgres, Upstash Redis, R2, Python. |
| Data | Rubrics as a static JSON shared by client and server. Golden packs as static JSON and WebP. Sessions in IndexedDB. | Nothing to operate. | Database. |
| Hosting | **Cloudflare Pages** (frontend) + **Fly.io/Railway/Cloud Run, min 1 instance** (API). Secrets in platform env. | No cold starts, WebSockets work, CDN reaches Lagos. | Vercel functions for WS (unsupported). Sleeping free tiers. |
| PWA | `vite-plugin-pwa` (Workbox precache of shell plus golden packs) | Offline lab and data savings. | — |
| Dev tooling | **Muse Code** (Meta's coding CLI) and/or Claude Code, Vitest, Playwright smoke test, gitleaks | Using Muse Code is another Meta-tooling story point. | — |

### Component and data-flow description
```
[Phone/Laptop browser — Vite SPA (PWA)]
  Capture screen ──getUserMedia──► frame ─► TS corner finder (+manual handles)
        │                                   └► DLT homography ─► GLSL rectify + ink-mask (GPU)
        │                                                 │
        │  (instant, local)  Lab scene ◄──────────────────┘  page texture + ink mask
        │       ▲  choreography: page flattens → ink glows → particles
        │       │
        ├─POST /api/snap (JPEG ≤300 KB, mode hint)──────────────────────────────┐
        │                                                                       ▼
        │                                         [Bun + Hono API, 1 always-on instance]
        │                                          hash/pHash → LRU / golden hit? → replay SSE
        │                                          else: Files upload → parallel:
        │                                            ├─ muse-spark-1.3 compile (stream, json_schema)
        │                                            └─ sam-3.1 × N prompts (footprints, paper mask)
        │◄──────────── SSE: mode → components → sam_box → params → deductions → done ─┘
        │
  Zustand store ──► Blueprint → Template builder (procedural apparatus) → R3F scene
        │                 ▲
        │   useFrame: physics.ts fixed-step 120 Hz (meter bridge / titration) → uniforms
        │   (wire temp → thermal shader, galvanometer spring, pH → flask colour, smoke/sparks)
        │   Web Audio synth (hum, crackle, drip) driven by same state
        │
  Readings table + WAEC graph (TS deterministic rules → marks)
        │──POST /api/audit──► muse-wonder-1.0 (examiner prose) [+ muse-image-1.0 card, optional]
        │
  Viva: mic → AudioWorklet PCM16 16 kHz ──WS /ws/viva──► relay ──► wss://api.meta.ai/v1/asr/realtime
        ◄── partial/final transcript ◄──┘  final → muse-spark-1.3 turn → text → speechSynthesis + captions
```

---

## 9. Realistic solo 10-day plan

### Cut lines
- **MUST (the demo):**
  - Snap → 3D **meter bridge**, live and golden-replay.
  - Draggable jockey, key, galvanometer needle physics, balance-length readout.
  - Short-circuit spectacle (cherry-red wire shader, sparks and smoke, crackle sound, fuse "pop").
  - Spark 1.3 blueprint with WAEC deductions, deterministic score card.
  - 3 golden demo notebooks.
  - Deployed URL with rate limits and the kill switch.
  - 2–3 minute video.
- **SHOULD:**
  - Titration bench (lathe glass, stopcock drag, drop particles, pH colour, eye-level parallax via orbit or gyro, 2-decimal-place table rule).
  - Push-to-talk viva (ASR relay + Spark + `speechSynthesis`).
  - WAEC graph sheet with deterministic 2/3 checks.
  - SAM footprints, quality tiers, PWA offline.
- **COULD:**
  - MediaPipe pinch and slide gestures (desktop).
  - Muse Image model-diagram card.
  - Wonder end-of-practical report.
  - DeviceOrientation fake-AR.
  - SAM 3D-generated hero prop.
  - Ray optics.
  - Rust MNA solver for arbitrary circuits.
- **WON'T (this hackathon):** Rust 120 Hz worker with SAB, Postgres/Redis/R2/Python, WebGPU/TSL, OpenCV.js live homography, continuous Pidgin listening.

### Pre-hackathon, Oct 21–25 (no project code unless the Official Rules allow it)
1. **Today:** make sure the application is **submitted before Oct 25, 11:59 PM ET**. Watch for the Official Rules. Look specifically for **pre-existing code, assets and data** clauses, open-source library use, video length, repo visibility, and judge-access requirements.
2. **Data (not code, almost certainly allowed):**
   - Photograph **30+ real notebook pages**: meter bridge, titration and optics drawings, in different biros, lighting, phones (including a Tecno/Infinix), and angles. Include the "golden 3", drawn neatly.
   - Record about 20 short viva answers in Nigerian English and Pidgin from consenting adults.
   - Collect WAEC Chief Examiner report excerpts for the rubric JSON (as text content).
3. **Video B-roll and consent:** film Kubwa notebook, classroom and hands B-roll now. Get **written consent** from parents and school for any minor, or film hands only.
4. **Accounts and keys:** `dev.meta.ai` API key, check the credits balance, Fly/Railway, Cloudflare, domain, GitHub. Install Muse Code and Claude Code. Do manual curl calls to the Meta API from Lagos to sanity-check latency and SAM behaviour on 3–4 photos. Manual exploration, not project code; judge for yourself whether rules allow it.
5. **Hardware and power:** borrow or buy a low-end Android phone and access to an iPhone. Get a UPS or inverter and two data SIMs.
6. **Learning (reading, not writing project code):** R3F `useFrame` patterns, three `LatheGeometry`, drei `PerformanceMonitor`, selective Bloom, the Hono SSE helper, Meta structured-output and realtime ASR docs.
7. **Paper design:** storyboard the 2-minute video beat by beat, sketch the bench layouts and the blueprint schema v2 on paper. Pin a one-page "MUST list" above your desk.

### Daily plan (WAT; kickoff Oct 26, submission no later than Nov 4 18:00 WAT)
| Day | Date | Deliverable | Exit criterion |
|---|---|---|---|
| 1 | Mon Oct 26 | Scaffold Vite+R3F and Bun+Hono. **Spike:** SAM 3.1 and Spark 1.3 on the 30 photos, record latencies and save responses as **mock fixtures**. **Decide the pipeline shape** (how much SAM matters). **Deploy hello-world** frontend and API (Pages + Fly) with secrets. | A deployed URL exists. The latency and quality table is written down. |
| 2 | Tue Oct 27 | Capture flow (preview, corner finder, handles, DLT, shader rectify, ink mask). `physics/meterBridge.ts` plus tests. Procedural meter bridge kit (wire, ruler, jockey, resistance box, galvanometer, cell, key). | Photo → flat textured page in 3D, apparatus visible (static). |
| 3 | Wed Oct 28 | `/api/snap` SSE pipeline (Spark compile stream ∥ SAM fan-out), zod validation and clamps. Blueprint → template builder. Ink-glow, particle and dissolve **materialisation choreography**. Hash cache plus **golden SSE recording and replay**. | Real snap → animated 3D bench on the deployed URL; golden replay works offline. |
| 4 | Thu Oct 29 | Interactions: drag jockey, key toggle, galvanometer spring needle, balance readout, readings logger. **Short-circuit spectacle**: thermal shader, Bloom, sparks and smoke, Web Audio hum and crackle and pop. Deterministic WAEC rules (key-open, 2 d.p.). | The short-circuit moment looks great on a laptop. |
| **5** | **Fri Oct 30** | **MILESTONE: meter bridge end-to-end demo-able.** Quality tiers and DPR. Test on the iPhone and the low-end Android. Fix the worst bugs. **Record a rough backup demo video today.** | Someone else can use the URL on their phone, unaided, and say "wow". If not, Day 6 goes on fixing this, not titration. |
| 6 | Sat Oct 31 | Titration bench (Lathe glass, fake-glass tiers, liquid level, stopcock drag dropwise, drop particles, pH/indicator colour, eye-level parallax via orbit/gyro). `physics/titration.ts` tested against textbook endpoints. 2-d.p. and concordance rules. | Snap a titration page → working bench. |
| 7 | Sun Nov 1 | Viva: AudioWorklet PCM capture, WS relay, push-to-talk, Spark examiner turns with the WAEC persona, captions plus `speechSynthesis`, text fallback. Score card UI. | A 3-question viva works on desktop Chrome and iPhone Safari. |
| 8 | Mon Nov 2 | WAEC graph sheet with deterministic 2/3 checks. Wonder end-of-practical report (async). **Beauty pass** (lighting, materials, UI glass panels, transitions). PWA precache. **Could** items only if green: gestures (desktop), Muse Image card. **Feature freeze 23:59.** | Nothing new after this. |
| 9 | Tue Nov 3 | Bug bash across the device matrix (desktop Chrome and Safari, iPhone, low-end Android, in-app webviews). Rate limits, spend cap, kill-switch test, gitleaks, README and architecture diagram. **Record and edit the final video** (hero snap → extrusion → short-circuit → viva → score). | Final video exported, repo public and clean. |
| 10 | Wed Nov 4 | Buffer only: final deploy, check golden mode, **submit by 18:00 WAT** (official cutoff ≈ 03:00 WAT Nov 5). Social posts after submitting. Keep the API on `DEMO_MODE=auto` through judging (Nov 4–8) and watch credits daily. | Submitted with 9+ hours of margin. |

**Rules of thumb for the solo build:**
- Develop against recorded fixtures, so network or power outages don't block you.
- Deploy continuously from Day 1.
- Never start a SHOULD item while a MUST is shaky.
- The golden replay path is a feature, not a cheat. Show it in the video as "offline demo mode for low-connectivity schools", which is true and on-theme for "Build for Your World".

---

## Sources
- Meta Model API models (dev.meta.ai docs, redirected from ai.developer.meta.com): https://ai.developer.meta.com/docs/models/
- Meta Global AI Developer Hackathon official page: https://dev.meta.ai/events/global-hackathon
- Hackathon pre-announcement coverage: https://www.mind-verse.de/news/meta-plant-globalen-ki-hackathon-fuer-entwickler , https://coursejoiner.com/hackathon/meta-global-hackathon-2026-1/ , https://thegenaimagazine.com/meta-global-ai-developer-hackathon-ideas-prizes , https://cryptoaimeta.com/meta/meta-1-million-ai-hackathon-rules-who-can-enter/
- Muse Wonder/Spark rate limits (third-party summary): https://apidog.com/de/blog/muse-wonder-rate-limits/
- SAM 3.1 on Meta Model API: https://www.mind-verse.de/news/meta-sam-3-1-bild-video-analyse-api
- Meta realtime STT parameters (Pipecat integration docs): https://docs.pipecat.ai/api-reference/server/services/stt/meta.md
- three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- WebGPU + three.js migration guide (2026): https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- Chrome WebGPU on Android (Chrome 121): https://developer.chrome.com/blog/new-in-webgpu-121?authuser=6
- Chrome 146 WebGPU compatibility mode: https://app.cinevva.com/news/2026-03-10-chrome-146-webgpu-compatibility
- Safari/iOS 26 WebGPU: https://appdevelopermagazine.com/webgpu-in-ios-26/
- Safari 60 Hz rAF cap discussion: https://bugs.webkit.org/show_bug.cgi?id=294338
- Rust/WASM boundary cost write-up: https://urandom.io/blog/2026-03-21-rust-wasm-slower-than-typescript
- Cross-origin isolation and `credentialless` (no Safari support): https://www.remotion.dev/docs/miscellaneous/cross-origin-isolation
- WebXR vs ARCore features (no image tracking): https://developers.google.com/ar/develop/webxr/arcore-comparison?hl=en
- MediaPipe hand-pose browser FPS benchmarks: https://blog.tensorflow.org/2021/11/3D-handpose.html
- hand_landmarker.task size: https://huggingface.co/spaces/HuggingFace-SK/Sign-Language-Interpreter/blob/main/hand_landmarker.task
- iOS PWA limitations: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- SAM 3D Objects: https://www.deeplearning.ai/the-batch/metas-sam-3-image-segmentation-suite-analyzes-and-creates-3d-bodies-and-other-objects , https://runware.ai/docs/providers/meta
- Nigeria phone brand share (StatCounter via Intelpoint): https://intelpoint.co/insights/tecno-has-the-highest-share-among-phone-brands-in-nigeria-at-23-55-as-of-february-2025/
- Nigeria data prices after Jan 2025 hike: https://techeconomy.ng/airtel-increases-data-call-tariffs
- Browser document scanning (jscanify / OpenCV.js approaches): https://dynamsoft.com/codepool/web-document-scanner-with-opencvjs.html
