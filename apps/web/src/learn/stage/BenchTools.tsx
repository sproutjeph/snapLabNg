// The bench's tools (docs/plans/wave-2-lean.md, 2b additions): what used to float over the stage
// as `ol-tools` now sits in the shell's Tools pop-up (LessonShell's `tools` slot), so nothing
// floats over the bench. The shell adds Compare and Notebook itself; the graph paper is the
// shell's Graph pop-up. Watch's demonstration bench takes no Undo or Reset.

export interface BenchToolsProps {
  /** Opens the Graph pop-up. */
  onGraph(): void;
  /** Takes back her last lead; absent in Watch. */
  onUndo?: (() => void) | undefined;
  /** Clears her bench; absent in Watch. */
  onReset?: (() => void) | undefined;
}

export function BenchTools({ onGraph, onUndo, onReset }: BenchToolsProps) {
  return (
    <div
      className="ol-bench-tools"
      role="toolbar"
      aria-label="Bench"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <button type="button" className="ol-btn" onClick={onGraph}>
        Graph paper
      </button>
      {onUndo ? (
        <button type="button" className="ol-btn" onClick={onUndo}>
          Undo lead
        </button>
      ) : null}
      {onReset ? (
        <button type="button" className="ol-btn" onClick={onReset}>
          Reset bench
        </button>
      ) : null}
    </div>
  );
}
