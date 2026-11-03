// A frame-rate cap for the demand frameloops (the live stage and the home bench). A 120 Hz laptop
// screen otherwise renders the bench 120 times a second at full Retina resolution, which spins the
// fans for motion that looks the same at 60 (Nov 3, the user's report). Animation steps by each
// frame's delta, so capping the rate never changes how fast anything moves.

/** The rate the 3D canvases render at, at most. */
export const MAX_FPS = 60;
/** The next frame is asked for this much early: the browser starts it on the next vsync. */
const MARGIN_MS = 4;

/**
 * How long to wait before asking for the next frame, given how long ago this frame started: the
 * rest of a 1/MAX_FPS budget, less a small margin (0 means ask now).
 */
export function nextFrameDelayMs(elapsedMs: number, fps = MAX_FPS): number {
  return Math.max(0, 1000 / fps - MARGIN_MS - Math.max(0, elapsedMs));
}

/** Asks for frames no faster than MAX_FPS: call `next(frameStartMs)` at the end of a frame. */
export function createFrameCap(invalidate: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    next(frameStartMs: number) {
      if (timer !== null) return;
      const delay = nextFrameDelayMs(performance.now() - frameStartMs);
      if (delay === 0) {
        invalidate();
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        invalidate();
      }, delay);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
