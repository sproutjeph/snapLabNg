import { describe, expect, it } from "vitest";
import { formatLength, formatOhm, formatSig3, reciprocalRow } from "./format";

describe("notebook formatting", () => {
  it("formats lengths to 1 d.p. and rounds 62.45 half up to 62.5", () => {
    expect(formatLength(57)).toBe("57.0");
    expect(formatLength(25.34)).toBe("25.3");
    expect(formatLength(62.45)).toBe("62.5");
    expect(formatOhm(2)).toBe("2.0");
  });

  it("formats reciprocals to 3 s.f. with trailing zeros kept", () => {
    expect(formatSig3(1 / 50.2)).toBe("0.0199");
    expect(formatSig3(1)).toBe("1.00");
    expect(formatSig3(0.25)).toBe("0.250");
    expect(formatSig3(1 / 3)).toBe("0.333");
  });

  it("works out R and l reciprocals from her own reading (docs/15 section 5, G1 row 4)", () => {
    // Source: docs/15 section 5 golden page row R = 4.0 ohm, l = 57 cm.
    expect(reciprocalRow({ id: "g1-4", rOhm: 4, lCm: 57 })).toEqual({
      rInv: "0.250",
      lInv: "0.0175",
    });
  });
});
