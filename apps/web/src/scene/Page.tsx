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
    ctx.fillStyle = "#f6f2e6";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(70, 110, 190, 0.35)";
    ctx.lineWidth = 2;
    for (let y = 160; y < H - 40; y += 56) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(200, 40, 40, 0.7)";
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
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[2.1, 2.97]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
}
