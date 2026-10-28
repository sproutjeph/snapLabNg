// Ink outline effect (a postprocessing Effect with EffectAttribute.DEPTH). Samples 8 directions
// (4 opposite pairs) round each pixel and draws blue-black pen lines where:
//   - the scene depth jumps (silhouettes),
//   - the view-space normal bends sharply (creases: the second difference across a pair, so the
//     smooth turn of a thin lead or a rod is not mistaken for an edge), or
//   - the ink id changes (two touching parts).
// Inputs: the scene depth and the ink-ID target (rgb = normal, a = id * 2 + thin).
precision highp float;

uniform vec3 inkColour;
uniform float inkOpacity;
uniform float inkReveal;
uniform sampler2D inkBuffer;
uniform float inkRadius;
uniform float depthThreshold;
uniform float creaseThreshold;
uniform float thinAlpha;

// Opposite directions sit next to each other: (0, 1), (2, 3), (4, 5), (6, 7).
const vec2 INK_DIRS[8] = vec2[8](
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
  vec2(0.7071, 0.7071), vec2(-0.7071, -0.7071), vec2(-0.7071, 0.7071), vec2(0.7071, -0.7071)
);

float inkViewDepth(const in float d) {
  return max(-getViewZ(d), 1e-5);
}

// Depth and id edges against one neighbour, already weighted for `thin` parts.
float inkTapEdge(const in vec4 c, const in float zC, const in vec4 n, const in float zN) {
  float covC = step(0.25, dot(c.rgb, c.rgb));
  float covN = step(0.25, dot(n.rgb, n.rgb));
  // Relative depth jump, only where something inked is involved, so the paper desk (not in
  // the ink pass) never draws its own border.
  float dz = abs(zN - zC) / max(min(zN, zC), 1e-5);
  float eDepth = max(covC, covN) * smoothstep(depthThreshold * 0.5, depthThreshold, dz);
  float idC = floor(c.a * 0.5);
  float idN = floor(n.a * 0.5);
  float eId = step(0.5, abs(idN - idC));
  float thin = max(c.a - idC * 2.0, n.a - idN * 2.0);
  return max(eDepth, eId) * mix(1.0, thinAlpha, thin);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float zC = inkViewDepth(depth);
  vec4 c = texture2D(inkBuffer, uv);
  float covC = step(0.25, dot(c.rgb, c.rgb));
  float thinC = c.a - floor(c.a * 0.5) * 2.0;
  vec2 step1 = texelSize * inkRadius;

  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 sa = uv + INK_DIRS[i * 2] * step1;
    vec2 sb = uv + INK_DIRS[i * 2 + 1] * step1;
    vec4 na = texture2D(inkBuffer, sa);
    vec4 nb = texture2D(inkBuffer, sb);
    float za = inkViewDepth(readDepth(sa));
    float zb = inkViewDepth(readDepth(sb));
    ink = max(ink, inkTapEdge(c, zC, na, za));
    ink = max(ink, inkTapEdge(c, zC, nb, zb));

    // Crease: zero for a flat face or an even curve, large where the normal steps.
    float bend = length(na.rgb + nb.rgb - 2.0 * c.rgb);
    float cov = max(covC, max(step(0.25, dot(na.rgb, na.rgb)), step(0.25, dot(nb.rgb, nb.rgb))));
    float eCrease = cov * smoothstep(creaseThreshold * 0.7, creaseThreshold, bend);
    ink = max(ink, eCrease * mix(1.0, thinAlpha, thinC));
  }

  float a = clamp(ink * inkOpacity * inkReveal, 0.0, 1.0);
  outputColor = vec4(mix(inputColor.rgb, inkColour, a), inputColor.a);
}
