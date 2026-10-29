import * as THREE from "three";
import { readInk } from "./ink";
import fragmentShader from "./ink-id.frag.glsl?raw";
import vertexShader from "./ink-id.vert.glsl?raw";

// The ink-ID pass (docs/plans/ink-look.md): the scene drawn once more into a small target,
// writing each mesh's view-space normal and ink tag. The outline effect finds creases and part
// boundaries in it. The ID materials read `userData.ink` per object in `onBeforeRender`, so the
// apparatus needs no ink-specific materials.

/**
 * Set `userData.noInk = true` on a mesh to keep it out of the ink pass and the low-tier hulls
 * (the paper desk, the current-flow dots).
 */
export const NO_INK = "noInk";

type AnyMaterial = THREE.Material & {
  map?: THREE.Texture | null;
};

/**
 * Meshes that must not draw ink: non-meshes (lines, points, sprites), `noInk` meshes, troika
 * text, additive sparks and glows, invisible hit boxes (material hidden or opacity 0), and alpha-mapped decals that
 * do not write depth (labels lying on a part would otherwise draw their quad).
 */
export function skipsInk(object: THREE.Object3D, material: THREE.Material | undefined): boolean {
  if (!(object as THREE.Mesh).isMesh) return true;
  if (object.userData[NO_INK] === true) return true;
  if ((object as { isTroikaText?: boolean }).isTroikaText) return true;
  if (!material) return false;
  const m = material as AnyMaterial;
  // Hit targets hidden through their material (the ID materials themselves are visible).
  if (!m.visible || !m.colorWrite) return true;
  if (m.blending === THREE.AdditiveBlending) return true;
  if (m.transparent && m.opacity < 0.05) return true;
  if (m.transparent && !m.depthWrite && m.map) return true;
  return false;
}

/**
 * Per-mesh ink controls (docs/plans/exam-redesign.md, "The look"), read from `userData` on the
 * mesh or its nearest ancestor that sets them, so a part sets them once on its group:
 *   - `inkStrength` (0–1, default 1): how dark its lines are (a glass face .3, a label 0).
 *   - `inkFlat` (boolean): creases from facet normals, for chiselled or bevelled shapes.
 */
export const INK_STRENGTH = "inkStrength";
export const INK_FLAT = "inkFlat";

/** How far up the tree a control is looked for (a part's group is a few levels up). */
const CONTROL_DEPTH = 8;

function inherited(object: THREE.Object3D, key: string): unknown {
  let o: THREE.Object3D | null = object;
  for (let i = 0; o && i < CONTROL_DEPTH; i++) {
    const v = o.userData[key];
    if (v !== undefined) return v;
    o = o.parent;
  }
  return undefined;
}

/** What the ink-ID pass writes for one mesh. Untagged meshes are id 0. */
export interface InkCode {
  id: number;
  thin: boolean;
  strength: number;
  flat: boolean;
}

/** Fills `out` for `object` and returns it; allocates nothing. */
export function inkCode(object: THREE.Object3D, out: InkCode): InkCode {
  const tag = readInk(object);
  out.id = tag ? Math.max(0, Math.min(255, Math.round(tag.id))) : 0;
  out.thin = tag?.thin === true;
  const s = inherited(object, INK_STRENGTH);
  out.strength = typeof s === "number" && Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 1;
  out.flat = inherited(object, INK_FLAT) === true;
  return out;
}

type Clippable = THREE.Material & {
  clippingPlanes: THREE.Plane[] | null;
  clipIntersection: boolean;
};

type MaterialSlot = THREE.Material | THREE.Material[];

const viewPlane = new THREE.Plane();
const viewNormal = new THREE.Matrix3();

/**
 * Three caches a material's view-space clipping planes and, when the same material draws twice
 * in a row, reuses them without re-projecting. Here every object brings its own planes and the
 * camera and clip line move, so the cached array is rewritten in place per object. Once three
 * has made the array (the first clipped draw), this allocates nothing. No global
 * renderer.clippingPlanes are used in these scenes (offset 0).
 */
function writeViewPlanes(
  renderer: THREE.WebGLRenderer,
  material: THREE.Material,
  camera: THREE.Camera,
  planes: THREE.Plane[],
): void {
  const props = renderer.properties.get(material) as { clippingState?: Float32Array | null };
  const out = props.clippingState;
  if (!out || out.length < planes.length * 4 || renderer.clippingPlanes.length > 0) return;
  viewNormal.getNormalMatrix(camera.matrixWorldInverse);
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    if (!p) continue;
    viewPlane.copy(p).applyMatrix4(camera.matrixWorldInverse, viewNormal);
    out[i * 4] = viewPlane.normal.x;
    out[i * 4 + 1] = viewPlane.normal.y;
    out[i * 4 + 2] = viewPlane.normal.z;
    out[i * 4 + 3] = viewPlane.constant;
  }
}

/** The object's own (first) material while the ink pass has swapped it out. */
const SOURCE = "inkSource";

function createInkIdMaterial(name: string): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name,
    vertexShader,
    fragmentShader,
    uniforms: {
      inkId: { value: 0 },
      inkStrength: { value: 1 },
      inkThin: { value: 0 },
      inkFlat: { value: 0 },
    },
    blending: THREE.NoBlending,
    clipping: true,
  });
  const u = material.uniforms as Record<
    "inkId" | "inkStrength" | "inkThin" | "inkFlat",
    { value: number }
  >;
  const code: InkCode = { id: 0, thin: false, strength: 1, flat: false };
  material.onBeforeRender = (renderer, _scene, camera, _geometry, object) => {
    const source = object.userData[SOURCE] as Clippable | null | undefined;
    inkCode(object, code);
    u.inkId.value = code.id;
    u.inkStrength.value = code.strength;
    u.inkThin.value = code.thin ? 1 : 0;
    u.inkFlat.value = code.flat ? 1 : 0;
    // Cull like the object does, so faces the scene never shows (the underside of a part that
    // is still below its clip line) draw no ink either. A side change needs no new program.
    material.side = source?.side ?? THREE.FrontSide;
    // Follow the object's clipping planes, so a kit that is still rising draws no ink above
    // its clip line.
    const planes = source?.clippingPlanes ?? null;
    if (material.clippingPlanes !== planes) material.clippingPlanes = planes;
    material.clipIntersection = source?.clipIntersection ?? false;
    if (planes && planes.length > 0) writeViewPlanes(renderer, material, camera, planes);
    material.uniformsNeedUpdate = true;
  };
  return material;
}

const prevClear = new THREE.Color();

/**
 * The ink-ID pass. For the draw it swaps each object's material for one of four ID materials,
 * one per program three needs (plain or instanced × unclipped or clipped), so consecutive draws
 * never force a program change, and three's opaque sort groups the draws by material. Objects
 * that draw no ink get an invisible material and leave the render list. Everything is put back
 * after the draw; once the arrays have grown, it allocates nothing.
 */
export class InkIdPass {
  /** Indexed by instanced * 2 + clipped. */
  private readonly materials: readonly THREE.ShaderMaterial[];
  private readonly hidden = new THREE.MeshBasicMaterial({ visible: false });
  private readonly objects: (THREE.Object3D | null)[] = [];
  private readonly originals: (MaterialSlot | null)[] = [];
  private count = 0;
  private readonly swap: (o: THREE.Object3D) => void;

  constructor() {
    this.materials = [
      createInkIdMaterial("InkId"),
      createInkIdMaterial("InkId.Clipped"),
      createInkIdMaterial("InkId.Instanced"),
      createInkIdMaterial("InkId.InstancedClipped"),
    ];
    this.swap = (o: THREE.Object3D) => {
      const slot = (o as THREE.Mesh).material as MaterialSlot | undefined;
      if (!slot) return;
      const source = (Array.isArray(slot) ? slot[0] : slot) as Clippable | undefined;
      this.objects[this.count] = o;
      this.originals[this.count] = slot;
      this.count += 1;
      o.userData[SOURCE] = source ?? null;
      if (skipsInk(o, source)) {
        (o as THREE.Mesh).material = this.hidden;
        return;
      }
      const clipped = (source?.clippingPlanes?.length ?? 0) > 0 ? 1 : 0;
      const instanced = (o as THREE.InstancedMesh).isInstancedMesh ? 2 : 0;
      (o as THREE.Mesh).material = this.materials[instanced + clipped] ?? this.hidden;
    };
  }

  /** Draws `scene` into `target`: no background, no shadow map, cleared to zero. */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
  ): void {
    const background = scene.background;
    const shadows = renderer.shadowMap.enabled;
    const autoClear = renderer.autoClear;
    renderer.getClearColor(prevClear);
    const prevAlpha = renderer.getClearAlpha();

    this.count = 0;
    scene.traverse(this.swap);
    scene.background = null;
    renderer.shadowMap.enabled = false;
    renderer.autoClear = false;
    try {
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(target);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
    } finally {
      for (let i = 0; i < this.count; i++) {
        const o = this.objects[i] as THREE.Mesh | null;
        const original = this.originals[i];
        if (o && original) {
          o.material = original;
          o.userData[SOURCE] = null;
        }
        // Drop the references, so an unmounted part is not kept alive by a spare slot.
        this.objects[i] = null;
        this.originals[i] = null;
      }
      scene.background = background;
      renderer.shadowMap.enabled = shadows;
      renderer.autoClear = autoClear;
      renderer.setClearColor(prevClear, prevAlpha);
    }
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    this.hidden.dispose();
    this.objects.length = 0;
    this.originals.length = 0;
  }
}
