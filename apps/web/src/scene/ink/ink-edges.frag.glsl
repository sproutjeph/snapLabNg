// Ink outline effect (a postprocessing Effect with EffectAttribute.DEPTH), after Backcountry
// 101's ink pass (docs/plans/exam-redesign-brief.md, research report 2). Eight taps on a circle
// of one line width round each pixel find:
//   - silhouettes, drawn on the FAR side of the edge, like the low tier's hulls: on the paper
//     next to a part, or on the part behind a nearer one (at one depth the higher id takes it),
//     or on the far side of a step within one part. So a lead a few pixels wide keeps its colour
//     inside its outline on every tier. The line takes the strength and focus of the part that
//     owns the edge (the nearer one); thin parts draw it lighter;
//   - creases, at a weight of .4, centred on the fold and within one id only: the normal turns
//     on one side of the pixel and not the other, so the even curve of a lead draws nothing.
// Depth steps are relative for a perspective camera and in metres for an orthographic one
// (postprocessing's getViewZ handles both); a surface's own slope is taken out first, so a plane
// seen at a grazing angle never reads as a step. Inked pixels get the grade (saturation 1.1) and
// the focus fade; paper is never graded. Inputs: the scene depth and the ink-ID target
// (rg = normal xy, b = strength + 2 if thin, a = id + 1; see ink-id.frag.glsl).
precision highp float;

uniform vec3 inkColour;
uniform vec3 inkPaper;
uniform float inkOpacity;
uniform float inkReveal;
uniform sampler2D inkBuffer;
uniform sampler2D inkFocusMap;
uniform float inkRadius;
uniform float thinAlpha;
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

/** 1 when the sample belongs to the same part as the centre (never on paper). */
float inkSame(const in vec4 s, const in float idC) {
  return step(0.5, s.a) * (1.0 - step(0.5, abs(inkIdOf(s) - idC)));
}

float inkFade(const in float id) {
  return texture2D(inkFocusMap, vec2((clamp(id, 0.0, 255.0) + 0.5) / 256.0, 0.5)).r;
}

// The edge a neighbour `n` throws on this pixel. `nearer` > 0: the neighbour is nearer than this
// pixel's surface would be there. Lines fall on the far side, so only a nearer neighbour counts.
float inkEdge(const in float covC, const in float idC, const in vec4 n, const in float nearer, const in float thr) {
  if (n.a < 0.5) return 0.0;
  if (covC < 0.5) return 1.0;
  float idN = inkIdOf(n);
  float level = thr * 0.05;
  float differ = step(0.5, abs(idN - idC));
  float atLevel = step(abs(nearer), level);
  float eId = differ * max(step(level, nearer), atLevel * step(idN, idC - 0.5));
  float eDepth = smoothstep(thr * 0.5, thr, nearer);
  return max(eId, eDepth);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 c = texture2D(inkBuffer, uv);
  float covC = step(0.5, c.a);
  float idC = inkIdOf(c);
  float zC = inkViewDepth(depth);
#ifdef PERSPECTIVE_CAMERA
  float thr = depthThreshold;
#else
  float thr = depthThresholdM;
#endif
  vec2 outer = texelSize * inkRadius;
  vec2 inner = outer * 0.5;

  // The strongest edge, and the sample that owns it.
  float edge = 0.0;
  vec4 owner = c;
  vec2 ownerUv = uv;
  for (int i = 0; i < 4; i++) {
    vec2 sa = uv + INK_DIRS[i * 2] * outer;
    vec2 sb = uv + INK_DIRS[i * 2 + 1] * outer;
    vec4 na = texture2D(inkBuffer, sa);
    vec4 nb = texture2D(inkBuffer, sb);
    // Paper pixels only ask whether a part is next to them: no depth needed.
    float nearerA = 0.0;
    float nearerB = 0.0;
    if (covC > 0.5) {
      float za = inkViewDepth(readDepth(sa));
      float zb = inkViewDepth(readDepth(sb));
      // This surface carried on past the pixel, from the opposite sample when it is this part.
      nearerA = inkDepthUnits((zC - za) + inkSame(nb, idC) * (zC - zb), zC);
      nearerB = inkDepthUnits((zC - zb) + inkSame(na, idC) * (zC - za), zC);
    }
    float ea = inkEdge(covC, idC, na, nearerA, thr);
    float eb = inkEdge(covC, idC, nb, nearerB, thr);
    if (ea > edge) { edge = ea; owner = na; ownerUv = sa; }
    if (eb > edge) { edge = eb; owner = nb; ownerUv = sb; }
  }
  float ownerThin = step(1.5, owner.b);
  float ownerStrength = clamp(owner.b - 2.0 * ownerThin, 0.0, 1.0);
  float line = edge * ownerStrength * mix(1.0, thinAlpha, ownerThin) * mix(1.0, focusInk, inkFade(inkIdOf(owner)));

  float fadeC = 0.0;
  float crease = 0.0;
  vec3 col = inputColor.rgb;
  if (covC > 0.5) {
    // Crease: the normal turns on one side and not the other. Any fold line crosses one of the
    // two axis pairs.
    vec3 nC = inkNormalOf(c);
    for (int i = 0; i < 2; i++) {
      vec4 na = texture2D(inkBuffer, uv + INK_DIRS[i * 2] * inner);
      vec4 nb = texture2D(inkBuffer, uv + INK_DIRS[i * 2 + 1] * inner);
      float same = inkSame(na, idC) * inkSame(nb, idC);
      float bend = abs(distance(inkNormalOf(na), nC) - distance(inkNormalOf(nb), nC));
      crease = max(crease, same * smoothstep(creaseThreshold * 0.7, creaseThreshold, bend));
    }
    float thinC = step(1.5, c.b);
    float strengthC = clamp(c.b - 2.0 * thinC, 0.0, 1.0);
    fadeC = inkFade(idC);
    crease *= creaseWeight * strengthC * mix(1.0, thinAlpha, thinC) * mix(1.0, focusInk, fadeC);
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = max(mix(vec3(luma), col, inkSaturation), 0.0);
    col = mix(col, inkPaper, focusPaper * fadeC);
  }
  float ink = max(line, crease);

  // Draw-on: the line shows only where the sweep has passed, judged at the part that owns it.
  float drawn = 1.0;
  if (inkReveal < 1.0 && ink > 0.0) {
    vec2 at = edge >= crease ? ownerUv : uv;
    // The owner's depth is read only here, while the ink draws itself on.
    float d = edge >= crease ? readDepth(ownerUv) : depth;
    vec4 view = inkProjInverse * vec4(at * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec3 viewPos = view.xyz / (abs(view.w) > 1e-5 ? view.w : 1e-5);
    drawn = inkSweep((inkCameraWorld * vec4(viewPos, 1.0)).xyz, inkReveal);
  }

  float a = clamp(ink * inkOpacity * drawn, 0.0, 1.0);
  outputColor = vec4(mix(col, inkColour, a), inputColor.a);
}
