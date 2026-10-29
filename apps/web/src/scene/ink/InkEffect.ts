import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import inkEdgesFrag from "./ink-edges.frag.glsl?raw";
import inkSweepGlsl from "./ink-sweep.glsl?raw";
import { FOCUS_FADE_INK, FOCUS_FADE_PAPER, inkFocusFor } from "./inkFocus";
import { InkIdPass } from "./inkPass";
import { inkSweepUniforms } from "./inkSweep";
import { INK_HEX, PAPER_HEX } from "./palette";

// Numbers from Backcountry 101's ink pass (docs/plans/exam-redesign-brief.md, research report 2).

/**
 * Line width in CSS pixels, scaled by the device pixel ratio so it looks the same at DPR 1, 2
 * and 3. 3 px, bolder than Backcountry 101's 2.1, at the user's golden-frame review (Oct 30).
 */
export const INK_THICKNESS_PX = 3;
/**
 * `thin` parts (plugs, needles) draw their outline at this strength: a shade lighter. At 3 px,
 * 0.6 read as a grey halo round the plugs (round-4 review), so it is nearly full ink now.
 */
export const INK_THIN_ALPHA = 0.9;
/** Relative depth jump that draws a silhouette (perspective camera). */
export const INK_DEPTH_THRESHOLD = 0.045;
/** Depth jump in metres that draws a silhouette (orthographic camera). */
export const INK_DEPTH_THRESHOLD_M = 0.006;
/** Change in the view-space normal (distance between unit normals) that draws a crease. */
export const INK_CREASE_THRESHOLD = 0.35;
/** Creases (folds within one part) draw at this fraction of a silhouette. */
export const INK_CREASE_WEIGHT = 0.4;
/** Ink strength of a full line. */
export const INK_OPACITY = 0.92;
/** The grade on inked parts; paper is never graded. */
export const INK_SATURATION = 1.1;

/**
 * The ink outline as a postprocessing Effect (high and mid tiers). It reads the composer's
 * depth texture (EffectAttribute.DEPTH) and, in `update()`, draws its own ink-ID target at
 * `scale` × the drawing-buffer size with the ID materials of inkPass.ts. The fragment
 * shader samples both in 8 directions. While `reveal` < 1 the lines show only where the
 * draw-on sweep (ink-sweep.glsl) has passed, found from each pixel's world position. The
 * focus fade (inkFocus.ts) is read per ink id from the scene's own 256 × 1 texture.
 * Uniforms are made once; `update()` allocates nothing.
 */
export class InkEffect extends Effect {
  /** 0 → 1: how much of the ink is drawn. Written per frame by InkComposer. */
  readonly reveal: THREE.Uniform<number>;
  private readonly radius: THREE.Uniform<number>;
  private readonly projInverse: THREE.Uniform<THREE.Matrix4>;
  private readonly cameraWorld: THREE.Uniform<THREE.Matrix4>;
  private readonly scale: number;
  private readonly scene: THREE.Scene;
  private camera: THREE.Camera;
  private readonly inkTarget: THREE.WebGLRenderTarget;
  private readonly idPass: InkIdPass;

  constructor(scene: THREE.Scene, camera: THREE.Camera, scale: number) {
    const reveal = new THREE.Uniform(1);
    const radius = new THREE.Uniform(INK_THICKNESS_PX);
    // For the draw-on sweep: a pixel's world position from its depth.
    const projInverse = new THREE.Uniform(new THREE.Matrix4());
    const cameraWorld = new THREE.Uniform(new THREE.Matrix4());
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
    super("InkEffect", `${inkSweepGlsl}\n${inkEdgesFrag}`, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["inkColour", new THREE.Uniform(new THREE.Color(INK_HEX))],
        ["inkPaper", new THREE.Uniform(new THREE.Color(PAPER_HEX))],
        ["inkOpacity", new THREE.Uniform(INK_OPACITY)],
        ["inkReveal", reveal],
        ["inkBuffer", new THREE.Uniform(inkTarget.texture)],
        ["inkFocusMap", new THREE.Uniform(inkFocusFor(scene).texture)],
        ["inkRadius", radius],
        ["thinAlpha", new THREE.Uniform(INK_THIN_ALPHA)],
        ["depthThreshold", new THREE.Uniform(INK_DEPTH_THRESHOLD)],
        ["depthThresholdM", new THREE.Uniform(INK_DEPTH_THRESHOLD_M)],
        ["creaseThreshold", new THREE.Uniform(INK_CREASE_THRESHOLD)],
        ["creaseWeight", new THREE.Uniform(INK_CREASE_WEIGHT)],
        ["inkSaturation", new THREE.Uniform(INK_SATURATION)],
        ["focusPaper", new THREE.Uniform(FOCUS_FADE_PAPER)],
        ["focusInk", new THREE.Uniform(FOCUS_FADE_INK)],
        ["inkProjInverse", projInverse],
        ["inkCameraWorld", cameraWorld],
        ["inkSweepOrigin", inkSweepUniforms.inkSweepOrigin],
        ["inkSweepReach", inkSweepUniforms.inkSweepReach],
      ]),
    });
    this.reveal = reveal;
    this.radius = radius;
    this.projInverse = projInverse;
    this.cameraWorld = cameraWorld;
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
    // The scene pass has just rendered, so the camera's matrices are this frame's.
    this.projInverse.value.copy(this.camera.projectionMatrixInverse);
    this.cameraWorld.value.copy(this.camera.matrixWorld);
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
