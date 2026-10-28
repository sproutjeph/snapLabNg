import { useEffect, useMemo, useState } from "react";
import { OhmsLawNotebook } from "../readings/OhmsLawNotebook";
import type { LessonMode } from "../types";
import { GraphSheet } from "./GraphSheet";
import { sampleRecord, sampleTable } from "./sample";
import "./graph.css";

// ?graph=1 — the graph sheet on its own, beside the typed table.
//   &fill=1       a filled example (table and a correctly drawn sheet)
//   &mode=exam    exam mode (no placeholders)

export default function GraphPreview() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  const fill = search.get("fill") === "1";
  const [record, setRecord] = useState(() =>
    fill ? sampleRecord(mode) : { ...sampleTable(mode), graph: null },
  );

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, []);

  return (
    <div className="gs-preview">
      <div className="gs-preview-sheet">
        <GraphSheet
          value={record.graph}
          onChange={(graph) => setRecord((r) => ({ ...r, graph }))}
          mode={mode}
          table={record}
        />
      </div>
      <div className="gs-preview-table">
        <OhmsLawNotebook
          value={record}
          onChange={(next) => setRecord((r) => ({ ...next, graph: r.graph }))}
          mode={mode}
        />
      </div>
    </div>
  );
}
