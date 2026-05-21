"use client";

import { useEffect } from "react";

const PHONE_SMALLEST_SIDE_MAX = 700;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary" | "portrait") => Promise<void>;
};

const isPhoneSizedScreen = () => {
  if (typeof window === "undefined") return false;
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  return Math.min(screenWidth, screenHeight) < PHONE_SMALLEST_SIDE_MAX;
};

export default function OrientationLock() {
  useEffect(() => {
    let cancelled = false;

    const lockPortrait = async () => {
      if (cancelled || !isPhoneSizedScreen()) return;
      const orientation = window.screen?.orientation as LockableOrientation | undefined;
      if (!orientation?.lock) return;

      try {
        await orientation.lock("portrait-primary");
      } catch {
        try {
          await orientation.lock("portrait");
        } catch {}
      }
    };

    void lockPortrait();
    const relock = () => void lockPortrait();
    window.addEventListener("orientationchange", relock);
    window.addEventListener("resize", relock);
    document.addEventListener("visibilitychange", relock);

    return () => {
      cancelled = true;
      window.removeEventListener("orientationchange", relock);
      window.removeEventListener("resize", relock);
      document.removeEventListener("visibilitychange", relock);
    };
  }, []);

  return null;
}
