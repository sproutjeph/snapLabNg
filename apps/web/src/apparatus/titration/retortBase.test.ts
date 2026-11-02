import { describe, expect, it } from "vitest";
import { RETORT_STAND_DIMS } from "./dimensions";
import { createRetortBaseGeometry } from "./retortBase";

describe("retort stand base", () => {
  it.each(["high", "low"] as const)("sits on the desk at y = 0 (%s tier)", (quality) => {
    const geo = createRetortBaseGeometry(quality);
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    expect(box).not.toBeNull();
    // The mesh is placed at y = baseHeight / 2 (RetortStand.tsx), so its world min y is:
    const worldMinY = (box?.min.y ?? NaN) + RETORT_STAND_DIMS.baseHeight / 2;
    const worldMaxY = (box?.max.y ?? NaN) + RETORT_STAND_DIMS.baseHeight / 2;
    expect(worldMinY).toBeCloseTo(0, 5);
    expect(worldMaxY).toBeCloseTo(RETORT_STAND_DIMS.baseHeight, 5);
    geo.dispose();
  });
});
