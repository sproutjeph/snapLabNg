import type { DeviceSignals } from "./tier";

function readGpu(): string | null {
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return null;
    let renderer: string | null = null;
    try {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const value: unknown = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (typeof value === "string" && value.length > 0) renderer = value;
      }
    } catch {
      renderer = null;
    }
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // The throwaway context is released by GC if the extension is missing.
    }
    return renderer;
  } catch {
    return null;
  } finally {
    canvas = null;
  }
}

function readDeviceMemoryGb(): number | null {
  try {
    const value: unknown = (navigator as { deviceMemory?: unknown }).deviceMemory;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readCores(): number | null {
  try {
    const value: unknown = navigator.hardwareConcurrency;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readIsMobile(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function readDeviceSignals(): DeviceSignals {
  return {
    gpu: readGpu(),
    deviceMemoryGb: readDeviceMemoryGb(),
    cores: readCores(),
    isMobile: readIsMobile(),
    warmupFps: null,
  };
}
