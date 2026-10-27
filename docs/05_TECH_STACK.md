# 05 · Tech Stack: Every Layer, Why, and What Was Cut

*One language (TypeScript), one bundler (Vite), one renderer (WebGL2), one server (Bun + Hono). Every choice below is judged by one question: does it make the demo more impressive **and** more reliable, within 10 solo days?*

---

## 1. The final stack

| Layer | Choice | Why | Replaces (from the spec) and why |
|---|---|---|---|
| **App shell** | **Vite + React 19 + TypeScript (strict)** | The app is one full-screen canvas with camera and mic. A static single-page app deploys anywhere, has the fastest hot reload with heavy three.js imports, and works trivially as a PWA. | **Next.js 15 App Router.** Nothing to server-render; every 3D component would need client-only boundaries; hydration and header plumbing waste days. |
| **State** | **Zustand**, read transiently inside the render loop | The spec got this right: no React re-renders per frame. | — |
| **3D** | **three.js `WebGLRenderer` (WebGL2) + React Three Fiber v9 + drei (only what we use) + @react-three/postprocessing** (selective bloom) | Works on every judge's laptop and iPhone and on budget Android; GLSL shaders and the pmndrs ecosystem work. | **WebGPU / TSL.** three.js still calls `WebGPURenderer` experimental; it breaks `ShaderMaterial`, postprocessing and drei `Text`; no WebGPU on the PowerVR GPUs in many itel/Tecno/Infinix phones; no visible gain for a scene under 100 draw calls. |
| **Shaders** | GLSL: ink glow and lift, materialise dissolve, fresnel "hologram" rim, indicator colour blend and swirl, light-beam glow, fake glass for low tiers | Reuses the spec's shader ideas on a renderer that runs them. | WGSL. |
| **Lighting** | drei `Environment` built from `<Lightformer>`s, `ContactShadows`, selective bloom | Studio look with 0 KB of HDRI downloads. | HDRI files from CDNs. |
| **3D assets** | **Procedural geometry** for ~90%: lathe profiles (burette, flask, pipette, funnel), tubes, rounded boxes, canvas-drawn graduations. One or two hero props optionally generated with Meta's **SAM 3D Objects** from a photo, cleaned in Blender, compressed with `gltf-transform` (Meshopt + WebP) | Crisp, tiny, animatable for the "rise out of the ink" effect; one day of work. | Photoreal glTF libraries, Draco (its decoder is ~300 KB vs Meshopt's ~20 KB). |
| **Art direction** | **"Holographic lab"**: fresnel rims, bloom, scan-line materialisation, cyan ink glow, green SAM outlines; glass reads as glass from rim highlights and crisp graduations | Looks intentional and stays fast on cheap GPUs. The concept images are photoreal AI renders no 10-day web build will match; we don't try. | Chasing photorealism. |
| **Science Engine** | **Pure TypeScript modules + Vitest**, fixed 120 Hz steps inside the render loop | The maths is closed-form or a tiny bisection: microseconds. Testable; no boundary cost; easy to correct when a teacher spots something. | **Rust → WASM in a Worker with SharedArrayBuffer.** JSON across the boundary every frame makes it *slower* than TS; a `.unwrap()` panic kills physics for the session; SharedArrayBuffer needs COOP/COEP headers that break cross-origin assets and embeds (Safari forces the strictest mode); costs at least a day of toolchain. |
| **Capture and vision** | `getUserMedia` + file picker; a small dependency-free page-corner finder; **draggable corner handles**; homography solved in TS; **rectify and ink extraction in a fragment shader** | Robust on every phone, ~0 KB. | **OpenCV.js live homography at 60 FPS** (8–10 MB, jitter, CPU contention); **Python FastAPI CV**; WebXR (no image tracking, absent on iOS). |
| **"AR feel"** | DeviceOrientation (gyro) moves the virtual camera over the live camera feed; also drives the meniscus-parallax mechanic | Feels anchored and magical for under half a day. iOS permission requested from a tap. | Live paper tracking. |
| **Gestures** | MediaPipe Tasks Vision hand landmarker (lite), **lazy-loaded, laptop-only, optional** | One flourish for the video. | Gestures as a core control (7.8 MB+, slow on budget phones). |
| **Sound** | Web Audio standard nodes (oscillators, filtered noise, envelopes): drip, glass ting, swirl, success chime | Zero asset weight, iOS-safe once unlocked from a tap. | AudioWorklet synthesiser. |
| **Mic capture** | AudioWorklet that downsamples to 16 kHz mono PCM16 | Exactly the format Muse Voice Transcribe requires. | — |
| **Examiner's voice** | Browser `speechSynthesis` (labelled), captions always on | **Meta's API has no text-to-speech model.** | Assumed Meta TTS. |
| **Validation** | zod schemas generated from the shared contracts package | One source of truth for Blueprint, Readings and events on both sides. | — |
| **Offline** | `vite-plugin-pwa` (Workbox precache of the app shell, engine, rubric and golden packs ≈ 3 MB) | The lab works offline after the first visit; on-theme for Nigerian connectivity. | — |
| **API service** | **Bun + Hono**, one service, one always-on instance | Small, fast to write; SSE and WebSockets built in. Every request is bound by Meta API latency, so raw server speed is irrelevant; simplicity is what matters. | The extra services below. |
| **Data** | Rubric and golden packs as static files; student sessions in browser IndexedDB; in-memory LRU cache on the server | Nothing to operate, nothing to break. | **PostgreSQL + Drizzle, Upstash Redis, Cloudflare R2.** Nothing needs relational queries; R2 adds signed URLs and CORS. |
| **Meta SDK** | Official OpenAI-compatible client pointed at `https://api.meta.ai/v1`; **`@meta-sam/parser`** for SAM output | SAM returns special-token text, not JSON; the official parser handles it. (Check Bun compatibility on Day 1; it needs Node ≥ 20.17. If it fails in Bun, run the API on Node with Hono, which is portable.) | Hand-written `JSON.parse` of SAM output (silently returns nothing). |
| **Hosting** | **One Fly.io app** (decided Oct 27): the Bun + Hono server serves the built web app and the API from the same origin, on one machine that is always running, with the spend ledger on a Fly volume (`docs/plans/deploy-fly.md`) | No cold starts during judging; WebSockets supported; one origin means no CORS for `/api` or `/ws/examiner`. Region `iad`, closest to the Meta API. | Cloudflare Pages for the front end (the earlier plan): a second origin needs CORS and cannot proxy the examiner WebSocket. Free tiers that sleep (Render free: ~50 s cold start would kill a live demo). |
| **Secrets** | Platform secrets only; never a `VITE_` variable; gitleaks before the repo goes public | The most common key leak is a `VITE_` prefix. | — |
| **Testing** | Vitest (engine, rules, contracts), one Playwright smoke test (golden run end to end) | Proves "whether it works". | — |
| **Coding agents** | **Muse Code** (Meta's agent, part of the required tooling story) alongside Claude Code | Using Muse Code visibly is another Meta-tooling point; mention it in the README with concrete examples. | — |

## 2. Meta models (detail in `06_META_AI_INTEGRATION.md`)

| Model | Job |
|---|---|
| `muse-spark-1.3` (low effort, streamed, strict JSON) | Blueprint compile; examiner question turns |
| `sam-3.1` (parallel, one noun phrase each; or box prompts) | Green outlines of each drawn object; the paper mask |
| `muse-wonder-1.0` (medium effort, strict JSON) | Reads every handwritten value with its location; end-of-practical examiner report |
| `muse-voice-transcribe-1.0` (realtime, push-to-talk, keywords) | Live captions of the student's spoken answers |
| `muse-image-1.0` (edits) | Optional "reality preview": her setup as a real lab photo, labelled as an artist's impression |
| `muse-spark-1.2` (audio input) | Optional: understand Pidgin answers directly from the audio clip |

## 3. Performance budgets

| Budget | Target |
|---|---|
| First load (landing + golden demo) | **≤ 2.5 MB** over the wire (≈ ₦1–2 of data) |
| Initial JS | ≤ 350 KB compressed; 3D chunk loads on intent |
| 3D models and textures | ≤ 1.5 MB total (mostly procedural, ~0) |
| Upload per snap | ~150–300 KB JPEG |
| Frame rate | 60 fps on MacBook and iPhone; 45–60 on mid-range Android; **≥ 30** on low-end (bloom off, DPR 1, fake glass) |
| Physics | Fixed 120 Hz steps on every device |
| Texture size | ≤ 2048 px (iOS tab memory) |

**Quality tiers** chosen from the GPU name, device memory, CPU cores and a 2-second warm-up FPS sample; drei `PerformanceMonitor` steps down if frame rate drops; WebGL context-loss shows "tap to reload the scene"; **Lite mode** (2D) if WebGL fails or the phone stays under 20 fps.

## 4. What judges' devices actually do (iOS Safari notes)

| Concern | Reality | Our handling |
|---|---|---|
| Frame rate | Safari caps animation near 60 Hz | Never claim 120 FPS. Claim "physics at 120 Hz" |
| Camera | Works over HTTPS after a tap; often **fails inside in-app browsers** (X, LinkedIn, WhatsApp) | Detect in-app browsers, show "Open in Safari/Chrome"; file-picker fallback |
| Audio | Must be unlocked inside a tap | One "Start lab" tap unlocks audio and gyro permission |
| Gyro | Needs `DeviceOrientationEvent.requestPermission()` from a tap | Same tap; slider fallback |
| Memory | Tabs killed above ~1–1.5 GB | Textures ≤ 2048 px; dispose old scenes on re-snap |
| SharedArrayBuffer / WebGPU | Need special headers / iOS 26+ | Not used |

## 5. Optional "technical ambition" items (Could tier, only if everything else is green)

- **Rust → WASM general circuit solver** (Modified Nodal Analysis for arbitrary hand-drawn circuits), called only when the circuit changes, not per frame; plain typed arrays across the boundary. A good talking point for the meter bridge in "What's next".
- **SAM 3D Objects** hero prop: a photo of a real burette or glass block turned into a mesh by Meta's own model ("even our assets came from Meta AI").
- **Muse Glimmer** (Meta's 30B open-weights model) as an offline examiner on a school laptop, for the roadmap slide.
