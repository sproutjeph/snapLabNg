import { useEffect } from "react";
import HomePage from "./HomePage";

/**
 * Standalone preview route (`/?home=1`) for the home page.
 * Sets `window.__SNAPLAB_READY__ = true` after mount for screenshot capture.
 */
export default function HomePreview() {
  // Ready once the entrance has played, so a shot (and its fps) shows the page at rest.
  useEffect(() => {
    const t = setTimeout(() => {
      window.__SNAPLAB_READY__ = true;
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return <HomePage />;
}
