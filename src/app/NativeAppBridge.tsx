"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const NATIVE_TOKEN_STORAGE_KEY = "drf_native_push_token";
const NATIVE_PLATFORM_STORAGE_KEY = "drf_native_platform";

const patientRoomContext = () => {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
  if (!match?.[1]) return null;
  const token = new URLSearchParams(window.location.search).get("token") || "";
  return token ? { roomId: decodeURIComponent(match[1]), roomToken: token } : null;
};

export default function NativeAppBridge() {
  useEffect(() => {
    let cancelled = false;
    const listeners: Array<{ remove?: () => Promise<void> | void }> = [];

    const postNativeToken = async (token: string, platform: string) => {
      if (!token) return;
      window.localStorage.setItem(NATIVE_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(NATIVE_PLATFORM_STORAGE_KEY, platform);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const patientRoom = patientRoomContext();
      const userType = accessToken ? "staff" : patientRoom ? "patient" : "";
      if (!userType) return;

      await fetch("/api/native/push-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          token,
          platform,
          userType,
          roomId: patientRoom?.roomId,
          roomToken: patientRoom?.roomToken,
        }),
      }).catch(() => {});
    };

    const bootNative = async () => {
      try {
        const [{ Capacitor }, { App }, { SplashScreen }, { PushNotifications }, { LocalNotifications }, { Preferences }, secureStorage, biometricAuth] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/app"),
          import("@capacitor/splash-screen"),
          import("@capacitor/push-notifications"),
          import("@capacitor/local-notifications"),
          import("@capacitor/preferences"),
          import("@aparajita/capacitor-secure-storage").catch(() => ({})),
          import("@aparajita/capacitor-biometric-auth").catch(() => ({})),
        ]);
        if (cancelled || !Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform();
        await SplashScreen.hide().catch(() => {});
        await Preferences.set({ key: "drf_last_native_launch", value: new Date().toISOString() }).catch(() => {});

        const SecureStorage = (secureStorage as any).SecureStorage;
        if (SecureStorage?.set) {
          await SecureStorage.set({ key: "drf_native_shell", value: "enabled" }).catch(() => {});
        }

        const BiometricAuth = (biometricAuth as any).BiometricAuth;
        if (BiometricAuth?.checkBiometry) {
          await BiometricAuth.checkBiometry().catch(() => {});
        }

        if (platform === "android" && (LocalNotifications as any).createChannel) {
          await (LocalNotifications as any).createChannel({
            id: "critical_alerts",
            name: "Critical medical alerts",
            description: "Patient and staff communication alerts",
            importance: 5,
            visibility: 1,
            sound: "critical-repeat.wav",
            vibration: true,
          }).catch(() => {});
        }

        await LocalNotifications.requestPermissions().catch(() => {});
        const pushPermission = await PushNotifications.requestPermissions().catch(() => null);
        if (pushPermission?.receive === "granted") {
          await PushNotifications.register().catch(() => {});
        }

        const registration = await PushNotifications.addListener("registration", (registrationToken) => {
          void postNativeToken(registrationToken.value, platform);
        });
        listeners.push(registration);

        const received = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          void LocalNotifications.schedule({
            notifications: [{
              id: Date.now() % 2147483647,
              title: notification.title || "Dr. Fonseca Portal",
              body: notification.body || "New portal message",
              channelId: "critical_alerts",
              sound: "critical-repeat.wav",
              extra: notification.data || {},
            }],
          }).catch(() => {});
        });
        listeners.push(received);

        const action = await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          const url = event.notification.data?.url;
          if (typeof url === "string" && url.startsWith("/")) window.location.href = url;
        });
        listeners.push(action);

        const appUrlOpen = await App.addListener("appUrlOpen", (event) => {
          try {
            const url = new URL(event.url);
            window.location.href = `${url.pathname}${url.search}${url.hash}`;
          } catch {}
        });
        listeners.push(appUrlOpen);
      } catch {
        // Native plugins are only available inside the Capacitor shell.
      }
    };

    void bootNative();
    return () => {
      cancelled = true;
      listeners.forEach((listener) => {
        try { void listener.remove?.(); } catch {}
      });
    };
  }, []);

  return null;
}
