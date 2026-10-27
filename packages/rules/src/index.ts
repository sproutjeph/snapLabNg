import type { MarkSheet, Readings } from "@snaplab/contracts";
import { markMeterBridge } from "./meterBridge";
import { isL1L2Page, markMeterBridgeL1L2 } from "./meterBridgeL1L2";

export * from "./examiner";
export * from "./meterBridge";
export * from "./meterBridgeL1L2";
export * from "./precautions";
export * from "./text";

/**
 * Marks a metre bridge page in whichever form she used: the l₁/l₂ form (X = R·l₂/l₁) or the
 * reciprocal form of the golden question (l⁻¹ against R⁻¹, docs/15 §4).
 */
export function markMeterBridgePage(
  r: Readings,
  opts: { teacherXOhm: number | null; setupIssues?: MarkSheet["setup_issues"] },
): MarkSheet {
  return isL1L2Page(r) ? markMeterBridgeL1L2(r, opts) : markMeterBridge(r, opts);
}
