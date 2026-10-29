// Ink outline effect (a postprocessing Effect with EffectAttribute.DEPTH), after Backcountry
// 101's ink pass (docs/plans/exam-redesign-brief.md, research report 2). Ink is drawn only on
// pixels of inked parts, so every line sits inside its part's silhouette and takes that part's
// ink strength and focus. Eight taps on a circle of one line width (×0.55 for thin parts) find:
//   - silhouettes: the neighbour is paper, or another part that is not nearer (at one depth the
//     lower id draws), or the same part folding away behind a depth step;
//   - creases, at a weight of .4 and within one id only: the normal turns on one side of the
//     pixel and not the other, so the even curve of a lead or a rod draws nothing.
// Depth steps are relative for a perspective camera and in metres for an orthographic one
// (postprocessing's getViewZ handles both). Inked pixels get the grade (saturation 1.1) and the
// focus fade; paper is left exactly as it is. Inputs: the scene depth and the ink-ID target
// (rg = normal xy, b = strength + 2 if thin, a = id + 1; see ink-id.frag.glsl).
precision highp float;

uniform vec3 inkColour;
uniform vec3 inkPaper;
uniform float inkOpacity;
uniform float inkReveal;
uniform sampler2D inkBuffer;
uniform sampler2D inkFocusMap;
uniform float inkRadius;
uniform float thinRadius;
uniform float depthThreshold;
uniform float depthThresholdM;
uniform float creaseThreshold;
uniform float creaseWeight;
uniform float inkSaturation;
uniform float focusPaper;
uniform float focusInk;
uniform mat4 inkProjInverse;
uniform mat4 inkCameraWorld;

// Opposite directions sit next to each other: (0, 1), (2, 3), (4, 5), (6, 7).
const vec2 INK_DIRS[8] = vec2[8](
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
  vec2(0.7071, 0.7071), vec2(-0.7071, -0.7071), vec2(-0.7071, 0.7071), vec2(0.7071, -0.7071)
);

float inkViewDepth(const in float d) {
  return max(-getViewZ(d), 1e-5);
}

/** -1 where nothing is inked. */
float inkIdOf(const in vec4 s) {
  return floor(s.a + 0.5) - 1.0;
}

vec3 inkNormalOf(const in vec4 s) {
  return vec3(s.rg, sqrt(max(0.0, 1.0 - dot(s.rg, s.rg))));
}

/** A depth difference in threshold units: relative for perspective, metres for orthographic. */
float inkDepthUnits(const in float dz, const in float zC) {
#ifdef PERSPECTIVE_CAMERA
  return dz / max(zC, 1e-5);
#else
  return dz;
#endif
}

/** 1 when the sample belongs to the same part as the centre. */
float inkSame(const in vec4 s, const in float idC) {
  return step(0.5, s.a) * (1.0 - step(0.5, abs(inkIdOf(s) - idC)));
}

// `gap` > 0: the neighbour is farther than this pixel's own surface would be there (the slope
// of the surface, taken from the opposite sample, is already removed, so a plane seen at a
// grazing angle never reads as a step).
float inkSilhouette(const in float idC, const in vec4 n, const in float gap, const in float thr) {
  if (n.a < 0.5) return 1.0;
  float idN = inkIdOf(n);
  float level = thr * 0.05;
  float differ = step(0.5, abs(idN - idC));
  float atLevel = step(abs(gap), level);
  float eId = differ * max(step(level, gap), atLevel * step(idC, idN - 0.5));
  float eDepth = smoothstep(thr * 0.5, thr, gap);
  return max(eId, eDepth);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 c = texture2D(inkBuffer, uv);
  if (c.a < 0.5) {
    outputColor = inputColor;
    return;
  }
  float idC = inkIdOf(c);
  float thinC = step(1.5, c.b);
  float strength = clamp(c.b - 2.0 * thinC, 0.0, 1.0);
  float zC = inkViewDepth(depth);
#ifdef PERSPECTIVE_CAMERA
  float thr = depthThreshold;
#else
  float thr = depthThresholdM;
#endif
  vec2 outer = texelSize * inkRadius * mix(1.0, thinRadius, thinC);
  vec2 inner = outer * 0.5;

  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 sa = uv + INK_DIRS[i * 2] * outer;
    vec2 sb = uv + INK_DIRS[i * 2 + 1] * outer;
    vec4 na = texture2D(inkBuffer, sa);
    vec4 nb = texture2D(inkBuffer, sb);
    float za = inkViewDepth(readDepth(sa));
    float zb = inkViewDepth(readDepth(sb));
    // The surface's own slope toward each side, from the opposite sample when it is this part.
    float slopeA = inkSame(nb, idC) * (zC - zb);
    float slopeB = inkSame(na, idC) * (zC - za);
    ink = max(ink, inkSilhouette(idC, na, inkDepthUnits(za - zC - slopeA, zC), thr));
    ink = max(ink, inkSilhouette(idC, nb, inkDepthUnits(zb - zC - slopeB, zC), thr));
  }

  // Crease: the normal turns on one side and not the other. Any fold line crosses one of the
  // two axis pairs.
  vec3 nC = inkNormalOf(c);
  float crease = 0.0;
  for (int i = 0; i < 2; i++) {
    vec4 na = texture2D(inkBuffer, uv + INK_DIRS[i * 2] * inner);
    vec4 nb = texture2D(inkBuffer, uv + INK_DIRS[i * 2 + 1] * inner);
    float same = (1.0 - step(0.5, abs(inkIdOf(na) - idC))) * (1.0 - step(0.5, abs(inkIdOf(nb) - idC)));
    float bend = abs(distance(inkNormalOf(na), nC) - distance(inkNormalOf(nb), nC));
    crease = max(crease, same * smoothstep(creaseThreshold * 0.7, creaseThreshold, bend));
  }
  ink = max(ink, crease * creaseWeight);

  // Draw-on: the line shows only where the sweep has passed. Skipped once fully drawn.
  float drawn = 1.0;
  if (inkReveal < 1.0 && ink > 0.0) {
    vec4 view = inkProjInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec3 viewPos = view.xyz / (abs(view.w) > 1e-5 ? view.w : 1e-5);
    drawn = inkSweep((inkCameraWorld * vec4(viewPos, 1.0)).xyz, inkReveal);
  }

  float fade = texture2D(inkFocusMap, vec2((clamp(idC, 0.0, 255.0) + 0.5) / 256.0, 0.5)).r;
  vec3 col = inputColor.rgb;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(luma), col, inkSaturation), 0.0);
  col = mix(col, inkPaper, focusPaper * fade);
  float a = clamp(ink * strength * inkOpacity * mix(1.0, focusInk, fade) * drawn, 0.0, 1.0);
  outputColor = vec4(mix(col, inkColour, a), inputColor.a);
}
