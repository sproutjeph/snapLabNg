import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cmToX } from "../apparatus/meter-bridge/dimensions";
import type { MeterBridgeVisualState } from "../apparatus/meter-bridge/types";
import { loupePose, type Pose } from "./loupe";

/** What the HUD writes: whether the close-up is on, and where her eye is (degrees). */
export interface LoupeState {
  on: boolean;
  eyeDeg: number;
}

/**
 * The close-up on the metre rule at the jockey. The camera eases to just above the wire and
 * leans left or right with `eyeDeg`: looked at from the side, the jockey's edge lines up
 * with a different mark on the rule (parallax, docs/15 §2). Nothing is computed here: the
 * shift is the real 3D offset between the wire and the scale.
 */
export function RuleLoupe({
  loupe,
  state,
  onReturned,
  home,
}: {
  loupe: { current: LoupeState };
  state: { current: MeterBridgeVisualState };
  /** Called once the camera is back at the bench view after the close-up is closed. */
  onReturned: () => void;
  home: { position: THREE.Vector3; target: THREE.Vector3 };
}) {
  const camera = useThree((s) => s.camera);
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      look: new THREE.Vector3(),
      pose: { position: [0, 0, 0], target: [0, 0, 0] } as Pose,
    }),
    [],
  );
  const s = useRef({ active: false, returning: false });

  useFrame((_, dt) => {
    const l = loupe.current;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    if (l.on) {
      if (!s.current.active) {
        s.current.active = true;
        s.current.returning = false;
        v.look.copy(home.target);
      }
      const p = loupePose(cmToX(state.current.jockeyCm), l.eyeDeg, v.pose);
      v.target.set(p.target[0], p.target[1], p.target[2]);
      v.pos.set(p.position[0], p.position[1], p.position[2]);
      camera.position.lerp(v.pos, k);
      v.look.lerp(v.target, k);
      camera.lookAt(v.look);
      return;
    }
    if (s.current.active) {
      s.current.active = false;
      s.current.returning = true;
    }
    if (s.current.returning) {
      camera.position.lerp(home.position, k);
      v.look.lerp(home.target, k);
      camera.lookAt(v.look);
      if (camera.position.distanceTo(home.position) < 0.005) {
        camera.position.copy(home.position);
        camera.lookAt(home.target);
        s.current.returning = false;
        onReturned();
      }
    }
  });
  return null;
}
