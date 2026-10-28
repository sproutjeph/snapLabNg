import { useFrame } from "@react-three/fiber";
import { METER_STOP_DEG } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { createDialTexture, DIAL } from "./MeterDial";
import {
  createMirrorImage,
  IMAGE_Z,
  METER_DIAL_Y,
  METER_FACE_Z,
  MIRROR_LIFT,
  NEEDLE_LIFT,
} from "./MeterImage";
import {
  brassMaterial,
  COLOURS,
  canvasTexture,
  disposeAll,
  hitMaterial,
  jitterColour,
  makeCanvas,
  matte,
  mergeStatic,
  seeded,
} from "./MeterMaterials";
import { TerminalNut } from "./TerminalNut";

export interface MeterProps extends PartProps {
  kind: "ammeter" | "voltmeter";
  /** Painted on the dial, from the engine's params (A or V). */
  fullScale: number;
  division: number;
  /** Tap the face to open the scale loupe. */
  onTap?: () => void;
  /** Tap the zero-adjust screw (SHOULD). */
  onZeroScrewTap?: () => void;
}

/**
 * A d.c. moving-coil meter: dial, mirror strip, needle, zero-adjust screw, red + and black −
 * terminals (A+/A− or V+/V−). The needle angle is `state.current.readout.ammeterDeg` or
 * `voltmeterDeg` (METER_ZERO_DEG … METER_FULL_DEG from @snaplab/engine). The dial shows only
 * the printed scale and the letter, never a reading as a number. Props frozen.
 */

// Black − on the left, red + on the right, as on the usual school meters.
const PLUS_X = 0.035;

// Case, in metres: about 12 x 12 x 5 cm, with a low ledge in front that carries the terminals.
const CASE = { w: 0.12, h: 0.118, d: 0.05 } as const;
const LEDGE = { h: 0.012, d: 0.04 } as const;
const FACE_Z = METER_FACE_Z; // front of the case (CASE.d / 2)
const DIAL_Y = METER_DIAL_Y; // bottom edge of the dial paper
const DIAL_Z = FACE_Z + 0.0002;
const PIVOT_Y = DIAL_Y + DIAL.pivotUp;
const NEEDLE_LEN = DIAL.arcRadius + 0.003;
const SCREW_Y = 0.0195;
const DEG = Math.PI / 180;
const SHAKE_S = 0.4;
const LABEL_Z = 0.0575; // the + and − are printed this far forward on the ledge

function ledgeLabelTexture(bg: string) {
  const { canvas, ctx } = makeCanvas(512, 48);
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 48);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Georgia, serif";
    const x = (v: number) => ((v + 0.045) / 0.09) * 512;
    ctx.fillStyle = "#d9463c";
    ctx.fillText("+", x(PLUS_X), 26);
    ctx.fillStyle = "#f1e8cf";
    ctx.fillText("−", x(-PLUS_X), 26);
  }
  return canvasTexture(canvas, 2);
}

function needleShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.0016, -0.007);
  s.lineTo(0.0016, -0.007);
  s.lineTo(0.001, 0);
  s.lineTo(0.00018, NEEDLE_LEN);
  s.lineTo(-0.00018, NEEDLE_LEN);
  s.lineTo(-0.001, 0);
  s.closePath();
  return s;
}

function bezelShape() {
  const ow = DIAL.width / 2 + 0.004;
  const oh = DIAL.height / 2 + 0.004;
  const s = new THREE.Shape();
  s.moveTo(-ow, -oh);
  s.lineTo(ow, -oh);
  s.lineTo(ow, oh);
  s.lineTo(-ow, oh);
  s.closePath();
  const hole = new THREE.Path();
  const iw = DIAL.width / 2;
  const ih = DIAL.height / 2;
  hole.moveTo(-iw, -ih);
  hole.lineTo(-iw, ih);
  hole.lineTo(iw, ih);
  hole.lineTo(iw, -ih);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

export function Meter({
  kind,
  fullScale,
  division,
  state,
  quality,
  position,
  rotationY = 0,
  onTap,
  onZeroScrewTap,
}: MeterProps) {
  const plus = kind === "ammeter" ? "A+" : "V+";
  const minus = kind === "ammeter" ? "A-" : "V-";
  const ink = INK_IDS[kind];
  const needleRef = useRef<THREE.Group>(null);
  const imageRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const prevSlams = useRef(-1);
  const shake = useRef(0);
  const low = quality === "low";
  const cast = !low;

  const res = useMemo(() => {
    const rnd = seeded(kind === "ammeter" ? 31 : 47);
    const seg = low ? 12 : 24;
    const dialTex = createDialTexture({
      fullScale,
      division,
      letter: kind === "ammeter" ? "A" : "V",
      px: low ? 512 : 1024,
    });
    const bakelite = jitterColour(COLOURS.bakelite, rnd);
    const ledgeTex = ledgeLabelTexture(`#${bakelite.getHexString()}`);
    const caseMat = matte(COLOURS.bakelite, rnd, { roughness: 0.75 });
    caseMat.color.copy(bakelite);
    const ledgeLabelGeo = new THREE.PlaneGeometry(0.09, 0.008);
    ledgeLabelGeo.rotateX(-Math.PI / 2);
    const mirrorGeo = new THREE.RingGeometry(
      DIAL.mirrorInner,
      DIAL.mirrorOuter,
      low ? 24 : 48,
      1,
      Math.PI / 2 - 43 * DEG,
      86 * DEG,
    );
    const hubGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0022, seg);
    hubGeo.rotateX(Math.PI / 2);
    hubGeo.translate(0, 0, 0.0004);
    const postGeo = new THREE.CylinderGeometry(0.0011, 0.0011, NEEDLE_LIFT, 8);
    postGeo.rotateX(Math.PI / 2);
    postGeo.translate(0, 0, -NEEDLE_LIFT / 2);
    const needleGeo = new THREE.ExtrudeGeometry(needleShape(), {
      depth: 0.0014,
      bevelEnabled: false,
    });
    needleGeo.translate(0, 0, -0.0007);
    const stop = (METER_STOP_DEG + 1.2) * DEG;
    const stopR = 0.04;
    const stopPiece = (side: number) => {
      const geo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.0075, 8);
      geo.rotateX(Math.PI / 2);
      return {
        geo,
        place: (g: THREE.BufferGeometry) =>
          g.translate(
            Math.sin(side * stop) * stopR,
            PIVOT_Y + Math.cos(stop) * stopR,
            DIAL_Z + 0.0036,
          ),
      };
    };
    const screwGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0024, seg);
    screwGeo.rotateX(Math.PI / 2);
    const slotGeo = new THREE.BoxGeometry(0.0072, 0.0013, 0.0008);
    slotGeo.rotateZ(0.5);
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape(), {
      depth: 0.0028,
      bevelEnabled: false,
    });
    const hitScrewGeo = new THREE.SphereGeometry(0.009, 8, 6);
    hitScrewGeo.translate(0, SCREW_Y, FACE_Z + 0.003);
    return {
      dialTex,
      ledgeTex,
      caseMat,
      // The case and its ledge: one geometry, one draw call.
      caseGeo: mergeStatic([
        {
          geo: new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d),
          place: (g) => g.translate(0, CASE.h / 2, 0),
        },
        {
          geo: new THREE.BoxGeometry(CASE.w, LEDGE.h, LEDGE.d),
          place: (g) => g.translate(0, LEDGE.h / 2, FACE_Z + LEDGE.d / 2),
        },
      ]),
      ledgeLabelGeo,
      ledgeLabelMat: matte("#ffffff", rnd, { roughness: 0.8, amount: 0.002, map: ledgeTex }),
      dialGeo: new THREE.PlaneGeometry(DIAL.width, DIAL.height),
      dialMat: matte("#ffffff", rnd, { roughness: 0.85, amount: 0.008, map: dialTex }),
      // The bezel frame and the screw's slot share the dark material.
      bezelGeo: mergeStatic([
        {
          geo: bezelGeo,
          place: (g) => g.translate(0, DIAL_Y + DIAL.height / 2, FACE_Z),
        },
        { geo: slotGeo, place: (g) => g.translate(0, SCREW_Y, FACE_Z + 0.0025) },
      ]),
      bezelMat: matte("#34302b", rnd, { roughness: 0.7 }),
      // The two stop pins and the screw head: static brass in one draw call.
      brassStaticGeo: mergeStatic([
        stopPiece(-1),
        stopPiece(1),
        { geo: screwGeo, place: (g) => g.translate(0, SCREW_Y, FACE_Z + 0.001) },
      ]),
      // The hub and post turn with the needle.
      needleBrassGeo: mergeStatic([{ geo: hubGeo }, { geo: postGeo }]),
      needleGeo,
      needleMat: matte("#111111", rnd, { roughness: 0.7 }),
      mirrorGeo,
      // The needle seen in the mirror strip. None on the low tier: parallax alone there.
      image: low ? null : createMirrorImage(),
      mirrorMat: matte("#cfd5da", rnd, { roughness: 0.6, metalness: 0.15, amount: 0.01 }),
      brassMat: brassMaterial(rnd),
      hitScrewGeo,
      hitMat: hitMaterial(),
    };
  }, [kind, fullScale, division, low]);

  useEffect(
    () => () => {
      disposeAll(res);
      res.image?.material.dispose();
    },
    [res],
  );

  useFrame((st, dt) => {
    const needle = needleRef.current;
    if (!needle) return;
    const r = state.current.readout;
    const ammeter = kind === "ammeter";
    const deg = ammeter ? r.ammeterDeg : r.voltmeterDeg;
    const slams = ammeter ? r.ammeterSlams : r.voltmeterSlams;
    // A counter that goes up means a slam. If it goes down (a bench reset) just follow it.
    if (prevSlams.current < 0) prevSlams.current = slams;
    else if (slams !== prevSlams.current) {
      if (slams > prevSlams.current) shake.current = 1;
      prevSlams.current = slams;
    }
    shake.current = Math.max(0, shake.current - dt / SHAKE_S);
    const jitter = Math.sin(st.clock.elapsedTime * 80) * 2.2 * DEG * shake.current * shake.current;
    needle.rotation.z = -deg * DEG + jitter;
    if (imageRef.current) imageRef.current.rotation.z = needle.rotation.z;
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <group onPointerDown={tapOnly(onTap)}>
        <InkGroup id={ink}>
          <mesh
            geometry={res.caseGeo}
            material={res.caseMat}
            castShadow={cast}
            receiveShadow={cast}
          />
          <mesh
            geometry={res.ledgeLabelGeo}
            material={res.ledgeLabelMat}
            position={[0, LEDGE.h + 0.0003, LABEL_Z]}
          />
        </InkGroup>
        <InkGroup id={ink + 1}>
          <mesh
            geometry={res.dialGeo}
            material={res.dialMat}
            position={[0, DIAL_Y + DIAL.height / 2, DIAL_Z]}
          />
        </InkGroup>
        <InkGroup id={ink + 5} thin>
          <mesh geometry={res.bezelGeo} material={res.bezelMat} castShadow={cast} />
        </InkGroup>
        <InkGroup id={ink + 3} thin>
          <mesh geometry={res.brassStaticGeo} material={res.brassMat} />
        </InkGroup>
        <InkGroup id={ink + 4} thin>
          <mesh
            geometry={res.mirrorGeo}
            material={res.mirrorMat}
            position={[0, PIVOT_Y, DIAL_Z + MIRROR_LIFT]}
          />
        </InkGroup>
        <InkGroup id={ink + 2} thin>
          <group ref={needleRef} position={[0, PIVOT_Y, DIAL_Z + NEEDLE_LIFT]}>
            <mesh geometry={res.needleGeo} material={res.needleMat} castShadow={cast} />
            <mesh geometry={res.needleBrassGeo} material={res.brassMat} />
          </group>
        </InkGroup>
        {res.image && (
          <group ref={pivotRef} position={[0, PIVOT_Y, DIAL_Z]}>
            <group ref={imageRef} position={[0, 0, IMAGE_Z]}>
              <mesh
                geometry={res.needleGeo}
                material={res.image.material}
                renderOrder={4}
                onBeforeRender={() => {
                  if (pivotRef.current) res.image?.syncPivot(pivotRef.current);
                }}
              />
            </group>
          </group>
        )}
      </group>
      {/* Zero-adjust screw tap target, bigger than the head; it never reaches the face tap. */}
      <mesh
        geometry={res.hitScrewGeo}
        material={res.hitMat}
        onPointerDown={tapOnly(onZeroScrewTap)}
      />
      <TerminalNut
        id={plus}
        part={kind}
        position={[PLUS_X, LEDGE.h, 0.045]}
        state={state}
        quality={quality}
        cap="red"
      />
      <TerminalNut
        id={minus}
        part={kind}
        position={[-PLUS_X, LEDGE.h, 0.045]}
        state={state}
        quality={quality}
        cap="black"
      />
    </group>
  );
}
