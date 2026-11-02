import type { QuestionRead } from "@snaplab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyQuestionEvent, EMPTY_SNAP, experimentName, ResultPanel } from "./SnapQuestionPage";

const ohms: QuestionRead = {
  experiment: "ohms_law_vi",
  confidence: "high",
  source_as_printed: "WASSCE (SC) 2018, Physics Paper 3, Question 3B",
  title_as_printed: null,
  apparatus: [{ kind: "ammeter", text_as_printed: "an ammeter" }],
  instructions: [{ label: "1", text: "Connect the circuit as shown in the diagram." }],
  diagram: {
    present: true,
    photo: 1,
    parts: [
      { kind: "ammeter", label_as_printed: "A", box: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.3 } },
    ],
  },
};

const noop = () => {};

function render(question: QuestionRead | null, error: string | null): string {
  return renderToStaticMarkup(
    createElement(ResultPanel, {
      question,
      error,
      onBuild: noop,
      onUseAppQuestion: noop,
      onSnapAgain: noop,
    }),
  );
}

describe("the snap result", () => {
  it("an Ohm's law read offers Build the bench with its source", () => {
    const html = render(ohms, null);
    expect(html).toContain('data-testid="snapq-result-ohms"');
    expect(html).toContain("Ohm&#x27;s law (V–I)");
    expect(html).toContain("WASSCE (SC) 2018");
    // The parts live once, as highlight chips by the diagram; not repeated here.
    expect(html).not.toContain("Parts found in your diagram");
    expect(html).toContain('data-testid="snapq-build"');
    expect(html).toContain("Build the bench");
  });

  it("another practical says only Ohm's law is ready, with a way on", () => {
    const html = render({ ...ohms, experiment: "meter_bridge" }, null);
    expect(html).toContain('data-testid="snapq-result-other"');
    expect(html).toContain("This looks like metre bridge. Only Ohm&#x27;s law is ready.");
    expect(html).toContain("Use the app&#x27;s question");
    expect(html).toContain("Snap again");
    expect(experimentName("meter_bridge")).toBe("metre bridge");
  });

  it("an error shows its message with Snap again and the app's question", () => {
    const html = render(null, "We could not read that question.");
    expect(html).toContain('data-testid="snapq-result-error"');
    expect(html).toContain("We could not read that question.");
    expect(html).toContain("Snap again");
    expect(html).toContain("Use the app&#x27;s question");
  });
});

describe("applyQuestionEvent", () => {
  it("folds a mocked stream into question, outlines, timings and done", () => {
    let s = applyQuestionEvent(EMPTY_SNAP, { type: "question", question: ohms });
    expect(s.question?.experiment).toBe("ohms_law_vi");
    s = applyQuestionEvent(s, {
      type: "part_outline",
      part: 0,
      box: { x0: 0.2, y0: 0.2, x1: 0.4, y1: 0.4 },
      score: 0.9,
    });
    expect(s.outlines.get(0)).toEqual({ x0: 0.2, y0: 0.2, x1: 0.4, y1: 0.4 });
    s = applyQuestionEvent(s, {
      type: "timing",
      id: "spark",
      lane: "spark",
      model: "muse-spark-1.3",
      label: "Read the question",
      start_ms: 0,
      end_ms: 900,
      status: "ok",
      request: null,
      response: null,
      note: null,
    });
    expect(s.timings).toHaveLength(1);
    s = applyQuestionEvent(s, { type: "done", total_ms: 1000 });
    expect(s.done).toBe(true);
  });

  it("records an error event's message", () => {
    const s = applyQuestionEvent(EMPTY_SNAP, {
      type: "error",
      stage: "read",
      message: "Too blurry to read.",
      fallback: "app_question",
    });
    expect(s.error).toBe("Too blurry to read.");
    expect(s.question).toBeNull();
  });
});
