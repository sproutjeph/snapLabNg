import { paramsFromSeed } from "@snaplab/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { plugPositions } from "../meter-bridge/dimensions";
import { OHMS_LAW_LAYOUT } from "../ohms-law/layout";
import { offsetUV, projectUVPerTriangle, scaleUV } from "./benchGeometry";
import {
  BOX_NUTS,
  boxCoilLabels,
  boxStripPlaces,
  boxStripText,
  CELLS_NUTS,
  KEY_NUTS,
  OHM,
} from "./benchSpec";
import { BENCH_SEEDS, tileFbm, tileNoise } from "./benchTextures";
import { KIT_SEEDS } from "./cache";

// The nuts' feet in the world on main before the asset pass: the layout position of each part
// plus where its nut stood (the terminal dump of ?kit=ohms-law&dump=1 less TerminalNut's 23.7 mm).
const BASELINE_FEET: Record<string, readonly [number, number, number]> = {
  "E+": [0.3718, 0.046, 0.08],
  "E-": [0.5082, 0.046, 0.08],
  K1: [0.231, 0.024, 0.12],
  K2: [0.169, 0.024, 0.12],
  R1: [-0.3, 0.066, 0.094],
  R2: [-0.56, 0.066, 0.094],
};

const feet = (
  slot: "cells" | "key" | "box",
  local: Readonly<Record<string, readonly [number, number, number]>>,
) =>
  Object.entries(local).map(([id, at]) => {
    const [px, py, pz] = OHMS_LAW_LAYOUT[slot].position;
    return [id, [px + at[0], py + at[1], pz + at[2]] as const] as const;
  });

describe("the resistance box's printing", () => {
  it("lists the coil values in plug order, as the maker printed them", () => {
    const coils = paramsFromSeed(1).boxCoilsOhm;
    expect(boxCoilLabels(coils)).toEqual(["1", "2", "2", "5", "10", "20", "20", "50"]);
    expect(boxStripText(coils)).toBe(`1 2 2 5 10 20 20 50 ${OHM}`);
  });

  it("prints nothing but the coil values and the ohm sign (no total)", () => {
    const text = boxStripText([1, 2, 2, 5, 10, 20, 20, 50]);
    expect(text.replace(/[\d\s]/g, "")).toBe(OHM);
    expect(text).not.toContain("110");
  });

  it("has one plug slot per coil", () => {
    const coils = paramsFromSeed(1).boxCoilsOhm;
    const xs = plugPositions(coils.length, 0.3, 0.056);
    expect(xs).toHaveLength(coils.length);
    expect(boxCoilLabels(coils)).toHaveLength(xs.length);
    // Slots stay well clear of the end nuts (0.13 m out) and of each other.
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(xs[i] ?? 0)).toBeLessThan(BOX_NUTS.R1[0] - 0.03);
      if (i > 0) expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThan(0.025);
    }
  });

  it("spaces the front strip's values evenly about its middle, with a place for the ohm sign", () => {
    const places = boxStripPlaces(8, 0.0225);
    expect(places).toHaveLength(9);
    expect((places[0] ?? 0) + (places[8] ?? 0)).toBeCloseTo(0, 9);
    expect((places[1] ?? 0) - (places[0] ?? 0)).toBeCloseTo(0.0225, 9);
  });
});

describe("the bench parts' terminals", () => {
  it("keep every nut where it stood, within 2 mm (C8: terminal drift)", () => {
    const all = [...feet("cells", CELLS_NUTS), ...feet("key", KEY_NUTS), ...feet("box", BOX_NUTS)];
    expect(all).toHaveLength(Object.keys(BASELINE_FEET).length);
    for (const [id, at] of all) {
      const was = BASELINE_FEET[id];
      expect(was, id).toBeDefined();
      if (!was) continue;
      for (let i = 0; i < 3; i++) {
        expect(Math.abs((at[i] ?? 0) - (was[i] ?? 0)), `${id} axis ${i}`).toBeLessThanOrEqual(
          0.002,
        );
      }
    }
  });
});

describe("the bold textures' noise", () => {
  it("is seeded, and each bold kind has a seed of its own", () => {
    expect(tileFbm(31, 0.3, 0.7, 3, 3, 9)).toBe(tileFbm(31, 0.3, 0.7, 3, 3, 9));
    expect(tileFbm(31, 0.3, 0.7, 3)).not.toBe(tileFbm(32, 0.3, 0.7, 3));
    const all = [...Object.values(BENCH_SEEDS), ...Object.values(KIT_SEEDS)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("tiles: one tile further on is the same value, so a texture has no seam", () => {
    for (let i = 0; i < 20; i++) {
      const u = (i * 0.137) % 1;
      const v = (i * 0.291) % 1;
      expect(tileNoise(5, u * 4, v * 6, 4, 6)).toBeCloseTo(tileNoise(5, u * 4 + 4, v * 6, 4, 6), 9);
      expect(tileNoise(5, u * 4, v * 6, 4, 6)).toBeCloseTo(tileNoise(5, u * 4, v * 6 + 6, 4, 6), 9);
      expect(tileFbm(9, u, v, 3, 3, 9)).toBeCloseTo(tileFbm(9, u + 1, v, 3, 3, 9), 9);
      expect(tileFbm(9, u, v, 3, 3, 9)).toBeCloseTo(tileFbm(9, u, v + 1, 3, 3, 9), 9);
      const f = tileFbm(9, u, v, 3, 3, 9);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe("the bench geometry helpers", () => {
  it("scales and moves a geometry's uv in place", () => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const before = geo.getAttribute("uv").getX(1);
    scaleUV(geo, 3, 2);
    expect(geo.getAttribute("uv").getX(1)).toBeCloseTo(before * 3, 9);
    offsetUV(geo, 0.25, 0.5);
    expect(geo.getAttribute("uv").getX(1)).toBeCloseTo(before * 3 + 0.25, 9);
    geo.dispose();
  });

  it("gives every triangle its own flat uv, with no pole where a lathe pinches", () => {
    const lathe = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.01, 0.005), new THREE.Vector2(0, 0.01)],
      12,
    );
    const tris = lathe.index ? lathe.index.count / 3 : lathe.getAttribute("position").count / 3;
    const flat = projectUVPerTriangle(lathe, 0.02);
    expect(flat.index).toBeNull();
    expect(flat.getAttribute("position").count).toBe(tris * 3);
    const uv = flat.getAttribute("uv");
    expect(uv.count).toBe(tris * 3);
    for (let i = 0; i < uv.count; i++) {
      expect(Number.isFinite(uv.getX(i))).toBe(true);
      expect(Number.isFinite(uv.getY(i))).toBe(true);
    }
    flat.dispose();
  });
});
