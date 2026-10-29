import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InkGroup } from "../ink/ink";
import { INK_HEX } from "../ink/palette";

// The exam desk's own things at the front edge of the paper (docs/plans/exam-redesign.md, "The
// look": ground; design target docs/design/exam-redesign/golden-frame.webp): an answer booklet,
// a pencil, an eraser and a calculator. Inked like the apparatus, matte (roughness ≈ .9), and
// laid outside the bench's footprint, in front of it.

/** Fixed ink ids for the desk props, clear of the V–I table (10–159). */
export const DESK_INK_IDS = { pencil: 190, eraser: 191, booklet: 192, calculator: 193 } as const;

/** Where each prop lies: [x, z] in metres and its turn about y. In front of the bench. */
export const DESK_PROP_PLACES = {
  pencil: { x: -0.66, z: 0.5, turn: 0.42 },
  eraser: { x: -0.2, z: 0.56, turn: -0.18 },
  booklet: { x: 0.36, z: 0.6, turn: 0.12 },
  calculator: { x: 0.66, z: 0.52, turn: -0.22 },
} as const;

const PENCIL_LEN = 0.175;
const PENCIL_R = 0.0042;
const CONE_LEN = 0.018;
const BOOKLET = { w: 0.2, d: 0.27, h: 0.007 } as const;
const CALC = { w: 0.08, d: 0.155, h: 0.014 } as const;
const ERASER = { w: 0.05, d: 0.022, h: 0.012 } as const;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function bookletCover(): THREE.CanvasTexture {
  return canvasTexture(512, 692, (ctx) => {
    ctx.fillStyle = "#2c3a57";
    ctx.fillRect(0, 0, 512, 692);
    // A cloth-like speckle, so the cover is not flat colour.
    for (let i = 0; i < 2200; i++) {
      const x = (i * 97.13) % 512;
      const y = (i * 61.7 + (i % 13) * 37) % 692;
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = "rgba(244,236,220,0.55)";
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, 440, 620);
    ctx.fillStyle = "#efe4cc";
    ctx.textAlign = "center";
    ctx.font = "600 52px Georgia, 'Times New Roman', serif";
    ctx.fillText("ANSWER", 256, 250);
    ctx.fillText("BOOKLET", 256, 318);
    ctx.font = "26px Georgia, 'Times New Roman', serif";
    ctx.fillText("Physics 3 · Practical", 256, 392);
    ctx.fillStyle = "#efe4cc";
    ctx.fillRect(116, 470, 280, 3);
    ctx.fillRect(116, 530, 280, 3);
  });
}

function calculatorFace(): THREE.CanvasTexture {
  return canvasTexture(256, 496, (ctx) => {
    ctx.fillStyle = "#33405c";
    ctx.fillRect(0, 0, 256, 496);
    // The screen.
    ctx.fillStyle = "#1e2638";
    ctx.fillRect(22, 30, 212, 104);
    ctx.fillStyle = "#b8c2a2";
    ctx.fillRect(32, 40, 192, 84);
    ctx.fillStyle = "rgba(29,36,48,0.6)";
    ctx.font = "bold 44px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillText("0.", 214, 100);
    // Keys: 5 columns × 6 rows.
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const x = 22 + c * 43;
        const y = 168 + r * 52;
        ctx.fillStyle = r === 0 ? "#5a6680" : c >= 3 && r > 1 ? "#d9cfba" : "#1f2638";
        ctx.beginPath();
        ctx.roundRect(x, y, 36, 36, 7);
        ctx.fill();
      }
    }
  });
}

function usePropAssets() {
  const assets = useMemo(() => {
    const hex = new THREE.CylinderGeometry(PENCIL_R, PENCIL_R, PENCIL_LEN, 6, 1);
    hex.rotateZ(Math.PI / 2);
    const cone = new THREE.CylinderGeometry(PENCIL_R * 0.32, PENCIL_R, CONE_LEN, 6, 1);
    cone.rotateZ(Math.PI / 2);
    const tip = new THREE.ConeGeometry(PENCIL_R * 0.32, CONE_LEN * 0.35, 6, 1);
    tip.rotateZ(Math.PI / 2);
    const ferrule = new THREE.CylinderGeometry(PENCIL_R * 1.04, PENCIL_R * 1.04, 0.012, 12, 1);
    ferrule.rotateZ(Math.PI / 2);
    const rubber = new THREE.CylinderGeometry(PENCIL_R * 0.98, PENCIL_R * 0.98, 0.008, 12, 1);
    rubber.rotateZ(Math.PI / 2);
    const eraser = new RoundedBoxGeometry(ERASER.w, ERASER.h, ERASER.d, 3, 0.004);
    const booklet = new RoundedBoxGeometry(BOOKLET.w, BOOKLET.h, BOOKLET.d, 2, 0.0025);
    const calc = new RoundedBoxGeometry(CALC.w, CALC.h, CALC.d, 3, 0.006);
    const top = new THREE.PlaneGeometry(1, 1);
    top.rotateX(-Math.PI / 2);
    const cover = bookletCover();
    const face = calculatorFace();
    const matte = (color: string, roughness = 0.9) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const materials = {
      pencil: matte("#e2a634", 0.8),
      wood: matte("#dcbc8c"),
      graphite: matte("#3a3d42", 0.6),
      ferrule: new THREE.MeshStandardMaterial({
        color: "#b8a36a",
        roughness: 0.45,
        metalness: 0.8,
      }),
      rubber: matte("#e39a93"),
      eraser: matte("#eca098"),
      pages: matte("#f3ead6"),
      cover: new THREE.MeshStandardMaterial({ map: cover, roughness: 0.92, metalness: 0 }),
      calcBody: matte(INK_HEX, 0.85),
      calcFace: new THREE.MeshStandardMaterial({ map: face, roughness: 0.75, metalness: 0 }),
    };
    return {
      geometries: { hex, cone, tip, ferrule, rubber, eraser, booklet, calc, top },
      textures: { cover, face },
      materials,
    };
  }, []);
  useEffect(
    () => () => {
      for (const g of Object.values(assets.geometries)) g.dispose();
      for (const t of Object.values(assets.textures)) t.dispose();
      for (const m of Object.values(assets.materials)) m.dispose();
    },
    [assets],
  );
  return assets;
}

export function DeskProps() {
  const { geometries: g, materials: m } = usePropAssets();
  const P = DESK_PROP_PLACES;
  return (
    <group name="DeskProps">
      <group position={[P.pencil.x, PENCIL_R * 0.87, P.pencil.z]} rotation-y={P.pencil.turn}>
        <InkGroup id={DESK_INK_IDS.pencil}>
          {/* A hexagonal pencil lies on a flat, not an edge. */}
          <group rotation-x={Math.PI / 6}>
            <mesh geometry={g.hex} material={m.pencil} castShadow />
            <mesh
              geometry={g.cone}
              material={m.wood}
              position-x={PENCIL_LEN / 2 + CONE_LEN / 2}
              castShadow
            />
            <mesh
              geometry={g.tip}
              material={m.graphite}
              position-x={PENCIL_LEN / 2 + CONE_LEN + CONE_LEN * 0.12}
            />
            <mesh geometry={g.ferrule} material={m.ferrule} position-x={-PENCIL_LEN / 2 - 0.006} />
            <mesh geometry={g.rubber} material={m.rubber} position-x={-PENCIL_LEN / 2 - 0.016} />
          </group>
        </InkGroup>
      </group>
      <group position={[P.eraser.x, ERASER.h / 2, P.eraser.z]} rotation-y={P.eraser.turn}>
        <InkGroup id={DESK_INK_IDS.eraser}>
          <mesh geometry={g.eraser} material={m.eraser} castShadow />
        </InkGroup>
      </group>
      <group position={[P.booklet.x, BOOKLET.h / 2, P.booklet.z]} rotation-y={P.booklet.turn}>
        <InkGroup id={DESK_INK_IDS.booklet}>
          <mesh geometry={g.booklet} material={m.pages} castShadow />
          <mesh
            geometry={g.top}
            material={m.cover}
            position-y={BOOKLET.h / 2 + 0.0004}
            scale={[BOOKLET.w - 0.002, 1, BOOKLET.d - 0.002]}
          />
        </InkGroup>
      </group>
      <group position={[P.calculator.x, CALC.h / 2, P.calculator.z]} rotation-y={P.calculator.turn}>
        <InkGroup id={DESK_INK_IDS.calculator}>
          <mesh geometry={g.calc} material={m.calcBody} castShadow />
          <mesh
            geometry={g.top}
            material={m.calcFace}
            position-y={CALC.h / 2 + 0.0004}
            scale={[CALC.w - 0.01, 1, CALC.d - 0.01]}
          />
        </InkGroup>
      </group>
    </group>
  );
}
