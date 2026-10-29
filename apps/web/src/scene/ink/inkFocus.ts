import * as THREE from "three";
import type { InkFocus } from "../look/types";

// Focus fade (docs/plans/exam-redesign.md, "The look"): parts outside the current shot fade 45%
// toward paper and their ink halves, over 0.3 s. One set per page, like the draw-on sweep
// (inkSweep.ts): the stage writes the focus with setInkFocus, the ink composer advances the fade
// each frame, and the outline effect reads one value per ink id from a 256 × 1 texture.
// High and mid tiers only; the low tier's hulls draw everything in full.

/** How far an unfocused part's colour moves toward paper. */
export const FOCUS_FADE_PAPER = 0.45;
/** An unfocused part's ink, as a fraction of full. */
export const FOCUS_FADE_INK = 0.5;
/** Seconds for a part to fade out of (or back into) focus. */
export const FOCUS_FADE_S = 0.3;

const IDS = 256;

interface FocusState {
  /** 0 = in focus, 1 = fully faded, per ink id. */
  readonly current: Float32Array;
  readonly target: Float32Array;
  readonly data: Uint8Array;
  texture: THREE.DataTexture | null;
  moving: boolean;
}

const state: FocusState = {
  current: new Float32Array(IDS),
  target: new Float32Array(IDS),
  data: new Uint8Array(IDS * 4),
  texture: null,
  moving: false,
};

/** The fade texture's uniform, shared by every outline effect on the page. */
export const inkFocusUniforms = {
  inkFocusMap: new THREE.Uniform<THREE.Texture | null>(null),
};

function texture(): THREE.DataTexture {
  if (!state.texture) {
    const t = new THREE.DataTexture(state.data, IDS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    state.texture = t;
    inkFocusUniforms.inkFocusMap.value = t;
  }
  return state.texture;
}

/** Makes sure the texture exists (the effect binds it at construction). */
export function inkFocusTexture(): THREE.DataTexture {
  return texture();
}

/**
 * Sets which ink ids stay in full ink; the rest fade back over FOCUS_FADE_S. `null` ids (or
 * an empty set) put everything in focus. Untagged meshes (id 0) never fade.
 */
export function setInkFocus(focus: InkFocus): void {
  const ids = focus.ids;
  const all = ids === null || ids.size === 0;
  for (let i = 1; i < IDS; i++) state.target[i] = all || ids.has(i) ? 0 : 1;
  state.target[0] = 0;
  state.moving = true;
}

/**
 * Moves every id's fade toward its target. `instant` (reduced motion) jumps there. Returns true
 * while anything is still moving, so a demand frameloop can keep rendering. Allocates nothing.
 */
export function advanceInkFocus(dtS: number, instant = false): boolean {
  if (!state.moving) return false;
  const tex = texture();
  const step = instant ? 1 : Math.max(0, dtS) / FOCUS_FADE_S;
  let moving = false;
  for (let i = 0; i < IDS; i++) {
    const c = state.current[i] ?? 0;
    const t = state.target[i] ?? 0;
    const next = c < t ? Math.min(t, c + step) : Math.max(t, c - step);
    state.current[i] = next;
    if (next !== t) moving = true;
    state.data[i * 4] = Math.round(next * 255);
  }
  tex.needsUpdate = true;
  state.moving = moving;
  return moving;
}

/** The fade of one id now (0 in focus, 1 faded); for tests and the stage. */
export function inkFocusOf(id: number): number {
  return state.current[Math.max(0, Math.min(IDS - 1, Math.round(id)))] ?? 0;
}
