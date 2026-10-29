import { useEffect, useReducer } from "react";
import type { Director } from "../script/types";
import type { StepStatus } from "../shell/StepBar";
import type { Step } from "../types";
import { handleOf, stageIndexOf, stagesOf } from "./stages";

/** What the step strip needs from the director (the shell's own prop names). */
export interface StageNav {
  /** The lesson step (= script stage) the director is on. */
  stepIndex: number;
  /** One per step: done once the director is past it (everything done at the end); all "todo" in Exam. */
  stepStatus: StepStatus[];
  /** Watch: seeks the start of that stage. Practise and Exam: does nothing (she goes in order). */
  onStepChange(index: number): void;
  /** Practise: the cards after the current one are locked. Watch and Exam: none. */
  lockedFrom: number | undefined;
  /** Practise and Exam: the strip is display only. */
  readOnlyTabs: boolean;
}

/**
 * The strip's props from the director, read now: the lesson's steps and the script's stages are
 * the same question stages (one per `Step.key`), so a step's stage is found by its key. A
 * director without a script (any other Director) reads as the first step with nothing done.
 */
export function stageNavOf(director: Director, steps: ReadonlyArray<Pick<Step, "key">>): StageNav {
  const s = director.state;
  const handle = handleOf(director);
  const stages = handle ? stagesOf(handle.script) : [];
  const at = stageIndexOf(stages, s.beat);
  const stage = stages[at];
  const byKey = stage ? steps.findIndex((st) => st.key === stage.key) : -1;
  const stepIndex = byKey >= 0 ? byKey : Math.min(at, Math.max(steps.length - 1, 0));
  const exam = s.mode === "exam";
  return {
    stepIndex,
    stepStatus: steps.map(
      (_, i): StepStatus => (!exam && (s.finished || i < stepIndex) ? "done" : "todo"),
    ),
    lockedFrom: s.mode === "practice" ? stepIndex + 1 : undefined,
    readOnlyTabs: s.mode !== "watch",
    onStepChange(index) {
      if (director.state.mode !== "watch") return;
      const key = steps[index]?.key;
      const target = stages.find((st) => st.key === key);
      if (target) director.seek(target.first);
    },
  };
}

/** `stageNavOf`, kept current: it re-renders when the director changes beat, mode or state. */
export function useStageNav(director: Director, steps: ReadonlyArray<Pick<Step, "key">>): StageNav {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => director.subscribe(bump), [director]);
  return stageNavOf(director, steps);
}
