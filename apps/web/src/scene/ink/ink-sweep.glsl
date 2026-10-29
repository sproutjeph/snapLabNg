// The draw-on mask shared by the ink outline effect (high and mid) and the low-tier hulls: a
// front that runs outward from `inkSweepOrigin` (the centre of her page) across the bench, its
// edge roughened by two octaves of value noise, so the lines look drawn by a pen rather than
// wiped on. `inkSweepReach` is the distance to the farthest part. reveal 1 is fully drawn
// everywhere, so a canvas without a reveal never depends on the origin.
uniform vec3 inkSweepOrigin;
uniform float inkSweepReach;

float inkSweepHash(const in vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float inkSweepNoise(const in vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = inkSweepHash(i);
  float b = inkSweepHash(i + vec2(1.0, 0.0));
  float c = inkSweepHash(i + vec2(0.0, 1.0));
  float d = inkSweepHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 0 → 1: how much of the ink at `worldPos` is drawn when the reveal stands at `reveal`.
float inkSweep(const in vec3 worldPos, const in float reveal) {
  if (reveal >= 1.0) return 1.0;
  if (reveal <= 0.0) return 0.0;
  float d = distance(worldPos, inkSweepOrigin) / max(inkSweepReach, 1e-5);
  float n = inkSweepNoise(worldPos.xz * 22.0) * 0.65 + inkSweepNoise(worldPos.xz * 71.0) * 0.35;
  // The front starts just short of the origin and passes the farthest part (plus the noise
  // band) before reveal reaches 1, so the end state has no pop.
  float front = reveal * 1.35 - 0.15;
  return smoothstep(0.0, 0.035, front - d - (n - 0.5) * 0.2);
}
