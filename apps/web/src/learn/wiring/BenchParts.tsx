import type { ReactNode } from "react";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { CellHolder } from "../../apparatus/ohms-law/CellHolder";
import { KeyK } from "../../apparatus/ohms-law/Key";
import { OHMS_LAW_LAYOUT, tapOnly } from "../../apparatus/ohms-law/layout";
import { Meter } from "../../apparatus/ohms-law/Meter";
import { ResistanceBox } from "../../apparatus/ohms-law/ResistanceBox";
import { Tray, type TrayItem } from "../../apparatus/ohms-law/Tray";
import { WireBoard } from "../../apparatus/ohms-law/WireBoard";
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
      {body(
        "cells",
        <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />,
      )}
      {body(
        "key",
        <KeyK
          {...common}
          position={L.key.position}
          rotationY={L.key.rotationY}
          onToggle={() => bench.toggleKey()}
        />,
      )}
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
      {body(
        "box",
        <ResistanceBox
          {...common}
          coilsOhm={p.boxCoilsOhm}
          position={L.box.position}
          rotationY={L.box.rotationY}
          onPlugToggle={(i) => bench.togglePlug(i)}
        />,
      )}
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
      <Tray
        {...common}
        position={L.tray.position}
        rotationY={L.tray.rotationY}
        onItemTap={(item) => {
          onTrayItem?.(item);
          onPartTap?.(item);
        }}
      />
    </>
  );
}
