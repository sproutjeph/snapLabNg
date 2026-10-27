let hasLoggedError = false;

function logErrorOnce(error: unknown): void {
  if (hasLoggedError) return;
  hasLoggedError = true;
  console.error("SnapLab: service worker registration failed", error);
}

/**
 * Registers `/sw.js` in production builds only, when the browser supports
 * service workers and the page is not inside an iframe. Failures are logged
 * once and never thrown: the app must keep working without the worker.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    if (window.self !== window.top) return;
  } catch {
    return; // A cross-origin parent cannot be inspected; treat as framed.
  }
  try {
    navigator.serviceWorker.register("/sw.js").catch(logErrorOnce);
  } catch (error) {
    logErrorOnce(error);
  }
}
