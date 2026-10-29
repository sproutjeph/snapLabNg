import type { PracticalMode } from "../types";

/** The UI says "Practise" and the code says "practice": either spelling works in the URL. */
export function modeFrom(q: string | null): PracticalMode {
  if (q === "practice" || q === "practise") return "practice";
  return q === "exam" ? "exam" : "watch";
}
