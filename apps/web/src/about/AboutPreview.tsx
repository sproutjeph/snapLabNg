import { useEffect } from "react";
import AboutPage from "./AboutPage";

/**
 * Standalone preview route (`/?about=1`) for the about page.
 * Sets `window.__SNAPLAB_READY__ = true` after mount for screenshot capture.
 */
export default function AboutPreview() {
  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

  return <AboutPage />;
}
