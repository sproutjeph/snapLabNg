import { Texture } from "three";
import { describe, expect, it } from "vitest";
import {
  acquireTexture,
  cachedTextureCount,
  disposeKitBag,
  KIT_SEEDS,
  releaseTexture,
} from "./cache";

describe("texture cache", () => {
  it("returns the same texture for the same key and paints it once", () => {
    let painted = 0;
    const make = () => {
      painted++;
      return new Texture();
    };
    const a = acquireTexture("test:same", make);
    const b = acquireTexture("test:same", make);
    expect(b).toBe(a);
    expect(painted).toBe(1);
    releaseTexture(a);
    releaseTexture(b);
  });

  it("gives a different texture for a different key", () => {
    const a = acquireTexture("test:a", () => new Texture());
    const b = acquireTexture("test:b", () => new Texture());
    expect(b).not.toBe(a);
    releaseTexture(a);
    releaseTexture(b);
  });

  it("keeps a texture while any holder remains and disposes it at zero", () => {
    const before = cachedTextureCount();
    let disposed = 0;
    const a = acquireTexture("test:refs", () => new Texture());
    a.addEventListener("dispose", () => disposed++);
    const b = acquireTexture("test:refs", () => new Texture());
    releaseTexture(a);
    expect(disposed).toBe(0);
    expect(cachedTextureCount()).toBe(before + 1);
    releaseTexture(b);
    expect(disposed).toBe(1);
    expect(cachedTextureCount()).toBe(before);
    // A fresh acquire paints again.
    let painted = 0;
    const c = acquireTexture("test:refs", () => {
      painted++;
      return new Texture();
    });
    expect(painted).toBe(1);
    releaseTexture(c);
  });

  it("disposeKitBag releases borrowed textures and disposes owned ones", () => {
    const borrowed = acquireTexture("test:bag", () => new Texture());
    const extra = acquireTexture("test:bag", () => new Texture());
    const owned = new Texture();
    let borrowedDisposed = 0;
    let ownedDisposed = 0;
    borrowed.addEventListener("dispose", () => borrowedDisposed++);
    owned.addEventListener("dispose", () => ownedDisposed++);
    disposeKitBag({ borrowed, list: [owned], n: 3, none: null });
    expect(ownedDisposed).toBe(1);
    expect(borrowedDisposed).toBe(0); // `extra` still holds it
    releaseTexture(extra);
    expect(borrowedDisposed).toBe(1);
  });

  it("uses one seed per kind, so each kind is painted once for the whole bench", () => {
    expect(new Set(Object.values(KIT_SEEDS)).size).toBe(4);
  });
});
