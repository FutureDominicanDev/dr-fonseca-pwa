"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const SCROLL_CONTAINERS = [".admin-shell", ".record-shell", ".help-shell", ".shell", ".patient-shell"];

export default function BackToTopButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const selectors = useMemo(() => SCROLL_CONTAINERS.join(","), []);

  useEffect(() => {
    const updateVisibility = () => {
      const hasScrolledWindow = window.scrollY > 280;
      const hasScrolledContainer = SCROLL_CONTAINERS.some((selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? element.scrollTop > 280 : false;
      });
      setVisible(hasScrolledWindow || hasScrolledContainer);
    };

    const containers = Array.from(document.querySelectorAll(selectors)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement
    );

    window.addEventListener("scroll", updateVisibility, { passive: true });
    containers.forEach((element) => element.addEventListener("scroll", updateVisibility, { passive: true }));
    updateVisibility();

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      containers.forEach((element) => element.removeEventListener("scroll", updateVisibility));
    };
  }, [pathname, selectors]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    SCROLL_CONTAINERS.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        element.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Volver arriba"
      onClick={scrollToTop}
      style={{
        position: "fixed",
        right: "max(16px, env(safe-area-inset-right))",
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        zIndex: 500,
        width: 48,
        height: 48,
        borderRadius: 999,
        border: "none",
        background: "rgba(17,24,39,0.92)",
        color: "white",
        boxShadow: "0 12px 28px rgba(15,23,42,0.22)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(12px)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
