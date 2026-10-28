import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import inkEdgesFrag from "./ink-edges.frag.glsl?raw";
import { InkIdPass } from "./inkPass";
import { INK_HEX } from "./palette";

/** Line width in CSS pixels, scaled by the device pixel ratio. */
export const INK_THICKNESS_PX = 2.3;
/** Relative depth jump that draws a silhouette. */
export const INK_DEPTH_THRESHOLD = 0.045;
/** Change in the view-space normal (distance between unit normals) that draws a crease. */
export const INK_CREASE_THRESHOLD = 0.35;
/** `thin` parts draw at this strength. */
export const INK_THIN_ALPHA = 0.5;
/** Ink strength of a full line. */
export const INK_OPACITY = 0.92;

/**
 * The ink outline as a postprocessing Effect (high and mid tiers). It reads the composer's
 * depth texture (EffectAttribute.DEPTH) and, in `update()`, draws its own ink-ID target at
 * `scale` × the drawing-buffer size with the ID materials of inkPass.ts. The fragment
 * shader samples both in 8 directions. Uniforms are made once; `update()` allocates nothing.
 */
export class InkEffect extends Effect {
  /** 0 → 1: how much of the ink is drawn. Written per frame by InkComposer. */
  readonly reveal: THREE.Uniform<number>;
  private readonly radius: THREE.Uniform<number>;
  private readonly scale: number;
  private readonly scene: THREE.Scene;
  private camera: THREE.Camera;
  private readonly inkTarget: THREE.WebGLRenderTarget;
  private readonly idPass: InkIdPass;

  constructor(scene: THREE.Scene, camera: THREE.Camera, scale: number) {
    const reveal = new THREE.Uniform(1);
    const radius = new THREE.Uniform(INK_THICKNESS_PX);
    const inkTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      // Linear: at 0.75× (mid) nearest texels made the normals blocky and creases speckle on
      // the leads. A blended id at a part boundary still reads as a boundary.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    inkTarget.texture.name = "Ink.ID";
    super("InkEffect", inkEdgesFrag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["inkColour", new THREE.Uniform(new THREE.Color(INK_HEX))],
        ["inkOpacity", new THREE.Uniform(INK_OPACITY)],
        ["inkReveal", reveal],
        ["inkBuffer", new THREE.Uniform(inkTarget.texture)],
        ["inkRadius", radius],
        ["depthThreshold", new THREE.Uniform(INK_DEPTH_THRESHOLD)],
        ["creaseThreshold", new THREE.Uniform(INK_CREASE_THRESHOLD)],
        ["thinAlpha", new THREE.Uniform(INK_THIN_ALPHA)],
      ]),
    });
    this.reveal = reveal;
    this.radius = radius;
    this.scale = scale;
    this.scene = scene;
    this.camera = camera;
    this.inkTarget = inkTarget;
    this.idPass = new InkIdPass();
  }

  override set mainCamera(value: THREE.Camera) {
    this.camera = value;
  }

  override update(renderer: THREE.WebGLRenderer): void {
    // One full line width, on the far side of an edge; device pixels, so lines keep their CSS width.
    this.radius.value = INK_THICKNESS_PX * renderer.getPixelRatio();
    this.idPass.render(renderer, this.scene, this.camera, this.inkTarget);
  }

  override setSize(width: number, height: number): void {
    this.inkTarget.setSize(
      Math.max(1, Math.round(width * this.scale)),
      Math.max(1, Math.round(height * this.scale)),
    );
  }

  override dispose(): void {
    super.dispose();
    this.inkTarget.dispose();
    this.idPass.dispose();
  }
}
