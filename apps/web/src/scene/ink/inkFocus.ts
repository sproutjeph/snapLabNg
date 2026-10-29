import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import type { InkFocus } from "../look/types";

// Focus fade (docs/plans/exam-redesign.md, "The look"): parts outside the current shot fade 45%
// toward paper and their ink halves, over 0.3 s. One fade per canvas, kept per scene: the stage
// sets it with useInkFocus (or setInkFocus), the canvas's ink composer advances it each frame,
// and its outline effect reads one value per ink id from a 256 × 1 texture. High and mid tiers
// only; the low tier's hulls draw everything in full.

/** How far an unfocused part's colour moves toward paper. */
export const FOCUS_FADE_PAPER = 0.45;
/** An unfocused part's ink, as a fraction of full. */
export const FOCUS_FADE_INK = 0.5;
/** Seconds for a part to fade out of (or back into) focus. */
export const FOCUS_FADE_S = 0.3;

const IDS = 256;

/** One canvas's focus fade. */
export class InkFocusFade {
  /** 0 = in focus, 1 = fully faded, per ink id. */
  private readonly current = new Float32Array(IDS);
  private readonly target = new Float32Array(IDS);
  private readonly data = new Uint8Array(IDS * 4);
  readonly texture: THREE.DataTexture;
  private moving = false;

  constructor() {
    const t = new THREE.DataTexture(this.data, IDS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    t.name = "Ink.Focus";
    this.texture = t;
  }

  /**
   * Which ink ids stay in full ink; the rest fade back over FOCUS_FADE_S. `null` ids (or an
   * empty set) put everything in focus. Untagged meshes (id 0) never fade.
   */
  set(focus: InkFocus): void {
    const ids = focus.ids;
    const all = ids === null || ids.size === 0;
    for (let i = 1; i < IDS; i++) this.target[i] = all || ids.has(i) ? 0 : 1;
    this.target[0] = 0;
    this.moving = true;
  }

  /**
   * Moves every id's fade toward its target; `instant` (reduced motion) jumps there. Returns
   * true while anything still moves, so a demand frameloop can keep rendering. Allocates nothing.
   */
  advance(dtS: number, instant = false): boolean {
    if (!this.moving) return false;
    const step = instant ? 1 : Math.max(0, dtS) / FOCUS_FADE_S;
    let moving = false;
    for (let i = 0; i < IDS; i++) {
      const c = this.current[i] ?? 0;
      const t = this.target[i] ?? 0;
      const next = c < t ? Math.min(t, c + step) : Math.max(t, c - step);
      this.current[i] = next;
      if (next !== t) moving = true;
      this.data[i * 4] = Math.round(next * 255);
    }
    this.texture.needsUpdate = true;
    this.moving = moving;
    return moving;
  }

  /** The fade of one id now: 0 in focus, 1 faded. */
  of(id: number): number {
    return this.current[Math.max(0, Math.min(IDS - 1, Math.round(id)))] ?? 0;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

const fades = new WeakMap<THREE.Object3D, InkFocusFade>();

/** The focus fade of the canvas that draws `scene`; made on first use. */
export function inkFocusFor(scene: THREE.Object3D): InkFocusFade {
  let f = fades.get(scene);
  if (!f) {
    f = new InkFocusFade();
    fades.set(scene, f);
  }
  return f;
}

/** Drops a scene's fade and its texture (the ink composer calls this on unmount). */
export function releaseInkFocus(scene: THREE.Object3D): void {
  const f = fades.get(scene);
  if (!f) return;
  f.dispose();
  fades.delete(scene);
}

/** Sets the focus of the canvas that draws `scene`. */
export function setInkFocus(scene: THREE.Object3D, focus: InkFocus): void {
  inkFocusFor(scene).set(focus);
}

/** Inside a canvas: keeps its ink focus on `focus` while mounted, and everything in focus after. */
export function useInkFocus(focus: InkFocus): void {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    setInkFocus(scene, focus);
    return () => setInkFocus(scene, { ids: null });
  }, [scene, focus]);
}
