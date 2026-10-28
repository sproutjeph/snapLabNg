import type { PartProps } from "./layout";
import { StubBlock } from "./StubBlock";
import { TerminalNut } from "./TerminalNut";

export interface ResistanceBoxProps extends PartProps {
  /** Coils in plug order, from the engine's params; painted on the box. */
  coilsOhm: readonly number[];
  /** Tap a plug to pull it out (adds that coil) or push it in. */
  onPlugToggle?: (index: number) => void;
}

/**
 * The plug-type resistance box R, terminals R1 and R2; plugs from `state.current.plugsIn`.
 * Reuses the metre bridge's PlugBox (it reads only `plugsIn`, and takes a `width`).
 * STUB (Wave 0); props frozen.
 */
export function ResistanceBox({ state, quality, position, rotationY = 0 }: ResistanceBoxProps) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <StubBlock size={[0.26, 0.06, 0.1]} colour="#5b2f1f" />
      <TerminalNut id="R1" part="box" position={[0.118, 0.06, 0]} state={state} quality={quality} />
      <TerminalNut
        id="R2"
        part="box"
        position={[-0.118, 0.06, 0]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
