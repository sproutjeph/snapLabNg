import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  BENCH_LAYOUT,
  BRIDGE_WIRE,
  GALVANOMETER_DIMS,
  JOCKEY_DIMS,
  LECLANCHE_DIMS,
  PLUG_BOX_DIMS,
  PLUG_KEY_DIMS,
  TERMINAL_SCREW,
  UNKNOWN_RESISTOR_DIMS,
} from "./dimensions";
import { Galvanometer } from "./Galvanometer";
import { LeclancheCell } from "./LeclancheCell";
import { BRIDGE_TERMINAL_POSITIONS, MeterBridge } from "./MeterBridge";
import { PlugBox } from "./PlugBox";
import { PlugKey } from "./PlugKey";
import { TubeWire } from "./TubeWire";
import type { MeterBridgeKitProps, QualityTier } from "./types";

function createUnknownResistorTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f5ebd1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    ctx.fillStyle = "#18181b";
    ctx.font = "bold 64px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label || "X", canvas.width / 2, canvas.height / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface UnknownResistorProps {
  label: string;
  quality: QualityTier;
  position: readonly [number, number, number];
}

function UnknownResistor({ label, quality, position }: UnknownResistorProps) {
  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 10 : 20;
    const baseGeo = new THREE.BoxGeometry(0.08, 0.014, 0.044);
    const bobbinGeo = new THREE.CylinderGeometry(
      UNKNOWN_RESISTOR_DIMS.bobbinRadius,
      UNKNOWN_RESISTOR_DIMS.bobbinRadius,
      UNKNOWN_RESISTOR_DIMS.bobbinLength,
      radialSegments,
    );
    bobbinGeo.rotateZ(Math.PI / 2);

    const flangeGeo = new THREE.CylinderGeometry(
      UNKNOWN_RESISTOR_DIMS.flangeRadius,
      UNKNOWN_RESISTOR_DIMS.flangeRadius,
      UNKNOWN_RESISTOR_DIMS.flangeThickness,
      radialSegments,
    );
    flangeGeo.rotateZ(Math.PI / 2);

    const terminalPostGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.postRadius,
      TERMINAL_SCREW.baseRadius,
      TERMINAL_SCREW.postHeight,
      radialSegments,
    );
    const terminalCapGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capHeight,
      radialSegments,
    );
    const tagGeo = new THREE.PlaneGeometry(0.032, 0.016);

    const eboniteMat = new THREE.MeshStandardMaterial({
      color: "#1c1917",
      roughness: 0.4,
      metalness: 0.08,
    });
    const windingMat = new THREE.MeshStandardMaterial({
      color: "#7c2d12",
      roughness: 0.52,
      metalness: 0.25,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
    });

    return {
      baseGeo,
      bobbinGeo,
      flangeGeo,
      terminalPostGeo,
      terminalCapGeo,
      tagGeo,
      eboniteMat,
      windingMat,
      brassMat,
    };
  }, [quality]);

  const tagRes = useMemo(() => {
    const tex = createUnknownResistorTexture(label);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    return { tex, mat };
  }, [label]);

  useEffect(() => {
    return () => {
      tagRes.tex.dispose();
      tagRes.mat.dispose();
    };
  }, [tagRes]);

  useEffect(() => {
    return () => {
      res.baseGeo.dispose();
      res.bobbinGeo.dispose();
      res.flangeGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalCapGeo.dispose();
      res.tagGeo.dispose();
      res.eboniteMat.dispose();
      res.windingMat.dispose();
      res.brassMat.dispose();
    };
  }, [res]);

  const bobbinY = 0.014 + UNKNOWN_RESISTOR_DIMS.flangeRadius;

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh
        geometry={res.baseGeo}
        material={res.eboniteMat}
        position={[0, 0.007, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={res.bobbinGeo}
        material={res.windingMat}
        position={[0, bobbinY, 0]}
        castShadow
      />
      <mesh
        geometry={res.flangeGeo}
        material={res.brassMat}
        position={[-UNKNOWN_RESISTOR_DIMS.bobbinLength / 2, bobbinY, 0]}
        castShadow
      />
      <mesh
        geometry={res.flangeGeo}
        material={res.brassMat}
        position={[UNKNOWN_RESISTOR_DIMS.bobbinLength / 2, bobbinY, 0]}
        castShadow
      />
      <mesh
        geometry={res.tagGeo}
        material={tagRes.mat}
        position={[0, bobbinY + UNKNOWN_RESISTOR_DIMS.bobbinRadius + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[-0.03, 0.014 + TERMINAL_SCREW.postHeight / 2, 0.012]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[-0.03, 0.014 + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2, 0.012]}
        castShadow
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[0.03, 0.014 + TERMINAL_SCREW.postHeight / 2, 0.012]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[0.03, 0.014 + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2, 0.012]}
        castShadow
      />
    </group>
  );
}

export default function MeterBridgeKit({
  state,
  plugLabels,
  unknownLabel,
  quality,
  onWireTap,
  onWireDrag,
  onPlugToggle,
  onKeyToggle,
}: MeterBridgeKitProps) {
  const termTopOffset = TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight * 0.5;

  // Terminal world anchor coordinates for the connecting leads
  const anchors = useMemo(() => {
    const bridgeA = [
      BRIDGE_TERMINAL_POSITIONS.A[0],
      BRIDGE_TERMINAL_POSITIONS.A[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.A[2],
    ] as const;
    const bridgeC = [
      BRIDGE_TERMINAL_POSITIONS.C[0],
      BRIDGE_TERMINAL_POSITIONS.C[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.C[2],
    ] as const;
    const bridgeB = [
      BRIDGE_TERMINAL_POSITIONS.B[0],
      BRIDGE_TERMINAL_POSITIONS.B[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.B[2],
    ] as const;
    const leftGapL = [
      BRIDGE_TERMINAL_POSITIONS.leftGapLeft[0],
      BRIDGE_TERMINAL_POSITIONS.leftGapLeft[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.leftGapLeft[2],
    ] as const;
    const leftGapR = [
      BRIDGE_TERMINAL_POSITIONS.leftGapRight[0],
      BRIDGE_TERMINAL_POSITIONS.leftGapRight[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.leftGapRight[2],
    ] as const;
    const rightGapL = [
      BRIDGE_TERMINAL_POSITIONS.rightGapLeft[0],
      BRIDGE_TERMINAL_POSITIONS.rightGapLeft[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.rightGapLeft[2],
    ] as const;
    const rightGapR = [
      BRIDGE_TERMINAL_POSITIONS.rightGapRight[0],
      BRIDGE_TERMINAL_POSITIONS.rightGapRight[1] + termTopOffset,
      BRIDGE_TERMINAL_POSITIONS.rightGapRight[2],
    ] as const;

    const cellPos = BENCH_LAYOUT.cellPos;
    const cellPlus = [cellPos[0], LECLANCHE_DIMS.carbonHeight + 0.013, cellPos[2]] as const;
    const cellMinus = [
      cellPos[0] + LECLANCHE_DIMS.zincOffsetX,
      LECLANCHE_DIMS.zincHeight + 0.007,
      cellPos[2] + 0.01,
    ] as const;

    const keyPos = BENCH_LAYOUT.plugKeyPos;
    const keyTermOffsetX = PLUG_KEY_DIMS.gap / 2 + PLUG_KEY_DIMS.blockWidth / 2 + 0.005;
    const keyTermY = PLUG_KEY_DIMS.height + PLUG_KEY_DIMS.blockHeight + termTopOffset;
    const keyLeft = [keyPos[0] - keyTermOffsetX, keyTermY, keyPos[2]] as const;
    const keyRight = [keyPos[0] + keyTermOffsetX, keyTermY, keyPos[2]] as const;

    const boxPos = BENCH_LAYOUT.plugBoxPos;
    const boxTermOffsetX = PLUG_BOX_DIMS.width / 2 - 0.014;
    const boxTermY = PLUG_BOX_DIMS.height + PLUG_BOX_DIMS.blockHeight + termTopOffset;
    const boxLeft = [boxPos[0] - boxTermOffsetX, boxTermY, boxPos[2] - 0.006] as const;
    const boxRight = [boxPos[0] + boxTermOffsetX, boxTermY, boxPos[2] - 0.006] as const;

    const unkPos = BENCH_LAYOUT.unknownPos;
    const unkTermY = 0.014 + termTopOffset;
    const unkLeft = [unkPos[0] - 0.03, unkTermY, unkPos[2] + 0.012] as const;
    const unkRight = [unkPos[0] + 0.03, unkTermY, unkPos[2] + 0.012] as const;

    const galvPos = BENCH_LAYOUT.galvanometerPos;
    const galvTermY = GALVANOMETER_DIMS.height * 0.45;
    const galvTermZ = galvPos[2] + GALVANOMETER_DIMS.radius + 0.008;
    const galvLeft = [galvPos[0] - 0.036, galvTermY, galvTermZ] as const;
    const galvRight = [galvPos[0] + 0.036, galvTermY, galvTermZ] as const;

    const jockeyNominalTop = [
      0,
      BRIDGE_WIRE.y +
        BRIDGE_WIRE.renderRadius +
        JOCKEY_DIMS.bladeHeight +
        JOCKEY_DIMS.collarHeight +
        JOCKEY_DIMS.handleHeight +
        0.008,
      BRIDGE_WIRE.z,
    ] as const;

    return {
      bridgeA,
      bridgeC,
      bridgeB,
      leftGapL,
      leftGapR,
      rightGapL,
      rightGapR,
      cellPlus,
      cellMinus,
      keyLeft,
      keyRight,
      boxLeft,
      boxRight,
      unkLeft,
      unkRight,
      galvLeft,
      galvRight,
      jockeyNominalTop,
    };
  }, [termTopOffset]);

  return (
    <group>
      {/* 100 cm Metre bridge with constantan wire, copper strips, rule and jockey */}
      <MeterBridge
        state={state}
        unknownLabel={unknownLabel}
        quality={quality}
        onWireTap={onWireTap}
        onWireDrag={onWireDrag}
      />

      {/* Brass plug resistance box R in the left gap */}
      <PlugBox
        state={state}
        plugLabels={plugLabels}
        quality={quality}
        position={BENCH_LAYOUT.plugBoxPos}
        onPlugToggle={onPlugToggle}
      />

      {/* Unknown resistance coil X in the right gap */}
      <UnknownResistor label={unknownLabel} quality={quality} position={BENCH_LAYOUT.unknownPos} />

      {/* Centre-zero galvanometer G */}
      <Galvanometer state={state} quality={quality} position={BENCH_LAYOUT.galvanometerPos} />

      {/* Leclanché cell E */}
      <LeclancheCell quality={quality} position={BENCH_LAYOUT.cellPos} />

      {/* Plug key K */}
      <PlugKey
        state={state}
        quality={quality}
        position={BENCH_LAYOUT.plugKeyPos}
        onKeyToggle={onKeyToggle}
      />

      {/* Connecting tube wires (docs/07 §4.1 topology) */}
      {/* Cell (+) to End A */}
      <TubeWire
        start={anchors.cellPlus}
        via={[
          [-0.56, 0.09, -0.14],
          [-0.56, 0.03, -0.02],
        ]}
        end={anchors.bridgeA}
        color="#b91c1c"
        quality={quality}
      />

      {/* Cell (-) to Plug Key left terminal (routed behind bench apparatus) */}
      <TubeWire
        start={anchors.cellMinus}
        via={[
          [-0.48, 0.06, -0.29],
          [0, 0.006, -0.31],
          [0.36, 0.015, -0.27],
        ]}
        end={anchors.keyLeft}
        color="#1e293b"
        quality={quality}
      />

      {/* Plug Key right terminal to End C */}
      <TubeWire
        start={anchors.keyRight}
        via={[
          [0.56, 0.028, -0.11],
          [0.56, 0.024, -0.01],
        ]}
        end={anchors.bridgeC}
        color="#1e293b"
        quality={quality}
      />

      {/* Plug Box R across the left gap */}
      <TubeWire
        start={anchors.boxLeft}
        via={[[-0.31, 0.05, -0.11]]}
        end={anchors.leftGapL}
        color="#92400e"
        quality={quality}
      />
      <TubeWire
        start={anchors.boxRight}
        via={[[-0.17, 0.05, -0.11]]}
        end={anchors.leftGapR}
        color="#92400e"
        quality={quality}
      />

      {/* Unknown resistor X across the right gap */}
      <TubeWire
        start={anchors.unkLeft}
        via={[[0.2, 0.03, -0.09]]}
        end={anchors.rightGapL}
        color="#92400e"
        quality={quality}
      />
      <TubeWire
        start={anchors.unkRight}
        via={[[0.28, 0.03, -0.09]]}
        end={anchors.rightGapR}
        color="#92400e"
        quality={quality}
      />

      {/* Galvanometer from central junction B to the jockey J */}
      <TubeWire
        start={anchors.galvLeft}
        via={[[-0.02, 0.035, -0.1]]}
        end={anchors.bridgeB}
        color="#1d4ed8"
        quality={quality}
      />
      <TubeWire
        start={anchors.galvRight}
        end={anchors.jockeyNominalTop}
        color="#1d4ed8"
        quality={quality}
        followJockeyState={state}
      />
    </group>
  );
}
