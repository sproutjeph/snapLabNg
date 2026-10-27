import { describe, expect, it, vi } from "vitest";
import { createLiteState, meanFps, resetLite, updateLite } from "./liteCheck";
import type { DeviceSignals } from "./tier";
import { chooseTier, parseOverride, settingsFor, stepDown } from "./tier";
import { measureWarmupFps } from "./warmup";

function signals(partial: Partial<DeviceSignals>): DeviceSignals {
  return {
    gpu: null,
    deviceMemoryGb: null,
    cores: null,
    isMobile: false,
    warmupFps: null,
    ...partial,
  };
}

describe("chooseTier", () => {
  it("gives low for a Mali-G52 phone with 4 GB and 60 fps", () => {
    expect(
      chooseTier(signals({ gpu: "Mali-G52", deviceMemoryGb: 4, isMobile: true, warmupFps: 60 })),
    ).toBe("low");
  });

  it("gives mid for an Apple GPU phone at 60 fps", () => {
    expect(chooseTier(signals({ gpu: "Apple GPU", isMobile: true, warmupFps: 60 }))).toBe("mid");
  });

  it("gives high for an NVIDIA laptop at 60 fps", () => {
    expect(
      chooseTier(
        signals({
          gpu: "ANGLE (NVIDIA GeForce RTX 3060 Laptop GPU)",
          isMobile: false,
          warmupFps: 60,
        }),
      ),
    ).toBe("high");
  });

  it("gives mid for a laptop at 40 fps", () => {
    expect(chooseTier(signals({ gpu: null, isMobile: false, warmupFps: 40 }))).toBe("mid");
  });

  it("gives low for any device at 25 fps", () => {
    expect(
      chooseTier(
        signals({
          gpu: "ANGLE (NVIDIA GeForce RTX 3060 Laptop GPU)",
          isMobile: false,
          warmupFps: 25,
        }),
      ),
    ).toBe("low");
    expect(chooseTier(signals({ gpu: "Apple GPU", isMobile: true, warmupFps: 25 }))).toBe("low");
  });

  it("gives low for 2 GB of memory", () => {
    expect(
      chooseTier(
        signals({
          gpu: "ANGLE (NVIDIA GeForce RTX 3060 Laptop GPU)",
          deviceMemoryGb: 2,
          isMobile: false,
          warmupFps: 60,
        }),
      ),
    ).toBe("low");
  });

  it("gives high for all-null signals on a laptop", () => {
    expect(chooseTier(signals({}))).toBe("high");
  });

  it("gives low for other weak GPUs", () => {
    expect(
      chooseTier(signals({ gpu: "PowerVR Rogue GE8320", isMobile: true, warmupFps: 60 })),
    ).toBe("low");
    expect(chooseTier(signals({ gpu: "Adreno (TM) 610", isMobile: true, warmupFps: 60 }))).toBe(
      "low",
    );
    expect(
      chooseTier(signals({ gpu: "Intel(R) HD Graphics 620", isMobile: false, warmupFps: 60 })),
    ).toBe("low");
    expect(chooseTier(signals({ gpu: "Mali-T830", isMobile: true, warmupFps: 60 }))).toBe("low");
  });
});

describe("settingsFor", () => {
  it("gives low dpr [1, 1], no bloom and no physical glass", () => {
    const low = settingsFor("low");
    expect(low.dpr).toEqual([1, 1]);
    expect(low.bloom).toBe(false);
    expect(low.physicalGlass).toBe(false);
  });

  it("gives the exact settings for every tier", () => {
    expect(settingsFor("low")).toEqual({
      dpr: [1, 1],
      bloom: false,
      shadows: false,
      maxParticles: 150,
      physicalGlass: false,
      segments: 0.5,
    });
    expect(settingsFor("mid")).toEqual({
      dpr: [1, 1.5],
      bloom: true,
      shadows: false,
      maxParticles: 400,
      physicalGlass: false,
      segments: 0.75,
    });
    expect(settingsFor("high")).toEqual({
      dpr: [1, 2],
      bloom: true,
      shadows: true,
      maxParticles: 1000,
      physicalGlass: true,
      segments: 1,
    });
  });

  it("allows more particles at each step up", () => {
    expect(settingsFor("mid").maxParticles).toBeGreaterThan(settingsFor("low").maxParticles);
    expect(settingsFor("high").maxParticles).toBeGreaterThan(settingsFor("mid").maxParticles);
  });
});

describe("stepDown", () => {
  it("goes high to mid to low and stays at low", () => {
    expect(stepDown("high")).toBe("mid");
    expect(stepDown("mid")).toBe("low");
    expect(stepDown("low")).toBe("low");
  });
});

describe("parseOverride", () => {
  it("reads a valid tier from the query string", () => {
    expect(parseOverride("?quality=low")).toBe("low");
    expect(parseOverride("?quality=mid")).toBe("mid");
    expect(parseOverride("?quality=high")).toBe("high");
  });

  it("gives null for any other value", () => {
    expect(parseOverride("?quality=ultra")).toBeNull();
    expect(parseOverride("?quality=1")).toBeNull();
    expect(parseOverride("")).toBeNull();
    expect(parseOverride("?other=low")).toBeNull();
  });
});

describe("lite check (fake PerformanceMonitor api)", () => {
  function fakeApi(fps: number) {
    return { averages: [fps, fps, fps] };
  }

  it("fires after 5 s under 20 fps at low, even when declines keep coming", () => {
    const state = createLiteState();
    expect(updateLite(state, "low", fakeApi(15).averages, 0)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 2500)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 4999)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 5000)).toBe(true);
    expect(updateLite(state, "low", fakeApi(15).averages, 60000)).toBe(true);
  });

  it("uses the mean of api.averages, not the last sample", () => {
    const state = createLiteState();
    expect(updateLite(state, "low", [40, 10, 10], 0)).toBe(false);
    expect(updateLite(state, "low", [40, 10, 10], 5000)).toBe(false);
    const state2 = createLiteState();
    expect(updateLite(state2, "low", [10, 25, 10], 0)).toBe(false);
    expect(updateLite(state2, "low", [10, 25, 10], 5000)).toBe(true);
  });

  it("resets the timer when the mean is 20 fps or more", () => {
    const state = createLiteState();
    expect(updateLite(state, "low", fakeApi(15).averages, 0)).toBe(false);
    expect(updateLite(state, "low", fakeApi(20).averages, 4000)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 4500)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 9499)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 9500)).toBe(true);
  });

  it("never fires above low, and resetLite clears the timer (onIncline)", () => {
    const state = createLiteState();
    expect(updateLite(state, "mid", fakeApi(10).averages, 0)).toBe(false);
    expect(updateLite(state, "mid", fakeApi(10).averages, 60000)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 0)).toBe(false);
    resetLite(state);
    expect(updateLite(state, "low", fakeApi(15).averages, 100)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 5099)).toBe(false);
    expect(updateLite(state, "low", fakeApi(15).averages, 5100)).toBe(true);
  });

  it("meanFps averages and handles an empty list", () => {
    expect(meanFps([])).toBe(0);
    expect(meanFps([10, 20, 30])).toBe(20);
  });
});

describe("measureWarmupFps (fake requestAnimationFrame)", () => {
  function installFakeRaf() {
    let queue: FrameRequestCallback[] = [];
    const raf = (cb: FrameRequestCallback): number => {
      queue.push(cb);
      return queue.length;
    };
    function step(now: number) {
      const pending = queue;
      queue = [];
      for (const cb of pending) cb(now);
    }
    return { raf, step };
  }

  it("starts the clock at the first frame, so a background tab does not give 0", async () => {
    const { raf, step } = installFakeRaf();
    vi.stubGlobal("requestAnimationFrame", raf);
    try {
      const result = measureWarmupFps(2000);
      // The tab is backgrounded first: no frame arrives until t=30000.
      step(30000);
      for (let t = 30000 + 16.7; t <= 30000 + 2100; t += 16.7) step(t);
      await expect(result).resolves.toBeGreaterThanOrEqual(50);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("restarts the sample after a frame gap over 250 ms", async () => {
    const { raf, step } = installFakeRaf();
    vi.stubGlobal("requestAnimationFrame", raf);
    try {
      const result = measureWarmupFps(1000);
      step(0);
      for (let t = 16.7; t <= 500; t += 16.7) step(t);
      // Long stall (hidden / jank): the earlier half-second must not count.
      step(5000);
      for (let t = 5000 + 16.7; t <= 5000 + 1100; t += 16.7) step(t);
      const fps = await result;
      expect(fps).toBeGreaterThanOrEqual(50);
      expect(fps).toBeLessThanOrEqual(70);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
