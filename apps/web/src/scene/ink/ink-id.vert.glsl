// Ink-ID pass, vertex: view-space normal for the crease test. Three's chunks keep instancing
// and clipping planes (the hero's rise) working under the override material. The normal is
// transformed by hand (not defaultnormal_vertex), so it never depends on FLIP_SIDED: the pass
// takes each object's own side per draw, and the fragment shader faces the normal to the camera.
#include <common>
#include <clipping_planes_pars_vertex>

varying vec3 vInkNormal;

void main() {
  vec3 objectNormal = vec3(normal);
  #ifdef USE_INSTANCING
    mat3 im = mat3(instanceMatrix);
    objectNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    objectNormal = im * objectNormal;
  #endif
  vInkNormal = normalMatrix * objectNormal;
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
}
