import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { cmToX } from "../meter-bridge/dimensions";
import { jitterColour, mergeAll, placeAt, seeded } from "./LeadParts";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { TerminalNut } from "./TerminalNut";
import {
  makeLetterTexture,
  makeRuleTexture,
  makeWoodTexture,
  RULE_DEPTH_M,
  RULE_MARGIN_M,
  repaintWhenFontReady,
} from "./WireBoardTextures";

export interface WireBoardProps extends PartProps {
  /** From the engine's params: the bare wire runs from startCm to startCm + lengthCm on the rule. */
  wire: { lengthCm: number; startCm: number };
  /** Tap the metre rule to open the ruler loupe (step 1). */
  onRuleTap?: () => void;
}

// Sizes in metres, local to the board: x along it (0 = the 50 cm mark of the rule), y up from
// the desk, z toward the student.
const BOARD = { length: 1.1, height: 0.02, depth: 0.12 } as const;
const RULE = {
  length: 1 + 2 * RULE_MARGIN_M,
  thickness: 0.003,
  depth: RULE_DEPTH_M,
  z: 0.019,
} as const;
const STRIP = { width: 0.02, height: 0.012, depth: 0.03 } as const;
const WIRE = { z: -0.015, radius: 0.0008, y: BOARD.height + 0.007 } as const;
const NUT_Y = BOARD.height + STRIP.height;

/**
 * The constantan wire XY stretched on a wooden board, brass strips and terminals at X and Y,
 * a metre rule fixed alongside (cm and mm marks). X is at startCm, Y at startCm + lengthCm.
 * The wire is drawn a little thicker than a real 0.376 mm wire so it shows from across the bench.
 */
export function WireBoard({
  state,
  quality,
  position,
  rotationY = 0,
  wire,
  onRuleTap,
}: WireBoardProps) {
  const xX = cmToX(wire.startCm);
  const xY = cmToX(wire.startCm + wire.lengthCm);
  const low = quality === "low";

  const res = useMemo(() => {
    const rng = seeded(0x5ee1);
    const seg = low ? 8 : 14;
    const woodTex = makeWoodTexture(rng, quality);
    const ruleTex = makeRuleTexture();
    const letterX = makeLetterTexture("X");
    const letterY = makeLetterTexture("Y");
    const screws = mergeAll(
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) =>
          placeAt(
            new THREE.CylinderGeometry(0.0035, 0.0035, 0.0018, seg),
            sx * 0.53,
            BOARD.height + 0.0009,
            sz * 0.045,
          ),
        ),
      ),
    );
    const strips = mergeAll(
      [xX, xY].map((x) =>
        placeAt(
          new THREE.BoxGeometry(STRIP.width, STRIP.height, STRIP.depth),
          x,
          BOARD.height + STRIP.height / 2,
          WIRE.z,
        ),
      ),
    );
    const wireLen = Math.abs(xY - xX);
    const wireGeo = new THREE.CylinderGeometry(WIRE.radius, WIRE.radius, wireLen, low ? 5 : 8);
    wireGeo.rotateZ(Math.PI / 2);
    wireGeo.translate((xX + xY) / 2, WIRE.y, WIRE.z);
    const letterGeo = new THREE.PlaneGeometry(0.016, 0.016);
    letterGeo.rotateX(-Math.PI / 2);
    return {
      woodTex,
      ruleTex,
      letterX,
      letterY,
      board: new THREE.BoxGeometry(BOARD.length, BOARD.height, BOARD.depth),
      rule: new THREE.BoxGeometry(RULE.length, RULE.thickness, RULE.depth),
      ruleHit: new THREE.BoxGeometry(RULE.length, 0.008, 0.05),
      strips,
      screws,
      wireGeo,
      letterGeo,
      boardMat: new THREE.MeshStandardMaterial({
        map: woodTex,
        color: jitterColour("#ffffff", rng, 0.02),
        roughness: 0.85,
      }),
      ruleMat: new THREE.MeshStandardMaterial({ map: ruleTex, roughness: 0.8 }),
      brassMat: new THREE.MeshStandardMaterial({
        color: jitterColour("#b08d3c", rng),
        roughness: 0.6,
        metalness: 0.2,
      }),
      wireMat: new THREE.MeshStandardMaterial({
        color: jitterColour("#9b9a94", rng),
        roughness: 0.6,
        metalness: 0.3,
      }),
      letterXMat: new THREE.MeshBasicMaterial({ map: letterX, transparent: true }),
      letterYMat: new THREE.MeshBasicMaterial({ map: letterY, transparent: true }),
      hitMat: new THREE.MeshBasicMaterial(),
    };
  }, [quality, low, xX, xY]);
  useEffect(() => repaintWhenFontReady([res.ruleTex, res.letterX, res.letterY]), [res]);
  useEffect(
    () => () => {
      for (const v of Object.values(res)) v.dispose();
    },
    [res],
  );

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={INK_IDS.wire}>
        <mesh
          geometry={res.board}
          material={res.boardMat}
          position={[0, BOARD.height / 2, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={res.letterGeo}
          material={res.letterXMat}
          position={[xX, BOARD.height + 0.0004, -0.047]}
        />
        <mesh
          geometry={res.letterGeo}
          material={res.letterYMat}
          position={[xY, BOARD.height + 0.0004, -0.047]}
        />
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 1}>
        <mesh
          geometry={res.rule}
          material={res.ruleMat}
          position={[0, BOARD.height + RULE.thickness / 2, RULE.z]}
          castShadow
          receiveShadow
        />
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 2}>
        <mesh geometry={res.strips} material={res.brassMat} castShadow receiveShadow />
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 3} thin>
        <mesh geometry={res.wireGeo} material={res.wireMat} castShadow />
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 4} thin>
        <mesh geometry={res.screws} material={res.brassMat} castShadow />
      </InkGroup>
      <mesh
        geometry={res.ruleHit}
        material={res.hitMat}
        position={[0, BOARD.height + 0.005, RULE.z]}
        visible={false}
        onPointerDown={tapOnly(onRuleTap)}
      />
      <TerminalNut
        id="X"
        part="wire"
        position={[xX, NUT_Y, WIRE.z]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="Y"
        part="wire"
        position={[xY, NUT_Y, WIRE.z]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
