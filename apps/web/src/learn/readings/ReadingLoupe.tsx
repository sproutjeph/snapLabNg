import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DIAL } from "../../apparatus/ohms-law/MeterDial";
import { fitDistance, type LoupeTarget, meterPose, newPose, type RuleEnd, rulePose } from "./poses";

export interface ReadingLoupeProps {
  /** Which close-up is open; null eases the camera back to where it was. */
  target: LoupeTarget | null;
  /** Her eye, degrees to the side of square (±30). Read every frame. */
  eyeDeg: number;
  /** For target "rule": which end of the wire to look at. */
  ruleEnd?: RuleEnd;
  /** The wire's place on the rule; needed for target "rule". */
  wire?: { startCm: number; lengthCm: number };
  /** Called once the camera is back after a close-up. */
  onReturned?: () => void;
}

/**
 * The close-up camera for reading a meter or the rule. It eases in straight in front of the dial
 * (or over the rule), and the eye angle swings it sideways about that point. The needle floats
 * above the dial, so the parallax is real 3D, not a trick. Nothing here reads a value.
 * Put it inside the Canvas. The host must unmount or disable its OrbitControls until
 * `onReturned` (as LabBench does), or the controls fight the camera. With prefers-reduced-motion the camera jumps instead of easing.
 */
export function ReadingLoupe({
  target,
  eyeDeg,
  ruleEnd = "X",
  wire,
  onReturned,
}: ReadingLoupeProps) {
  const camera = useThree((s) => s.camera);
  const live = useRef({ target, eyeDeg, ruleEnd, wire });
  live.current = { target, eyeDeg, ruleEnd, wire };
  const reduced = useRef(false);
  const phase = useRef<"idle" | "active" | "returning">("idle");
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      aim: new THREE.Vector3(),
      look: new THREE.Vector3(),
      homePos: new THREE.Vector3(),
      homeLook: new THREE.Vector3(),
      pose: newPose(),
    }),
    [],
  );

  // Closed before any frame saw the target: the camera never left home, so it is back already.
  useEffect(() => {
    if (target === null && phase.current === "idle") onReturned?.();
  }, [target, onReturned]);
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useFrame((st, dt) => {
    const l = live.current;
    const k = reduced.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    if (l.target) {
      if (phase.current !== "active") {
        if (phase.current === "idle") {
          v.homePos.copy(camera.position);
          camera.getWorldDirection(v.homeLook).multiplyScalar(1).add(camera.position);
          v.look.copy(v.homeLook);
        }
        phase.current = "active";
      }
      const cam = st.camera as THREE.PerspectiveCamera;
      const aspect = st.size.width / Math.max(st.size.height, 1);
      const fov = cam.fov ?? 40;
      if (l.target === "rule") {
        const d = fitDistance(0.12, 0.07, fov, aspect);
        rulePose(l.wire ?? { startCm: 0, lengthCm: 0 }, l.ruleEnd, l.eyeDeg, d, v.pose);
      } else {
        const d = fitDistance(DIAL.width + 0.012, DIAL.height + 0.01, fov, aspect);
        meterPose(l.target, l.eyeDeg, d, v.pose);
      }
      v.pos.set(v.pose.position[0], v.pose.position[1], v.pose.position[2]);
      v.aim.set(v.pose.target[0], v.pose.target[1], v.pose.target[2]);
      camera.position.lerp(v.pos, k);
      v.look.lerp(v.aim, k);
      camera.lookAt(v.look);
      return;
    }
    if (phase.current === "active") phase.current = "returning";
    if (phase.current === "returning") {
      camera.position.lerp(v.homePos, k);
      v.look.lerp(v.homeLook, k);
      camera.lookAt(v.look);
      if (camera.position.distanceTo(v.homePos) < 0.003) {
        camera.position.copy(v.homePos);
        camera.lookAt(v.homeLook);
        phase.current = "idle";
        onReturned?.();
      }
    }
  });
  return null;
}
