import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BENCH_FOOTPRINTS, seeded } from "./LeadParts";
import { INK_IDS } from "./layout";
import { buildTray, itemBounds, TRAY_SIZE, type TrayBuild } from "./TrayParts";

const triangles = (b: TrayBuild) => {
  const tris = (g: THREE.BufferGeometry) =>
    (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  return b.parts.reduce((n, p) => n + tris(p.geo), 0) + tris(b.coilGeo) * b.coilMatrices.length;
};
const build = (q: "low" | "mid" | "high") => buildTray(q, seeded(0x7a4));

describe("the side tray", () => {
  const high = build("high");

  it("keeps every ink id inside the tray's block of ten, clear of the pen's", () => {
    for (const q of ["low", "mid", "high"] as const) {
      for (const p of build(q).parts) {
        expect(Number.isInteger(p.ink)).toBe(true);
        expect(p.ink).toBeGreaterThanOrEqual(0);
        expect(p.ink).toBeLessThan(10);
        expect(INK_IDS.tray + p.ink).toBeLessThan(INK_IDS.pen);
      }
    }
  });

  it("puts each item with a tap box wholly inside it, so a tap anywhere on the item lands", () => {
    for (const q of ["low", "mid", "high"] as const) {
      const b = build(q);
      for (const h of b.hits) {
        const tap = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(...h.centre),
          new THREE.Vector3(...h.size),
        );
        const item = itemBounds(b, h.item);
        expect(item.isEmpty(), `${h.item} has geometry`).toBe(false);
        expect(tap.containsBox(item), `${h.item} inside its tap box (${q})`).toBe(true);
      }
    }
  });

  it("leaves the tap boxes where they were, so the taps land where they always did", () => {
    expect(high.hits).toEqual([
      { item: "leads", centre: [0.06, 0.012, 0.085], size: [0.13, 0.03, 0.14] },
      { item: "micrometer", centre: [0.07, 0.016, -0.125], size: [0.12, 0.03, 0.06] },
      { item: "sandpaper", centre: [0.065, 0.008, -0.052], size: [0.09, 0.016, 0.05] },
    ]);
  });

  it("stays inside its footprint, with its rim no higher than the footprint's top", () => {
    const foot = BENCH_FOOTPRINTS.find((f) => f.slot === "tray");
    expect(foot).toBeDefined();
    if (!foot) return;
    const whole = new THREE.Box3();
    for (const p of high.parts) {
      p.geo.computeBoundingBox();
      if (p.geo.boundingBox) whole.union(p.geo.boundingBox);
    }
    expect(whole.min.x).toBeGreaterThanOrEqual(-foot.hx - 1e-6);
    expect(whole.max.x).toBeLessThanOrEqual(foot.hx + 1e-6);
    expect(whole.min.z).toBeGreaterThanOrEqual(-foot.hz - 1e-6);
    expect(whole.max.z).toBeLessThanOrEqual(foot.hz + 1e-6);
    expect(foot.hx * 2).toBeCloseTo(TRAY_SIZE.x, 9);
    expect(foot.hz * 2).toBeCloseTo(TRAY_SIZE.z, 9);
    // The tray itself (its floor and rim) is no taller than the footprint's top.
    expect(itemBounds(high, null).max.y).toBeLessThanOrEqual(foot.top + 1e-6);
  });

  it("sits on the desk: its lowest point is at y = 0 within half a millimetre", () => {
    const tray = itemBounds(high, null);
    expect(Math.abs(tray.min.y)).toBeLessThan(0.0005);
    for (const item of ["leads", "sandpaper", "rheostat", "micrometer"] as const) {
      // Everything lies on the tray's floor, 4 mm up: nothing sinks into it by more than half a millimetre.
      expect(itemBounds(high, item).min.y).toBeGreaterThanOrEqual(0.004 - 0.0005);
    }
  });

  it("builds the same tray every time from the same seed", () => {
    const again = build("high");
    expect(again.parts.length).toBe(high.parts.length);
    high.parts.forEach((p, i) => {
      const q = again.parts[i];
      expect(q?.mat).toBe(p.mat);
      expect(Array.from(q?.geo.getAttribute("position").array ?? [])).toEqual(
        Array.from(p.geo.getAttribute("position").array),
      );
    });
  });

  it("gives every part positions, normals and uvs, with no NaN", () => {
    for (const p of high.parts) {
      for (const name of ["position", "normal", "uv"] as const) {
        const a = p.geo.getAttribute(name);
        expect(a, `${p.item}/${p.ink}/${p.mat} has ${name}`).toBeDefined();
        expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("costs no more than 1.3 times the triangles of the tray it replaced", () => {
    // Main's tray: 12,660 triangles on mid and high (4,984 on low). Contract C9 of docs/plans/asset-pass.md.
    expect(triangles(high)).toBeLessThanOrEqual(12660 * 1.3);
    expect(triangles(build("mid"))).toBeLessThanOrEqual(12660 * 1.3);
    expect(triangles(build("low"))).toBeLessThanOrEqual(4984 * 1.3);
    // And the low tier is lighter than the high one.
    expect(triangles(build("low"))).toBeLessThan(triangles(high));
  });

  it("marks the small things thin and never merges a thin part with a heavy one", () => {
    for (const p of high.parts) {
      if (p.mat === "bootRed" || p.mat === "bootBlack") expect(p.thin).toBe(true);
    }
    const keys = high.parts.map((p) => `${p.item}|${p.ink}|${p.thin}|${p.mat}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
