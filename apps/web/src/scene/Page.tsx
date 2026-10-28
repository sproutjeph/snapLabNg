import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

const W = 1024;
const H = 1448;

function drawPage(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f8f2e6";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(74, 98, 140, 0.32)";
    ctx.lineWidth = 2;
    for (let y = 160; y < H - 40; y += 56) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // The margin is pencil grey: red ink is kept for examiner marks.
    ctx.strokeStyle = "rgba(154, 149, 138, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(130, 0);
    ctx.lineTo(130, H);
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function Page() {
  const map = useMemo(drawPage, []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.1, 2.97]} />
      {/* Unlit, like the paper desk, so the page keeps its own paper colour. */}
      <meshBasicMaterial map={map} />
    </mesh>
  );
}
