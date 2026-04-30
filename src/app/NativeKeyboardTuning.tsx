"use client";

import { useEffect } from "react";

type KeyboardPlugin = {
  setAccessoryBarVisible?: (options: { isVisible: boolean }) => Promise<void> | void;
  setResizeMode?: (options: { mode: string }) => Promise<void> | void;
};

type CapacitorLike = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: {
    Keyboard?: KeyboardPlugin;
  };
};

declare global {
  interface Window {
    Capacitor?: CapacitorLike;
    Keyboard?: KeyboardPlugin;
  }
}

export default function NativeKeyboardTuning() {
  useEffect(() => {
    const capacitor = window.Capacitor;
    const platform = capacitor?.getPlatform?.() || "";
    const isNative = capacitor?.isNativePlatform?.() || platform === "ios" || platform === "android";
    if (!isNative) return;

    const keyboard = capacitor?.Plugins?.Keyboard || window.Keyboard;
    if (!keyboard) return;

    if (platform === "ios" && keyboard.setAccessoryBarVisible) {
      Promise.resolve(keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {});
    }

    if (keyboard.setResizeMode) {
      Promise.resolve(keyboard.setResizeMode({ mode: "native" })).catch(() => {});
    }
  }, []);

  return null;
}
