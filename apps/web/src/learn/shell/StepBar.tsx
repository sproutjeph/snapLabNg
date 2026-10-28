import { type KeyboardEvent, useEffect, useRef } from "react";
import type { Step } from "../types";
import { MarkCross, MarkTick } from "./icons";

export type StepStatus = "todo" | "done" | "lost";

interface StepBarProps {
  steps: Step[];
  stepIndex: number;
  stepStatus: StepStatus[];
  onStepChange(index: number): void;
}

const STATUS_WORD: Record<StepStatus, string> = {
  todo: "not done yet",
  done: "done",
  lost: "lost",
};

/**
 * The bottom step bar. One numbered icon per step: dashed pencil ring = not done, solid ink ring
 * with a ✓ = done, solid red ring with a ✕ = lost, filled ink = the current step. Left/Right/Home/
 * End move to a step (and select it); only the current step is in the Tab order.
 */
export default function StepBar({ steps, stepIndex, stepStatus, onStepChange }: StepBarProps) {
  const scroller = useRef<HTMLOListElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the current step in view on phones, where the bar scrolls sideways.
  useEffect(() => {
    const box = scroller.current;
    const el = buttons.current[stepIndex];
    if (!box || !el) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left) });
  }, [stepIndex]);

  const go = (i: number) => {
    const next = Math.min(steps.length - 1, Math.max(0, i));
    onStepChange(next);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: stepIndex + 1,
      ArrowDown: stepIndex + 1,
      ArrowLeft: stepIndex - 1,
      ArrowUp: stepIndex - 1,
      Home: 0,
      End: steps.length - 1,
    };
    const target = keys[e.key];
    if (target === undefined) return;
    e.preventDefault();
    go(target);
  };

  return (
    <nav className="sh-stepbar" aria-label="Steps">
      <ol className="sh-steps" ref={scroller} onKeyDown={onKeyDown}>
        {steps.map((s, i) => {
          const status = stepStatus[i] ?? "todo";
          const current = i === stepIndex;
          return (
            <li key={s.key} className={`sh-step-item is-${status}`}>
              <button
                type="button"
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                className="sh-step"
                data-status={status}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}, ${s.title}, ${STATUS_WORD[status]}`}
                tabIndex={current ? 0 : -1}
                onClick={() => onStepChange(i)}
              >
                <span className="sh-step-icon" aria-hidden="true">
                  {i + 1}
                  {status === "done" && (
                    <span className="sh-step-mark is-done">
                      <MarkTick />
                    </span>
                  )}
                  {status === "lost" && (
                    <span className="sh-step-mark is-lost">
                      <MarkCross />
                    </span>
                  )}
                </span>
                <span className="sh-step-label" aria-hidden="true">
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
