import type { ReactNode } from "react";
import { SNAP_QUESTION_URL } from "../../snapq/store";
import { LOST_NOTE } from "./snapContext";

// The bits the paper adds for a snapped question (docs/plans/snap-question.md): a one-line note,
// and her diagram photo beside our clean one.

/** The note under the instructions. The lost-paper note carries a "Snap again" link. */
export function PaperNote({ note }: { note: string | null | undefined }): ReactNode {
  if (!note) return null;
  return (
    <p className="qp-note" data-testid="paper-note">
      {note}
      {note === LOST_NOTE ? (
        <>
          {" "}
          <a href={SNAP_QUESTION_URL}>Snap again</a>
        </>
      ) : null}
    </p>
  );
}

/** Her diagram photo, labelled; the caller adds the caption under our own circuit. */
export function HerDiagram({ photo }: { photo: string | null | undefined }): ReactNode {
  if (!photo) return null;
  return (
    <figure className="qp-her" data-testid="her-diagram">
      <img src={photo} alt="Your diagram" />
      <figcaption>Your diagram</figcaption>
    </figure>
  );
}

/** The caption under our circuit diagram, shown only beside her photo. */
export function WiredCaption({ photo }: { photo: string | null | undefined }): ReactNode {
  return photo ? <span className="qp-wired">The bench is wired to this</span> : null;
}
