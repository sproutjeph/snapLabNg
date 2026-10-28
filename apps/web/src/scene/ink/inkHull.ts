import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { INK_THICKNESS_PX } from "./InkEffect";
import { readInk } from "./ink";
import fragmentShader from "./ink-hull.frag.glsl?raw";
import vertexShader from "./ink-hull.vert.glsl?raw";
import { skipsInk } from "./inkPass";
import { INK_HEX, PAPER_HEX } from "./palette";

// Low-tier ink (docs/plans/ink-look.md): no post pass. Every inkable mesh gets a child "hull"
// with its shape, facing backwards and pushed out by a constant pixel width, so a pen line shows
// round the part. Chosen over depth-only edges at 0.5× because it held the frame rate in the
// headless shot (see quality/tier.ts). `thin` parts get a lighter line. Instanced parts get an
// instanced hull that shares their instanceMatrix and count. Geometry rewritten in place (a lead
// that follows the jockey) is followed every frame through its attribute versions.

/** How often new meshes (a kit that mounts late, a lead the student adds) are picked up. */
const SCAN_S = 0.5;
const HULL = "inkHull";

interface HullUniforms {
  [name: string]: THREE.IUniform;
  inkResolution: THREE.IUniform<THREE.Vector2>;
  inkWidth: THREE.IUniform<number>;
}

function hullMaterial(name: string, colour: THREE.Color, shared: HullUniforms) {
  return new THREE.ShaderMaterial({
    name,
    vertexShader,
    fragmentShader,
    uniforms: {
      inkColour: { value: colour },
      inkResolution: shared.inkResolution,
      inkWidth: shared.inkWidth,
    },
    side: THREE.BackSide,
    clipping: true,
  });
}

/** A hull's own copy of a part's shape, plus what it needs to follow in-place edits. */
export interface HullShape {
  source: THREE.BufferGeometry;
  geometry: THREE.BufferGeometry;
  /** Vertex → welded group (vertices at the same position). */
  weld: Uint32Array;
  /** Normal sums per welded group (x, y, z). */
  sums: Float32Array;
  positionVersion: number;
  normalVersion: number;
}

function normalVersionOf(geometry: THREE.BufferGeometry): number {
  const n = geometry.getAttribute("normal");
  return n instanceof THREE.BufferAttribute ? n.version : 0;
}

function sourceNormal(shape: HullShape): THREE.BufferAttribute | null {
  const n = shape.source.getAttribute("normal") ?? shape.geometry.getAttribute("normal");
  return n instanceof THREE.BufferAttribute ? n : null;
}

/**
 * Writes `hullNormal`: the normals averaged over every welded group, so hard edges (a box
 * corner) push out together and leave no gap. Allocates nothing.
 */
function writeHullNormals(shape: HullShape): void {
  const normal = sourceNormal(shape);
  const out = shape.geometry.getAttribute("hullNormal") as THREE.BufferAttribute;
  if (!normal) return;
  const { weld, sums } = shape;
  const dst = out.array as Float32Array;
  sums.fill(0);
  for (let i = 0; i < weld.length; i++) {
    const g = (weld[i] ?? 0) * 3;
    sums[g] = (sums[g] ?? 0) + normal.getX(i);
    sums[g + 1] = (sums[g + 1] ?? 0) + normal.getY(i);
    sums[g + 2] = (sums[g + 2] ?? 0) + normal.getZ(i);
  }
  for (let i = 0; i < weld.length; i++) {
    const g = (weld[i] ?? 0) * 3;
    const x = sums[g] ?? 0;
    const y = sums[g + 1] ?? 0;
    const z = sums[g + 2] ?? 1;
    const len = Math.hypot(x, y, z);
    const k = len > 1e-5 ? 1 / len : 0;
    dst[i * 3] = x * k;
    dst[i * 3 + 1] = y * k;
    dst[i * 3 + 2] = z * k;
  }
  out.needsUpdate = true;
}

/**
 * A copy of `source`'s positions and faces plus `hullNormal`. Copied rather than shared, so
 * disposing the hull never frees the part's own GPU buffers.
 */
export function buildHullShape(source: THREE.BufferGeometry): HullShape | null {
  const position = source.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute) || position.itemSize !== 3) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position.clone());
  if (source.index) geometry.setIndex(source.index.clone());
  if (!(source.getAttribute("normal") instanceof THREE.BufferAttribute)) {
    geometry.computeVertexNormals();
  }
  const count = position.count;
  const weld = new Uint32Array(count);
  const groups = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
    let g = groups.get(key);
    if (g === undefined) {
      g = groups.size;
      groups.set(key, g);
    }
    weld[i] = g;
  }
  geometry.setAttribute("hullNormal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const shape: HullShape = {
    source,
    geometry,
    weld,
    sums: new Float32Array(groups.size * 3),
    positionVersion: position.version,
    normalVersion: normalVersionOf(source),
  };
  writeHullNormals(shape);
  geometry.computeBoundingSphere();
  return shape;
}

/**
 * Follows a part whose positions or normals were rewritten in place (same vertex count): copies
 * the positions and rewrites the welded normals. Returns false if the shape must be rebuilt.
 * Allocates nothing.
 */
export function refreshHullShape(shape: HullShape): boolean {
  const position = shape.source.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return false;
  const normalVersion = normalVersionOf(shape.source);
  if (position.version === shape.positionVersion && normalVersion === shape.normalVersion) {
    return true;
  }
  const own = shape.geometry.getAttribute("position") as THREE.BufferAttribute;
  if (position.count !== own.count || position.array.length !== own.array.length) return false;
  (own.array as Float32Array).set(position.array as Float32Array);
  own.needsUpdate = true;
  if (!(shape.source.getAttribute("normal") instanceof THREE.BufferAttribute)) {
    shape.geometry.computeVertexNormals();
  }
  writeHullNormals(shape);
  shape.geometry.computeBoundingSphere();
  shape.positionVersion = position.version;
  shape.normalVersion = normalVersion;
  return true;
}

function wantsHull(mesh: THREE.Mesh): boolean {
  if (mesh.userData[HULL]) return false;
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (skipsInk(mesh, m)) return false;
  // The hull is opaque and draws first, so through glass (or any see-through part) its back
  // faces would show as a filled shape.
  if (m?.transparent) return false;
  return true;
}

/** Adds and keeps ink hulls on every inkable mesh of the scene while `enabled`. */
export function useInkHulls(enabled: boolean): void {
  const scene = useThree((s) => s.scene);
  const hulls = useMemo(() => {
    const shared: HullUniforms = {
      inkResolution: { value: new THREE.Vector2(1, 1) },
      inkWidth: { value: INK_THICKNESS_PX },
    };
    const ink = new THREE.Color(INK_HEX);
    const thinInk = new THREE.Color(INK_HEX).lerp(new THREE.Color(PAPER_HEX), 0.5);
    // One material per program (plain or instanced, full or thin), so draws never switch.
    const materials = {
      plain: hullMaterial("InkHull", ink, shared),
      plainThin: hullMaterial("InkHull.Thin", thinInk, shared),
      instanced: hullMaterial("InkHull.Instanced", ink, shared),
      instancedThin: hullMaterial("InkHull.InstancedThin", thinInk, shared),
    };
    const byMesh = new Map<THREE.Mesh, THREE.Mesh>();
    const shapes = new Map<THREE.BufferGeometry, HullShape>();
    const seen = new Set<THREE.Mesh>();
    const noRaycast = () => {};

    const onSourceDispose = (e: { target: THREE.BufferGeometry }) => {
      shapes.get(e.target)?.geometry.dispose();
      shapes.delete(e.target);
    };

    const shapeFor = (source: THREE.BufferGeometry): HullShape | null => {
      let shape = shapes.get(source);
      if (shape && !refreshHullShape(shape)) {
        shape.geometry.dispose();
        shapes.delete(source);
        shape = undefined;
      }
      if (!shape) {
        const built = buildHullShape(source);
        if (!built) return null;
        shape = built;
        shapes.set(source, shape);
        source.addEventListener("dispose", onSourceDispose);
      }
      return shape;
    };

    const materialFor = (mesh: THREE.Mesh, instanced: boolean) => {
      const thin = readInk(mesh)?.thin === true;
      if (instanced) return thin ? materials.instancedThin : materials.instanced;
      return thin ? materials.plainThin : materials.plain;
    };

    const visit = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !wantsHull(mesh)) return;
      const shape = shapeFor(mesh.geometry);
      if (!shape) return;
      seen.add(mesh);
      const source = mesh as THREE.InstancedMesh;
      const instanced = source.isInstancedMesh === true;
      const hull = byMesh.get(mesh);
      const hullInstanced = (hull as THREE.InstancedMesh | undefined)?.isInstancedMesh === true;
      if (hull && hull.parent === mesh && hullInstanced === instanced) {
        hull.material = materialFor(mesh, instanced);
        return;
      }
      let next: THREE.Mesh;
      if (instanced) {
        const inst = new THREE.InstancedMesh(shape.geometry, materialFor(mesh, true), source.count);
        inst.instanceMatrix = source.instanceMatrix;
        // The part's instances move; the hull's own bounding sphere would go stale.
        inst.frustumCulled = false;
        next = inst;
      } else {
        next = new THREE.Mesh(shape.geometry, materialFor(mesh, false));
      }
      next.userData[HULL] = true;
      next.raycast = noRaycast;
      mesh.add(next);
      byMesh.set(mesh, next);
    };

    // Per frame, allocation-free: follow in-place edits, geometry swaps and instance counts.
    const syncShape = (shape: HullShape) => {
      if (!refreshHullShape(shape)) shape.positionVersion = -1;
    };
    const syncHull = (hull: THREE.Mesh, mesh: THREE.Mesh) => {
      if (hull.parent !== mesh) return;
      const shape = shapes.get(mesh.geometry);
      if (!shape || shape.positionVersion === -1) {
        const fresh = shapeFor(mesh.geometry);
        if (fresh) hull.geometry = fresh.geometry;
      } else if (hull.geometry !== shape.geometry) {
        hull.geometry = shape.geometry;
      }
      const source = mesh as THREE.InstancedMesh;
      if (source.isInstancedMesh) {
        const inst = hull as THREE.InstancedMesh;
        inst.count = source.count;
        if (inst.instanceMatrix !== source.instanceMatrix)
          inst.instanceMatrix = source.instanceMatrix;
      }
    };
    const prune = (hull: THREE.Mesh, mesh: THREE.Mesh) => {
      if (!seen.has(mesh)) {
        // Never dispose an instanced hull: it shares the part's instanceMatrix buffer.
        mesh.remove(hull);
        byMesh.delete(mesh);
      }
    };

    return {
      shared,
      timer: 0,
      sync() {
        shapes.forEach(syncShape);
        byMesh.forEach(syncHull);
      },
      scan(root: THREE.Object3D) {
        seen.clear();
        root.traverse(visit);
        byMesh.forEach(prune);
      },
      detach() {
        byMesh.forEach((hull, mesh) => {
          mesh.remove(hull);
        });
        byMesh.clear();
      },
      dispose() {
        shapes.forEach((shape, source) => {
          source.removeEventListener("dispose", onSourceDispose);
          shape.geometry.dispose();
        });
        shapes.clear();
        for (const m of Object.values(materials)) m.dispose();
      },
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    hulls.timer = 0;
    return () => hulls.detach();
  }, [enabled, hulls]);

  useEffect(() => () => hulls.dispose(), [hulls]);

  useFrame((frame, delta) => {
    if (!enabled) return;
    frame.gl.getDrawingBufferSize(hulls.shared.inkResolution.value);
    hulls.shared.inkWidth.value = INK_THICKNESS_PX * frame.gl.getPixelRatio();
    hulls.timer -= delta;
    if (hulls.timer <= 0) {
      hulls.timer = SCAN_S;
      hulls.scan(scene);
    }
    hulls.sync();
  });
}
