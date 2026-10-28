// Low-tier ink: inverted hull. The back faces are pushed out along a welded (smooth) normal by
// a constant number of screen pixels, so the rim shows round the part as a pen line.
// Instanced hulls share the part's instanceMatrix; the normal follows it as in ink-id.vert.glsl.
#include <common>
#include <clipping_planes_pars_vertex>

attribute vec3 hullNormal;

uniform vec2 inkResolution;
uniform float inkWidth;

void main() {
  vec3 objectNormal = hullNormal;
  #ifdef USE_INSTANCING
    mat3 im = mat3(instanceMatrix);
    objectNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    objectNormal = im * objectNormal;
  #endif
  #include <begin_vertex>
  #include <project_vertex>
  vec3 nView = normalMatrix * objectNormal;
  vec2 dir = (projectionMatrix * vec4(nView, 0.0)).xy * inkResolution;
  float len = length(dir);
  if (len > 1e-5) {
    gl_Position.xy += (dir / len) * (2.0 * inkWidth / max(inkResolution, vec2(1.0))) * gl_Position.w;
  }
  #include <clipping_planes_vertex>
}
