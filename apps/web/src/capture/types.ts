export type Point = { x: number; y: number };
/** Corners in source-photo pixels, in this order: top-left, top-right, bottom-right, bottom-left (as the page is read). */
export type Quad = [Point, Point, Point, Point];
/** Row-major 3×3, h[8] normalised to 1. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export interface CaptureResult {
  photo: Blob; // JPEG, long side ≤ 1280 px
  width: number; // of `photo`, in px
  height: number;
  corners: Quad; // in `photo` pixels (scaled from the original if it was downsized)
  /** Maps unit page coordinates (u, v) ∈ [0,1]², (0,0) = top-left of the page, to `photo` pixels. */
  homography: Mat3;
  source: "camera" | "file";
}
