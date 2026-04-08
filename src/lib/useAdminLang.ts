"use client";

import { useEffect, useState } from "react";

export type AdminLang = "es" | "en";

const ADMIN_LANG_KEY = "admin_portal_lang";

export function useAdminLang() {
  const [lang, setLangState] = useState<AdminLang>("es");
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_LANG_KEY) : null;
    if (saved === "es" || saved === "en") setLangState(saved);
    setLangReady(true);
  }, []);

  const setLang = (nextLang: AdminLang) => {
    setLangState(nextLang);
    if (typeof window !== "undefined") window.localStorage.setItem(ADMIN_LANG_KEY, nextLang);
  };

  return {
    lang,
    setLang,
    langReady,
    isSpanish: lang === "es",
  };
}
