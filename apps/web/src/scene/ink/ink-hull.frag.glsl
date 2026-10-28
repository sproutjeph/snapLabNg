// Low-tier ink: the hull's flat pen colour.
precision highp float;

#include <clipping_planes_pars_fragment>

uniform vec3 inkColour;

void main() {
  #include <clipping_planes_fragment>
  gl_FragColor = vec4(inkColour, 1.0);
  #include <colorspace_fragment>
}
