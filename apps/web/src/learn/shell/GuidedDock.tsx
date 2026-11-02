import type { ReactNode } from "react";
import type { GuidedDock as DockKind } from "./dock";
import "./guidedDock.css";

// The guided demonstration's docked board (docs/plans/guided-demo.md): the readings table or the
// graph, read-only, in a column down the right of a laptop or a bottom sheet on a phone, over the
// callout layer and under the player. dock.ts tells the camera what it covers.

export function GuidedDockPanel({
  kind,
  children,
}: {
  kind: Extract<DockKind, "readings" | "graph">;
  children: ReactNode;
}) {
  return (
    <aside className="gd-dock" data-kind={kind} data-testid={`dock-${kind}`}>
      <div className="gd-body">{children}</div>
    </aside>
  );
}
