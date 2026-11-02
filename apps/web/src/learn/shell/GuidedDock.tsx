import { type ReactNode, useEffect, useRef } from "react";
import type { GuidedDock as DockKind } from "./dock";
import "./guidedDock.css";

// The guided demonstration's docked column (docs/plans/guided-demo.md, "Watch v2"): the question
// paper, whole, down the right of a laptop (a bottom sheet on a phone); or, when a board is
// needed (the readings table, the graph, a card of lines), the current step as a compact card at
// the top of the column with the board filling the rest. Over the callout layer and under the
// player; dock.ts tells the camera what it covers.

export type DockPanelKind = Exclude<DockKind, "end">;

export function GuidedDockPanel({
  kind,
  step,
  children,
}: {
  kind: DockPanelKind;
  /** The compact current-step card, over a board. Omitted for the whole paper. */
  step?: ReactNode;
  children: ReactNode;
}) {
  // A board that grows (the table's newest row) is kept in view in a short column (a phone's sheet).
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current
      ?.querySelector<HTMLElement>('[data-highlighted="1"]')
      ?.scrollIntoView({ block: "nearest" });
  });
  return (
    <aside className="gd-dock" data-kind={kind} data-testid={`dock-${kind}`}>
      {step ? <div className="gd-step">{step}</div> : null}
      <div className="gd-body" ref={body}>
        {children}
      </div>
    </aside>
  );
}

/** A card of short lines (the precautions, the law, the working), shown under the step. */
export function NotesBoard({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <section className="gd-notes xp" data-testid="notes-board" aria-label={title}>
      <h3 className="gd-notes-title">{title}</h3>
      <ul className="gd-notes-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
