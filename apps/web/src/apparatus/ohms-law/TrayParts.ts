import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import {
  makeCrocClipGeometries,
  makePlugGeometries,
  mergeAll,
  PLUG_HEIGHT_M,
  placeAlong,
  placeAt,
} from "./LeadParts";

// The geometry of the side tray, built once and merged per (item, ink id, material). Metres,
// local to the tray: x right, z toward the student, y up from the desk. The tray floor is at
// FLOOR_Y. Ink ids use the tray's block (INK_IDS.tray + offset).

export type TrayItemKey = "leads" | "sandpaper" | "rheostat" | "micrometer";
export type TrayMat =
  | "tray"
  | "red"
  | "black"
  | "yellow"
  | "brass"
  | "steel"
  | "jaw"
  | "boot"
  | "grit"
  | "ceramic"
  | "ebonite"
  | "microSteel"
  | "microDark";

export interface TrayPart {
  /** The tappable item this belongs to; null for the tray itself. */
  item: TrayItemKey | null;
  /** Offset into the tray's block of ink ids (0 = the tray body). */
  ink: number;
  thin: boolean;
  mat: TrayMat;
  geo: THREE.BufferGeometry;
}

export const TRAY_SIZE = { x: 0.26, z: 0.34 } as const;
export const FLOOR_Y = 0.004;
const WALL_H = 0.014;
const RHEO_X = -0.075;

export interface TrayBuild {
  parts: TrayPart[];
  /** One torus; the rheostat's winding is this, instanced at `coilMatrices`. */
  coilGeo: THREE.BufferGeometry;
  coilMatrices: THREE.Matrix4[];
  /** Where the invisible tap boxes sit: centre and size per item. */
  hits: Array<{
    item: TrayItemKey;
    centre: [number, number, number];
    size: [number, number, number];
  }>;
}

class Acc {
  private map = new Map<string, { part: Omit<TrayPart, "geo">; geos: THREE.BufferGeometry[] }>();
  add(
    item: TrayItemKey | null,
    ink: number,
    thin: boolean,
    mat: TrayMat,
    geo: THREE.BufferGeometry,
  ) {
    const key = `${item}|${ink}|${thin}|${mat}`;
    const e = this.map.get(key) ?? { part: { item, ink, thin, mat }, geos: [] };
    e.geos.push(geo);
    this.map.set(key, e);
  }
  done(): TrayPart[] {
    return [...this.map.values()].map((e) => ({ ...e.part, geo: mergeAll(e.geos) }));
  }
}

/** A loose spiral on the tray floor: a lead coiled up, as spare leads are kept. */
function spiral(
  rng: () => number,
  cx: number,
  cz: number,
  r0: number,
  r1: number,
  turns: number,
  phase: number,
  y0: number,
): THREE.Vector3[] {
  const n = Math.round(turns * 14);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = phase + u * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * u;
    pts.push(
      new THREE.Vector3(
        cx + Math.cos(a) * r * 0.95 + (rng() - 0.5) * 0.002,
        y0 + 0.0031 * u * turns,
        cz + Math.sin(a) * r + (rng() - 0.5) * 0.002,
      ),
    );
  }
  return pts;
}

export function buildTray(quality: QualityTier, rng: () => number): TrayBuild {
  const low = quality === "low";
  const acc = new Acc();
  const dir = new THREE.Vector3();
  const at = new THREE.Vector3();

  // The tray: a shallow enamelled pan.
  acc.add(
    null,
    0,
    false,
    "tray",
    mergeAll([
      placeAt(new THREE.BoxGeometry(TRAY_SIZE.x, 0.004, TRAY_SIZE.z), 0, 0.002, 0),
      placeAt(
        new THREE.BoxGeometry(TRAY_SIZE.x, WALL_H, 0.004),
        0,
        WALL_H / 2,
        TRAY_SIZE.z / 2 - 0.002,
      ),
      placeAt(
        new THREE.BoxGeometry(TRAY_SIZE.x, WALL_H, 0.004),
        0,
        WALL_H / 2,
        -TRAY_SIZE.z / 2 + 0.002,
      ),
      placeAt(
        new THREE.BoxGeometry(0.004, WALL_H, TRAY_SIZE.z),
        TRAY_SIZE.x / 2 - 0.002,
        WALL_H / 2,
        0,
      ),
      placeAt(
        new THREE.BoxGeometry(0.004, WALL_H, TRAY_SIZE.z),
        -TRAY_SIZE.x / 2 + 0.002,
        WALL_H / 2,
        0,
      ),
    ]),
  );

  // Spare leads: two coiled with crocodile clips at both ends, one with banana plugs.
  const clipProto = makeCrocClipGeometries();
  const plugProto = makePlugGeometries(quality);
  const leadSpecs: Array<{ pts: THREE.Vector3[]; mat: TrayMat; clips: boolean; ink: number }> = [
    {
      pts: spiral(rng, 0.058, 0.092, 0.047, 0.035, 1.6, 0.4, FLOOR_Y + 0.0017),
      mat: "red",
      clips: true,
      ink: 1,
    },
    {
      pts: spiral(rng, 0.064, 0.088, 0.034, 0.024, 1.5, 2.5, FLOOR_Y + 0.0052),
      mat: "black",
      clips: true,
      ink: 2,
    },
    {
      pts: [
        new THREE.Vector3(0.012, FLOOR_Y + 0.0017, 0.0),
        new THREE.Vector3(0.04, FLOOR_Y + 0.0017, 0.013),
        new THREE.Vector3(0.072, FLOOR_Y + 0.0017, -0.011),
        new THREE.Vector3(0.1, FLOOR_Y + 0.0017, 0.004),
      ],
      mat: "yellow",
      clips: false,
      ink: 1,
    },
  ];
  for (const spec of leadSpecs) {
    const curve = new THREE.CatmullRomCurve3(spec.pts, false, "centripetal");
    const tube = new THREE.TubeGeometry(curve, low ? 50 : 100, 0.0015, low ? 5 : 7, false);
    acc.add("leads", spec.ink, false, spec.mat, tube);
    for (const end of [0, 1]) {
      curve.getPoint(end, at);
      curve.getTangent(end, dir);
      if (end === 0) dir.negate(); // outward from the lead
      if (spec.clips) {
        acc.add("leads", 3, true, "boot", placeAlong(clipProto.boot.clone(), at, dir));
        acc.add("leads", 3, true, "jaw", placeAlong(clipProto.jaws.clone(), at, dir));
      } else {
        // A plug lies with its pin along `dir` and its cable entry at the lead's end.
        const origin = at.clone().addScaledVector(dir, PLUG_HEIGHT_M);
        const inward = dir.clone().negate();
        acc.add("leads", 3, true, spec.mat, placeAlong(plugProto.body.clone(), origin, inward));
        acc.add("leads", 3, true, "brass", placeAlong(plugProto.pin.clone(), origin, inward));
      }
    }
  }
  clipProto.boot.dispose();
  clipProto.jaws.dispose();
  plugProto.body.dispose();
  plugProto.pin.dispose();

  // Sandpaper: a thin strip, a little askew.
  acc.add(
    "sandpaper",
    4,
    false,
    "grit",
    placeAt(
      new THREE.BoxGeometry(0.09, 0.0012, 0.045),
      0.065,
      FLOOR_Y + 0.0006,
      -0.052,
      0,
      0.14,
      0,
    ),
  );

  // Rheostat: a ceramic tube wound with resistance wire, on two ebonite end blocks, with a
  // sliding contact on a bar above. Identify only: it is not part of the circuit.
  const seg = low ? 12 : 24;
  const tubeY = FLOOR_Y + 0.032;
  const tube = new THREE.CylinderGeometry(0.017, 0.017, 0.216, seg);
  tube.rotateX(Math.PI / 2);
  acc.add("rheostat", 5, false, "ceramic", placeAt(tube, RHEO_X, tubeY, 0));
  const blocks: THREE.BufferGeometry[] = [];
  const bolts: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    blocks.push(
      placeAt(new THREE.BoxGeometry(0.044, 0.07, 0.012), RHEO_X, FLOOR_Y + 0.035, sz * 0.114),
    );
    bolts.push(
      placeAt(
        new THREE.CylinderGeometry(0.0048, 0.0048, 0.01, low ? 8 : 12),
        RHEO_X,
        FLOOR_Y + 0.075,
        sz * 0.114,
      ),
    );
  }
  acc.add("rheostat", 7, false, "ebonite", mergeAll(blocks));
  const rod = new THREE.CylinderGeometry(0.0028, 0.0028, 0.24, low ? 8 : 10);
  rod.rotateX(Math.PI / 2);
  bolts.push(placeAt(rod, RHEO_X, FLOOR_Y + 0.064, 0));
  // Slider: a carriage on the bar, a brass contact down to the winding, an ebonite knob.
  const sliderZ = 0.036;
  bolts.push(
    placeAt(new THREE.BoxGeometry(0.008, 0.01, 0.012), RHEO_X, FLOOR_Y + 0.0525, sliderZ),
    placeAt(new THREE.BoxGeometry(0.02, 0.016, 0.022), RHEO_X, FLOOR_Y + 0.0655, sliderZ),
  );
  acc.add("rheostat", 7, true, "brass", mergeAll(bolts));
  acc.add(
    "rheostat",
    7,
    false,
    "ebonite",
    placeAt(
      new THREE.CylinderGeometry(0.0075, 0.0085, 0.012, low ? 8 : 14),
      RHEO_X,
      FLOOR_Y + 0.0795,
      sliderZ,
    ),
  );

  // The winding: one torus, instanced along the tube.
  const coilGeo = new THREE.TorusGeometry(0.0178, 0.001, 4, low ? 10 : 18);
  const coilN = low ? 22 : 42;
  const coilMatrices: THREE.Matrix4[] = [];
  for (let i = 0; i < coilN; i++) {
    const z = -0.097 + (0.194 * i) / (coilN - 1);
    coilMatrices.push(new THREE.Matrix4().makeTranslation(RHEO_X, tubeY, z));
  }

  // Micrometer screw gauge, low detail: a U frame, anvil, spindle, barrel, thimble and ratchet.
  const mseg = low ? 10 : 18;
  const frameShape = new THREE.Shape();
  frameShape.absarc(0, 0, 0.03, Math.PI, 2 * Math.PI, false);
  frameShape.absarc(0, 0, 0.024, 2 * Math.PI, Math.PI, true);
  frameShape.closePath();
  const frame = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.012,
    bevelEnabled: false,
    curveSegments: low ? 8 : 16,
  });
  frame.rotateX(-Math.PI / 2);
  const axis = (r0: number, r1: number, x0: number, x1: number, segs: number) => {
    const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, segs);
    g.rotateZ(Math.PI / 2);
    return placeAt(g, (x0 + x1) / 2, 0.006, 0);
  };
  const microFrame = mergeAll([
    frame,
    placeAt(new THREE.BoxGeometry(0.008, 0.012, 0.012), -0.0265, 0.006, 0),
    placeAt(new THREE.BoxGeometry(0.008, 0.012, 0.012), 0.0265, 0.006, 0),
  ]);
  const microSteel = mergeAll([
    axis(0.0035, 0.0035, -0.03, -0.008, mseg),
    axis(0.0028, 0.0028, -0.002, 0.03, mseg),
    axis(0.0055, 0.0055, 0.03, 0.075, mseg),
  ]);
  const microDark = mergeAll([
    axis(0.0095, 0.0095, 0.05, 0.088, mseg),
    axis(0.0075, 0.0078, 0.088, 0.1, mseg),
  ]);
  const place = (g: THREE.BufferGeometry) => {
    g.scale(0.85, 0.85, 0.85);
    return placeAt(g, 0.0375, FLOOR_Y, -0.125, 0, -0.06, 0);
  };
  acc.add("micrometer", 8, false, "microSteel", place(microFrame));
  acc.add("micrometer", 9, false, "microSteel", place(microSteel));
  acc.add("micrometer", 9, false, "microDark", place(microDark));

  return {
    parts: acc.done(),
    coilGeo,
    coilMatrices,
    hits: [
      { item: "leads", centre: [0.06, 0.012, 0.085], size: [0.13, 0.03, 0.14] },
      { item: "micrometer", centre: [0.07, 0.016, -0.125], size: [0.12, 0.03, 0.06] },
      { item: "sandpaper", centre: [0.065, 0.008, -0.052], size: [0.09, 0.016, 0.05] },
    ],
  };
}
