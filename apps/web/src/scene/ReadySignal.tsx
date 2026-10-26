import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

export function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current >= 2) return;
    frames.current += 1;
    if (frames.current === 2) window.__SNAPLAB_READY__ = true;
  });
  return null;
}
