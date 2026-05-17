import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.drfonsecacirujanoplastico.portal",
  appName: "Dr. Fonseca Portal",
  webDir: "public",
  server: {
    url: "https://portal.drfonsecacirujanoplastico.com",
    cleartext: false,
  },
  ios: {
    scheme: "DrFonsecaPortal",
  },
  android: {
    buildOptions: {
      releaseType: "AAB",
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#07334D",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_drf",
      iconColor: "#0B63CE",
      sound: "critical_repeat.wav",
    },
  },
};

export default config;
