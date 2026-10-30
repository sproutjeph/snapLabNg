import { useFrame } from "@react-three/fiber";
import { type ReactNode, useRef } from "react";
import type * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { CellHolder } from "../../apparatus/ohms-law/CellHolder";
import { KeyK } from "../../apparatus/ohms-law/Key";
import { OHMS_LAW_LAYOUT, tapOnly } from "../../apparatus/ohms-law/layout";
import { Meter } from "../../apparatus/ohms-law/Meter";
import { ResistanceBox } from "../../apparatus/ohms-law/ResistanceBox";
import { Tray, type TrayItem } from "../../apparatus/ohms-law/Tray";
import { WireBoard } from "../../apparatus/ohms-law/WireBoard";
import type { DropPose, DropSlot } from "../stage/motion";
import type { OhmsLawBench, PartId } from "../types";

export type MeterKind = "ammeter" | "voltmeter";

export interface BenchPartsProps {
  bench: OhmsLawBench;
  quality: QualityTier;
  /**
   * A part was tapped (Identify mode, callouts). Meters and tray items report here too; for
   * the cells, key, box and wire board it is a tap on the body (their nuts, plugs and rule keep
   * their own taps).
   */
  onPartTap?: (part: PartId) => void;
  /** A meter's face was tapped (the scale loupe). */
  onMeterTap?: (kind: MeterKind) => void;
  /** A meter's zero-adjust screw was tapped. */
  onZeroScrew?: (kind: MeterKind) => void;
  /** The metre rule beside XY was tapped (the ruler loupe). */
  onRuleTap?: () => void;
  /** An item on the tray was tapped. */
  onTrayItem?: (item: TrayItem) => void;
  /** Draw the tray (default true). The live stage leaves it out: it holds Identify items only. */
  tray?: boolean;
  /**
   * Watch's entrance (learn/stage/Choreo.tsx): each part's height above its place and whether it
   * has started to drop (k > 0), read every frame. Without it every part stands in its place.
   */
  drops?: Readonly<Record<DropSlot, DropPose>>;
  /** False on the demonstration bench: the key and the plugs ignore her taps (default true). */
  interactive?: boolean;
}

/** A part's group, lifted and shown by its drop (Watch's entrance). */
function Drop({
  slot,
  drops,
  children,
}: {
  slot: DropSlot;
  drops: Readonly<Record<DropSlot, DropPose>> | undefined;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const group = g.current;
    const pose = drops?.[slot];
    if (!group || !pose) return;
    group.visible = pose.k > 0;
    group.position.y = pose.heightM;
  });
  return <group ref={g}>{children}</group>;
}

/**
 * Every V–I part on the bench, placed by OHMS_LAW_LAYOUT (as apparatus/ohms-law/KitPreview
 * mounts them) and wired to the controller: the key's plug toggles K, a box plug toggles that
 * coil. The optional handlers let the lesson page add loupes and Identify without forking.
 * Inside a <TerminalProvider>, beside <BenchWiring>.
 */
export function BenchParts({
  bench,
  quality,
  onPartTap,
  onMeterTap,
  onZeroScrew,
  onRuleTap,
  onTrayItem,
  tray = true,
  drops,
  interactive = true,
}: BenchPartsProps) {
  const L = OHMS_LAW_LAYOUT;
  const p = bench.params;
  const common = { state: bench.visual, quality };
  /** A tap on the part's body reports the part; with no handler, the tap goes on to the desk. */
  const body = (part: PartId, children: ReactNode) => (
    <group {...(onPartTap ? { onPointerDown: tapOnly(() => onPartTap(part)) } : {})}>
      {children}
    </group>
  );
  // The meters, rule and tray take their own taps whether or not a handler is set (tapOnly),
  // so these always pass a function and call the optional handlers inside.
  const meterTap = (kind: MeterKind) => () => {
    onMeterTap?.(kind);
    onPartTap?.(kind);
  };
  const screwTap = (kind: MeterKind) => () => onZeroScrew?.(kind);
  return (
    <>
      <Drop slot="cells" drops={drops}>
        {body(
          "cells",
          <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />,
        )}
      </Drop>
      <Drop slot="key" drops={drops}>
        {body(
          "key",
          <KeyK
            {...common}
            position={L.key.position}
            rotationY={L.key.rotationY}
            onToggle={() => {
              if (interactive) bench.toggleKey();
            }}
          />,
        )}
      </Drop>
      <Drop slot="ammeter" drops={drops}>
        <Meter
          {...common}
          kind="ammeter"
          fullScale={p.ammeter.fullScale}
          division={p.ammeter.division}
          position={L.ammeter.position}
          rotationY={L.ammeter.rotationY}
          onTap={meterTap("ammeter")}
          onZeroScrewTap={screwTap("ammeter")}
        />
      </Drop>
      <Drop slot="voltmeter" drops={drops}>
        <Meter
          {...common}
          kind="voltmeter"
          fullScale={p.voltmeter.fullScale}
          division={p.voltmeter.division}
          position={L.voltmeter.position}
          rotationY={L.voltmeter.rotationY}
          onTap={meterTap("voltmeter")}
          onZeroScrewTap={screwTap("voltmeter")}
        />
      </Drop>
      <Drop slot="box" drops={drops}>
        {body(
          "box",
          <ResistanceBox
            {...common}
            coilsOhm={p.boxCoilsOhm}
            position={L.box.position}
            rotationY={L.box.rotationY}
            onPlugToggle={(i) => {
              if (interactive) bench.togglePlug(i);
            }}
          />,
        )}
      </Drop>
      <Drop slot="wire" drops={drops}>
        {body(
          "wire",
          <WireBoard
            {...common}
            wire={p.wire}
            position={L.wire.position}
            rotationY={L.wire.rotationY}
            onRuleTap={() => onRuleTap?.()}
          />,
        )}
      </Drop>
      {tray && (
        <Tray
          {...common}
          position={L.tray.position}
          rotationY={L.tray.rotationY}
          onItemTap={(item) => {
            onTrayItem?.(item);
            onPartTap?.(item);
          }}
        />
      )}
    </>
  );
}
