"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // In development a service worker would serve stale code over hot reload,
    // so remove any leftover registration and its caches instead.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches.keys())
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k.startsWith("madaq-cache")).map((k) => caches.delete(k))
          )
        )
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("PWA SW registration warning:", err));
  }, []);

  return null;
}
