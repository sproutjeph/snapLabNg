import type { AiTrace } from "./types";

// Synthetic ~182 KB base64 payload so redactForDisplay shows "[image 182 KB]" in CallDetail
const SYNTHETIC_IMAGE_DATA_URL = `data:image/jpeg;base64,${"A".repeat(Math.round((182 * 1024 * 4) / 3))}`;

export const MOCK_TRACE_END_MS = 6020;

export const mockTrace: AiTrace = {
  t0Ms: 0,
  calls: [
    {
      id: "spark-blueprint",
      lane: "spark",
      model: "muse-spark-1.3",
      label: "Blueprint compile",
      startMs: 0,
      endMs: 2640,
      status: "ok",
      request: {
        model: "muse-spark-1.3",
        Authorization: "Bearer LLM_redacted_demo_token",
        reasoning: { effort: "low" },
        stream: true,
        text: {
          format: {
            type: "json_schema",
            name: "lab_blueprint",
            strict: true,
          },
        },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Compile WAEC metre bridge practical blueprint." },
              { type: "input_image", image_url: SYNTHETIC_IMAGE_DATA_URL },
            ],
          },
        ],
      },
      response: {
        experiment: "meter_bridge",
        confidence: "high",
        components: [
          { kind: "meter_bridge", label_as_written: "AB = 100 cm" },
          { kind: "resistance_box", label_as_written: "R (1–5 Ω)" },
          { kind: "unknown_resistor", label_as_written: "X" },
          { kind: "galvanometer", label_as_written: "G" },
          { kind: "leclanche_cell", label_as_written: "E = 1.5 V" },
          { kind: "plug_key", label_as_written: "K" },
        ],
        values: {
          meter_bridge: {
            r_ohm_values: [1, 2, 3, 4, 5],
            unknown_label: "X",
            cell_type: "Leclanché",
            galvanometer_type: null,
          },
        },
        setup_issues: [],
        notes:
          "Standard metre bridge circuit with resistance box R in left gap and unknown X in right gap.",
      },
      note: "experiment field streamed at 820 ms",
    },
    {
      id: "sam-galvanometer",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: galvanometer",
      startMs: 40,
      endMs: 780,
      status: "ok",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "galvanometer",
        image: SYNTHETIC_IMAGE_DATA_URL,
        metadata: { include_confidence: "true" },
      },
      response: {
        prompt: "galvanometer",
        boxes_px: [{ x1: 412, y1: 218, x2: 508, y2: 314, score: 0.91 }],
      },
      note: null,
    },
    {
      id: "sam-resistance-box",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: resistance box",
      startMs: 50,
      endMs: 970,
      status: "ok",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "resistance box",
        image: SYNTHETIC_IMAGE_DATA_URL,
      },
      response: {
        prompt: "resistance box",
        boxes_px: [{ x1: 184, y1: 142, x2: 336, y2: 248, score: 0.88 }],
      },
      note: null,
    },
    {
      id: "sam-wire",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: long straight wire",
      startMs: 60,
      endMs: 1180,
      status: "ok",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "long straight wire",
        image: SYNTHETIC_IMAGE_DATA_URL,
      },
      response: {
        prompt: "long straight wire",
        boxes_px: [{ x1: 96, y1: 356, x2: 892, y2: 392, score: 0.94 }],
      },
      note: null,
    },
    {
      id: "sam-cell",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: Leclanché cell",
      startMs: 70,
      endMs: 910,
      status: "ok",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "cell",
        image: SYNTHETIC_IMAGE_DATA_URL,
      },
      response: {
        prompt: "cell",
        boxes_px: [{ x1: 360, y1: 42, x2: 454, y2: 118, score: 0.86 }],
      },
      note: null,
    },
    {
      id: "sam-key",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: plug key",
      startMs: 80,
      endMs: 1460,
      status: "fallback",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "key",
        image: SYNTHETIC_IMAGE_DATA_URL,
      },
      response: {
        prompt: "key",
        boxes_px: [],
        fallback_source: "spark.approx_box",
      },
      note: "fallback: boxes from Spark",
    },
    {
      id: "sam-graph",
      lane: "sam",
      model: "sam-3.1",
      label: "Outline: graph",
      startMs: 90,
      endMs: 1270,
      status: "ok",
      request: {
        model: "sam-3.1",
        api_key: "LLM_redacted_demo_key",
        prompt: "graph",
        image: SYNTHETIC_IMAGE_DATA_URL,
      },
      response: {
        prompt: "graph",
        boxes_px: [{ x1: 118, y1: 680, x2: 540, y2: 980, score: 0.93 }],
        page_area_ratio: 0.24,
      },
      note: null,
    },
    {
      id: "wonder-readings",
      lane: "wonder",
      model: "muse-wonder-1.0",
      label: "Page readings",
      startMs: 40,
      endMs: 4380,
      status: "ok",
      request: {
        model: "muse-wonder-1.0",
        Authorization: "Bearer LLM_redacted_demo_token",
        reasoning: { effort: "medium" },
        text: {
          format: {
            type: "json_schema",
            name: "page_readings",
            strict: true,
          },
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Extract handwritten table cells, graph details, and precautions verbatim.",
              },
              { type: "input_image", image_url: SYNTHETIC_IMAGE_DATA_URL },
            ],
          },
        ],
      },
      response: {
        table_found: true,
        cells: [
          { row: "1", column: "R", text_as_written: "1.0", value: 1.0, legibility: "clear" },
          { row: "1", column: "l", text_as_written: "57", value: 57.0, legibility: "clear" },
          { row: "2", column: "R", text_as_written: "2.0", value: 2.0, legibility: "clear" },
          { row: "2", column: "l", text_as_written: "40.0", value: 40.0, legibility: "clear" },
        ],
        precautions: [
          "Avoid parallax error when reading the metre rule",
          "The jockey was not dragged along the wire",
        ],
      },
      note: null,
    },
    {
      id: "engine-circuit",
      lane: "engine",
      model: "engine",
      label: "circuit solve",
      startMs: 830,
      endMs: 842,
      status: "ok",
      request: {
        solver: "meterBridgeStep",
        hz: 120,
        rBoxOhms: 2.0,
        jockeyCm: 40.0,
        keyClosed: true,
      },
      response: {
        galvanometerCurrentMa: 0.0,
        needleDeflectionDeg: 0.0,
        wireBalanced: true,
      },
      note: "deterministic 120 Hz Wheatstone bridge solver",
    },
    {
      id: "engine-rules",
      lane: "engine",
      model: "engine",
      label: "rule engine: 9 rules",
      startMs: 4390,
      endMs: 4408,
      status: "ok",
      request: {
        experiment: "meter_bridge",
        rulesEvaluated: 9,
        cellsChecked: 20,
      },
      response: {
        deterministic: true,
        deductions: ["PHY-LEN-1DP", "PHY-GRAPH-SCALE", "PHY-PREC-TENSE"],
      },
      note: "same page → same score",
    },
    {
      id: "voice-q1",
      lane: "voice",
      model: "muse-voice-transcribe-1.0",
      label: "Live captions: Q1",
      startMs: 4520,
      endMs: 5160,
      status: "ok",
      request: {
        model: "muse-voice-transcribe-1.0",
        apiKey: "LLM_redacted_voice_key",
        audioEncoding: "PCM_16KHZ",
        mode: "PUSH_TO_TALK",
        languageBias: ["English"],
      },
      response: {
        transcript:
          "If you drag the jockey it will scrape the constantan wire and shift the null point.",
        final: true,
      },
      note: null,
    },
    {
      id: "spark-examiner-q1",
      lane: "spark",
      model: "muse-spark-1.3",
      label: "Examiner turn: Q1",
      startMs: 5180,
      endMs: 6020,
      status: "ok",
      request: {
        model: "muse-spark-1.3",
        Authorization: "Bearer LLM_redacted_demo_token",
        reasoning: { effort: "low" },
        ruleProbed: "PHY-PREC-DRAG",
      },
      response: {
        verdict: "correct",
        reply:
          "Correct. Dragging the jockey scrapes the wire so its cross-section is no longer uniform.",
      },
      note: null,
    },
  ],
  flags: [
    {
      lane: "spark",
      message: "galvanometer type not written → centre-zero assumed",
    },
  ],
};
