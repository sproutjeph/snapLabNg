import { useFrame } from "@react-three/fiber";
import { METER_STOP_DEG } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { createDialTexture, DIAL } from "./MeterDial";
import {
  brassMaterial,
  COLOURS,
  canvasTexture,
  disposeAll,
  hitMaterial,
  makeCanvas,
  matte,
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

// Case, in metres: about 12 x 11 x 5 cm, with a low ledge in front that carries the terminals.
const CASE = { w: 0.12, h: 0.118, d: 0.05 } as const;
const LEDGE = { h: 0.012, d: 0.04 } as const;
const FACE_Z = CASE.d / 2; // front of the case
const DIAL_Y = 0.032; // bottom edge of the dial paper
const DIAL_Z = FACE_Z + 0.0002;
const NEEDLE_LIFT = 0.0045; // the needle floats this far above the dial: real parallax
const PIVOT_Y = DIAL_Y + DIAL.pivotUp;
const NEEDLE_LEN = DIAL.arcRadius + 0.003;
const DEG = Math.PI / 180;
const SHAKE_S = 0.4;

function ledgeLabelTexture() {
  const { canvas, ctx } = makeCanvas(512, 170);
  if (ctx) {
    ctx.fillStyle = "#262320";
    ctx.fillRect(0, 0, 512, 170);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Georgia, serif";
    // Top-face uv: canvas top is the back of the ledge, so the front edge is the bottom.
    const x = (v: number) => ((v + CASE.w / 2) / CASE.w) * 512;
    const y = ((0.0575 - FACE_Z) / LEDGE.d) * 170;
    ctx.fillStyle = "#d9463c";
    ctx.fillText("+", x(PLUS_X), y);
    ctx.fillStyle = "#f1e8cf";
    ctx.fillText("−", x(-PLUS_X), y);
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
  const prevSlams = useRef(-1);
  const shake = useRef(0);
  const low = quality === "low";

  const res = useMemo(() => {
    const rnd = seeded(kind === "ammeter" ? 31 : 47);
    const seg = low ? 12 : 24;
    const dialTex = createDialTexture({
      fullScale,
      division,
      letter: kind === "ammeter" ? "A" : "V",
      px: low ? 512 : 1024,
    });
    const ledgeTex = ledgeLabelTexture();
    const caseMat = matte(COLOURS.bakelite, rnd, { roughness: 0.75 });
    const ledgeTopMat = matte("#ffffff", rnd, { roughness: 0.8, amount: 0.005, map: ledgeTex });
    const ledgeMats = [caseMat, caseMat, ledgeTopMat, caseMat, caseMat, caseMat];
    const needleMat = matte("#111111", rnd, { roughness: 0.7 });
    const stopGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.0075, 8);
    stopGeo.rotateX(Math.PI / 2);
    const slotGeo = new THREE.BoxGeometry(0.0072, 0.0013, 0.0008);
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
    const postGeo = new THREE.CylinderGeometry(0.0011, 0.0011, NEEDLE_LIFT, 8);
    postGeo.rotateX(Math.PI / 2);
    const screwGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0024, seg);
    screwGeo.rotateX(Math.PI / 2);
    const needleGeo = new THREE.ExtrudeGeometry(needleShape(), {
      depth: 0.0014,
      bevelEnabled: false,
    });
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape(), {
      depth: 0.0028,
      bevelEnabled: false,
    });
    return {
      caseGeo: new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d),
      ledgeGeo: new THREE.BoxGeometry(CASE.w, LEDGE.h, LEDGE.d),
      dialGeo: new THREE.PlaneGeometry(DIAL.width, DIAL.height),
      bezelGeo,
      needleGeo,
      mirrorGeo,
      hubGeo,
      postGeo,
      screwGeo,
      slotGeo,
      stopGeo,
      hitScrewGeo: new THREE.SphereGeometry(0.009, 8, 6),
      dialTex,
      ledgeTex,
      caseMat,
      ledgeTopMat,
      ledgeMats,
      dialMat: matte("#ffffff", rnd, { roughness: 0.85, amount: 0.008, map: dialTex }),
      bezelMat: matte("#34302b", rnd, { roughness: 0.7 }),
      needleMat,
      mirrorMat: matte("#cfd5da", rnd, { roughness: 0.6, metalness: 0.15, amount: 0.01 }),
      brassMat: brassMaterial(rnd),
      slotMat: matte("#2a2118", rnd, { roughness: 0.9 }),
      hitMat: hitMaterial(),
    };
  }, [kind, fullScale, division, low]);

  useEffect(() => {
    // ledgeMats repeats caseMat and ledgeTopMat; disposing a material twice is harmless.
    return () => disposeAll(res);
  }, [res]);

  useFrame((st, dt) => {
    const needle = needleRef.current;
    if (!needle) return;
    const r = state.current.readout;
    const ammeter = kind === "ammeter";
    const deg = ammeter ? r.ammeterDeg : r.voltmeterDeg;
    const slams = ammeter ? r.ammeterSlams : r.voltmeterSlams;
    if (prevSlams.current < 0) prevSlams.current = slams;
    else if (slams > prevSlams.current) {
      prevSlams.current = slams;
      shake.current = 1;
    }
    shake.current = Math.max(0, shake.current - dt / SHAKE_S);
    const jitter = Math.sin(st.clock.elapsedTime * 80) * 2.2 * DEG * shake.current * shake.current;
    needle.rotation.z = -deg * DEG + jitter;
  });

  const stop = (METER_STOP_DEG + 1.2) * DEG;
  const stopR = 0.04;

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <group onPointerDown={tapOnly(onTap)}>
        <InkGroup id={ink}>
          <mesh
            geometry={res.caseGeo}
            material={res.caseMat}
            position={[0, CASE.h / 2, 0]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={res.ledgeGeo}
            material={res.ledgeMats}
            position={[0, LEDGE.h / 2, FACE_Z + LEDGE.d / 2]}
            castShadow
            receiveShadow
          />
        </InkGroup>
        <InkGroup id={ink + 1}>
          <mesh
            geometry={res.dialGeo}
            material={res.dialMat}
            position={[0, DIAL_Y + DIAL.height / 2, DIAL_Z]}
            receiveShadow
          />
        </InkGroup>
        <InkGroup id={ink + 5} thin>
          <mesh
            geometry={res.bezelGeo}
            material={res.bezelMat}
            position={[0, DIAL_Y + DIAL.height / 2, FACE_Z]}
            castShadow
          />
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={res.stopGeo}
              material={res.brassMat}
              position={[
                Math.sin(side * stop) * stopR,
                PIVOT_Y + Math.cos(stop) * stopR,
                DIAL_Z + 0.0036,
              ]}
            />
          ))}
        </InkGroup>
        <InkGroup id={ink + 4} thin>
          <mesh
            geometry={res.mirrorGeo}
            material={res.mirrorMat}
            position={[0, PIVOT_Y, DIAL_Z + 0.0004]}
          />
        </InkGroup>
        <InkGroup id={ink + 2} thin>
          <group ref={needleRef} position={[0, PIVOT_Y, DIAL_Z + NEEDLE_LIFT]}>
            <mesh
              geometry={res.needleGeo}
              material={res.needleMat}
              position={[0, 0, -0.0007]}
              castShadow
            />
            <mesh geometry={res.hubGeo} material={res.brassMat} position={[0, 0, 0.0004]} />
            <mesh
              geometry={res.postGeo}
              material={res.brassMat}
              position={[0, 0, -NEEDLE_LIFT / 2]}
            />
          </group>
        </InkGroup>
      </group>
      {/* Zero-adjust screw, below the pivot. Its own tap target, bigger than the head. */}
      <group position={[0, 0.0195, FACE_Z + 0.001]}>
        <InkGroup id={ink + 3} thin>
          <mesh geometry={res.screwGeo} material={res.brassMat} castShadow />
          <mesh
            geometry={res.slotGeo}
            material={res.slotMat}
            position={[0, 0, 0.0014]}
            rotation-z={0.5}
          />
        </InkGroup>
        <mesh
          geometry={res.hitScrewGeo}
          material={res.hitMat}
          position={[0, 0, 0.002]}
          onPointerDown={tapOnly(onZeroScrewTap)}
        />
      </group>
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
