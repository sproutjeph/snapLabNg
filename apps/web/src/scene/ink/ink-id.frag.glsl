// Ink-ID pass, fragment: rgb = view-space normal, a = ink id * 2 + thin (exact in half float).
// Cleared to 0, so "nothing inked here" reads as a zero normal and id 0.
precision highp float;

#include <clipping_planes_pars_fragment>

uniform float inkCode;
uniform float inkSkip;

varying vec3 vInkNormal;

void main() {
  #include <clipping_planes_fragment>
  if (inkSkip > 0.5) discard;
  vec3 n = normalize(vInkNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(n, inkCode);
}
