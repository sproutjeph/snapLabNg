# 02 — Meta AI API Verification for SnapLab NG (spec section 4)

Research date: 2026-10-21. Every fact below comes from public pages fetched today, and each is cited. "Not stated" means the official docs say nothing on the point. Facts from general knowledge, not checked today, are labelled that way.

**Bottom line.** The Meta Model API is real, and the spec's base URL, endpoints and model IDs are almost all correct. The spec still has **four integration bugs that would break at runtime** (SAM output parsing, SAM box coordinates, WebSocket auth, ASR audio format). It also makes **three capability assumptions that the docs contradict or don't support**: Pidgin/Yoruba/Hausa/Igbo ASR, a TTS voice for the examiner, and SAM working on hand-drawn schematic symbols. Its hackathon prize and judging claims don't match the official event page.

---

## 1. Platform overview (verified)

- Docs live at **https://dev.meta.ai/docs** (the old developer.meta.com/ai links redirect there).
- Base URL: `https://api.meta.ai/v1`, auth `Authorization: Bearer $MODEL_API_KEY`. Keys start with `LLM_` and belong to a team, and keys on one team share rate limits. Docs warn never to ship keys in browser or mobile code. Sources: [overview](https://dev.meta.ai/docs/overview), [quickstart](https://dev.meta.ai/docs/quickstart), [authentication](https://dev.meta.ai/docs/authentication)
- The API is OpenAI-SDK compatible (Responses and Chat Completions) and also has an Anthropic-compatible Messages API. [quickstart](https://dev.meta.ai/docs/quickstart)
- Endpoints listed in the [overview](https://dev.meta.ai/docs/overview): `POST /v1/responses` (Muse Wonder, Muse Spark, SAM), `POST /v1/images/generations`, `POST /v1/images/edits`, `POST /v1/asr/transcribe`, `wss://api.meta.ai/v1/asr/realtime`, `POST /v1/files`.
- **Muse Code** is real. Install with `curl -fsSL https://dev.meta.ai/install.sh | sh` (Windows: `irm https://dev.meta.ai/install.ps1 | iex`), then run `muse`. [overview](https://dev.meta.ai/docs/overview). Its subscription tiers (Everyday, High, Power, Maximum) are described as "10–50 prompts every 5 hours" scaled up. No prices are given and there is no hackathon tier. [muse-code/subscriptions](https://dev.meta.ai/docs/muse-code/subscriptions)

### Models, IDs, limits and prices

| Model | Exact ID | Status | In → Out | Context | Price | Rate limit (per team) |
|---|---|---|---|---|---|---|
| Muse Wonder | `muse-wonder-1.0` | **Preview** | text, image, video, audio, PDF → text | 1,048,576 | $4.00 in / $20.00 out / $0.20 cached per 1M tokens; no Contributor mode | 3,000 RPM, 4M TPM |
| Muse Spark 1.3 | `muse-spark-1.3` (also `-1.2`, `-1.1`) | latest, recommended | text, image, video, audio*, PDF → text | 1,048,576 | $1.25 / $4.25 / $0.15 | 3,000 RPM, 4M TPM each |
| Muse Spark Contributor | `muse-spark-1.3-contributor`, `muse-spark-1.2-contributor` | — | same | 1,048,576 | $0.10 / $0.20 / $0.002 (Meta may train on your data) | **150 RPM**, 3M TPM |
| Muse Image | `muse-image-1.0` | — | text + image → image | — | $0.01 per image | **150 RPM** |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | — | audio → text | — | $0.18 per audio hour | 256 concurrent streams, 16,000 streams/hour |
| SAM 3.1 | `sam-3.1` | — | text/box/point + image/video → boxes + masks | — | $2.50 per 1k images, $0.20 per 1k video frames | 3,000 RPM |

\* Muse Spark 1.3: "audio input is not fully supported", and **Muse Spark 1.2 is the version recommended for audio**. Sources: [models](https://dev.meta.ai/docs/models), [pricing-rate-limits](https://dev.meta.ai/docs/pricing-rate-limits).

Other capabilities: tool calling (parallel calls, streamed arguments), structured output, search grounding ($2.50 per 1k queries) and computer use (Wonder). No latency figures are published for any model. ([models](https://dev.meta.ai/docs/models))

**There is no text-to-speech model.** The models page says Muse Voice Transcribe "does not synthesize speech or provide a speech-to-speech conversation API." ([models](https://dev.meta.ai/docs/models))

---

## 2. SAM 3 / SAM 3.1

### Hosted API (`sam-3.1` on `/v1/responses`)
Sources: [sam/overview](https://dev.meta.ai/docs/sam/overview), [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting), [sam/reading-segmentation](https://dev.meta.ai/docs/sam/reading-segmentation), [sam/client-libraries](https://dev.meta.ai/docs/sam/client-libraries), [media-segmentation](https://dev.meta.ai/docs/media-segmentation), [model page](https://dev.meta.ai/models/sam-3-1/)

- **One concept per request.** The docs say "There is no multi-concept syntax": lists, "and" or newlines won't segment several concepts, so you send one request per concept. **The spec's fan-out pattern is correct.** Each image request returns **every matching instance**.
- **Prompt guidance:** use short noun phrases. Commands, questions, negation, boolean OR and spatial phrasing are unreliable.
- **Box and point prompts** are also supported, as a token syntax (`<0f>`, object IDs, `box`, `point`, with `w`/`h` set to the media's pixel size). Up to 16 objects per request; they can't be mixed with a noun phrase. `buildObjectPrompt()` builds these.
- **Inputs:**
  - Image: an `input_image` part with `image_url`, either a public URL or a base64 data URL. A signed R2 URL should work if the server can fetch it.
  - Video: `input_video` with `video_url` or `file_id` (upload with `purpose: "user_data"`). Video must be MP4 or MOV with H.264/H.265/MPEG-4, up to 15,000 frames (about 10 minutes). **VP9/WebM is not accepted**, and WebM is what Chrome's MediaRecorder produces by default. Video tracks up to 16 objects per frame.
  - The SAM docs only document `file_id` for video. The general Responses schema does list `file_id` on `input_image` ([responses/schemas](https://dev.meta.ai/docs/api-reference/responses/schemas)), but SAM image + `file_id` is undocumented, so test it.
- **Output is not JSON.** It is special-token text on the `output_text` lane, one line per image or per video frame, for example:
  `<0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561|><|mask;x=0;y=0;data=46,101,~...|>,1<|box;...|>`
  - Boxes are **xyxy in source pixels**, not normalized.
  - Masks are a custom **base85** encoding: `~` = lossless (default), `!` = one_bit, set with `metadata.mask_encoding`. They are not COCO RLE or PNG.
  - Confidence `c` (0–1) appears only with `metadata.include_confidence: "true"`.
  - Zero matches means an empty `output_text`.
  - Object IDs stay stable across video frames.
- **Parsing libraries:** official parsers are npm `@meta-sam/parser` (`parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`, `decodeMaskToRLE` → COCO RLE, `decodeMaskToSVGPath`) and pip `meta-sam-parser`. Optional extras: `@meta-sam/graphics` (Canvas 2D overlays), `@meta-sam/video` and `@meta-sam/react`. They are ESM only and need Node ^20.17 or >=22.9; Bun compatibility is not stated.
- Streaming is recommended, especially for video. Non-streaming returns the same output in one response.
- No latency figures are published for the hosted API.

### Open weights
- `facebook/sam3` (about 0.9B params; transformers `Sam3Model` / `Sam3Processor`; gated; custom SAM license) and `facebook/sam3.1` (checkpoints only, no transformers integration, code in the SAM 3 GitHub repo). Sources: [HF sam3](https://huggingface.co/facebook/sam3), [HF sam3.1](https://huggingface.co/facebook/sam3.1)
- SAM 3.1 adds "Object Multiplex" (shared-memory multi-object tracking) and is about 7x faster at 128 objects on one H100. ([HF sam3.1](https://huggingface.co/facebook/sam3.1))
- The SAM 3 paper puts it at about 850M params (about 450M vision encoder, 300M text encoder, 100M detector/tracker) and **30 ms per image on an H200** with 100+ objects. It is prompted with **a single noun phrase at a time**. ([arXiv 2511.16719](https://arxiv.org/pdf/2511.16719v2), [arXiv HTML](https://arxiv.org/html/2511.16719))
- **In-browser use: not officially supported.** Community WebGPU and ONNX ports exist for the tracker/video parts (for example [sam3-tracker-ONNX](https://huggingface.co/JohnJohnWong/sam3-tracker-ONNX), and a "SAM3-Tracker-WebGPU" Space linked from the HF card). I found no verified in-browser text-prompted detector. Roboflow describes SAM 3 as needing a server-class GPU (it runs on 16 GB GPUs). ([Roboflow](https://roboflow.com/blog/what-is-sam3)) For a 10-day build, **use the hosted API**. In-browser SAM is only realistic for SAM 1/2 point or box prompts (e.g. [WebSAM](https://xevion.dev/projects/websam)).

### Hand-drawn diagrams (the main technical risk)
- I found **no evidence, official or community, of SAM 3 or 3.1 being tested on hand-drawn circuit schematics or apparatus line drawings.** The official docs mention only photos, scans and charts as use-case examples. ([media-segmentation](https://dev.meta.ai/docs/media-segmentation))
- The paper's Limitations section says: "SAM 3 struggles to generalize to fine-grained out-of-domain concepts (e.g., aircraft types, medical terms)" and "is constrained to simple noun phrase prompts". ([arXiv](https://arxiv.org/pdf/2511.16719v2))
- On the positive side, SAM 3 scores **55.7 AP on COCO-O**, which includes sketch, cartoon and painting shifts (the best in its table). But COCO-O covers drawings of *everyday objects*. No per-domain sketch result is published.
- A schematic **resistor symbol (zig-zag or rectangle) or galvanometer symbol (circle with G) is an abstract symbol, not a picture of the physical object**. A prompt like "resistor" was learned from photos of real resistors. Treat SAM text prompts on biro schematics as **unproven, likely unreliable**. "Wire loop", "switch key" and "titration table" are especially unlikely to work: wires are thin ink lines, and a titration table is a table of readings, not an object.
- **Suggested mitigation (design, not code):** have Muse Spark or Wonder vision find components in a strict JSON schema with pixel boxes, then pass those boxes to SAM 3.1 as **box prompts** to get clean ink masks. Test on day 1 with 10–20 real exercise-book photos before committing to SAM text prompts.

---

## 3. Speech: Muse Voice Transcribe, and the missing TTS

Sources: [speech-to-text](https://dev.meta.ai/docs/speech-to-text), [api-reference/voice/realtime](https://dev.meta.ai/docs/api-reference/voice/realtime), [api-reference/voice/schemas](https://dev.meta.ai/docs/api-reference/voice/schemas), [model page](https://dev.meta.ai/models/muse-voice-transcribe/)

- **Realtime connection:** `wss://api.meta.ai/v1/asr/realtime?sessionId=...` (sessionId optional).
- **Auth goes in the first JSON frame,** not the HTTP header. The handshake (sent within 10 s) carries `authorization: { accessToken: "Bearer <key>" }`, and **the HTTP `Authorization` header is ignored** on this endpoint.
- **Handshake fields:** `model: "muse-voice-transcribe-1.0"`, `audioEncoding` (required: `PCM_24KHZ` preferred, or `PCM_16KHZ`), `mode` (`PUSH_TO_TALK` default, `ENDPOINTING` or `DIARIZATION`), `partialMode` (`CUMULATIVE` default or `DELTA`), `emitAudioProgress`, **`keywords`** (array of strings) and **`languageBias`** (array of language names). The server replies `{sessionId}`.
- **Audio:** raw signed 16-bit little-endian mono PCM in binary frames, with no container. Pace it at roughly real time and never send more than 5 s ahead, or the server closes with 1008.
- **Events:** `speechStart`, `transcript` (with `final`), `speechEnd`, `speechComplete` (with `turnId`), `speaker`, `audioProgress`, `error`. End input with `{"type":"endStream"}`.
- **Close codes:** 1000 ok; 1008 bad config or bad pacing (don't retry unchanged); 1011 backend error or max session; 1013 rate limited.
- **Session limits:** 60 minutes per session by default; 256 concurrent streams and 16,000 streams per hour per tenant.
- **Batch:** `POST /v1/asr/transcribe`, multipart with a `request` JSON part and an `audio` WAV part (mono 16-bit PCM at 16/24 kHz). Max 32 MB and 10 minutes.
- **Keyword biasing exists** as the `keywords` field. It "biases recognition but doesn't guarantee exact spelling." No max count or length is documented, and the list **cannot change mid-session**. The spec's 99% accuracy target has no basis in the docs.
- **Languages (25):** Arabic, Bengali, Dutch, English, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Kannada, Korean, Malay, Mandarin, Marathi, Polish, Portuguese, Spanish, Tagalog, Tamil, Telugu, Thai, Turkish, Vietnamese. Code-switching works across these.
  - **Nigerian Pidgin, Yoruba, Hausa and Igbo are not supported.**
  - No accent-robustness claims are made, including for Nigerian-accented English.
  - English is supported, so Nigerian English is likely usable but unbenchmarked. Pidgin phrases ("e no dey deflect") will be decoded as English, with unknown accuracy.
- Turn-level timestamps only: no word timestamps or confidence scores.
- **TTS: none on the Meta Model API.** The spec's "voice examiner" can listen but cannot speak back with a Meta model.
- Possible fallbacks:
  - The browser's Web Speech `speechSynthesis` API (not Meta, free).
  - Meta **MMS-TTS** open weights, VITS-based, 1,107 languages, **CC-BY-NC 4.0**. The model card lists `eng`, `pcm` (Nigerian Pidgin), `yor` and `hau`; `ibo` is not listed. ([HF facebook/mms-tts](https://huggingface.co/facebook/mms-tts), [mms-tts-hau](https://mixpeek.com/model/facebook/mms-tts-hau)) These are small models but need self-hosting; browser ONNX ports are unverified.
- **Muse Spark audio input** is another way to understand Pidgin speech. Use `muse-spark-1.2`, the version recommended for audio. Quality on Pidgin is unverified.

---

## 4. Muse Image (`muse-image-1.0`)

Source: [image-generation](https://dev.meta.ai/docs/image-generation), [pricing](https://dev.meta.ai/docs/pricing-rate-limits), [geographic policy](https://dev.meta.ai/legal/geographic-use-policy)

- **Endpoints:** `POST /v1/images/generations`, `POST /v1/images/edits`, or the Responses `image_generation` tool (the only tool Muse Image accepts).
- **Edits input:** multipart `image` (OpenAI SDK; several images allowed), or a JSON `images: [{image_url | file_id}]`.
- **Masks are not supported** (`mask` returns 400 `unsupported_parameter`).
- **Parameters:** `n` 1–10; `size` "WxH" (sets aspect ratio only, max 16:1, or "auto"); `response_format` `b64_json` (default) or `url`; `output_format` `webp` (default), `png` or `jpeg`; `reasoning_strength` `high` or `low` (low is faster, same price); `moderation` not allowed. The model is agentic and can search the web and run code before it renders.
- **Price and limits:** $0.01 per image, 150 RPM. Blocked prompts return 400 `content_policy_violation`. Not available in India.
- Watermarks and latency: not stated.
- **Docs say edits keep "the rest intact", but never claim the layout is preserved or the diagram is correct.** A generated "model diagram" could have wrong circuit topology or wrong labels. Treat it as illustrative. The side-by-side overlay on the notebook page has to be composited by the app.

---

## 5. Muse Wonder / Muse Spark on `/v1/responses`

- **Reasoning:** `reasoning: { effort }`. Values: `none` (400 on Wonder and Spark), `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. `max` works on Wonder and Spark 1.3 but not the Contributor variant. ([reasoning](https://dev.meta.ai/docs/reasoning))
  - Reasoning tokens count against `max_output_tokens` (minimum 16) and are billed as output.
  - Expect a delay before the first visible chunk when streaming.
  - In multi-turn use, **reasoning items must be carried across turns**, via `previous_response_id` or `include: ["reasoning.encrypted_content"]`. The two cannot be combined.
- **Structured output:** `text: { format: { type: "json_schema", name, schema, strict, description? } }`. `name` must be ≤64 characters from `[A-Za-z0-9_-]`. `response_format` is parsed but **does not configure structured output** on `/v1/responses`. `strict` defaults to false, but output is always schema-constrained; `strict` only turns on schema validation. ([structured-output](https://dev.meta.ai/docs/structured-output), [protocols/responses](https://dev.meta.ai/docs/protocols/responses), [responses/schemas](https://dev.meta.ai/docs/api-reference/responses/schemas))
  - Strict rules: root must be an object; no `allOf`/`oneOf` (`anyOf` allowed below the root); every object needs `additionalProperties: false` and `required` listing every key.
  - Recursive `$ref` returns 400.
  - Limits: nesting depth 10, 5,000 properties, 1,000 enum values.
  - **The spec's `SNAPLAB_COMPILER_SCHEMA` meets these rules** (checked by hand: every object has additionalProperties false and full `required` arrays, depth ≤4).
- **Other Responses fields:** `stream`, `background` (not with stream; max 600 per minute; body ≤1 MiB), `tools`, `parallel_tool_calls`, `store` (default true), `temperature`, `top_p`, `prompt_cache_retention`.
  - Not implemented: `stop`, `verbosity`, `logit_bias`, `n>1`, audio output, logprobs.
  - `truncation` accepts only `"disabled"`.
- **Images:** up to 50 per request; 50 MB inline or 1 GiB via Files. A roughly 1280 px image costs about 1,300–1,500 input tokens. ([image-understanding](https://dev.meta.ai/docs/image-understanding))
- **Files API:** `purpose: "user_data"`; 1 GiB per file, 100 GiB per team; optional `expires_after` (1 h – 30 d). Types: PNG, JPEG, GIF, WebP, MP4, MP3, WAV, PDF, text, JSON. ([file-handling](https://dev.meta.ai/docs/file-handling))
- **Latency:** the spec's figures (Spark under 1.2 s, Wonder blueprint under 2.2 s) **appear nowhere in the docs.** Muse Wonder at `high` effort, with an image and a schema this large, may well take far longer than 2.2 s, and Wonder is still in Preview.

---

## 6. Open-weight and on-device fallbacks

| Model | What it is | Useful for SnapLab? | Source |
|---|---|---|---|
| **Omnilingual ASR** (Nov 2025) | Apache-2.0 ASR family for 1,600+ languages. CTC 300M (about 2 GiB VRAM) up to 7B; LLM-decoder 300M–7B; zero-shot 7B. `yor_Latn`, `hau_Latn`, `ibo_Latn` and `eng_Latn` are listed; **`pcm_Latn` (Pidgin) not confirmed**. Streaming not stated. | Best Meta option for Yoruba/Hausa/Igbo speech. Needs a GPU server; batch, not realtime. | [ai.meta.com](https://ai.meta.com/research/publications/omnilingual-asr-open-source-multilingual-speech-recognition-for-1600-languages/), [HF omniASR-LLM-7B](https://huggingface.co/facebook/omniASR-LLM-7B), [language list](https://mintlify.wiki/facebookresearch/omnilingual-asr/supported-languages) |
| **MMS-TTS** | VITS TTS for 1,107 languages, CC-BY-NC-4.0; `eng`, `pcm`, `yor`, `hau` listed. | Only Meta route to a speaking examiner, including Pidgin. Non-commercial license. | [HF mms-tts](https://huggingface.co/facebook/mms-tts) |
| **Muse Glimmer** | 30B dense, text + image → text, Apache-2.0, 128K context. Runs via vLLM, SGLang, llama.cpp or Ollama; reported about 20 GB memory footprint (third-party). | Laptop or server offline fallback for the compiler or examiner. **Not phone or browser.** | [docs](https://dev.meta.ai/docs/muse-glimmer), [digitalcitizen](https://www.digitalcitizen.life/meta-launches-muse-glimmer-30b-model-for-local-ai-with-20gb-memory-footprint-and-faster-responses/) |
| **Muse Spark Open** | 816B MoE (42B active), BF16/NVFP4. | Not practical for this project. | [open-weight-models](https://dev.meta.ai/docs/open-weight-models) |
| **SAM 3 / 3.1 weights** | About 0.85–0.9B params, GPU server. | Self-host only if the API is unreachable. | see §2 |
| Llama (3.2 1B/3B etc.) | Docs at dev.meta.ai/llama. Small Llama models exist (general knowledge, not checked today). | Possible on-device text fallback; weak at vision and structured physics. | [dev.meta.ai/llama](https://dev.meta.ai/llama/) |
| SeamlessM4T v2 | Speech translation (general knowledge; African language coverage not checked today). | Low priority. | — |

---

## 7. What hackathon participants get

Sources: [official event page](https://dev.meta.ai/events/global-hackathon), [Cerebral Valley](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

- **Dates:** applications close Oct 25, 11:59 PM ET; start Oct 26; **submissions due Nov 4, 9:00 PM ET**; judging Nov 4–8; winners Nov 9. Capped at 20,000 accepted applicants.
- **Prizes:** **$1,000,000 total across two tracks** (Indie developer, Startup). No per-track or per-place breakdown is published.
  - The spec's "$400k track pool + $50k bonus, 1st prize $150,000" is **unverified**.
- **Judging:** Indie track is judged on "creativity, technical ambition, and whether it works." No weights are published.
  - **There is no "Use of Meta AI Tooling 25/25" criterion** on the official page.
- **Models named:** Muse Spark series, Muse Wonder, Muse Image and SAM 3.1 via Model API, plus open weights and Muse Code. **Muse Voice Transcribe is not named** on the event page, though it is a valid API model.
- **Credits:** third-party aggregators and a GitHub issue say **$150 in Meta Model API credits per selected participant** ([resourify](https://resourify.com/resources/meta-api), [freetokens #584](https://github.com/luongnv89/freetokens/issues/584)). **The official page as fetched today does not state an amount.**
  - Partner credits "for select participants": Baseten $100 + 2M TPM, Modal $100, Fireworks $25.
  - No hackathon-specific rate limits are published; standard team limits apply (§1).
- **Official Rules** were "to be published before Oct 26" and are not yet visible.
- **Region risk:** in July 2026 the Model API was a "public preview for developers in the US" ([blog](https://dev.meta.ai/resources/blog/build-with-muse-spark)). The [geographic use policy](https://dev.meta.ai/legal/geographic-use-policy) (updated Oct 12, 2026) lists no enabled countries. Nigeria is not restricted, but it is also not confirmed as enabled, and a geo-block page exists (`dev.meta.ai/unavailable?reason=geo`). **Confirm right away that the account can create a key from Nigeria.**

**Budget sanity check at list prices, against $150:** each scan fans out 7 SAM requests (about $0.0175, if each request is billed as one image), plus one Wonder call (say 5k in / 3k out ≈ $0.08). Spark viva turns cost fractions of a cent. ASR is $0.18 per hour and images $0.01 each. **$150 is ample**, unless Muse Wonder is called at `max` effort repeatedly.

---

## 8. Claim-by-claim verdict table

| # | Spec claim | Verdict | Correct detail | Source |
|---|---|---|---|---|
| 1 | Base URL `https://api.meta.ai/v1`, `Authorization: Bearer $MODEL_API_KEY` | VERIFIED | Same. Keys start `LLM_`; never put them in browser code. | [quickstart](https://dev.meta.ai/docs/quickstart), [auth](https://dev.meta.ai/docs/authentication) |
| 2 | `POST /v1/responses`, OpenAI-Responses style | VERIFIED | OpenAI SDK works with `baseURL` override. Several OpenAI fields unsupported (§5). | [protocols/responses](https://dev.meta.ai/docs/protocols/responses) |
| 3 | `text.format {type:"json_schema", name, strict:true, schema}`; never `response_format` on /responses; no recursive `$ref` | VERIFIED | Exact shape confirmed. Strict-subset rules and limits in §5. Spec schema complies. | [structured-output](https://dev.meta.ai/docs/structured-output), [schemas](https://dev.meta.ai/docs/api-reference/responses/schemas) |
| 4 | `POST /v1/files` to get a `file_id` for the SAM notebook *frame* | PARTLY TRUE | Files API exists (`purpose:"user_data"`). SAM docs document `file_id` only for **video**; images take `image_url` (public URL or base64 data URL). | [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting), [file-handling](https://dev.meta.ai/docs/file-handling) |
| 5 | Model `sam-3.1`, one short noun phrase per request, parallel fan-out | VERIFIED | "No multi-concept syntax." Returns all instances. 3,000 RPM is plenty. | [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| 6 | SAM request body (`input_text` + `input_image.image_url`) | VERIFIED | Matches docs. Add `stream:true` (recommended) and optionally `metadata:{include_confidence:"true"}`. | [sam/overview](https://dev.meta.ai/docs/sam/overview) |
| 7 | `parseSam31Output`: JSON in `output[0].content[0].text` with `boxes`, `masks`, `scores` | **WRONG: breaks** | Output is special-token text, not JSON. `JSON.parse` throws, the `catch` returns empty boxes, `filter` drops everything, and **every scan silently yields zero detections**. Use `@meta-sam/parser`. | [reading-segmentation](https://dev.meta.ai/docs/sam/reading-segmentation), [client-libraries](https://dev.meta.ai/docs/sam/client-libraries) |
| 8 | Boxes `[xMin,yMin,xMax,yMax]` normalized 0..1 | **WRONG: breaks** | xyxy in **source pixels**, with frame `w`,`h` attached. Normalize yourself before the homography/3D step. | [reading-segmentation](https://dev.meta.ai/docs/sam/reading-segmentation) |
| 9 | `masksRle?: string[]` | WRONG | Masks are custom base85 (`~` lossless, `!` one_bit). Convert with `decodeMaskToRLE` (COCO RLE), `decodeMaskToRaster` or `decodeMaskToSVGPath`. | same |
| 10 | `scores: number[]` always present | WRONG | Confidence `c` only with `metadata.include_confidence:"true"`. | [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| 11 | SAM 3.1 reliably segments hand-drawn "resistor", "galvanometer", "wire loop", "switch key", "titration table" in biro | UNVERIFIED (high risk) | No published evidence on schematics or line drawings. Paper notes weakness on fine-grained out-of-domain concepts. Schematic symbols are abstract. Test on day 1; consider Spark-vision boxes → SAM box prompts. | [arXiv limitations](https://arxiv.org/pdf/2511.16719v2), [media-segmentation](https://dev.meta.ai/docs/media-segmentation) |
| 12 | Notebook "frame/video" to SAM | PARTLY TRUE | Video supported, but **MP4/MOV only (no WebM)**, ≤15,000 frames, ≤16 tracked objects per frame. | [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| 13 | Models `muse-wonder-1.0` and `muse-spark-1.3` exist | VERIFIED | Both have 1M context; Wonder is **Preview**. Spark 1.3 audio input "not fully supported" (use 1.2 for audio). | [models](https://dev.meta.ai/docs/models) |
| 14 | `reasoning:{effort:"low"/"medium"/"high"}` | VERIFIED | Also `minimal`, `xhigh`, `max`; `none` returns 400. Carry reasoning items across turns. | [reasoning](https://dev.meta.ai/docs/reasoning) |
| 15 | Spark viva under 1.2 s; Wonder blueprint under 2.2 s | UNVERIFIED | No latency figures published. Reasoning adds a time-to-first-token delay. Wonder at high effort with an image and a large schema is unlikely to be reliably under 2.2 s. | [models](https://dev.meta.ai/docs/models), [reasoning](https://dev.meta.ai/docs/reasoning) |
| 16 | Model `muse-voice-transcribe-1.0` over `wss://api.meta.ai/v1/asr/realtime` | VERIFIED | Same. $0.18 per hour; 60-minute sessions. | [speech-to-text](https://dev.meta.ai/docs/speech-to-text) |
| 17 | `POST /v1/asr/transcribe` file upload | VERIFIED | Multipart: `request` JSON + `audio` WAV (mono PCM16, 16/24 kHz); ≤32 MB and ≤10 min. | same |
| 18 | Auth via `Authorization: Bearer` header (section 4.1 applied to WebSocket) | **WRONG: breaks** | For realtime, the **HTTP header is ignored**. Put `authorization:{accessToken:"Bearer <key>"}` in the first JSON frame within 10 s. The Bun relay must inject it server-side. | [speech-to-text](https://dev.meta.ai/docs/speech-to-text), [voice/realtime](https://dev.meta.ai/docs/api-reference/voice/realtime) |
| 19 | (Implied) relay browser mic audio as-is | **WRONG: breaks** | Must be raw PCM16 LE mono at 24 kHz or 16 kHz in binary frames, paced at real time (≤5 s ahead, or close 1008). Browser Opus/WebM must be converted, e.g. in an AudioWorklet. | same |
| 20 | Vocabulary biasing in the initial WS config frame | VERIFIED (name differs) | Field is `keywords: string[]`, set at session start only, no documented limits. "Doesn't guarantee exact spelling." | [voice/schemas](https://dev.meta.ai/docs/api-reference/voice/schemas) |
| 21 | Biasing makes recognition "hit 99%" | UNVERIFIED | No accuracy figures for accented English or Pidgin. | [model page](https://dev.meta.ai/models/muse-voice-transcribe/) |
| 22 | Listens in Nigerian English or **Pidgin** | PARTLY TRUE / WRONG for Pidgin | English supported; Nigerian accent unbenchmarked. **Pidgin, Yoruba, Hausa and Igbo are not among the 25 languages.** `languageBias:["English"]` is the best available. | [speech-to-text](https://dev.meta.ai/docs/speech-to-text) |
| 23 | (Implied) examiner speaks back with voice | **WRONG: gap** | **No TTS on the Meta Model API.** Use browser `speechSynthesis`, or self-host MMS-TTS (`eng`/`pcm`/`yor`/`hau`; CC-BY-NC). | [models](https://dev.meta.ai/docs/models), [HF mms-tts](https://huggingface.co/facebook/mms-tts) |
| 24 | `muse-image-1.0` via `POST /v1/images/edits` | VERIFIED | Multipart `image` or JSON `images[]`; **no `mask`**; $0.01 per image; 150 RPM; no diagram-correctness guarantee; not available in India. | [image-generation](https://dev.meta.ai/docs/image-generation) |
| 25 | Muse Code CLI via `https://dev.meta.ai/install.sh` | VERIFIED | `curl -fsSL https://dev.meta.ai/install.sh \| sh`; run `muse`; subscriptions or API key. | [overview](https://dev.meta.ai/docs/overview) |
| 26 | Five distinct Meta capabilities | VERIFIED | SAM 3.1, Wonder, Spark, Voice Transcribe and Image all exist. Only Spark, Wonder, Image and SAM are named on the event page. | [event page](https://dev.meta.ai/events/global-hackathon) |
| 27 | "25/25 on Use of Meta AI Tooling" judging criterion | UNVERIFIED | Not on the official page. Indie track: creativity, technical ambition, whether it works. Official Rules not yet published. | [event page](https://dev.meta.ai/events/global-hackathon) |
| 28 | Indie track $400k pool + $50k bonus; 1st prize $150k | UNVERIFIED | Official: $1M total across two tracks, no breakdown. | [event page](https://dev.meta.ai/events/global-hackathon) |
| 29 | Event Oct 26 – Nov 4, 2026 | VERIFIED | Submissions due Nov 4, 9:00 PM ET; judging Nov 4–8; winners Nov 9. | [event page](https://dev.meta.ai/events/global-hackathon) |
| 30 | (Implied) API usable from Nigeria | UNVERIFIED | Model API launched as a US public preview. The geographic policy does not list Nigeria as enabled or restricted. Check now. | [blog](https://dev.meta.ai/resources/blog/build-with-muse-spark), [geo policy](https://dev.meta.ai/legal/geographic-use-policy) |
| 31 | Cache SAM masks by SHA-256; R2 signed URLs | OK (app design) | Signed URLs work if publicly fetchable by Meta's servers. | [sam/segmenting](https://dev.meta.ai/docs/sam/segmenting) |

### Places where the spec's API usage would break (summary)
1. **SAM parsing (#7):** every detection is silently dropped, because the output is token text, not JSON.
2. **SAM coordinates (#8):** boxes are in pixels, not 0..1, so the 3D extrusion would be placed wrongly.
3. **SAM mask format (#9/#10):** no RLE, and scores are absent unless requested.
4. **SAM image via `file_id` (#4):** undocumented for images; use `image_url` or a data URL.
5. **Video to SAM as WebM (#12):** rejected; must be MP4/MOV.
6. **Realtime ASR auth (#18):** the header is ignored, so the handshake fails or times out after 10 s.
7. **Realtime ASR audio format and pacing (#19):** non-PCM or bursty audio gets closed with 1008.
8. **Pidgin ASR (#22) and examiner TTS (#23):** not supported by any Meta API model.
9. **Latency SLAs (#15):** unsupported by the docs; Wonder is Preview.
10. **Muse Image edits:** there is no mask parameter, and correctness is not guaranteed, so the generated "model diagram" must not be trusted for grading.
11. **SAM on biro schematics (#11):** unproven and likely weak; plan a fallback.
