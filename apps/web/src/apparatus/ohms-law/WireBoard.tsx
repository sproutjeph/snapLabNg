import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  bevelBox,
  bevelSegments,
  boxProjectUV,
  brassSurface,
  disposeKitBag,
  mergePieces,
  paperMaterial,
  woodMaterial,
} from "../materials";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { TerminalNut } from "./TerminalNut";
import {
  makeBrassTexture,
  makeEndGrainTexture,
  makeLetterTexture,
  makePineBoardTexture,
  makeRuleSegmentTexture,
  RULE_DEPTH_M,
  RULE_EDGE_M,
  RULE_LENGTH_M,
  RULE_PRINT_DEPTH_M,
  repaintWhenFontReady,
  ruleSegments,
  wireEndX,
} from "./WireBoardTextures";

export interface WireBoardProps extends PartProps {
  /** From the engine's params: the bare wire runs from startCm to startCm + lengthCm on the rule. */
  wire: { lengthCm: number; startCm: number };
  /** Tap the metre rule to open the ruler loupe (step 1). */
  onRuleTap?: () => void;
}

// Sizes in metres, local to the board: x along it (0 = the 50 cm mark of the rule), y up from
// the desk, z toward the student. The board's size, the rule's top (0.023) and its back edge
// (0.0035), the blocks' height (the nuts stand at 0.034) and the wire's z are fixed by the layout,
// the footprints and the loupe's pose (learn/readings/poses.ts); only the look of them changes.
const BOARD = { length: 1.1, height: 0.02, depth: 0.12 } as const;
const BOARD_BEVEL = 0.005;
/** The metre rule: a cream strip a little proud of the board, its back edge 1.5 mm in front of the blocks. */
const RULE = { length: RULE_LENGTH_M, thickness: 0.003, depth: RULE_DEPTH_M, z: 0.0265 } as const;
/** The tap box over the rule: as it was, so a tap lands where it always did. */
const RULE_HIT = { height: 0.008, depth: 0.05, y: BOARD.height + 0.005, z: 0.019 } as const;
const WIRE = { z: -0.015, radius: 0.0012, y: BOARD.height + 0.007 } as const;
/**
 * The brass end blocks the wire is clamped in; the terminal nuts stand on them. A block reaches
 * `dz` behind the wire's line, so it is deeper (4.2 cm) while its face stays 1.5 mm clear of the rule.
 */
const BLOCK = { width: 0.044, height: 0.014, depth: 0.042, dz: -0.004 } as const;
const BLOCK_Z = WIRE.z + BLOCK.dz;
const NUT_Y = BOARD.height + BLOCK.height;
/**
 * Where each letter is written on the board: 4.4 cm to the right of its block's nut, in the back
 * strip (z). Right is toward the camera of the bench and of every shot (az 0 to 90), so the block
 * and its nut never stand in front of the letter; X's falls between the blocks, Y's just past its own.
 */
const LETTER = { dx: 0.044, z: -0.0385, size: 0.05 } as const;
/** One tile of pine along the board (m): two tiles make the board, and the texture tiles across u. */
const PINE_TILE_M = 0.55;

/**
 * Pine with its end grain: u along the board, v across it; the sawn ends show the end-grain
 * texture, one whole texture on the 12 cm by 2 cm face. The geometry is centred on the origin.
 */
function boardUV(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = z / BOARD.depth + 0.5;
      v = y / BOARD.height + 0.5;
    } else if (ay >= az) {
      u = x / PINE_TILE_M;
      v = z / BOARD.depth + 0.5;
    } else {
      // The long edges show a slice of the same grain at the same scale, a different one front and back.
      u = x / PINE_TILE_M + (nor.getZ(i) < 0 ? 0.31 : 0);
      v = (nor.getZ(i) < 0 ? 0.3 : 0.62) + y / BOARD.depth;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // Two draws: the sawn ends (the first two faces of a box), then everything else.
  const total = pos.count;
  const ends = (geo.groups[0]?.count ?? 0) + (geo.groups[1]?.count ?? 0);
  geo.clearGroups();
  geo.addGroup(0, ends, 0);
  geo.addGroup(ends, total - ends, 1);
}

/**
 * The constantan wire XY stretched on a pale pine board between two chunky brass blocks, each
 * with a terminal nut and its letter, and a metre rule printed along the front (0 to 100 cm, ticks
 * at every mm). X is at startCm, Y at startCm + lengthCm. The wire is drawn thicker than a real
 * 0.376 mm wire so it shows from across the bench.
 */
export function WireBoard({
  state,
  quality,
  position,
  rotationY = 0,
  wire,
  onRuleTap,
}: WireBoardProps) {
  const xX = wireEndX(wire.startCm);
  const xY = wireEndX(wire.startCm + wire.lengthCm);
  const low = quality === "low";

  const res = useMemo(() => {
    const seg = low ? 8 : 16;
    const bs = bevelSegments(quality);
    const pineTex = makePineBoardTexture(quality);
    const endTex = makeEndGrainTexture(quality);
    const brassTex = makeBrassTexture(quality);
    const segments = ruleSegments(quality);
    const ruleTexes = segments.map((s) => makeRuleSegmentTexture(s.index, quality));
    const letterX = makeLetterTexture("X");
    const letterY = makeLetterTexture("Y");

    const board = bevelBox(BOARD.length, BOARD.height, BOARD.depth, BOARD_BEVEL, bs);
    boardUV(board);

    // The brass blocks, each with a collar where the wire goes in and a lock screw on its outer end.
    const outer = (x: number) => (x === xX ? -1 : 1);
    const blockPieces: THREE.BufferGeometry[] = [];
    for (const x of [xX, xY]) {
      const out = outer(x);
      // On the low tier the blocks are plain boxes (the ink pass still outlines them).
      const block = low
        ? new THREE.BoxGeometry(BLOCK.width, BLOCK.height, BLOCK.depth)
        : bevelBox(BLOCK.width, BLOCK.height, BLOCK.depth, 0.0025, Math.max(1, bs - 1));
      blockPieces.push(
        block.translate(x, BOARD.height + BLOCK.height / 2, BLOCK_Z),
        // Open-ended: the board hides the collar's inner end and the lock screw's back.
        new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, seg / 2, 1, true)
          .rotateZ(Math.PI / 2)
          .translate(x - out * (BLOCK.width / 2 + 0.0016), WIRE.y, WIRE.z),
        new THREE.CylinderGeometry(0.0034, 0.0034, 0.0016, seg / 2)
          .rotateZ(Math.PI / 2)
          .translate(x + out * (BLOCK.width / 2 + 0.0004), WIRE.y, WIRE.z),
      );
    }
    const blocks = mergePieces(blockPieces);
    boxProjectUV(blocks, [0.05, 0.05]);

    // Four brass screws holding the board down: domed heads on the board's corners.
    const dome = [
      [0, 0],
      [0.0044, 0],
      [0.0044, 0.0008],
      [0.003, 0.0022],
      [0, 0.0027],
    ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
    const screws = mergePieces(
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) =>
          new THREE.LatheGeometry(dome, low ? 5 : seg / 2 + 2).translate(
            sx * 0.53,
            BOARD.height,
            sz * 0.046,
          ),
        ),
      ),
    );
    boxProjectUV(screws, [0.05, 0.05]);

    const wireLen = Math.abs(xY - xX);
    const wireGeo = new THREE.CylinderGeometry(WIRE.radius, WIRE.radius, wireLen, low ? 5 : 8);
    wireGeo.rotateZ(Math.PI / 2);
    wireGeo.translate((xX + xY) / 2, WIRE.y, WIRE.z);

    // The strip, eased at its edges, and its printed face in four pieces (each under 1024 px).
    const ruleBody = low
      ? new THREE.BoxGeometry(RULE.length, RULE.thickness, RULE.depth)
      : bevelBox(RULE.length, RULE.thickness, RULE.depth, RULE_EDGE_M, 1);
    const ruleGeos = segments.map((s) =>
      new THREE.PlaneGeometry(s.lengthM, RULE_PRINT_DEPTH_M).rotateX(-Math.PI / 2),
    );
    const ruleMats = ruleTexes.map((map) => {
      // One seed for all four pieces, so no piece is a shade off its neighbour.
      const m = paperMaterial(0x5ee3, { map });
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
      return m;
    });
    const rulePrint = segments.flatMap((s, i) => {
      const geo = ruleGeos[i];
      const mat = ruleMats[i];
      return geo && mat ? [{ key: s.index, x: s.centreX, geo, mat }] : [];
    });

    const letterBlock = new THREE.PlaneGeometry(0.0125, 0.0125);
    const letterBoard = new THREE.PlaneGeometry(LETTER.size, LETTER.size).rotateX(-Math.PI / 2);
    // A printed letter: no depth write, so the ink pass leaves its quad alone (skipsInk).
    const decal = (map: THREE.Texture) => {
      const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -2;
      return m;
    };
    return {
      pineTex,
      endTex,
      brassTex,
      ruleTexes,
      letterX,
      letterY,
      board,
      blocks,
      screws,
      wireGeo,
      ruleBody,
      ruleGeos,
      ruleMats,
      rulePrint,
      letterBlock,
      letterBoard,
      ruleHit: new THREE.BoxGeometry(RULE.length, RULE_HIT.height, RULE_HIT.depth),
      boardMats: [woodMaterial(0x5ee5, { map: endTex }), woodMaterial(0x5ee1, { map: pineTex })],
      ruleBodyMat: paperMaterial(0x5ee4, { tint: "#d8cba6" }),
      brassMat: brassSurface(0x5ee2, { map: brassTex }),
      wireMat: brassSurface(0x5ee6, { tint: "#7d776c" }),
      letterXMat: decal(letterX),
      letterYMat: decal(letterY),
      hitMat: new THREE.MeshBasicMaterial(),
    };
  }, [quality, low, xX, xY]);
  useEffect(() => repaintWhenFontReady([...res.ruleTexes, res.letterX, res.letterY]), [res]);
  useEffect(
    () => () => {
      disposeKitBag(res);
    },
    [res],
  );

  const lettersY = BOARD.height + 0.0004;
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={INK_IDS.wire}>
        <mesh
          geometry={res.board}
          material={res.boardMats}
          position={[0, BOARD.height / 2, 0]}
          castShadow
          receiveShadow
        />
        {/* The letters are written on the board beside each block, on the side the camera sees,
            where nothing stands in front of them (LETTER). */}
        <mesh
          geometry={res.letterBoard}
          material={res.letterXMat}
          position={[xX + LETTER.dx, lettersY, LETTER.z]}
        />
        <mesh
          geometry={res.letterBoard}
          material={res.letterYMat}
          position={[xY + LETTER.dx, lettersY, LETTER.z]}
        />
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 1}>
        <mesh
          geometry={res.ruleBody}
          material={res.ruleBodyMat}
          position={[0, BOARD.height + RULE.thickness / 2, RULE.z]}
          castShadow
          receiveShadow
        />
        {res.rulePrint.map((p) => (
          <mesh
            key={p.key}
            geometry={p.geo}
            material={p.mat}
            position={[p.x, BOARD.height + RULE.thickness + 0.0002, RULE.z]}
            receiveShadow
          />
        ))}
      </InkGroup>
      <InkGroup id={INK_IDS.wire + 2}>
        <mesh geometry={res.blocks} material={res.brassMat} castShadow receiveShadow />
        <mesh
          geometry={res.letterBlock}
          material={res.letterXMat}
          position={[xX, BOARD.height + BLOCK.height / 2, BLOCK_Z + BLOCK.depth / 2 + 0.0004]}
        />
        <mesh
          geometry={res.letterBlock}
          material={res.letterYMat}
          position={[xY, BOARD.height + BLOCK.height / 2, BLOCK_Z + BLOCK.depth / 2 + 0.0004]}
        />
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
        position={[0, RULE_HIT.y, RULE_HIT.z]}
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
