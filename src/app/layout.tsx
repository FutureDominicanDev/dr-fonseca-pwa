import type { Metadata } from "next";
import AppUpdateWatcher from "./AppUpdateWatcher";
import NativeKeyboardTuning from "./NativeKeyboardTuning";
import "./globals.css";

const BRAND_BROWSER_COLOR = "#0B63CE";
const FAVICON_VERSION = "20260511";
const APP_BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  "local-development";

export const metadata: Metadata = {
  title: "Dr. Fonseca | Portal Médico",
  description: "Siluety Plastic Surgery - Plataforma de atención al paciente",
  metadataBase: new URL("https://portal.drfonsecacirujanoplastico.com"),
  icons: {
    icon: [
      { url: `/favicon.ico?v=${FAVICON_VERSION}`, sizes: "any" },
      { url: `/favicon-32.png?v=${FAVICON_VERSION}`, type: "image/png", sizes: "32x32" },
      { url: `/favicon-48.png?v=${FAVICON_VERSION}`, type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: `/favicon.ico?v=${FAVICON_VERSION}`,
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Dr. Fonseca | Portal Médico",
    description: "Siluety Plastic Surgery - Plataforma de atención al paciente",
    url: "https://portal.drfonsecacirujanoplastico.com",
    siteName: "Dr. Fonseca | Portal Médico",
    type: "website",
    locale: "es_MX",
    images: [
      {
        url: "/fonseca_white.png",
        width: 1200,
        height: 630,
        alt: "Dr. Miguel Fonseca - Siluety Plastic Surgery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dr. Fonseca | Portal Médico",
    description: "Siluety Plastic Surgery - Plataforma de atención al paciente",
    images: ["/fonseca_white.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ height: "100%" }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Dr. Fonseca" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={BRAND_BROWSER_COLOR} />
        <meta name="msapplication-TileColor" content={BRAND_BROWSER_COLOR} />
        <meta name="msapplication-navbutton-color" content={BRAND_BROWSER_COLOR} />
        <meta name="app-version" content={APP_BUILD_VERSION} />
        <link rel="icon" href={`/favicon.ico?v=${FAVICON_VERSION}`} sizes="any" />
        <link rel="shortcut icon" href={`/favicon.ico?v=${FAVICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="16x16" href={`/favicon-16.png?v=${FAVICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`/favicon-32.png?v=${FAVICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="48x48" href={`/favicon-48.png?v=${FAVICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="manifest" href={`/manifest.json?v=${APP_BUILD_VERSION}`} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          html { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
          body { height: 100%; margin: 0; padding: 0; font-family: inherit; font-size: 16px; line-height: 1.55; overflow-x: hidden; }
          .shell, .patient-shell { position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; height: 100%; min-height: -webkit-fill-available; max-width: 100vw; }
          input, textarea, select { font-size: 16px !important; user-select: text !important; -webkit-user-select: text !important; touch-action: auto !important; font-family: inherit; }
          button, input, textarea, select, [role="button"] { min-height: 44px; }
          ::-webkit-scrollbar { display: none; }
          scrollbar-width: none;
        `}</style>
      </head>
      <body>
        <NativeKeyboardTuning />
        <AppUpdateWatcher buildVersion={APP_BUILD_VERSION} />
        {children}
      </body>
    </html>
  );
}
