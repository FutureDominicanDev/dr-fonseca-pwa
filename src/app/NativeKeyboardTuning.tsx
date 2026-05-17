"use client";

import { useEffect } from "react";

type KeyboardPlugin = {
  hide?: () => Promise<void> | void;
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

    const root = document.documentElement;
    root.classList.add("native-platform", `native-${platform}`);

    if (platform === "ios" && keyboard.setAccessoryBarVisible) {
      Promise.resolve(keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {});
    }

    if (platform === "ios" && keyboard.setResizeMode) {
      Promise.resolve(keyboard.setResizeMode({ mode: "body" })).catch(() => {});
    }

    let keyboardOpen = false;
    let baseViewportHeight = window.visualViewport?.height || window.innerHeight || 0;
    let dismissTouchStartX = 0;
    let dismissTouchStartY = 0;
    let trackingDismissSwipe = false;
    const listeners: Array<{ remove?: () => Promise<void> | void }> = [];

    const writeKeyboardHeight = (height: number) => {
      const safeHeight = Math.max(0, Math.round(height || 0));
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight || baseViewportHeight;
      const resizedBy = keyboardOpen ? Math.max(0, baseViewportHeight - currentViewportHeight) : 0;
      const overlayHeight = platform === "android" ? 0 : Math.max(0, safeHeight - resizedBy);
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

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']"));
    };

    const dismissKeyboard = () => {
      Promise.resolve(keyboard.hide?.()).catch(() => {});
      const active = document.activeElement;
      if (active instanceof HTMLElement && typeof active.blur === "function") {
        active.blur();
      }
      keyboardOpen = false;
      writeKeyboardHeight(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!keyboardOpen) return;
      const target = event.target;
      if (!(target instanceof Element) || isEditableTarget(target)) return;
      if (!target.closest(".chat-bg, .staff-thread-list, .patient-chat-scroll")) return;

      const touch = event.touches[0];
      if (!touch) return;
      dismissTouchStartX = touch.clientX;
      dismissTouchStartY = touch.clientY;
      trackingDismissSwipe = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!trackingDismissSwipe || !keyboardOpen) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - dismissTouchStartX;
      const deltaY = touch.clientY - dismissTouchStartY;
      if (Math.abs(deltaY) > 28 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        trackingDismissSwipe = false;
        dismissKeyboard();
      }
    };

    const handleTouchEnd = () => {
      trackingDismissSwipe = false;
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
    document.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true, capture: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true, capture: true });

    return () => {
      root.style.removeProperty("--native-keyboard-overlay-height");
      root.classList.remove("native-keyboard-open");
      root.classList.remove("native-platform", `native-${platform}`);
      window.visualViewport?.removeEventListener("resize", refreshBaseViewportHeight);
      window.removeEventListener("resize", refreshBaseViewportHeight);
      document.removeEventListener("touchstart", handleTouchStart, { capture: true });
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
      document.removeEventListener("touchend", handleTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", handleTouchEnd, { capture: true });
      listeners.forEach((listener) => {
        try { void listener.remove?.(); } catch {}
      });
    };
  }, []);

  return null;
}
