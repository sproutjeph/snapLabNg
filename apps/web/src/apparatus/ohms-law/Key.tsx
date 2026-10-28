import { type PartProps, tapOnly } from "./layout";
import { StubBlock } from "./StubBlock";
import { TerminalNut } from "./TerminalNut";

export interface KeyKProps extends PartProps {
  /** Tap the plug to put it in (key closed) or take it out. */
  onToggle?: () => void;
}

/**
 * The plug key K, terminals K1 and K2; open or closed from `state.current.keyClosed`.
 * May wrap the metre bridge's PlugKey. STUB (Wave 0); props frozen.
 */
export function KeyK({ state, quality, position, rotationY = 0, onToggle }: KeyKProps) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <group onPointerDown={tapOnly(onToggle)}>
        <StubBlock size={[0.08, 0.02, 0.05]} colour="#2a2a2a" />
      </group>
      <TerminalNut
        id="K1"
        part="key"
        position={[0.03, 0.02, 0.012]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="K2"
        part="key"
        position={[-0.03, 0.02, 0.012]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
