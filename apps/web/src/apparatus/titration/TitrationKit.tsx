import { Beaker } from "./Beaker";
import { Burette } from "./Burette";
import { ConicalFlask } from "./ConicalFlask";
import { TITRATION_LAYOUT } from "./dimensions";
import { Funnel } from "./Funnel";
import { Pipette } from "./Pipette";
import { RetortStand } from "./RetortStand";
import type { TitrationKitProps } from "./types";
import { WhiteTile } from "./WhiteTile";

export function TitrationKit({
  state,
  quality,
  onStopcockChange,
  onSwirl,
  onFunnelToggle,
}: TitrationKitProps) {
  return (
    <group>
      {/* Glazed white porcelain tile directly under the conical flask */}
      <WhiteTile position={TITRATION_LAYOUT.tilePos} />

      {/* Retort stand with heavy base, 0.90 m rod, bosshead and burette clamp */}
      <RetortStand quality={quality} />

      {/* 250 cm³ conical flask on the white tile */}
      <ConicalFlask
        state={state}
        quality={quality}
        position={TITRATION_LAYOUT.flaskPos}
        onSwirl={onSwirl}
      />

      {/* 50 cm³ burette with front graduations, meniscus, stopcock and jet tip ~2 cm inside flask mouth */}
      <Burette
        state={state}
        quality={quality}
        onStopcockChange={onStopcockChange}
        onFunnelToggle={onFunnelToggle}
      />

      {/* Filter funnel in the top of the burette (visible when state.current.funnelOn is true) */}
      <Funnel state={state} quality={quality} onFunnelToggle={onFunnelToggle} />

      {/* 25 cm³ bulb pipette lying on bench cradles to the right */}
      <Pipette quality={quality} position={TITRATION_LAYOUT.pipettePos} />

      {/* 250 cm³ glass beaker to the left */}
      <Beaker quality={quality} position={TITRATION_LAYOUT.beakerPos} />
    </group>
  );
}

export default TitrationKit;
