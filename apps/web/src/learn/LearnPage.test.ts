import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  autoPlays,
  initialRun,
  nextRun,
  paperFirst,
  practicalFrom,
  ResultsLayer,
  type Run,
  urlForRun,
  watchGraphMove,
  watchGraphOut,
} from "./LearnPage";
import { emptyOhmsLawRecord, setCell } from "./readings/record";
import { handIn } from "./results/handIn";
import { createOhmsLawBench } from "./wiring/bench";

// The practical page's flow (docs/plans/integration.md, I1): the paper first, a mode from it, the
// results after hand-in, and the two ways on from the results. No textbook source: page flow.

const q = (s: string) => new URLSearchParams(s);

describe("the practical page's flow", () => {
  it("with no mode the page opens on the paper", () => {
    expect(paperFirst(q("practical=ohms-law"))).toBe(true);
    expect(initialRun(q("practical=ohms-law&seed=7"), 7).practical).toBeNull();
    // A mode the page does not know is no mode: still the paper.
    expect(initialRun(q("practical=ohms-law&mode=nonsense"), 7).practical).toBeNull();
  });

  it("a paper choice sets the mode and the URL", () => {
    const paper = initialRun(q("practical=ohms-law&seed=7"), 7);
    for (const mode of ["watch", "practice", "exam"] as const) {
      const run = nextRun(paper, { kind: "choose", mode });
      expect(run).toMatchObject({ practical: mode, seed: 7, afterPaper: true });
      expect(run.n).toBeGreaterThan(paper.n);
      expect(urlForRun("http://localhost:5173/?practical=ohms-law&seed=7#x", mode, 7)).toBe(
        `/?practical=ohms-law&seed=7&mode=${mode}#x`,
      );
    }
    // A later action replaces the mode and the seed rather than adding second ones, so a reload
    // after "Try again on a new bench" stays on the new bench.
    expect(urlForRun("http://h/?practical=ohms-law&mode=watch&seed=7", "exam", 99)).toBe(
      "/?practical=ohms-law&mode=exam&seed=99",
    );
  });

  it("?mode= skips the paper", () => {
    for (const mode of ["watch", "practice", "exam"] as const) {
      const search = q(`practical=ohms-law&mode=${mode}`);
      expect(paperFirst(search)).toBe(false);
      expect(initialRun(search, 1).practical).toBe(mode);
    }
    expect(initialRun(q("practical=ohms-law&mode=practise"), 1).practical).toBe("practice");
    // The older ?learn= route has no paper: Practise.
    expect(initialRun(q("learn=ohms-law"), 1).practical).toBe(practicalFrom(q("learn=ohms-law")));
    expect(paperFirst(q("learn=ohms-law"))).toBe(false);
  });

  it("new bench changes the seed, watch again keeps it", () => {
    const practice: Run = { practical: "practice", seed: 7, n: 3, afterPaper: true };
    const exam: Run = { ...practice, practical: "exam" };
    const watch: Run = { ...practice, practical: "watch" };

    const again = nextRun(practice, { kind: "watchAgain" });
    expect(again).toMatchObject({ practical: "watch", seed: 7, afterPaper: false });
    expect(again.n).toBe(4);

    expect(nextRun(practice, { kind: "newBench", seed: 99 })).toMatchObject({
      practical: "practice",
      seed: 99,
      afterPaper: false,
    });
    // Exam stays Exam; from Watch's demonstration sheet a new bench is Practise.
    expect(nextRun(exam, { kind: "newBench", seed: 99 }).practical).toBe("exam");
    expect(nextRun(watch, { kind: "newBench", seed: 99 }).practical).toBe("practice");
  });

  it("the reading check and slope appear only after hand-in", () => {
    const bench = createOhmsLawBench(7);
    for (let i = 0; i < 120; i++) bench.advance(1 / 60);
    const record = setCell(emptyOhmsLawRecord("practice"), 0, "R", "0");
    const wire = bench.supervisor.effectiveOhm().toFixed(1);
    const page = (results: ReturnType<typeof handIn> | null) =>
      renderToStaticMarkup(
        createElement(ResultsLayer, { results, onAgain: () => {}, onWatch: () => {} }),
      );

    const before = page(null);
    expect(before).toBe("");
    expect(before).not.toContain(wire);

    const after = page(handIn(record, bench, "practice"));
    expect(after).toContain('data-testid="results"');
    expect(after).toContain('data-testid="results-check"');
    expect(after).toContain("The wire is");
    expect(after).toContain(`${wire} Ω`);
    expect(after).toContain('data-testid="results-watch-again"');
    expect(after).toContain('data-testid="results-new-bench"');
  });
});

describe("Watch plays itself, and its graph comes out", () => {
  it("choosing Watch plays once; Practise, Exam and a bare load do not", () => {
    const paper = initialRun(q("practical=ohms-law&seed=7"), 7);
    expect(autoPlays(nextRun(paper, { kind: "choose", mode: "watch" }))).toBe(true);
    expect(autoPlays(nextRun(paper, { kind: "choose", mode: "practice" }))).toBe(false);
    expect(autoPlays(nextRun(paper, { kind: "choose", mode: "exam" }))).toBe(false);
    // Watch again on the results is a tap too; the paper itself and a URL load are not.
    expect(autoPlays(nextRun(paper, { kind: "watchAgain" }))).toBe(true);
    expect(autoPlays(paper)).toBe(false);
    expect(autoPlays(initialRun(q("mode=watch&seed=7"), 7))).toBe(false);
    expect(autoPlays(nextRun(paper, { kind: "newBench", seed: 9 }))).toBe(false);
  });

  it("Watch has the graph out on Plot and Slope only", () => {
    expect(watchGraphOut("plot")).toBe(true);
    expect(watchGraphOut("slope")).toBe(true);
    for (const key of ["identify", "connect", "readings", undefined]) {
      expect(watchGraphOut(key)).toBe(false);
    }
  });
});

describe("Watch's graph pop-up", () => {
  it("Practise and Exam never open it by themselves", () => {
    for (const key of ["plot", "slope", "readings"]) {
      expect(watchGraphMove(false, key, null, false)).toEqual({ popup: null, auto: false });
    }
  });

  it("Watch opens it on Plot and closes it after Slope", () => {
    const on = watchGraphMove(true, "plot", null, false);
    expect(on).toEqual({ popup: "graph", auto: true });
    expect(watchGraphMove(true, "slope", on.popup, on.auto)).toEqual(on);
    expect(watchGraphMove(true, "conclusion", on.popup, on.auto)).toEqual({
      popup: null,
      auto: false,
    });
  });

  it("a graph she opened herself is not closed for her", () => {
    const on = watchGraphMove(true, "plot", "graph", false);
    expect(on).toEqual({ popup: "graph", auto: false });
    expect(watchGraphMove(true, "conclusion", on.popup, on.auto).popup).toBe("graph");
  });
});
