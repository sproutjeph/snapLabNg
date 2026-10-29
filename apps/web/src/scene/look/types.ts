import type { MutableRefObject } from "react";

// The look recipe's seams (docs/plans/exam-redesign.md, "The look" and "Contracts").
// FROZEN for Waves 1–2: slices code against these and never change them; ask the lead.

/** A framing of the bench: what to look at and how much of it must fit. */
export interface LookShot {
  id: string;
  /** World point the shot centres on, in metres. */
  focus: readonly [number, number, number];
  /** Width of bench, in metres, that must fit the uncovered part of the canvas. */
  spanM: number;
  azimuthDeg?: number;
}

/** How much of the canvas DOM UI covers on each side, in CSS px; the shot fits the rest. */
export interface Covered {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LookCameraProps {
  shot: LookShot;
  covered: Covered;
  /** Lets her orbit a little; the camera eases back to the shot when she lets go. */
  drag?: boolean;
  reducedMotion?: boolean;
}

export interface LookLightsProps {
  /** Set true when something moved, so the next frame re-renders the shadow map. */
  shadowsDirty: MutableRefObject<boolean>;
}

export interface LookGroundProps {
  /** Side of the paper ground, in metres. */
  sizeM?: number;
}

export interface BlobShadowProps {
  position: readonly [number, number, number];
  radiusM: number;
  opacity?: number;
}

/** Which ink ids stay in full ink; the rest fade back. */
export interface InkFocus {
  /** null: everything in focus. */
  ids: ReadonlySet<number> | null;
}
