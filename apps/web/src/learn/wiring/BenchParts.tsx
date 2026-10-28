import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { CellHolder } from "../../apparatus/ohms-law/CellHolder";
import { KeyK } from "../../apparatus/ohms-law/Key";
import { OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { Meter } from "../../apparatus/ohms-law/Meter";
import { ResistanceBox } from "../../apparatus/ohms-law/ResistanceBox";
import { Tray } from "../../apparatus/ohms-law/Tray";
import { WireBoard } from "../../apparatus/ohms-law/WireBoard";
import type { OhmsLawBench } from "../types";

/**
 * Every V–I part on the bench, placed by OHMS_LAW_LAYOUT (as apparatus/ohms-law/KitPreview
 * mounts them) and wired to the controller: the key's plug toggles K, a box plug toggles that
 * coil. Inside a <TerminalProvider>, beside <BenchWiring>.
 */
export function BenchParts({ bench, quality }: { bench: OhmsLawBench; quality: QualityTier }) {
  const L = OHMS_LAW_LAYOUT;
  const p = bench.params;
  const common = { state: bench.visual, quality };
  return (
    <>
      <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />
      <KeyK
        {...common}
        position={L.key.position}
        rotationY={L.key.rotationY}
        onToggle={() => bench.toggleKey()}
      />
      <Meter
        {...common}
        kind="ammeter"
        fullScale={p.ammeter.fullScale}
        division={p.ammeter.division}
        position={L.ammeter.position}
        rotationY={L.ammeter.rotationY}
      />
      <Meter
        {...common}
        kind="voltmeter"
        fullScale={p.voltmeter.fullScale}
        division={p.voltmeter.division}
        position={L.voltmeter.position}
        rotationY={L.voltmeter.rotationY}
      />
      <ResistanceBox
        {...common}
        coilsOhm={p.boxCoilsOhm}
        position={L.box.position}
        rotationY={L.box.rotationY}
        onPlugToggle={(i) => bench.togglePlug(i)}
      />
      <WireBoard
        {...common}
        wire={p.wire}
        position={L.wire.position}
        rotationY={L.wire.rotationY}
      />
      <Tray {...common} position={L.tray.position} rotationY={L.tray.rotationY} />
    </>
  );
}
