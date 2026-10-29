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
import { advanceInkFocus, FOCUS_FADE_S, inkFocusOf, setInkFocus } from "../ink/inkFocus";
import { INK_FLAT, INK_STRENGTH, type InkCode, inkCode } from "../ink/inkPass";
import { fitShot, followK, SHOT_DEPTH_RATIO } from "./LookCamera";
import { isGlossy } from "./LookLights";

const NONE = { left: 0, right: 0, top: 0, bottom: 0 };

describe("the shot camera", () => {
  it("fits the span across an uncovered canvas and leaves the focus in the middle", () => {
    const f = fitShot(1.5, NONE, 1500, 900);
    expect(f.halfW * 2).toBeCloseTo(1.5, 9);
    expect(f.halfH / f.halfW).toBeCloseTo(900 / 1500, 9);
    expect(f.offsetX).toBe(0);
    expect(f.offsetY).toBe(0);
  });

  it("fits the span into what a side panel leaves and centres the focus there", () => {
    // A 400 px panel on the right: the free area is 0–1000 px, its centre 500 px.
    const f = fitShot(1, { ...NONE, right: 400 }, 1400, 900);
    const mPerPx = (f.halfW * 2) / 1400;
    expect(mPerPx * 1000).toBeCloseTo(1, 9);
    // setViewOffset moves the window right by 200 px, so the focus lands 200 px left of centre.
    expect(f.offsetX).toBe(200);
  });

  it("fits a short canvas by its height", () => {
    const f = fitShot(1, NONE, 1000, 200);
    expect(f.halfH * 2).toBeCloseTo(SHOT_DEPTH_RATIO, 9);
  });

  it("ignores a cover that leaves nothing free", () => {
    const f = fitShot(1, { ...NONE, left: 600, right: 600 }, 1000, 800);
    expect(f.halfW * 2).toBeCloseTo(1, 9);
    expect(f.offsetX).toBe(0);
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
    setInkFocus({ ids: new Set([30, 31]) });
    advanceInkFocus(FOCUS_FADE_S / 2);
    expect(inkFocusOf(50)).toBeCloseTo(0.5, 6);
    expect(inkFocusOf(30)).toBe(0);
    expect(advanceInkFocus(FOCUS_FADE_S)).toBe(false);
    expect(inkFocusOf(50)).toBe(1);
    // Untagged meshes never fade.
    expect(inkFocusOf(0)).toBe(0);
    setInkFocus({ ids: null });
    advanceInkFocus(0, true);
    expect(inkFocusOf(50)).toBe(0);
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
