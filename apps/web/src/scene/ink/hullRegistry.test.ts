import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildHullShape, createHullRegistry, refreshHullShape } from "./hullRegistry";

function part() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const group = new THREE.Group();
  group.add(mesh);
  return { mesh, group };
}

describe("ink hull registry", () => {
  it("frees the shape of a part that unmounts, without rebuilding it in the frames between scans", () => {
    const scene = new THREE.Scene();
    const { mesh, group } = part();
    scene.add(group);
    const hulls = createHullRegistry(2.3);
    hulls.scan(scene);
    expect(hulls.stats()).toEqual({ hulls: 1, shapes: 1 });

    // R3F unmount: the part's root is detached and its geometry disposed. The mesh keeps its
    // own parent (the detached group).
    scene.remove(group);
    mesh.geometry.dispose();
    expect(hulls.stats().shapes).toBe(0);
    hulls.sync();
    hulls.sync();
    expect(hulls.stats().shapes).toBe(0);

    hulls.scan(scene);
    expect(hulls.stats()).toEqual({ hulls: 0, shapes: 0 });
    hulls.dispose();
  });

  it("frees shapes whose geometry no mesh uses any more at the next scan", () => {
    const scene = new THREE.Scene();
    const { mesh, group } = part();
    scene.add(group);
    const hulls = createHullRegistry(2.3);
    hulls.scan(scene);
    const old = mesh.geometry;
    mesh.geometry = new THREE.BoxGeometry(2, 1, 1);
    hulls.scan(scene);
    expect(hulls.stats()).toEqual({ hulls: 1, shapes: 1 });
    // The old geometry's listener is gone: disposing it now touches nothing.
    old.dispose();
    expect(hulls.stats()).toEqual({ hulls: 1, shapes: 1 });
    hulls.dispose();
  });

  it("follows positions rewritten in place", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const shape = buildHullShape(geo);
    if (!shape) throw new Error("no shape");
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    pos.setX(0, 5);
    pos.needsUpdate = true;
    expect(refreshHullShape(shape)).toBe(true);
    expect((shape.geometry.getAttribute("position") as THREE.BufferAttribute).getX(0)).toBe(5);
  });
});
