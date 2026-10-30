import type { DirectorSpeed } from "./script/types";

// The E2E test hook (docs/plans/integration.md, "Contracts"; FROZEN until I1 and I2 merge). The
// practical page installs it as `window.__snaplab` only when the URL has `e2e=1`; without it there
// is no hook, no silent voice and no fast speeds. The scripts in apps/web/scripts/e2e drive the
// page through it the way she would (tap, type, hand in) and read what the page shows.

/** window.__snaplab, present only with ?e2e=1. */
export interface SnaplabE2E {
  /** "paper" until a mode is chosen, then the mode; "results" after hand-in. */
  screen(): "paper" | "watch" | "practice" | "exam" | "results";
  /** Director progress: beat index, beat count, finished. */
  progress(): { beat: number; beats: number; done: boolean };
  /** Terminal ids that a correct next connection needs (Practise only; [] otherwise). */
  targets(): string[];
  /** The same as her tapping that terminal on the stage. */
  tap(terminalId: string): void;
  /** Type into the notebook cell (row, column key), the same as her typing. */
  type(row: number, col: string, value: string): void;
  /** The bench's current meter readings (ammeter A, voltmeter V), as the meters show them. */
  meters(): { i: number; v: number };
  /** The wire's true resistance in ohms (the answer her slope is checked against). For noleak only. */
  wireOhm(): number;
  handIn(): void;
  /**
   * After hand-in: total and max from markOhmsLaw, the reading-check row count, and how many of
   * those rows are marked ✓.
   */
  result(): { total: number; max: number; checkRows: number; checkOk: number } | null;
  /** The same as tapping Start (or play) on the player. */
  play(): void;
  /** Sets the resistance box to `ohms`, as her plugs would. */
  setR(ohms: number): void;
  /** Closes or opens the key K, as her tap on it would. */
  key(closed: boolean): void;
}

declare global {
  interface Window {
    __snaplab?: SnaplabE2E;
  }
}

/** Where the hook lives: `window` in the browser, the same object as `globalThis`. */
export const e2eHost = globalThis as { __snaplab?: SnaplabE2E };

/** Whether the URL asks for the E2E hook. */
export function e2eOn(search: URLSearchParams): boolean {
  return search.get("e2e") === "1";
}

/** The `speed` the URL asks for: 1, 1.5 or 2, and with e2e=1 also 4 or 8; null otherwise. */
export function speedFrom(search: URLSearchParams): DirectorSpeed | null {
  const n = Number(search.get("speed"));
  if (n === 1 || n === 1.5 || n === 2) return n;
  if (e2eOn(search) && (n === 4 || n === 8)) return n;
  return null;
}

/**
 * Installs `window.__snaplab` when the URL has `e2e=1`, forwarding every call to `current()`, the
 * page's hook for the screen on show now (the page swaps it when the mode or the bench changes, so
 * the global stays the same object). Returns the uninstall, or a no-op without `e2e=1`.
 */
export function installE2E(search: URLSearchParams, current: () => SnaplabE2E): () => void {
  if (!e2eOn(search)) return () => {};
  const hook: SnaplabE2E = {
    screen: () => current().screen(),
    progress: () => current().progress(),
    targets: () => current().targets(),
    tap: (id) => current().tap(id),
    type: (row, col, value) => current().type(row, col, value),
    meters: () => current().meters(),
    wireOhm: () => current().wireOhm(),
    handIn: () => current().handIn(),
    result: () => current().result(),
    play: () => current().play(),
    setR: (ohms) => current().setR(ohms),
    key: (closed) => current().key(closed),
  };
  e2eHost.__snaplab = hook;
  return () => {
    if (e2eHost.__snaplab === hook) delete e2eHost.__snaplab;
  };
}
