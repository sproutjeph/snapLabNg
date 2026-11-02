import { Beaker } from "./Beaker";
import { Burette } from "./Burette";
import { ConicalFlask } from "./ConicalFlask";
import { BEAKER_DIMS, BURETTE_DIMS, FLASK_DIMS, TITRATION_LAYOUT } from "./dimensions";
import { Funnel } from "./Funnel";
import { GlassGlints } from "./GlassGlints";
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

      {/* Window reflections on the glass, so it reads as glass on the paper ground */}
      <GlassGlints
        quality={quality}
        rTop={FLASK_DIMS.neckRadius}
        rBottom={FLASK_DIMS.baseRadius}
        height={FLASK_DIMS.bodyHeight}
        position={[0, FLASK_DIMS.baseY, 0]}
      />
      <GlassGlints
        quality={quality}
        rTop={BURETTE_DIMS.outerRadius}
        rBottom={BURETTE_DIMS.outerRadius}
        height={BURETTE_DIMS.topY - BURETTE_DIMS.tubeBottomY}
        position={[0, BURETTE_DIMS.tubeBottomY, 0]}
        theta={0.7}
      />
      <GlassGlints
        quality={quality}
        rTop={BEAKER_DIMS.radius}
        rBottom={BEAKER_DIMS.radius}
        height={BEAKER_DIMS.height}
        position={TITRATION_LAYOUT.beakerPos}
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
