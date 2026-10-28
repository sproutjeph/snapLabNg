import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { inkTag, nextInkId, readInk } from "./ink";

describe("ink tags", () => {
  it("keeps a nested group's thin tag when the outer group tags afterwards", () => {
    const outer = new THREE.Group();
    const body = new THREE.Mesh();
    const needleGroup = new THREE.Group();
    const needle = new THREE.Mesh();
    outer.add(body, needleGroup);
    needleGroup.add(needle);
    // Child-first, as React runs layout effects.
    inkTag(needleGroup, { id: 31, thin: true });
    inkTag(outer, { id: 30 });
    expect(readInk(body)).toEqual({ id: 30 });
    expect(readInk(needle)).toEqual({ id: 31, thin: true });
    // Re-tagging the outer group again changes nothing below the inner root.
    inkTag(outer, { id: 30 });
    expect(readInk(needle)).toEqual({ id: 31, thin: true });
  });

  it("hands out automatic ids only in 200–255, clear of the fixed tables", () => {
    for (let i = 0; i < 300; i++) {
      const id = nextInkId();
      expect(id).toBeGreaterThanOrEqual(200);
      expect(id).toBeLessThanOrEqual(255);
    }
  });
});
