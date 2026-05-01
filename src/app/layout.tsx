import type { Metadata } from "next";
import NativeKeyboardTuning from "./NativeKeyboardTuning";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dr. Fonseca | Portal Médico",
  description: "Siluety Plastic Surgery - Plataforma de atención al paciente",
  metadataBase: new URL("https://portal.drfonsecacirujanoplastico.com"),
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
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
        <meta name="theme-color" content="#1C1C1E" />
        <link rel="icon" href="/icon.png" sizes="any" />
        <link rel="shortcut icon" href="/icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          html { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
          body { height: 100%; margin: 0; padding: 0; font-family: inherit; }
          .shell, .patient-shell { position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; height: 100%; min-height: -webkit-fill-available; }
          input, textarea, select { font-size: 16px !important; user-select: text !important; -webkit-user-select: text !important; touch-action: auto !important; font-family: inherit; }
          ::-webkit-scrollbar { display: none; }
          scrollbar-width: none;
        `}</style>
      </head>
      <body>
        <NativeKeyboardTuning />
        {children}
      </body>
    </html>
  );
}
