// The apparatus materials kit: seeded textures, matte materials and bevelled boxes.

export { bevelBox, bevelSegments, boxProjectUV, mergePieces, moved } from "./bevel";
export {
  acquireTexture,
  cachedTextureCount,
  disposeKitBag,
  KIT_SEEDS,
  type KitKind,
  kitLabel,
  kitTexture,
  releaseTexture,
} from "./cache";
export {
  bakeliteMaterial,
  brassSurface,
  jitter,
  paintMaterial,
  paperMaterial,
  type SurfaceOptions,
  woodMaterial,
} from "./materials";
export { fbm, hash2, seededRandom, valueNoise } from "./noise";
export {
  bakeliteTexture,
  brushedBrassTexture,
  INK_BLUE,
  type LabelOptions,
  labelTexture,
  mahoganyTexture,
  pineTexture,
  type Tier,
} from "./textures";
