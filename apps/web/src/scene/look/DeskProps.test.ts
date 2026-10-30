import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  BOOKLET,
  bezelGeometry,
  COVER_H,
  coneGeometry,
  ferruleGeometry,
  keyGeometry,
  PAGE_STAND,
  PENCIL_X,
  pencilBody,
  pencilRest,
  rubberGeometry,
} from "./DeskProps";

// The exam-desk props are judged on the asset checklist (docs/plans/asset-pass.md): C6 a part's
// lowest point is at the desk's surface (0 +- 0.5 mm), C4 every edge is rounded by at least 1.5 mm,
// and the booklet shows its cream page edges. These pin the numbers that fixed them.

const MM = 0.001;

/** The lowest vertex of `geo`, placed along the pencil at `x`, tilted and raised as the pencil lies. */
function lowestY(geo: THREE.BufferGeometry, x: number, rest: ReturnType<typeof pencilRest>) {
  const placed = geo.clone();
  placed.translate(x, 0, 0);
  placed.rotateZ(rest.tilt);
  placed.translate(0, rest.y, 0);
  placed.computeBoundingBox();
  const y = placed.boundingBox?.min.y ?? Number.NaN;
  placed.dispose();
  return y;
}

describe("the pencil lies on the desk", () => {
  const rest = pencilRest();
  const parts = [
    ["hexagon", pencilBody(), 0],
    ["sharpened end", coneGeometry(), PENCIL_X.cone],
    ["ferrule", ferruleGeometry(), PENCIL_X.ferrule],
    ["rubber", rubberGeometry(), PENCIL_X.rubber],
  ] as const;

  it("has no part more than 0.5 mm under the desk, built from the real geometry", () => {
    for (const [name, geo, x] of parts) {
      expect(lowestY(geo, x, rest), name).toBeGreaterThan(-0.5 * MM);
    }
  });

  it("touches the desk at its lowest point (y = 0, within 0.01 mm), so nothing floats", () => {
    const lowest = Math.min(...parts.map(([, geo, x]) => lowestY(geo, x, rest)));
    expect(Math.abs(lowest)).toBeLessThan(0.01 * MM);
  });

  it("agrees with the analytic model that places it", () => {
    expect(lowestY(pencilBody(), 0, rest)).toBeCloseTo(rest.lowest.body, 6);
    expect(lowestY(ferruleGeometry(), PENCIL_X.ferrule, rest)).toBeCloseTo(rest.lowest.ferrule, 6);
    expect(lowestY(rubberGeometry(), PENCIL_X.rubber, rest)).toBeCloseTo(rest.lowest.rubber, 6);
  });

  it("lies on its ferrule and its sharpened end, tilted under half a degree, ferrule end up", () => {
    expect(rest.tilt).toBeLessThan(0);
    expect(Math.abs(rest.tilt)).toBeLessThan((0.5 * Math.PI) / 180);
    expect(Math.abs(rest.lowest.body)).toBeLessThan(0.01 * MM);
    expect(Math.abs(rest.lowest.ferrule)).toBeLessThan(0.01 * MM);
  });
});

/** A geometry's extents in x and z over the vertices at or above `fromY`. */
function extents(geo: THREE.BufferGeometry, fromY: number) {
  const pos = geo.getAttribute("position");
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < fromY) continue;
    x0 = Math.min(x0, pos.getX(i));
    x1 = Math.max(x1, pos.getX(i));
    z0 = Math.min(z0, pos.getZ(i));
    z1 = Math.max(z1, pos.getZ(i));
  }
  return { w: x1 - x0, d: z1 - z0 };
}

describe("the calculator's keys and display frame are rounded", () => {
  for (const [name, build] of [
    ["key", keyGeometry],
    ["display frame", bezelGeometry],
  ] as const) {
    it(`draws the ${name}'s top in by at least 1.5 mm all round, and cuts its corners`, () => {
      const geo = build(false);
      geo.computeBoundingBox();
      const box = geo.boundingBox;
      const top = extents(geo, (box?.max.y ?? 0) - 1e-9);
      const foot = extents(geo, -Infinity);
      expect(foot.w - top.w).toBeGreaterThanOrEqual(2 * 1.5 * MM - 1e-9);
      expect(foot.d - top.d).toBeGreaterThanOrEqual(2 * 1.5 * MM - 1e-9);
      // Eight walls and a six-triangle cap, not a bare block's four and two.
      expect(geo.getAttribute("position").count / 3).toBe(22);
      geo.dispose();
    });

    it(`keeps the ${name} a ten-triangle block on the low tier`, () => {
      const geo = build(true);
      expect(geo.getAttribute("position").count / 3).toBe(10);
      geo.dispose();
    });
  }

  it("faces every wall outward and every cap up, so the key light finds the bevel", () => {
    const geo = keyGeometry(false);
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const up = nor.getY(i);
      if (up > 0.99) continue;
      expect(up).toBeGreaterThan(0);
      expect(nor.getX(i) * cx + nor.getZ(i) * cz).toBeGreaterThan(0);
    }
    geo.dispose();
  });
});

describe("the booklet shows its page edges", () => {
  it("is a block of pages between two thin boards, most of its thickness", () => {
    const pages = BOOKLET.h - 2 * COVER_H;
    expect(pages / BOOKLET.h).toBeGreaterThanOrEqual(0.6);
  });

  it("stands the page block out 0.6 to 1.5 mm past the boards, so the ink lines fall on the dark boards and the cream stays cream", () => {
    // The ink pass draws a line on the far side of a step of 0.3 mm of depth or more, and a face
    // turned 45 degrees from the camera shows half of a step.
    expect(PAGE_STAND).toBeGreaterThanOrEqual(0.6 * MM);
    expect(PAGE_STAND).toBeLessThanOrEqual(1.5 * MM);
  });
});
