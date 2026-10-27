import type { QualityTier } from "../meter-bridge/types";

/** Written by the engine loop, read by the kit inside useFrame. Never React state. */
export interface TitrationVisualState {
  buretteReadingCm3: number; // reading at the bottom of the meniscus, 0 (top) … 50
  stopcockOpen: number; // 0 closed … 1 fully open
  dropping: boolean; // a drop is falling from the jet now
  flaskVolumeCm3: number; // liquid in the conical flask, 0 … 250
  flaskColor: [number, number, number]; // linear RGB 0–1, written by the engine
  swirlPhase: number; // 0 … 1 while swirling, 0 at rest
  funnelOn: boolean;
}

export interface TitrationKitProps {
  state: { current: TitrationVisualState }; // a ref, mutated in place
  quality: QualityTier;
  onStopcockChange?: (open: number) => void; // press-and-hold or drag on the stopcock, 0…1
  onSwirl?: () => void; // tap on the flask
  onFunnelToggle?: () => void; // tap on the funnel or the burette top
}
