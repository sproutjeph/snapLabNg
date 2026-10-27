import type { ComponentKind } from "@snaplab/contracts";
import { BENCH_LAYOUT, BRIDGE_BASE, cmToX } from "../apparatus/meter-bridge/dimensions";

/** The bench top (the underside of the metre bridge base), in metres. */
export const BENCH_TOP_Y = -BRIDGE_BASE.height;

/** Her page lies on the bench in front of the metre bridge, top edge towards the kit. */
export const PAGE_WIDTH_M = 0.3;
const PAGE_GAP_M = 0.05;
const BRIDGE_FRONT_Z = BRIDGE_BASE.depth / 2;

export function pageLayout(pageAspect: number) {
  const height = PAGE_WIDTH_M * pageAspect;
  return {
    width: PAGE_WIDTH_M,
    height,
    centre: [0, BENCH_TOP_Y + 0.0005, BRIDGE_FRONT_Z + PAGE_GAP_M + height / 2] as const,
  };
}

/** A point on her page (0–1, top-left origin) in bench coordinates. */
export function pageToWorld(
  u: number,
  v: number,
  page: ReturnType<typeof pageLayout>,
): [number, number, number] {
  return [
    page.centre[0] + (u - 0.5) * page.width,
    page.centre[1],
    page.centre[2] + (v - 0.5) * page.height,
  ];
}

/** Where each drawn part stands on the bench: the end of its sparks' flight. */
export const KIT_ANCHORS: Partial<Record<ComponentKind, readonly [number, number, number]>> = {
  bridge_wire: [0, 0.01, 0.05],
  jockey: [cmToX(50), 0.04, 0.06],
  resistance_box: [BENCH_LAYOUT.plugBoxPos[0], 0.05, BENCH_LAYOUT.plugBoxPos[2]],
  unknown_resistor: [BENCH_LAYOUT.unknownPos[0], 0.03, BENCH_LAYOUT.unknownPos[2]],
  galvanometer: [BENCH_LAYOUT.galvanometerPos[0], 0.06, BENCH_LAYOUT.galvanometerPos[2]],
  cell: [BENCH_LAYOUT.cellPos[0], 0.09, BENCH_LAYOUT.cellPos[2]],
  key: [BENCH_LAYOUT.plugKeyPos[0], 0.03, BENCH_LAYOUT.plugKeyPos[2]],
};
