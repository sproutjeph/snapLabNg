import { PART_TERMINALS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTerminalRegistry } from "../../learn/terminalRegistry";
import {
  type Frustum,
  fitShot,
  isPortrait,
  LOOK_ELEVATION_DEG,
  lookElevation,
} from "../../scene/look/LookCamera";
import {
  type Bounds,
  DEFAULT_AZ_DEG,
  type Extents,
  fillZoom,
  KIT_FILL,
  KIT_MAX_FREE_ASPECT,
  KIT_SUBJECTS,
  type KitParams,
  kitCovered,
  MACRO_LIFT_M,
  macroFreeEnd,
  parseKitParams,
  parseSubject,
  parseTerminalId,
  planKit,
  referenceFile,
  SLOT_SUBJECTS,
  screenExtents,
  shotFor,
  TURN_DEG,
  TURN_PERIOD_S,
  terminalPositions,
  turnAzimuth,
} from "./kitParams";
import {
  BENCH_FOOTPRINTS,
  type BenchFootprint,
  floorAt,
  LEAD_RADIUS_M,
  PLUG_HEIGHT_M,
} from "./LeadParts";
import { INK_IDS, OHMS_LAW_LAYOUT, TERMINAL_PART } from "./layout";

const DEG = Math.PI / 180;
const params = (search: string): KitParams => parseKitParams(search);

describe("the kit preview's parameters", () => {
  it("has the defaults of the golden frame: the whole bench from azimuth 45, nothing pinned", () => {
    expect(params("?kit=ohms-law")).toEqual({
      subject: null,
      terminal: "A+",
      azDeg: 45,
      zoom: 1,
      dpr: null,
      turn: false,
      dump: false,
      ref: false,
      leads: false,
      drawn: 1,
      deg: null,
      pen: null,
      quality: "high",
    });
    expect(DEFAULT_AZ_DEG).toBe(45);
  });

  it("frames the ten subjects and nothing else", () => {
    expect([...KIT_SUBJECTS].sort()).toEqual(
      [
        "ammeter",
        "voltmeter",
        "cells",
        "key",
        "box",
        "wire",
        "tray",
        "leads",
        "terminal",
        "desk",
      ].sort(),
    );
    for (const s of KIT_SUBJECTS) expect(params(`?kit=ohms-law&part=${s}`).subject).toBe(s);
    expect(params("?part=nonsense").subject).toBeNull();
    expect(params("?part=").subject).toBeNull();
  });

  it("takes an asset's own name for its part, as the plan's loop writes it", () => {
    expect(parseSubject("resistance-box")).toBe("box");
    expect(parseSubject("plug-key")).toBe("key");
    expect(parseSubject("cell-holder")).toBe("cells");
    expect(parseSubject("wire-board")).toBe("wire");
    expect(parseSubject("desk-props")).toBe("desk");
    expect(parseSubject("AMMETER")).toBe("ammeter");
  });

  it("names every subject's reference image once", () => {
    const files = KIT_SUBJECTS.map(referenceFile);
    expect(new Set(files).size).toBe(10);
    expect(referenceFile("box")).toBe("resistance-box.webp");
    expect(referenceFile("desk")).toBe("desk-props.webp");
  });

  it("reads a terminal id typed with a plus, which the URL turns into a space", () => {
    expect(new URLSearchParams("id=A+").get("id")).toBe("A ");
    expect(parseTerminalId("A ")).toBe("A+");
    expect(parseTerminalId("A+")).toBe("A+");
    expect(parseTerminalId("A-")).toBe("A-");
    expect(parseTerminalId("a−")).toBe("A-");
    expect(parseTerminalId("k1")).toBe("K1");
    expect(parseTerminalId("X")).toBe("X");
    expect(parseTerminalId("Z9")).toBeNull();
    expect(parseTerminalId("A")).toBeNull();
    expect(parseTerminalId(null)).toBeNull();
    for (const id of TERMINAL_IDS) expect(parseTerminalId(id)).toBe(id);
  });

  it("looks at A+ unless told another terminal", () => {
    expect(params("?part=terminal&id=A+").terminal).toBe("A+");
    expect(params("?part=terminal&id=V%2B").terminal).toBe("V+");
    expect(params("?part=terminal&id=R2").terminal).toBe("R2");
    expect(params("?part=terminal&id=nope").terminal).toBe("A+");
    expect(params("?part=terminal").terminal).toBe("A+");
  });

  it("pins the pixel ratio between 1 and 3, and leaves the ladder alone without it", () => {
    expect(params("?dpr=3").dpr).toBe(3);
    expect(params("?dpr=2").dpr).toBe(2);
    expect(params("?dpr=1.5").dpr).toBe(1.5);
    expect(params("?dpr=5").dpr).toBe(3);
    expect(params("?dpr=0.2").dpr).toBe(1);
    expect(params("?dpr=").dpr).toBeNull();
    expect(params("?dpr=abc").dpr).toBeNull();
    expect(params("?part=ammeter").dpr).toBeNull();
  });

  it("tightens the fit by 1 to 4", () => {
    expect(params("?zoom=3").zoom).toBe(3);
    expect(params("?zoom=2.5").zoom).toBe(2.5);
    expect(params("?zoom=9").zoom).toBe(4);
    expect(params("?zoom=0").zoom).toBe(1);
    expect(params("?zoom=x").zoom).toBe(1);
  });

  it("switches turn, dump and ref on only with 1", () => {
    expect(params("?turn=1").turn).toBe(true);
    expect(params("?dump=1").dump).toBe(true);
    expect(params("?ref=1").ref).toBe(true);
    for (const v of ["0", "", "true", "yes"]) {
      const p = params(`?turn=${v}&dump=${v}&ref=${v}`);
      expect([p.turn, p.dump, p.ref]).toEqual([false, false, false]);
    }
  });

  it("keeps the old parameters: az, deg, leads, drawn, pen, quality", () => {
    expect(params("?az=-45").azDeg).toBe(-45);
    expect(params("?az=15").azDeg).toBe(15);
    expect(params("?az=").azDeg).toBe(45);
    expect(params("?deg=-12.5").deg).toBe(-12.5);
    expect(params("?deg=0").deg).toBe(0);
    expect(params("?deg=").deg).toBeNull();
    expect(params("?leads=1").leads).toBe(true);
    expect(params("?leads=0").leads).toBe(false);
    expect(params("?drawn=0.5").leads).toBe(true);
    expect(params("?drawn=0.5").drawn).toBe(0.5);
    expect(params("?drawn=").drawn).toBe(1);
    expect(params("?pen=K1").pen).toBe("K1");
    expect(params("?pen=A+").pen).toBe("A+");
    expect(params("?pen=zz").pen).toBeNull();
    expect(params("?quality=low").quality).toBe("low");
    expect(params("?quality=mid").quality).toBe("mid");
    expect(params("?quality=high").quality).toBe("high");
    expect(params("?quality=ultra").quality).toBe("high");
  });

  it("draws the leads for part=leads without asking", () => {
    expect(params("?part=leads").leads).toBe(true);
  });
});

describe("the one camera", () => {
  it("keeps the golden frame's elevation on a tall phone, where LookCamera would climb to 64 degrees", () => {
    const phone = { w: 390, h: 844 };
    const none = { left: 0, right: 0, top: 0, bottom: 0 };
    // Without the cover LookCamera calls a 390 x 844 canvas portrait.
    expect(isPortrait(none, phone.w, phone.h)).toBe(true);
    expect(lookElevation(true)).toBeGreaterThan(lookElevation(false));
    const c = kitCovered(phone.w, phone.h);
    // The camera starts, and so stays, "not portrait" (the 1.05 leaving line only counts after
    // it has been portrait once).
    expect(isPortrait(c, phone.w, phone.h)).toBe(false);
    expect(c.top).toBe(c.bottom);
    expect(c.left + c.right).toBe(0);
    const free = phone.h - c.top - c.bottom;
    expect(free / phone.w).toBeCloseTo(KIT_MAX_FREE_ASPECT, 9);
    expect(lookElevation(false)).toBeCloseTo(LOOK_ELEVATION_DEG * DEG, 9);
  });

  it("covers nothing on a laptop or a canvas that is not tall", () => {
    expect(kitCovered(1440, 900)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(kitCovered(500, 500)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(kitCovered(0, 0)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  it("turns 30 degrees either way of the base, once round every 8 seconds", () => {
    expect(TURN_DEG).toBe(30);
    expect(TURN_PERIOD_S).toBe(8);
    expect(turnAzimuth(45, 0)).toBeCloseTo(45, 9);
    expect(turnAzimuth(45, 2)).toBeCloseTo(75, 9);
    expect(turnAzimuth(45, 4)).toBeCloseTo(45, 9);
    expect(turnAzimuth(45, 6)).toBeCloseTo(15, 9);
    expect(turnAzimuth(45, 8)).toBeCloseTo(45, 9);
    for (let t = 0; t < 40; t += 0.37) {
      expect(Math.abs(turnAzimuth(10, t) - 10)).toBeLessThanOrEqual(30 + 1e-9);
    }
  });
});

describe("what each subject mounts", () => {
  const plan = (search: string) => planKit(params(search));
  const shown = (p: ReturnType<typeof planKit>) => SLOT_SUBJECTS.filter((s) => p.parts[s]).sort();

  it("shows one part alone for part=<slot>", () => {
    for (const s of SLOT_SUBJECTS) {
      const p = plan(`?part=${s}`);
      expect(shown(p)).toEqual([s]);
      expect(p.desk).toBe(false);
      expect(p.leads).toBe(false);
      expect(p.macro).toBeNull();
      expect(p.focusIds).toBeNull();
    }
  });

  it("keeps a part's neighbours in view, faded, when leads or the pen need them", () => {
    const leads = plan("?part=ammeter&leads=1");
    expect(shown(leads)).toEqual([...SLOT_SUBJECTS].sort());
    expect(leads.leads).toBe(true);
    expect(leads.focusIds).not.toBeNull();
    // The ammeter's block of ten and its two nuts, and every lead.
    for (let i = 0; i < 10; i++) expect(leads.focusIds?.has(INK_IDS.ammeter + i)).toBe(true);
    expect(leads.focusIds?.has(INK_IDS.nutBase + TERMINAL_IDS.indexOf("A+"))).toBe(true);
    expect(leads.focusIds?.has(INK_IDS.nutBase + TERMINAL_IDS.indexOf("A-"))).toBe(true);
    expect(leads.focusIds?.has(INK_IDS.nutBase + TERMINAL_IDS.indexOf("K1"))).toBe(false);
    expect(leads.focusIds?.has(INK_IDS.voltmeter)).toBe(false);
    for (let i = 0; i < 20; i++) expect(leads.focusIds?.has(INK_IDS.leadBase + i)).toBe(true);

    const pen = plan("?part=key&pen=K1");
    expect(shown(pen)).toEqual([...SLOT_SUBJECTS].sort());
    expect(pen.leads).toBe(false);
    expect(pen.focusIds?.has(INK_IDS.pen)).toBe(true);
    expect(pen.focusIds?.has(INK_IDS.key)).toBe(true);
  });

  it("draws the seven leads over the six parts they join, the tray and the desk things left out", () => {
    const p = plan("?part=leads");
    expect(shown(p)).toEqual(Object.keys(PART_TERMINALS).sort());
    expect(p.parts.tray).toBe(false);
    expect(p.desk).toBe(false);
    expect(p.leads).toBe(true);
    for (let i = 0; i < 20; i++) expect(p.focusIds?.has(INK_IDS.leadBase + i)).toBe(true);
    for (const id of TERMINAL_IDS) {
      expect(p.focusIds?.has(INK_IDS.nutBase + TERMINAL_IDS.indexOf(id))).toBe(true);
    }
    // The parts' bodies fade back.
    for (const slot of Object.keys(PART_TERMINALS)) {
      expect(p.focusIds?.has(INK_IDS[slot as keyof typeof PART_TERMINALS])).toBe(false);
    }
  });

  it("puts the desk things alone on the paper for part=desk", () => {
    const p = plan("?part=desk");
    expect(shown(p)).toEqual([]);
    expect(p.desk).toBe(true);
    expect(p.leads).toBe(false);
  });

  it("mounts the part that owns the nut, with a plug in it, for part=terminal", () => {
    const a = plan("?part=terminal&id=A+");
    expect(shown(a)).toEqual(["ammeter"]);
    expect(a.macro).toBe("A+");
    expect(a.desk).toBe(false);
    expect(a.leads).toBe(false);
    for (const [part, ids] of Object.entries(PART_TERMINALS)) {
      for (const id of ids) {
        const p = plan(`?part=terminal&id=${encodeURIComponent(id)}`);
        expect(shown(p)).toEqual([part]);
        expect(p.macro).toBe(id);
      }
    }
  });

  it("shows the whole bench and the desk things when no part is asked for", () => {
    const p = plan("?kit=ohms-law");
    expect(shown(p)).toEqual([...SLOT_SUBJECTS].sort());
    expect(p.desk).toBe(true);
    expect(p.leads).toBe(false);
    expect(p.focusIds).toBeNull();
    expect(plan("?leads=1").leads).toBe(true);
  });

  it("ignores leads= on a macro, which draws its own one lead", () => {
    const p = plan("?part=terminal&id=K1&leads=1");
    expect(p.leads).toBe(false);
    expect(p.macro).toBe("K1");
  });
});

describe("the shot", () => {
  const views = [
    { name: "laptop", w: 1440, h: 900 },
    { name: "phone", w: 390, h: 844 },
  ];
  const frustum = (): Frustum => ({ halfW: 0, halfH: 0, offsetX: 0, offsetY: 0 });
  const middle = (b: Bounds): [number, number, number] => [
    (b.x0 + b.x1) / 2,
    b.h / 2,
    (b.z0 + b.z1) / 2,
  ];

  /** Brute force: how far the box's eight corners reach on the screen from `focus`, in metres. */
  function outline(b: Bounds, focus: readonly [number, number, number], azDeg: number) {
    const az = azDeg * DEG;
    const el = LOOK_ELEVATION_DEG * DEG;
    let r = 0;
    let u = 0;
    for (const x of [b.x0, b.x1]) {
      for (const z of [b.z0, b.z1]) {
        for (const y of [0, b.h]) {
          const px = x - focus[0];
          const py = y - focus[1];
          const pz = z - focus[2];
          r = Math.max(r, Math.abs(Math.cos(az) * px - Math.sin(az) * pz));
          u = Math.max(
            u,
            Math.abs(
              -Math.sin(el) * Math.sin(az) * px +
                Math.cos(el) * py -
                Math.sin(el) * Math.cos(az) * pz,
            ),
          );
        }
      }
    }
    return { r, u };
  }

  it("reads a box's reach on the screen the way its corners project", () => {
    for (const s of ["key", "wire", "tray", "desk", "terminal"]) {
      const b = planKit(params(`?part=${s}`)).bounds;
      for (const az of [-30, 0, 15, 45, 75, 90, 135]) {
        const e = screenExtents(b, az, { right: 0, up: 0 });
        const o = outline(b, middle(b), az);
        expect(e.right, `${s} right at ${az}`).toBeCloseTo(o.r, 9);
        expect(e.up, `${s} up at ${az}`).toBeCloseTo(o.u, 9);
      }
    }
  });

  it("zooms until the subject fills the free area along its tighter side", () => {
    const ext: Extents = { right: 0.2, up: 0.05 };
    const none = { left: 0, right: 0, top: 0, bottom: 0 };
    // A 1000 x 600 canvas seeing 0.5 x 0.3 m: the width is the tighter side (0.2 of 0.5).
    expect(fillZoom(ext, 0.5, 0.3, none, 1000, 600)).toBeCloseTo((0.5 * KIT_FILL) / 0.2, 9);
    // Tall and thin instead: now the height binds.
    expect(fillZoom({ right: 0.05, up: 0.2 }, 0.5, 0.3, none, 1000, 600)).toBeCloseTo(
      (0.3 * KIT_FILL) / 0.2,
      9,
    );
    // Panels covering half the height halve the free area, and the zoom with it, when height binds.
    const covered = { left: 0, right: 0, top: 150, bottom: 150 };
    expect(fillZoom({ right: 0.05, up: 0.2 }, 0.5, 0.3, covered, 1000, 600)).toBeCloseTo(
      (0.15 * KIT_FILL) / 0.2,
      9,
    );
    // A subject with no size does not divide by zero.
    expect(Number.isFinite(fillZoom({ right: 0, up: 0 }, 0.5, 0.3, none, 1000, 600))).toBe(true);
  });

  for (const subject of KIT_SUBJECTS) {
    for (const az of [15, 45, 75]) {
      for (const view of views) {
        it(`holds ${subject} inside the ${view.name} frame at azimuth ${az}, filling ${KIT_FILL} of it`, () => {
          const { bounds } = planKit(params(`?part=${subject}`));
          const shot = shotFor(bounds, az, subject);
          const covered = kitCovered(view.w, view.h);
          const f = fitShot(shot.spanM, covered, view.w, view.h, az * DEG, frustum());
          const freeW = view.w - covered.left - covered.right;
          const freeH = view.h - covered.top - covered.bottom;
          const o = outline(bounds, shot.focus, az);

          // LookCamera's own fit of the patch already holds the subject.
          const fitted = (f.halfW * 2) / view.w;
          expect(o.r).toBeLessThanOrEqual((freeW * fitted) / 2 + 1e-12);
          expect(o.u).toBeLessThanOrEqual((freeH * fitted) / 2 + 1e-12);

          // The zoom on top makes the subject fill KIT_FILL along its tighter side, less on the other.
          const ext = screenExtents(bounds, az, { right: 0, up: 0 });
          const z = fillZoom(ext, f.halfW, f.halfH, covered, view.w, view.h);
          expect(z).toBeGreaterThan(0);
          const mPerPx = fitted / z;
          const fillX = (2 * o.r) / (freeW * mPerPx);
          const fillY = (2 * o.u) / (freeH * mPerPx);
          expect(Math.max(fillX, fillY)).toBeCloseTo(KIT_FILL, 9);
          expect(Math.min(fillX, fillY)).toBeLessThanOrEqual(KIT_FILL + 1e-9);
          expect(shot.azimuthDeg).toBe(az);
          expect(shot.id).toBe(subject);
        });
      }
    }
  }

  it("centres the shot on the middle of what it frames", () => {
    const wire = planKit(params("?part=wire")).bounds;
    const shot = shotFor(wire, 45, "wire");
    expect(shot.focus[0]).toBeCloseTo((wire.x0 + wire.x1) / 2, 9);
    expect(shot.focus[2]).toBeCloseTo((wire.z0 + wire.z1) / 2, 9);
    expect(shot.focus[1]).toBeCloseTo(wire.h / 2, 9);
    expect(OHMS_LAW_LAYOUT.wire.position[0]).toBeCloseTo(shot.focus[0], 1);
  });

  it("frames a wider subject with a wider patch, and the whole bench widest", () => {
    const span = (s: string) => shotFor(planKit(params(`?part=${s}`)).bounds, 45, s).spanM;
    expect(span("wire")).toBeGreaterThan(span("box"));
    expect(span("box")).toBeGreaterThan(span("key"));
    const bench = shotFor(planKit(params("?kit=ohms-law")).bounds, 45, "bench").spanM;
    expect(bench).toBeGreaterThan(span("wire"));
  });

  describe("the terminal macro's lead", () => {
    // Lead holds a carried plug 2.2 cm off the paper, its pin 1.2 cm below the sleeve and the
    // sleeve 6 mm in radius. This asks for more of each (3 cm, 2 cm, 1.2 cm), so a plug twice as
    // thick and 2 cm higher, which the asset pass may bring, still clears.
    const CARRY_M = 0.03;
    const PIN_M = -0.02;
    const SLEEVE_R_M = 0.012;
    // The turn=1 sweep reaches 30 degrees either way of 45, and she can drag 25 degrees past it.
    const SWEEP_DEG = Array.from({ length: 13 }, (_, i) => 15 + 5 * i);
    const DRAG_DEG = [-25, 0, 25];
    const MARGIN_PX = 30;
    const macro = planKit(params("?part=terminal")).bounds;

    // Where each nut is, in metres (x to her right, y up, z toward her): ?kit=ohms-law&dump=1 on
    // the seam's commit, to 0.1 mm. A restyle may move a nut by 2 mm (docs/plans/asset-pass.md,
    // C8); nothing below is as tight as that.
    const NUT_M: Readonly<Record<TerminalId, readonly [number, number, number]>> = {
      "E+": [0.3718, 0.0697, 0.08],
      "E-": [0.5082, 0.0697, 0.08],
      K1: [0.231, 0.0477, 0.12],
      K2: [0.169, 0.0477, 0.12],
      "A+": [-0.125, 0.0357, 0.145],
      "A-": [-0.195, 0.0357, 0.145],
      "V+": [0.175, 0.0357, -0.235],
      "V-": [0.105, 0.0357, -0.235],
      R1: [-0.3, 0.0897, 0.094],
      R2: [-0.56, 0.0897, 0.094],
      X: [-0.256, 0.0577, -0.145],
      Y: [0.2803, 0.0577, -0.145],
    };
    const free = new THREE.Vector3();

    /** Where the macro puts terminal `id`'s free plug; y is its height above the paper. */
    function freeEnd(id: TerminalId): THREE.Vector3 {
      const [x, , z] = NUT_M[id];
      return macroFreeEnd(id, { x, z }, free).clone();
    }

    /** The plug's offset from the shot's focus, the nut's top a little raised. */
    function plugOffset(id: TerminalId) {
      const [x, y, z] = NUT_M[id];
      const end = freeEnd(id);
      return { x: end.x - x, y: end.y + CARRY_M - (y + MACRO_LIFT_M), z: end.z - z };
    }

    /**
     * How far, in CSS px, the plug's projected box lies outside the whole canvas (positive means
     * clear of it). The shot is fitted at `shotAz`; the camera itself is turned to `camAz`, which
     * differs by a drag. The focus is the middle of the canvas, as the covered strips are equal.
     */
    function gapPx(
      view: { w: number; h: number },
      shotAz: number,
      camAz: number,
      d: { x: number; y: number; z: number },
    ): number {
      const covered = kitCovered(view.w, view.h);
      const shot = shotFor(macro, shotAz, "terminal");
      const f = fitShot(shot.spanM, covered, view.w, view.h, shotAz * DEG, frustum());
      const ext = screenExtents(macro, shotAz, { right: 0, up: 0 });
      const pxPerM =
        (view.w / (2 * f.halfW)) * fillZoom(ext, f.halfW, f.halfH, covered, view.w, view.h);
      const az = camAz * DEG;
      const el = LOOK_ELEVATION_DEG * DEG;
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          for (const y of [PIN_M, PLUG_HEIGHT_M + 0.01]) {
            const px = d.x + sx * SLEEVE_R_M;
            const py = d.y + y;
            const pz = d.z + sz * SLEEVE_R_M;
            const right = Math.cos(az) * px - Math.sin(az) * pz;
            const up =
              -Math.sin(el) * Math.sin(az) * px +
              Math.cos(el) * py -
              Math.sin(el) * Math.cos(az) * pz;
            const x = view.w / 2 + right * pxPerM;
            const yy = view.h / 2 - up * pxPerM;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, yy);
            maxY = Math.max(maxY, yy);
          }
        }
      }
      return Math.max(-maxX, minX - view.w, -maxY, minY - view.h);
    }

    it(`puts all twelve free plugs at least ${MARGIN_PX} px past the whole canvas, on a phone and a laptop, from every azimuth she can see them from`, () => {
      let worst = { gap: Number.POSITIVE_INFINITY, at: "" };
      for (const id of TERMINAL_IDS) {
        const offset = plugOffset(id);
        for (const view of views) {
          for (const az of SWEEP_DEG) {
            for (const drag of DRAG_DEG) {
              const gap = gapPx(view, az, az + drag, offset);
              if (gap < worst.gap) {
                worst = { gap, at: `${id}, ${view.name}, azimuth ${az} dragged ${drag}` };
              }
            }
          }
        }
      }
      expect(worst.gap, worst.at).toBeGreaterThan(MARGIN_PX);
    });

    it("would hang in the air on a phone if it were only past the free area, as 17 cm out and 7 cm toward her was", () => {
      // The free area is a strip about 430 px tall in the middle of the 844 px canvas; the strips
      // above and below it are still drawn. 3.57 cm is the lowest nut on the bench, a meter's.
      const phone = views.find((v) => v.name === "phone");
      if (!phone) throw new Error("no phone view");
      const old = { x: 0.17, y: CARRY_M - (0.0357 + MACRO_LIFT_M), z: 0.07 };
      expect(gapPx(phone, 75, 75, old)).toBeLessThan(0);
    });

    // ---- The cable the free plug leaves behind ----
    // Lead's cable, restated, because its shapeCable is private: eleven control points at CABLE_T
    // along the chord from the plug top over the nut to the plug top over the free end, each hung
    // 0.012 + 0.3 d below it (d the level span) in a belly of 4t(1 - t), pushed sideways by
    // bulge x min(d, 0.5) x 0.22 in the same belly and lifted a little beside each plug, then a
    // centripetal Catmull-Rom curve through them. Lead's bulge is a seeded number from -1 to 1,
    // so every one of BULGES is tried. When Lead's path changes, change this with it.
    const CABLE_T = [0, 0.04, 0.12, 0.25, 0.4, 0.5, 0.6, 0.75, 0.88, 0.96, 1] as const;
    /** How far above the paper Lead holds a free plug, and the lowest its cable's centre goes. */
    const CARRY_LIFT_M = 0.022;
    const FLOOR_M = LEAD_RADIUS_M + 0.0004;
    const BULGES = [-1, -0.5, 0, 0.5, 1];
    /** A footprint's own share of LeadParts' floorAt: its top, ramping to the paper over 1.5 cm. */
    const RAMP_M = 0.015;

    function cablePath(id: TerminalId, end: THREE.Vector3, bulge: number): THREE.Vector3[] {
      const [nx, ny, nz] = NUT_M[id];
      const sy = ny + PLUG_HEIGHT_M;
      const ey = end.y + CARRY_LIFT_M + PLUG_HEIGHT_M;
      const dx = end.x - nx;
      const dz = end.z - nz;
      const d = Math.hypot(dx, dz);
      const droop = 0.012 + 0.3 * d;
      const side = bulge * Math.min(d, 0.5) * 0.22;
      const control = CABLE_T.map((t) => {
        const belly = 4 * t * (1 - t);
        const u = Math.min(t, 1 - t) * 26;
        const stiff = 0.03 * u * Math.exp(-u);
        return new THREE.Vector3(
          nx + dx * t + (-dz / d) * side * belly,
          Math.max(FLOOR_M, sy + (ey - sy) * t - droop * belly + stiff),
          nz + dz * t + (dx / d) * side * belly,
        );
      });
      return new THREE.CatmullRomCurve3(control, false, "centripetal").getPoints(112);
    }

    function footTop(f: BenchFootprint, x: number, z: number): number {
      const dx = Math.max(Math.abs(x - f.cx) - f.hx, 0);
      const dz = Math.max(Math.abs(z - f.cz) - f.hz, 0);
      const d = Math.hypot(dx, dz);
      return d < RAMP_M ? f.top * (1 - d / RAMP_M) : 0;
    }

    /**
     * The most a hidden part (any footprint but the nut's own part's) would raise the cable above
     * where it would lie on bare paper, over every bulge: what Lead's restOnBench does to a point.
     */
    function hiddenLift(id: TerminalId, end: THREE.Vector3): { lift: number; at: string } {
      const hidden = BENCH_FOOTPRINTS.filter((f) => f.slot !== TERMINAL_PART[id]);
      let worst = { lift: 0, at: "" };
      for (const bulge of BULGES) {
        for (const p of cablePath(id, end, bulge)) {
          for (const f of hidden) {
            const lift = footTop(f, p.x, p.z) + LEAD_RADIUS_M - Math.max(p.y, LEAD_RADIUS_M);
            if (lift > worst.lift) {
              const where = `(${p.x.toFixed(3)}, ${p.z.toFixed(3)})`;
              worst = { lift, at: `${id}, bulge ${bulge}, over the ${f.slot} at ${where}` };
            }
          }
        }
      }
      return worst;
    }

    it("restates LeadParts' floorAt, footprint by footprint", () => {
      for (let x = -0.7; x <= 0.7; x += 0.0173) {
        for (let z = -0.7; z <= 0.3; z += 0.0173) {
          const top = Math.max(0, ...BENCH_FOOTPRINTS.map((f) => footTop(f, x, z)));
          expect(top).toBeCloseTo(floorAt(x, z), 12);
        }
      }
    });

    it("is never lifted off the paper by a part the shot hides, whichever way Lead bulges it", () => {
      for (const id of TERMINAL_IDS) {
        const { lift, at } = hiddenLift(id, freeEnd(id));
        expect(lift, at).toBeLessThan(0.001);
      }
    });

    it("was lifted 1 to 2 cm by hidden parts under the headings before: V+ and V- across the wire board, R1 across the ammeter", () => {
      // The rule then: out 30 cm to the side the nut is on, 18 cm toward her.
      for (const id of ["V+", "V-", "R1"] as const) {
        const [x, , z] = NUT_M[id];
        const side = x >= OHMS_LAW_LAYOUT[TERMINAL_PART[id]].position[0] ? 1 : -1;
        const end = new THREE.Vector3(x + side * 0.3, 0, z + 0.18);
        expect(hiddenLift(id, end).lift, id).toBeGreaterThan(0.01);
      }
    });

    it("never climbs onto a taller part of its own part than the one its nut stands on, and clears the other nut", () => {
      // A meter's nuts stand on its 1.2 cm ledge, with the 11.8 cm case behind them. A nut's body
      // is about 1.3 cm in radius, the cable 1.5 mm.
      const NUT_CLEAR_M = 0.015;
      for (const id of TERMINAL_IDS) {
        const [nx, , nz] = NUT_M[id];
        const own = BENCH_FOOTPRINTS.filter((f) => f.slot === TERMINAL_PART[id]);
        const rest = Math.max(
          ...own
            .filter(
              (f) => Math.abs(nx - f.cx) <= f.hx + 0.004 && Math.abs(nz - f.cz) <= f.hz + 0.004,
            )
            .map((f) => f.top),
        );
        expect(rest, `${id} stands on its own part`).toBeGreaterThan(0);
        const others = TERMINAL_IDS.filter(
          (o) => o !== id && TERMINAL_PART[o] === TERMINAL_PART[id],
        );
        for (const bulge of BULGES) {
          for (const p of cablePath(id, freeEnd(id), bulge)) {
            const where = `${id}, bulge ${bulge}, at (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`;
            for (const f of own) {
              const climb = footTop(f, p.x, p.z) - Math.max(rest, p.y - LEAD_RADIUS_M);
              expect(climb, `climbs the ${f.slot}: ${where}`).toBeLessThan(0.0005);
            }
            for (const other of others) {
              const [ox, oy, oz] = NUT_M[other];
              if (p.y >= oy + 0.003) continue;
              expect(
                Math.hypot(p.x - ox, p.z - oz),
                `runs into ${other}: ${where}`,
              ).toBeGreaterThan(NUT_CLEAR_M);
            }
          }
        }
      }
    });
  });
});

describe("the terminal dump", () => {
  it("lists all twelve terminals in the frozen order, to 0.1 mm", () => {
    const registry = createTerminalRegistry();
    TERMINAL_IDS.forEach((id, i) => {
      const object = new THREE.Object3D();
      object.position.set(i * 0.1 + 0.00004, 0.0237, -i * 0.01 - 0.12345678);
      object.updateMatrixWorld(true);
      registry.register({ id, part: "ammeter", label: id, object });
    });
    const dump = terminalPositions(registry);
    expect(Object.keys(dump)).toEqual([...TERMINAL_IDS]);
    expect(dump["E+"]).toEqual([0, 0.0237, -0.1235]);
    expect(dump.Y?.[0]).toBeCloseTo(1.1, 4);
    expect(JSON.parse(JSON.stringify(dump))).toEqual(dump);
  });

  it("reads a nut's world position through its parents", () => {
    const registry = createTerminalRegistry();
    const parent = new THREE.Group();
    parent.position.set(0.5, 0, 0.25);
    const object = new THREE.Object3D();
    object.position.set(0.01, 0.0237, 0.02);
    parent.add(object);
    parent.updateMatrixWorld(true);
    registry.register({ id: "K1", part: "key", label: "K1", object });
    expect(terminalPositions(registry).K1).toEqual([0.51, 0.0237, 0.27]);
  });

  it("says null for a terminal that is not mounted, and never negative zero", () => {
    const registry = createTerminalRegistry();
    const object = new THREE.Object3D();
    object.position.set(-0.00001, 0, 0);
    registry.register({ id: "X", part: "wire", label: "X", object });
    const dump = terminalPositions(registry);
    expect(dump.Y).toBeNull();
    expect(dump.X).toEqual([0, 0, 0]);
    expect(Object.is(dump.X?.[0], -0)).toBe(false);
    expect(Object.values(dump).filter((v) => v === null)).toHaveLength(11);
  });
});
