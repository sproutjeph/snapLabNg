import { type PartProps, tapOnly } from "./layout";
import { StubBlock } from "./StubBlock";
import { TerminalNut } from "./TerminalNut";

export interface MeterProps extends PartProps {
  kind: "ammeter" | "voltmeter";
  /** Painted on the dial, from the engine's params (A or V). */
  fullScale: number;
  division: number;
  /** Tap the face to open the scale loupe. */
  onTap?: () => void;
  /** Tap the zero-adjust screw (SHOULD). */
  onZeroScrewTap?: () => void;
}

/**
 * A d.c. moving-coil meter: dial, mirror strip, needle, zero-adjust screw, red + and black −
 * terminals (A+/A− or V+/V−). The needle angle is `state.current.readout.ammeterDeg` or
 * `voltmeterDeg` (METER_ZERO_DEG … METER_FULL_DEG from @snaplab/engine). STUB (Wave 0); props frozen.
 */
// Black − on the left, red + on the right, as on the usual school meters.
const PLUS_X = 0.035;

export function Meter({ kind, state, quality, position, rotationY = 0, onTap }: MeterProps) {
  const plus = kind === "ammeter" ? "A+" : "V+";
  const minus = kind === "ammeter" ? "A-" : "V-";
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <group onPointerDown={tapOnly(onTap)}>
        <StubBlock size={[0.12, 0.1, 0.06]} colour={kind === "ammeter" ? "#3b3f46" : "#464b3b"} />
      </group>
      <TerminalNut
        id={plus}
        part={kind}
        position={[PLUS_X, 0, 0.045]}
        state={state}
        quality={quality}
        cap="red"
      />
      <TerminalNut
        id={minus}
        part={kind}
        position={[-PLUS_X, 0, 0.045]}
        state={state}
        quality={quality}
        cap="black"
      />
    </group>
  );
}
