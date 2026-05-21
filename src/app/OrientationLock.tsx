"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

const PHONE_SMALLEST_SIDE_MAX = 700;
const LANDSCAPE_QUERY = "(orientation: landscape)";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary" | "portrait") => Promise<void>;
};

type WindowWithOrientation = Window & {
  orientation?: number;
};

const isPhoneSizedScreen = () => {
  if (typeof window === "undefined") return false;
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  return Math.min(screenWidth, screenHeight) < PHONE_SMALLEST_SIDE_MAX;
};

const screenAngle = () => {
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && Number.isFinite(angle)) return angle;
  const legacyAngle = (window as WindowWithOrientation).orientation;
  return typeof legacyAngle === "number" && Number.isFinite(legacyAngle) ? legacyAngle : 90;
};

const rotationForCurrentLandscape = () => {
  const normalized = ((screenAngle() % 360) + 360) % 360;
  if (normalized === 270) return "90deg";
  if (normalized === 180) return "180deg";
  return "-90deg";
};

export default function OrientationLock() {
  useEffect(() => {
    let cancelled = false;

    const applyPortraitFrame = () => {
      if (cancelled) return;
      const root = document.documentElement;
      const shouldFrame = isPhoneSizedScreen() && window.matchMedia(LANDSCAPE_QUERY).matches;
      root.classList.toggle("drf-phone-landscape-frame", shouldFrame);
      if (shouldFrame) {
        root.style.setProperty("--drf-portrait-width", `${window.innerHeight}px`);
        root.style.setProperty("--drf-portrait-height", `${window.innerWidth}px`);
        root.style.setProperty("--drf-counter-rotation", rotationForCurrentLandscape());
      } else {
        root.style.removeProperty("--drf-portrait-width");
        root.style.removeProperty("--drf-portrait-height");
        root.style.removeProperty("--drf-counter-rotation");
      }
    };

    const lockPortrait = async () => {
      if (cancelled || !isPhoneSizedScreen()) return;
      if (Capacitor.isNativePlatform()) {
        try {
          await ScreenOrientation.lock({ orientation: "portrait" });
          return;
        } catch {}
      }

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

    applyPortraitFrame();
    void lockPortrait();
    const relock = () => {
      applyPortraitFrame();
      void lockPortrait();
    };
    window.addEventListener("orientationchange", relock);
    window.addEventListener("resize", relock);
    document.addEventListener("visibilitychange", relock);

    return () => {
      cancelled = true;
      document.documentElement.classList.remove("drf-phone-landscape-frame");
      document.documentElement.style.removeProperty("--drf-portrait-width");
      document.documentElement.style.removeProperty("--drf-portrait-height");
      document.documentElement.style.removeProperty("--drf-counter-rotation");
      window.removeEventListener("orientationchange", relock);
      window.removeEventListener("resize", relock);
      document.removeEventListener("visibilitychange", relock);
    };
  }, []);

  return null;
}
