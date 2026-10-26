import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PerspectiveCamera } from "three";

const BASE_DISTANCE = Math.hypot(5.5, 4.5);
const DIR_Y = 5.5 / BASE_DISTANCE;
const DIR_Z = 4.5 / BASE_DISTANCE;

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const distance = BASE_DISTANCE / Math.min(aspect, 1);
    camera.position.set(0, DIR_Y * distance, DIR_Z * distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}
