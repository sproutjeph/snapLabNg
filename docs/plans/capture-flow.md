# Capture flow: snap, find the page, confirm corners

## Goal
The student points the phone at the exercise-book page (or picks a photo), the app finds the page's four corners, the student confirms or drags them like CamScanner, and the app hands over a compressed photo plus a homography. This is stage ① of docs/04 §2 up to, but not including, the GPU flatten and ink mask.

## Out of scope
- The rectify and ink-mask fragment shader, and the NAME/SCHOOL header blur, which needs the flattened page. The lead builds those next, from this plan's `CaptureResult`.
- Uploading, `/api/snap`, the SSE pipeline, golden replay.
- Any library for vision (OpenCV.js is banned) or any new dependency. Plain canvas 2D and TypeScript only.
- Zustand stores and app-wide routing. The flow is one component with an `onDone` callback.

## Files
All under `apps/web/src/capture/`. Owner: Gemini, branch `gemini/capture-flow`, worktree `~/Desktop/SnapLabNG-gemini`.
- `types.ts`: the contract below, exactly.
- `homography.ts`: `solveHomography(src: Quad, dst: Quad): Mat3` (4-point DLT with Gaussian elimination and partial pivoting) and `applyHomography(h: Mat3, p: Point): Point`. Pure, no DOM.
- `cornerFinder.ts`: `findPageCorners(img: ImageData): Quad | null`. Works on a copy at most 256 px on its long side. It thresholds "paper" pixels (bright and low saturation, threshold picked from the image's own histogram, not a constant), keeps the largest connected blob (iterative flood fill, no recursion), and takes the four extreme points of the blob (min and max of x + y and x − y). Returns corners in the input image's pixels, ordered TL, TR, BR, BL. Returns `null` when the blob covers less than 15% of the frame. Pure, no DOM beyond the `ImageData` shape.
- `sharpness.ts`: `sharpness(img: ImageData): number`, the variance of a 3×3 Laplacian on grey, used for the "hold steady" hint. Pure.
- `compress.ts`: `compressPhoto(source: CanvasImageSource, w: number, h: number): Promise<{ blob: Blob; width: number; height: number }>`: long side scaled to at most 1280 px, JPEG quality 0.8, via `OffscreenCanvas` when present, else a `<canvas>`.
- `CameraView.tsx`: `getUserMedia({ video: { facingMode: "environment" } })` preview with a page-shaped guide and the hold-steady hint (sharpness sampled about 4 times a second from a small canvas, not every frame). It always shows a file-picker fallback, and goes straight to it if the camera is denied or missing. Stops all tracks on unmount.
- `CornerEditor.tsx`: shows the still photo with the four corners from `findPageCorners` (or a 10% inset rectangle when it returns `null`) as large draggable handles (pointer events, 44 px touch targets) joined by a quad outline, and a loupe while dragging. "Use this page" confirms.
- `CaptureFlow.tsx`: default export. Camera or file → still → corner editor → `onDone(result: CaptureResult)`. A "Retake" button goes back.
- `CapturePreview.tsx`: a page for the `?capture=1` switch. It renders `CaptureFlow` and, on done, shows the compressed photo, its byte size and the four corners as text. Not part of the product.
- `*.test.ts` beside each pure module (tests below).
- `apps/web/src/App.tsx`: add only a lazy `?capture=1` switch to `CapturePreview`, next to the existing `?kit=` switch.

## Contracts (exact; the lead's rectify shader consumes `CaptureResult`)
```ts
// apps/web/src/capture/types.ts
export type Point = { x: number; y: number };
/** Corners in source-photo pixels, in this order: top-left, top-right, bottom-right, bottom-left (as the page is read). */
export type Quad = [Point, Point, Point, Point];
/** Row-major 3×3, h[8] normalised to 1. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export interface CaptureResult {
  photo: Blob;          // JPEG, long side ≤ 1280 px
  width: number;        // of `photo`, in px
  height: number;
  corners: Quad;        // in `photo` pixels (scaled from the original if it was downsized)
  /** Maps unit page coordinates (u, v) ∈ [0,1]², (0,0) = top-left of the page, to `photo` pixels. */
  homography: Mat3;
  source: "camera" | "file";
}
```

## Tests (`bun run --filter @snaplab/web test`)
- `solveHomography` with src = the unit square and dst = an axis-aligned rectangle (0,0)–(800,1100) gives a pure scale: `h ≈ [800,0,0, 0,1100,0, 0,0,1]` within 1e-9.
- For a known projective quad, for example dst = (100,80), (700,120), (760,980), (60,1000), `applyHomography(h, src[i])` returns each `dst[i]` within 1e-6, and the centre (0.5, 0.5) maps to the intersection of the quad's diagonals within 1e-6.
- A degenerate quad (three collinear points) throws a clear error and does not return NaN.
- `findPageCorners` on a synthetic 640×480 `ImageData`: a dark-brown background with a white rotated quad whose corners are known. Each found corner is within 3 px of the truth, scaled back to 640×480, in TL, TR, BR, BL order. The same holds with mild noise (seeded, deterministic) and with blue ruled lines drawn on the white quad.
- `findPageCorners` returns `null` for an all-dark image and for a small white square covering 5% of the frame.
- `sharpness` is higher for a checkerboard than for the same checkerboard box-blurred.
- `compress.ts` is not unit-tested (it needs a real canvas). Check it through the preview.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree. The initial chunk stays ≤ 350 KB gzip, and the capture code is lazy.
- With `apps/web` on port 5174: `bun run shot -- --route "/?capture=1" --base http://localhost:5174` shows the file-picker fallback, since headless has no camera, with no console errors. In a manual pass with a real photo, the corner editor shows found corners on a notebook photo, handles drag, and the preview shows a JPEG of 150–300 KB and the four corners.
- No per-frame allocation in `CameraView`. Camera tracks stop on unmount.
- PR `gemini/capture-flow` → `main`, body as in AGENTS.md, no AI attribution.

## Implementer
Gemini, in its worktree, in parallel with the lead's contracts and engine work. The lead reviews and merges, then writes the rectify and ink-mask shader against `CaptureResult`.

## Risks
- The paper threshold fails under yellow lamp light → choose the threshold from the image's own brightness histogram (Otsu on lightness), and keep the saturation limit loose. The handles are the fallback anyway.
- iOS Safari camera quirks (`playsInline`, `muted` and a user gesture are required) → set them, and fall back to the file picker on any error.
- Huge photos (12 MP) are slow to decode → draw them once into a canvas at most 1600 px wide before corner finding and compression. Keep the corners in that canvas's pixels.
