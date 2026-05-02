"use client";

import { useEffect, useRef } from "react";

const VERSION_URL = "/api/app-version";
const CHECK_INTERVAL_MS = 30000;

export default function AppUpdateWatcher() {
  const currentVersionRef = useRef("");
  const reloadingRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;

    const hardReload = async () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
        }
      } finally {
        window.location.reload();
      }
    };

    const checkVersion = async () => {
      try {
        const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json();
        const nextVersion = `${data?.version || ""}`;
        if (!nextVersion) return;
        if (!currentVersionRef.current) {
          currentVersionRef.current = nextVersion;
          return;
        }
        if (currentVersionRef.current !== nextVersion && !stopped) {
          await hardReload();
        }
      } catch {
        // Network interruptions are normal on mobile; the next interval will retry.
      }
    };

    checkVersion();
    timer = window.setInterval(checkVersion, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                hardReload();
              }
            });
          });
        })
        .catch(() => undefined);
    }

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
