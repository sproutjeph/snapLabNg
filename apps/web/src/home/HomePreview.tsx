import { useEffect } from "react";
import HomePage from "./HomePage";

/**
 * Standalone preview route (`/?home=1`) for the home page.
 * Sets `window.__SNAPLAB_READY__ = true` after mount for screenshot capture.
 */
export default function HomePreview() {
  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

  return <HomePage />;
}
