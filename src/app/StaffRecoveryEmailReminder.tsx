"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const NOTICE_VERSION = "20260622-recovery-email-v1";
const STAFF_ALIAS_DOMAIN = "@portal-staff.local";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isAliasEmail = (value?: string | null) => `${value || ""}`.trim().toLowerCase().endsWith(STAFF_ALIAS_DOMAIN);
const isStaffPath = (pathname: string) =>
  pathname === "/" ||
  pathname.startsWith("/admin") ||
  pathname.startsWith("/inbox") ||
  pathname.startsWith("/patients") ||
  pathname.startsWith("/procedures") ||
  pathname.startsWith("/create-room");

type ReminderProfile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function StaffRecoveryEmailReminder() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ReminderProfile | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lang, setLang] = useState<"es" | "en">("es");

  const realProfileEmail = `${profile?.email || ""}`.trim().toLowerCase();
  const realAuthEmail = `${authEmail || ""}`.trim().toLowerCase();
  const savedRecoveryEmail = validEmail(realProfileEmail) && !isAliasEmail(realProfileEmail)
    ? realProfileEmail
    : validEmail(realAuthEmail) && !isAliasEmail(realAuthEmail)
      ? realAuthEmail
      : "";
  const missingRecoveryEmail = !savedRecoveryEmail;
  const storageKey = profile?.id ? `drf_recovery_email_notice_${NOTICE_VERSION}_${profile.id}` : "";
  const sessionSnoozeKey = profile?.id ? `${storageKey}_snooze` : "";

  const copy = useMemo(() => {
    if (lang === "en") {
      return {
        title: missingRecoveryEmail ? "Add a recovery email" : "Recovery email check",
        body: missingRecoveryEmail
          ? "Add a real email to your profile so you can reset your password without waiting for an administrator."
          : "Your account has a recovery email saved. Keep it current so password resets work when you need them.",
        input: "Recovery email",
        placeholder: "name@email.com",
        save: saving ? "Saving..." : "Save email",
        later: "Remind me later",
        done: "Got it",
        openSettings: "You can also update this any time from My account.",
        invalid: "Enter a valid email address.",
        saved: "Recovery email saved.",
        failed: "I could not save the recovery email.",
      };
    }
    return {
      title: missingRecoveryEmail ? "Agrega un correo de recuperación" : "Revisa tu correo de recuperación",
      body: missingRecoveryEmail
        ? "Agrega un correo real a tu perfil para poder restablecer tu contraseña sin esperar a un administrador."
        : "Tu cuenta ya tiene un correo de recuperación guardado. Mantenlo actualizado para que el reset funcione cuando lo necesites.",
      input: "Correo de recuperación",
      placeholder: "nombre@correo.com",
      save: saving ? "Guardando..." : "Guardar correo",
      later: "Recordarme después",
      done: "Entendido",
      openSettings: "También puedes actualizarlo después desde Mi cuenta.",
      invalid: "Escribe un correo válido.",
      saved: "Correo de recuperación guardado.",
      failed: "No pude guardar el correo de recuperación.",
    };
  }, [lang, missingRecoveryEmail, saving]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (typeof window === "undefined" || !isStaffPath(window.location.pathname)) return;
      const storedLang = window.localStorage.getItem("portal_auth_lang") || window.localStorage.getItem("drf_staff_ui_lang");
      if (storedLang === "en" || storedLang === "es") setLang(storedLang);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (cancelled || !user?.id) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, email, role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data?.id || `${data.role || ""}`.toLowerCase() === "pending_staff") return;

      setProfile(data as ReminderProfile);
      setAuthEmail(`${user.email || ""}`);
      const initialProfileEmail = `${(data as ReminderProfile).email || ""}`.trim().toLowerCase();
      const initialAuthEmail = `${user.email || ""}`.trim().toLowerCase();
      const initialRecoveryEmail = validEmail(initialProfileEmail) && !isAliasEmail(initialProfileEmail)
        ? initialProfileEmail
        : validEmail(initialAuthEmail) && !isAliasEmail(initialAuthEmail)
          ? initialAuthEmail
          : "";
      setEmailDraft(initialRecoveryEmail);

      const key = `drf_recovery_email_notice_${NOTICE_VERSION}_${data.id}`;
      const snoozeKey = `${key}_snooze`;
      const hasRealEmail = Boolean(initialRecoveryEmail);
      const seen = window.localStorage.getItem(key) === "1";
      const snoozed = window.sessionStorage.getItem(snoozeKey) === "1";
      setReady(true);
      if ((!hasRealEmail && !snoozed) || (hasRealEmail && !seen)) {
        setVisible(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeForNow = () => {
    if (!storageKey) return;
    if (missingRecoveryEmail) {
      if (sessionSnoozeKey) window.sessionStorage.setItem(sessionSnoozeKey, "1");
    } else {
      window.localStorage.setItem(storageKey, "1");
    }
    setVisible(false);
  };

  const saveEmail = async () => {
    const cleanEmail = emailDraft.trim().toLowerCase();
    if (!validEmail(cleanEmail)) {
      setFeedback(copy.invalid);
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      if (!token) throw new Error("Missing session.");
      const response = await fetch("/api/staff/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || copy.failed);
      setProfile((current) => current ? { ...current, email: cleanEmail } : current);
      if (storageKey) window.localStorage.setItem(storageKey, "1");
      if (sessionSnoozeKey) window.sessionStorage.removeItem(sessionSnoozeKey);
      setFeedback(copy.saved);
      window.setTimeout(() => setVisible(false), 800);
    } catch (error: any) {
      setFeedback(error?.message || copy.failed);
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !visible || !profile) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "rgba(15,23,42,0.48)",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          borderRadius: 18,
          background: "#FFFFFF",
          border: "1px solid #DDE7F3",
          boxShadow: "0 24px 70px rgba(15,23,42,0.28)",
          padding: 20,
          color: "#0F172A",
          fontFamily: "inherit",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, lineHeight: 1.18 }}>{copy.title}</p>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 16, fontWeight: 650, lineHeight: 1.45 }}>{copy.body}</p>
        {missingRecoveryEmail ? (
          <>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 850, color: "#1E293B" }}>
              {copy.input}
            </label>
            <input
              value={emailDraft}
              onChange={(event) => {
                setEmailDraft(event.target.value);
                if (feedback) setFeedback("");
              }}
              inputMode="email"
              autoComplete="email"
              placeholder={copy.placeholder}
              style={{
                width: "100%",
                height: 48,
                border: "1px solid #CBD5E1",
                borderRadius: 12,
                outline: "none",
                padding: "0 12px",
                fontSize: 16,
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={saveEmail}
                disabled={saving}
                style={{
                  flex: "1 1 180px",
                  minHeight: 46,
                  border: "none",
                  borderRadius: 12,
                  background: "#0B63CE",
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: 900,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {copy.save}
              </button>
              <button
                type="button"
                onClick={closeForNow}
                style={{
                  flex: "1 1 140px",
                  minHeight: 46,
                  border: "1px solid #CBD5E1",
                  borderRadius: 12,
                  background: "#F8FAFC",
                  color: "#334155",
                  fontSize: 16,
                  fontWeight: 850,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {copy.later}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={closeForNow}
            style={{
              width: "100%",
              minHeight: 46,
              border: "none",
              borderRadius: 12,
              background: "#0B63CE",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 900,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {copy.done}
          </button>
        )}
        <p style={{ margin: "12px 0 0", color: feedback ? (feedback === copy.saved ? "#166534" : "#B91C1C") : "#64748B", fontSize: 13, fontWeight: 750, lineHeight: 1.4 }}>
          {feedback || copy.openSettings}
        </p>
      </div>
    </div>
  );
}
