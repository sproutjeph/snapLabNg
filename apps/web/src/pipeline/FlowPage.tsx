import type { Readings, SnapEvent } from "@snaplab/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import AiDrawer from "../ai-drawer/AiDrawer";
import { ShowAiToggle } from "../ai-drawer/ShowAiToggle";
import CaptureFlow from "../capture/CaptureFlow";
import type { CaptureResult } from "../capture/types";
import { rectifyPage } from "../rectify/rectify";
import { pageToUploadJpeg } from "./pageUpload";
import { streamSnap } from "./snapClient";
import { traceFromEvents } from "./trace";

type Step = "capture" | "reading" | "done";

/** UI names, with the WAEC spelling "metre bridge" (AGENTS.md). */
const EXPERIMENT_NAME: Record<string, string> = {
  meter_bridge: "metre bridge",
  titration: "titration",
  glass_block: "glass block",
  unknown: "not recognised",
};

/** Flattens the captured page on the GPU and returns the upload JPEG (header pixelated). */
async function flattenForUpload(result: CaptureResult) {
  const bitmap = await createImageBitmap(result.photo);
  const gl = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") });
  try {
    const out = rectifyPage(gl, bitmap, result.width, result.height, result.homography);
    try {
      return await pageToUploadJpeg(gl, out.page);
    } finally {
      out.dispose();
    }
  } finally {
    bitmap.close();
    gl.dispose();
    gl.forceContextLoss();
  }
}

/**
 * The end-to-end read stage (docs/04 §2 ①–②) at `?flow=1`: snap → corners → flatten →
 * upload → the /api/snap event stream, shown live in the "Show the AI" drawer.
 */
export default function FlowPage() {
  const [step, setStep] = useState<Step>("capture");
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<SnapEvent[]>([]);
  const [t0, setT0] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => abort.current?.abort();
  }, []);

  // The drawer's clock, ten times a second while the stream is open.
  useEffect(() => {
    if (step !== "reading") return;
    const id = window.setInterval(() => setNowMs(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [step]);

  useEffect(
    () => () => {
      if (pageUrl) URL.revokeObjectURL(pageUrl);
    },
    [pageUrl],
  );

  async function onCaptured(result: CaptureResult) {
    // One read at a time: a new capture cancels the previous one.
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStep("reading");
    setEvents([]);
    setT0(performance.now());
    setNowMs(performance.now());
    const fail = (message: string) =>
      setEvents((prev) => [
        ...prev,
        { type: "error", stage: "input", message, fallback: "golden" },
      ]);

    let upload: Awaited<ReturnType<typeof flattenForUpload>> | null = null;
    try {
      upload = await flattenForUpload(result);
    } catch {
      fail("Couldn't prepare the page on this device. Try the golden pages.");
    }
    if (upload && !controller.signal.aborted) {
      setPageUrl(URL.createObjectURL(upload.blob));
      try {
        for await (const e of streamSnap(
          upload.blob,
          upload.width,
          upload.height,
          controller.signal,
        )) {
          // The drawer's clock starts when the server accepts the page (trace.ts).
          if (e.type === "accepted") setT0(performance.now());
          setEvents((prev) => [...prev, e]);
        }
      } catch {
        if (!controller.signal.aborted) fail("Lost the connection to the server.");
      }
    }
    if (!controller.signal.aborted) {
      setNowMs(performance.now());
      setStep("done");
    }
  }

  const trace = useMemo(() => traceFromEvents(events, t0), [events, t0]);
  const mode = events.find((e) => e.type === "mode");
  const readings = events.find(
    (e): e is Extract<SnapEvent, { type: "readings" }> => e.type === "readings",
  )?.readings;
  const errors = events.filter(
    (e): e is Extract<SnapEvent, { type: "error" }> => e.type === "error",
  );

  if (step === "capture") return <CaptureFlow onDone={(r) => void onCaptured(r)} />;

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#0c0f14",
        color: "#f8fafc",
        padding: 20,
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <ShowAiToggle running={step === "reading"} onClick={() => setDrawerOpen((o) => !o)} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Reading your page</h1>
      <p style={{ margin: "0 0 16px", color: "#94a3b8" }}>
        {step === "reading" ? "Meta's models are reading it now…" : "Done."}
        {mode && mode.type === "mode" ? ` Experiment: ${EXPERIMENT_NAME[mode.experiment]}.` : ""}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {pageUrl && (
          <img
            src={pageUrl}
            alt="Your flattened page, name hidden"
            style={{ width: 280, maxWidth: "100%", borderRadius: 8 }}
          />
        )}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          {readings ? <ReadingsTable readings={readings} /> : <p>Waiting for the table…</p>}
          {errors.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: errors only ever append
            <p key={i} role="alert" style={{ color: "#fca5a5" }}>
              {e.message}
            </p>
          ))}
          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            The red-ink marking of this table appears here once it is wired in.
          </p>
        </div>
      </div>
      <AiDrawer
        trace={trace}
        nowMs={nowMs}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function ReadingsTable({ readings }: { readings: Readings }) {
  const rows = [...new Set(readings.cells.filter((c) => !/head/i.test(c.row)).map((c) => c.row))];
  const cols = ["R", "l", "R_inv", "l_inv"] as const;
  const cell = (row: string, col: (typeof cols)[number]) =>
    readings.cells.find((c) => c.row === row && c.column === col);
  const header = (col: (typeof cols)[number]) =>
    readings.cells.find((c) => c.column === col)?.column_header_as_written ?? col;
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
      <caption style={{ textAlign: "left", marginBottom: 6, color: "#cbd5e1" }}>
        Your table, exactly as written
      </caption>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} style={{ border: "1px solid #334155", padding: "4px 10px" }}>
              {header(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r}>
            {cols.map((c) => {
              const x = cell(r, c);
              return (
                <td
                  key={c}
                  style={{
                    border: "1px solid #334155",
                    padding: "4px 10px",
                    color: x?.legibility === "unsure" ? "#fcd34d" : undefined,
                  }}
                >
                  {x?.text_as_written ?? ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
