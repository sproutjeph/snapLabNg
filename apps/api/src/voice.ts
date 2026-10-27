// The examiner voice relay (docs/04 §2 ⑥, docs/06 §5.5). The browser never talks to Meta:
// it streams PCM16 mono 16 kHz here, and this relay opens one Voice Transcribe session per
// spoken answer, puts the key in the first JSON message (never a header, never the client),
// forwards her audio and sends back only her transcript. Shapes verified Oct 27 against
// dev.meta.ai/docs/api-reference/voice/realtime and /voice/schemas.

import type { VoiceServerMessage } from "@snaplab/contracts";
import type { Config } from "./env";
import { MAX_VOICE_S, type SpendLedger, VOICE_RESERVE_USD, VOICE_USD_PER_S } from "./spend";

export const VOICE_URL = "wss://api.meta.ai/v1/asr/realtime";
export const VOICE_MODEL = "muse-voice-transcribe-1.0";
const BYTES_PER_S = 16_000 * 2;
/** Upper bound on a whole session, including the wait for the final transcript. */
const SESSION_TIMEOUT_MS = (MAX_VOICE_S + 20) * 1000;
/** Meta closes a stream that runs more than 5 s ahead of real time (realtime docs). */
const MAX_AHEAD_S = 4;

/** WAEC practical words, to bias recognition (docs/06 §5.5). */
export const WAEC_KEYWORDS = [
  "jockey",
  "galvanometer",
  "metre bridge",
  "constantan",
  "balance point",
  "resistance box",
  "Leclanché",
  "polarisation",
  "parallax",
  "centre-zero",
  "end error",
  "burette",
  "pipette",
  "conical flask",
  "meniscus",
  "concordant titre",
  "methyl orange",
  "phenolphthalein",
  "trioxocarbonate",
  "tetraoxosulphate",
  "refraction",
  "lateral displacement",
  "critical angle",
];

/** The first message on the upstream socket. It carries the key, so it is never logged. */
export function sessionConfig(apiKey: string) {
  return {
    authorization: { accessToken: `Bearer ${apiKey}` },
    audioEncoding: "PCM_16KHZ",
    model: VOICE_MODEL,
    mode: "PUSH_TO_TALK",
    partialMode: "CUMULATIVE",
    emitAudioProgress: false,
    languageBias: ["English"],
    keywords: WAEC_KEYWORDS,
  };
}

/** The upstream socket, as much of WebSocket as the relay uses (a fake in tests). */
export interface Upstream {
  send(data: string | Uint8Array): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((data: string) => void) | null;
  onclose: (() => void) | null;
}

/** The browser's socket. */
export interface Downstream {
  send(message: VoiceServerMessage): void;
  close(): void;
}

export interface VoiceSession {
  onClientAudio(bytes: Uint8Array): void;
  onClientEnd(): void;
  onClientClose(): void;
}

/**
 * Starts one relay session for one spoken answer. It refuses at once (an `error`, then a
 * close) outside live mode or when the spend cap would be passed. Settles the ledger with
 * the audio actually sent (whole seconds), or the reserve if the session failed.
 */
export function startVoiceSession(
  cfg: Config,
  deps: { ledger: SpendLedger; openUpstream: (url: string) => Upstream; now?: () => number },
  down: Downstream,
): VoiceSession {
  const refuse = (message: string): VoiceSession => {
    down.send({ type: "error", message });
    down.close();
    return { onClientAudio() {}, onClientEnd() {}, onClientClose() {} };
  };
  if (cfg.mode !== "live" || !cfg.apiKey) {
    return refuse("Spoken answers need the live examiner. Type your answer instead.");
  }
  if (!deps.ledger.reserve(VOICE_RESERVE_USD)) {
    return refuse("The live AI budget is used up. Type your answer instead.");
  }

  const apiKey = cfg.apiKey;
  const now = deps.now ?? (() => performance.now());
  // Her audio waiting to go to Meta: before the handshake, and whenever she is ahead of
  // real time. Capped at the 60 s limit, so a client cannot fill memory.
  const pending: Uint8Array[] = [];
  let receivedBytes = 0;
  let ready = false;
  let readyAtMs = 0;
  let endRequested = false;
  let endSent = false;
  let audioBytes = 0;
  let finished = false;
  let failed = false;
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;

  const up = deps.openUpstream(VOICE_URL);
  const timer = setTimeout(
    () => fail("The examiner took too long to hear you."),
    SESSION_TIMEOUT_MS,
  );

  function finish(): void {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (pumpTimer) clearTimeout(pumpTimer);
    // Whole seconds, rounded up so the ledger never undercounts against the hard cap.
    const seconds = Math.ceil(audioBytes / BYTES_PER_S);
    deps.ledger.settle(VOICE_RESERVE_USD, failed ? VOICE_RESERVE_USD : seconds * VOICE_USD_PER_S);
    try {
      up.close();
    } catch {}
    down.close();
  }

  function fail(message: string): void {
    if (finished) return;
    failed = true;
    down.send({ type: "error", message });
    finish();
  }

  /**
   * Sends what real time allows (Meta: never more than 5 s ahead of processing), then the
   * end of the stream once everything has gone. Called on new audio and on a 100 ms timer.
   */
  function pump(): void {
    pumpTimer = null;
    if (finished || !ready) return;
    const elapsedS = (now() - readyAtMs) / 1000;
    let allowed = Math.floor((elapsedS + MAX_AHEAD_S) * BYTES_PER_S) - audioBytes;
    while (pending.length > 0 && allowed > 0) {
      const head = pending[0] as Uint8Array;
      const chunk = head.byteLength > allowed ? head.subarray(0, allowed) : head;
      up.send(chunk);
      audioBytes += chunk.byteLength;
      allowed -= chunk.byteLength;
      if (chunk === head) pending.shift();
      else pending[0] = head.subarray(chunk.byteLength);
    }
    if (pending.length > 0) pumpTimer = setTimeout(pump, 100);
    else if (endRequested && !endSent) {
      endSent = true;
      up.send(JSON.stringify({ type: "endStream" }));
    }
  }

  up.onopen = () => up.send(JSON.stringify(sessionConfig(apiKey)));
  up.onmessage = (data) => {
    let m: { sessionId?: unknown; type?: unknown; transcript?: unknown; final?: unknown };
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!ready && typeof m.sessionId === "string" && m.type === undefined) {
      ready = true;
      readyAtMs = now();
      down.send({ type: "ready" });
      pump();
      return;
    }
    if (m.type === "transcript" && typeof m.transcript === "string") {
      const final = m.final === true;
      down.send({ type: "transcript", text: m.transcript, final });
      if (final) finish();
      return;
    }
    // Meta's own error text is not passed on: it can name internals.
    if (m.type === "error") fail("The examiner could not hear that. Try again, or type.");
  };
  up.onclose = () => {
    if (!finished) fail("The examiner could not hear that. Try again, or type.");
  };

  return {
    onClientAudio(bytes) {
      if (finished || endRequested) return;
      // Stop at the length cap: the rest of a very long answer is neither kept nor sent.
      const room = MAX_VOICE_S * BYTES_PER_S - receivedBytes;
      if (room <= 0) {
        endRequested = true;
        pump();
        return;
      }
      const chunk = (bytes.byteLength > room ? bytes.subarray(0, room) : bytes).slice();
      receivedBytes += chunk.byteLength;
      pending.push(chunk);
      if (chunk.byteLength < bytes.byteLength) endRequested = true;
      if (!pumpTimer) pump();
    },
    onClientEnd() {
      if (finished) return;
      endRequested = true;
      if (!pumpTimer) pump();
    },
    onClientClose() {
      if (!finished) {
        // She left before the final transcript: charge what was sent, not a failure.
        finish();
      }
    },
  };
}
