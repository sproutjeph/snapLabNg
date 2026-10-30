import type { Covered, LookShot } from "../../scene/look/types";

// How the page's previews frame the V–I bench (docs/plans/page-layout.md): the shots for the look
// camera (?shell=1&canvas=1), the width the perspective camera fits (?director=1) and how far the
// lesson page's poses back off (?learn=ohms-law). They come from where the bench really stands, so
// a phone's narrow window shows all of it, not most.

/** One part's footprint on the desk (x to the right, z toward the student) and its height, in metres. */
export interface PartBox {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/**
 * Where the bench's parts stand: the world bounding box of each part's meshes under
 * OHMS_LAW_LAYOUT, measured in the browser on Oct 29 (three's scene, `Box3` by hand). The desk
 * props (answer booklet, calculator, pencil) are left out: losing a corner of those matters less
 * than shrinking the bench.
 */
export const BENCH_PARTS: readonly PartBox[] = [
  { name: "resistance box", minX: -0.59, maxX: -0.27, minZ: 0.05, maxZ: 0.15, height: 0.136 },
  { name: "ammeter", minX: -0.225, maxX: -0.095, minZ: 0.075, maxZ: 0.175, height: 0.118 },
  { name: "plug key", minX: 0.139, maxX: 0.261, minZ: 0.09, maxZ: 0.194, height: 0.094 },
  { name: "dry cells", minX: 0.342, maxX: 0.538, minZ: 0.05, maxZ: 0.11, height: 0.116 },
  { name: "wire board", minX: -0.55, maxX: 0.55, minZ: -0.19, maxZ: -0.07, height: 0.104 },
  { name: "voltmeter", minX: 0.075, maxX: 0.205, minZ: -0.305, maxZ: -0.205, height: 0.118 },
  { name: "tray", minX: 0.25, maxX: 0.527, minZ: -0.57, maxZ: -0.23, height: 0.09 },
];

/** The footprint that holds every part. */
export const BENCH_BOUNDS = {
  minX: Math.min(...BENCH_PARTS.map((p) => p.minX)),
  maxX: Math.max(...BENCH_PARTS.map((p) => p.maxX)),
  minZ: Math.min(...BENCH_PARTS.map((p) => p.minZ)),
  maxZ: Math.max(...BENCH_PARTS.map((p) => p.maxZ)),
};

/** The middle of the footprint: x, then z (the perspective camera looks here). */
export const BENCH_CENTRE: readonly [number, number] = [
  (BENCH_BOUNDS.minX + BENCH_BOUNDS.maxX) / 2,
  (BENCH_BOUNDS.minZ + BENCH_BOUNDS.maxZ) / 2,
];

/**
 * The shot for every window. The look camera turns the view itself (steeper, bench up the screen)
 * when the free window is taller than wide, so one shot serves a laptop and a phone. A shot fits
 * a box `spanM` wide and 0.6 of that deep, so this one is centred on the footprint and made wide
 * enough for its depth (0.76 m / 0.6 = 1.27, rounded up). The look preview's own numbers
 * (scene/look/LookPreview.tsx: focus [0.06, 0, -0.02], 1.3 m, and 0.9 m for a tall window) were
 * written before the tray moved to the back: they put the bench off to one side, left the tray
 * and board running off the edge of a phone, and crowded a small window's right side.
 */
export const BENCH_SHOT: LookShot = { id: "bench", focus: [-0.02, 0, -0.19], spanM: 1.3 };

/**
 * The half width of bench, in metres, that the perspective camera (?director=1) fits into the
 * free window, looking at BENCH_CENTRE: the footprint's 0.57 from its middle, 6% more for the
 * parts nearest the camera, and a margin. (0.62, looking 2 cm to one side, ran the resistance box
 * off the left of a phone.)
 */
export const FIT_HALF_WIDTH_M = 0.7;

/**
 * The lesson page's poses at this distance or more look at the whole bench (its bench, wire and
 * connect poses are 1.5 to 1.6 m away); the nearer ones are close-ups of the meters and the
 * resistance box (0.95 and 0.8 m).
 */
export const BENCH_POSE_MIN_M = 1.4;

/**
 * The farthest the lesson page's orbit lets the camera stand from its target (OrbitControls'
 * maxDistance), in metres. A pose never backs off past it: the controls would pull the camera in.
 */
export const MAX_POSE_DISTANCE_M = 4.2;

/**
 * How many times a lesson pose's distance the perspective camera (LearnPage's PoseRig) backs off,
 * so the pose still frames what it was set for in the part of the window the cards leave free.
 *
 * The poses' own distances are for a canvas as wide as tall. A tall canvas backs off by height
 * over width, and a canvas with a guide beside it by 0.9 of the width over the free width. That
 * is all a wide laptop needs, and all a close-up of a meter or the resistance box ever gets. A
 * pose that looks at the whole bench is held to more: the free window must show FIT_HALF_WIDTH_M
 * either side of the pose's target. Height over width alone showed 0.58 m on a phone, 0.12 m
 * short, and ran the resistance box and the cells off both edges of it (and the box off the left
 * of a 1024 x 768 laptop).
 *
 * @param distanceM the pose's own distance from its target, in metres
 * @param fovDeg the camera's vertical field of view
 * @param width the canvas's width, in CSS px
 * @param height the canvas's height, in CSS px
 * @param covered what the cards cover of the canvas, in CSS px (`left + right` is the guide's side)
 */
export function poseFitFactor(
  distanceM: number,
  fovDeg: number,
  width: number,
  height: number,
  covered: Covered,
): number {
  const h = Math.max(height, 1);
  const free = Math.max(width - covered.left - covered.right, 1);
  const fitTall = width < h ? h / Math.max(width, 1) : 1;
  const fitPanels = (0.9 * width) / free;
  // Half the width, in metres per metre of distance, that the free window shows (the full frustum
  // is `width` wide, the view offset slides it, so the free part is `free` of it).
  const halfTan = Math.max(Math.tan((fovDeg * Math.PI) / 360) * (free / h), 1e-3);
  const fitBench =
    distanceM >= BENCH_POSE_MIN_M ? FIT_HALF_WIDTH_M / (halfTan * Math.max(distanceM, 1e-3)) : 1;
  const fit = Math.max(1, fitTall, fitPanels, fitBench);
  return Math.max(1, Math.min(fit, MAX_POSE_DISTANCE_M / Math.max(distanceM, 1e-3)));
}
