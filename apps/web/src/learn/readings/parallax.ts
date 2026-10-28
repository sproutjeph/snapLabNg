import { useMemo } from "react";
import type { LessonMode, OhmsLawBench } from "../types";
import { SQUARE_TOLERANCE_DEG } from "./poses";

/** Technique only. Never a value. */
export const EYE_OFF_MIRROR_TEXT =
  "That reading was taken with your eye to one side of the mirror line. Line the pointer up with its image first.";

export interface ParallaxNote {
  /** The eye angle of the last loupe view (degrees; 0 is square on). */
  setEye(deg: number): void;
  /** She recorded a meter reading (edited an I or V cell). `key` names the cell. */
  reading(key?: string): void;
}

/**
 * Watches the loupe's eye angle and, when she records a meter reading while her eye was more
 * than 5 degrees off square, adds one `eye_off_mirror` note. Practice mode only. One note per
 * cell per off-square spell, so typing "0.30" is one note, not four.
 */
export function createParallaxNote(
  bench: Pick<OhmsLawBench, "addNote"> & { readonly mode: LessonMode },
): ParallaxNote {
  let eye = 0;
  const told = new Set<string>();
  return {
    setEye(deg) {
      eye = deg;
      if (Math.abs(deg) <= SQUARE_TOLERANCE_DEG) told.clear();
    },
    reading(key = "") {
      if (bench.mode !== "practice") return;
      if (Math.abs(eye) <= SQUARE_TOLERANCE_DEG) return;
      if (told.has(key)) return;
      told.add(key);
      bench.addNote({ kind: "eye_off_mirror", text: EYE_OFF_MIRROR_TEXT });
    },
  };
}

type NoteSink = Pick<OhmsLawBench, "addNote"> & { readonly mode: LessonMode };

/** React wrapper: a stable ParallaxNote for the bench (null before the bench exists). */
export function useParallaxNote(bench: NoteSink | null): ParallaxNote {
  return useMemo(
    () =>
      bench ? createParallaxNote(bench) : { setEye: () => undefined, reading: () => undefined },
    [bench],
  );
}
