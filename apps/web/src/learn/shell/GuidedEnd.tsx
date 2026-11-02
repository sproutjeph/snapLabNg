import { useEffect, useRef } from "react";
import { ConclusionCard, type ConclusionCardProps } from "../end/ConclusionCard";
import "./guidedEnd.css";

// The guided demonstration's end panel (docs/plans/guided-demo.md): Gemini's ConclusionCard, laid
// over the stage on the right of a laptop and along the foot of a phone, with the bench still
// showing beside it. It shows the conclusion lines and two buttons; no marks.

export type GuidedEndProps = ConclusionCardProps;

export default function GuidedEnd(props: GuidedEndProps) {
  const layer = useRef<HTMLDivElement>(null);
  // The panel appears on its own at the end: put the keyboard on its first button.
  useEffect(() => {
    layer.current?.querySelector<HTMLButtonElement>('[data-testid="conclusion-replay"]')?.focus();
  }, []);
  return (
    <div className="ge-layer" ref={layer}>
      <ConclusionCard {...props} />
    </div>
  );
}
