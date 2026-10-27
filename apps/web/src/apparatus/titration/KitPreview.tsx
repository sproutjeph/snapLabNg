import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ReadySignal } from "../../scene/ReadySignal";
import TitrationKit from "./TitrationKit";
import type { TitrationVisualState } from "./types";

const TARGET_Y = 0.42;
const BASE_DIST = 1.62;

// Demo stand-in for the science engine (docs/plans/titration-kit.md §KitPreview):
// Fades phenolphthalein indicator in sodium trioxocarbonate(IV) / tetraoxosulphate(VI)
// titration from pink to colourless as the burette reading passes 24.00 cm³.
function demoFlaskColorForReading(readingCm3: number): [number, number, number] {
  const pink: [number, number, number] = [0.92, 0.18, 0.56];
  const colourless: [number, number, number] = [0.86, 0.94, 0.98];
  // Smooth transition between 23.60 cm³ and 24.10 cm³
  const t = Math.min(1, Math.max(0, (readingCm3 - 23.6) / 0.5));
  return [
    pink[0] + (colourless[0] - pink[0]) * t,
    pink[1] + (colourless[1] - pink[1]) * t,
    pink[2] + (colourless[2] - pink[2]) * t,
  ];
}

function PreviewCameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const scale = aspect < 1 ? Math.max(1.05, 0.58 / Math.max(aspect, 0.3)) : 1.0;
    const dist = BASE_DIST * scale;
    const targetY = aspect < 1 ? TARGET_Y - 0.04 : TARGET_Y + 0.02;
    camera.position.set(0.14 * scale, targetY + 0.12, dist);
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
    if (controls && "update" in controls && typeof controls.update === "function") {
      controls.update();
    }
  }, [camera, controls, size.width, size.height]);

  return null;
}

function PreviewBench() {
  const benchRes = useMemo(() => {
    const geo = new THREE.BoxGeometry(1.4, 0.04, 0.9);
    const mat = new THREE.MeshStandardMaterial({
      color: "#2b2118",
      roughness: 0.78,
      metalness: 0.04,
    });
    return { geo, mat };
  }, []);

  useEffect(() => {
    return () => {
      benchRes.geo.dispose();
      benchRes.mat.dispose();
    };
  }, [benchRes]);

  return (
    <mesh
      geometry={benchRes.geo}
      material={benchRes.mat}
      position={[0, -0.02, -0.02]}
      receiveShadow
    />
  );
}

interface DemoSceneProps {
  visualRef: { current: TitrationVisualState };
  swirlTimerRef: { current: number };
  onStopcockChange: (open: number) => void;
  onSwirl: () => void;
  onFunnelToggle: () => void;
  onHudSync: (reading: number, funnelOn: boolean) => void;
}

function DemoScene({
  visualRef,
  swirlTimerRef,
  onStopcockChange,
  onSwirl,
  onFunnelToggle,
  onHudSync,
}: DemoSceneProps) {
  const dropAccumRef = useRef(0);
  const hudTimerRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const cur = visualRef.current;

    if (cur.stopcockOpen > 0 && cur.buretteReadingCm3 < 50) {
      cur.dropping = true;
      // ~8 drops per second while held open, 0.05 cm³ per drop
      dropAccumRef.current += dt * 8 * cur.stopcockOpen;
      while (dropAccumRef.current >= 1 && cur.buretteReadingCm3 < 50) {
        dropAccumRef.current -= 1;
        cur.buretteReadingCm3 = Math.min(50, +(cur.buretteReadingCm3 + 0.05).toFixed(2));
        cur.flaskVolumeCm3 = Math.min(250, +(25 + cur.buretteReadingCm3).toFixed(2));
        cur.flaskColor = demoFlaskColorForReading(cur.buretteReadingCm3);
      }
    } else {
      cur.dropping = false;
      dropAccumRef.current = 0;
    }

    if (swirlTimerRef.current > 0) {
      swirlTimerRef.current = Math.max(0, swirlTimerRef.current - dt / 1.1);
      cur.swirlPhase = 1 - swirlTimerRef.current;
      if (swirlTimerRef.current === 0) {
        cur.swirlPhase = 0;
      }
    }

    hudTimerRef.current += dt;
    if (hudTimerRef.current >= 0.08) {
      hudTimerRef.current = 0;
      onHudSync(cur.buretteReadingCm3, cur.funnelOn);
    }
  });

  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <hemisphereLight args={["#f8fafc", "#3f2e21", 0.95]} />
      <directionalLight
        position={[1.1, 2.0, 1.5]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-0.8}
        shadow-camera-right={0.8}
        shadow-camera-top={1.2}
        shadow-camera-bottom={-0.2}
      />
      <directionalLight position={[-1.0, 1.3, -0.9]} intensity={0.85} />
      <PreviewCameraRig />
      <OrbitControls target={[0, TARGET_Y, 0]} makeDefault />
      <PreviewBench />
      <TitrationKit
        state={visualRef}
        quality="high"
        onStopcockChange={onStopcockChange}
        onSwirl={onSwirl}
        onFunnelToggle={onFunnelToggle}
      />
      <ReadySignal />
    </>
  );
}

export default function KitPreview() {
  const visualRef = useRef<TitrationVisualState>({
    buretteReadingCm3: 0.0,
    stopcockOpen: 0,
    dropping: false,
    flaskVolumeCm3: 25.0,
    flaskColor: demoFlaskColorForReading(0),
    swirlPhase: 0,
    funnelOn: true,
  });
  const swirlTimerRef = useRef(0);

  const [readingText, setReadingText] = useState("0.00");
  const [funnelOn, setFunnelOn] = useState(true);

  const handleStopcockChange = useCallback((open: number) => {
    visualRef.current.stopcockOpen = Math.min(1, Math.max(0, open));
    if (open <= 0) {
      visualRef.current.dropping = false;
    }
  }, []);

  const handleSwirl = useCallback(() => {
    swirlTimerRef.current = 1;
  }, []);

  const handleFunnelToggle = useCallback(() => {
    const next = !visualRef.current.funnelOn;
    visualRef.current.funnelOn = next;
    setFunnelOn(next);
  }, []);

  const handleReset = useCallback(() => {
    visualRef.current.buretteReadingCm3 = 0;
    visualRef.current.flaskVolumeCm3 = 25;
    visualRef.current.flaskColor = demoFlaskColorForReading(0);
    visualRef.current.stopcockOpen = 0;
    visualRef.current.dropping = false;
    setReadingText("0.00");
  }, []);

  const handleHudSync = useCallback((reading: number, isFunnelOn: boolean) => {
    setReadingText(reading.toFixed(2));
    setFunnelOn(isFunnelOn);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 38, position: [0.14, TARGET_Y + 0.12, BASE_DIST], near: 0.02, far: 20 }}
      >
        <DemoScene
          visualRef={visualRef}
          swirlTimerRef={swirlTimerRef}
          onStopcockChange={handleStopcockChange}
          onSwirl={handleSwirl}
          onFunnelToggle={handleFunnelToggle}
          onHudSync={handleHudSync}
        />
      </Canvas>

      {/* Demo HUD controls */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          padding: "7px 11px",
          borderRadius: 10,
          background: "rgba(15, 23, 42, 0.86)",
          border: "1px solid rgba(148, 163, 184, 0.28)",
          color: "#f8fafc",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12,
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: 600, marginRight: 4 }}>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{readingText} cm³</strong>
        </span>
        <button
          type="button"
          onPointerDown={() => handleStopcockChange(1)}
          onPointerUp={() => handleStopcockChange(0)}
          onPointerLeave={() => handleStopcockChange(0)}
          style={{
            padding: "5px 9px",
            borderRadius: 6,
            border: "1px solid #3b82f6",
            background: "#1d4ed8",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Hold Stopcock
        </button>
        <button
          type="button"
          onClick={handleSwirl}
          style={{
            padding: "5px 9px",
            borderRadius: 6,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#f8fafc",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Swirl
        </button>
        <button
          type="button"
          onClick={handleFunnelToggle}
          style={{
            padding: "5px 9px",
            borderRadius: 6,
            border: "1px solid #475569",
            background: funnelOn ? "#334155" : "#0f172a",
            color: "#f8fafc",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Funnel: {funnelOn ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid #475569",
            background: "transparent",
            color: "#cbd5e1",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Refill
        </button>
      </div>
    </div>
  );
}
