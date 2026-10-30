import { paramsFromSeed } from "@snaplab/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { plugPositions } from "../meter-bridge/dimensions";
import { OHMS_LAW_LAYOUT } from "../ohms-law/layout";
import { helixTube, offsetUV, projectUVPerTriangle, scaleUV } from "./benchGeometry";
import {
  BOX_NUTS,
  boxCoilLabels,
  boxStripPlaces,
  boxStripText,
  CELL_SPRING,
  CELLS_NUTS,
  cellSpringSteps,
  cellSpringTriangles,
  KEY_NUTS,
  OHM,
} from "./benchSpec";
import {
  BENCH_SEEDS,
  BENCH_TILE_M,
  CELL_BAND,
  CELL_STEEL_SEED,
  CELL_WRAPPER_SEED,
  CELL_WRAPPER_TEXT,
  tileFbm,
  tileNoise,
} from "./benchTextures";
import { KIT_SEEDS } from "./cache";

// The nuts' feet in the world on main before the asset pass: the layout position of each part
// plus where its nut stood (the terminal dump of ?kit=ohms-law&dump=1 less TerminalNut's 23.7 mm),
// each moved with its part to layout v3 and then to layout v4 (layout.ts, Oct 30, the beauty
// pass's bench), so a nut's place on its part is as it was.
const BASELINE_FEET: Record<string, readonly [number, number, number]> = {
  "E+": [0.3318, 0.046, 0.115],
  "E-": [0.4682, 0.046, 0.115],
  K1: [0.161, 0.024, 0.115],
  K2: [0.099, 0.024, 0.115],
  R1: [-0.2, 0.066, 0.115],
  R2: [-0.46, 0.066, 0.115],
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

describe("the cell holder's spring and wrapper", () => {
  it("winds the springs with 8-sided wire or better on every tier, and builds what it counts", () => {
    expect(CELL_SPRING.sides).toBeGreaterThanOrEqual(8);
    for (const tier of ["low", "mid", "high"] as const) {
      const geo = helixTube(
        0.0105,
        CELL_SPRING.turns[tier],
        CELL_SPRING.coilR,
        CELL_SPRING.wireR,
        CELL_SPRING.perTurn[tier],
        CELL_SPRING.sides,
      );
      const steps = cellSpringSteps(tier);
      // A tube is two triangles for every step along it and every side round it.
      expect((geo.index?.count ?? 0) / 3).toBe(steps * CELL_SPRING.sides * 2);
      // The holder carries three of them.
      expect(cellSpringTriangles(tier)).toBe(3 * ((geo.index?.count ?? 0) / 3));
      geo.dispose();
    }
    // The lower tiers take fewer steps, never more.
    expect(cellSpringTriangles("low")).toBeLessThanOrEqual(cellSpringTriangles("mid"));
    expect(cellSpringTriangles("mid")).toBeLessThanOrEqual(cellSpringTriangles("high"));
  });

  it("keeps the coil inside its radius and its length, wire thickness apart", () => {
    const len = 0.0105;
    const geo = helixTube(len, 3.2, 0.0072, 0.0014, 14, 8);
    geo.computeBoundingBox();
    const box = geo.boundingBox ?? new THREE.Box3();
    expect(box.min.x).toBeGreaterThanOrEqual(-0.0014 - 1e-9);
    expect(box.max.x).toBeLessThanOrEqual(len + 0.0014 + 1e-9);
    for (const v of [box.min.y, box.max.y, box.min.z, box.max.z]) {
      expect(Math.abs(v)).toBeLessThanOrEqual(0.0072 + 0.0014 + 1e-9);
    }
    geo.dispose();
  });

  it("prints on a cell only its voltage rating, in a band that leaves the black body showing", () => {
    expect(CELL_WRAPPER_TEXT).toBe("1.5 V");
    const [from, to] = CELL_BAND;
    expect(from).toBeGreaterThan(0.2);
    expect(to).toBeLessThan(0.8);
    expect(to - from).toBeGreaterThan(0.3);
    expect(to - from).toBeLessThan(0.6);
  });

  it("gives the pine, the wrapper and the steel seeds of their own, and a tile for the pine", () => {
    const all = [
      ...Object.values(BENCH_SEEDS),
      ...Object.values(KIT_SEEDS),
      CELL_WRAPPER_SEED,
      CELL_STEEL_SEED,
    ];
    expect(new Set(all).size).toBe(all.length);
    expect(BENCH_SEEDS.pine).toBeDefined();
    const [tu, tv] = BENCH_TILE_M.pine;
    expect(tu).toBeGreaterThan(tv);
  });
});
