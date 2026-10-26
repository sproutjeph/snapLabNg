---
paths:
  - "apps/web/**/*.tsx"
  - "apps/web/**/*.ts"
  - "**/*.glsl"
  - "**/*.vert"
  - "**/*.frag"
  - "**/shaders/**"
---
# Web and 3D code (loads only when these files are touched)

- three.js WebGLRenderer (WebGL2) through React Three Fiber v9 and drei. No WebGPU, no TSL, no `WebGPURenderer`.
- Per frame (`useFrame`): no `new` (Vector3, Color, Matrix4, arrays). Reuse objects created once with `useMemo` or module scope. Mutate refs and uniforms; never call React `setState` every frame.
- Uniforms: create the uniforms object once, then write `.value`. Custom materials go through `extend()` or drei `shaderMaterial`.
- Dispose geometries, materials, textures and render targets you create by hand. Textures ≤ 2048 px.
- GLSL: `#version 300 es` via three's GLSL3 when needed; declare `precision highp float;` in fragment shaders; no dynamic loops over uniform lengths; guard divisions (`max(x, 1e-5)`).
- Budgets (docs/05 §3): initial JS ≤ 350 KB compressed, 3D chunk loads on intent; 60 fps on laptop and iPhone, ≥ 30 on low-end Android with bloom off and DPR 1. Respect the quality tier; every new effect needs a low-tier fallback.
- The UI never shows the expected titre, the true X, or any value computed against the teacher's answer.
- Current-flow particles take their speed from the engine's branch currents; nothing glows from heat. The jockey is tap-to-contact; dragging is a modelled mistake, not a control.
- State: Zustand stores; engine values come from `packages/engine`, marks from `packages/rules`. Components never compute science or marks.
- Use Nigerian naming in UI text: trioxocarbonate(IV), tetraoxosulphate(VI).
- After a visible change, run `/verify-3d` and look at the screenshot before saying it works.
