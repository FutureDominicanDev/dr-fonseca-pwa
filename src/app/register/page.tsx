"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isOwnerEmail } from "@/lib/securityConfig";
import { normalizePhone, phoneAliasEmail } from "@/lib/authIdentity";

const parseEmails = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const parsePhones = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.replace(/[^\d+]/g, "").trim())
    .filter(Boolean);
};

const PHONE_COUNTRY_OPTIONS = [
  { code: "+52", label: "🇲🇽 +52 México" },
  { code: "+1", label: "🇺🇸 +1 USA/Canadá" },
  { code: "+34", label: "🇪🇸 +34 España" },
  { code: "+57", label: "🇨🇴 +57 Colombia" },
  { code: "+51", label: "🇵🇪 +51 Perú" },
  { code: "+54", label: "🇦🇷 +54 Argentina" },
  { code: "+56", label: "🇨🇱 +56 Chile" },
];

export default function RegisterPage() {
  const [step, setStep] = useState<"code" | "details">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"doctor" | "enfermeria" | "coordinacion" | "post_quirofano" | "staff">("staff");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+52");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [officeLocation, setOfficeLocation] = useState<"Guadalajara" | "Tijuana" | "Both">("Guadalajara");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkedInitialCode, setCheckedInitialCode] = useState(false);
  const detailsPageRef = useRef<HTMLDivElement | null>(null);

  const applyPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    setPhoneLocal(digits);
  };

  const checkCode = async () => {
    if (!inviteCode.trim()) {
      setError("Por favor ingresa el código de invitación.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: err } = await supabase.from("app_settings").select("value").eq("key", "invite_code").single();

    if (err || !data) {
      setError("Error verificando el código.");
      setLoading(false);
      return;
    }

    if (data.value.trim().toUpperCase() !== inviteCode.trim().toUpperCase()) {
      setError("Código de invitación incorrecto.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("details");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const verifyInviteFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      const codeFromLink = (params.get("code") || "").trim().toUpperCase();
      const officeFromLink = (params.get("office") || "").trim().toLowerCase();

      if (officeFromLink === "both") setOfficeLocation("Both");
      if (officeFromLink === "gdl") setOfficeLocation("Guadalajara");
      if (officeFromLink === "tjn") setOfficeLocation("Tijuana");

      if (!codeFromLink) {
        setInviteCode("");
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
        setError("Error verificando el código.");
        setLoading(false);
        setCheckedInitialCode(true);
        return;
      }

      if (codeFromLink && currentCode !== codeFromLink) {
        setError("Este enlace ya no es válido. Pide un enlace nuevo.");
        setInviteCode(codeFromLink);
        setStep("code");
        setLoading(false);
        setCheckedInitialCode(true);
        return;
      }

      setInviteCode(codeFromLink);
      setStep("details");
      setLoading(false);
      setCheckedInitialCode(true);
    };

    verifyInviteFlow();
  }, []);

  useEffect(() => {
    if (!error) return;
    if (step === "details") {
      detailsPageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error, step]);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError("Por favor ingresa tu nombre completo.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(`${phoneCountryCode}${phoneLocal}`);
    const hasEmail = normalizedEmail.length > 0;
    const hasPhone = normalizedPhone.length > 0;

    if (!hasEmail && !hasPhone) {
      setError("Ingresa al menos un método de acceso: correo o teléfono.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError("");

    const usingPhone = authMethod === "phone" ? hasPhone : !hasEmail && hasPhone;
    const effectiveEmail = hasEmail ? normalizedEmail : (usingPhone ? phoneAliasEmail(normalizedPhone) : "");

    if (!effectiveEmail) {
      setError("No pude preparar el acceso. Revisa correo/teléfono.");
      setLoading(false);
      return;
    }

    const { data: blockedEmailSetting } = await supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle();
    const { data: blockedPhoneSetting } = await supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle();
    const blockedEmails = new Set(parseEmails(blockedEmailSetting?.value));
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    if (hasEmail && blockedEmails.has(normalizedEmail)) {
      setError("Este correo ya no tiene acceso. Contacta al administrador.");
      setLoading(false);
      return;
    }
    if (hasPhone && blockedPhones.has(normalizedPhone)) {
      setError("Este teléfono ya no tiene acceso. Contacta al administrador.");
      setLoading(false);
      return;
    }

    const assignedRole = isOwnerEmail(normalizedEmail) ? "doctor" : role;
    const persistedOfficeLocation = officeLocation === "Both" ? null : officeLocation;
    const signUpPayload = {
      email: effectiveEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: assignedRole,
          office_location: persistedOfficeLocation,
          phone: normalizedPhone || null,
          login_method: usingPhone ? "phone" : "email",
          real_email: hasEmail ? normalizedEmail : null,
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
          role: assignedRole,
          officeLocation: persistedOfficeLocation,
          phone: normalizedPhone || null,
          email: hasEmail ? normalizedEmail : null,
          adminLevel: isOwnerEmail(normalizedEmail) ? "owner" : "none",
        }),
      });

      const payload = await bootstrapRes.json().catch(() => ({}));
      if (!bootstrapRes.ok) {
        setError(payload?.error || "No pude guardar el perfil.");
        setLoading(false);
        return;
      }
      const welcomeEmail = payload?.welcomeEmail;
      if (hasEmail && welcomeEmail && welcomeEmail.sent === false) {
        setError("Tu cuenta se creó, pero el correo de bienvenida no salió. Avisa al administrador para revisar SMTP.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    window.location.href = "/inbox";
  };

  if (!checkedInitialCode && loading) return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5F8FC", color: "#123A5E", fontWeight: 800 }}>
      Verificando acceso...
    </div>
  );

  if (step === "code") return (
    <>
      <style>{`
        .register-page {
          min-height: 100dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%);
          color: #10243b;
          padding: calc(env(safe-area-inset-top) + 24px) 22px calc(env(safe-area-inset-bottom) + 28px);
        }
        .register-shell { width: 100%; max-width: 1080px; margin: 0 auto; }
        .register-brand { text-align: center; margin-bottom: 24px; }
        .register-logo { width: min(310px, 72vw); height: auto; object-fit: contain; margin-bottom: 16px; }
        .register-title { margin: 0; color: #0E2D4A; font-size: 36px; line-height: 1.12; font-weight: 850; letter-spacing: 0; }
        .register-subtitle { margin: 12px auto 0; max-width: 650px; color: #52677d; font-size: 18px; line-height: 1.48; font-weight: 600; }
        .register-layout { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 22px; align-items: stretch; }
        .register-visual {
          min-height: 500px;
          border: 1px solid rgba(92, 132, 170, 0.18);
          border-radius: 24px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.96), rgba(232,242,250,0.92)),
            linear-gradient(120deg, rgba(37,103,162,0.12), rgba(255,255,255,0));
          box-shadow: 0 22px 64px rgba(28, 66, 104, 0.12);
          padding: 34px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .visual-heading { max-width: 540px; }
        .visual-heading h2 { margin: 0; color: #123A5E; font-size: 28px; line-height: 1.18; font-weight: 830; letter-spacing: 0; }
        .visual-heading p { margin: 12px 0 0; color: #52677d; font-size: 16px; line-height: 1.58; font-weight: 600; }
        .step-list { display: grid; gap: 18px; margin-top: 32px; }
        .step-row { display: grid; grid-template-columns: 42px 1fr; gap: 14px; align-items: start; }
        .step-number { width: 42px; height: 42px; border-radius: 50%; background: #D9ECFA; color: #1B6CA8; display: grid; place-items: center; font-weight: 850; font-size: 18px; box-shadow: inset 0 0 0 1px rgba(27,108,168,0.18); }
        .step-row strong { display: block; color: #18344f; font-size: 17px; line-height: 1.24; margin-bottom: 4px; }
        .step-row span { color: #60758a; font-size: 14px; line-height: 1.45; font-weight: 600; }
        .security-note { border-top: 1px solid rgba(92,132,170,0.18); padding-top: 22px; color: #52677d; font-size: 14px; line-height: 1.5; font-weight: 650; }
        .register-panel {
          background: #FFFFFF;
          border: 1px solid rgba(92,132,170,0.18);
          border-radius: 24px;
          box-shadow: 0 22px 64px rgba(28, 66, 104, 0.16);
          padding: 28px;
          align-self: center;
        }
        .panel-title { margin: 0 0 8px; color: #10243b; font-size: 25px; line-height: 1.15; font-weight: 850; letter-spacing: 0; }
        .panel-copy { margin: 0 0 24px; color: #64748B; font-size: 15px; line-height: 1.5; font-weight: 600; }
        .flabel { display: block; color: #25384d; font-size: 13px; font-weight: 850; margin-bottom: 8px; }
        .err { background: #FFF1F2; border: 1px solid #FFCDD2; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 750; color: #B42318; }
        .code-inp {
          width: 100%;
          height: 58px;
          padding: 0 16px;
          background: #F7FAFD;
          border: 1px solid #DCE8F3;
          border-radius: 14px;
          font-size: 21px;
          font-family: inherit;
          color: #123A5E;
          outline: none;
          margin-bottom: 16px;
          font-weight: 850;
          text-align: center;
          letter-spacing: 0;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .code-inp:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .code-inp::placeholder { color: #9AAFC3; font-size: 16px; font-weight: 650; }
        .primary-btn { width: 100%; min-height: 52px; background: linear-gradient(90deg, #2B78B7, #165D9C); border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 850; cursor: pointer; font-family: inherit; box-shadow: 0 10px 24px rgba(31, 103, 164, 0.24); }
        .primary-btn:disabled { opacity: 0.52; cursor: not-allowed; box-shadow: none; }
        .secondary-link { font-size: 14px; color: #52677d; text-align: center; margin-top: 18px; font-weight: 650; }
        .secondary-link a { color: #165D9C; font-weight: 850; text-decoration: none; }
        .footer-copy { color: #5D7288; margin-top: 22px; text-align: center; font-size: 13px; font-weight: 650; }
        .legal-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 14px; margin-top: 12px; font-size: 12px; font-weight: 800; }
        .legal-links a { color: #426987; text-decoration: none; }
        @media (max-width: 840px) {
          .register-page { padding: calc(env(safe-area-inset-top) + 18px) 14px calc(env(safe-area-inset-bottom) + 24px); }
          .register-title { font-size: 28px; }
          .register-subtitle { font-size: 16px; }
          .register-layout { grid-template-columns: 1fr; gap: 16px; }
          .register-panel { order: 1; }
          .register-visual { order: 2; }
          .register-visual { min-height: auto; padding: 24px; }
          .visual-heading h2 { font-size: 23px; }
          .register-panel { padding: 22px; }
        }
      `}</style>
      <div className="register-page">
        <div className="register-shell">
          <header className="register-brand">
            <img className="register-logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
            <h1 className="register-title">Registro de Personal Médico</h1>
            <p className="register-subtitle">Acceso privado para el equipo autorizado de Siluety Plastic Surgery.</p>
          </header>

          <div className="register-layout">
            <section className="register-visual" aria-label="Proceso de acceso">
              <div>
                <div className="visual-heading">
                  <h2>Ingreso seguro al portal de mensajería médica.</h2>
                  <p>El registro mantiene el acceso restringido al personal validado por el consultorio.</p>
                </div>
                <div className="step-list">
                  <div className="step-row">
                    <div className="step-number">1</div>
                    <div><strong>Confirma tu invitación</strong><span>Usa el código activo generado por administración.</span></div>
                  </div>
                  <div className="step-row">
                    <div className="step-number">2</div>
                    <div><strong>Crea tus credenciales</strong><span>Elige correo, teléfono o ambos como método de acceso.</span></div>
                  </div>
                  <div className="step-row">
                    <div className="step-number">3</div>
                    <div><strong>Entra al portal</strong><span>Una vez registrado, verás las salas de pacientes asignadas.</span></div>
                  </div>
                </div>
              </div>
              <p className="security-note">Solo el personal autorizado por Dr. Fonseca puede crear acceso. Los permisos administrativos se asignan por separado.</p>
            </section>

            <section className="register-panel" aria-label="Verificación de invitación">
              <h2 className="panel-title">Código de invitación</h2>
              <p className="panel-copy">Ingresa el código proporcionado por el consultorio para continuar.</p>
              {error && <div className="err">Error: {error}</div>}
              <label className="flabel">Código de invitación</label>
              <input className="code-inp" placeholder="FONSECA-XXXXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") checkCode(); }} />
              <button className="primary-btn" onClick={checkCode} disabled={loading}>{loading ? "Verificando..." : "Verificar código"}</button>
              <p className="secondary-link">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
            </section>
          </div>

          <p className="footer-copy">© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery</p>
          <div className="legal-links" aria-label="Enlaces legales y soporte">
            <a href="/privacy">Privacidad</a>
            <a href="/support">Soporte</a>
            <a href="/account-deletion">Eliminar cuenta</a>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .details-page {
          position: fixed;
          inset: 0;
          overflow-y: scroll;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, #fbfdff 0%, #eef5fb 100%);
        }
        .details-inner {
          min-height: 100%;
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          padding: calc(env(safe-area-inset-top) + 24px) 22px calc(env(safe-area-inset-bottom) + 32px);
        }
        .details-brand { text-align: center; margin-bottom: 22px; }
        .details-logo { width: min(300px, 70vw); height: auto; object-fit: contain; margin-bottom: 14px; }
        .details-title { margin: 0; color: #0E2D4A; font-size: 34px; line-height: 1.14; font-weight: 850; letter-spacing: 0; }
        .details-subtitle { margin: 10px auto 0; max-width: 640px; color: #52677d; font-size: 17px; line-height: 1.5; font-weight: 600; }
        .register-card {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 0;
          overflow: hidden;
          background: #fff;
          border: 1px solid rgba(92,132,170,0.18);
          border-radius: 24px;
          box-shadow: 0 22px 64px rgba(28, 66, 104, 0.14);
        }
        .side-panel {
          background:
            linear-gradient(180deg, rgba(237,247,255,0.96), rgba(255,255,255,0.96)),
            linear-gradient(135deg, rgba(38, 116, 179, 0.14), rgba(255,255,255,0));
          border-right: 1px solid rgba(92,132,170,0.16);
          padding: 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 620px;
        }
        .side-panel h2 { margin: 0; color: #123A5E; font-size: 25px; line-height: 1.18; font-weight: 850; letter-spacing: 0; }
        .side-panel p { margin: 12px 0 0; color: #52677d; font-size: 15px; line-height: 1.55; font-weight: 630; }
        .progress-list { display: grid; gap: 18px; margin-top: 28px; }
        .progress-item { display: grid; grid-template-columns: 38px 1fr; gap: 12px; align-items: start; }
        .progress-num { width: 38px; height: 38px; border-radius: 50%; background: #D9ECFA; color: #1B6CA8; display: grid; place-items: center; font-weight: 850; font-size: 16px; box-shadow: inset 0 0 0 1px rgba(27,108,168,0.18); }
        .progress-item strong { display: block; color: #18344f; font-size: 16px; line-height: 1.25; }
        .progress-item span { display: block; color: #60758a; font-size: 13px; line-height: 1.42; margin-top: 3px; font-weight: 600; }
        .side-note { border-top: 1px solid rgba(92,132,170,0.18); padding-top: 18px; font-size: 13px; line-height: 1.5; color: #52677d; font-weight: 650; }
        .form-sec2 { padding: 30px; }
        .section-title { color: #10243b; font-size: 20px; line-height: 1.25; font-weight: 850; margin: 0 0 6px; letter-spacing: 0; }
        .section-help { color: #64748B; font-size: 14px; line-height: 1.5; font-weight: 600; margin: 0 0 20px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field-full { grid-column: 1 / -1; }
        .flabel2 { font-size: 13px; font-weight: 820; color: #25384d; margin-bottom: 8px; display: block; }
        .finput,
        .fselect,
        .pinput {
          width: 100%;
          min-height: 50px;
          padding: 0 14px;
          background: #F7FAFD;
          border: 1px solid #DCE8F3;
          border-radius: 13px;
          font-size: 16px;
          font-family: inherit;
          color: #10243b;
          outline: none;
          font-weight: 650;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .finput:focus,
        .fselect:focus,
        .pinput:focus { background: #fff; border-color: #2B78B7; box-shadow: 0 0 0 4px rgba(43,120,183,0.12); }
        .finput::placeholder,
        .pinput::placeholder { color: #9AAFC3; font-weight: 550; }
        .pwrap { position: relative; }
        .pinput { padding-right: 74px; }
        .peye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); height: 34px; border: none; border-radius: 10px; background: #E8F2FA; color: #165D9C; cursor: pointer; font-size: 12px; font-weight: 850; padding: 0 12px; font-family: inherit; }
        .err2 { background: #FFF1F2; border: 1px solid #FFCDD2; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 750; color: #B42318; }
        .choice-group { display: grid; gap: 10px; margin-bottom: 18px; }
        .choice-group.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .choice-group.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .choice-group.roles { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .choice {
          min-height: 50px;
          border-radius: 13px;
          border: 1px solid #DCE8F3;
          background: #F7FAFD;
          color: #25384d;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 820;
          line-height: 1.2;
          padding: 10px;
          text-align: center;
        }
        .choice.sel { border-color: #2B78B7; background: #EAF5FD; color: #165D9C; box-shadow: inset 0 0 0 1px rgba(43,120,183,0.12); }
        .helper-text { font-size: 13px; color: #64748B; margin: -6px 0 18px; line-height: 1.45; font-weight: 600; }
        .divider { height: 1px; background: #E3ECF4; margin: 20px 0; }
        .rbtn2 { width: 100%; min-height: 52px; background: linear-gradient(90deg, #2B78B7, #165D9C); border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 850; cursor: pointer; font-family: inherit; margin-top: 20px; box-shadow: 0 10px 24px rgba(31, 103, 164, 0.24); }
        .rbtn2:disabled { opacity: 0.52; cursor: not-allowed; box-shadow: none; }
        .bbtn { width: 100%; min-height: 46px; background: transparent; border: none; color: #52677d; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .footer-copy { color: #5D7288; margin-top: 22px; text-align: center; font-size: 13px; font-weight: 650; }
        .legal-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 14px; margin-top: 12px; font-size: 12px; font-weight: 800; }
        .legal-links a { color: #426987; text-decoration: none; }
        @media (max-width: 980px) {
          .register-card { grid-template-columns: 1fr; }
          .form-sec2 { order: 1; }
          .side-panel { order: 2; min-height: auto; border-right: none; border-top: 1px solid rgba(92,132,170,0.16); }
          .choice-group.roles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .details-inner { padding: calc(env(safe-area-inset-top) + 18px) 14px calc(env(safe-area-inset-bottom) + 26px); }
          .details-title { font-size: 27px; }
          .details-subtitle { font-size: 15px; }
          .side-panel, .form-sec2 { padding: 22px; }
          .form-grid { grid-template-columns: 1fr; gap: 14px; }
          .choice-group.two, .choice-group.three, .choice-group.roles { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="details-page" ref={detailsPageRef}>
        <div className="details-inner">
          <header className="details-brand">
            <img className="details-logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
            <h1 className="details-title">Crear acceso de personal</h1>
            <p className="details-subtitle">Completa tu perfil para entrar al portal médico privado.</p>
          </header>

          <div className="register-card">
            <aside className="side-panel">
              <div>
                <h2>Personal médico autorizado</h2>
                <p>Este registro prepara tu acceso al sistema de mensajería, salas de pacientes y notificaciones del consultorio.</p>
                <div className="progress-list">
                  <div className="progress-item">
                    <div className="progress-num">1</div>
                    <div><strong>Identidad</strong><span>Nombre y método de acceso seguro.</span></div>
                  </div>
                  <div className="progress-item">
                    <div className="progress-num">2</div>
                    <div><strong>Rol y sede</strong><span>Ayuda a mostrar pacientes del equipo correcto.</span></div>
                  </div>
                  <div className="progress-item">
                    <div className="progress-num">3</div>
                    <div><strong>Contraseña</strong><span>Credenciales personales para el portal.</span></div>
                  </div>
                </div>
              </div>
              <p className="side-note">Los permisos administrativos no se otorgan automáticamente durante el registro.</p>
            </aside>

            <section className="form-sec2" aria-label="Formulario de registro">
              <h2 className="section-title">Información de acceso</h2>
              <p className="section-help">Usa correo, teléfono o ambos. Solo se necesita un método para iniciar sesión.</p>
              {error && <div className="err2">Error: {error}</div>}

              <div className="form-grid">
                <div className="field-full">
                  <label className="flabel2">Nombre completo</label>
                  <input className="finput" placeholder="Dr. Ana García" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>

                <div className="field-full">
                  <label className="flabel2">Método de acceso</label>
                  <div className="choice-group two">
                    <button type="button" className={`choice${authMethod === "email" ? " sel" : ""}`} onClick={() => setAuthMethod("email")}>Correo</button>
                    <button type="button" className={`choice${authMethod === "phone" ? " sel" : ""}`} onClick={() => setAuthMethod("phone")}>Teléfono</button>
                  </div>
                </div>

                <div className="field-full">
                  <label className="flabel2">Función en el equipo</label>
                  <div className="choice-group roles">
                    {[
                      { id: "doctor", label: "Doctor" },
                      { id: "enfermeria", label: "Enfermería" },
                      { id: "coordinacion", label: "Coordinación" },
                      { id: "post_quirofano", label: "Post-Q" },
                      { id: "staff", label: "Oficina" },
                    ].map((roleOption) => (
                      <button
                        type="button"
                        key={roleOption.id}
                        className={`choice${role === roleOption.id ? " sel" : ""}`}
                        onClick={() => setRole(roleOption.id as "doctor" | "enfermeria" | "coordinacion" | "post_quirofano" | "staff")}
                      >
                        {roleOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-full">
                  <label className="flabel2">Sede</label>
                  <div className="choice-group three">
                    {[
                      { id: "Guadalajara", label: "Guadalajara" },
                      { id: "Tijuana", label: "Tijuana" },
                      { id: "Both", label: "Ambas sedes" },
                    ].map((office) => (
                      <button type="button" key={office.id} className={`choice${officeLocation === office.id ? " sel" : ""}`} onClick={() => setOfficeLocation(office.id as "Guadalajara" | "Tijuana" | "Both")}>
                        {office.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flabel2">Correo electrónico</label>
                  <input className="finput" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div>
                  <label className="flabel2">Clave internacional</label>
                  <select className="fselect" value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)}>
                    {PHONE_COUNTRY_OPTIONS.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-full">
                  <label className="flabel2">Teléfono</label>
                  <input className="finput" inputMode="tel" placeholder="Ej: 6641234567" value={phoneLocal} onChange={e => applyPhoneInput(e.target.value)} />
                </div>
              </div>

              <div className="divider" />

              <h2 className="section-title">Contraseña</h2>
              <p className="section-help">Crea una contraseña personal de al menos 6 caracteres.</p>
              <div className="form-grid">
                <div>
                  <label className="flabel2">Contraseña</label>
                  <div className="pwrap">
                    <input className="pinput" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} />
                    <button className="peye" onClick={() => setShowPassword(p => !p)} type="button">{showPassword ? "Ocultar" : "Ver"}</button>
                  </div>
                </div>
                <div>
                  <label className="flabel2">Confirmar contraseña</label>
                  <div className="pwrap">
                    <input className="pinput" type={showConfirm ? "text" : "password"} placeholder="Repite tu contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    <button className="peye" onClick={() => setShowConfirm(p => !p)} type="button">{showConfirm ? "Ocultar" : "Ver"}</button>
                  </div>
                </div>
              </div>

              <button className="rbtn2" onClick={handleRegister} disabled={loading}>{loading ? "Creando cuenta..." : "Crear mi cuenta"}</button>
              <button className="bbtn" onClick={() => { setStep("code"); setError(""); }}>Volver al código</button>
            </section>
          </div>

          <p className="footer-copy">© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery</p>
          <div className="legal-links" aria-label="Enlaces legales y soporte">
            <a href="/privacy">Privacidad</a>
            <a href="/support">Soporte</a>
            <a href="/account-deletion">Eliminar cuenta</a>
          </div>
        </div>
      </div>
    </>
  );
}
