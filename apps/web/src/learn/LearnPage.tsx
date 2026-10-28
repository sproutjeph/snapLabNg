import type { LessonMode } from "./types";

// ?learn=ohms-law[&mode=exam] — the hands-on V–I practical (docs/plans/ohms-law-vi.md).
// STUB (Wave 0). Lead-owned: Integration A composes the bench canvas (InkComposer, apparatus,
// wiring, readings) and the shell around it.

export default function LearnPage() {
  const search = new URLSearchParams(location.search);
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  return (
    <main className="snap-paper" style={{ padding: 24 }}>
      <h1 className="snap-label">Ohm's law (V–I)</h1>
      <p>Hands-on practical, {mode} mode. Coming together in Waves 1–2.</p>
    </main>
  );
}
