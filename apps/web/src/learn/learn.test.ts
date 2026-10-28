import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTerminalRegistry } from "./terminalRegistry";
import { createTimeline, ease } from "./timeline";

describe("timeline", () => {
  it("gives each tween its eased progress at the seek time", () => {
    const seen: number[] = [];
    const tl = createTimeline().add(1, 2, (k) => seen.push(k), { ease: ease.linear });
    tl.seek(0);
    tl.seek(2);
    tl.seek(5);
    expect(seen).toEqual([0, 0.5, 1]);
    expect(tl.durationS).toBe(3);
  });

  it("snaps a zero-length tween at its start time", () => {
    const seen: number[] = [];
    const tl = createTimeline().add(1, 0, (k) => seen.push(k));
    tl.seek(0.5);
    tl.seek(1);
    expect(seen).toEqual([0, 1]);
  });

  it("overshoots with outBack and settles at 1", () => {
    expect(ease.outBack(0.7)).toBeGreaterThan(1);
    expect(ease.outBack(1)).toBeCloseTo(1, 10);
    expect(ease.inOut(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe("terminal registry", () => {
  it("reads a registered nut's world position and forgets it when unmounted", () => {
    const r = createTerminalRegistry();
    const parent = new THREE.Group();
    parent.position.set(1, 0, 0);
    const nut = new THREE.Object3D();
    nut.position.set(0, 0.02, 0);
    parent.add(nut);
    parent.updateMatrixWorld(true);
    const off = r.register({ id: "A+", part: "ammeter", label: "Ammeter +", object: nut });
    const out = new THREE.Vector3();
    expect(r.worldPosition("A+", out)).toBe(true);
    expect(out.x).toBeCloseTo(1, 10);
    expect(out.y).toBeCloseTo(0.02, 10);
    off();
    expect(r.worldPosition("A+", out)).toBe(false);
  });

  it("sends taps to the current handler only", () => {
    const r = createTerminalRegistry();
    const taps: string[] = [];
    r.tap("X");
    r.setTapHandler((id) => taps.push(id));
    r.tap("Y");
    r.setTapHandler(null);
    r.tap("X");
    expect(taps).toEqual(["Y"]);
  });
});
