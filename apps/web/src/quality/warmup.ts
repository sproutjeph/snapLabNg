const MAX_FRAME_GAP_MS = 250;

function isHidden(): boolean {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

/**
 * Counts requestAnimationFrame frames over `ms`. The clock starts at the
 * first frame's timestamp, so a page opened in a background tab is not
 * measured from before it was shown. The sample restarts when the tab is
 * hidden or any frame gap exceeds 250 ms.
 */
export function measureWarmupFps(ms = 2000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      resolve(0);
      return;
    }
    let frames = 0;
    let start: number | null = null;
    let last = 0;
    function tick(now: number) {
      if (isHidden()) {
        frames = 0;
        start = null;
        requestAnimationFrame(tick);
        return;
      }
      if (start === null) {
        start = now;
        last = now;
        requestAnimationFrame(tick);
        return;
      }
      const gap = now - last;
      last = now;
      if (gap > MAX_FRAME_GAP_MS) {
        frames = 0;
        start = now;
        requestAnimationFrame(tick);
        return;
      }
      frames += 1;
      const elapsed = now - start;
      if (elapsed < ms) {
        requestAnimationFrame(tick);
      } else {
        resolve(Math.round((frames / Math.max(elapsed, 1)) * 1000));
      }
    }
    requestAnimationFrame(tick);
  });
}
