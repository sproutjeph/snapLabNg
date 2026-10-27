import { useEffect, useState } from "react";

/** Tracks connectivity from `navigator.onLine` and the online/offline events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
