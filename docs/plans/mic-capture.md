# Push-to-talk mic capture (PCM16, 16 kHz, mono)

## Goal
Capture the student's spoken answer to an examiner question while she holds a button, and hand it out as raw **PCM16 mono 16 kHz** chunks in real time. That is the format the Meta realtime voice relay needs (AGENTS.md "Meta API gotchas", docs/06 §5.5, docs/04 §2 ⑥: "mic → AudioWorklet (downsample to 16 kHz PCM16) → WS /ws/examiner"). This slice is the browser half only. The lead builds the WebSocket relay and connects the two.

## Out of scope
- The WebSocket, `/ws/examiner`, Voice Transcribe and any network call. Any change to `ExaminerConsole.tsx`.
- 3D. New dependencies.

## Files
All under `apps/web/src/examiner/voice/`. Owner: **Muse Code**, branch `muse/mic-capture`, worktree `~/Desktop/SnapLabNG-muse`.
- `resample.ts` (pure):
  - `class Resampler16k { constructor(inRate: number); push(input: Float32Array): Float32Array; flush(): Float32Array }` is a streaming downsampler to 16 kHz.
  - Each output sample is the average of the input samples in its window (a box filter, so there is no aliasing from plain decimation). It must work for integer ratios (48 000 → 3) and non-integer ones (44 100 → 2.75625).
  - Leftover input carries over between `push` calls, so a stream gives the same output however it is split into blocks.
  - `inRate` below 16 000 throws.
- `pcm16.ts` (pure):
  - `floatToPcm16(f: Float32Array): Int16Array` clamps to [−1, 1] and scales so that −1 → −32768 and 1 → 32767.
  - `class Chunker { constructor(samplesPerChunk = 1600); push(s: Int16Array): Int16Array[]; flush(): Int16Array | null }` gives 100 ms chunks at 16 kHz. `flush` returns any partial chunk at release.
- `wav.ts` (pure): `pcm16ToWav(chunks: Int16Array[], sampleRate = 16000): Blob` writes a standard 44-byte RIFF/WAVE header with PCM format 1, mono and 16-bit samples. It is for testing by ear only.
- `pcmWorklet.js`: an `AudioWorkletProcessor` (`registerProcessor("snaplab-pcm", …)`) that posts each input block (channel 0, `Float32Array`) to the main thread through `port.postMessage`, transferring its buffer. All resampling stays on the main thread in `resample.ts`, so it can be tested. Load it with `audioContext.audioWorklet.addModule(new URL("./pcmWorklet.js", import.meta.url))`, and check that `bun run build` emits it.
- `usePushToTalk.ts`: `usePushToTalk({ onChunk(pcm: Int16Array): void; onLevel?(rms0to1: number): void })` returns `{ state: "idle" | "starting" | "recording" | "denied" | "unsupported", start(): Promise<void>, stop(): void }`.
  - `start()` must be called from a user gesture. It creates or resumes the `AudioContext` (iOS Safari needs the gesture), calls `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })` and connects the worklet. Then each block goes through `Resampler16k` → `floatToPcm16` → `Chunker` → `onChunk`.
  - `stop()` flushes the resampler and the chunker (it sends the last partial chunk), disconnects the nodes and **stops every media track**, so the mic light goes off.
  - On unmount it does the same as `stop()`.
  - A permission refusal gives `denied`. Missing `getUserMedia` or `AudioWorklet` gives `unsupported`.
  - `onLevel` is throttled to about 20 per second.
- `MicPreview.tsx`: a page for `?mic=1`.
  - A big "Hold to speak" button: pointer down starts, pointer up, pointer cancel or pointer leave stops, and Space works the same way.
  - It shows a live level bar, the seconds recorded, the chunk count and the state.
  - "Download WAV" downloads the last recording through `pcm16ToWav`.
  - Friendly text for `denied` ("Allow the microphone in your browser settings, or type your answer instead") and for `unsupported`.
  - It sets `window.__SNAPLAB_READY__ = true` after mount.
- `voice.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?mic=1` switch, keeping every other switch.

## Tests (`bun run --filter @snaplab/web test`)
- `Resampler16k(48000)`: 4800 samples in give 1600 out. A constant 0.5 in gives 0.5 out (to 1e-6).
- `Resampler16k(44100)`: 44 100 samples in, pushed in blocks of 128, give 16 000 ± 1 samples (`push` totals plus `flush`). The same input in blocks of 1000 gives the same samples (to 1e-6).
- A 1 kHz sine at 48 kHz, resampled, has about 2 × 1000 zero crossings per second of output (within 2 %).
- `new Resampler16k(8000)` throws.
- `floatToPcm16([−1, 0, 1, 2, −3])` gives `[−32768, 0, 32767, 32767, −32768]`.
- `Chunker(1600)`: pushing 4000 samples gives two chunks of 1600, and `flush` returns 800. Pushing 1600 gives one chunk, and `flush` returns null.
- `pcm16ToWav([new Int16Array(16000)])` gives a Blob of 44 + 32 000 bytes whose header reads "RIFF", "WAVE", format 1, 1 channel, 16 000 Hz and 16 bits.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`. The built `dist/` contains the worklet file.
- On port 5176, `bun run shot -- --route "/?mic=1" --base http://localhost:5176` renders on phone and laptop with no console errors (headless browsers have no mic, so the shots show the idle or unsupported state).
- By hand, in desktop Chrome on `localhost:5176/?mic=1`:
  - holding the button shows a moving level;
  - releasing turns the mic light off;
  - the downloaded WAV plays back as your voice at normal speed.
  Say in the PR that you did this.
- The PR `muse/mic-capture` → `main` starts with the Muse Code line from AGENTS.md, and its counts are checked against the branch.

## Implementer
Muse Code (fresh session). The lead adds `/ws/examiner` and switches on the console's "Hold to speak" button with this hook.
