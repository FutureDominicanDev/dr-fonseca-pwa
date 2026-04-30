"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Lang = "es" | "en";

type LegalSection = {
  title: string;
  body: string[];
};

export type LegalCopy = {
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
};

type LegalAction = {
  href: string;
  label: string;
};

type LegalPageProps = {
  content: Record<Lang, LegalCopy>;
  action?: Record<Lang, LegalAction>;
};

const portalUrl = "https://portal.drfonsecacirujanoplastico.com";

const chrome = {
  es: {
    toggle: "English",
    back: "Volver al portal",
    brand: "Dr. Fonseca | Portal Medico",
    updated: "Ultima actualizacion",
    privacy: "Privacidad",
    support: "Soporte",
    deletion: "Eliminar cuenta",
    portal: "Portal",
  },
  en: {
    toggle: "Español",
    back: "Back to portal",
    brand: "Dr. Fonseca | Medical Portal",
    updated: "Last updated",
    privacy: "Privacy",
    support: "Support",
    deletion: "Delete account",
    portal: "Portal",
  },
} as const;

const getBrowserLang = (): Lang => {
  if (typeof window === "undefined") return "es";

  const params = new URLSearchParams(window.location.search);
  const requestedLang = params.get("lang");
  if (requestedLang === "en" || requestedLang === "es") return requestedLang;

  const savedLang = window.localStorage.getItem("portal_auth_lang") || window.localStorage.getItem("portal_register_lang");
  if (savedLang === "en" || savedLang === "es") return savedLang;
  return "es";
};

const withLang = (path: string, lang: Lang) => `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

export default function LegalPage({ content, action }: LegalPageProps) {
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    const browserLang = getBrowserLang();
    if (browserLang !== "es") window.setTimeout(() => setLang(browserLang), 0);
    window.localStorage.setItem("portal_auth_lang", browserLang);
  }, []);

  const setLanguage = (next: Lang) => {
    setLang(next);
    window.localStorage.setItem("portal_auth_lang", next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState({}, document.title, url.toString());
  };

  const labels = chrome[lang];
  const page = content[lang];
  const pageAction = action?.[lang];

  return (
    <main
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        background: "linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%)",
        color: "#111827",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        padding: "calc(env(safe-area-inset-top) + 20px) 18px calc(env(safe-area-inset-bottom) + 32px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 38, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setLanguage(lang === "es" ? "en" : "es")}
            style={{
              border: "1px solid #DCE8F3",
              background: "rgba(255,255,255,0.86)",
              color: "#165D9C",
              borderRadius: 999,
              padding: "8px 13px",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 850,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(28, 66, 104, 0.08)",
            }}
          >
            {labels.toggle}
          </button>
        </div>

        <article
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid rgba(92,132,170,0.18)",
            borderRadius: 22,
            boxShadow: "0 22px 64px rgba(28, 66, 104, 0.14)",
            overflow: "hidden",
          }}
        >
          <header style={{ padding: "30px 26px 24px", borderBottom: "1px solid #e5e7eb" }}>
            <Link
              href={withLang("/login", lang)}
              style={{
                color: "#165D9C",
                fontSize: 14,
                fontWeight: 850,
                textDecoration: "none",
                display: "inline-flex",
                marginBottom: 18,
              }}
            >
              {labels.back}
            </Link>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", fontWeight: 850, letterSpacing: 1.2, textTransform: "uppercase" }}>
              {labels.brand}
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(31px, 5vw, 46px)", lineHeight: 1.08, letterSpacing: 0, color: "#0E2D4A", fontWeight: 850 }}>
              {page.title}
            </h1>
            <p style={{ margin: "12px 0 0", fontSize: 18, lineHeight: 1.55, color: "#52677d", fontWeight: 650 }}>
              {page.subtitle}
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b", fontWeight: 750 }}>
              {labels.updated}: {page.updated}
            </p>
          </header>

          <div style={{ padding: "24px 26px 28px" }}>
            {page.sections.map((section) => (
              <section key={section.title} style={{ marginBottom: 22 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: 21, color: "#10243b", letterSpacing: 0, fontWeight: 850 }}>
                  {section.title}
                </h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} style={{ margin: "0 0 10px", fontSize: 16, lineHeight: 1.66, color: "#334155" }}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}

            {pageAction && (
              <a
                href={pageAction.href}
                style={{
                  display: "inline-flex",
                  minHeight: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  background: "linear-gradient(90deg, #2B78B7, #165D9C)",
                  color: "#fff",
                  padding: "0 18px",
                  textDecoration: "none",
                  fontSize: 16,
                  fontWeight: 850,
                  boxShadow: "0 10px 24px rgba(31, 103, 164, 0.24)",
                }}
              >
                {pageAction.label}
              </a>
            )}

            <footer
              style={{
                marginTop: 28,
                paddingTop: 18,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 16px",
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              <Link href={withLang("/privacy", lang)} style={{ color: "#165D9C", textDecoration: "none" }}>
                {labels.privacy}
              </Link>
              <Link href={withLang("/support", lang)} style={{ color: "#165D9C", textDecoration: "none" }}>
                {labels.support}
              </Link>
              <Link href={withLang("/account-deletion", lang)} style={{ color: "#165D9C", textDecoration: "none" }}>
                {labels.deletion}
              </Link>
              <a href={portalUrl} style={{ color: "#165D9C", textDecoration: "none" }}>
                {labels.portal}
              </a>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}
