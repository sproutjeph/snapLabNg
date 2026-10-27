import type { MarkSheet, Readings, SnapEvent } from "@snaplab/contracts";
import { examinerQuestions, markMeterBridgePage } from "@snaplab/rules";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import AiDrawer from "../ai-drawer/AiDrawer";
import { ShowAiToggle } from "../ai-drawer/ShowAiToggle";
import CaptureFlow from "../capture/CaptureFlow";
import type { CaptureResult } from "../capture/types";
import { makeAsk } from "../examiner/examinerClient";
import { loadGolden } from "../golden/load";
import { replay } from "../golden/replay";
import { RedInkOverlay } from "../marking/RedInkOverlay";
import { rectifyPage } from "../rectify/rectify";
import TeacherPanel from "../teacher/TeacherPanel";
import { useTeacher } from "../teacher/useTeacher";
import { pageToUploadJpeg } from "./pageUpload";
import { streamSnap } from "./snapClient";
import { traceFromEvents } from "./trace";

const ExaminerConsole = lazy(() => import("../examiner/ExaminerConsole"));
const LabBench = lazy(() => import("../lab/LabBench"));

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
  const [pageAspect, setPageAspect] = useState(1448 / 1024);
  const [events, setEvents] = useState<SnapEvent[]>([]);
  const [t0, setT0] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const abort = useRef<AbortController | null>(null);
  // Teacher mode: the teacher's true X marks accuracy; null (hidden) in student view.
  const teacher = useTeacher();

  // biome-ignore lint/correctness/useExhaustiveDependencies: start a golden replay once, on load
  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    // `?flow=1&golden=<id>` replays a recorded real read offline (docs/04 §6).
    const golden = new URLSearchParams(location.search).get("golden");
    if (golden && /^[a-z0-9-]+$/.test(golden)) void playGolden(golden);
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
      if (pageUrl?.startsWith("blob:")) URL.revokeObjectURL(pageUrl);
    },
    [pageUrl],
  );

  /** Feeds a stream of events (live or replayed) into the page. */
  async function consume(stream: AsyncIterable<SnapEvent>) {
    for await (const e of stream) {
      // The drawer's clock starts when the server accepts the page (trace.ts).
      if (e.type === "accepted") setT0(performance.now());
      setEvents((prev) => [...prev, e]);
    }
  }

  async function playGolden(id: string) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStep("reading");
    setEvents([]);
    setNowMs(performance.now());
    try {
      const rec = await loadGolden(id, controller.signal);
      setPageUrl(`/golden/${rec.page.file}`);
      setPageAspect(rec.page.height / rec.page.width);
      await consume(replay(rec, { signal: controller.signal }));
    } catch {
      if (!controller.signal.aborted) {
        setEvents((prev) => [
          ...prev,
          {
            type: "error",
            stage: "input",
            message: "Couldn't load that recorded page.",
            fallback: "none",
          },
        ]);
      }
    }
    if (!controller.signal.aborted) {
      setNowMs(performance.now());
      setStep("done");
    }
  }

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
      setPageAspect(upload.height / upload.width);
      try {
        await consume(streamSnap(upload.blob, upload.width, upload.height, controller.signal));
      } catch {
        if (!controller.signal.aborted) fail("Lost the connection to the server.");
      }
    }
    if (!controller.signal.aborted) {
      setNowMs(performance.now());
      setStep("done");
    }
  }

  const mode = events.find((e) => e.type === "mode");
  const readings = events.find(
    (e): e is Extract<SnapEvent, { type: "readings" }> => e.type === "readings",
  )?.readings;
  const setupIssues = events.find(
    (e): e is Extract<SnapEvent, { type: "setup_issues" }> => e.type === "setup_issues",
  )?.setup_issues;

  // Marks come only from packages/rules (AGENTS.md), on her readings as written. Student
  // mode: no teacher value, so accuracy is not marked and X is never involved.
  const marked = useMemo((): { sheet: MarkSheet; startMs: number; endMs: number } | null => {
    if (!readings || !mode || mode.type !== "mode" || mode.experiment !== "meter_bridge")
      return null;
    const startMs = performance.now();
    const sheet = markMeterBridgePage(readings, {
      teacherXOhm: teacher.xOhm,
      setupIssues: (setupIssues ?? []).map((i) => ({ description: i.description, box: null })),
    });
    return { sheet, startMs, endMs: performance.now() };
  }, [readings, mode, setupIssues, teacher.xOhm]);

  const trace = useMemo(() => {
    const t = traceFromEvents(events, t0);
    if (!marked) return t;
    const engineCall = {
      id: "engine-rules",
      lane: "engine" as const,
      model: "engine",
      label: `rule engine: ${new Set(marked.sheet.items.map((i) => i.rule)).size} rules`,
      startMs: marked.startMs,
      endMs: marked.endMs,
      status: "ok" as const,
      request: { input: "her readings, exactly as written" },
      response: { earned: marked.sheet.earned, available: marked.sheet.available },
      note: "Deterministic: the same page always gets the same marks.",
    };
    return { ...t, calls: [...t.calls, engineCall] };
  }, [events, t0, marked]);
  // Which questions she gets comes from her own lost marks (packages/rules); the server
  // only judges her answers.
  const examiner = useMemo(() => {
    if (!marked) return null;
    const list = examinerQuestions(marked.sheet);
    const first = list[0]?.question;
    return first ? { first, ask: makeAsk(list) } : null;
  }, [marked]);
  // Her bench: the parts she drew (Spark's boxes) and the R values she wrote.
  const lab = useMemo(() => {
    if (mode?.type !== "mode" || mode.experiment !== "meter_bridge" || !readings) return null;
    const parts = events.flatMap((e) =>
      e.type === "component" ? [{ kind: e.component.kind, box: e.component.approx_box }] : [],
    );
    const values = events.find(
      (e): e is Extract<SnapEvent, { type: "values" }> => e.type === "values",
    )?.values;
    const resistancesOhm = (values?.meter_bridge?.resistances ?? []).map((r) => r.value);
    return { parts, resistancesOhm, herMeanXOhm: readings.average_as_written?.value ?? null };
  }, [events, mode, readings]);
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
      <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 20 }}>
        <TeacherPanel teacher={teacher} />
      </div>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Reading your page</h1>
      <p style={{ margin: "0 0 16px", color: "#94a3b8" }}>
        {step === "reading" ? "Meta's models are reading it now…" : "Done."}
        {mode && mode.type === "mode" ? ` Experiment: ${EXPERIMENT_NAME[mode.experiment]}.` : ""}
      </p>
      {lab && pageUrl && step === "done" && (
        <section style={{ margin: "0 0 24px" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Your lab</h2>
          <div
            style={{
              height: "min(72vh, 640px)",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #1e293b",
            }}
          >
            <Suspense fallback={null}>
              <LabBench
                // A new teacher's X sets up a new bench (the engine copies X once).
                key={teacher.xOhm ?? "none"}
                pageUrl={pageUrl}
                pageAspect={pageAspect}
                parts={lab.parts}
                resistancesOhm={lab.resistancesOhm}
                teacherXOhm={teacher.xOhm}
                herMeanXOhm={lab.herMeanXOhm}
              />
            </Suspense>
          </div>
        </section>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {pageUrl && marked ? (
          <div style={{ flex: "2 1 480px", minWidth: 0 }}>
            <RedInkOverlay
              pageImageUrl={pageUrl}
              pageAspect={pageAspect}
              sheet={marked.sheet}
              playing={true}
            />
          </div>
        ) : (
          pageUrl && (
            <img
              src={pageUrl}
              alt="Your flattened page, name hidden"
              style={{ width: 280, maxWidth: "100%", borderRadius: 8 }}
            />
          )
        )}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          {readings ? <ReadingsTable readings={readings} /> : <p>Waiting for the table…</p>}
          {errors.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: errors only ever append
            <p key={i} role="alert" style={{ color: "#fca5a5" }}>
              {e.message}
            </p>
          ))}
          {!marked && step === "done" && readings && (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Marking is ready for the metre bridge only, so far.
            </p>
          )}
        </div>
      </div>
      {examiner && step === "done" && (
        <section style={{ maxWidth: 720, margin: "24px auto 96px" }}>
          <Suspense fallback={null}>
            <ExaminerConsole first={examiner.first} ask={examiner.ask} />
          </Suspense>
        </section>
      )}
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
