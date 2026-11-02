import type { QuestionRead } from "@snaplab/contracts";
import {
  getSnappedPaper,
  SAMPLE_PHOTOS,
  type SnappedPaper,
  setSnappedPaper,
} from "../../snapq/store";
import type { Script } from "../script/types";
import { toPracticalQuestion, watchPlan } from "./fromSnap";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import type { PracticalQuestion } from "./types";

// Which question the practical's paper shows (docs/plans/snap-question.md): the app's Q3B, or the
// one she snapped (?question=snapped). Marks, bench and values are Q3B's either way.

export const LOST_NOTE =
  "Your snapped question was lost when the page reloaded, so this is the app's copy.";
export const COPY_NOTE = "Watch follows the app's copy of this question.";

export interface PaperContext {
  /** ?question=snapped. */
  snapped: boolean;
  /** She asked for her snapped question but it is gone (a reload): the app's copy is shown. */
  lost: boolean;
  /** The paper in every mode (choice, Practise, Exam) and in non-guided Watch's sheet. */
  question: PracticalQuestion;
  /** Guided Watch's paper and tracker, and the script that reads it (null: the app's own script). */
  watchQuestion: PracticalQuestion;
  watchScript: Script | null;
  /** Her diagram photo (an object URL), when she snapped one. */
  photo: string | null;
  /** The one-line note under the paper's instructions (null: none). */
  note: string | null;
  /** The note guided Watch's sheet shows. */
  watchNote: string | null;
}

const APP: PaperContext = {
  snapped: false,
  lost: false,
  question: OHMS_LAW_QUESTION,
  watchQuestion: OHMS_LAW_QUESTION,
  watchScript: null,
  photo: null,
  note: null,
  watchNote: null,
};

/** Dev only (?snapdemo=1): a snapped paper made from Q3B's own text and the sample photos. */
export function demoSnappedPaper(): SnappedPaper {
  const q = OHMS_LAW_QUESTION;
  const question: QuestionRead = {
    experiment: "ohms_law_vi",
    confidence: "high",
    source_as_printed: q.source,
    title_as_printed: q.title,
    apparatus: q.apparatus.map((a) => ({
      kind:
        a.part === "box"
          ? "resistance_box"
          : a.part === "leads"
            ? "connecting_wires"
            : a.part === "wire"
              ? "wire_xy"
              : a.part === "ammeter" ||
                  a.part === "voltmeter" ||
                  a.part === "cells" ||
                  a.part === "key"
                ? a.part
                : "other",
      text_as_printed: a.text,
    })),
    instructions: q.instructions.map((i) => ({ label: i.label, text: i.text })),
    diagram: { present: true, photo: 1, parts: [] },
  };
  return { question, photos: SAMPLE_PHOTOS, outlines: new Map() };
}

export function paperContextFrom(search: URLSearchParams): PaperContext {
  if (search.get("question") !== "snapped") return APP;
  if (import.meta.env.DEV && search.get("snapdemo") === "1") setSnappedPaper(demoSnappedPaper());
  const snap = getSnappedPaper();
  if (!snap) return { ...APP, snapped: true, lost: true, note: LOST_NOTE, watchNote: LOST_NOTE };
  const plan = watchPlan(snap.question);
  return {
    snapped: true,
    lost: false,
    question: toPracticalQuestion(snap.question),
    watchQuestion: plan.question,
    watchScript: plan.script,
    photo: snap.question.diagram.present
      ? (snap.photos[snap.question.diagram.photo] ?? null)
      : null,
    note: plan.aligned ? null : COPY_NOTE,
    watchNote: plan.aligned ? null : COPY_NOTE,
  };
}
