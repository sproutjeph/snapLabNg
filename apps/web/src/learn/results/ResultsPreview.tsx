import type { OhmsLawRecord } from "@snaplab/contracts";
import { type BenchLogEntry, checkReadingsAgainstBench, markOhmsLaw } from "@snaplab/rules";
import { useEffect, useMemo } from "react";
import { sampleGraph, sampleTable } from "../graph/sample";
import { emptyOhmsLawRecord } from "../readings/record";
import { Results } from "./Results";

// ?results=1: the results sheet on a worked example. The record is the lesson's sample table and
// graph; the bench's meters are made up for the page, with one voltage read off by more than a
// division so the check shows a ✕ and the parallax hint. Marks come from the real rules.
//   &v=empty   a table she left empty (the empty states)
// Illustrative numbers only: a student never sees this route.

const PREVIEW_BENCH_OHM = 3.1;

function previewProps(empty: boolean) {
  const record: OhmsLawRecord = empty
    ? emptyOhmsLawRecord("practice")
    : { ...sampleTable("practice"), graph: sampleGraph() };
  const log: BenchLogEntry[] = empty
    ? []
    : record.rows
        .filter((r) => r.R.text_as_written !== "")
        .map((r) => ({
          boxOhm: Number(r.R.text_as_written),
          iShown: r.I.text_as_written,
          // At R = 10 Ω her meter showed a different voltage from the one she wrote.
          vShown: r.R.text_as_written === "10" ? "0.68" : r.V.text_as_written,
        }));
  return {
    mode: "practice" as const,
    record,
    benchOhm: PREVIEW_BENCH_OHM,
    sheet: markOhmsLaw(record, { teacherXyOhm: PREVIEW_BENCH_OHM }),
    checks: checkReadingsAgainstBench(record, log, { ammeterA: 0.02, voltmeterV: 0.05 }),
  };
}

export default function ResultsPreview() {
  const empty = new URLSearchParams(location.search).get("v") === "empty";
  const props = useMemo(() => previewProps(empty), [empty]);
  useEffect(() => {
    const t = setTimeout(() => {
      window.__SNAPLAB_READY__ = true;
    }, 1800);
    return () => clearTimeout(t);
  }, []);
  return <Results {...props} onAgain={() => {}} onWatch={() => {}} />;
}
