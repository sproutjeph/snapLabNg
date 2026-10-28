// Ink outline effect (a postprocessing Effect with EffectAttribute.DEPTH). Samples 8 directions
// (4 opposite pairs) round each pixel and draws blue-black pen lines where:
//   - the scene depth jumps (silhouettes),
//   - the ink id changes (two touching parts), or
//   - the view-space normal bends sharply (creases: it turns on one side of a pair and not the
//     other, so the even turn of a lead or a rod is not mistaken for an edge).
// Silhouette and part lines go on the far side of the edge only, a full line width out, so a
// lead a few pixels wide keeps its colour inside its outline. Creases sit centred on the fold,
// sampled at half the width. Inputs: the scene depth and the ink-ID target
// (rgb = normal, a = id * 2 + thin).
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

float inkCovered(const in vec4 s) {
  return step(0.25, dot(s.rgb, s.rgb));
}

// Silhouette and part edges against one neighbour, drawn only when this pixel is the far side.
float inkOuterEdge(const in vec4 c, const in float zC, const in vec4 n, const in float zN) {
  float behind = zC - zN;
  float near = max(min(zN, zC), 1e-5);
  // Relative depth jump, only where something inked is involved, so the paper desk (not in
  // the ink pass) never draws its own border.
  float cov = max(inkCovered(c), inkCovered(n));
  float eDepth = cov * step(0.0, behind) * smoothstep(depthThreshold * 0.5, depthThreshold, behind / near);
  float idC = floor(c.a * 0.5);
  float idN = floor(n.a * 0.5);
  // Touching parts at one depth: the lower id takes the line, so it is drawn once.
  float level = step(abs(behind) / near, 0.002);
  float farSide = max(step(0.002, behind / near), level * step(idC, idN - 0.5));
  float eId = step(0.5, abs(idN - idC)) * farSide;
  float thin = clamp(max(c.a - idC * 2.0, n.a - idN * 2.0), 0.0, 1.0);
  return max(eDepth, eId) * mix(1.0, thinAlpha, thin);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float zC = inkViewDepth(depth);
  vec4 c = texture2D(inkBuffer, uv);
  float covC = inkCovered(c);
  float thinC = clamp(c.a - floor(c.a * 0.5) * 2.0, 0.0, 1.0);
  vec2 outer = texelSize * inkRadius;
  vec2 inner = outer * 0.5;

  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 da = INK_DIRS[i * 2];
    vec2 db = INK_DIRS[i * 2 + 1];
    vec2 sa = uv + da * outer;
    vec2 sb = uv + db * outer;
    ink = max(ink, inkOuterEdge(c, zC, texture2D(inkBuffer, sa), inkViewDepth(readDepth(sa))));
    ink = max(ink, inkOuterEdge(c, zC, texture2D(inkBuffer, sb), inkViewDepth(readDepth(sb))));

    // Crease: the normal turns on one side and not the other. An even curve (a lead, a rod)
    // turns the same both ways and draws nothing. Only inside inked surfaces; silhouettes are
    // the depth test's job.
    vec4 na = texture2D(inkBuffer, uv + da * inner);
    vec4 nb = texture2D(inkBuffer, uv + db * inner);
    float bend = abs(distance(na.rgb, c.rgb) - distance(nb.rgb, c.rgb));
    float cov = covC * inkCovered(na) * inkCovered(nb);
    float eCrease = cov * smoothstep(creaseThreshold * 0.7, creaseThreshold, bend);
    ink = max(ink, eCrease * mix(1.0, thinAlpha, thinC));
  }

  float a = clamp(ink * inkOpacity * inkReveal, 0.0, 1.0);
  outputColor = vec4(mix(inputColor.rgb, inkColour, a), inputColor.a);
}
