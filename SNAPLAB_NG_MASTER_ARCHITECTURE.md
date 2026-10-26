# SNAPLAB NG — MASTER ARCHITECTURAL SPECIFICATION & MULTI-AGENT BUILD PLAYBOOK

**Target Competition:** Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026)  
**Track:** Indie Developer Track ($400,000 Track Pool + $50,000 Bonus Pool — 1st Prize: $150,000)  
**Theme:** Build for Your World  
**Primary Objective:** Build the fastest, most visually jaw-dropping, zero-latency spatial science laboratory on the web & mobile—turning any Nigerian student's ₦200 paper exercise book drawing into a live, 120 FPS 3D holographic laboratory with real-time destructive physics, spatial audio, hand-gesture manipulation, and an autonomous WAEC/NECO Chief Examiner Viva Agent.

---

## 0. INSTRUCTIONS FOR CODING AGENTS (CLAUDE CODE / MUSE CODE / CURSOR)

You are acting as a Principal Systems, Graphics, and AI Architect. Your mission is to execute this specification with zero compromises on runtime performance, visual fidelity, or mathematical determinism.

### Core Engineering Directives:

1. **Language & Runtime Polyglot Optimization (Zero Bottlenecks):**
   - **Physics, Circuit nodal analysis, Stoichiometry & Graph Regression Core:** Write in **Rust compiled to WebAssembly (`wasm-bindgen` / `wasm-pack`)** running inside a dedicated Web Worker with `SharedArrayBuffer`. The simulation loop must run at a locked **120 Hz** with zero garbage-collection pauses.
   - **3D Spatial Rendering & Particle Shaders:** Use **React Three Fiber (Three.js r170+ / WebGPU with WebGL2 fallback)** + **Custom GLSL/WGSL Shaders** for paper-to-3D extrusion, cherry-red wire thermal glow ($P = I^2R$), rising smoke plumes, and refractive glass meniscus parallax.
   - **Low-Latency API & Realtime Relay Server:** Use **Bun.js (`Bun.serve`) + Hono** (written in strict TypeScript) for sub-millisecond WebSocket proxying to `wss://api.meta.ai/v1/asr/realtime` and parallel HTTP/2 requests to `https://api.meta.ai/v1/responses`.
   - **Computer Vision Preprocessing & Geometry:** Use **Python 3.12 (FastAPI + OpenCV + NumPy)** OR client-side **OpenCV.js (WASM)** to compute the 4-point homography matrix of the ruled Nigerian exercise book page at 60 FPS so the 3D apparatus stays locked to the paper even as the camera moves.
   - **Database & Edge Storage:** **PostgreSQL + Drizzle ORM** for WAEC Chief Examiner Rubrics and student telemetry; **Cloudflare R2** for zero-egress high-speed media staging before hitting the Meta Files API.
2. **Never Generate Raw UI/Canvas Code via LLM at Runtime:**
   - LLMs (`muse-wonder-1.0` / `muse-spark-1.3`) are strictly **Semantic Compilers & Chief Examiners**. They ingest multimodal inputs (`SAM 3.1` masks + `Muse Voice Transcribe` audio transcripts + notebook photos) and emit a deterministic, schema-validated `SnapLabBlueprint` JSON payload in `< 2.2 seconds`.
   - The **Rust/WASM + Three.js engine** consumes that JSON and runs the laws of physics and chemistry deterministically at 60–120 FPS.

---

## 1. PRODUCT VISION: "THE ₦200 EXERCISE BOOK THAT COMES ALIVE"

Over 70% of secondary school students in Nigeria and West Africa sitting for WAEC, NECO, and JAMB Science Practicals attend schools without functional Physics or Chemistry laboratories. They are forced to memorize "Alternative to Practical" diagrams on paper.

**SnapLab NG** eliminates the boundary between paper and reality:

1. **Paper-to-3D Holographic Extrusion:** A student draws a circuit diagram, titration apparatus, or ray optics setup with a blue biro on a ruled exercise book. They scan it with their phone or webcam. **`SAM 3.1`** segments every hand-drawn component (`"resistor"`, `"galvanometer"`, `"burette"`, `"battery"`, `"wire"`). On screen, the camera tilts into 3D space and **photorealistic 3D brass and borosilicate glass laboratory apparatus physically extrude out of the student's ink lines on the paper.**
2. **Destructive Real-World Physics (Mistakes Have Consequences):**
   - Short-circuiting a Meter Bridge ($R = 0\,\Omega$ with Key $K$ closed) causes the wire on the paper to glow cherry-red via a custom fragment shader, emit 3D smoke particles, pop the galvanometer fuse with synthesized Web Audio electrical arcs, and drift the unknown resistance via thermal coefficient $R(T) = R_0[1 + \alpha(T - T_0)]$.
   - Reading a 3D glass burette from an oblique camera angle ($ heta\_{\text{eye}} \neq 0^\circ$) triggers a real-time refractive **Meniscus Parallax Error** warning until the student tilts their camera to eye level.
3. **Zero-Hardware Hand Gesture Control + Voice Viva Examiner:**
   - Students pinch and twist in front of their camera (MediaPipe Hands WASM) or drag on touchscreens to turn the 3D burette stopcock dropwise ($0.05\text{ cm}^3$) or slide the brass Jockey $J$ along the $100\text{ cm}$ constantan wire.
   - **`Muse Voice Transcribe`** listens continuously in Nigerian English or Pidgin, while **`Muse Wonder 1.0`** acts as a tough WAEC External Invigilatorconducting a live Oral Viva.
4. **Live WAEC Millimeter Graph Sheet & Chief Examiner Auditor:**
   - As students log readings in the 3D lab, points plot onto an authentic 2mm WAEC graph grid. When they draw their Line of Best Fit and slope triangle, `SAM 3.1` + `Muse Wonder 1.0` audits whether the slope triangle spans $\ge \frac{2}{3}$ of the grid, checks 2-decimal-place burette precision, and generates a corrected textbook overlay using **`Muse Image`**.

---

## 2. POLYGLOT SYSTEM ARCHITECTURE & TECH STACK MATRIX

| Subsystem                            | Technology Choice                                                                              | Why This Gives Optimal Performance                                                                                                                                        |
| :----------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend Shell & State**           | **Next.js 15 (App Router) + React 19 + Zustand**                                               | Instant transient state updates outside React's render loop via `useStore.subscribe()` feeding Three.js `useFrame`.                                                       |
| **3D Spatial Engine**                | **Three.js + React Three Fiber (`@react-three/fiber`) + `@react-three/drei` + Postprocessing** | Hardware-accelerated WebGPU/WebGL2 instanced meshes, bloom post-processing for hot wires/sparks, and custom GLSL shaders for liquid meniscus and pH color diffusion.      |
| **Physics & Chemistry Solver**       | **Rust -> WebAssembly (`wasm-pack`)**                                                          | Solves Modified Nodal Analysis (MNA) for arbitrary electrical circuits, exact charge-balance pH curves, and least-squares WAEC graph regression in `< 0.08 ms` per frame. |
| **Paper Homography & Hand Tracking** | **OpenCV.js (WASM) + MediaPipe Hands (WASM GPU Delegate)**                                     | Tracks the 4 corners of the physical notebook page and 21 3D hand landmarks locally on-device at 60 FPS with zero server round-trip latency.                              |
| **Acoustic Physics Engine**          | **Native Web Audio API (`AudioWorklet` + Procedural Synth)**                                   | Zero external MP3 loading latency; procedurally synthesizes 60Hz transformer hum, electrical spark crackles, brass peg clicks, and pitch-shifting titration droplets.     |
| **AI Orchestration Backend**         | **Bun.js (`Bun.serve`) + Hono + TypeScript**                                                   | 4x faster HTTP/WebSocket throughput than Node.js; handles concurrent `SAM 3.1` noun-phrase segmentation fan-out and `Muse Voice Transcribe` WebSocket relays.             |
| **Database & Caching**               | **PostgreSQL + Drizzle ORM + Upstash Redis (or in-memory LRU)**                                | Stores official WAEC/NECO Chief Examiner marking rubrics, caches `SAM 3.1` masks by image SHA-256 hash, and persists student lab sessions.                                |

---

## 3. REPOSITORY DIRECTORY STRUCTURE (MONOREPO)

```text
snaplab-ng/
├── Cargo.toml                        # Rust workspace root for WASM physics engine
├── package.json                      # Bun workspace root
├── bunfig.toml
├── .env.example                      # MODEL_API_KEY, DATABASE_URL, R2_BUCKET_URL
├── crates/
│   └── snaplab-core-wasm/            # Rust -> WASM deterministic physics & chemistry solver
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                # wasm-bindgen exports
│           ├── circuit_mna.rs        # Modified Nodal Analysis (Ohm's Law, Meter Bridge, Potentiometer)
│           ├── titration_ph.rs       # Exact charge-balance pH & indicator RGB interpolation
│           ├── optics_ray.rs         # Thin-lens & prism Snell's law raytracer
│           └── waec_graph.rs         # Least-squares regression & 2/3 slope triangle validator
├── apps/
│   ├── api-server/                   # Bun + Hono high-speed AI orchestrator
│   │   ├── src/
│   │   │   ├── index.ts              # Bun.serve HTTP + WebSocket entry
│   │   │   ├── meta/
│   │   │   │   ├── client.ts         # Meta Model API base client (https://api.meta.ai/v1)
│   │   │   │   ├── sam31.ts          # Parallel SAM 3.1 segmentation fan-out
│   │   │   │   ├── museWonder.ts     # Muse Wonder 1.0 & Spark 1.3 structured compiler
│   │   │   │   ├── museVoice.ts      # wss://api.meta.ai/v1/asr/realtime proxy
│   │   │   │   └── museImage.ts      # /v1/images/edits WAEC diagram correction
│   │   │   ├── rubrics/
│   │   │   │   └── waec_chief_examiner.json
│   │   │   └── db/
│   │   │       └── schema.ts         # Drizzle ORM PostgreSQL schema
│   └── web-client/                   # Next.js 15 + React Three Fiber + WASM Host
│       ├── public/
│       │   └── demo-notebooks/       # Pre-recorded Kubwa golden demo scans for judges
│       └── src/
│           ├── app/
│           ├── components/
│           │   ├── spatial/
│           │   │   ├── HologramBenchCanvas.tsx   # R3F root canvas with Bloom & Camera controls
│           │   │   ├── ExtrudedNotebookMesh.tsx  # Paper plane + homography texture + SAM masks
│           │   │   ├── Apparatus3D/
│           │   │   │   ├── ResistanceBox3D.tsx   # Interactive brass pegs + thermal shader
│           │   │   │   ├── Galvanometer3D.tsx    # Damped spring needle + glass reflection
│           │   │   │   ├── MeterBridgeWire3D.tsx # Constantan wire + draggable Jockey J
│           │   │   │   ├── Burette3D.tsx         # Glass tube + meniscus refraction + stopcock
│           │   │   │   └── ConicalFlask3D.tsx    # Swirling pH shader + droplet ripples
│           │   │   └── shaders/
│           │   │       ├── wireThermal.glsl      # Blackbody radiation glow + heat distortion
│           │   │       └── flaskSwirl.glsl       # Fluid diffusion & Methyl Orange/Phenolphthalein
│           │   ├── graph/
│           │   │   └── WaecMillimeterGraph.tsx   # High-DPI 2mm grid + slope triangle auditor
│           │   └── viva/
│           │       └── VoiceVivaConsole.tsx      # Real-time waveform + Pidgin/English viva feed
│           ├── audio/
│           │   └── LabSoundWorklet.ts            # Procedural Web Audio synthesizer
│           └── state/
│               └── useLabStore.ts                # Zustand transient store bridging WASM & R3F
```

---

## 4. COMPLETE META MODEL API INTEGRATION SPECIFICATION (`https://api.meta.ai/v1`)

To score **25/25 on Use of Meta AI Tooling**, SnapLab NG integrates **five** distinct Meta AI capabilities in a single cohesive pipeline.

### 4.1 Authentication & Base Configuration

- **Base URL:** `https://api.meta.ai/v1`
- **Realtime WebSocket URL:** `wss://api.meta.ai/v1/asr/realtime`
- **Header:** `Authorization: Bearer $MODEL_API_KEY`

### 4.2 Stage 1: Parallel Zero-Shot Component Segmentation (`sam-3.1`)

- **Critical API Constraint:** `sam-3.1` on `POST /v1/responses` accepts **one short noun phrase per request** (e.g., `"resistor"`, `"galvanometer"`, `"burette"`, `"conical flask"`, `"battery"`, `"ammeter"`, `"convex lens"`).
- **Optimization Pattern:** In Bun (`apps/api-server/src/meta/sam31.ts`), upload the student's notebook frame/video once to `POST /v1/files` to obtain a `file_id` (or pass a signed Cloudflare R2 URL / base64 data URI), then fire **parallel HTTP/2 requests** via `Promise.all` across the target component vocabulary for that experiment type.

```typescript
// apps/api-server/src/meta/sam31.ts
export interface SamDetection {
  label: string;
  boxes: Array<[number, number, number, number]>; // [xMin, yMin, xMax, yMax] normalized 0..1
  masksRle?: string[];
  scores: number[];
}

const PHYSICS_PROMPTS = [
  "battery",
  "resistor",
  "galvanometer",
  "ammeter",
  "voltmeter",
  "switch key",
  "wire loop",
];
const CHEMISTRY_PROMPTS = [
  "burette",
  "conical flask",
  "pipette",
  "retort stand",
  "titration table",
];

export async function segmentNotebookParallel(
  imageUrl: string,
  domain: "physics" | "chemistry",
): Promise<SamDetection[]> {
  const prompts = domain === "physics" ? PHYSICS_PROMPTS : CHEMISTRY_PROMPTS;

  const results = await Promise.all(
    prompts.map(async (nounPhrase) => {
      const response = await fetch("https://api.meta.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sam-3.1",
          input: [
            {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: nounPhrase },
                { type: "input_image", image_url: imageUrl },
              ],
            },
          ],
        }),
      });

      if (!response.ok) return { label: nounPhrase, boxes: [], scores: [] };
      const payload = await response.json();
      return parseSam31Output(nounPhrase, payload);
    }),
  );

  return results.filter((r) => r.boxes.length > 0);
}

function parseSam31Output(label: string, payload: any): SamDetection {
  // Extract bounding boxes and masks from SAM 3.1 response items
  const rawText = payload?.output?.[0]?.content?.[0]?.text;
  try {
    const parsed = typeof rawText === "string" ? JSON.parse(rawText) : payload;
    return {
      label,
      boxes: parsed.boxes ?? [],
      masksRle: parsed.masks ?? [],
      scores: parsed.scores ?? [],
    };
  } catch {
    return { label, boxes: [], scores: [] };
  }
}
```

### 4.3 Stage 2: Constrained Simulation Compiler & WAEC Chief Examiner (`muse-wonder-1.0` & `muse-spark-1.3`)

- **Latency vs. Depth Routing:**
  - Use **`muse-spark-1.3`** (`reasoning: { effort: "low" }` or `"medium"`) for **real-time interactive Viva turns** (`< 1.2s` latency) while the student is adjusting sliders or speaking.
  - Use **`muse-wonder-1.0`** (`reasoning: { effort: "high" }`) for the **Initial Paper-to-3D Blueprint Compilation** and the **Final WAEC Chief Examiner Graph & Table Audit**.
- **Critical API Constraint:** On `POST /v1/responses`, structured JSON output MUST use `text: { format: { type: "json_schema", name: "...", strict: true, schema: {...} } }`. Never use `response_format` on `/v1/responses` (that is only for `/v1/chat/completions`), and never use recursive `$ref` schemas.

```typescript
// apps/api-server/src/meta/museWonder.ts
export const SNAPLAB_COMPILER_SCHEMA = {
  type: "json_schema",
  name: "snaplab_3d_spatial_blueprint",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "experimentMode",
      "experimentTitle",
      "waecScoreOutOf20",
      "vivaSpokenPrompt",
      "nodes3D",
      "connections3D",
      "physicsInit",
      "chemistryInit",
      "waecDeductions",
    ],
    properties: {
      experimentMode: {
        type: "string",
        enum: [
          "physics_meter_bridge",
          "chemistry_titration",
          "physics_ray_optics",
        ],
      },
      experimentTitle: { type: "string" },
      waecScoreOutOf20: { type: "number" },
      vivaSpokenPrompt: { type: "string" },
      nodes3D: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "apparatusType",
            "paperBbox",
            "extrusionHeightMm",
            "rotationDeg",
            "status",
            "tooltip",
          ],
          properties: {
            id: { type: "string" },
            apparatusType: {
              type: "string",
              enum: [
                "battery_cell",
                "resistance_box",
                "unknown_resistor",
                "galvanometer",
                "meter_bridge_wire",
                "switch_key",
                "burette",
                "conical_flask",
                "converging_lens",
              ],
            },
            paperBbox: { type: "array", items: { type: "number" } },
            extrusionHeightMm: { type: "number" },
            rotationDeg: { type: "number" },
            status: {
              type: "string",
              enum: ["valid", "wiring_error", "waec_penalty"],
            },
            tooltip: { type: "string" },
          },
        },
      },
      connections3D: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fromNodeId", "toNodeId", "isShortCircuitPath"],
          properties: {
            fromNodeId: { type: "string" },
            toNodeId: { type: "string" },
            isShortCircuitPath: { type: "boolean" },
          },
        },
      },
      physicsInit: {
        type: "object",
        additionalProperties: false,
        required: [
          "emfVolts",
          "internalResOhms",
          "resBoxOhms",
          "unknownResOhms",
          "jockeyCm",
          "keyClosed",
        ],
        properties: {
          emfVolts: { type: "number" },
          internalResOhms: { type: "number" },
          resBoxOhms: { type: "number" },
          unknownResOhms: { type: "number" },
          jockeyCm: { type: "number" },
          keyClosed: { type: "boolean" },
        },
      },
      chemistryInit: {
        type: "object",
        additionalProperties: false,
        required: [
          "acidFormula",
          "acidMolarity",
          "baseFormula",
          "baseMolarity",
          "pipetteVolumeCm3",
          "stoichiometricRatio",
          "indicator",
        ],
        properties: {
          acidFormula: { type: "string" },
          acidMolarity: { type: "number" },
          baseFormula: { type: "string" },
          baseMolarity: { type: "number" },
          pipetteVolumeCm3: { type: "number" },
          stoichiometricRatio: { type: "number" },
          indicator: {
            type: "string",
            enum: ["methyl_orange", "phenolphthalein"],
          },
        },
      },
      waecDeductions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ruleCode", "description", "marksLost", "fixInstruction"],
          properties: {
            ruleCode: { type: "string" },
            description: { type: "string" },
            marksLost: { type: "number" },
            fixInstruction: { type: "string" },
          },
        },
      },
    },
  },
} as const;
```

### 4.4 Stage 3: Real-Time Streaming Audio & Nigerian Pidgin/Accent Biasing (`muse-voice-transcribe-1.0`)

- **Endpoint:** `wss://api.meta.ai/v1/asr/realtime` (or file upload via `POST /v1/asr/transcribe`).
- **Why Vocabulary Biasing Is Essential:** Standard ASR models mishear Nigerian students saying _"galvanometer"_, _"concordant titre"_, _"potentiometer"_, _"methyl orange"_, or Pidgin phrases like _"e no dey deflect"_ or _"abeg check my burette reading"_.
- Pass custom vocabulary keywords in the initial WebSocket configuration frame so recognition accuracy hits 99%:

```typescript
// apps/api-server/src/meta/museVoice.ts
export const WAEC_VOCABULARY_BIASING = [
  "WAEC",
  "NECO",
  "JAMB",
  "galvanometer",
  "potentiometer",
  "constantan wire",
  "jockey",
  "rheostat",
  "resistance box",
  "Leclanche cell",
  "Daniel cell",
  "burette",
  "pipette",
  "conical flask",
  "concordant titre",
  "meniscus",
  "parallax error",
  "methyl orange",
  "phenolphthalein",
  "tetraoxosulphate",
  "trioxonitrate",
  "hydrochloric",
  "sodium trioxocarbonate",
  "ohm",
  "ammeter",
];
```

### 4.5 Stage 4: Annotated WAEC Diagram Correction (`muse-image-1.0`)

- When a student loses marks on their hand-drawn circuit or ray diagram (e.g., forgetting arrows on light rays or drawing an ammeter in parallel), call `POST /v1/images/edits` with `model: "muse-image-1.0"` to generate a clean, side-by-side **"WAEC Chief Examiner Model Diagram"** overlaid on their notebook page.

---

## 5. RUST -> WEBASSEMBLY (`wasm-bindgen`) HIGH-SPEED DETERMINISTIC PHYSICS CORE

Why Rust + WASM? Because when the student drags the Jockey $J$ along the $100\text{ cm}$ wire or opens the burette tap while 3D smoke particles and shaders are running, **WASM executes the physical differential equations in `< 50 microseconds`**.

Create `crates/snaplab-core-wasm/src/lib.rs`:

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct CircuitStateInput {
    pub emf_volts: f64,
    pub internal_res_ohms: f64,
    pub res_box_ohms: f64,
    pub unknown_res_base_ohms: f64,
    pub jockey_cm: f64,
    pub wire_temp_c: f64,
    pub key_closed: bool,
    pub dt_sec: f64,
}

#[derive(Serialize, Deserialize)]
pub struct CircuitStateOutput {
    pub effective_unknown_ohms: f64,
    pub null_balance_cm: f64,
    pub galvano_current_micro_a: f64,
    pub total_current_amps: f64,
    pub wire_power_watts: f64,
    pub new_wire_temp_c: f64,
    pub is_short_circuit: bool,
    pub is_at_null_point: bool,
}

#[wasm_bindgen]
pub fn step_meter_bridge_physics(input_json: &str) -> String {
    let inp: CircuitStateInput = serde_json::from_str(input_json).unwrap();

    // Temperature coefficient of resistance for Constantan / Manganin vs Copper
    let alpha_temp_coeff = 0.0040;
    let effective_x = inp.unknown_res_base_ohms * (1.0 + alpha_temp_coeff * (inp.wire_temp_c - 28.0));

    if !inp.key_closed {
        // Newton's Law of Cooling back toward 28.0°C ambient Abuja room temperature
        let cooled_temp = (inp.wire_temp_c - (inp.wire_temp_c - 28.0) * 0.45 * inp.dt_sec).max(28.0);
        let null_cm = (inp.res_box_ohms / (inp.res_box_ohms + effective_x)) * 100.0;
        let out = CircuitStateOutput {
            effective_unknown_ohms: effective_x,
            null_balance_cm: null_cm,
            galvano_current_micro_a: 0.0,
            total_current_amps: 0.0,
            wire_power_watts: 0.0,
            new_wire_temp_c: cooled_temp,
            is_short_circuit: false,
            is_at_null_point: false,
        };
        return serde_json::to_string(&out).unwrap();
    }

    let is_short = inp.res_box_ohms <= 0.15;
    let parallel_branch_res = if is_short {
        0.05
    } else {
        (inp.res_box_ohms * effective_x) / (inp.res_box_ohms + effective_x)
    };

    let total_i = inp.emf_volts / (inp.internal_res_ohms + parallel_branch_res);
    let power_w = total_i * total_i * parallel_branch_res;

    // Wheatstone / Meter Bridge potential difference across Galvanometer G
    let null_cm = (inp.res_box_ohms / (inp.res_box_ohms + effective_x)).clamp(0.01, 0.99) * 100.0;
    let bridge_imbalance = (inp.jockey_cm - null_cm) / 50.0;
    let galvano_ua = bridge_imbalance * inp.emf_volts * 48.0;

    // Thermal integration (Joule heating P = I^2 * R minus convective cooling)
    let heating_rate = if is_short { 38.0 } else { power_w * 1.8 };
    let cooling_rate = (inp.wire_temp_c - 28.0) * 0.35;
    let next_temp = (inp.wire_temp_c + (heating_rate - cooling_rate) * inp.dt_sec).clamp(28.0, 220.0);

    let out = CircuitStateOutput {
        effective_unknown_ohms: effective_x,
        null_balance_cm: null_cm,
        galvano_current_micro_a: galvano_ua,
        total_current_amps: total_i,
        wire_power_watts: power_w,
        new_wire_temp_c: next_temp,
        is_short_circuit: is_short,
        is_at_null_point: galvano_ua.abs() < 1.2,
    };

    serde_json::to_string(&out).unwrap()
}

#[derive(Serialize, Deserialize)]
pub struct TitrationInput {
    pub acid_molarity: f64,
    pub base_molarity: f64,
    pub pipette_vol_cm3: f64,
    pub added_acid_cm3: f64,
    pub mole_ratio_acid_to_base: f64, // e.g., 2.0 for 2HCl + Na2CO3
    pub eye_angle_deg: f64,           // Camera tilt relative to meniscus (-25 to +25 deg)
    pub indicator: String,            // "methyl_orange" | "phenolphthalein"
}

#[derive(Serialize, Deserialize)]
pub struct TitrationOutput {
    pub true_volume_cm3: f64,
    pub apparent_parallax_volume_cm3: f64,
    pub parallax_error_cm3: f64,
    pub theoretical_endpoint_cm3: f64,
    pub solution_ph: f64,
    pub flask_rgb: [u8; 3],
    pub stage_status: String, // "undershot" | "concordant_endpoint" | "overshot_penalty"
}

#[wasm_bindgen]
pub fn compute_titration_step(input_json: &str) -> String {
    let inp: TitrationInput = serde_json::from_str(input_json).unwrap();

    // 1. Theoretical equivalence volume V_eq = (n * M_B * V_B) / M_A
    let v_eq = (inp.mole_ratio_acid_to_base * inp.base_molarity * inp.pipette_vol_cm3) / inp.acid_molarity;

    // 2. Optical Meniscus Parallax Error calculation: delta_V = R_burette * tan(theta) * area_factor
    let theta_rad = inp.eye_angle_deg.to_radians();
    let parallax_err = 0.24 * theta_rad.sin();
    let apparent_vol = (inp.added_acid_cm3 + parallax_err).max(0.0);

    // 3. Stoichiometric mole balance & continuous pH curve
    let moles_base_init = (inp.base_molarity * inp.pipette_vol_cm3) / 1000.0;
    let moles_acid_added = (inp.acid_molarity * inp.added_acid_cm3) / 1000.0;
    let eq_acid_moles = moles_base_init * inp.mole_ratio_acid_to_base;
    let total_vol_l = (inp.pipette_vol_cm3 + inp.added_acid_cm3) / 1000.0;

    let ph = if (moles_acid_added - eq_acid_moles).abs() < 1e-6 {
        if inp.mole_ratio_acid_to_base > 1.5 { 3.85 } else { 7.0 }
    } else if moles_acid_added < eq_acid_moles {
        let excess_oh = ((eq_acid_moles - moles_acid_added) / inp.mole_ratio_acid_to_base) / total_vol_l;
        (14.0 + excess_oh.max(1e-7).log10()).clamp(7.0, 13.3)
    } else {
        let excess_h = (moles_acid_added - eq_acid_moles) / total_vol_l;
        (-excess_h.max(1e-7).log10()).clamp(1.1, 7.0)
    };

    // 4. Smooth Henderson-Hasselbalch RGB Indicator Interpolation
    let rgb: [u8; 3] = if inp.indicator == "methyl_orange" {
        // Transition pH 3.1 (Red: 239, 68, 68) <-> 3.8 (Salmon Orange: 249, 115, 22) <-> 4.4 (Yellow: 250, 204, 21)
        if ph >= 4.4 {
            [250, 204, 21]
        } else if ph >= 3.75 {
            let t = (ph - 3.75) / (4.4 - 3.75);
            [
                (249.0 + t * (250.0 - 249.0)) as u8,
                (115.0 + t * (204.0 - 115.0)) as u8,
                (22.0 + t * (21.0 - 22.0)) as u8,
            ]
        } else if ph >= 3.1 {
            let t = (ph - 3.1) / (3.75 - 3.1);
            [
                (239.0 + t * (249.0 - 239.0)) as u8,
                (68.0 + t * (115.0 - 68.0)) as u8,
                (68.0 + t * (22.0 - 68.0)) as u8,
            ]
        } else {
            [239, 68, 68]
        }
    } else {
        // Phenolphthalein: Magenta Pink (236, 72, 153) above 8.3, Clear/White below 8.2
        if ph >= 8.3 { [236, 72, 153] } else { [226, 232, 240] }
    };

    let vol_diff = inp.added_acid_cm3 - v_eq;
    let status = if vol_diff.abs() <= 0.10 {
        "concordant_endpoint"
    } else if vol_diff < -0.10 {
        "undershot"
    } else {
        "overshot_penalty"
    };

    let out = TitrationOutput {
        true_volume_cm3: inp.added_acid_cm3,
        apparent_parallax_volume_cm3: apparent_vol,
        parallax_error_cm3: parallax_err,
        theoretical_endpoint_cm3: v_eq,
        solution_ph: ph,
        flask_rgb: rgb,
        stage_status: status.to_string(),
    };

    serde_json::to_string(&out).unwrap()
}
```

---

## 6. 3D SPATIAL HOLOGRAM ENGINE (REACT THREE FIBER + CUSTOM SHADERS)

### 6.1 How the "Paper-to-3D Extrusion" Works Mathematically

1. The student's notebook image ($W \times H$) is mapped as a high-res texture onto a 3D plane (`<mesh rotation={[-Math.PI / 2, 0, 0]}>`) lying flat on the virtual desk ($y = 0$).
2. Every bounding box $[x_{\min}, y_{\min}, x_{\max}, y_{\max}] \in [0, 1]^4$ returned by **`SAM 3.1`** is converted into 3D world coordinates on the notebook surface:
   $$X_{\text{world}} = \left(\frac{x_{\min} + x_{\max}}{2} - 0.5\right) \cdot W_{\text{plane}}, \quad Z_{\text{world}} = \left(\frac{y_{\min} + y_{\max}}{2} - 0.5\right) \cdot H_{\text{plane}}$$
3. An animated spring uniform `uExtrusionProgress` ($0.0 \to 1.0$) drives vertex displacement along the $Y$-axis (`position.y *= uExtrusionProgress`), while a glowing green `SAM 3.1` wireframe footprint pulses at $y = 0.01$ directly over the student's biro drawing.

### 6.2 Custom GLSL Fragment Shader for Overheating Wire & Electron Pulses (`wireThermal.glsl`)

```glsl
// apps/web-client/src/components/spatial/shaders/wireThermal.glsl
uniform float uTime;
uniform float uCurrentAmps;
uniform float uWireTempC;     // 28.0°C normal -> 180.0°C short-circuit overload
uniform float uIsShortCircuit;

varying vec2 vUv;

void main() {
  // Base copper/constantan metallic color
  vec3 baseMetal = vec3(0.72, 0.45, 0.20);

  // Travelling electron drift wave proportional to current I
  float electronWave = sin(vUv.x * 45.0 - uTime * uCurrentAmps * 8.0);
  float pulseMask = smoothstep(0.75, 0.98, electronWave) * clamp(uCurrentAmps / 2.0, 0.0, 1.0);
  vec3 electronGlow = vec3(0.22, 0.74, 0.97) * pulseMask;

  // Blackbody thermal radiation glow as temperature climbs above 60°C
  float heatFactor = clamp((uWireTempC - 45.0) / 135.0, 0.0, 1.0);
  vec3 thermalColor = mix(vec3(0.95, 0.25, 0.05), vec3(1.0, 0.92, 0.45), heatFactor * heatFactor);

  // High-frequency arc flicker during short-circuit
  float arcFlicker = uIsShortCircuit > 0.5 ? (0.7 + 0.3 * sin(uTime * 90.0)) : 1.0;

  vec3 finalColor = mix(baseMetal + electronGlow, thermalColor * 2.2 * arcFlicker, heatFactor);
  gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 7. OFFICIAL WAEC CHIEF EXAMINER RUBRIC ENGINE (GROUNDING DATASET)

Hardcode these authentic WAEC Physics (Paper 3) & Chemistry (Paper 3) Chief Examiner deduction rules into `apps/api-server/src/rubrics/waec_chief_examiner.json` so `Muse Wonder 1.0` grades like a real West African examiner:

1. **Burette Precision Rule (`CHEM-BUR-2DP`):** All burette readings (Initial and Final) and average titre calculations MUST be recorded to **two decimal places** (e.g., `24.50 cm³`, never `24.5 cm³`). _Penalty: -1 mark per column._
2. **Concordant Titre Rule (`CHEM-CONCORD-020`):** Average titre must be calculated solely from two or more concordant readings that agree within **$\pm 0.20\text{ cm}^3$**. Averaging Rough titre or discordant values incurs a penalty. _Penalty: -2 marks._
3. **Meniscus Parallax Rule (`CHEM-PARALLAX`):** Lower meniscus must be read at eye level ($ heta\_{\text{eye}} = 0^\circ$) for colorless solutions.
4. **Circuit Key & Polarization Rule (`PHYS-KEY-OPEN`):** Key $K$ must be opened immediately after taking each galvanometer balance reading to prevent wire heating ($\Delta T$) and Leclanché cell polarization. _Penalty: -1 mark._
5. **Graph Scale & Slope Triangle Rule (`PHYS-GRAPH-23`):** Plotted points must occupy at least $\frac{2}{3}$ of the millimeter graph grid, axes must state both quantity and unit (e.g., $R\,(\Omega)$ against $L^{-1}\,(\text{cm}^{-1})$), and the right-angled triangle used to determine the slope must span at least $\frac{2}{3}$ of the line of best fit. _Penalty: -2 marks._
6. **Ray Diagram Arrow Rule (`PHYS-OPTICS-ARROW`):** Every incident, refracted, and emergent light ray on an optics diagram must carry a directional arrow; virtual rays and image construction lines must be dotted. _Penalty: -½ mark per missing arrow._

---

## 8. 10-DAY SOLO EXECUTION SCHEDULE (OCT 26 – NOV 4, 2026)

| Day               | Date                | Milestone & Concrete Deliverable                                                                                                                                                                                                                           |
| :---------------- | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-Hackathon** | **Oct 21 – Oct 25** | Film 3 high-contrast 5-second video clips of a real Nigerian exercise book in Kubwa (Meter Bridge Circuit, Titration Setup + Table, Ray Optics). Set up `dev.meta.ai` key and install `Muse Code` CLI (`curl -fsSL https://dev.meta.ai/install.sh \| sh`). |
| **Day 1**         | **Mon, Oct 26**     | Kickoff at 5:00 PM WAT. Initialize monorepo with `Muse Code`. Implement Bun + Hono backend (`/api/segment` calling `sam-3.1` in parallel and `/api/compile` calling `muse-wonder-1.0` with `SNAPLAB_COMPILER_SCHEMA`).                                     |
| **Day 2**         | **Tue, Oct 27**     | Compile the Rust `snaplab-core-wasm` crate (`step_meter_bridge_physics` & `compute_titration_step`) and bind to the Next.js Zustand store at 120 Hz.                                                                                                       |
| **Day 3**         | **Wed, Oct 28**     | Build the React Three Fiber **3D Hologram Bench** (`HologramBenchCanvas.tsx`). Map the notebook photo onto the 3D ground plane and animate 3D extruded meshes rising out of `SAM 3.1` bounding box coordinates.                                            |
| **Day 4**         | **Thu, Oct 29**     | Add **Destructive Physics & Shaders**: `wireThermal.glsl` cherry-red glow, 3D spark & smoke particle emitters on short-circuit ($R = 0\,\Omega$), and `LabSoundWorklet.ts` procedural Web Audio synthesizer.                                               |
| **Day 5**         | **Fri, Oct 30**     | Build the **3D Chemistry Titration Bench**: Borosilicate glass burette with refractive meniscus zoom loupe, eye-level parallax angle detector, and Henderson-Hasselbalch pH color swirl shader.                                                            |
| **Day 6**         | **Sat, Oct 31**     | Build the **Interactive WAEC Millimeter Graph Sheet** (`WaecMillimeterGraph.tsx`) with live point logging, Line-of-Best-Fit drawing, and automatic $\frac{2}{3}$ slope triangle grading.                                                                   |
| **Day 7**         | **Sun, Nov 1**      | Wire up **`Muse Voice Transcribe`** (`wss://api.meta.ai/v1/asr/realtime`) with Nigerian Pidgin/English vocabulary biasing for the live **WAEC Oral Viva Examiner** + **`Muse Image`** (`/v1/images/edits`) diagram correction card.                        |
| **Day 8**         | **Mon, Nov 2**      | Add client-side **MediaPipe Hands WASM** ("Pinch-to-Pour" burette tap & "Slide-Finger" Jockey control) + preload 3 "One-Click Judge Demo Scans" so judges in SF can test without a physical notebook.                                                      |
| **Day 9**         | **Tue, Nov 3**      | Deploy production build (Cloud Run / Vercel + Bun API server). Record and edit the **2-minute viral submission video** (showing real Kubwa notebook -> 3D extrusion -> short-circuit sparks -> Pidgin voice viva).                                         |
| **Day 10**        | **Wed, Nov 4**      | **SUBMIT BY 8:00 PM WAT** (7 hours before the 2:00 AM WAT / 9:00 PM EST deadline). Post the demo video on X & LinkedIn tagging `@MetaAI` and `@cerebral_valley` for the $50,000 Community/Viral Bonus Pool.                                                |

---

## 9. KICKOFF PROMPT FOR CLAUDE CODE / MUSE CODE

Copy and paste this exact prompt into **Muse Code** (`muse`) or **Claude Code** on Day 1 to scaffold the entire application automatically:

> **Prompt:**  
> "Read `SNAPLAB_NG_MASTER_ARCHITECTURE.md` in the root directory. We are building SnapLab NG for the Meta Global AI Developer Hackathon. Execute Phase 1 through Phase 3 in order:
>
> 1. Scaffold the Bun workspace (`apps/api-server`, `apps/web-client`, and `crates/snaplab-core-wasm`).
> 2. Implement the Meta Model API (`https://api.meta.ai/v1`) orchestration endpoints in `apps/api-server` using `sam-3.1` parallel segmentation over `POST /v1/responses`, `muse-wonder-1.0` structured JSON compilation using `text.format`, `muse-voice-transcribe-1.0` WebSocket relay over `wss://api.meta.ai/v1/asr/realtime`, and `muse-image-1.0` diagram editing.
> 3. Implement the deterministic physics and titration solvers and the React Three Fiber 3D Hologram Bench (`HologramBenchCanvas.tsx`) with the `SAM 3.1` paper-to-3D extrusion animation, thermal wire shader, Web Audio synthesizer, and WAEC Millimeter Graph Sheet. Ensure 100% TypeScript strictness and include 3 pre-loaded WAEC notebook demo states for one-click judge testing."
