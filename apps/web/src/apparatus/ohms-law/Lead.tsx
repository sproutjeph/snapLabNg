import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useTerminalRegistry } from "../../learn/terminals";
import type { LeadColour, OhmsLawVisualState, TerminalId } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";

export interface LeadProps {
  from: TerminalId;
  /** The other terminal, or "pointer" for the rubber band while she picks the other end. */
  to: TerminalId | "pointer";
  colour: LeadColour;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** Tap the lead to remove it. */
  onTap?: () => void;
}

const COLOURS: Record<LeadColour, string> = { red: "#b3261e", black: "#1d1d1f", yellow: "#d9a400" };
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * An insulated flexible lead with plugs at both ends, sagging between two terminals (a tube on
 * a Catmull-Rom curve). Reads both ends' world positions every frame. STUB (Wave 0): a straight
 * line; apparatus slice 2 models it. Props frozen.
 */
export function Lead({ from, to, colour, state, onTap }: LeadProps) {
  const registry = useTerminalRegistry();
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COLOURS[colour] }));
  }, [colour]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  useFrame(() => {
    const okA = registry.worldPosition(from, _a);
    let okB = true;
    if (to === "pointer") _b.copy(state.current.pointer);
    else okB = registry.worldPosition(to, _b);
    line.visible = okA && okB;
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, _a.x, _a.y, _a.z);
    pos.setXYZ(1, _b.x, _b.y, _b.z);
    pos.needsUpdate = true;
  });
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onTap?.();
  };
  return <primitive object={line} onPointerDown={onDown} />;
}
