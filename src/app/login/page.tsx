"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeStaffPhone, phoneAliasEmail } from "@/lib/authIdentity";
import { COUNTRY_OPTIONS } from "@/lib/countryDialing";

type Lang = "es" | "en";
type View = "login" | "forgot" | "sent";
type LoginMethod = "phone" | "email";

const COPY = {
  es: {
    toggle: "English",
    title: "Iniciar sesión",
    subtitle: "Entra al portal médico para ver tus salas asignadas.",
    panelTitle: "Acceso seguro",
    panelCopy: "Usa el celular o correo asociado a tu cuenta.",
    loginWith: "Entrar con",
    loginPhone: "Celular",
    loginEmail: "Correo",
    country: "País",
    identifier: "Celular",
    identifierPlaceholder: "664 123 4567",
    password: "Contraseña",
    passwordPlaceholder: "Tu contraseña",
    show: "Ver",
    hide: "Ocultar",
    forgot: "¿Olvidaste tu contraseña?",
    submit: "Entrar al portal",
    submitting: "Ingresando...",
    firstTime: "¿Primera vez aquí?",
    register: "Crear acceso",
    forgotTitle: "Recuperar contraseña",
    forgotCopy: "Escribe el correo asociado a tu cuenta. Si entras con celular, pide ayuda al administrador.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "correo@ejemplo.com",
    sendReset: "Enviar enlace de recuperación",
    sending: "Enviando...",
    back: "Volver al login",
    sentTitle: "Revisa tu correo",
    sentCopy: "Enviamos un enlace para cambiar tu contraseña.",
    sentHelp: "Si no lo ves, revisa spam o pide ayuda al administrador.",
    privacy: "Privacidad",
    support: "Soporte",
    deletion: "Eliminar cuenta",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    sideTitle: "Comunicación privada del equipo médico.",
    sideCopy: "Desde aquí el staff entra a las salas de pacientes asignadas por el doctor o administración.",
    step1: "Entra con tu cuenta",
    step1Text: "Celular, correo y contraseña personal.",
    step2: "Revisa tus salas",
    step2Text: "Solo verás pacientes asignados a tu equipo.",
    step3: "Responde con claridad",
    step3Text: "Mensajes, archivos y seguimiento en un solo lugar.",
    errors: {
      loginRequired: "Por favor ingresa tu correo o celular y contraseña.",
      invalidEmail: "Por favor ingresa un correo electrónico válido.",
      badLogin: "Correo, celular o contraseña incorrectos.",
      resetRequired: "Por favor ingresa tu correo electrónico.",
      resetFailed: "No pude enviar el correo. Verifica el correo ingresado.",
    },
  },
  en: {
    toggle: "Español",
    title: "Sign in",
    subtitle: "Enter the medical portal to see your assigned rooms.",
    panelTitle: "Secure access",
    panelCopy: "Use the phone or email connected to your account.",
    loginWith: "Sign in with",
    loginPhone: "Phone",
    loginEmail: "Email",
    country: "Country",
    identifier: "Mobile phone",
    identifierPlaceholder: "664 123 4567",
    password: "Password",
    passwordPlaceholder: "Your password",
    show: "Show",
    hide: "Hide",
    forgot: "Forgot your password?",
    submit: "Enter portal",
    submitting: "Signing in...",
    firstTime: "First time here?",
    register: "Create access",
    forgotTitle: "Recover password",
    forgotCopy: "Enter the email connected to your account. If you sign in by phone, ask an administrator for help.",
    emailLabel: "Email address",
    emailPlaceholder: "email@example.com",
    sendReset: "Send recovery link",
    sending: "Sending...",
    back: "Back to login",
    sentTitle: "Check your email",
    sentCopy: "We sent a link to change your password.",
    sentHelp: "If you do not see it, check spam or ask an administrator for help.",
    privacy: "Privacy",
    support: "Support",
    deletion: "Delete account",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    sideTitle: "Private communication for the medical team.",
    sideCopy: "Staff enter here to access patient rooms assigned by the doctor or administration.",
    step1: "Sign in",
    step1Text: "Mobile phone, email, and personal password.",
    step2: "Review your rooms",
    step2Text: "You only see patients assigned to your team.",
    step3: "Respond clearly",
    step3Text: "Messages, files, and follow-up in one place.",
    errors: {
      loginRequired: "Please enter your email or phone and password.",
      invalidEmail: "Please enter a valid email address.",
      badLogin: "Email, phone, or password is incorrect.",
      resetRequired: "Please enter your email address.",
      resetFailed: "I could not send the email. Check the address entered.",
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

export default function LoginPage() {
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.drfonsecacirujanoplastico.com").replace(/\/+$/, "");
  const [lang, setLang] = useState<Lang>("es");
  const [view, setView] = useState<View>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("phone");
  const [identifier, setIdentifier] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+52");
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerLink, setRegisterLink] = useState("/register");

  const t = COPY[lang];
  const registerTarget = withLang(registerLink, lang);

  const setLanguage = (next: Lang) => {
    setLang(next);
    setError("");
    if (typeof window !== "undefined") window.localStorage.setItem("portal_auth_lang", next);
  };

  useEffect(() => {
    const browserLang = getBrowserLang();
    if (browserLang !== "es") window.setTimeout(() => setLang(browserLang), 0);
  }, []);

  useEffect(() => {
    const loadRegisterLink = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle();
      const code = `${data?.value || ""}`.trim().toUpperCase();
      if (code) setRegisterLink(`/register?code=${encodeURIComponent(code)}`);
    };
    loadRegisterLink();
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError(t.errors.loginRequired);
      return;
    }

    if (loginMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setError(t.errors.invalidEmail);
      return;
    }

    setLoading(true);
    setError("");
    const payload = loginMethod === "email"
      ? { email: identifier.trim().toLowerCase(), password }
      : { email: phoneAliasEmail(normalizeStaffPhone(identifier, phoneCountryCode)), password };
    const { error: err } = await supabase.auth.signInWithPassword(payload as any);
    if (err) {
      setError(t.errors.badLogin);
      setLoading(false);
      return;
    }
    window.location.href = "/inbox";
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) {
      setError(t.errors.resetRequired);
      return;
    }

    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${appBaseUrl}/reset-password?lang=${lang}`,
    });
    if (err) {
      setError(t.errors.resetFailed);
      setLoading(false);
      return;
    }
    setLoading(false);
    setView("sent");
  };

  const switchTo = (nextView: View) => {
    setView(nextView);
    setError("");
    setLoading(false);
  };

  return (
    <>
      <style>{`
        .auth-page {
          min-height: 100dvh;
          height: 100dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          background: linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%);
          color: #10243b;
          padding: calc(env(safe-area-inset-top) + 20px) 16px calc(env(safe-area-inset-bottom) + 28px);
        }
        .auth-shell { width: 100%; max-width: 960px; margin: 0 auto; }
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
        .select {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, #426987 50%), linear-gradient(135deg, #426987 50%, transparent 50%);
          background-position: calc(100% - 18px) 50%, calc(100% - 12px) 50%;
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 34px;
        }
        .input:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .input::placeholder { color: #9AAFC3; font-weight: 600; }
        .login-method { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 5px; border-radius: 16px; background: #EEF5FB; border: 1px solid #DCE8F3; margin-bottom: 14px; }
        .method-btn { min-height: 44px; border: none; border-radius: 12px; background: transparent; color: #426987; font-size: 15px; font-weight: 850; cursor: pointer; font-family: inherit; }
        .method-btn.active { background: #FFFFFF; color: #165D9C; box-shadow: 0 8px 20px rgba(32,86,132,0.12); }
        .phone-row { display: grid; grid-template-columns: minmax(136px, 0.72fr) minmax(0, 1fr); gap: 10px; align-items: end; }
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
        .text-link { border: none; background: transparent; padding: 0; color: #165D9C; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 850; }
        .forgot-link { display: block; margin: -4px 0 20px auto; text-align: right; }
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
        .signup-note { margin: 17px 0 0; color: #52677d; text-align: center; font-size: 14px; font-weight: 650; }
        .signup-note button { color: #165D9C; font-weight: 850; }
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
          .auth-page { padding: calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 26px); }
          .layout { grid-template-columns: 1fr; gap: 16px; }
          .auth-panel { order: 1; }
          .visual-panel { display: none; }
          .panel { padding: 22px; }
          .phone-row { grid-template-columns: 1fr; gap: 12px; }
          .title { font-size: clamp(32px, 9vw, 42px); }
          .subtitle { font-size: 16px; }
        }
      `}</style>

      <main className="auth-page">
        <div className="auth-shell">
          <div className="top-actions">
            <button className="lang-toggle" type="button" onClick={() => setLanguage(lang === "es" ? "en" : "es")}>
              {t.toggle}
            </button>
          </div>

          <header className="brand">
            <img className="logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
            <h1 className="title">{view === "login" ? t.title : view === "forgot" ? t.forgotTitle : t.sentTitle}</h1>
            <p className="subtitle">{view === "login" ? t.subtitle : view === "forgot" ? t.forgotCopy : t.sentCopy}</p>
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

            <section className="panel auth-panel" aria-label={view === "login" ? t.panelTitle : t.forgotTitle}>
              {view === "login" && (
                <>
                  <h2 className="panel-title">{t.panelTitle}</h2>
                  <p className="panel-copy">{t.panelCopy}</p>
                  {error && <div className="error">Error: {error}</div>}

                  <div className="field">
                    <label className="field-label">{t.loginWith}</label>
                    <div className="login-method" role="radiogroup" aria-label={t.loginWith}>
                      <button type="button" className={`method-btn${loginMethod==="phone" ? " active" : ""}`} onClick={()=>{setLoginMethod("phone");setIdentifier("");setError("");}}>{t.loginPhone}</button>
                      <button type="button" className={`method-btn${loginMethod==="email" ? " active" : ""}`} onClick={()=>{setLoginMethod("email");setIdentifier("");setError("");}}>{t.loginEmail}</button>
                    </div>
                    {loginMethod === "phone" ? (
                      <div className="phone-row">
                        <div>
                          <label className="field-label" htmlFor="login-country">{t.country}</label>
                          <select
                            id="login-country"
                            className="input select"
                            value={phoneCountryCode}
                            onChange={(event) => setPhoneCountryCode(event.target.value)}
                          >
                            {COUNTRY_OPTIONS.map((country) => (
                              <option key={`${country.code}-${country.en}`} value={country.code}>
                                {lang === "es" ? country.es : country.en} {country.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label" htmlFor="login-id">{t.identifier}</label>
                          <input
                            id="login-id"
                            className="input"
                            type="tel"
                            placeholder={t.identifierPlaceholder}
                            value={identifier}
                            onChange={(event) => setIdentifier(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") handleLogin(); }}
                            autoComplete="tel"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="field-label" htmlFor="login-id">{t.emailLabel}</label>
                        <input
                          id="login-id"
                          className="input"
                          type="email"
                          placeholder={t.emailPlaceholder}
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") handleLogin(); }}
                          autoComplete="email"
                        />
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label">{t.password}</label>
                    <div className="password-wrap">
                      <input
                        className="input password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder={t.passwordPlaceholder}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") handleLogin(); }}
                        autoComplete="current-password"
                      />
                      <button className="show-btn" onClick={() => setShowPassword((value) => !value)} type="button">
                        {showPassword ? t.hide : t.show}
                      </button>
                    </div>
                  </div>

                  <button className="text-link forgot-link" onClick={() => switchTo("forgot")} type="button">
                    {t.forgot}
                  </button>
                  <button className="primary-btn" onClick={handleLogin} disabled={loading}>
                    {loading ? t.submitting : t.submit}
                  </button>
                  <p className="signup-note">
                    {t.firstTime}{" "}
                    <button className="text-link" onClick={() => { window.location.href = registerTarget; }} type="button">
                      {t.register}
                    </button>
                  </p>
                </>
              )}

              {view === "forgot" && (
                <>
                  <h2 className="panel-title">{t.forgotTitle}</h2>
                  <p className="panel-copy">{t.forgotCopy}</p>
                  {error && <div className="error">Error: {error}</div>}
                  <div className="field">
                    <label className="field-label">{t.emailLabel}</label>
                    <input
                      className="input"
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") handleReset(); }}
                      autoComplete="email"
                    />
                  </div>
                  <button className="primary-btn" onClick={handleReset} disabled={loading}>
                    {loading ? t.sending : t.sendReset}
                  </button>
                  <button className="secondary-btn" onClick={() => switchTo("login")} type="button">
                    {t.back}
                  </button>
                </>
              )}

              {view === "sent" && (
                <>
                  <h2 className="panel-title">{t.sentTitle}</h2>
                  <p className="panel-copy">{t.sentCopy}</p>
                  <p className="panel-copy" style={{ marginTop: -10 }}>{resetEmail}</p>
                  <p className="panel-copy">{t.sentHelp}</p>
                  <button className="primary-btn" onClick={() => { setResetEmail(""); switchTo("login"); }} type="button">
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
