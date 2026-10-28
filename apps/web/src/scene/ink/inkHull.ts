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
// headless shot (see the ink-look report). `thin` parts get a lighter line.

/** How often new meshes (a kit that mounts late, a lead the student adds) are picked up. */
const SCAN_S = 0.5;
const HULL = "inkHull";

interface HullUniforms {
  [name: string]: THREE.IUniform;
  inkResolution: THREE.IUniform<THREE.Vector2>;
  inkWidth: THREE.IUniform<number>;
}

function hullMaterial(colour: THREE.Color, shared: HullUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "InkHull",
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

/**
 * A copy of `source`'s positions and faces plus `hullNormal`: the normals averaged over every
 * vertex at the same position, so hard edges (a box corner) push out together and leave no gap.
 * Copied rather than shared, so disposing the hull never frees the part's own GPU buffers.
 */
export function buildHullGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const position = source.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute) || position.itemSize !== 3) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", position.clone());
  if (source.index) geo.setIndex(source.index.clone());
  let normal = source.getAttribute("normal");
  if (!(normal instanceof THREE.BufferAttribute)) {
    geo.computeVertexNormals();
    normal = geo.getAttribute("normal");
  }
  if (!(normal instanceof THREE.BufferAttribute)) return null;
  const count = position.count;
  const sums = new Map<string, [number, number, number]>();
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
    keys.push(key);
    const s = sums.get(key) ?? [0, 0, 0];
    s[0] += normal.getX(i);
    s[1] += normal.getY(i);
    s[2] += normal.getZ(i);
    sums.set(key, s);
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const s = sums.get(keys[i] ?? "") ?? [0, 1, 0];
    const len = Math.hypot(s[0], s[1], s[2]);
    const k = len > 1e-5 ? 1 / len : 0;
    out[i * 3] = s[0] * k;
    out[i * 3 + 1] = s[1] * k;
    out[i * 3 + 2] = s[2] * k;
  }
  geo.deleteAttribute("normal");
  geo.setAttribute("hullNormal", new THREE.BufferAttribute(out, 3));
  geo.boundingSphere = source.boundingSphere?.clone() ?? null;
  geo.boundingBox = source.boundingBox?.clone() ?? null;
  return geo;
}

function wantsHull(mesh: THREE.Mesh): boolean {
  if (mesh.userData[HULL] || (mesh as THREE.InstancedMesh).isInstancedMesh) return false;
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
    const material = hullMaterial(new THREE.Color(INK_HEX), shared);
    const thinMaterial = hullMaterial(
      new THREE.Color(INK_HEX).lerp(new THREE.Color(PAPER_HEX), 0.5),
      shared,
    );
    const byMesh = new Map<THREE.Mesh, THREE.Mesh>();
    const bySource = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    const seen = new Set<THREE.Mesh>();
    const noRaycast = () => {};

    const onSourceDispose = (e: { target: THREE.BufferGeometry }) => {
      bySource.get(e.target)?.dispose();
      bySource.delete(e.target);
    };

    const visit = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !wantsHull(mesh)) return;
      let geo = bySource.get(mesh.geometry);
      if (!geo) {
        const built = buildHullGeometry(mesh.geometry);
        if (!built) return;
        geo = built;
        bySource.set(mesh.geometry, geo);
        mesh.geometry.addEventListener("dispose", onSourceDispose);
      }
      seen.add(mesh);
      const mat = readInk(mesh)?.thin ? thinMaterial : material;
      const hull = byMesh.get(mesh);
      if (hull && hull.parent === mesh) {
        hull.geometry = geo;
        hull.material = mat;
        return;
      }
      const next = new THREE.Mesh(geo, mat);
      next.userData[HULL] = true;
      next.raycast = noRaycast;
      mesh.add(next);
      byMesh.set(mesh, next);
    };

    return {
      shared,
      timer: 0,
      scan(root: THREE.Object3D) {
        seen.clear();
        root.traverse(visit);
        // Forget the parts that have left the scene.
        for (const [mesh, hull] of byMesh) {
          if (!seen.has(mesh)) {
            mesh.remove(hull);
            byMesh.delete(mesh);
          }
        }
      },
      detach() {
        for (const [mesh, hull] of byMesh) mesh.remove(hull);
        byMesh.clear();
      },
      dispose() {
        for (const [source, geo] of bySource) {
          source.removeEventListener("dispose", onSourceDispose);
          geo.dispose();
        }
        bySource.clear();
        material.dispose();
        thinMaterial.dispose();
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
    if (hulls.timer > 0) return;
    hulls.timer = SCAN_S;
    hulls.scan(scene);
  });
}
