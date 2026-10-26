// Ink classification for the flattened page (docs/04 §2 ①, "Ink mask"). The same
// rule runs in the GPU pass (INK_GLSL below) and here in TypeScript, so it can be
// unit-tested. Keep the two in step: same constants, same formula.

/** Darkness below this is paper, faint ruled lines or shadow. */
export const INK_DARK_LO = 0.28;
/** Darkness above this is fully ink. */
export const INK_DARK_HI = 0.45;
/** Red excess where a stroke starts counting as the red margin and is dropped. */
export const RED_LO = 0.08;
export const RED_HI = 0.2;
/** Radii in output page pixels of the two rings that estimate the local paper brightness. */
export const BG_RING_NEAR_PX = 8;
export const BG_RING_FAR_PX = 16;

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * How much a pixel is pen or pencil ink, 0–1. `bgLum` is the local paper brightness,
 * so uneven lighting cancels out. Faint ruled lines and the red margin come out near 0.
 */
export function inkWeight(r: number, g: number, b: number, bgLum: number): number {
  const darkness = Math.min(1, Math.max(0, 1 - luminance(r, g, b) / Math.max(bgLum, 1e-3)));
  const redness = r - Math.max(g, b);
  return smoothstep(INK_DARK_LO, INK_DARK_HI, darkness) * (1 - smoothstep(RED_LO, RED_HI, redness));
}

const f = (n: number) => n.toFixed(4);

/** GLSL for the ink pass over the flattened page. Mirrors `inkWeight`. */
export const INK_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uPage;
uniform vec2 uTexel;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec3 c = texture2D(uPage, vUv).rgb;
  // Local paper brightness: the brightest of 16 samples on two rings, wider than a stroke.
  float bg = lum(c);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 d = vec2(cos(a), sin(a)) * uTexel;
    bg = max(bg, lum(texture2D(uPage, vUv + d * ${f(BG_RING_NEAR_PX)}).rgb));
    bg = max(bg, lum(texture2D(uPage, vUv + d * ${f(BG_RING_FAR_PX)}).rgb));
  }
  float darkness = clamp(1.0 - lum(c) / max(bg, 1e-3), 0.0, 1.0);
  float redness = c.r - max(c.g, c.b);
  float ink = smoothstep(${f(INK_DARK_LO)}, ${f(INK_DARK_HI)}, darkness)
            * (1.0 - smoothstep(${f(RED_LO)}, ${f(RED_HI)}, redness));
  gl_FragColor = vec4(c, ink);
}
`;
