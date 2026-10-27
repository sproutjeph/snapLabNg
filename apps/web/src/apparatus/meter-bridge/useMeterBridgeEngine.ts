import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { type BenchSetup, createBenchController } from "./benchController";

export type { BenchSetup } from "./benchController";

/**
 * Drives the metre bridge kit from @snaplab/engine inside the render loop, through the
 * renderer-free bench controller. `visual` is what the kit draws; the handlers change only
 * the engine's inputs.
 */
export function useMeterBridgeEngine(setup: BenchSetup) {
  const [controller] = useState(() => createBenchController(setup));
  const visual = useRef(controller.visual);

  useFrame((_, deltaS) => controller.advance(deltaS));

  return { visual, handlers: controller.handlers };
}
