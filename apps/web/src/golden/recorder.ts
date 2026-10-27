import { GoldenRecording, type SnapEvent } from "@snaplab/contracts";

export interface RecorderMeta {
  id: string;
  title: string;
  page: { file: string; width: number; height: number };
}

export interface Recorder {
  push(event: SnapEvent): void;
  finish(): GoldenRecording;
}

/**
 * Records a live SnapEvent stream with timings. `at_ms` is measured from
 * the first pushed event; `now` is injectable so tests control the clock.
 */
export function createRecorder(meta: RecorderMeta, opts: { now?: () => number } = {}): Recorder {
  const now = opts.now ?? (() => performance.now());
  const events: { at_ms: number; event: SnapEvent }[] = [];
  let t0: number | null = null;

  return {
    push(event: SnapEvent): void {
      const t = now();
      if (t0 === null) {
        t0 = t;
      }
      events.push({ at_ms: Math.max(0, t - t0), event });
    },

    finish(): GoldenRecording {
      if (events.length === 0 || events[0]?.event.type !== "accepted") {
        throw new Error("Golden recording must start with an accepted event");
      }
      if (events.at(-1)?.event.type !== "done") {
        throw new Error("Golden recording must end with a done event");
      }
      return GoldenRecording.parse({
        version: 1,
        id: meta.id,
        title: meta.title,
        page: meta.page,
        events,
      });
    },
  };
}
