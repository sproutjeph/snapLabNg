import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { cachedTextureCount } from "./cache";
import { MIN_ROUGHNESS, paintRelief, RELIEF, type ReliefKind, withRelief } from "./relief";

const KINDS = Object.keys(RELIEF) as ReliefKind[];

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

describe("surface relief", () => {
  it.each(KINDS)("paints the same %s pixels for the same seed, every time", (kind) => {
    const a = paintRelief(kind);
    const b = paintRelief(kind);
    expect(a.length).toBe(RELIEF[kind].w * RELIEF[kind].h * 4);
    expect(same(a, b)).toBe(true);
  });

  it.each(KINDS)("paints different %s pixels for a different seed", (kind) => {
    const a = paintRelief(kind);
    const b = paintRelief(kind, { ...RELIEF[kind], seed: RELIEF[kind].seed + 1 });
    expect(same(a, b)).toBe(false);
  });

  it.each(KINDS)(
    "keeps %s small (≤ 512 px), its relief visible and its roughness matte",
    (kind) => {
      const spec = RELIEF[kind];
      expect(Math.max(spec.w, spec.h)).toBeLessThanOrEqual(512);
      const px = paintRelief(kind);
      let hMin = 255;
      let hMax = 0;
      let gMin = 255;
      for (let i = 0; i < px.length; i += 4) {
        hMin = Math.min(hMin, px[i] ?? 0);
        hMax = Math.max(hMax, px[i] ?? 0);
        gMin = Math.min(gMin, px[i + 1] ?? 0);
      }
      expect(hMax - hMin).toBeGreaterThan(40);
      expect(gMin / 255).toBeGreaterThanOrEqual(spec.gMin - 1 / 255);
    },
  );

  it("shares one texture per kind, keeps roughness ≥ 0.6 and lets go on dispose", () => {
    const before = cachedTextureCount();
    const a = withRelief(new MeshStandardMaterial({ roughness: 0.62 }), "brass", "high");
    const b = withRelief(new MeshStandardMaterial({ roughness: 0.9 }), "brass", "mid");
    expect(a.bumpMap).toBe(b.bumpMap);
    expect(a.roughnessMap).toBe(a.bumpMap);
    expect(a.roughness * RELIEF.brass.gMin).toBeGreaterThanOrEqual(MIN_ROUGHNESS - 1e-9);
    expect(cachedTextureCount()).toBe(before + 1);
    a.dispose();
    a.dispose();
    expect(cachedTextureCount()).toBe(before + 1);
    b.dispose();
    expect(cachedTextureCount()).toBe(before);
  });

  it("adds nothing on the low tier", () => {
    const m = withRelief(new MeshStandardMaterial(), "wood", "low");
    expect(m.bumpMap).toBeNull();
    expect(m.roughnessMap).toBeNull();
  });
});
