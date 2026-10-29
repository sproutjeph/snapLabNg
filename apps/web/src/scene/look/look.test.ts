import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  DPR_LADDER,
  DPR_SLOW_LIMIT,
  DPR_WINDOW_FRAMES,
  lookFor,
  nextDprRung,
} from "../../quality/tier";
import { inkTag } from "../ink/ink";
import {
  FOCUS_FADE_S,
  InkFocusFade,
  inkFocusFor,
  releaseInkFocus,
  setInkFocus,
} from "../ink/inkFocus";
import { INK_FLAT, INK_STRENGTH, type InkCode, inkCode } from "../ink/inkPass";
import { createDprLadder, DPR_SETTLE_FRAMES } from "./dprLadder";
import {
  type Frustum,
  fitShot,
  followK,
  LOOK_ELEVATION_DEG,
  SHOT_DEPTH_RATIO,
  SHOT_HEIGHT_M,
} from "./LookCamera";
import { isGlossy } from "./LookLights";

const NONE = { left: 0, right: 0, top: 0, bottom: 0 };
const EL = (LOOK_ELEVATION_DEG * Math.PI) / 180;
const frustum = (): Frustum => ({ halfW: 0, halfH: 0, offsetX: 0, offsetY: 0 });
/** Screen height of a shot's bounds seen from the front (azimuth 0), in metres. */
const frontHeight = (span: number) =>
  2 * (Math.sin(EL) * (span / 2) * SHOT_DEPTH_RATIO + Math.cos(EL) * SHOT_HEIGHT_M);

describe("the shot camera", () => {
  it("fits the span across an uncovered canvas and leaves the focus in the middle", () => {
    const f = fitShot(1.5, NONE, 1500, 900, 0, frustum());
    expect(f.halfW * 2).toBeCloseTo(1.5, 9);
    expect(f.halfH / f.halfW).toBeCloseTo(900 / 1500, 9);
    expect(f.offsetX).toBe(0);
    expect(f.offsetY).toBe(0);
  });

  it("fits the span into what a side panel leaves and centres the focus there", () => {
    // A 400 px panel on the right: the free area is 0–1000 px, its centre 500 px.
    const f = fitShot(1, { ...NONE, right: 400 }, 1400, 900, 0, frustum());
    const mPerPx = (f.halfW * 2) / 1400;
    expect(mPerPx * 1000).toBeCloseTo(1, 9);
    // setViewOffset moves the window right by 200 px, so the focus lands 200 px left of centre.
    expect(f.offsetX).toBe(200);
  });

  it("centres the focus below a top panel", () => {
    // 100 px covered at the top of 800: the free area is 100–800 px, its centre 450 px.
    const f = fitShot(1, { ...NONE, top: 100 }, 1000, 800, 0, frustum());
    expect(f.offsetY).toBe(-50);
    expect(f.offsetX).toBe(0);
  });

  it("fits the shot's bounds by height when the free area is short", () => {
    const f = fitShot(1, NONE, 1000, 200, 0, frustum());
    expect(f.halfH * 2).toBeCloseTo(frontHeight(1), 9);
    expect(f.halfW * 2).toBeGreaterThan(1);
  });

  it("fits the bench's turned bounds at 45°, wider than the span itself", () => {
    const f = fitShot(1, NONE, 2000, 2000, Math.PI / 4, frustum());
    const halfX = Math.SQRT1_2 * (0.5 + 0.5 * SHOT_DEPTH_RATIO);
    const halfY = Math.sin(EL) * halfX + Math.cos(EL) * SHOT_HEIGHT_M;
    expect(f.halfW).toBeCloseTo(Math.max(halfX, halfY), 9);
  });

  it("ignores a cover that leaves nothing free", () => {
    const f = fitShot(1, { ...NONE, left: 600, right: 600 }, 1000, 800, 0, frustum());
    expect(f.halfW * 2).toBeCloseTo(1, 9);
    expect(f.offsetX).toBe(0);
  });

  it("writes into the frustum it is given", () => {
    const out = frustum();
    expect(fitShot(1, NONE, 800, 600, 0, out)).toBe(out);
  });

  it("follows with k = 1 − e^(−8 dt)", () => {
    expect(followK(0)).toBe(0);
    expect(followK(1 / 60)).toBeCloseTo(1 - Math.exp(-8 / 60), 12);
    expect(followK(-1)).toBe(0);
  });
});

describe("the look per tier", () => {
  it("has real shadows on mid and high and none on low", () => {
    expect(lookFor("high").shadowMapSize).toBe(2048);
    expect(lookFor("mid").shadowMapSize).toBe(1024);
    expect(lookFor("low").shadowMapSize).toBe(0);
  });

  it("caps the pixel-ratio ladder at the tier and the device", () => {
    expect(DPR_LADDER).toEqual([2, 1.5, 1.25, 1]);
    expect(lookFor("high", 3).dprLadder).toEqual([2, 1.5, 1.25, 1]);
    expect(lookFor("high", 1.75).dprLadder).toEqual([1.75, 1.5, 1.25, 1]);
    expect(lookFor("mid", 2).dprLadder).toEqual([1.5, 1.25, 1]);
    expect(lookFor("low", 3).dprLadder).toEqual([1]);
  });

  it("steps down one rung only when more than 60 of 90 frames were slow", () => {
    expect(DPR_WINDOW_FRAMES).toBe(90);
    const ladder = [2, 1.5, 1.25, 1];
    expect(nextDprRung(ladder, 0, DPR_SLOW_LIMIT)).toBe(0);
    expect(nextDprRung(ladder, 0, DPR_SLOW_LIMIT + 1)).toBe(1);
    expect(nextDprRung(ladder, 3, 90)).toBe(3);
  });
});

describe("the pixel-ratio ladder", () => {
  const SLOW_S = 0.04;
  const FAST_S = 0.016;
  const run = (ladder: ReturnType<typeof createDprLadder>, n: number, dt: number) => {
    let stepped = 0;
    for (let i = 0; i < n; i++) if (ladder.frame(dt)) stepped += 1;
    return stepped;
  };

  it("holds its rung on fast frames", () => {
    const ladder = createDprLadder([2, 1.5, 1.25, 1]);
    run(ladder, DPR_SETTLE_FRAMES + DPR_WINDOW_FRAMES * 3, FAST_S);
    expect(ladder.dpr()).toBe(2);
  });

  it("steps down one rung per slow window and tells its owner", () => {
    const ladder = createDprLadder([2, 1.5, 1.25, 1]);
    let told = 0;
    ladder.subscribe(() => {
      told += 1;
    });
    run(ladder, DPR_SETTLE_FRAMES + DPR_WINDOW_FRAMES, SLOW_S);
    expect(ladder.dpr()).toBe(1.5);
    expect(told).toBe(1);
  });

  it("keeps stepping down after the Canvas re-renders, never restarting at the top", () => {
    // The owner passes dpr={ladder.dpr()}; a re-render reads the same ladder, so it gets the
    // current rung back, and the next slow window steps on from there.
    const ladder = createDprLadder([2, 1.5, 1.25, 1]);
    run(ladder, DPR_SETTLE_FRAMES + DPR_WINDOW_FRAMES, SLOW_S);
    const afterRerender = ladder.dpr();
    expect(afterRerender).toBe(1.5);
    run(ladder, DPR_SETTLE_FRAMES + DPR_WINDOW_FRAMES, SLOW_S);
    expect(ladder.dpr()).toBe(1.25);
    run(ladder, (DPR_SETTLE_FRAMES + DPR_WINDOW_FRAMES) * 4, SLOW_S);
    expect(ladder.dpr()).toBe(1);
    expect(ladder.rung()).toBe(3);
  });
});

describe("ink controls", () => {
  it("reads strength and flat from the nearest ancestor that sets them", () => {
    const part = new THREE.Group();
    const glass = new THREE.Mesh();
    const body = new THREE.Mesh();
    part.add(glass, body);
    inkTag(part, { id: 30 });
    part.userData[INK_FLAT] = true;
    glass.userData[INK_STRENGTH] = 0.3;
    const out: InkCode = { id: 0, thin: false, strength: 1, flat: false };
    expect(inkCode(glass, out)).toEqual({ id: 30, thin: false, strength: 0.3, flat: true });
    expect(inkCode(body, out)).toEqual({ id: 30, thin: false, strength: 1, flat: true });
  });

  it("gives untagged meshes id 0 at full strength and clamps strength to 0–1", () => {
    const m = new THREE.Mesh();
    m.userData[INK_STRENGTH] = 4;
    const out: InkCode = { id: 9, thin: true, strength: 0, flat: true };
    expect(inkCode(m, out)).toEqual({ id: 0, thin: false, strength: 1, flat: false });
  });
});

describe("focus fade", () => {
  it("fades the parts outside the focus over 0.3 s and brings them back", () => {
    const fade = new InkFocusFade();
    fade.set({ ids: new Set([30, 31]) });
    fade.advance(FOCUS_FADE_S / 2);
    expect(fade.of(50)).toBeCloseTo(0.5, 6);
    expect(fade.of(30)).toBe(0);
    expect(fade.advance(FOCUS_FADE_S)).toBe(false);
    expect(fade.of(50)).toBe(1);
    // Untagged meshes never fade.
    expect(fade.of(0)).toBe(0);
    fade.set({ ids: null });
    fade.advance(0, true);
    expect(fade.of(50)).toBe(0);
    fade.dispose();
  });

  it("is kept per canvas: one scene's focus never fades another's parts", () => {
    const a = new THREE.Scene();
    const b = new THREE.Scene();
    setInkFocus(a, { ids: new Set([30]) });
    inkFocusFor(a).advance(1);
    inkFocusFor(b).advance(1);
    expect(inkFocusFor(a).of(50)).toBe(1);
    expect(inkFocusFor(b).of(50)).toBe(0);
    releaseInkFocus(a);
    releaseInkFocus(b);
    expect(inkFocusFor(a).of(50)).toBe(0);
    releaseInkFocus(a);
  });
});

describe("glossy materials", () => {
  it("are brass, polish and glass, not matte wood", () => {
    const wood = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    const brass = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.9 });
    const glass = new THREE.MeshPhysicalMaterial({ roughness: 0.1, transmission: 1 });
    expect(isGlossy(wood)).toBe(false);
    expect(isGlossy(brass)).toBe(true);
    expect(isGlossy(glass)).toBe(true);
    expect(isGlossy(new THREE.MeshBasicMaterial())).toBe(false);
  });
});
