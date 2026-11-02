import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { RETORT_STAND_DIMS } from "./dimensions";

/**
 * The cast-iron base of the retort stand: a rounded plan with a bevelled edge. The geometry is
 * centred on its own origin in height (y from -baseHeight/2 to +baseHeight/2), so a mesh placed at
 * y = baseHeight/2 stands on the desk with its underside at exactly y = 0.
 */
export function createRetortBaseGeometry(quality: QualityTier): THREE.ExtrudeGeometry {
  const bev = 0.003;
  const hw = RETORT_STAND_DIMS.baseWidth / 2 - bev;
  const hd = RETORT_STAND_DIMS.baseDepth / 2 - bev;
  const rc = 0.012;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + rc, -hd);
  shape.lineTo(hw - rc, -hd);
  shape.absarc(hw - rc, -hd + rc, rc, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hd - rc);
  shape.absarc(hw - rc, hd - rc, rc, 0, Math.PI / 2, false);
  shape.lineTo(-hw + rc, hd);
  shape.absarc(-hw + rc, hd - rc, rc, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hd + rc);
  shape.absarc(-hw + rc, -hd + rc, rc, Math.PI, Math.PI * 1.5, false);
  const depth = RETORT_STAND_DIMS.baseHeight - 2 * bev;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: quality === "low" ? 1 : 3,
    curveSegments: quality === "low" ? 4 : 8,
  });
  // The extrusion spans z in [-bev, depth + bev]; after rotateX(-pi/2) that is y, so its centre
  // (depth / 2) is moved back down to 0.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth / 2, 0);
  return geo;
}
