"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeStaffPhone, phoneAliasEmail } from "@/lib/authIdentity";

type Lang = "es" | "en";
type OfficeLocation = "Guadalajara" | "Tijuana" | "Both" | null;

const COUNTRY_OPTIONS = [
  { code: "+52", es: "México", en: "Mexico" },
  { code: "+1", es: "Estados Unidos / Canadá", en: "United States / Canada" },
  { code: "+34", es: "España", en: "Spain" },
  { code: "+54", es: "Argentina", en: "Argentina" },
  { code: "+55", es: "Brasil", en: "Brazil" },
  { code: "+56", es: "Chile", en: "Chile" },
  { code: "+57", es: "Colombia", en: "Colombia" },
  { code: "+51", es: "Perú", en: "Peru" },
  { code: "+58", es: "Venezuela", en: "Venezuela" },
  { code: "+593", es: "Ecuador", en: "Ecuador" },
  { code: "+591", es: "Bolivia", en: "Bolivia" },
  { code: "+595", es: "Paraguay", en: "Paraguay" },
  { code: "+598", es: "Uruguay", en: "Uruguay" },
  { code: "+502", es: "Guatemala", en: "Guatemala" },
  { code: "+503", es: "El Salvador", en: "El Salvador" },
  { code: "+504", es: "Honduras", en: "Honduras" },
  { code: "+505", es: "Nicaragua", en: "Nicaragua" },
  { code: "+506", es: "Costa Rica", en: "Costa Rica" },
  { code: "+507", es: "Panamá", en: "Panama" },
  { code: "+53", es: "Cuba", en: "Cuba" },
  { code: "+1-809", es: "República Dominicana", en: "Dominican Republic" },
  { code: "+1-787", es: "Puerto Rico", en: "Puerto Rico" },
  { code: "+44", es: "Reino Unido", en: "United Kingdom" },
  { code: "+33", es: "Francia", en: "France" },
  { code: "+49", es: "Alemania", en: "Germany" },
  { code: "+39", es: "Italia", en: "Italy" },
  { code: "+351", es: "Portugal", en: "Portugal" },
  { code: "+31", es: "Países Bajos", en: "Netherlands" },
  { code: "+32", es: "Bélgica", en: "Belgium" },
  { code: "+41", es: "Suiza", en: "Switzerland" },
  { code: "+43", es: "Austria", en: "Austria" },
  { code: "+46", es: "Suecia", en: "Sweden" },
  { code: "+47", es: "Noruega", en: "Norway" },
  { code: "+45", es: "Dinamarca", en: "Denmark" },
  { code: "+358", es: "Finlandia", en: "Finland" },
  { code: "+353", es: "Irlanda", en: "Ireland" },
  { code: "+30", es: "Grecia", en: "Greece" },
  { code: "+48", es: "Polonia", en: "Poland" },
  { code: "+420", es: "República Checa", en: "Czech Republic" },
  { code: "+40", es: "Rumania", en: "Romania" },
  { code: "+90", es: "Turquía", en: "Turkey" },
  { code: "+380", es: "Ucrania", en: "Ukraine" },
  { code: "+7", es: "Rusia / Kazajistán", en: "Russia / Kazakhstan" },
  { code: "+86", es: "China", en: "China" },
  { code: "+81", es: "Japón", en: "Japan" },
  { code: "+82", es: "Corea del Sur", en: "South Korea" },
  { code: "+91", es: "India", en: "India" },
  { code: "+92", es: "Pakistán", en: "Pakistan" },
  { code: "+880", es: "Bangladesh", en: "Bangladesh" },
  { code: "+63", es: "Filipinas", en: "Philippines" },
  { code: "+62", es: "Indonesia", en: "Indonesia" },
  { code: "+60", es: "Malasia", en: "Malaysia" },
  { code: "+65", es: "Singapur", en: "Singapore" },
  { code: "+66", es: "Tailandia", en: "Thailand" },
  { code: "+84", es: "Vietnam", en: "Vietnam" },
  { code: "+61", es: "Australia", en: "Australia" },
  { code: "+64", es: "Nueva Zelanda", en: "New Zealand" },
  { code: "+971", es: "Emiratos Árabes Unidos", en: "United Arab Emirates" },
  { code: "+966", es: "Arabia Saudita", en: "Saudi Arabia" },
  { code: "+972", es: "Israel", en: "Israel" },
  { code: "+20", es: "Egipto", en: "Egypt" },
  { code: "+27", es: "Sudáfrica", en: "South Africa" },
  { code: "+234", es: "Nigeria", en: "Nigeria" },
  { code: "+254", es: "Kenia", en: "Kenya" },
  { code: "+212", es: "Marruecos", en: "Morocco" },
  { code: "+216", es: "Túnez", en: "Tunisia" },
];

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
    step2Text: "Solo nombre, celular y contraseña.",
    step3: "Entra al portal",
    step3Text: "Verás las salas de pacientes que te asignen.",
    detailsTitle: "Crear acceso del personal",
    detailsSubtitle: "Completa estos 3 pasos para entrar al portal.",
    formTitle: "Tu cuenta",
    formHelp: "Usa el nombre y celular que usas para comunicarte con el consultorio.",
    nameLabel: "1. Nombre o nombre preferido",
    namePlaceholder: "Ej: Ray",
    countryLabel: "País",
    phoneLabel: "2. Celular",
    numberLabel: "Número",
    phonePlaceholder: "Ej: 664 123 4567",
    phoneHint: "Selecciona el país y escribe tu número.",
    passwordTitle: "3. Contraseña",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Mínimo 6 caracteres",
    confirmLabel: "Confirmar contraseña",
    confirmPlaceholder: "Repite tu contraseña",
    show: "Ver",
    hide: "Ocultar",
    submit: "Crear cuenta y entrar",
    submitting: "Creando cuenta...",
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
      password: "La contraseña debe tener al menos 6 caracteres.",
      confirm: "Las contraseñas no coinciden.",
      prepare: "No pude preparar el acceso. Revisa el celular.",
      blockedPhone: "Este teléfono ya no tiene acceso. Contacta al administrador.",
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
    step2Text: "Only name, phone, and password.",
    step3: "Enter the portal",
    step3Text: "You will see the patient rooms assigned to you.",
    detailsTitle: "Create staff access",
    detailsSubtitle: "Complete these 3 steps to enter the portal.",
    formTitle: "Your account",
    formHelp: "Use the name and phone number you use with the office.",
    nameLabel: "1. Name or preferred name",
    namePlaceholder: "Example: Ray",
    countryLabel: "Country",
    phoneLabel: "2. Mobile phone",
    numberLabel: "Number",
    phonePlaceholder: "Example: 664 123 4567",
    phoneHint: "Select the country and enter your number.",
    passwordTitle: "3. Password",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    show: "Show",
    hide: "Hide",
    submit: "Create account and enter",
    submitting: "Creating account...",
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
      password: "Password must be at least 6 characters.",
      confirm: "Passwords do not match.",
      prepare: "I could not prepare access. Check the phone number.",
      blockedPhone: "This phone number no longer has access. Contact the administrator.",
      save: "I could not save the profile.",
    },
  },
} as const;

const getBrowserLang = (): Lang => {
  if (typeof window === "undefined") return "es";
  const params = new URLSearchParams(window.location.search);
  const requestedLang = params.get("lang");
  if (requestedLang === "en" || requestedLang === "es") return requestedLang;

  const savedLang = window.localStorage.getItem("portal_register_lang");
  if (savedLang === "en" || savedLang === "es") return savedLang;
  return "es";
};

export default function RegisterPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState<"code" | "details">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [hasInviteLink, setHasInviteLink] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+52");
  const [phoneInput, setPhoneInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedInitialCode, setCheckedInitialCode] = useState(false);
  const detailsPageRef = useRef<HTMLDivElement | null>(null);

  const t = COPY[lang];

  const setLanguage = (next: Lang) => {
    setLang(next);
    if (typeof window !== "undefined") window.localStorage.setItem("portal_register_lang", next);
  };

  const legalHref = (path: string) => `${path}?lang=${lang}`;

  const applyPhoneInput = (value: string) => {
    setPhoneInput(value.replace(/[^\d+\s().-]/g, "").slice(0, 24));
  };

  const checkCode = async () => {
    if (!inviteCode.trim()) {
      setError(t.errors.inviteRequired);
      return;
    }

    setLoading(true);
    setError("");

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
      if (officeFromLink === "gdl") setOfficeLocation("Guadalajara");
      if (officeFromLink === "tjn") setOfficeLocation("Tijuana");

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

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError(t.errors.name);
      return;
    }

    if (!phoneInput.trim()) {
      setError(t.errors.phone);
      return;
    }

    const normalizedPhone = normalizeStaffPhone(phoneInput, phoneCountryCode);
    if (normalizedPhone.replace(/\D/g, "").length < 10) {
      setError(t.errors.phoneShort);
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

    const effectiveEmail = phoneAliasEmail(normalizedPhone);
    if (!effectiveEmail) {
      setError(t.errors.prepare);
      setLoading(false);
      return;
    }

    const { data: blockedPhoneSetting } = await supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle();
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    if (blockedPhones.has(normalizedPhone)) {
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
          role: "staff",
          office_location: persistedOfficeLocation,
          phone: normalizedPhone,
          login_method: "phone",
          real_email: null,
        },
      },
    };

    const { data: authData, error: authErr } = await supabase.auth.signUp(signUpPayload as any);

    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const bootstrapRes = await fetch("/api/staff/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          userId: authData.user.id,
          fullName: fullName.trim(),
          role: "staff",
          officeLocation: persistedOfficeLocation,
          phone: normalizedPhone,
          email: null,
          adminLevel: "none",
        }),
      });

      const payload = await bootstrapRes.json().catch(() => ({}));
      if (!bootstrapRes.ok) {
        setError(payload?.error || t.errors.save);
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
        .phone-row { display: grid; grid-template-columns: minmax(136px, 0.72fr) minmax(0, 1fr); gap: 10px; align-items: end; }
        .code-input { text-align: center; color: #123A5E; font-size: 20px; font-weight: 850; }
        .input:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .input::placeholder { color: #9AAFC3; font-weight: 600; }
        .hint { margin: 8px 0 0; color: #64748B; font-size: 12px; line-height: 1.4; font-weight: 650; }
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
          .phone-row { grid-template-columns: 1fr; gap: 12px; }
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
                {error && <div className="error">Error: {error}</div>}
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
                <p className="login-link">{t.already} <a href={`/login?lang=${lang}`}>{t.login}</a></p>
              </section>
            </div>
          ) : (
            <section className="panel simple-card" aria-label={t.formTitle}>
              <h2 className="panel-title">{t.formTitle}</h2>
              <p className="panel-copy">{t.formHelp}</p>
              {error && <div className="error">Error: {error}</div>}

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
                          {lang === "es" ? country.es : country.en} {country.code}
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
                  <button className="show-btn" onClick={() => setShowPassword((value) => !value)} type="button">
                    {showPassword ? t.hide : t.show}
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
                  <button className="show-btn" onClick={() => setShowConfirm((value) => !value)} type="button">
                    {showConfirm ? t.hide : t.show}
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
