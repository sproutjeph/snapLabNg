// Ink-ID pass, fragment. Cleared to 0, so a = 0 reads as "nothing inked here".
//   rg = view-space normal x, y (the edge shader rebuilds z: a face it sees points toward it)
//   b  = ink strength (0–1) + 2 if thin
//   a  = ink id + 1 (1–256, exact in half float)
// `inkFlat` swaps the smooth normal for the facet normal (dFdx), so a chiselled or bevelled part
// shows its facets as creases.
precision highp float;

#include <clipping_planes_pars_fragment>

uniform float inkId;
uniform float inkStrength;
uniform float inkThin;
uniform float inkFlat;

varying vec3 vInkNormal;
varying vec3 vInkViewPos;

void main() {
  #include <clipping_planes_fragment>
  vec3 n;
  if (inkFlat > 0.5) {
    vec3 f = cross(dFdx(vInkViewPos), dFdy(vInkViewPos));
    float lf = length(f);
    n = lf > 1e-12 ? f / lf : vec3(0.0, 0.0, 1.0);
  } else {
    float l = length(vInkNormal);
    n = (l > 1e-6 ? vInkNormal / l : vec3(0.0, 0.0, 1.0)) * (gl_FrontFacing ? 1.0 : -1.0);
  }
  gl_FragColor = vec4(n.xy, clamp(inkStrength, 0.0, 1.0) + 2.0 * inkThin, inkId + 1.0);
}
