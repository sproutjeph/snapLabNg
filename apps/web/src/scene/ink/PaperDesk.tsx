import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { NO_INK } from "./inkPass";
import { INK_HEX, PAPER_HEX } from "./palette";

export interface PaperDeskProps {
  quality: QualityTier;
  /** World size of the desk top, in metres. */
  size?: readonly [number, number];
  /** Height of the desk top (y). */
  y?: number;
}

/** Ruled-line spacing on the desk, in metres. */
const RULE_M = 0.05;
const TEX_MAX = 1024;

/**
 * Faint exercise-book rules on paper, fading out towards the edges so the desk melts into the
 * paper background. Pencil-blue lines only; red ink is kept for examiner marks.
 */
function drawRules(w: number, d: number): THREE.CanvasTexture {
  const aspect = w / Math.max(d, 1e-5);
  const cw = aspect >= 1 ? TEX_MAX : Math.round(TEX_MAX * aspect);
  const ch = aspect >= 1 ? Math.round(TEX_MAX / aspect) : TEX_MAX;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = PAPER_HEX;
    ctx.fillRect(0, 0, cw, ch);
    const pxPerM = ch / Math.max(d, 1e-5);
    // At least 16 texels between rules, so a large desk does not shimmer in the distance.
    const step = Math.max(RULE_M * pxPerM, 16);
    ctx.strokeStyle = "rgba(74, 98, 140, 0.12)";
    ctx.lineWidth = Math.max(1, Math.round(ch / 512));
    for (let yPx = step * 0.5; yPx < ch; yPx += step) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yPx) + 0.5);
      ctx.lineTo(cw, Math.round(yPx) + 0.5);
      ctx.stroke();
    }
    // Fade the rules into plain paper towards the edges.
    const fade = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) / 2);
    fade.addColorStop(0, "rgba(244, 236, 220, 0)");
    fade.addColorStop(0.62, "rgba(244, 236, 220, 0)");
    fade.addColorStop(1, "rgba(244, 236, 220, 1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, cw, ch);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * The warm-paper desk under every bench (docs/plans/ink-look.md). The paper itself is unlit, so
 * it matches the --paper background exactly and its border never shows; a shadow catcher on top
 * (mid and high) takes the sun's soft shadows in ink. It writes no depth and is kept out of the
 * ink pass, so it never draws an outline. Props frozen.
 */
export function PaperDesk({ quality, size = [2.4, 1.6], y = 0 }: PaperDeskProps) {
  const [w, d] = size;
  const shadows = quality !== "low";
  const res = useMemo(() => {
    const map = drawRules(w, d);
    const geo = new THREE.PlaneGeometry(w, d);
    const mat = new THREE.MeshBasicMaterial({ map, depthWrite: false });
    // Shadows can fall past the ruled area, so the catcher is larger than the desk.
    const shadowGeo = new THREE.PlaneGeometry(w * 1.6, d * 1.6);
    const shadowMat = new THREE.ShadowMaterial({
      color: INK_HEX,
      opacity: 0.3,
      depthWrite: false,
    });
    return { map, geo, mat, shadowGeo, shadowMat };
  }, [w, d]);
  useEffect(
    () => () => {
      res.map.dispose();
      res.geo.dispose();
      res.mat.dispose();
      res.shadowGeo.dispose();
      res.shadowMat.dispose();
    },
    [res],
  );
  const noInk = { [NO_INK]: true };
  return (
    <group position-y={y}>
      <mesh
        geometry={res.geo}
        material={res.mat}
        rotation-x={-Math.PI / 2}
        renderOrder={-10}
        userData={noInk}
      />
      {shadows && (
        <mesh
          geometry={res.shadowGeo}
          material={res.shadowMat}
          rotation-x={-Math.PI / 2}
          position-y={0.0005}
          receiveShadow
          userData={noInk}
        />
      )}
    </group>
  );
}
