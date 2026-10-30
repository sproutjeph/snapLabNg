import { METER_FULL_DEG, METER_STOP_DEG, METER_ZERO_DEG, paramsFromSeed } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import {
  DIAL,
  dialPoint,
  dialTexts,
  dialTicks,
  majorEvery,
  NEEDLE_LEN,
  needleAngleDeg,
  numeralFontM,
  numeralPoint,
  scaleLabel,
} from "./MeterDial";

// The dial prints what a real school meter prints: the scale numbers (multiples of the
// division, up to full scale), the unit letter and "d.c.". Never a reading. The needle is drawn
// inside the stops at +-METER_STOP_DEG.

const { ammeter, voltmeter } = paramsFromSeed(1);

describe("the meter dial prints only its scale", () => {
  it("numbers the ammeter 0 0.2 0.4 0.6 0.8 1, then the letter A and d.c.", () => {
    expect(dialTexts({ ...ammeter, letter: "A" })).toEqual([
      "0",
      "0.2",
      "0.4",
      "0.6",
      "0.8",
      "1",
      "A",
      "d.c.",
    ]);
  });

  it("numbers the voltmeter 0 1 2 3, then the letter V and d.c.", () => {
    expect(dialTexts({ ...voltmeter, letter: "V" })).toEqual(["0", "1", "2", "3", "V", "d.c."]);
  });

  it("prints each number through scaleLabel, as a multiple of the division up to full scale", () => {
    for (const m of [ammeter, voltmeter]) {
      for (const t of dialTicks(m.fullScale, m.division)) {
        if (t.label === null) continue;
        expect(t.label).toBe(scaleLabel(t.index * m.division));
        expect(Number(t.label)).toBeGreaterThanOrEqual(0);
        expect(Number(t.label)).toBeLessThanOrEqual(m.fullScale + 1e-9);
      }
    }
  });

  it("numbers every major tick and only those", () => {
    for (const m of [ammeter, voltmeter]) {
      for (const t of dialTicks(m.fullScale, m.division)) {
        expect(t.label !== null).toBe(t.kind === "major");
      }
    }
  });

  it("gives one tick per division, from the zero mark to full scale, with 3 kinds of tick", () => {
    const ticks = dialTicks(ammeter.fullScale, ammeter.division);
    expect(ticks).toHaveLength(Math.round(ammeter.fullScale / ammeter.division) + 1);
    expect(ticks[0]?.deg).toBeCloseTo(METER_ZERO_DEG, 9);
    expect(ticks[ticks.length - 1]?.deg).toBeCloseTo(METER_FULL_DEG, 9);
    expect(new Set(ticks.map((t) => t.kind))).toEqual(new Set(["major", "mid", "minor"]));
  });

  it("numbers about five ticks on the 1 A and 3 V dials, as the engine's meters have 50 and 60 divisions", () => {
    expect(majorEvery(50)).toBe(10);
    expect(majorEvery(60)).toBe(20);
  });
});

describe("the round dial", () => {
  it("keeps every scale number, whole, inside the paper disc", () => {
    for (const m of [ammeter, voltmeter]) {
      const ticks = dialTicks(m.fullScale, m.division);
      const em = numeralFontM(ticks.filter((t) => t.label !== null).length);
      for (const t of ticks) {
        if (t.label === null) continue;
        const [x, y] = numeralPoint(t.deg);
        // The glyphs are about 0.55 em wide and 0.8 em tall.
        const halfW = (t.label.length * 0.55 * em) / 2;
        const halfH = (0.8 * em) / 2;
        const far = Math.hypot(Math.abs(x) + halfW, Math.abs(y) + halfH);
        expect(far, `"${t.label}" on the ${m === ammeter ? "ammeter" : "voltmeter"}`).toBeLessThan(
          DIAL.radius - 0.0008,
        );
      }
    }
  });

  it("keeps the needle's tip and its tail inside the disc at both stops", () => {
    for (const stop of [-METER_STOP_DEG, METER_STOP_DEG]) {
      const [tx, ty] = dialPoint(stop, NEEDLE_LEN);
      expect(Math.hypot(tx, ty)).toBeLessThan(DIAL.radius);
      const [bx, by] = dialPoint(stop + 180, 0.011);
      expect(Math.hypot(bx, by)).toBeLessThan(DIAL.radius);
    }
  });

  it("puts the scale's ends inside the stops", () => {
    expect(METER_ZERO_DEG).toBeGreaterThan(-METER_STOP_DEG);
    expect(METER_FULL_DEG).toBeLessThan(METER_STOP_DEG);
  });
});

describe("the needle stays inside the stops", () => {
  it("never draws past +-METER_STOP_DEG, whatever the angle and the slam's buzz", () => {
    for (const deg of [-1000, -50, -45, -40, 0, 40, 45, 46.2, 1000, Number.NaN, Infinity]) {
      for (const buzz of [-2.2, 0, 2.2, Number.NaN, Infinity]) {
        expect(Math.abs(needleAngleDeg(deg, buzz))).toBeLessThanOrEqual(METER_STOP_DEG);
      }
    }
  });

  it("draws the engine's angle as it is when nothing buzzes it", () => {
    for (const deg of [METER_ZERO_DEG, -12.5, 0, 7, METER_FULL_DEG, METER_STOP_DEG]) {
      expect(needleAngleDeg(deg)).toBe(deg);
    }
  });

  it("bounces the buzz off the stop: it only moves a needle that is on it away from the stop", () => {
    expect(needleAngleDeg(METER_STOP_DEG, 2.2)).toBe(METER_STOP_DEG);
    expect(needleAngleDeg(METER_STOP_DEG, -2.2)).toBeCloseTo(METER_STOP_DEG - 2.2, 12);
  });

  it("reads a needle that is not a number as the zero mark", () => {
    expect(needleAngleDeg(Number.NaN)).toBe(METER_ZERO_DEG);
  });
});
