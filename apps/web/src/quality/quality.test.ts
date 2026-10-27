import { describe, expect, it } from "vitest";
import type { DeviceSignals } from "./tier";
import { chooseTier, parseOverride, settingsFor, stepDown } from "./tier";

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
