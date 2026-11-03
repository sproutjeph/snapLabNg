import { checkReadingsAgainstBench, examinerQuestions, markOhmsLaw } from "@snaplab/rules";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EXAMINER_BUSY_MESSAGE,
  initialExaminerState,
  submitExaminerTurn,
} from "../../examiner/ExaminerConsole";
import { sampleGraph, sampleTable } from "../graph/sample";
import { emptyOhmsLawRecord } from "../readings/record";
import { examinerForSheet, Results } from "./Results";
import { checkRows, parallaxHint, ruleLines, slopeLine, unreadSettings } from "./resultsModel";
import type { ResultsProps } from "./types";

// The results page only groups and formats. Marks are packages/rules' (its tests carry the
// textbook values); these check the shaping, with the rules doing the marking.

const record = { ...sampleTable("practice"), graph: sampleGraph() };
const log = record.rows
  .filter((r) => r.R.text_as_written !== "")
  .map((r) => ({
    boxOhm: Number(r.R.text_as_written),
    iShown: r.I.text_as_written,
    vShown: r.V.text_as_written,
  }));
const divisions = { ammeterA: 0.02, voltmeterV: 0.05 };

describe("the marks by rule", () => {
  it("lists each rule once, with its sub-items summed, and the marks add up to the sheet's", () => {
    const sheet = markOhmsLaw(record, { teacherXyOhm: 3.1 });
    const lines = ruleLines(sheet);
    expect(new Set(lines.map((l) => l.rule)).size).toBe(lines.length);
    const total = lines.reduce((n, l) => n + Number(l.available.replace("½", ".5")), 0);
    // "2½" is written without a digit before ½ only for 0½; every sum here has a whole part.
    expect(total).toBe(sheet.available);
    expect(lines.every((l) => l.label.length > 0)).toBe(true);
  });

  it("marks a rule lost when any of its marks were lost, and keeps the examiner's fix", () => {
    const sheet = markOhmsLaw({ ...record, precautions: ["", ""] }, { teacherXyOhm: 3.1 });
    const precautions = ruleLines(sheet).find((l) => l.rule === "PRECAUTIONS");
    expect(precautions?.lost).toBe(true);
    expect(precautions?.fixes.length).toBeGreaterThan(0);
  });
});

describe("the readings check", () => {
  it("has one row per table row she wrote, and all ok when the meters agree", () => {
    const rows = checkRows(record, checkReadingsAgainstBench(record, log, divisions));
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(parallaxHint(rows)).toBe(false);
    expect(unreadSettings(rows)).toEqual([]);
  });

  it("flags the row whose voltage is more than a division from the meter, and hints at parallax", () => {
    const off = log.map((e) => (e.boxOhm === 10 ? { ...e, vShown: "0.68" } : e));
    const rows = checkRows(record, checkReadingsAgainstBench(record, off, divisions));
    const bad = rows.filter((r) => !r.ok);
    expect(bad.map((r) => r.box)).toEqual(["10"]);
    expect(bad[0]?.V).toMatchObject({ wrote: "0.57", showed: "0.68", ok: false });
    expect(bad[0]?.I.ok).toBe(true);
    expect(parallaxHint(rows)).toBe(true);
  });

  it("names the box settings she never read the meters at", () => {
    const missing = log.filter((e) => e.boxOhm !== 20);
    const rows = checkRows(record, checkReadingsAgainstBench(record, missing, divisions));
    expect(unreadSettings(rows)).toEqual(["20"]);
    expect(rows.find((r) => r.box === "20")?.ok).toBe(false);
  });

  it("names a setting she wrote only a voltage for, if the meters were never read there", () => {
    const rowsWritten = record.rows.map((r, i) =>
      i === 2 ? { ...r, I: { ...r.I, text_as_written: "" } } : r,
    );
    const onlyV = { ...record, rows: rowsWritten };
    const missing = log.filter((e) => e.boxOhm !== 5);
    const rows = checkRows(onlyV, checkReadingsAgainstBench(onlyV, missing, divisions));
    expect(rows.find((r) => r.box === "5")?.I.wrote).toBe("");
    expect(unreadSettings(rows)).toEqual(["5"]);
  });

  it("leaves out rows she left empty", () => {
    const empty = emptyOhmsLawRecord("practice");
    expect(checkRows(empty, checkReadingsAgainstBench(empty, [], divisions))).toEqual([]);
  });
});

describe("her slope beside the wire", () => {
  it("reads her slope from what she wrote, to 1 d.p., and the wire's resistance to 1 d.p.", () => {
    const written = {
      ...record,
      graph: record.graph && { ...record.graph, slope_as_written: "s = ΔV/ΔI = 3.04 Ω" },
    };
    expect(slopeLine(written, 3.1234)).toEqual({ yours: "3.0", wire: "3.1" });
  });

  it("says nothing of a slope she did not write", () => {
    expect(slopeLine(emptyOhmsLawRecord("exam"), 3.1)).toEqual({ yours: null, wire: "3.1" });
  });
});

describe("the examiner's questions on the results sheet", () => {
  const imperfectRecord = {
    ...record,
    precautions: ["Open the key between readings", ""],
    ohms_law_as_written: "",
  };
  const sheet = markOhmsLaw(imperfectRecord, { teacherXyOhm: 3.1 });
  const checks = checkReadingsAgainstBench(imperfectRecord, log, divisions);
  const noop = () => {};

  const renderResults = (over: Partial<ResultsProps> = {}) =>
    renderToStaticMarkup(
      createElement(Results, {
        mode: "practice",
        sheet,
        checks,
        record: imperfectRecord,
        benchOhm: 3.1,
        onAgain: noop,
        onWatch: noop,
        ...over,
      }),
    );

  /** Extracts the Marks card and Score HTML so we can assert the marks never change. */
  const marksSnapshot = (html: string) => {
    const score = html.match(/<div class="rs-score">[\s\S]*?<\/div>/)?.[0] ?? "";
    const rules =
      html.match(/<section class="rs-card" aria-labelledby="rs-marks">[\s\S]*?<\/section>/)?.[0] ??
      "";
    return { score, rules };
  };

  it("renders up to 3 WAEC-style questions picked from her mark sheet", () => {
    const picked = examinerQuestions(sheet);
    expect(picked).toHaveLength(3);
    // Her imperative precaution, missing Ohm's law, and unfinished calculation come first.
    expect(picked.map((p) => p.question.id)).toEqual([
      "vi-precaution-tense",
      "vi-ohms-law",
      "vi-wire-length",
    ]);

    const html = renderResults();
    expect(html).toContain('data-testid="results-examiner"');
    expect(html).toContain("Examiner&#x27;s questions");
    expect(html).toContain('data-testid="examiner-input"');
    expect(html).toContain('data-testid="examiner-ptt"');
    expect(html).toContain("Hold to speak");

    for (const { question } of picked) {
      expect(html).toContain(`data-testid="examiner-question-${question.id}"`);
      expect(html).toContain(question.text.replaceAll("'", "&#x27;"));
    }
  });

  it("posts the right question_id for a typed answer, shows Spark's verdict and reply, and leaves marks unchanged", async () => {
    const beforeHtml = renderResults();
    const beforeMarks = marksSnapshot(beforeHtml);
    const beforeEarned = sheet.earned;
    const beforeAvailable = sheet.available;

    const sentBodies: unknown[] = [];
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      sentBodies.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          verdict: "correct",
          reply: "Good — write it in the past tense as an action you took.",
          model_answer: "A precaution reports something you actually did.",
        }),
      );
    }) as typeof fetch;

    const ex = examinerForSheet(sheet, fakeFetch);
    if (!ex) throw new Error("expected examiner questions for Ohm's law sheet");

    const state0 = initialExaminerState(
      ex.first,
      "The key was opened between readings, written as a completed action.",
    );
    const state1 = await submitExaminerTurn(state0, ex.ask);

    expect(sentBodies).toEqual([
      {
        question_id: "vi-precaution-tense",
        answer: "The key was opened between readings, written as a completed action.",
        language: "english",
        her_mistake: "Open the key between readings",
      },
    ]);

    const afterHtml = renderResults({ examinerSession: state1 });
    expect(afterHtml).toContain(
      "The key was opened between readings, written as a completed action.",
    );
    expect(afterHtml).toContain('data-testid="examiner-verdict"');
    expect(afterHtml).toContain('data-verdict="correct"');
    expect(afterHtml).toContain("Correct");
    expect(afterHtml).toContain("Good — write it in the past tense as an action you took.");
    // Advances to question 2
    expect(state1.currentQuestion?.id).toBe("vi-ohms-law");

    // Marks and sheet are completely untouched
    expect(sheet.earned).toBe(beforeEarned);
    expect(sheet.available).toBe(beforeAvailable);
    expect(marksSnapshot(afterHtml)).toEqual(beforeMarks);
  });

  it("shows the polite fallback on network, rate-limit or missing-fixture errors and leaves marks unchanged", async () => {
    const beforeHtml = renderResults();
    const beforeMarks = marksSnapshot(beforeHtml);

    for (const failure of [
      () => Promise.reject(new Error("network down")),
      async () => new Response(JSON.stringify({ error: "Too many answers" }), { status: 429 }),
      async () => new Response(JSON.stringify({ error: "No fixture" }), { status: 502 }),
    ]) {
      const ex = examinerForSheet(sheet, failure as unknown as typeof fetch);
      if (!ex) throw new Error("expected examiner questions");

      const state0 = initialExaminerState(ex.first, "My typed answer");
      const failedState = await submitExaminerTurn(state0, ex.ask);

      expect(failedState.error).toBe(EXAMINER_BUSY_MESSAGE);
      expect(failedState.answer).toBe("My typed answer");
      expect(failedState.turns).toHaveLength(0);

      const errorHtml = renderResults({ examinerSession: failedState });
      expect(errorHtml).toContain('data-testid="examiner-error"');
      expect(errorHtml).toMatch(/the examiner is busy/i);
      expect(errorHtml).toMatch(/type your answer/i);
      expect(marksSnapshot(errorHtml)).toEqual(beforeMarks);
    }

    // Voice error fallback tells her to type her answer while keeping marks untouched.
    const voiceFallbackHtml = renderResults({
      voiceError: "Spoken answers need the live examiner. Type your answer instead.",
    });
    expect(voiceFallbackHtml).toContain('data-testid="examiner-voice-error"');
    expect(voiceFallbackHtml).toMatch(/type your answer/i);
    expect(marksSnapshot(voiceFallbackHtml)).toEqual(beforeMarks);
  });
});
