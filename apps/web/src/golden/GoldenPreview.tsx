import { GoldenRecording, type SnapEvent } from "@snaplab/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadRecording } from "./download";
import { replay } from "./replay";

function syntheticRecording(): GoldenRecording {
  const events: { at_ms: number; event: SnapEvent }[] = [
    {
      at_ms: 0,
      event: { type: "accepted", request_id: "demo-request", image_sha256: "demo-sha" },
    },
    { at_ms: 250, event: { type: "mode", experiment: "meter_bridge", confidence: "high" } },
    {
      at_ms: 500,
      event: {
        type: "values",
        values: {
          meter_bridge: {
            resistances: [
              { value: 2, unit_as_written: "Ω", text_as_written: "2" },
              { value: 4, unit_as_written: "Ω", text_as_written: "4" },
            ],
            unknown_label_as_written: "X",
            cell_type_as_written: "cell",
            galvanometer_type_as_written: "galvanometer",
          },
          titration: null,
          glass_block: null,
        },
      },
    },
    {
      at_ms: 800,
      event: {
        type: "setup_issues",
        setup_issues: [{ description: "Synthetic demo issue (not from a real page)", rule_code: null }],
      },
    },
    {
      at_ms: 1300,
      event: {
        type: "readings",
        readings: {
          table_found: true,
          cells: [
            {
              row: "1",
              column: "R",
              column_header_as_written: "R",
              text_as_written: "2.0",
              value: 2,
              unit_as_written: "Ω",
              box: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.2 },
              legibility: "clear",
            },
            {
              row: "1",
              column: "l",
              column_header_as_written: "l",
              text_as_written: "41.2",
              value: 41.2,
              unit_as_written: "cm",
              box: { x0: 0.35, y0: 0.1, x1: 0.55, y1: 0.2 },
              legibility: "clear",
            },
            {
              row: "2",
              column: "R",
              column_header_as_written: "R",
              text_as_written: "4.0",
              value: 4,
              unit_as_written: "Ω",
              box: { x0: 0.1, y0: 0.25, x1: 0.3, y1: 0.35 },
              legibility: "clear",
            },
            {
              row: "2",
              column: "l",
              column_header_as_written: "l",
              text_as_written: "58.6",
              value: 58.6,
              unit_as_written: "cm",
              box: { x0: 0.35, y0: 0.25, x1: 0.55, y1: 0.35 },
              legibility: "clear",
            },
          ],
          average_as_written: null,
          graph: null,
          precautions: ["Synthetic demo precaution"],
          other_marks: [],
        },
      },
    },
    {
      at_ms: 1700,
      event: {
        type: "timing",
        id: "demo-timing-1",
        lane: "spark",
        model: "demo-model",
        label: "Demo blueprint",
        start_ms: 0,
        end_ms: 500,
        status: "ok",
        request: {},
        response: {},
        note: null,
      },
    },
    {
      at_ms: 2100,
      event: {
        type: "timing",
        id: "demo-timing-2",
        lane: "sam",
        model: "demo-model",
        label: "Demo outlines",
        start_ms: 500,
        end_ms: 1300,
        status: "ok",
        request: {},
        response: {},
        note: null,
      },
    },
    {
      at_ms: 2500,
      event: {
        type: "timing",
        id: "demo-timing-3",
        lane: "wonder",
        model: "demo-model",
        label: "Demo readings",
        start_ms: 1300,
        end_ms: 2400,
        status: "ok",
        request: {},
        response: {},
        note: null,
      },
    },
    { at_ms: 3000, event: { type: "done", total_ms: 3000 } },
  ];
  return GoldenRecording.parse({
    version: 1,
    id: "synthetic-demo",
    title: "Synthetic demo (not a real page)",
    page: { file: "synthetic-demo.jpg", width: 800, height: 1000 },
    events,
  });
}

interface Arrived {
  atMs: number;
  type: string;
}

const SPEEDS = [0.5, 1, 4] as const;

export default function GoldenPreview() {
  const recording = useMemo(syntheticRecording, []);
  const [speed, setSpeed] = useState<number>(1);
  const [arrived, setArrived] = useState<Arrived[]>([]);
  const [status, setStatus] = useState("Ready. The demo recording lasts about 3 s at 1x.");
  const [playing, setPlaying] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  async function handlePlay() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setArrived([]);
    setPlaying(true);
    setStatus(`Playing at ${speed}x...`);
    let index = 0;
    try {
      for await (const event of replay(recording, { signal: controller.signal, speed })) {
        const atMs = recording.events[index]?.at_ms ?? 0;
        index += 1;
        setArrived((prev) => [...prev, { atMs, type: event.type }]);
      }
      setStatus(controller.signal.aborted ? "Stopped." : "Finished.");
    } catch {
      setStatus("Replay failed.");
    } finally {
      if (controllerRef.current === controller) {
        setPlaying(false);
      }
    }
  }

  function handleStop() {
    controllerRef.current?.abort();
  }

  const btnStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: "6px",
    border: "1px solid #64748b",
    backgroundColor: "#263448",
    color: "#f8fafc",
    fontSize: "14px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#12161d",
        color: "#f1f5f9",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Golden replay preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#a8b3c2", lineHeight: 1.5 }}>
          A small synthetic recording (not a real page) played back offline at its recorded pace.
          At 4x it finishes in under a second.
        </p>

        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginTop: "18px" }}
        >
          <button type="button" style={btnStyle} disabled={playing} onClick={() => void handlePlay()}>
            Play replay
          </button>
          <button type="button" style={btnStyle} disabled={!playing} onClick={handleStop}>
            Stop
          </button>
          <button type="button" style={btnStyle} onClick={() => downloadRecording(recording)}>
            Download as JSON
          </button>
          <label style={{ fontSize: "14px" }}>
            Speed{" "}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ marginLeft: "6px", padding: "8px", borderRadius: "6px", fontSize: "14px" }}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </label>
        </div>

        <p role="status" style={{ margin: "14px 0 0", fontSize: "14px", color: "#cbd5e1" }}>
          {status}
        </p>

        <ol style={{ margin: "14px 0 0", paddingLeft: "22px", fontSize: "14px", lineHeight: 1.9 }}>
          {arrived.map((item, i) => (
            <li key={`${item.atMs}-${item.type}-${i}`}>
              t = {item.atMs} ms - {item.type}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
