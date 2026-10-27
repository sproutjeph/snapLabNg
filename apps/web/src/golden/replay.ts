import type { GoldenRecording, SnapEvent } from "@snaplab/contracts";

export interface ReplayOptions {
  signal: AbortSignal;
  speed?: number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Clock for scheduling; defaults to performance.now (or a virtual clock when `sleep` is injected). */
  now?: () => number;
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
  // Each event is scheduled against the replay's start, not after the previous wait, so
  // time spent rendering between events does not add up into drift on slow phones.
  let virtual = 0;
  const now = opts.now ?? (opts.sleep ? () => virtual : () => performance.now());
  const start = now();
  for (const [index, item] of rec.events.entries()) {
    if (opts.signal.aborted) {
      return;
    }
    if (index > 0) {
      const wait = Math.max(0, start + item.at_ms / speed - now());
      await sleep(wait, opts.signal);
      virtual += wait;
      if (opts.signal.aborted) {
        return;
      }
    }
    yield item.event;
  }
}
