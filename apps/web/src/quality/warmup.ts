export function measureWarmupFps(ms = 2000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      resolve(0);
      return;
    }
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames += 1;
      const elapsed = performance.now() - start;
      if (elapsed < ms) {
        requestAnimationFrame(tick);
      } else {
        resolve(Math.round((frames / Math.max(elapsed, 1)) * 1000));
      }
    }
    requestAnimationFrame(tick);
  });
}
