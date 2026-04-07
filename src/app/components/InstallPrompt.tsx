"use client";

import { useEffect, useState } from "react";

let deferredPrompt: any = null;

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();

    const ios = /iphone|ipad|ipod/.test(userAgent);
    const standalone = (window.navigator as any).standalone;

    setIsIOS(ios && !standalone);

    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    setShow(false);
  };

  // 👉 iPhone UI
  if (isIOS) {
    return (
      <div style={styles.container}>
        <div style={styles.text}>
          📲 Instala esta app<br />
          Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
        </div>
      </div>
    );
  }

  // 👉 Android / Chrome UI
  if (!show) return null;

  return (
    <div style={styles.container}>
      <span style={styles.text}>
        Instalar Portal / Install Portal
      </span>

      <button onClick={installApp} style={styles.button}>
        Install
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    bottom: 20,
    left: 20,
    right: 20,
    background: "#0D0B2E",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 9999,
    boxShadow: "0 6px 25px rgba(0,0,0,0.4)",
  },
  text: {
    fontSize: 14,
    lineHeight: "18px",
  },
  button: {
    background: "#1565C0",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
};