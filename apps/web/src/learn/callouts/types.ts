import type { RefObject } from "react";
import type { PartId, TerminalId } from "../types";

// Callouts on leader lines (docs/plans/exam-redesign.md). FROZEN for Waves 1–2; ask the lead.

export interface CalloutSpec {
  anchor: PartId | TerminalId;
  label: string;
  sub?: string;
  /** name: what a part is; do: what to do there; reading: a value on a dial or the rule. */
  kind: "name" | "do" | "reading";
}

/**
 * Rendered inside the Canvas: it projects each anchor per frame and positions DOM labels in
 * `overlay`, a div laid over the canvas (no drei Html).
 */
export interface CalloutsProps {
  callouts: readonly CalloutSpec[];
  overlay: RefObject<HTMLDivElement | null>;
  reducedMotion?: boolean;
}
