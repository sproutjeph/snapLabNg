import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { bevelBox, boxProjectUV, mergePieces } from "./bevel";
import { bakeliteMaterial, brassSurface, jitter, paperMaterial, woodMaterial } from "./materials";
import { fbm, hash2, seededRandom, valueNoise } from "./noise";

describe("materials kit", () => {
  it("noise is seeded: the same seed gives the same grain, another seed differs", () => {
    expect(valueNoise(3, 1.37, 4.2)).toBe(valueNoise(3, 1.37, 4.2));
    expect(fbm(3, 0.5, 0.25)).toBe(fbm(3, 0.5, 0.25));
    expect(fbm(3, 0.5, 0.25)).not.toBe(fbm(4, 0.5, 0.25));
    for (let i = 0; i < 50; i++) {
      const h = hash2(9, i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      const f = fbm(9, i * 0.31, i * 0.17);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("seededRandom repeats its sequence", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("colour jitter stays small and repeats for one seed", () => {
    const c1 = jitter("#6b3a22", seededRandom(1));
    const c2 = jitter("#6b3a22", seededRandom(1));
    expect(c1.getHex()).toBe(c2.getHex());
    const base = { h: 0, s: 0, l: 0 };
    const out = { h: 0, s: 0, l: 0 };
    c1.getHSL(out);
    jitter("#6b3a22", () => 0.5).getHSL(base);
    expect(Math.abs(out.l - base.l)).toBeLessThan(0.03);
  });

  it("materials are matte: roughness is at least 0.6 even when asked for less", () => {
    const mats = [
      woodMaterial(1),
      bakeliteMaterial(2),
      brassSurface(3, { roughness: 0.1 }),
      paperMaterial(4),
    ];
    for (const m of mats) {
      expect(m.roughness).toBeGreaterThanOrEqual(0.6);
      m.dispose();
    }
    const wood = woodMaterial(1);
    expect(wood.roughness).toBeGreaterThanOrEqual(0.85);
    wood.dispose();
  });

  it("a bevelled box keeps its outer size and rounds the corners", () => {
    const geo = bevelBox(0.12, 0.118, 0.05, 0.004, 3);
    geo.computeBoundingBox();
    const size = geo.boundingBox?.getSize(new Vector3()) ?? new Vector3();
    expect(size.x).toBeCloseTo(0.12, 6);
    expect(size.y).toBeCloseTo(0.118, 6);
    expect(size.z).toBeCloseTo(0.05, 6);
    // A plain box has 24 vertices; the bevel adds many.
    expect(geo.getAttribute("position").count).toBeGreaterThan(24);
    geo.dispose();
  });

  it("box-projected uv keeps one texture scale on every face", () => {
    const geo = bevelBox(0.3, 0.1, 0.1, 0.003, 2);
    boxProjectUV(geo, [0.3, 0.15]);
    const pos = geo.getAttribute("position");
    const uv = geo.getAttribute("uv");
    let maxU = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < pos.count; i++) maxU = Math.max(maxU, uv.getX(i));
    // The 0.3 m long face spans 0.3 / 0.3 = 1 tile (x runs -0.15 .. 0.15 → u ±0.5, less the
    // 3 mm bevel on the flat faces).
    expect(maxU).toBeCloseTo(0.5, 1);
    expect(maxU).toBeLessThanOrEqual(0.5);
    geo.dispose();
  });

  it("mergePieces gives one geometry with the pieces' vertices", () => {
    const a = bevelBox(0.01, 0.01, 0.01, 0.001, 1);
    const b = bevelBox(0.02, 0.01, 0.01, 0.001, 1);
    const total = a.getAttribute("position").count + b.getAttribute("position").count;
    const merged = mergePieces([a, b]);
    expect(merged.getAttribute("position").count).toBeGreaterThan(0);
    expect(merged.getAttribute("uv")).toBeTruthy();
    expect(total).toBeGreaterThan(0);
    merged.dispose();
  });
});
