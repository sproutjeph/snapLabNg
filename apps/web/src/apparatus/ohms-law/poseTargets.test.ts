import { describe, expect, it } from "vitest";
import { BENCH_FOOTPRINTS } from "./LeadParts";
import { OHMS_LAW_LAYOUT } from "./layout";
import { benchBounds, POSE_TARGETS } from "./poseTargets";

const inside = (t: readonly number[], f: { cx: number; cz: number; hx: number; hz: number }) =>
  Math.abs((t[0] ?? 0) - f.cx) <= f.hx && Math.abs((t[2] ?? 0) - f.cz) <= f.hz;

const footOf = (slot: keyof typeof OHMS_LAW_LAYOUT) => {
  const [x, , z] = OHMS_LAW_LAYOUT[slot].position;
  const f = BENCH_FOOTPRINTS.find((b) => b.cx === x && Math.abs(b.cz - z) < 1e-9);
  if (!f) throw new Error(`no footprint for ${slot}`);
  return f;
};

describe("lesson pose targets follow the layout", () => {
  it("aims the wire pose inside the wire board's footprint", () => {
    expect(inside(POSE_TARGETS.wire, footOf("wire"))).toBe(true);
  });

  it("aims the box pose inside the resistance box's footprint", () => {
    expect(inside(POSE_TARGETS.box, footOf("box"))).toBe(true);
  });

  it("aims the readings pose between the two meters", () => {
    const a = OHMS_LAW_LAYOUT.ammeter.position;
    const v = OHMS_LAW_LAYOUT.voltmeter.position;
    const t = POSE_TARGETS.readings;
    expect(t[0]).toBeGreaterThanOrEqual(Math.min(a[0], v[0]));
    expect(t[0]).toBeLessThanOrEqual(Math.max(a[0], v[0]));
    expect(t[2]).toBeGreaterThanOrEqual(Math.min(a[2], v[2]));
    expect(t[2]).toBeLessThanOrEqual(Math.max(a[2], v[2]));
  });

  it("aims the bench and connect poses inside the bench's area", () => {
    const b = benchBounds();
    for (const t of [POSE_TARGETS.bench, POSE_TARGETS.connect]) {
      expect(t[0]).toBeGreaterThan(b.x0);
      expect(t[0]).toBeLessThan(b.x1);
      expect(t[2]).toBeGreaterThan(b.z0);
      expect(t[2]).toBeLessThan(b.z1);
    }
  });
});
