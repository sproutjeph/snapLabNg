// The apparatus materials kit: seeded textures, matte materials and bevelled boxes.

export { helixTube, latheOf, offsetUV, projectUVPerTriangle, scaleUV } from "./benchGeometry";
export {
  BOX_NUTS,
  boxCoilLabels,
  boxStripPlaces,
  boxStripText,
  CELL_SPRING,
  CELLS_NUTS,
  cellSpringSteps,
  cellSpringTriangles,
  KEY_NUTS,
  OHM,
  type Vec3,
} from "./benchSpec";
export {
  BENCH_SEEDS,
  BENCH_TILE_M,
  type BenchKind,
  benchCellSteel,
  benchCellWrapper,
  benchTag,
  benchTexture,
  brassBoldTexture,
  CELL_BAND,
  CELL_STEEL_SEED,
  CELL_WRAPPER_SEED,
  CELL_WRAPPER_TEXT,
  cellSteelTexture,
  cellWrapperTexture,
  eboniteTexture,
  mahoganyBoldTexture,
  pineBoldTexture,
  type TagOptions,
  tagTexture,
  tileFbm,
  tileNoise,
} from "./benchTextures";
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
