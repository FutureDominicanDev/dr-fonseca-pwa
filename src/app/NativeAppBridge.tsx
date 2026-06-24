"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const NATIVE_TOKEN_STORAGE_KEY = "drf_native_push_token";
const NATIVE_PLATFORM_STORAGE_KEY = "drf_native_platform";
const STAFF_SESSION_STORAGE_KEY = "drf_staff_session_v1";
const LEGACY_DEVICE_ALERT_CHANNEL_ID = "portal_device_alerts";
const DEVICE_ALERT_CHANNEL_ID = "portal_urgent_alerts_v3";
const PREVIOUS_DEVICE_ALERT_CHANNEL_ID = "portal_urgent_alerts_v2";
const DEVICE_ALERT_SOUND = "critical_repeat";

type ScreenOrientationModule = {
  ScreenOrientation?: {
    lock?: (options: { orientation: "portrait-primary" | "portrait" }) => Promise<void>;
  };
};

const patientRoomContext = () => {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
  if (!match?.[1]) return null;
  const token = new URLSearchParams(window.location.search).get("token") || "";
  return token ? { roomId: decodeURIComponent(match[1]), roomToken: token } : null;
};

const staffSessionRestoreAllowed = () => {
  if (typeof window === "undefined") return false;
  return !/^\/chat\/[^/]+/.test(window.location.pathname) && !/^\/patient\/[^/]+/.test(window.location.pathname);
};

const notificationUrlFromData = (value: unknown) => {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const raw = typeof data.url === "string"
    ? data.url
    : typeof data.link === "string"
      ? data.link
      : typeof data.deepLink === "string"
        ? data.deepLink
        : "";
  const candidate = raw.trim();
  if (!candidate) return "/inbox";
  try {
    if (candidate.startsWith("/")) return candidate.startsWith("//") ? "/inbox" : candidate;
    const url = new URL(candidate);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {}
  return "/inbox";
};

const openNotificationTarget = (value: unknown) => {
  if (typeof window === "undefined") return;
  const target = notificationUrlFromData(value);
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === target) return;
  window.location.assign(target);
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
        const [{ Capacitor }, { App }, { SplashScreen }, { PushNotifications }, { LocalNotifications }, { Preferences }, screenOrientation, secureStorage, biometricAuth] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/app"),
          import("@capacitor/splash-screen"),
          import("@capacitor/push-notifications"),
          import("@capacitor/local-notifications"),
          import("@capacitor/preferences"),
          import("@capacitor/screen-orientation").catch(() => ({})),
          import("@aparajita/capacitor-secure-storage").catch(() => ({})),
          import("@aparajita/capacitor-biometric-auth").catch(() => ({})),
        ]);
        if (cancelled || !Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform();
        await SplashScreen.hide().catch(() => {});
        await Preferences.set({ key: "drf_last_native_launch", value: new Date().toISOString() }).catch(() => {});

        const ScreenOrientation = (screenOrientation as ScreenOrientationModule).ScreenOrientation;
        if (platform === "android" && ScreenOrientation?.lock) {
          const lockOrientation = ScreenOrientation.lock.bind(ScreenOrientation);
          await lockOrientation({ orientation: "portrait-primary" }).catch(async () => {
            await lockOrientation({ orientation: "portrait" }).catch(() => {});
          });
        }

        const SecureStorage = (secureStorage as any).SecureStorage;
        const KeychainAccess = (secureStorage as any).KeychainAccess;
        const BiometricAuth = (biometricAuth as any).BiometricAuth;
        const AndroidBiometryStrength = (biometricAuth as any).AndroidBiometryStrength;

        const persistStaffSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
          if (!SecureStorage?.set || !session?.access_token || !session.refresh_token) return;
          await SecureStorage.set(STAFF_SESSION_STORAGE_KEY, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user_id: session.user?.id || "",
            email: session.user?.email || "",
            saved_at: new Date().toISOString(),
          }, true, false, KeychainAccess?.afterFirstUnlockThisDeviceOnly).catch(() => {});
        };

        const removeStoredStaffSession = async () => {
          if (!SecureStorage?.remove) return;
          await SecureStorage.remove(STAFF_SESSION_STORAGE_KEY, false).catch(() => {});
        };

        if (SecureStorage?.set) {
          await SecureStorage.setKeyPrefix?.("drf_portal_").catch(() => {});
          await SecureStorage.setDefaultKeychainAccess?.(KeychainAccess?.afterFirstUnlockThisDeviceOnly).catch(() => {});
          await SecureStorage.set("native_shell", "enabled", true, false, KeychainAccess?.afterFirstUnlockThisDeviceOnly).catch(() => {});
        }

        if (BiometricAuth?.checkBiometry) {
          await BiometricAuth.checkBiometry().catch(() => {});
        }

        const restoreStaffSessionWithBiometry = async () => {
          if (!staffSessionRestoreAllowed() || !SecureStorage?.get || !BiometricAuth?.authenticate) return false;
          const current = await supabase.auth.getSession().catch(() => null);
          if (current?.data?.session) {
            await persistStaffSession(current.data.session);
            return true;
          }

          const stored = await SecureStorage.get(STAFF_SESSION_STORAGE_KEY, true, false).catch(() => null);
          const storedSession = stored && typeof stored === "object" ? stored as Record<string, unknown> : null;
          const accessToken = typeof storedSession?.access_token === "string" ? storedSession.access_token : "";
          const refreshToken = typeof storedSession?.refresh_token === "string" ? storedSession.refresh_token : "";
          if (!accessToken || !refreshToken) return false;

          const biometry = await BiometricAuth.checkBiometry?.().catch(() => null);
          if (!biometry?.isAvailable && !biometry?.deviceIsSecure) return false;

          await BiometricAuth.authenticate({
            reason: "Unlock Dr. Fonseca Portal",
            cancelTitle: "Cancel",
            allowDeviceCredential: true,
            iosFallbackTitle: "Use passcode",
            androidTitle: "Dr. Fonseca Portal",
            androidSubtitle: "Unlock the medical portal",
            androidConfirmationRequired: false,
            androidBiometryStrength: AndroidBiometryStrength?.weak,
          });

          const restored = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).catch(() => null);
          if (!restored?.data?.session) {
            await removeStoredStaffSession();
            return false;
          }
          await persistStaffSession(restored.data.session);
          if (window.location.pathname === "/" || window.location.pathname === "/login") {
            window.location.replace("/inbox");
          }
          return true;
        };

        const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_OUT") {
            void removeStoredStaffSession();
            return;
          }
          if (session?.access_token && session.refresh_token) {
            void persistStaffSession(session);
          }
        });
        listeners.push({ remove: () => authSubscription.data.subscription.unsubscribe() });

        await restoreStaffSessionWithBiometry().catch(() => false);

        if (platform === "android") {
          const deviceAlertChannels = [
            {
              id: LEGACY_DEVICE_ALERT_CHANNEL_ID,
              name: "Portal alerts",
              description: "Patient and staff communication alerts using the device notification sound",
              importance: 5,
              visibility: 1,
              vibration: true,
            },
            {
              id: PREVIOUS_DEVICE_ALERT_CHANNEL_ID,
              name: "Urgent portal alerts",
              description: "High-priority patient and staff communication alerts",
              importance: 5,
              visibility: 1,
              vibration: true,
            },
            {
              id: DEVICE_ALERT_CHANNEL_ID,
              name: "Medical urgent alerts",
              description: "Loud urgent alerts for patient and staff medical messages",
              importance: 5,
              visibility: 1,
              vibration: true,
              sound: DEVICE_ALERT_SOUND,
            },
          ];
          for (const deviceAlertChannel of deviceAlertChannels) {
            if ((LocalNotifications as any).createChannel) {
              await (LocalNotifications as any).createChannel(deviceAlertChannel).catch(() => {});
            }
            if ((PushNotifications as any).createChannel) {
              await (PushNotifications as any).createChannel(deviceAlertChannel).catch(() => {});
            }
          }
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
              channelId: DEVICE_ALERT_CHANNEL_ID,
              sound: DEVICE_ALERT_SOUND,
              extra: notification.data || {},
            }],
          }).catch(() => {});
        });
        listeners.push(received);

        const action = await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          openNotificationTarget(event.notification.data);
        });
        listeners.push(action);

        const localAction = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
          openNotificationTarget(event.notification.extra || event.notification);
        });
        listeners.push(localAction);

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
