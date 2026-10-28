// Low-tier ink: inverted hull. The back faces are pushed out along a welded (smooth) normal by
// a constant number of screen pixels, so the rim shows round the part as a pen line.
#include <common>
#include <clipping_planes_pars_vertex>

attribute vec3 hullNormal;

uniform vec2 inkResolution;
uniform float inkWidth;

void main() {
  #include <begin_vertex>
  #include <project_vertex>
  vec3 nView = normalize(normalMatrix * hullNormal);
  vec2 dir = (projectionMatrix * vec4(nView, 0.0)).xy * inkResolution;
  float len = length(dir);
  if (len > 1e-5) {
    gl_Position.xy += (dir / len) * (2.0 * inkWidth / max(inkResolution, vec2(1.0))) * gl_Position.w;
  }
  #include <clipping_planes_vertex>
}
