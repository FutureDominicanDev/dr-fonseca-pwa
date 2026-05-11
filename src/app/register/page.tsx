"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeStaffPhone, phoneAliasEmail } from "@/lib/authIdentity";
import { COUNTRY_OPTIONS, compactCountryDialLabel } from "@/lib/countryDialing";

type Lang = "es" | "en";
type OfficeLocation = "Guadalajara" | "Tijuana" | "Both" | null;
type RegisterMethod = "phone" | "email";

const parsePhones = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.replace(/[^\d+]/g, "").trim())
    .filter(Boolean);
};

const COPY = {
  es: {
    toggle: "English",
    loading: "Verificando acceso...",
    codeTitle: "Registro del Personal Médico",
    codeSubtitle: "Acceso privado para el equipo autorizado de Siluety Plastic Surgery.",
    inviteHeading: "Código de invitación",
    inviteCopy: "Ingresa el código del consultorio para empezar.",
    inviteLabel: "Código de invitación",
    invitePlaceholder: "FONSECA-XXXXXX",
    verify: "Verificar código",
    verifying: "Verificando...",
    already: "¿Ya tienes cuenta?",
    login: "Inicia sesión",
    processTitle: "Tan fácil como 1, 2, 3.",
    step1: "Abre tu enlace",
    step1Text: "El consultorio te comparte una invitación segura.",
    step2: "Crea tu acceso",
    step2Text: "Nombre, celular o correo, consultorio y contraseña.",
    step3: "Entra al portal",
    step3Text: "Verás las salas de pacientes que te asignen.",
    detailsTitle: "Crear acceso del personal",
    detailsSubtitle: "Completa estos 3 pasos para entrar al portal.",
    formTitle: "Tu cuenta",
    formHelp: "Usa tu nombre y elige si entrarás con celular o correo.",
    nameLabel: "1. Nombre o nombre preferido",
    namePlaceholder: "Ej: Ray",
    signupWith: "Registrarme con",
    signupPhone: "Celular",
    signupEmail: "Correo",
    countryLabel: "País",
    phoneLabel: "2. Celular",
    numberLabel: "Número",
    phonePlaceholder: "Ej: 664 123 4567",
    phoneHint: "Selecciona el país y escribe tu número.",
    emailLabel: "2. Correo electrónico",
    emailPlaceholder: "correo@ejemplo.com",
    emailHint: "Este correo servirá para entrar y recibir enlaces de recuperación.",
    officeLabel: "3. Consultorio",
    officeGdl: "Guadalajara",
    officeTjn: "Tijuana",
    officeBoth: "Ambos consultorios",
    officeHint: "Esta sede se usa para mostrarte automáticamente al crear salas de pacientes de ese consultorio.",
    passwordTitle: "3. Contraseña",
    passwordLabel: "4. Contraseña",
    passwordPlaceholder: "Mínimo 6 caracteres",
    confirmLabel: "Confirmar contraseña",
    confirmPlaceholder: "Repite tu contraseña",
    show: "Ver",
    hide: "Ocultar",
    submit: "Crear cuenta y entrar",
    submitting: "Creando cuenta...",
    existingLogin: "Ir a iniciar sesión",
    existingReset: "Necesito ayuda",
    back: "Usar otro código",
    afterTitle: "Después del registro",
    afterText: "El doctor o el equipo administrativo asigna los pacientes. Al entrar al portal, verás únicamente tus salas asignadas.",
    privacy: "Privacidad",
    support: "Soporte",
    deletion: "Eliminar cuenta",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    errors: {
      inviteRequired: "Por favor ingresa el código de invitación.",
      verify: "Error verificando el código.",
      wrongCode: "Código de invitación incorrecto.",
      expired: "Este enlace ya no es válido. Pide un enlace nuevo.",
      name: "Por favor ingresa tu nombre o nombre preferido.",
      phone: "Ingresa tu número de celular.",
      phoneShort: "Revisa el celular. Debe tener al menos 10 dígitos.",
      email: "Ingresa un correo electrónico válido.",
      office: "Selecciona tu consultorio para que el equipo pueda asignarte a pacientes.",
      password: "La contraseña debe tener al menos 6 caracteres.",
      confirm: "Las contraseñas no coinciden.",
      prepare: "No pude preparar el acceso. Revisa el celular.",
      blockedPhone: "Este teléfono ya no tiene acceso. Contacta al administrador.",
      alreadyRegistered: "Esta cuenta ya está registrada. Si la contraseña es correcta, te entraré al portal automáticamente. Si no, inicia sesión o restablece tu acceso.",
      save: "No pude guardar el perfil.",
    },
  },
  en: {
    toggle: "Español",
    loading: "Verifying access...",
    codeTitle: "Medical Staff Registration",
    codeSubtitle: "Private access for the authorized Siluety Plastic Surgery team.",
    inviteHeading: "Invitation code",
    inviteCopy: "Enter the office code to begin.",
    inviteLabel: "Invitation code",
    invitePlaceholder: "FONSECA-XXXXXX",
    verify: "Verify code",
    verifying: "Verifying...",
    already: "Already have an account?",
    login: "Sign in",
    processTitle: "As easy as 1, 2, 3.",
    step1: "Open your link",
    step1Text: "The office sends you a secure invitation.",
    step2: "Create access",
    step2Text: "Name, phone or email, office, and password.",
    step3: "Enter the portal",
    step3Text: "You will see the patient rooms assigned to you.",
    detailsTitle: "Create staff access",
    detailsSubtitle: "Complete these 3 steps to enter the portal.",
    formTitle: "Your account",
    formHelp: "Use your name and choose whether you will sign in with phone or email.",
    nameLabel: "1. Name or preferred name",
    namePlaceholder: "Example: Ray",
    signupWith: "Register with",
    signupPhone: "Phone",
    signupEmail: "Email",
    countryLabel: "Country",
    phoneLabel: "2. Mobile phone",
    numberLabel: "Number",
    phonePlaceholder: "Example: 664 123 4567",
    phoneHint: "Select the country and enter your number.",
    emailLabel: "2. Email address",
    emailPlaceholder: "email@example.com",
    emailHint: "This email will be used for sign-in and password recovery links.",
    officeLabel: "3. Office",
    officeGdl: "Guadalajara",
    officeTjn: "Tijuana",
    officeBoth: "Both offices",
    officeHint: "This office is used to show you automatically when patient rooms are created for that location.",
    passwordTitle: "3. Password",
    passwordLabel: "4. Password",
    passwordPlaceholder: "At least 6 characters",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    show: "Show",
    hide: "Hide",
    submit: "Create account and enter",
    submitting: "Creating account...",
    existingLogin: "Go to sign in",
    existingReset: "I need help",
    back: "Use another code",
    afterTitle: "After registration",
    afterText: "The doctor or admin team assigns patients. When you enter the portal, you will only see your assigned rooms.",
    privacy: "Privacy",
    support: "Support",
    deletion: "Delete account",
    footer: "© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery",
    errors: {
      inviteRequired: "Please enter the invitation code.",
      verify: "Error verifying the code.",
      wrongCode: "Incorrect invitation code.",
      expired: "This link is no longer valid. Request a new link.",
      name: "Please enter your name or preferred name.",
      phone: "Enter your mobile phone number.",
      phoneShort: "Check the phone number. It must have at least 10 digits.",
      email: "Enter a valid email address.",
      office: "Select your office so the team can assign you to patients.",
      password: "Password must be at least 6 characters.",
      confirm: "Passwords do not match.",
      prepare: "I could not prepare access. Check the phone number.",
      blockedPhone: "This phone number no longer has access. Contact the administrator.",
      alreadyRegistered: "This account is already registered. If the password is correct, I will take you into the portal automatically. If not, sign in or reset access.",
      save: "I could not save the profile.",
    },
  },
} as const;

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isAlreadyRegisteredAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("user already");
};

const getBrowserLang = (): Lang => {
  if (typeof window === "undefined") return "es";
  const params = new URLSearchParams(window.location.search);
  const requestedLang = params.get("lang");
  if (requestedLang === "en" || requestedLang === "es") return requestedLang;

  const savedLang = window.localStorage.getItem("portal_register_lang");
  if (savedLang === "en" || savedLang === "es") return savedLang;
  return "es";
};

function PasswordVisibilityIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
      <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a16.2 16.2 0 0 1-3.1 3.9" />
      <path d="M6.1 6.6C3.5 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9" />
    </svg>
  );
}

export default function RegisterPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState<"code" | "details">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [hasInviteLink, setHasInviteLink] = useState(false);
  const [fullName, setFullName] = useState("");
  const [registerMethod, setRegisterMethod] = useState<RegisterMethod>("phone");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+52");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [existingAccountHint, setExistingAccountHint] = useState(false);
  const [checkedInitialCode, setCheckedInitialCode] = useState(false);
  const detailsPageRef = useRef<HTMLDivElement | null>(null);

  const t = COPY[lang];

  const setLanguage = (next: Lang) => {
    setLang(next);
    if (typeof window !== "undefined") window.localStorage.setItem("portal_register_lang", next);
  };

  const legalHref = (path: string) => `${path}?lang=${lang}`;
  const loginHref = `/login?lang=${lang}`;

  const applyPhoneInput = (value: string) => {
    setPhoneInput(value.replace(/[^\d+\s().-]/g, "").slice(0, 24));
    setExistingAccountHint(false);
  };

  const applyEmailInput = (value: string) => {
    setEmailInput(value.trim().toLowerCase().slice(0, 120));
    setExistingAccountHint(false);
  };

  const checkCode = async () => {
    if (!inviteCode.trim()) {
      setError(t.errors.inviteRequired);
      return;
    }

    setLoading(true);
    setError("");
    setExistingAccountHint(false);

    const { data, error: err } = await supabase.from("app_settings").select("value").eq("key", "invite_code").single();

    if (err || !data) {
      setError(t.errors.verify);
      setLoading(false);
      return;
    }

    if (data.value.trim().toUpperCase() !== inviteCode.trim().toUpperCase()) {
      setError(t.errors.wrongCode);
      setLoading(false);
      return;
    }

    setLoading(false);
    setHasInviteLink(false);
    setStep("details");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const requestedLang = params.get("lang");
    const browserLang = getBrowserLang();
    if (requestedLang === "en" || requestedLang === "es") {
      window.localStorage.setItem("portal_register_lang", requestedLang);
    }
    if (browserLang !== "es") window.setTimeout(() => setLang(browserLang), 0);

    const verifyInviteFlow = async () => {
      const codeFromLink = (params.get("code") || "").trim().toUpperCase();
      const officeFromLink = (params.get("office") || "").trim().toLowerCase();

      if (officeFromLink === "both") setOfficeLocation("Both");
      if (officeFromLink === "gdl" || officeFromLink === "guadalajara") setOfficeLocation("Guadalajara");
      if (officeFromLink === "tjn" || officeFromLink === "tijuana") setOfficeLocation("Tijuana");

      if (!codeFromLink) {
        setInviteCode("");
        setHasInviteLink(false);
        setStep("code");
        setLoading(false);
        setCheckedInitialCode(true);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: err } = await supabase.from("app_settings").select("value").eq("key", "invite_code").single();
      const currentCode = (data?.value || "").trim().toUpperCase();

      if (err || !currentCode) {
        setError(COPY[browserLang].errors.verify);
        setHasInviteLink(false);
        setLoading(false);
        setCheckedInitialCode(true);
        return;
      }

      if (currentCode !== codeFromLink) {
        setError(COPY[browserLang].errors.expired);
        setInviteCode("");
        setHasInviteLink(false);
        setStep("code");
        setLoading(false);
        setCheckedInitialCode(true);
        return;
      }

      setInviteCode(codeFromLink);
      setHasInviteLink(true);
      setStep("details");
      setLoading(false);
      setCheckedInitialCode(true);
    };

    verifyInviteFlow();
  }, []);

  useEffect(() => {
    if (!error) return;
    if (step === "details") detailsPageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [error, step]);

  const saveStaffProfile = async (userId: string, normalizedPhone: string, realEmail: string | null, persistedOfficeLocation: "Guadalajara" | "Tijuana" | null, accessToken?: string | null) => {
    const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token || "";
    const bootstrapRes = await fetch("/api/staff/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        inviteCode: inviteCode.trim().toUpperCase(),
        userId,
        fullName: fullName.trim(),
        role: "pending_staff",
        officeLocation: persistedOfficeLocation,
        phone: normalizedPhone,
        email: realEmail,
        adminLevel: "none",
      }),
    });

    const payload = await bootstrapRes.json().catch(() => ({}));
    return {
      ok: bootstrapRes.ok,
      error: payload?.error || t.errors.save,
    };
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError(t.errors.name);
      return;
    }

    const normalizedPhone = registerMethod === "phone" ? normalizeStaffPhone(phoneInput, phoneCountryCode) : "";
    const normalizedEmail = registerMethod === "email" ? emailInput.trim().toLowerCase() : "";

    if (registerMethod === "phone") {
      if (!phoneInput.trim()) {
        setError(t.errors.phone);
        return;
      }

      if (normalizedPhone.replace(/\D/g, "").length < 10) {
        setError(t.errors.phoneShort);
        return;
      }
    } else if (!validEmail(normalizedEmail)) {
      setError(t.errors.email);
      return;
    }

    if (!officeLocation) {
      setError(t.errors.office);
      return;
    }

    if (password.length < 6) {
      setError(t.errors.password);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.errors.confirm);
      return;
    }

    setLoading(true);
    setError("");
    setExistingAccountHint(false);

    const effectiveEmail = registerMethod === "email" ? normalizedEmail : phoneAliasEmail(normalizedPhone);
    if (!effectiveEmail) {
      setError(t.errors.prepare);
      setLoading(false);
      return;
    }

    const [{ data: blockedPhoneSetting }, { data: blockedEmailSetting }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
    ]);
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    const blockedEmails = new Set(`${blockedEmailSetting?.value || ""}`.split(/[,\n;]/g).map((entry) => entry.trim().toLowerCase()).filter(Boolean));
    if (normalizedPhone && blockedPhones.has(normalizedPhone)) {
      setError(t.errors.blockedPhone);
      setLoading(false);
      return;
    }
    if (normalizedEmail && blockedEmails.has(normalizedEmail)) {
      setError(t.errors.blockedPhone);
      setLoading(false);
      return;
    }

    const persistedOfficeLocation = officeLocation === "Both" ? null : officeLocation;
    const signUpPayload = {
      email: effectiveEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "pending_staff",
          office_location: persistedOfficeLocation,
          phone: normalizedPhone || null,
          login_method: registerMethod,
          real_email: normalizedEmail || null,
        },
      },
    };

    const { data: authData, error: authErr } = await supabase.auth.signUp(signUpPayload as any);

    if (authErr) {
      if (isAlreadyRegisteredAuthError(authErr.message)) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: effectiveEmail,
          password,
        });

        if (!signInErr) {
          if (signInData.user) {
            const profileSave = await saveStaffProfile(signInData.user.id, normalizedPhone, normalizedEmail || null, persistedOfficeLocation, signInData.session?.access_token);
            if (!profileSave.ok) {
              setError(profileSave.error);
              setLoading(false);
              return;
            }
          }
          setLoading(false);
          window.location.href = "/inbox";
          return;
        }

        setExistingAccountHint(true);
        setError(t.errors.alreadyRegistered);
        setLoading(false);
        return;
      }

      setError(authErr.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const profileSave = await saveStaffProfile(authData.user.id, normalizedPhone, normalizedEmail || null, persistedOfficeLocation, authData.session?.access_token);
      if (!profileSave.ok) {
        setError(profileSave.error);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    window.location.href = "/inbox";
  };

  if (!checkedInitialCode && loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5F8FC", color: "#123A5E", fontWeight: 800 }}>
        {t.loading}
      </div>
    );
  }

  return (
    <>
      <style>{`
        .register-page {
          min-height: 100dvh;
          height: 100dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          background: linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%);
          color: #10243b;
          padding: calc(env(safe-area-inset-top) + 20px) 16px calc(env(safe-area-inset-bottom) + 28px);
        }
        .register-shell { width: 100%; max-width: 960px; margin: 0 auto; }
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
        .title { margin: 0; color: #0E2D4A; font-size: clamp(28px, 7vw, 38px); line-height: 1.1; font-weight: 850; letter-spacing: 0; }
        .subtitle { margin: 10px auto 0; max-width: 600px; color: #52677d; font-size: 16px; line-height: 1.48; font-weight: 650; }
        .layout { display: grid; grid-template-columns: minmax(0, 1fr) 410px; gap: 18px; align-items: start; }
        .panel {
          background: #FFFFFF;
          border: 1px solid rgba(92,132,170,0.18);
          border-radius: 22px;
          box-shadow: 0 22px 64px rgba(28, 66, 104, 0.14);
          padding: 26px;
        }
        .invite-panel { align-self: start; }
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
        .phone-row { display: grid; grid-template-columns: minmax(92px, 112px) minmax(0, 1fr); gap: 10px; align-items: end; }
        .office-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .office-option {
          min-height: 50px;
          border: 1px solid #DCE8F3;
          border-radius: 14px;
          background: #F7FAFD;
          color: #25384d;
          cursor: pointer;
          font-family: inherit;
          font-size: 15px;
          font-weight: 850;
        }
        .office-option.active {
          border-color: #2B78B7;
          background: #EAF4FC;
          color: #165D9C;
          box-shadow: 0 0 0 4px rgba(43,120,183,0.10);
        }
        .office-option.full { grid-column: 1 / -1; }
        .code-input { text-align: center; color: #123A5E; font-size: 20px; font-weight: 850; }
        .input:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .input::placeholder { color: #9AAFC3; font-weight: 600; }
        .login-method { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 5px; border-radius: 16px; background: #EEF5FB; border: 1px solid #DCE8F3; margin-bottom: 14px; }
        .method-btn { min-height: 44px; border: none; border-radius: 12px; background: transparent; color: #426987; font-size: 15px; font-weight: 850; cursor: pointer; font-family: inherit; }
        .method-btn.active { background: #FFFFFF; color: #165D9C; box-shadow: 0 8px 20px rgba(32,86,132,0.12); }
        .hint { margin: 8px 0 0; color: #64748B; font-size: 12px; line-height: 1.4; font-weight: 650; }
        .password-wrap { position: relative; }
        .password-input { padding-right: 58px; }
        .show-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 12px;
          background: #E8F2FA;
          color: #165D9C;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
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
        .existing-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: -6px 0 16px;
        }
        .secondary-action {
          min-height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid #D8E5F1;
          border-radius: 12px;
          background: #F8FBFF;
          color: #165D9C;
          cursor: pointer;
          font-family: inherit;
          font-size: 15px;
          font-weight: 850;
          text-decoration: none;
          text-align: center;
          padding: 0 12px;
        }
        .login-link { margin: 17px 0 0; color: #52677d; text-align: center; font-size: 14px; font-weight: 650; }
        .login-link a { color: #165D9C; font-weight: 850; text-decoration: none; }
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
        .simple-card {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
        }
        .after-panel {
          margin-top: 16px;
          background: #EFF7FE;
          border: 1px solid rgba(92,132,170,0.18);
          border-radius: 18px;
          padding: 18px;
        }
        .after-panel h2 { margin: 0 0 7px; color: #123A5E; font-size: 19px; line-height: 1.2; font-weight: 850; }
        .after-panel p { margin: 0; color: #52677d; font-size: 14px; line-height: 1.5; font-weight: 650; }
        .footer-copy { color: #5D7288; margin-top: 22px; text-align: center; font-size: 13px; font-weight: 650; }
        .legal-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 14px; margin-top: 12px; font-size: 12px; font-weight: 800; }
        .legal-links a { color: #426987; text-decoration: none; }
        @media (max-width: 820px) {
          .register-page { padding: calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 26px); }
          .layout { grid-template-columns: 1fr; gap: 16px; }
          .invite-panel { order: 1; }
          .visual-panel { order: 2; }
          .panel { padding: 22px; }
          .top-actions { min-height: 34px; }
          .brand { margin-top: 0; }
          .phone-row { grid-template-columns: minmax(88px, 108px) minmax(0, 1fr); gap: 8px; }
          .office-grid { grid-template-columns: 1fr; }
          .office-option.full { grid-column: auto; }
          .existing-actions { grid-template-columns: 1fr; }
        }
      `}</style>

      <main className="register-page" ref={detailsPageRef}>
        <div className="register-shell">
          <div className="top-actions">
            <button className="lang-toggle" type="button" onClick={() => setLanguage(lang === "es" ? "en" : "es")}>
              {t.toggle}
            </button>
          </div>

          <header className="brand">
            <img className="logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
            <h1 className="title">{step === "code" ? t.codeTitle : t.detailsTitle}</h1>
            <p className="subtitle">{step === "code" ? t.codeSubtitle : t.detailsSubtitle}</p>
          </header>

          {step === "code" ? (
            <div className="layout">
              <section className="panel visual-panel" aria-label={t.processTitle}>
                <h2 className="panel-title">{t.processTitle}</h2>
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

              <section className="panel invite-panel" aria-label={t.inviteHeading}>
                <h2 className="panel-title">{t.inviteHeading}</h2>
                <p className="panel-copy">{t.inviteCopy}</p>
                {error && <div className="error">{error}</div>}
                <div className="field">
                  <label className="field-label">{t.inviteLabel}</label>
                  <input
                    className="input code-input"
                    placeholder={t.invitePlaceholder}
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => { if (event.key === "Enter") checkCode(); }}
                    autoComplete="one-time-code"
                  />
                </div>
                <button className="primary-btn" onClick={checkCode} disabled={loading}>
                  {loading ? t.verifying : t.verify}
                </button>
                <p className="login-link">{t.already} <a href={loginHref}>{t.login}</a></p>
              </section>
            </div>
          ) : (
            <section className="panel simple-card" aria-label={t.formTitle}>
              <h2 className="panel-title">{t.formTitle}</h2>
              <p className="panel-copy">{t.formHelp}</p>
              {error && <div className="error">{error}</div>}
              {existingAccountHint && (
                <div className="existing-actions" aria-label={t.errors.alreadyRegistered}>
                  <button className="secondary-action" type="button" onClick={() => { window.location.href = loginHref; }}>
                    {t.existingLogin}
                  </button>
                  <a className="secondary-action" href={legalHref("/support")}>
                    {t.existingReset}
                  </a>
                </div>
              )}

              <div className="field">
                <label className="field-label">{t.nameLabel}</label>
                <input
                  className="input"
                  placeholder={t.namePlaceholder}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="field">
                <label className="field-label">{t.signupWith}</label>
                <div className="login-method" role="radiogroup" aria-label={t.signupWith}>
                  <button type="button" className={`method-btn${registerMethod === "phone" ? " active" : ""}`} onClick={() => { setRegisterMethod("phone"); setError(""); setExistingAccountHint(false); }}>
                    {t.signupPhone}
                  </button>
                  <button type="button" className={`method-btn${registerMethod === "email" ? " active" : ""}`} onClick={() => { setRegisterMethod("email"); setError(""); setExistingAccountHint(false); }}>
                    {t.signupEmail}
                  </button>
                </div>
                {registerMethod === "phone" ? (
                  <>
                    <label className="field-label">{t.phoneLabel}</label>
                    <div className="phone-row">
                      <div>
                        <label className="field-label" htmlFor="phone-country">{t.countryLabel}</label>
                        <select
                          id="phone-country"
                          className="input select"
                          value={phoneCountryCode}
                          onChange={(event) => setPhoneCountryCode(event.target.value)}
                        >
                          {COUNTRY_OPTIONS.map((country) => (
                            <option key={`${country.code}-${country.en}`} value={country.code}>
                              {compactCountryDialLabel(country.code)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="phone-local">{t.numberLabel}</label>
                        <input
                          id="phone-local"
                          className="input"
                          inputMode="tel"
                          placeholder={t.phonePlaceholder}
                          value={phoneInput}
                          onChange={(event) => applyPhoneInput(event.target.value)}
                          autoComplete="tel"
                        />
                      </div>
                    </div>
                    <p className="hint">{t.phoneHint}</p>
                  </>
                ) : (
                  <>
                    <label className="field-label" htmlFor="staff-email">{t.emailLabel}</label>
                    <input
                      id="staff-email"
                      className="input"
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={emailInput}
                      onChange={(event) => applyEmailInput(event.target.value)}
                      autoComplete="email"
                    />
                    <p className="hint">{t.emailHint}</p>
                  </>
                )}
              </div>

              <div className="field">
                <label className="field-label">{t.officeLabel}</label>
                <div className="office-grid">
                  {([
                    { value: "Guadalajara" as const, label: t.officeGdl },
                    { value: "Tijuana" as const, label: t.officeTjn },
                    { value: "Both" as const, label: t.officeBoth, wide: true },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`office-option${officeLocation === option.value ? " active" : ""}${option.wide ? " full" : ""}`}
                      onClick={() => setOfficeLocation(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="hint">{t.officeHint}</p>
              </div>

              <div className="field">
                <label className="field-label">{t.passwordLabel}</label>
                <div className="password-wrap">
                  <input
                    className="input password-input"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <button className="show-btn" onClick={() => setShowPassword((value) => !value)} type="button" aria-label={showPassword ? t.hide : t.show} title={showPassword ? t.hide : t.show}>
                    <PasswordVisibilityIcon hidden={!showPassword} />
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="field-label">{t.confirmLabel}</label>
                <div className="password-wrap">
                  <input
                    className="input password-input"
                    type={showConfirm ? "text" : "password"}
                    placeholder={t.confirmPlaceholder}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") handleRegister(); }}
                    autoComplete="new-password"
                  />
                  <button className="show-btn" onClick={() => setShowConfirm((value) => !value)} type="button" aria-label={showConfirm ? t.hide : t.show} title={showConfirm ? t.hide : t.show}>
                    <PasswordVisibilityIcon hidden={!showConfirm} />
                  </button>
                </div>
              </div>

              <button className="primary-btn" onClick={handleRegister} disabled={loading}>
                {loading ? t.submitting : t.submit}
              </button>
              {!hasInviteLink && (
                <button className="secondary-btn" onClick={() => { setInviteCode(""); setStep("code"); setError(""); }}>
                  {t.back}
                </button>
              )}

              <div className="after-panel">
                <h2>{t.afterTitle}</h2>
                <p>{t.afterText}</p>
              </div>
            </section>
          )}

          <p className="footer-copy">{t.footer}</p>
          <div className="legal-links" aria-label="Legal links and support">
            <a href={legalHref("/privacy")}>{t.privacy}</a>
            <a href={legalHref("/support")}>{t.support}</a>
            <a href={legalHref("/account-deletion")}>{t.deletion}</a>
          </div>
        </div>
      </main>
    </>
  );
}
