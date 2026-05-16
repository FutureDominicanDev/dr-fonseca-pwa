"use client";

import { useEffect, useRef } from "react";

const VERSION_URL = "/api/app-version";
const CHECK_INTERVAL_MS = 30000;
const CACHE_NAME_PATTERNS = [
  /^dr-fonseca/i,
  /^next-pwa/i,
  /^workbox/i,
];

function samePathWithRefresh(version: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("app-refresh", version || `${Date.now()}`);
  return url.href;
}

export default function AppUpdateWatcher({ buildVersion }: { buildVersion: string }) {
  const currentVersionRef = useRef(buildVersion || "");
  const reloadingRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;
    let controllerReloaded = false;
    const hadServiceWorkerController =
      "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

    const clearAppCaches = async () => {
      if (!("caches" in window)) return;
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => CACHE_NAME_PATTERNS.some((pattern) => pattern.test(key)))
          .map((key) => caches.delete(key).catch(() => false))
      );
    };

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });
      await registration.update().catch(() => undefined);
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    const hardReload = async () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      try {
        await clearAppCaches();
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(async (registration) => {
              await registration.update().catch(() => undefined);
              if (registration.waiting) {
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            })
          );
        }
      } finally {
        window.location.replace(samePathWithRefresh(currentVersionRef.current));
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
          currentVersionRef.current = nextVersion;
          await hardReload();
        }
      } catch {
        // Network interruptions are normal on mobile; the next interval will retry.
      }
    };

    registerServiceWorker().catch(() => undefined);
    checkVersion();
    timer = window.setInterval(checkVersion, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const onControllerChange = () => {
      if (!hadServiceWorkerController || controllerReloaded || reloadingRef.current) return;
      controllerReloaded = true;
      window.location.replace(samePathWithRefresh(currentVersionRef.current));
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

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
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, [buildVersion]);

  return null;
}
