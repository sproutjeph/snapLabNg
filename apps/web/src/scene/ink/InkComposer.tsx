import type { QualityTier } from "../../apparatus/meter-bridge/types";

export interface InkComposerProps {
  quality: QualityTier;
  /** 0 → 1 while the outlines draw themselves on; omitted means fully drawn. A ref, read per frame. */
  reveal?: { current: number };
}

/**
 * The post-processing stack for every canvas: the ink outline pass, with a low-tier fallback
 * (docs/plans/ink-look.md). STUB (Wave 0): renders nothing yet; the ink slice fills it in.
 * The props are frozen.
 */
export function InkComposer(_props: InkComposerProps) {
  return null;
}
