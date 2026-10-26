# Flatten, ink mask and header blur

*Written alongside the code on Oct 26 (the step was small and lead-owned); recorded here so the next session has it.*

## Goal
Finish stage ① of docs/04 §2 after the corners are confirmed. Flatten the photographed page on the GPU through the capture homography, extract the ink for the "ink lifts off the page" reveal, and hide the NAME/SCHOOL header on the copy that gets uploaded.

## Out of scope
Using the textures in the 3D scene (the reveal), uploading, quality tiers.

## Files (`apps/web/src/rectify/`)
- `rectify.ts`: `rectifyPage(gl, photo, w, h, homography)` → `{ page, ink, dispose }`. Two passes: a flatten pass to a 1024×1448 page, then an ink pass to a 724×1024 mask (ink in alpha). `toMatrix3` hands the row-major `Mat3` to GLSL.
- `ink.ts`: `inkWeight` (TypeScript) and `INK_FRAGMENT` (GLSL) share the same constants. Darkness is measured against the local paper brightness (the brightest of 16 ring samples), so shadows cancel. Faint ruled lines fall below the threshold, and red strokes (the margin) are dropped.
- `headerBlur.ts`: `headerQuad` (the top 12% of the page in photo pixels) and `blurHeader`, which pixelates that band on the upload copy. It fails closed if a canvas is unavailable.
- `RectifyPreview.tsx`: shows the upload copy, the flattened page and the ink mask under `?capture=1`.

## Contracts
`RectifiedPage.page` and `.ink` are WebGLRenderTargets holding raw sRGB values, top of the page at the top. A consumer tags them `SRGBColorSpace`.

## Tests
`rectify.test.ts`:
- `toMatrix3` maps like `applyHomography`.
- The header band starts at the page's top corners.
- `inkWeight` keeps biro and pencil, and drops paper, ruled lines, the red margin and shadow.

## Done-criteria
- Checks are green.
- A headless end-to-end run on a synthetic rotated page (ruled lines, red margin, shadow) gives an upright page and a clean ink mask.
- Fresh-context review: ship.

## Implementer
Lead (shaders).

## Risks
- Real biro on cheap paper may sit near the threshold. Tune the `INK_DARK_*` constants on the real dataset at the Day-1 spike.
- 12% may not cover a tall header. Check it on the golden pages.
