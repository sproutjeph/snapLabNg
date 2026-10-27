import { describe, expect, it } from "vitest";
import { GoldenRecording } from "./golden";

const rec = (times: number[], lastType: "done" | "accepted" = "done") => ({
  version: 1,
  id: "g1",
  title: "G1",
  page: { file: "g1.jpg", width: 1024, height: 1448 },
  events: times.map((at_ms, i) => ({
    at_ms,
    event:
      i === 0
        ? { type: "accepted", request_id: "r", image_sha256: "x" }
        : i === times.length - 1
          ? lastType === "done"
            ? { type: "done", total_ms: at_ms }
            : { type: "accepted", request_id: "r", image_sha256: "x" }
          : { type: "mode", experiment: "meter_bridge", confidence: "high" },
  })),
});

describe("GoldenRecording", () => {
  // docs/04 §4.3: a golden replay is the recorded stream with timestamps, accepted first, done last.
  it("accepts a stream from accepted to done in time order", () => {
    expect(GoldenRecording.safeParse(rec([0, 120, 900])).success).toBe(true);
  });
  it("rejects events out of time order", () => {
    expect(GoldenRecording.safeParse(rec([0, 500, 400])).success).toBe(false);
  });
  it("rejects a stream that does not end with done", () => {
    expect(GoldenRecording.safeParse(rec([0, 100, 200], "accepted")).success).toBe(false);
  });
});
