import type { MarkSheet, RuleCode } from "@snaplab/contracts";
import { ohmsLawStepDone } from "./lessons/ohms-law/checks";
import type { StepStatus } from "./shell/LessonShell";
import type { BenchState, Lesson, LessonMode } from "./types";

/** Which step of the V–I lesson each scheme item belongs to, for the ✕ on the step bar. */
export const RULE_STEP: Partial<Record<RuleCode, string>> = {
  "PHYS-1DP": "measure-xy",
  "PHYS-TABLE": "repeat",
  "PHYS-2DP": "repeat",
  "PHYS-TREND": "repeat",
  "GRAPH-AXES": "plot",
  "GRAPH-SCALE": "plot",
  "GRAPH-POINTS": "plot",
  "GRAPH-LINE": "plot",
  "GRAPH-SLOPE": "slope",
  "PHYS-ACCURACY": "slope",
  PRECAUTIONS: "precautions",
  "PHYS-LAW": "law",
  "PHYS-CALC": "length",
};

/** Plain words for the V–I scheme items, for the student. */
export const RULE_LABEL: Partial<Record<RuleCode, string>> = {
  "PHYS-1DP": "Length XY to 1 d.p.",
  "PHYS-TABLE": "Table",
  "PHYS-2DP": "Meter readings to 2 d.p.",
  "PHYS-TREND": "Trend of the readings",
  "GRAPH-AXES": "Graph axes",
  "GRAPH-SCALE": "Graph scale",
  "GRAPH-POINTS": "Plotted points",
  "GRAPH-LINE": "Line of best fit",
  "GRAPH-SLOPE": "Slope",
  "PHYS-ACCURACY": "Accuracy",
  PRECAUTIONS: "Precautions",
  "PHYS-LAW": "The law",
  "PHYS-CALC": "Calculation",
};

/**
 * One status per step: ✕ ("lost") where the marked sheet lost a mark on that step, ✓ ("done")
 * where she did the step, otherwise "todo". The sheet comes only from packages/rules.
 */
export function stepStatuses(
  lesson: Lesson,
  state: BenchState,
  sheet: MarkSheet | null,
  mode: LessonMode,
  leadCount: number,
): StepStatus[] {
  const lost = new Set<string>();
  for (const item of sheet?.items ?? []) {
    const step = RULE_STEP[item.rule];
    if (step && item.outcome === "lost") lost.add(step);
  }
  return lesson.steps.map((step) => {
    if (lost.has(step.key)) return "lost";
    return ohmsLawStepDone(step.key, state, mode, leadCount) ? "done" : "todo";
  });
}

/** 15.5 → "15½". */
export function halves(n: number): string {
  const whole = Math.floor(n);
  return n - whole >= 0.5 ? `${whole === 0 ? "" : whole}½` : `${whole}`;
}
