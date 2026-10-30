import { BENCH_FOOTPRINTS } from "../../apparatus/ohms-law/LeadParts";
import { OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { METER_DIAL_CENTER } from "../../apparatus/ohms-law/MeterImage";
import { SHOT_DEPTH_RATIO } from "../../scene/look/LookCamera";
import type { LookShot } from "../../scene/look/types";

// The live stage's named shots (docs/plans/wave-2-lean.md; the user's Oct 30 review): the camera
// stands where the student sits, a little to her right (STAGE_AZIMUTH_DEG), so the meters in the
// front row (apparatus/ohms-law/layout.ts, v3) face her and the bench runs across the screen.
// Each shot is a LookShot for LookCamera, worked out from the layout, so a moved part can never
// leave a shot looking at empty desk. BC101 zooms per step the same way (named shots, followed
// with k = 1 − e^(−8 dt), which LookCamera already does).

/** From +z (her side) toward +x: about square to her, a little to her right. */
export const STAGE_AZIMUTH_DEG = 12;
/** Room round the bench's footprint for nuts, plugs and leads, in metres of span. */
const BENCH_MARGIN_M = 0.04;
/**
 * The meters shot's span, in metres. Its fit is set by the shot's fixed 12 cm of height
 * (SHOT_HEIGHT_M) on a laptop, so a small span leaves both dials (0.3 m apart, 7.5 cm across) in
 * view with about a centimetre to spare: on a 1440 × 900 laptop under today's cards each dial is
 * about 175 px across, more as the chrome shrinks.
 */
const METERS_SPAN_M = 0.2;

export type StageShotName = "bench" | "meters";

function benchShot(): LookShot {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  for (const f of BENCH_FOOTPRINTS) {
    // The tray stands behind the board, out of the shot (layout.ts).
    if (f.slot === "tray") continue;
    x0 = Math.min(x0, f.cx - f.hx);
    x1 = Math.max(x1, f.cx + f.hx);
    z0 = Math.min(z0, f.cz - f.hz);
    z1 = Math.max(z1, f.cz + f.hz);
  }
  // A shot fits a patch spanM wide and spanM × SHOT_DEPTH_RATIO deep: wide enough for both.
  const spanM = Math.max(x1 - x0, (z1 - z0) / SHOT_DEPTH_RATIO) + BENCH_MARGIN_M;
  return {
    id: "bench",
    focus: [(x0 + x1) / 2, 0, (z0 + z1) / 2],
    spanM,
    azimuthDeg: STAGE_AZIMUTH_DEG,
  };
}

function metersShot(): LookShot {
  const a = OHMS_LAW_LAYOUT.ammeter.position;
  const v = OHMS_LAW_LAYOUT.voltmeter.position;
  return {
    id: "meters",
    // Between the two dials, at the dials' height and face.
    focus: [(a[0] + v[0]) / 2, METER_DIAL_CENTER.y, (a[2] + v[2]) / 2 + METER_DIAL_CENTER.z],
    spanM: METERS_SPAN_M,
    azimuthDeg: STAGE_AZIMUTH_DEG,
  };
}

export const STAGE_SHOTS: Readonly<Record<StageShotName, LookShot>> = {
  bench: benchShot(),
  meters: metersShot(),
};
