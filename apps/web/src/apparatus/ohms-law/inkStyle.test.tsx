import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { Group, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { InkGroup, inkTag } from "../../scene/ink/ink";
import { inkCode } from "../../scene/ink/inkPass";
import { INK_SOFT, SoftInk } from "./inkStyle";

type Props = { userData?: unknown; id?: number; thin?: boolean; children?: unknown };

describe("soft ink on the fine parts", () => {
  it("draws every soft part at .55–.65", () => {
    for (const [name, s] of Object.entries(INK_SOFT)) {
      expect(s.inkStrength, name).toBeGreaterThanOrEqual(0.55);
      expect(s.inkStrength, name).toBeLessThanOrEqual(0.65);
    }
  });

  it("wraps its meshes in a thin InkGroup under a group carrying the strength", () => {
    const el = SoftInk({ soft: INK_SOFT.wire, id: 63, children: null }) as ReactElement<Props>;
    expect(el.type).toBe("group");
    expect(el.props.userData).toEqual({ inkStrength: 0.55 });
    const inner = el.props.children as ReactElement<Props>;
    expect(inner.type).toBe(InkGroup);
    expect(inner.props.id).toBe(63);
    expect(inner.props.thin).toBe(true);
  });

  it("reaches the ink pass: a mesh under it reads thin at its strength", () => {
    const outer = new Group();
    outer.userData = { ...INK_SOFT.label };
    const inner = new Group();
    const mesh = new Mesh();
    outer.add(inner);
    inner.add(mesh);
    inkTag(inner, { id: 24, thin: true });
    const code = inkCode(mesh, { id: 0, thin: false, strength: 1, flat: false });
    expect(code).toEqual({ id: 24, thin: true, strength: 0.6, flat: false });
  });

  // The named parts: the bridge wire and its rule, the meters' dial and mirror, the paper tags.
  it.each([
    ["WireBoard.tsx", ["INK_SOFT.wire", "INK_SOFT.rule"]],
    ["Meter.tsx", ["INK_SOFT.dial", "INK_SOFT.mirror"]],
    ["Key.tsx", ["INK_SOFT.label"]],
    ["CellHolder.tsx", ["INK_SOFT.label"]],
  ] as const)("%s draws its fine parts soft and thin", (file, softs) => {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    for (const s of softs) expect(src).toContain(`<SoftInk soft={${s}}`);
  });
});
