import { useEffect, useState } from "react";
import OfflineNotice from "./OfflineNotice";
import { registerServiceWorker } from "./register";
import { useOnline } from "./useOnline";

interface CacheInfo {
  name: string;
  entries: number;
}

interface WorkerStatus {
  supported: boolean;
  registered: boolean;
  controlling: boolean;
  caches: CacheInfo[];
}

/**
 * Preview page for `?pwa=1`: service-worker registration and control state,
 * cache names with entry counts, and the online state. It registers the
 * worker itself so the offline behaviour can be checked before `main.tsx`
 * is wired up (see "Needs from lead" in the PR).
 */
export default function PwaPreview() {
  const online = useOnline();
  const [status, setStatus] = useState<WorkerStatus | null>(null);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    registerServiceWorker();

    let cancelled = false;
    async function refresh() {
      const supported = "serviceWorker" in navigator;
      let registered = false;
      let controlling = false;
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration();
        registered = registration !== undefined;
        controlling = navigator.serviceWorker.controller !== null;
      }
      const cacheInfos: CacheInfo[] = [];
      if ("caches" in window) {
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          cacheInfos.push({ name, entries: (await cache.keys()).length });
        }
      }
      if (!cancelled) setStatus({ supported, registered, controlling, caches: cacheInfos });
    }

    void refresh();
    const onControllerChange = () => void refresh();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }
    return () => {
      cancelled = true;
      delete window.__SNAPLAB_READY__;
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, []);

  const yesNo = (value: boolean) => (value ? "yes" : "no");

  return (
    <main
      style={{
        minHeight: "100%",
        overflowY: "auto",
        background: "#0b0d12",
        color: "#e6edf3",
        font: "15px/1.55 system-ui, sans-serif",
        padding: online ? "28px 20px 96px" : "76px 20px 96px",
        boxSizing: "border-box",
      }}
    >
      <OfflineNotice />
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Offline app (PWA) status</h1>
      <p style={{ color: "#9aa7b4", margin: "0 0 20px" }}>
        Installable app shell, service worker and caches for the offline demo.
      </p>
      {status === null ? (
        <p>Checking…</p>
      ) : (
        <dl style={{ display: "grid", gap: 10, margin: 0 }}>
          <div>
            <dt style={{ color: "#9aa7b4" }}>Service worker supported</dt>
            <dd style={{ margin: 0 }}>{yesNo(status.supported)}</dd>
          </div>
          <div>
            <dt style={{ color: "#9aa7b4" }}>Service worker registered</dt>
            <dd style={{ margin: 0 }}>{yesNo(status.registered)}</dd>
          </div>
          <div>
            <dt style={{ color: "#9aa7b4" }}>Controlling this page</dt>
            <dd style={{ margin: 0 }}>{yesNo(status.controlling)}</dd>
          </div>
          <div>
            <dt style={{ color: "#9aa7b4" }}>Online</dt>
            <dd style={{ margin: 0 }}>{online ? "online" : "offline"}</dd>
          </div>
          <div>
            <dt style={{ color: "#9aa7b4" }}>Caches</dt>
            <dd style={{ margin: 0 }}>
              {status.caches.length === 0 ? (
                "none"
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {status.caches.map((cache) => (
                    <li key={cache.name}>
                      {cache.name}: {cache.entries} entries
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      )}
    </main>
  );
}
