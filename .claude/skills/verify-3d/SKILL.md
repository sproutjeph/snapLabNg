---
name: verify-3d
description: "Take headless browser screenshots of the running web app (phone and laptop sizes), check console errors and the frame rate, and compare against reference shots. Use after any visible change to the 3D scene, shaders, capture flow or UI, before saying it works."
argument-hint: "[route or scene, e.g. /lab?golden=g1]"
---
Check what the user would actually see. Typecheck passing says nothing about a render.

Route: $ARGUMENTS (default `/?golden=g1`, the golden titration replay).

1. Make sure the dev server is running (`bun run dev` in the background). Wait for the web URL it prints.
2. Run `bun run shot -- --route "<route>"`. The script (`scripts/shot.ts`, created on Day 1) must:
   - launch Playwright Chromium headless with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`;
   - open the route at 390×844 (phone) and 1440×900 (laptop);
   - wait for `window.__SNAPLAB_READY__ === true` (the app sets it after the first rendered frame), with a 15 s timeout;
   - save `.shots/<name>-phone.png` and `.shots/<name>-laptop.png`;
   - print console errors, WebGL warnings, failed requests, and the average fps over 2 s as JSON.
   SwiftShader fps is far below real hardware. Use it to spot drops relative to earlier runs, not as the real number.
3. Read both PNGs. Compare with `.shots/ref/<name>-*.png` if they exist. List what differs: missing objects, black or blank canvas, wrong colours, z-fighting, text clipped, layout overflow on the phone size.
4. Report in at most 8 lines: PASS or FAIL, what you saw, console errors, fps compared with the last run. If FAIL, fix it and run this again.
5. When the user approves a look, copy the shots to `.shots/ref/` as the new reference.

If the screenshot script fails to start WebGL, say so plainly and ask the user to check it on their own browser. Never claim a visual result you did not see.
