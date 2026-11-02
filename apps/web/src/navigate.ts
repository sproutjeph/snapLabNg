// Client-side navigation for App's query routing. A full page load drops the click's user
// activation, and Chrome then refuses speech on the new page until another tap; pushing the URL
// and re-rendering keeps the same page, so the guided reading can speak at once.

/** Goes to `url` on this page: pushes it onto the history and tells App to route again. */
export function navigate(url: string): void {
  history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Calls `onChange` whenever the URL changes (back, forward, or navigate()). Returns the unsubscribe. */
export function subscribeLocation(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/** A plain left click, with no modifier: the only click a link hands to navigate(). */
export function isPlainLeftClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented
  );
}
