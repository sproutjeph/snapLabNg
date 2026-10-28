import type { QualityTier } from "../../apparatus/meter-bridge/types";

export interface InkLightsProps {
  quality: QualityTier;
}

/**
 * The shared lighting and background for the ink look: a soft-shadow sun, a RoomEnvironment
 * PMREM at 0.04 and a paper-toned fill (docs/plans/ink-look.md). STUB (Wave 0): a plain
 * hemisphere and sun so previews are lit; the ink slice fills it in. Props frozen.
 */
export function InkLights({ quality }: InkLightsProps) {
  return (
    <>
      <color attach="background" args={["#f4ecdc"]} />
      <hemisphereLight args={["#fffaf0", "#b9ab90", 0.9]} />
      <directionalLight
        position={[1.2, 2.2, 1.4]}
        intensity={2}
        castShadow={quality !== "low"}
        shadow-mapSize={[1024, 1024]}
      />
    </>
  );
}
