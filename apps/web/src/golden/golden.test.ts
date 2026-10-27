import { GoldenRecording, type SnapEvent } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { createRecorder } from "./recorder";
import { replay } from "./replay";

const META = {
  id: "test-1",
  title: "Test recording",
  page: { file: "test-1.jpg", width: 800, height: 1000 },
} as const;

const ACCEPTED: SnapEvent = { type: "accepted", request_id: "r1", image_sha256: "sha" };
const MODE: SnapEvent = { type: "mode", experiment: "meter_bridge", confidence: "high" };
const DONE: SnapEvent = { type: "done", total_ms: 800 };

function recordingWith(times: number[]): GoldenRecording {
  const events: SnapEvent[] = [ACCEPTED, MODE, DONE];
  return GoldenRecording.parse({
    version: 1,
    ...META,
    events: times.map((at_ms, i) => ({ at_ms, event: events[i] as SnapEvent })),
  });
}

describe("golden recorder and replay", () => {
  it("measures at_ms from the first pushed event with a fake clock", () => {
    const times = [100, 250, 900];
    let tick = 0;
    const recorder = createRecorder(META, { now: () => times[tick++] ?? 0 });
    recorder.push(ACCEPTED);
    recorder.push(MODE);
    recorder.push(DONE);
    const rec = recorder.finish();
    expect(rec.events.map((e) => e.at_ms)).toEqual([0, 150, 800]);
  });

  it("throws on finish when the stream does not start with accepted or end with done", () => {
    const recorder = createRecorder(META, { now: () => 0 });
    recorder.push(ACCEPTED);
    recorder.push(MODE);
    expect(() => recorder.finish()).toThrow(/done/);
    const other = createRecorder(META, { now: () => 0 });
    other.push(MODE);
    other.push(DONE);
    expect(() => other.finish()).toThrow(/accepted/);
  });

  it("yields every event in order with sleep gaps divided by speed", async () => {
    const rec = recordingWith([0, 400, 1000]);
    const sleeps: number[] = [];
    const seen: string[] = [];
    for await (const event of replay(rec, {
      signal: new AbortController().signal,
      speed: 4,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    })) {
      seen.push(event.type);
    }
    expect(seen).toEqual(["accepted", "mode", "done"]);
    expect(sleeps).toEqual([100, 150]);
  });

  it("stops after the current event when the signal aborts, without throwing", async () => {
    const rec = recordingWith([0, 400, 1000]);
    const controller = new AbortController();
    const seen: string[] = [];
    for await (const event of replay(rec, {
      signal: controller.signal,
      sleep: async () => {},
    })) {
      seen.push(event.type);
      controller.abort();
    }
    expect(seen).toEqual(["accepted"]);
  });

  it("rejects events that are out of time order", () => {
    const parsed = GoldenRecording.safeParse({
      version: 1,
      ...META,
      events: [
        { at_ms: 500, event: ACCEPTED },
        { at_ms: 100, event: DONE },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
