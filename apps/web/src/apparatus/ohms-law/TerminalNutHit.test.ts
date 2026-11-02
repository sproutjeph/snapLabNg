import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { HIT_CENTRE_M, NUT_TOP_M, onDialFace } from "./TerminalNut";

// A meter's dial wins a tap that a nut's oversized target also caught, unless the tap is on the
// nut itself with the dial only seen behind it. No textbook source: tap-routing geometry.

function rig() {
  // A nut whose foot is at the origin; its target is centred HIT_CENTRE_M up.
  const target = new THREE.Mesh();
  target.position.set(0, HIT_CENTRE_M, 0);
  target.updateMatrixWorld(true);
  const dial = new THREE.Mesh();
  dial.userData = { partHit: true };
  return { target, dial };
}

const ray = (x: number, y: number, z: number, dx: number, dy: number, dz: number) =>
  new THREE.Ray(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, dy, dz).normalize());

describe("onDialFace", () => {
  it("never blocks a tap with no dial under it", () => {
    const { target } = rig();
    const e = {
      object: target,
      ray: ray(0, 0.2, 0.2, 0, -1, -1),
      intersections: [{ object: target, distance: 0.1 }],
    };
    expect(onDialFace(e)).toBe(false);
  });

  it("gives the tap to a dial that is nearer than the nut's target", () => {
    const { target, dial } = rig();
    const e = {
      object: target,
      ray: ray(0, 0.2, 0.2, 0, -1, -1),
      intersections: [
        { object: dial, distance: 0.05 },
        { object: target, distance: 0.1 },
      ],
    };
    expect(onDialFace(e)).toBe(true);
  });

  it("gives the tap to the dial when the target reaches over it, far from the real nut", () => {
    const { target, dial } = rig();
    // The ray passes 3 cm above the nut's middle (target hit first, dial behind): the dial's.
    const e = {
      object: target,
      ray: ray(0, NUT_TOP_M / 2 + 0.03, 0.2, 0, 0, -1),
      intersections: [
        { object: target, distance: 0.1 },
        { object: dial, distance: 0.15 },
      ],
    };
    expect(onDialFace(e)).toBe(true);
  });

  it("keeps a tap on the nut itself, even with the dial behind it", () => {
    const { target, dial } = rig();
    // The ray goes through the middle of the nut and on to the dial behind.
    const e = {
      object: target,
      ray: ray(0, NUT_TOP_M / 2, 0.2, 0, 0, -1),
      intersections: [
        { object: target, distance: 0.1 },
        { object: dial, distance: 0.15 },
      ],
    };
    expect(onDialFace(e)).toBe(false);
  });
});
