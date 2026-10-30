import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { getLeadCurve } from "../../apparatus/ohms-law/Lead";
import { useTerminalRegistry } from "../terminals";
import type { OhmsLawBench, TerminalId } from "../types";

// Dev only: lets a browser script find things on the live stage in page px (the real-browser
// checks in a PR: tap two nuts, then the lead's middle). Never mounted in a build.

export interface StageProbe {
  /** A terminal's nut top, in page px, or null when it is not mounted. */
  terminal(id: TerminalId): [number, number] | null;
  /** The middle of bench lead `i` (in the order of visual.leads), in page px, or null. */
  leadMid(i: number): [number, number] | null;
  leads(): number;
}

declare global {
  interface Window {
    __SNAPLAB_STAGE__?: StageProbe;
  }
}

const _v = new THREE.Vector3();

export function DevProbe({ bench }: { bench: OhmsLawBench }) {
  const registry = useTerminalRegistry();
  const get = useThree((s) => s.get);
  useEffect(() => {
    const toPage = (v: THREE.Vector3): [number, number] => {
      const { camera, gl } = get();
      v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
    window.__SNAPLAB_STAGE__ = {
      terminal: (id) => (registry.worldPosition(id, _v) ? toPage(_v) : null),
      leadMid: (i) => {
        const lead = bench.visual.current.leads[i];
        const c = lead ? getLeadCurve(bench.visual, lead.id) : undefined;
        if (!c || c.count < 2) return null;
        const k = Math.floor(c.count / 2) * 3;
        // The curve is in the Lead's parent space, which is the scene's (BenchWiring's group).
        _v.set(c.points[k] ?? 0, c.points[k + 1] ?? 0, c.points[k + 2] ?? 0);
        return toPage(_v);
      },
      leads: () => bench.visual.current.leads.length,
    };
    return () => {
      delete window.__SNAPLAB_STAGE__;
    };
  }, [registry, get, bench]);
  return null;
}
