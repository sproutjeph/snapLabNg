import type { PracticalMode } from "../learn/types";

export const ROUTES = {
  snap: "/?flow=1",
  demo: "/?flow=1&golden=note1",
  ohmsLaw: "/?learn=ohms-law",
  /** The question paper: she hears the question, then chooses Watch, Practise or Exam. */
  practical: "/?practical=ohms-law",
} as const;

/** The V–I practical opened straight in one mode (the picker's Watch, Practise and Exam). */
export function practicalIn(mode: PracticalMode): string {
  return `${ROUTES.practical}&mode=${mode}`;
}

/**
 * Adds or replaces a single query parameter in `path`, preserving existing parameters and hash.
 */
export function withParam(path: string, key: string, value: string): string {
  const url = new URL(path, "http://snaplab.local");
  url.searchParams.set(key, value);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
