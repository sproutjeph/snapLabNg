import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BRIDGE_WIRE, cmToX, JOCKEY_DIMS } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface TubeWireProps {
  start: readonly [number, number, number];
  end: readonly [number, number, number];
  via?: ReadonlyArray<readonly [number, number, number]>;
  sag?: number;
  color?: string;
  radius?: number;
  quality: QualityTier;
  followJockeyState?: { current: MeterBridgeVisualState };
}

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _p3 = new THREE.Vector3();
const _center = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _prevTangent = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _rotAxis = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
const _upX = new THREE.Vector3(1, 0, 0);

function updateDynamicTubeGeometry(
  geo: THREE.TubeGeometry,
  tubularSegments: number,
  radialSegments: number,
  radius: number,
  sx: number,
  sy: number,
  sz: number,
  ex: number,
  ey: number,
  ez: number,
): void {
  const posAttr = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  const normAttr = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!posAttr || !normAttr) return;

  const dx = ex - sx;
  const dz = ez - sz;
  const peakY = Math.max(sy, ey) + 0.055;

  _p0.set(sx, sy, sz);
  _p1.set(sx + dx * 0.25, peakY, sz + dz * 0.3);
  _p2.set(sx + dx * 0.75, ey + 0.05, sz + dz * 0.75);
  _p3.set(ex, ey, ez);

  const stride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const u = 1 - t;

    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;

    _center.set(
      b0 * _p0.x + b1 * _p1.x + b2 * _p2.x + b3 * _p3.x,
      b0 * _p0.y + b1 * _p1.y + b2 * _p2.y + b3 * _p3.y,
      b0 * _p0.z + b1 * _p1.z + b2 * _p2.z + b3 * _p3.z,
    );

    const d0 = 3 * u * u;
    const d1 = 6 * u * t;
    const d2 = 3 * t * t;

    _tangent
      .set(
        d0 * (_p1.x - _p0.x) + d1 * (_p2.x - _p1.x) + d2 * (_p3.x - _p2.x),
        d0 * (_p1.y - _p0.y) + d1 * (_p2.y - _p1.y) + d2 * (_p3.y - _p2.y),
        d0 * (_p1.z - _p0.z) + d1 * (_p2.z - _p1.z) + d2 * (_p3.z - _p2.z),
      )
      .normalize();

    if (i === 0) {
      const refUp = Math.abs(_tangent.y) < 0.9 ? _upY : _upX;
      _binormal.crossVectors(_tangent, refUp).normalize();
      _normal.crossVectors(_binormal, _tangent).normalize();
    } else {
      _rotAxis.crossVectors(_prevTangent, _tangent);
      if (_rotAxis.lengthSq() > 1e-10) {
        _rotAxis.normalize();
        const dot = Math.max(-1, Math.min(1, _prevTangent.dot(_tangent)));
        _normal.applyAxisAngle(_rotAxis, Math.acos(dot));
      }
      _normal.addScaledVector(_tangent, -_normal.dot(_tangent)).normalize();
      _binormal.crossVectors(_tangent, _normal).normalize();
    }
    _prevTangent.copy(_tangent);

    const baseIdx = i * stride;
    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cx = -Math.cos(angle);
      const cy = Math.sin(angle);
      const nx = cx * _normal.x + cy * _binormal.x;
      const ny = cx * _normal.y + cy * _binormal.y;
      const nz = cx * _normal.z + cy * _binormal.z;
      const vIdx = baseIdx + j;
      posAttr.setXYZ(
        vIdx,
        _center.x + radius * nx,
        _center.y + radius * ny,
        _center.z + radius * nz,
      );
      normAttr.setXYZ(vIdx, nx, ny, nz);
    }
  }

  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
}

export function TubeWire({
  start,
  end,
  via,
  sag = -0.012,
  color = "#991b1b",
  radius = 0.0024,
  quality,
  followJockeyState,
}: TubeWireProps) {
  const prevJockeyRef = useRef<{ cm: number; down: boolean }>({
    cm: Number.NaN,
    down: false,
  });

  const jockeyTopOffset =
    JOCKEY_DIMS.bladeHeight + JOCKEY_DIMS.collarHeight + JOCKEY_DIMS.handleHeight + 0.008;

  const res = useMemo(() => {
    const tubularSegments = quality === "low" ? 20 : 40;
    const radialSegments = quality === "low" ? 6 : 12;

    const pts: THREE.Vector3[] = [new THREE.Vector3(start[0], start[1], start[2])];
    if (via && via.length > 0) {
      for (const p of via) {
        pts.push(new THREE.Vector3(p[0], p[1], p[2]));
      }
    } else {
      const midX = (start[0] + end[0]) / 2;
      const midY = Math.max(0.004, (start[1] + end[1]) / 2 + sag);
      const midZ = (start[2] + end[2]) / 2;
      pts.push(new THREE.Vector3(midX, midY, midZ));
    }
    pts.push(new THREE.Vector3(end[0], end[1], end[2]));

    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.1,
    });

    prevJockeyRef.current.cm = Number.NaN;

    return { geo, mat, tubularSegments, radialSegments };
  }, [start, end, via, sag, color, radius, quality]);

  useEffect(() => {
    return () => {
      res.geo.dispose();
      res.mat.dispose();
    };
  }, [res]);

  useFrame(() => {
    if (!followJockeyState) return;
    const st = followJockeyState.current;
    if (prevJockeyRef.current.cm === st.jockeyCm && prevJockeyRef.current.down === st.jockeyDown) {
      return;
    }
    prevJockeyRef.current.cm = st.jockeyCm;
    prevJockeyRef.current.down = st.jockeyDown;

    const ex = cmToX(st.jockeyCm);
    const ey =
      BRIDGE_WIRE.y +
      BRIDGE_WIRE.renderRadius +
      (st.jockeyDown ? 0 : JOCKEY_DIMS.liftOffset) +
      jockeyTopOffset;
    const ez = BRIDGE_WIRE.z;

    updateDynamicTubeGeometry(
      res.geo,
      res.tubularSegments,
      res.radialSegments,
      radius,
      start[0],
      start[1],
      start[2],
      ex,
      ey,
      ez,
    );
  });

  return <mesh geometry={res.geo} material={res.mat} castShadow />;
}
