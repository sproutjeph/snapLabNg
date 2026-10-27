import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VoiceServerMessage } from "@snaplab/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Config, loadConfig } from "./env";
import { SpendLedger, VOICE_RESERVE_USD, VOICE_USD_PER_S } from "./spend";
import { sessionConfig, startVoiceSession, type Upstream, VOICE_MODEL, VOICE_URL } from "./voice";

// A dummy key, built at runtime so no key-shaped literal sits in the source.
const DUMMY = ["LLM", "test", "secret", "789"].join("_");
const live = (): Config => loadConfig({ MODE: "live", MODEL_API_KEY: DUMMY });

const clock = { ms: 0 };

function harness(cfg: Config = live(), cap = 1) {
  const ledger = new SpendLedger(join(mkdtempSync(join(tmpdir(), "v-")), "l.json"), cap, cap);
  const sentUp: Array<string | Uint8Array> = [];
  const down: VoiceServerMessage[] = [];
  const closed = { up: false, down: false };
  let openedUrl = "";
  const up: Upstream = {
    send: (d) => sentUp.push(d),
    close: () => {
      closed.up = true;
    },
    onopen: null,
    onmessage: null,
    onclose: null,
  };
  const session = startVoiceSession(
    cfg,
    {
      ledger,
      openUpstream: (url) => {
        openedUrl = url;
        return up;
      },
      now: () => clock.ms,
    },
    {
      send: (m) => down.push(m),
      close: () => {
        closed.down = true;
      },
    },
  );
  return { session, up, sentUp, down, closed, ledger, openedUrl: () => openedUrl };
}

const second = () => new Uint8Array(32_000); // 1 s of PCM16 mono 16 kHz
const audioSent = (sent: Array<string | Uint8Array>) =>
  sent
    .filter((d): d is Uint8Array => d instanceof Uint8Array)
    .reduce((t, d) => t + d.byteLength, 0);

afterEach(() => {
  vi.useRealTimers();
  clock.ms = 0;
});

describe("examiner voice relay", () => {
  it("sends the key only in the first message, as Meta's realtime docs require", () => {
    const h = harness();
    expect(h.openedUrl()).toBe(VOICE_URL);
    h.up.onopen?.();
    const first = JSON.parse(String(h.sentUp[0]));
    expect(first).toEqual(sessionConfig(DUMMY));
    expect(first.authorization.accessToken).toBe(`Bearer ${DUMMY}`);
    expect(first).toMatchObject({ audioEncoding: "PCM_16KHZ", model: VOICE_MODEL });
    // Nothing the browser receives ever contains the key.
    expect(JSON.stringify(h.down)).not.toContain(DUMMY);
  });

  it("queues audio until Meta accepts the session, then forwards it and ends the stream", () => {
    const h = harness();
    h.up.onopen?.();
    h.session.onClientAudio(second());
    h.session.onClientEnd();
    expect(h.sentUp).toHaveLength(1); // only the config so far
    h.up.onmessage?.(JSON.stringify({ sessionId: "s1" }));
    expect(h.down[0]).toEqual({ type: "ready" });
    expect(h.sentUp[1]).toBeInstanceOf(Uint8Array);
    expect(JSON.parse(String(h.sentUp[2]))).toEqual({ type: "endStream" });
  });

  it("passes partial and final transcripts on, then settles what the audio cost", () => {
    const h = harness();
    h.up.onopen?.();
    h.up.onmessage?.(JSON.stringify({ sessionId: "s1" }));
    h.session.onClientAudio(second());
    h.session.onClientAudio(second());
    h.session.onClientEnd();
    h.up.onmessage?.(JSON.stringify({ type: "transcript", transcript: "e go", final: false }));
    h.up.onmessage?.(
      JSON.stringify({ type: "transcript", transcript: "e go scratch the wire", final: true }),
    );
    expect(h.down.slice(1)).toEqual([
      { type: "transcript", text: "e go", final: false },
      { type: "transcript", text: "e go scratch the wire", final: true },
    ]);
    expect(h.closed).toEqual({ up: true, down: true });
    // $0.18 per audio hour, whole seconds rounded up (dev.meta.ai pricing): 2 s.
    expect(h.ledger.summary().totalUsd).toBeCloseTo(2 * VOICE_USD_PER_S, 4);
  });

  it("refuses outside live mode and when the budget is used up, without opening Meta", () => {
    const off = harness(loadConfig({ MODE: "fixtures" }));
    expect(off.openedUrl()).toBe("");
    expect(off.down[0]?.type).toBe("error");
    expect(off.closed.down).toBe(true);
    const broke = harness(live(), 0);
    expect(broke.openedUrl()).toBe("");
    expect(broke.down[0]?.type).toBe("error");
  });

  it("hides Meta's error text and charges the reserve when the session fails", () => {
    const h = harness();
    h.up.onopen?.();
    h.up.onmessage?.(JSON.stringify({ type: "error", message: "internal detail xyz" }));
    expect(h.down.at(-1)?.type).toBe("error");
    expect(JSON.stringify(h.down)).not.toContain("xyz");
    expect(h.ledger.summary().totalUsd).toBeCloseTo(VOICE_RESERVE_USD, 4);
  });

  it("never runs more than 5 s ahead of real time, as Meta's realtime docs require", () => {
    vi.useFakeTimers();
    const h = harness();
    h.up.onopen?.();
    h.up.onmessage?.(JSON.stringify({ sessionId: "s1" }));
    for (let i = 0; i < 20; i++) h.session.onClientAudio(second()); // a burst of 20 s
    expect(audioSent(h.sentUp)).toBeLessThanOrEqual(5 * 32_000);
    for (let t = 0; t < 30; t++) {
      clock.ms += 1000;
      vi.advanceTimersByTime(1000);
      expect(audioSent(h.sentUp)).toBeLessThanOrEqual((clock.ms / 1000 + 5) * 32_000);
    }
    expect(audioSent(h.sentUp)).toBe(20 * 32_000);
  });

  it("keeps and sends at most 60 s of audio, then ends the stream itself", () => {
    vi.useFakeTimers();
    const h = harness();
    h.up.onopen?.();
    for (let i = 0; i < 70; i++) h.session.onClientAudio(second()); // before the handshake
    h.up.onmessage?.(JSON.stringify({ sessionId: "s1" }));
    for (let t = 0; t < 70; t++) {
      clock.ms += 1000;
      vi.advanceTimersByTime(1000);
    }
    expect(audioSent(h.sentUp)).toBe(60 * 32_000);
    const ends = h.sentUp.filter((d) => typeof d === "string" && d.includes("endStream"));
    expect(ends).toHaveLength(1);
  });
});
