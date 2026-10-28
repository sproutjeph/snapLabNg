// Low-tier ink: the hull's flat pen colour, drawn on by the same sweep as the outline effect
// (ink-sweep.glsl is prepended). A hard cut, not a blend: the hull is opaque.
precision highp float;

#include <clipping_planes_pars_fragment>

uniform vec3 inkColour;
uniform float inkReveal;

varying vec3 vInkWorld;

void main() {
  #include <clipping_planes_fragment>
  if (inkReveal < 1.0 && inkSweep(vInkWorld, inkReveal) < 0.5) discard;
  gl_FragColor = vec4(inkColour, 1.0);
  #include <colorspace_fragment>
}
