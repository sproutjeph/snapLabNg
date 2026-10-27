import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ReadySignal } from "../scene/ReadySignal";
import { ContextLossOverlay } from "./ContextLossOverlay";
import { QualityMonitor } from "./QualityMonitor";
import { QualityProvider, useQuality } from "./QualityProvider";

const INSTANCE_COUNT = 300;

function StressInstances() {
  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
    const inst = new THREE.InstancedMesh(geo, mat, INSTANCE_COUNT);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let index = 0;
    for (let x = 0; x < 10; x += 1) {
      for (let y = 0; y < 6; y += 1) {
        for (let z = 0; z < 5; z += 1) {
          dummy.position.set((x - 4.5) * 0.22, (y - 2.5) * 0.22, (z - 2) * 0.22);
          dummy.updateMatrix();
          inst.setMatrixAt(index, dummy.matrix);
          color.setHSL(index / INSTANCE_COUNT, 0.65, 0.55);
          inst.setColorAt(index, color);
          index += 1;
        }
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    return inst;
  }, []);

  useEffect(() => {
    return () => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.dispose();
      } else {
        mesh.material.dispose();
      }
      mesh.dispose();
    };
  }, [mesh]);

  return <primitive object={mesh} />;
}

function StressScene() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y += delta * 0.25;
  });
  return (
    <group ref={groupRef}>
      <StressInstances />
    </group>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #334155",
  backgroundColor: "#1e293b",
  color: "#f8fafc",
  fontSize: "14px",
  cursor: "pointer",
};

function QualityPreviewInner() {
  const { tier, settings, stepDown, liteSuggested, signals } = useQuality();
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const loseExtRef = useRef<WEBGL_lose_context | null>(null);

  const rows: Array<[string, string]> = [
    ["GPU", signals?.gpu ?? "measuring…"],
    [
      "Device memory",
      signals === null
        ? "measuring…"
        : signals.deviceMemoryGb === null
          ? "unknown"
          : `${signals.deviceMemoryGb} GB`,
    ],
    [
      "CPU cores",
      signals === null ? "measuring…" : signals.cores === null ? "unknown" : String(signals.cores),
    ],
    ["Mobile (coarse pointer)", signals === null ? "measuring…" : signals.isMobile ? "yes" : "no"],
    ["Warm-up FPS", signals?.warmupFps == null ? "measuring…" : String(signals.warmupFps)],
    ["Tier", tier],
    ["DPR", `[${settings.dpr[0]}, ${settings.dpr[1]}]`],
    ["Bloom", settings.bloom ? "on" : "off"],
    ["Shadows", settings.shadows ? "on" : "off"],
    ["Max particles", String(settings.maxParticles)],
    ["Physical glass", settings.physicalGlass ? "yes" : "no"],
    ["Segments", String(settings.segments)],
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0f14",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px", flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Quality tiers preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#94a3b8", lineHeight: 1.5 }}>
          Detected signals, the chosen tier and its settings. The stress scene runs {INSTANCE_COUNT}{" "}
          instanced meshes inside the performance monitor.
        </p>
      </div>

      <div
        style={{
          padding: "8px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "6px 16px",
          flexShrink: 0,
          fontSize: "13px",
        }}
      >
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ color: "#94a3b8" }}>{label}</span>
            <strong style={{ textAlign: "right", wordBreak: "break-all" }}>{value}</strong>
          </div>
        ))}
      </div>

      {liteSuggested ? (
        <p
          style={{
            margin: "8px 20px 0",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#451a03",
            color: "#fed7aa",
            fontSize: "14px",
            flexShrink: 0,
          }}
        >
          This phone is struggling. Lite mode (2D) is suggested.
        </p>
      ) : null}

      <div style={{ position: "relative", flex: 1, minHeight: "240px", marginTop: "12px" }}>
        <Canvas
          key={canvasKey}
          dpr={settings.dpr}
          shadows={settings.shadows}
          gl={{ antialias: true }}
          camera={{ fov: 45, position: [0, 0.4, 3.4], near: 0.1, far: 30 }}
          onCreated={(state) => {
            setCanvasEl(state.gl.domElement);
            loseExtRef.current = state.gl.getContext().getExtension("WEBGL_lose_context");
          }}
        >
          <color attach="background" args={["#11151c"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 2]} intensity={1.6} />
          <QualityMonitor>
            <StressScene />
          </QualityMonitor>
          <ReadySignal />
        </Canvas>
        <ContextLossOverlay canvas={canvasEl} onReload={() => setCanvasKey((key) => key + 1)} />
      </div>

      <div
        style={{
          padding: "12px 20px 18px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={stepDown} style={btnStyle}>
          Step down
        </button>
        <button type="button" onClick={() => loseExtRef.current?.loseContext()} style={btnStyle}>
          Simulate context loss
        </button>
        <button type="button" onClick={() => loseExtRef.current?.restoreContext()} style={btnStyle}>
          Restore
        </button>
      </div>
    </div>
  );
}

export default function QualityPreview() {
  return (
    <QualityProvider>
      <QualityPreviewInner />
    </QualityProvider>
  );
}
