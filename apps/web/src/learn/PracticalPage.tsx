import { lazy } from "react";
import type { PracticalMode } from "./types";

const LearnPage = lazy(() => import("./LearnPage"));

// STUB (Wave 0): the paper → mode → results flow arrives in Integration. For now it renders the
// existing hands-on page (docs/plans/exam-redesign.md, "Files").
export default function PracticalPage(_props: { mode: PracticalMode | null; seed: number | null }) {
  return <LearnPage />;
}
