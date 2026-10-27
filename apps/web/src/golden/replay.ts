import type { GoldenRecording, SnapEvent } from "@snaplab/contracts";

export interface ReplayOptions {
  signal: AbortSignal;
  speed?: number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Yields each recorded event at its recorded time divided by `speed`
 * (default 1). Waits are the gaps between recorded times, so a replay is
 * scheduled from the recording's timeline. Stops promptly, without
 * throwing, when `signal` aborts.
 */
export async function* replay(
  rec: GoldenRecording,
  opts: ReplayOptions,
): AsyncGenerator<SnapEvent> {
  const speed = opts.speed ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("replay speed must be a positive number");
  }
  const sleep = opts.sleep ?? defaultSleep;
  let previousAtMs = 0;
  for (const [index, item] of rec.events.entries()) {
    if (opts.signal.aborted) {
      return;
    }
    if (index > 0) {
      await sleep(Math.max(0, item.at_ms - previousAtMs) / speed, opts.signal);
      if (opts.signal.aborted) {
        return;
      }
    }
    previousAtMs = item.at_ms;
    yield item.event;
  }
}
