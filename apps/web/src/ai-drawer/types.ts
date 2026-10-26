export type LaneId = "spark" | "sam" | "wonder" | "voice" | "engine";
export type CallStatus = "running" | "ok" | "fallback" | "error";

export interface AiCall {
  id: string;
  lane: LaneId;
  model: string; // e.g. "muse-spark-1.3", "sam-3.1", "muse-wonder-1.0"; "engine" for the engine lane
  label: string; // what it did, e.g. "Blueprint compile", "Outline: galvanometer", "circuit solve"
  startMs: number; // absolute, same clock as AiTrace.t0Ms
  endMs: number | null; // null while running
  status: CallStatus;
  request: unknown; // JSON as sent (the drawer redacts before showing)
  response: unknown; // JSON as received, or null while running
  note: string | null; // e.g. "fallback: boxes from Spark"
}

export interface AiFlag {
  lane: LaneId;
  message: string;
}

export interface AiTrace {
  t0Ms: number;
  calls: AiCall[];
  flags: AiFlag[];
}
