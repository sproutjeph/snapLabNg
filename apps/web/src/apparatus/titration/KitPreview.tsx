import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { parseOverride } from "../../quality/tier";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { NO_INK } from "../../scene/ink/inkPass";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import type { QualityTier } from "../meter-bridge/types";
import { volumeToY } from "./dimensions";
import TitrationKit from "./TitrationKit";
import type { TitrationVisualState } from "./types";

const TARGET_Y = 0.42;
const BASE_DIST = 1.62;
const ZOOM_BURETTE_READING_CM3 = 24.0;
const ZOOM_BURETTE_TARGET_Y = volumeToY(25.0);
const ZOOM_BURETTE_DIST = 0.15;

// Demo stand-in for the science engine (docs/plans/titration-kit.md §KitPreview):
// Fades phenolphthalein indicator in sodium trioxocarbonate(IV) / tetraoxosulphate(VI)
// titration from pink to colourless as the burette reading passes 24.00 cm³.
// Mutates `out` in place to avoid per-frame allocations inside useFrame.
function writeDemoFlaskColor(readingCm3: number, out: [number, number, number]): void {
  const pinkR = 0.92;
  const pinkG = 0.18;
  const pinkB = 0.56;
  const clearR = 0.86;
  const clearG = 0.94;
  const clearB = 0.98;
  // Smooth transition between 23.60 cm³ and 24.10 cm³
  const t = Math.min(1, Math.max(0, (readingCm3 - 23.6) / 0.5));
  out[0] = pinkR + (clearR - pinkR) * t;
  out[1] = pinkG + (clearG - pinkG) * t;
  out[2] = pinkB + (clearB - pinkB) * t;
}

// Hero pose for the home page still (?kit=titration&hero=1): the lower two thirds of the set,
// three-quarter view, no HUD. The burette top is cropped; the reading is pre-set so the meniscus
// and its graduations show.
const HERO_READING_CM3 = 30.0;
const HERO_FOV = 20;
const HERO_TARGET: readonly [number, number, number] = [0.0, 0.46, 0.0];
const HERO_CAM: readonly [number, number, number] = [0.85, 1.4, 2.85];

/**
 * Soft key light from the upper left (no shadow of its own; the contact blobs and the sun's
 * shadow do that) and a faint warm bounce from the right and low, on top of InkLights' sun. Hero
 * still only.
 */
function HeroLights() {
  return (
    <>
      <directionalLight position={[-1.3, 2.2, 1.4]} color="#fff4e2" intensity={1.0} />
      <directionalLight position={[1.6, 0.35, 0.9]} color="#ffd7a6" intensity={0.55} />
    </>
  );
}

// [x, z, radius x, radius z, y, opacity] of each soft contact blob under an item.
const HERO_BLOBS: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.0, 0.0, 0.1, 0.1, 0.0009, 0.34], // white tile
  [0.0, 0.0, 0.058, 0.058, 0.0092, 0.3], // flask on the tile
  [-0.06, -0.15, 0.115, 0.1, 0.0009, 0.38], // stand base
  [-0.14, -0.045, 0.06, 0.06, 0.0009, 0.34], // beaker
  [0.15, -0.03, 0.048, 0.048, 0.0009, 0.34], // small beaker
  [-0.03, 0.15, 0.2, 0.026, 0.0009, 0.3], // pipette along the front
];

/** Soft dark blobs on the desk under each item, so nothing floats on the paper. */
function HeroContactShadows() {
  const res = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
      g.addColorStop(0, "rgba(40,30,20,1)");
      g.addColorStop(0.55, "rgba(40,30,20,0.55)");
      g.addColorStop(1, "rgba(40,30,20,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    const mats = HERO_BLOBS.map(
      (b) =>
        new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          opacity: b[5],
          depthWrite: false,
        }),
    );
    return { map, geo, mats };
  }, []);
  useEffect(
    () => () => {
      res.map.dispose();
      res.geo.dispose();
      for (const m of res.mats) m.dispose();
    },
    [res],
  );
  return (
    <group>
      {res.mats.map((material, i) => {
        const b = HERO_BLOBS[i];
        if (!b) return null;
        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
            key={i}
            geometry={res.geo}
            material={material}
            position={[b[0], b[4], b[1]]}
            scale={[b[2], 1, b[3]]}
            renderOrder={-5}
            userData={{ [NO_INK]: true }}
            raycast={() => null}
          />
        );
      })}
    </group>
  );
}

function PreviewCameraRig({ zoomBurette, hero }: { zoomBurette: boolean; hero: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (zoomBurette) {
      camera.position.set(0, ZOOM_BURETTE_TARGET_Y, ZOOM_BURETTE_DIST);
      camera.lookAt(0, ZOOM_BURETTE_TARGET_Y, 0);
      camera.updateProjectionMatrix();
      if (controls && "target" in controls && controls.target instanceof THREE.Vector3) {
        controls.target.set(0, ZOOM_BURETTE_TARGET_Y, 0);
      }
      if (controls && "update" in controls && typeof controls.update === "function") {
        controls.update();
      }
      return;
    }
    if (hero) {
      camera.fov = HERO_FOV;
      camera.position.set(HERO_CAM[0], HERO_CAM[1], HERO_CAM[2]);
      camera.lookAt(HERO_TARGET[0], HERO_TARGET[1], HERO_TARGET[2]);
      camera.updateProjectionMatrix();
      if (controls && "update" in controls && typeof controls.update === "function") {
        controls.update();
      }
      return;
    }
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
  }, [camera, controls, size.width, size.height, zoomBurette, hero]);

  return null;
}

interface DemoSceneProps {
  quality: QualityTier;
  visualRef: { current: TitrationVisualState };
  swirlTimerRef: { current: number };
  zoomBurette: boolean;
  hero: boolean;
  onStopcockChange: (open: number) => void;
  onSwirl: () => void;
  onFunnelToggle: () => void;
  onHudSync: (reading: number, funnelOn: boolean) => void;
}

function DemoScene({
  quality,
  visualRef,
  swirlTimerRef,
  zoomBurette,
  hero,
  onStopcockChange,
  onSwirl,
  onFunnelToggle,
  onHudSync,
}: DemoSceneProps) {
  const dropAccumRef = useRef(0);
  const hudTimerRef = useRef(0);
  const lastHudReadingRef = useRef(-1);
  const lastHudFunnelRef = useRef(true);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const cur = visualRef.current;

    if (cur.stopcockOpen > 0 && cur.buretteReadingCm3 < 50) {
      cur.dropping = true;
      // ~8 drops per second while held open, 0.05 cm³ per drop
      dropAccumRef.current += dt * 8 * cur.stopcockOpen;
      while (dropAccumRef.current >= 1 && cur.buretteReadingCm3 < 50) {
        dropAccumRef.current -= 1;
        cur.buretteReadingCm3 = Math.min(
          50,
          Math.round((cur.buretteReadingCm3 + 0.05) * 100) / 100,
        );
        cur.flaskVolumeCm3 = Math.min(250, Math.round((25 + cur.buretteReadingCm3) * 100) / 100);
        writeDemoFlaskColor(cur.buretteReadingCm3, cur.flaskColor);
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
      if (
        cur.buretteReadingCm3 !== lastHudReadingRef.current ||
        cur.funnelOn !== lastHudFunnelRef.current
      ) {
        lastHudReadingRef.current = cur.buretteReadingCm3;
        lastHudFunnelRef.current = cur.funnelOn;
        onHudSync(cur.buretteReadingCm3, cur.funnelOn);
      }
    }
  });

  return (
    <>
      <InkLights quality={quality} />
      <PreviewCameraRig zoomBurette={zoomBurette} hero={hero} />
      <OrbitControls
        target={hero ? [...HERO_TARGET] : [0, zoomBurette ? ZOOM_BURETTE_TARGET_Y : TARGET_Y, 0]}
        makeDefault
      />
      {hero ? <HeroLights /> : null}
      <PaperDesk quality={quality} size={hero ? [3.4, 2.4] : [1.4, 0.9]} y={0} />
      {hero ? <HeroContactShadows /> : null}
      <TitrationKit
        hero={hero}
        state={visualRef}
        quality="high"
        onStopcockChange={onStopcockChange}
        onSwirl={onSwirl}
        onFunnelToggle={onFunnelToggle}
      />
      <InkComposer quality={quality} />
      <ReadySignal />
    </>
  );
}

export default function KitPreview() {
  const quality: QualityTier = parseOverride(location.search) ?? "high";
  const zoomBurette = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("zoom") === "burette";
  }, []);

  const hero = useMemo(() => new URLSearchParams(location.search).get("hero") === "1", []);

  const initialReading = zoomBurette ? ZOOM_BURETTE_READING_CM3 : hero ? HERO_READING_CM3 : 0.0;
  const initialColor: [number, number, number] = [0, 0, 0];
  writeDemoFlaskColor(hero ? 20 : initialReading, initialColor);

  const visualRef = useRef<TitrationVisualState>({
    buretteReadingCm3: initialReading,
    stopcockOpen: 0,
    dropping: false,
    // The hero still shows a deeper pink pool than the true 25 cm³ so the colour reads at card size.
    flaskVolumeCm3: hero ? 95 : 25.0 + initialReading,
    flaskColor: initialColor,
    swirlPhase: 0,
    funnelOn: true,
  });
  const swirlTimerRef = useRef(0);

  const [readingText, setReadingText] = useState(() => initialReading.toFixed(2));
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
    writeDemoFlaskColor(0, visualRef.current.flaskColor);
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
        dpr={quality === "low" ? 1 : [1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 38, position: [0.14, TARGET_Y + 0.12, BASE_DIST], near: 0.02, far: 20 }}
      >
        <DemoScene
          quality={quality}
          visualRef={visualRef}
          swirlTimerRef={swirlTimerRef}
          zoomBurette={zoomBurette}
          hero={hero}
          onStopcockChange={handleStopcockChange}
          onSwirl={handleSwirl}
          onFunnelToggle={handleFunnelToggle}
          onHudSync={handleHudSync}
        />
      </Canvas>

      {/* Demo HUD controls */}
      {hero ? null : (
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
      )}
    </div>
  );
}
