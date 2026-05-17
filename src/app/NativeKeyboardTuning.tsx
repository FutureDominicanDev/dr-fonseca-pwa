"use client";

import { useEffect } from "react";

type KeyboardPlugin = {
  setAccessoryBarVisible?: (options: { isVisible: boolean }) => Promise<void> | void;
  setResizeMode?: (options: { mode: string }) => Promise<void> | void;
  addListener?: (
    eventName: "keyboardWillShow" | "keyboardDidShow" | "keyboardWillHide" | "keyboardDidHide",
    listenerFunc: (info?: { keyboardHeight?: number }) => void,
  ) => Promise<{ remove?: () => Promise<void> | void }> | { remove?: () => Promise<void> | void };
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
      Promise.resolve(keyboard.setResizeMode({ mode: "body" })).catch(() => {});
    }

    const root = document.documentElement;
    let keyboardOpen = false;
    let baseViewportHeight = window.visualViewport?.height || window.innerHeight || 0;
    const listeners: Array<{ remove?: () => Promise<void> | void }> = [];

    const writeKeyboardHeight = (height: number) => {
      const safeHeight = Math.max(0, Math.round(height || 0));
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight || baseViewportHeight;
      const resizedBy = keyboardOpen ? Math.max(0, baseViewportHeight - currentViewportHeight) : 0;
      const overlayHeight = Math.max(0, safeHeight - resizedBy);
      root.style.setProperty("--native-keyboard-overlay-height", `${overlayHeight}px`);
      root.classList.toggle("native-keyboard-open", safeHeight > 0);
    };

    const refreshBaseViewportHeight = () => {
      if (keyboardOpen) return;
      baseViewportHeight = window.visualViewport?.height || window.innerHeight || baseViewportHeight;
    };

    const bindKeyboardListener = async (
      eventName: "keyboardWillShow" | "keyboardDidShow" | "keyboardWillHide" | "keyboardDidHide",
      listenerFunc: (info?: { keyboardHeight?: number }) => void,
    ) => {
      const listener = await Promise.resolve(keyboard.addListener?.(eventName, listenerFunc)).catch(() => null);
      if (listener) listeners.push(listener);
    };

    void bindKeyboardListener("keyboardWillShow", (info) => {
      keyboardOpen = true;
      writeKeyboardHeight(info?.keyboardHeight || 0);
    });
    void bindKeyboardListener("keyboardDidShow", (info) => {
      keyboardOpen = true;
      writeKeyboardHeight(info?.keyboardHeight || 0);
    });
    void bindKeyboardListener("keyboardWillHide", () => {
      keyboardOpen = false;
      writeKeyboardHeight(0);
      window.setTimeout(refreshBaseViewportHeight, 120);
    });
    void bindKeyboardListener("keyboardDidHide", () => {
      keyboardOpen = false;
      writeKeyboardHeight(0);
      window.setTimeout(refreshBaseViewportHeight, 120);
    });

    window.visualViewport?.addEventListener("resize", refreshBaseViewportHeight);
    window.addEventListener("resize", refreshBaseViewportHeight);

    return () => {
      root.style.removeProperty("--native-keyboard-overlay-height");
      root.classList.remove("native-keyboard-open");
      window.visualViewport?.removeEventListener("resize", refreshBaseViewportHeight);
      window.removeEventListener("resize", refreshBaseViewportHeight);
      listeners.forEach((listener) => {
        try { void listener.remove?.(); } catch {}
      });
    };
  }, []);

  return null;
}
