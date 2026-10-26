export type QualityTier = "low" | "mid" | "high";

/** Written by the engine loop every step, read by the kit inside useFrame. Never React state. */
export interface MeterBridgeVisualState {
  jockeyCm: number; // 0–100, position along the wire from end A
  jockeyDown: boolean; // true while the knife-edge touches the wire
  needleDeg: number; // galvanometer needle angle; 0 = centre, ±45 = against the stops
  plugsIn: boolean[]; // same order as plugLabels; true = plug in (that coil shorted)
  keyClosed: boolean;
  scrapesCm: Array<[number, number]>; // dragged segments to draw as scratches, [fromCm, toCm]
}

export interface MeterBridgeKitProps {
  state: { current: MeterBridgeVisualState }; // a ref, mutated in place
  plugLabels: string[]; // e.g. ["1", "2", "2", "5", "10"], drawn on the box as Ω values
  unknownLabel: string; // label on the right gap, e.g. "X"
  quality: QualityTier;
  onWireTap?: (cm: number) => void; // pointer down and up on the wire with < 4 px movement
  onWireDrag?: (fromCm: number, toCm: number) => void; // pointer moved along the wire while down
  onPlugToggle?: (index: number) => void;
  onKeyToggle?: () => void;
}
