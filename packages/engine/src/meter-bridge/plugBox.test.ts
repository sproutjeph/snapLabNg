import { describe, expect, it } from "vitest";
import { PLUG_CONTACT_OHM } from "./constants";
import { boxOhm } from "./plugBox";

// A plug in shorts its coil; R is the sum of the coils with their plugs out
// (plug-key resistance box, Nelkon & Parker).
const values = [1, 2, 2, 5, 10];

describe("plug resistance box", () => {
  it("is only the contact resistance with every plug in", () => {
    expect(boxOhm(values, [true, true, true, true, true])).toBeCloseTo(PLUG_CONTACT_OHM, 12);
  });

  it("adds the coil whose plug is out", () => {
    expect(boxOhm(values, [true, true, true, false, true])).toBeCloseTo(5 + PLUG_CONTACT_OHM, 12);
  });

  it("sums every coil with all plugs out", () => {
    expect(boxOhm(values, [false, false, false, false, false])).toBeCloseTo(
      20 + PLUG_CONTACT_OHM,
      12,
    );
  });
});
