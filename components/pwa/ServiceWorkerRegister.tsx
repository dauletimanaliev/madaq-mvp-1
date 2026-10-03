"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register in browser environments
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("⚡ [PWA] Service Worker registered:", reg.scope))
        .catch((err) => console.warn("PWA SW registration warning:", err));
    }
  }, []);

  return null;
}
