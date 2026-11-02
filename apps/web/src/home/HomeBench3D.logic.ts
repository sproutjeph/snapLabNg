// The card's small decisions, pure so they are tested without a renderer (HomeBench3D.tsx).

/** The poster covers the card unless the live canvas is mounted and has drawn its first frames. */
export function posterOpacity(shown: boolean, live: boolean): 0 | 1 {
  return shown && live ? 0 : 1;
}

/** The canvas wrapper is seen only in that same case. */
export function canvasOpacity(shown: boolean, live: boolean): 0 | 1 {
  return shown && live ? 1 : 0;
}

/**
 * A still or reduced-motion view stops rendering once settled. A resize clears the canvas, and a
 * stopped loop cannot redraw it, so a resize of a settled view must wake it (for another run of
 * still frames). The observer's first call, the box's size on mount, is not a resize.
 */
export function wakeOnResize(settled: boolean, first: boolean): boolean {
  return settled && !first;
}
