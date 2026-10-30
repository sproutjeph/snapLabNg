import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  bakeliteMaterial,
  bevelBox,
  boxProjectUV,
  brassSurface,
  disposeKitBag,
} from "../materials";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import {
  createDialTexture,
  createGlassTexture,
  DIAL,
  NEEDLE_LEN,
  needleAngleDeg,
} from "./MeterDial";
import {
  createMirrorImage,
  IMAGE_Z,
  METER_DIAL_LIFT,
  METER_DIAL_Y,
  METER_FACE_Z,
  MIRROR_LIFT,
  NEEDLE_LIFT,
} from "./MeterImage";
import {
  applyEdgeWear,
  canvasTexture,
  hitMaterial,
  makeCanvas,
  matte,
  mergeStatic,
  meterBakeliteTexture,
  meterBrassTexture,
  offsetUV,
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
 * A d.c. moving-coil meter: a chunky speckled-bakelite case with a round dial behind a thick
 * bezel, mirror strip, needle, zero-adjust screw, and red + and black − terminals (A+/A− or
 * V+/V−) on brass plates. The needle angle is `state.current.readout.ammeterDeg` or
 * `voltmeterDeg` (METER_ZERO_DEG … METER_FULL_DEG from @snaplab/engine). The dial shows only
 * the printed scale and the letter, never a reading as a number. Props frozen.
 */

// Black − on the left, red + on the right, as on the usual school meters.
const PLUS_X = 0.035;

// Case, in metres: about 12 x 12 x 5 cm, with a low ledge in front that carries the terminals.
// These match BENCH_FOOTPRINTS (LeadParts.ts), which the layout tests and the leads rest on.
const CASE = { w: 0.12, h: 0.118, d: 0.05 } as const;
const LEDGE = { h: 0.012, d: 0.04 } as const;
const FACE_Z = METER_FACE_Z; // front of the case (CASE.d / 2)
const DIAL_Z = FACE_Z + METER_DIAL_LIFT;
const DIAL_CY = METER_DIAL_Y + DIAL.radius; // the middle of the round dial
const PIVOT_Y = DIAL_CY - DIAL.pivotDown;
const SCREW_Y = 0.0195;
const DEG = Math.PI / 180;
const SHAKE_S = 0.4;
/** The bezel ring: its outer radius and how far its lip stands off the face. */
const RING_OUTER = 0.0418;
const RING_LIP = 0.0046;
/** The glass highlight floats just over the lip. */
const GLASS_Z = FACE_Z + RING_LIP + 0.0002;
/** The terminals' brass plates, and the ledge's + and − marks between them. */
const PLATE = { w: 0.03, h: 0.0016, d: 0.03 } as const;
const NUT_Z = 0.045;
const MARK_X = 0.0105;
/** Turns the marks to read upright from the default camera (azimuth 45 degrees). */
const MARK_TURN = Math.PI / 4;

/** The + and − printed on the ledge between the terminals, drawn as bars so they stay crisp. */
function ledgeLabelTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 154;
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    const pxPerM = w / 0.04;
    const len = 0.0088 * pxPerM;
    const thick = 0.0019 * pxPerM;
    const x = (m: number) => w / 2 + m * pxPerM;
    const bar = (cx: number, cy: number, bw: number, bh: number) =>
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.fillStyle = "#f4594c";
    bar(x(MARK_X), h / 2, len, thick);
    bar(x(MARK_X), h / 2, thick, len);
    ctx.fillStyle = "#f1e8cf";
    bar(x(-MARK_X), h / 2, len, thick);
  }
  return canvasTexture(canvas, 4);
}

function needleShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.0017, -0.0062);
  s.lineTo(0.0017, -0.0062);
  s.lineTo(0.0011, 0);
  s.lineTo(0.0002, NEEDLE_LEN);
  s.lineTo(-0.0002, NEEDLE_LEN);
  s.lineTo(-0.0011, 0);
  s.closePath();
  return s;
}

/** The pointer alone: the part of the needle the mirror strip shows. */
function pointerGeometry() {
  const geo = new THREE.ExtrudeGeometry(needleShape(), { depth: 0.0014, bevelEnabled: false });
  geo.translate(0, 0, -0.0007);
  return geo;
}

/**
 * The bezel: a thick ring round the window, stood off the face by RING_LIP, with a rounded
 * shoulder outside and a sloped wall inside, so the lip on the camera's side does not hide the
 * numbers at the paper's edge. A surface of revolution, built on the y axis and turned to face +z.
 * The profile runs outer foot, up, across, down the inner wall (so the faces point outward).
 */
function ringGeometry(segments: number) {
  const ro = RING_OUTER;
  const ri = DIAL.radius;
  const profile = [
    [ro + 0.0005, -0.0004],
    [ro, 0.002],
    [ro - 0.0007, 0.0036],
    [ro - 0.0016, RING_LIP - 0.0002],
    [ri + 0.0021, RING_LIP],
    [ri + 0.0013, 0.004],
    [ri + 0.0006, 0.0027],
    [ri, METER_DIAL_LIFT - 0.0001],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const geo = new THREE.LatheGeometry(profile, segments);
  geo.rotateX(Math.PI / 2);
  return geo;
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
    const seed = kind === "ammeter" ? 31 : 47;
    const rnd = seeded(seed);
    const seg = low ? 12 : 24;
    const dialTex = createDialTexture({
      fullScale,
      division,
      letter: kind === "ammeter" ? "A" : "V",
      px: low ? 512 : 1024,
    });
    const bakeTex = meterBakeliteTexture(quality);
    const brassTex = meterBrassTexture(quality);
    const ledgeTex = ledgeLabelTexture();
    const glassTex = low ? null : createGlassTexture(256);

    // The case: a bevelled block with a bevelled ledge in front, speckled bakelite all over, its
    // edges worn pale where the bevels turn. The voltmeter takes another part of the same tile.
    const caseGeo = mergeStatic([
      {
        geo: bevelBox(CASE.w, CASE.h, CASE.d, 0.0065, low ? 1 : 3),
        place: (g) => g.translate(0, CASE.h / 2, 0),
      },
      {
        geo: bevelBox(CASE.w, LEDGE.h, LEDGE.d, 0.0035, low ? 1 : 2),
        place: (g) => g.translate(0, LEDGE.h / 2, FACE_Z + LEDGE.d / 2),
      },
    ]);
    boxProjectUV(caseGeo, [0.12, 0.12]);
    if (kind === "voltmeter") offsetUV(caseGeo, 0.37, 0.61);
    applyEdgeWear(caseGeo);
    const caseMat = bakeliteMaterial(seed, { map: bakeTex, roughness: 0.9 });
    caseMat.vertexColors = true;

    // Brass plates under the terminals, and the zero-adjust screw.
    const plateGeo = (side: number) => ({
      geo: bevelBox(PLATE.w, PLATE.h, PLATE.d, 0.0006, 1),
      place: (g: THREE.BufferGeometry) =>
        g.translate(side * PLUS_X, LEDGE.h + PLATE.h / 2 - 0.0004, NUT_Z),
    });
    const platesGeo = mergeStatic([plateGeo(-1), plateGeo(1)]);
    boxProjectUV(platesGeo, [0.1, 0.1]);
    const screwHead = new THREE.CylinderGeometry(0.0058, 0.0058, 0.003, seg);
    screwHead.rotateX(Math.PI / 2);
    screwHead.translate(0, SCREW_Y, FACE_Z + 0.0015);
    const screwGeo = mergeStatic([{ geo: screwHead }]);
    boxProjectUV(screwGeo, [0.1, 0.1]);
    const slotGeo = new THREE.BoxGeometry(0.0098, 0.0017, 0.001);
    slotGeo.rotateZ(0.5);
    slotGeo.translate(0, SCREW_Y, FACE_Z + 0.003);

    // The needle, with its counterweight, and the brass hub and post that turn with it.
    const tail = new THREE.CylinderGeometry(0.0027, 0.0027, 0.0014, low ? 10 : 16);
    tail.rotateX(Math.PI / 2);
    const needleGeo = mergeStatic([
      { geo: pointerGeometry() },
      { geo: tail, place: (g) => g.translate(0, -0.0078, 0) },
    ]);
    const hubGeo = new THREE.SphereGeometry(
      0.0043,
      low ? 10 : 14,
      low ? 2 : 4,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    hubGeo.scale(1, 0.55, 1);
    hubGeo.rotateX(Math.PI / 2);
    hubGeo.translate(0, 0, 0.0004);
    const postGeo = new THREE.CylinderGeometry(0.0011, 0.0011, NEEDLE_LIFT, 8);
    postGeo.rotateX(Math.PI / 2);
    postGeo.translate(0, 0, -NEEDLE_LIFT / 2);

    const mirrorGeo = new THREE.RingGeometry(
      DIAL.mirrorInner,
      DIAL.mirrorOuter,
      low ? 24 : 40,
      1,
      Math.PI / 2 - 43 * DEG,
      86 * DEG,
    );
    const hitScrewGeo = new THREE.SphereGeometry(0.009, 8, 6);
    hitScrewGeo.translate(0, SCREW_Y, FACE_Z + 0.003);

    const ledgeLabelGeo = new THREE.PlaneGeometry(0.04, 0.012);
    ledgeLabelGeo.rotateX(-Math.PI / 2);
    const ledgeLabelMat = matte("#ffffff", rnd, { roughness: 0.8, amount: 0.002, map: ledgeTex });
    ledgeLabelMat.transparent = true;
    ledgeLabelMat.depthWrite = false;

    const glassMat = glassTex
      ? new THREE.MeshBasicMaterial({
          map: glassTex,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        })
      : null;

    return {
      dialTex,
      ledgeTex,
      glassTex,
      bakeTex,
      brassTex,
      caseMat,
      caseGeo,
      ledgeLabelGeo,
      ledgeLabelMat,
      dialGeo: new THREE.CircleGeometry(DIAL.radius, low ? 32 : 64),
      dialMat: matte("#ffffff", rnd, { roughness: 0.88, amount: 0.008, map: dialTex }),
      ringGeo: ringGeometry(low ? 24 : 44),
      // Smooth dark ebonite for the bezel and the screw's slot.
      ringMat: matte("#1f1b19", rnd, { roughness: 0.8, amount: 0.01 }),
      platesGeo,
      screwGeo,
      slotGeo,
      needleGeo,
      needleBrassGeo: mergeStatic([{ geo: hubGeo }, { geo: postGeo }]),
      pointerGeo: pointerGeometry(),
      needleMat: matte("#111111", rnd, { roughness: 0.7 }),
      mirrorGeo,
      // The needle seen in the mirror strip. None on the low tier: parallax alone there.
      image: low ? null : createMirrorImage(),
      mirrorMat: matte("#cfd5da", rnd, { roughness: 0.6, metalness: 0.15, amount: 0.01 }),
      brassMat: brassSurface(seed, { map: brassTex, tint: "#fff0d2" }),
      glassGeo: glassTex ? new THREE.PlaneGeometry(DIAL.radius * 2, DIAL.radius * 2) : null,
      glassMat,
      hitScrewGeo,
      hitMat: hitMaterial(),
    };
  }, [kind, fullScale, division, low, quality]);

  useEffect(
    () => () => {
      disposeKitBag(res);
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
    const buzzDeg = Math.sin(st.clock.elapsedTime * 80) * 2.2 * shake.current * shake.current;
    needle.rotation.z = -needleAngleDeg(deg, buzzDeg) * DEG;
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
            position={[0, LEDGE.h + 0.0003, NUT_Z + 0.0005]}
            rotation-y={MARK_TURN}
          />
        </InkGroup>
        <InkGroup id={ink + 1}>
          <mesh
            geometry={res.dialGeo}
            material={res.dialMat}
            position={[0, DIAL_CY, DIAL_Z]}
            receiveShadow={cast}
          />
        </InkGroup>
        <InkGroup id={ink + 5}>
          <mesh
            geometry={res.ringGeo}
            material={res.ringMat}
            position={[0, DIAL_CY, FACE_Z]}
            castShadow={cast}
            receiveShadow={cast}
          />
        </InkGroup>
        <InkGroup id={ink + 6} thin>
          <mesh
            geometry={res.platesGeo}
            material={res.brassMat}
            castShadow={cast}
            receiveShadow={cast}
          />
        </InkGroup>
        <InkGroup id={ink + 3} thin>
          <mesh geometry={res.screwGeo} material={res.brassMat} />
          <mesh geometry={res.slotGeo} material={res.ringMat} />
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
                geometry={res.pointerGeo}
                material={res.image.material}
                renderOrder={4}
                userData={{ noInk: true }}
                onBeforeRender={(_r, _s, camera) => {
                  if (pivotRef.current) res.image?.syncPivot(pivotRef.current, camera);
                }}
              />
            </group>
          </group>
        )}
        {res.glassGeo && res.glassMat && (
          <mesh
            geometry={res.glassGeo}
            material={res.glassMat}
            position={[0, DIAL_CY, GLASS_Z]}
            renderOrder={6}
            userData={{ noInk: true }}
          />
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
        position={[PLUS_X, LEDGE.h, NUT_Z]}
        state={state}
        quality={quality}
        cap="red"
      />
      <TerminalNut
        id={minus}
        part={kind}
        position={[-PLUS_X, LEDGE.h, NUT_Z]}
        state={state}
        quality={quality}
        cap="black"
      />
    </group>
  );
}
