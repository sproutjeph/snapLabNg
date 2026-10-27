import { useEffect } from "react";
import LiteBench from "./LiteBench";

// The golden bench of the hero metre bridge experiment (docs/15 §4):
// coils 1, 2, 2, 5, 10 Ω, starting with only the 1 Ω plug out (R = 1 Ω).
// X is the unknown resistance (3 Ω) and is never shown.
const GOLDEN_SETUP = {
  boxValuesOhm: [1, 2, 2, 5, 10],
  plugsIn: [false, true, true, true, true],
  xOhm: 3,
};

const GOLDEN_PLUG_LABELS = ["1", "2", "2", "5", "10"];
const UNKNOWN_LABEL = "X";

/**
 * Preview page for Lite mode (`/?lite=1`).
 * Mounts the 2D SVG metre bridge bench with golden parameters and signals readiness.
 */
export default function LitePreview() {
  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, []);

  return (
    <LiteBench setup={GOLDEN_SETUP} plugLabels={GOLDEN_PLUG_LABELS} unknownLabel={UNKNOWN_LABEL} />
  );
}
