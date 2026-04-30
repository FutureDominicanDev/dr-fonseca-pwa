"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lang = "es" | "en";

const COPY = {
  es: {
    toggle: "English",
    validatingTitle: "Validando enlace",
    validatingCopy: "Espera un momento mientras confirmamos tu enlace de recuperación.",
    invalidLink: "Enlace inválido o expirado. Solicita uno nuevo.",
    expiredLink: "El enlace de recuperación no es válido o expiró.",
    title: "Nueva contraseña",
    subtitle: "Crea una contraseña nueva para volver a entrar al portal.",
    panelTitle: "Actualizar acceso",
    panelCopy: "Usa una contraseña personal que no compartas con nadie.",
    password: "Nueva contraseña",
    passwordPlaceholder: "Mínimo 8 caracteres",
    confirm: "Confirmar contraseña",
    confirmPlaceholder: "Repite tu contraseña",
    show: "Ver",
    hide: "Ocultar",
    submit: "Actualizar contraseña",
    submitting: "Guardando...",
    back: "Volver al login",
    doneTitle: "Contraseña actualizada",
    doneCopy: "Tu contraseña se actualizó correctamente. Ya puedes entrar al portal.",
    login: "Ir al login",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    privacy: "Privacidad",
    support: "Soporte",
    deletion: "Eliminar cuenta",
    sideTitle: "Acceso seguro para el equipo.",
    sideCopy: "Esta pantalla solo se usa después de abrir un enlace válido de recuperación.",
    step1: "Abre el enlace",
    step1Text: "El correo de recuperación crea una sesión temporal.",
    step2: "Crea contraseña",
    step2Text: "Confirma una contraseña nueva y privada.",
    step3: "Vuelve al portal",
    step3Text: "Entra de nuevo para ver tus salas asignadas.",
    errors: {
      short: "La contraseña debe tener al menos 8 caracteres.",
      match: "Las contraseñas no coinciden.",
      required: "Completa ambos campos.",
      failed: "No se pudo actualizar la contraseña. Solicita un nuevo enlace.",
    },
  },
  en: {
    toggle: "Español",
    validatingTitle: "Validating link",
    validatingCopy: "Please wait while we confirm your recovery link.",
    invalidLink: "Invalid or expired link. Request a new one.",
    expiredLink: "The recovery link is invalid or expired.",
    title: "New password",
    subtitle: "Create a new password to enter the portal again.",
    panelTitle: "Update access",
    panelCopy: "Use a personal password that you do not share with anyone.",
    password: "New password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    show: "Show",
    hide: "Hide",
    submit: "Update password",
    submitting: "Saving...",
    back: "Back to login",
    doneTitle: "Password updated",
    doneCopy: "Your password was updated successfully. You can now enter the portal.",
    login: "Go to login",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    privacy: "Privacy",
    support: "Support",
    deletion: "Delete account",
    sideTitle: "Secure access for the team.",
    sideCopy: "This screen is only used after opening a valid recovery link.",
    step1: "Open the link",
    step1Text: "The recovery email creates a temporary session.",
    step2: "Create password",
    step2Text: "Confirm a new private password.",
    step3: "Return to portal",
    step3Text: "Sign in again to see your assigned rooms.",
    errors: {
      short: "Password must be at least 8 characters.",
      match: "Passwords do not match.",
      required: "Complete both fields.",
      failed: "Password could not be updated. Request a new link.",
    },
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

export default function ResetPasswordPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const t = COPY[lang];

  const setLanguage = (next: Lang) => {
    setLang(next);
    setError("");
    if (typeof window !== "undefined") window.localStorage.setItem("portal_auth_lang", next);
  };

  const passwordError = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return t.errors.short;
    if (confirmPassword && password !== confirmPassword) return t.errors.match;
    return "";
  }, [password, confirmPassword, t]);

  useEffect(() => {
    const browserLang = getBrowserLang();
    if (browserLang !== "es") window.setTimeout(() => setLang(browserLang), 0);

    const applyRecoverySession = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "recovery") {
        setError(COPY[browserLang].invalidLink);
        setValidating(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        setError(COPY[browserLang].expiredLink);
        setValidating(false);
        return;
      }

      window.history.replaceState({}, document.title, `/reset-password?lang=${browserLang}`);
      setReady(true);
      setValidating(false);
    };

    applyRecoverySession();
  }, []);

  const submit = async () => {
    if (!ready) return;
    if (!password || !confirmPassword) {
      setError(t.errors.required);
      return;
    }
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(t.errors.failed);
      return;
    }

    setDone(true);
  };

  return (
    <>
      <style>{`
        .reset-page {
          min-height: 100dvh;
          height: 100dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          background: linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%);
          color: #10243b;
          padding: calc(env(safe-area-inset-top) + 20px) 16px calc(env(safe-area-inset-bottom) + 28px);
        }
        .reset-shell { width: 100%; max-width: 960px; margin: 0 auto; }
        .top-actions { display: flex; justify-content: flex-end; min-height: 38px; }
        .lang-toggle {
          border: 1px solid #DCE8F3;
          background: rgba(255,255,255,0.86);
          color: #165D9C;
          border-radius: 999px;
          padding: 8px 13px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
          box-shadow: 0 8px 22px rgba(28, 66, 104, 0.08);
        }
        .brand { text-align: center; margin: 2px 0 24px; }
        .logo { width: min(300px, 74vw); height: auto; object-fit: contain; margin-bottom: 16px; }
        .title { margin: 0; color: #0E2D4A; font-size: clamp(34px, 7vw, 52px); line-height: 1.06; font-weight: 850; letter-spacing: 0; }
        .subtitle { margin: 12px auto 0; max-width: 680px; color: #52677d; font-size: 18px; line-height: 1.48; font-weight: 650; }
        .layout { display: grid; grid-template-columns: minmax(0, 1fr) 410px; gap: 18px; align-items: stretch; }
        .panel {
          background: #FFFFFF;
          border: 1px solid rgba(92,132,170,0.18);
          border-radius: 22px;
          box-shadow: 0 22px 64px rgba(28, 66, 104, 0.14);
          padding: 26px;
        }
        .visual-panel {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.96), rgba(232,242,250,0.92)),
            linear-gradient(120deg, rgba(37,103,162,0.12), rgba(255,255,255,0));
        }
        .panel-title { margin: 0 0 8px; color: #10243b; font-size: 25px; line-height: 1.16; font-weight: 850; letter-spacing: 0; }
        .panel-copy { margin: 0 0 22px; color: #64748B; font-size: 15px; line-height: 1.5; font-weight: 650; }
        .field { margin-bottom: 16px; }
        .field-label { display: block; color: #25384d; font-size: 13px; font-weight: 850; margin-bottom: 8px; }
        .input {
          width: 100%;
          min-height: 54px;
          padding: 0 15px;
          background: #F7FAFD;
          border: 1px solid #DCE8F3;
          border-radius: 14px;
          font-size: 16px;
          font-family: inherit;
          color: #10243b;
          outline: none;
          font-weight: 680;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .input:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .input::placeholder { color: #9AAFC3; font-weight: 600; }
        .password-wrap { position: relative; }
        .password-input { padding-right: 82px; }
        .show-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          height: 36px;
          border: none;
          border-radius: 10px;
          background: #E8F2FA;
          color: #165D9C;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          padding: 0 12px;
          font-family: inherit;
        }
        .primary-btn {
          width: 100%;
          min-height: 54px;
          background: linear-gradient(90deg, #2B78B7, #165D9C);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 850;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 10px 24px rgba(31, 103, 164, 0.24);
        }
        .primary-btn:disabled { opacity: 0.52; cursor: not-allowed; box-shadow: none; }
        .secondary-btn {
          width: 100%;
          min-height: 44px;
          margin-top: 8px;
          border: none;
          background: transparent;
          color: #52677d;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 850;
        }
        .error {
          background: #FFF1F2;
          border: 1px solid #FFCDD2;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 750;
          color: #B42318;
        }
        .steps { display: grid; gap: 16px; margin-top: 20px; }
        .step-row { display: grid; grid-template-columns: 40px 1fr; gap: 13px; align-items: start; }
        .step-num {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #D9ECFA;
          color: #1B6CA8;
          display: grid;
          place-items: center;
          font-weight: 850;
          font-size: 17px;
          box-shadow: inset 0 0 0 1px rgba(27,108,168,0.18);
        }
        .step-row strong { display: block; color: #18344f; font-size: 16px; line-height: 1.24; margin-bottom: 4px; }
        .step-row span { color: #60758a; font-size: 14px; line-height: 1.45; font-weight: 630; }
        .footer-copy { color: #5D7288; margin-top: 22px; text-align: center; font-size: 13px; font-weight: 650; }
        .legal-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 14px; margin-top: 12px; font-size: 12px; font-weight: 800; }
        .legal-links a { color: #426987; text-decoration: none; }
        @media (max-width: 820px) {
          .reset-page { padding: calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 26px); }
          .layout { grid-template-columns: 1fr; gap: 16px; }
          .reset-panel { order: 1; }
          .visual-panel { order: 2; }
          .panel { padding: 22px; }
          .title { font-size: clamp(32px, 9vw, 42px); }
          .subtitle { font-size: 16px; }
        }
      `}</style>

      <main className="reset-page">
        <div className="reset-shell">
          <div className="top-actions">
            <button className="lang-toggle" type="button" onClick={() => setLanguage(lang === "es" ? "en" : "es")}>
              {t.toggle}
            </button>
          </div>

          <header className="brand">
            <img className="logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
            <h1 className="title">{validating ? t.validatingTitle : done ? t.doneTitle : t.title}</h1>
            <p className="subtitle">{validating ? t.validatingCopy : done ? t.doneCopy : t.subtitle}</p>
          </header>

          <div className="layout">
            <section className="panel visual-panel" aria-label={t.sideTitle}>
              <h2 className="panel-title">{t.sideTitle}</h2>
              <p className="panel-copy">{t.sideCopy}</p>
              <div className="steps">
                <div className="step-row">
                  <div className="step-num">1</div>
                  <div><strong>{t.step1}</strong><span>{t.step1Text}</span></div>
                </div>
                <div className="step-row">
                  <div className="step-num">2</div>
                  <div><strong>{t.step2}</strong><span>{t.step2Text}</span></div>
                </div>
                <div className="step-row">
                  <div className="step-num">3</div>
                  <div><strong>{t.step3}</strong><span>{t.step3Text}</span></div>
                </div>
              </div>
            </section>

            <section className="panel reset-panel" aria-label={t.panelTitle}>
              {validating ? (
                <>
                  <h2 className="panel-title">{t.validatingTitle}</h2>
                  <p className="panel-copy">{t.validatingCopy}</p>
                </>
              ) : done ? (
                <>
                  <h2 className="panel-title">{t.doneTitle}</h2>
                  <p className="panel-copy">{t.doneCopy}</p>
                  <button className="primary-btn" onClick={() => { window.location.href = withLang("/login", lang); }}>
                    {t.login}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="panel-title">{t.panelTitle}</h2>
                  <p className="panel-copy">{t.panelCopy}</p>
                  {error && <div className="error">Error: {error}</div>}

                  <div className="field">
                    <label className="field-label">{t.password}</label>
                    <div className="password-wrap">
                      <input
                        className="input password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder={t.passwordPlaceholder}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                      <button className="show-btn" onClick={() => setShowPassword((value) => !value)} type="button">
                        {showPassword ? t.hide : t.show}
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">{t.confirm}</label>
                    <div className="password-wrap">
                      <input
                        className="input password-input"
                        type={showConfirm ? "text" : "password"}
                        placeholder={t.confirmPlaceholder}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                        autoComplete="new-password"
                      />
                      <button className="show-btn" onClick={() => setShowConfirm((value) => !value)} type="button">
                        {showConfirm ? t.hide : t.show}
                      </button>
                    </div>
                  </div>

                  <button className="primary-btn" onClick={submit} disabled={loading || !ready}>
                    {loading ? t.submitting : t.submit}
                  </button>
                  <button className="secondary-btn" onClick={() => { window.location.href = withLang("/login", lang); }}>
                    {t.back}
                  </button>
                </>
              )}
            </section>
          </div>

          <p className="footer-copy">{t.footer}</p>
          <div className="legal-links" aria-label="Legal links and support">
            <a href={withLang("/privacy", lang)}>{t.privacy}</a>
            <a href={withLang("/support", lang)}>{t.support}</a>
            <a href={withLang("/account-deletion", lang)}>{t.deletion}</a>
          </div>
        </div>
      </main>
    </>
  );
}
