"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const OWNER_EMAIL = "mrdiazsr@icloud.com";

const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
};

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

const normalizePhone = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
};

export default function RegisterPage() {
  const [step, setStep] = useState<"code" | "details">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"doctor" | "enfermeria" | "coordinacion" | "post_quirofano" | "staff">("staff");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [officeLocation, setOfficeLocation] = useState<"Guadalajara" | "Tijuana" | "Both">("Guadalajara");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkedInitialCode, setCheckedInitialCode] = useState(false);

  const applyPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setPhone("");
      return;
    }
    if (digits.startsWith("52")) {
      setPhone(`+${digits}`);
      return;
    }
    setPhone(`+52${digits}`);
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

      setInviteCode(codeFromLink || currentCode);
      setStep("details");
      setLoading(false);
      setCheckedInitialCode(true);
    };

    verifyInviteFlow();
  }, []);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError("Por favor ingresa tu nombre completo.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
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

    const assignedRole = normalizedEmail === OWNER_EMAIL ? "doctor" : role;
    const persistedOfficeLocation = officeLocation === "Both" ? null : officeLocation;
    const baseProfile = {
      full_name: fullName.trim(),
      role: assignedRole,
      display_name: fullName.trim(),
      phone: normalizedPhone || null,
    };

    const signUpPayload =
      usingPhone
        ? {
            phone: normalizedPhone,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                role: assignedRole,
                office_location: persistedOfficeLocation,
                phone: normalizedPhone,
              },
            },
          }
        : {
            email: normalizedEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                role: assignedRole,
                office_location: persistedOfficeLocation,
                phone: normalizedPhone || null,
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
      const profileCandidates = [
        {
          id: authData.user.id,
          ...baseProfile,
          office_location: persistedOfficeLocation,
          admin_level: normalizedEmail === OWNER_EMAIL ? "owner" : "none",
        },
        {
          id: authData.user.id,
          full_name: fullName.trim(),
          role: assignedRole,
          office_location: persistedOfficeLocation,
          admin_level: normalizedEmail === OWNER_EMAIL ? "owner" : "none",
        },
        {
          id: authData.user.id,
          full_name: fullName.trim(),
          role: assignedRole,
          office_location: persistedOfficeLocation,
        },
        {
          id: authData.user.id,
          full_name: fullName.trim(),
          role: assignedRole,
        },
        {
          id: authData.user.id,
          full_name: fullName.trim(),
        },
      ];

      let profileSaveError: any = null;
      for (const candidate of profileCandidates) {
        const { error: attemptError } = await supabase.from("profiles").upsert(candidate);
        if (!attemptError) {
          profileSaveError = null;
          break;
        }
        profileSaveError = attemptError;
        if (!isMissingColumnError(attemptError)) break;
      }

      if (profileSaveError) {
        setError(profileSaveError.message || "No pude guardar el perfil.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    window.location.href = "/inbox";
  };

  if (!checkedInitialCode && loading) return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%)", color: "white", fontWeight: 700 }}>
      Verificando acceso...
    </div>
  );

  if (step === "code") return (
    <>
      <style>{`
        .code-page { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%); }
        .reg-card { width: 100%; max-width: 420px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .logo-sec { background: white; padding: 36px 28px 24px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #E5E5EA; }
        .form-sec { background: white; padding: 32px 28px 40px; }
        .reg-title { font-size: 26px; font-weight: 800; color: #000; margin-bottom: 6px; text-align: center; }
        .reg-sub { font-size: 16px; color: #000; font-weight: 600; margin-bottom: 28px; text-align: center; opacity: 0.82; line-height: 1.5; }
        .flabel { font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .err { background: #FFF0EE; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #FF3B30; text-align: center; }
        .code-inp { width: 100%; padding: 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 22px; font-family: inherit; color: #007AFF; outline: none; margin-bottom: 20px; font-weight: 800; text-align: center; letter-spacing: 6px; }
        .code-inp::placeholder { color: #C7C7CC; letter-spacing: 2px; font-size: 16px; font-weight: 500; }
        .rbtn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .rbtn:disabled { opacity: 0.5; }
        .llink { font-size: 14px; color: #000; text-align: center; margin-top: 20px; font-weight: 600; opacity: 0.82; }
        .llink a { color: #007AFF; font-weight: 800; text-decoration: none; }
      `}</style>
      <div className="code-page">
        <div className="reg-card">
          <div className="logo-sec">
            <img src="/fonseca_clear.png" style={{ height: 90, width: "auto", objectFit: "contain", marginBottom: 10 }} alt="Dr. Fonseca" />
            <p style={{ fontSize: 13, color: "#000", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PORTAL MÉDICO — REGISTRO DE STAFF</p>
          </div>
          <div className="form-sec">
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🔑</div>
              <p className="reg-title">Código de Invitación</p>
              <p className="reg-sub">Ingresa el código que te proporcionó el Dr. Fonseca</p>
            </div>
            {error && <div className="err">⚠️ {error}</div>}
            <label className="flabel">Código de Invitación</label>
            <input className="code-inp" placeholder="Ej: FONSECA2025" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") checkCode(); }} />
            <button className="rbtn" onClick={checkCode} disabled={loading}>{loading ? "Verificando…" : "Verificar Código →"}</button>
            <p className="llink">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 28, textAlign: "center", fontWeight: 600 }}>© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery</p>
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
          background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%);
        }
        .details-inner {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 24px 100px;
        }
        .reg-card2 { width: 100%; max-width: 420px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.5); margin-top: 16px; }
        .logo-sec2 { background: white; padding: 36px 28px 24px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #E5E5EA; }
        .form-sec2 { background: white; padding: 32px 28px 40px; }
        .reg-title2 { font-size: 26px; font-weight: 800; color: #000; margin-bottom: 6px; text-align: center; }
        .reg-sub2 { font-size: 15px; color: #000; font-weight: 500; margin-bottom: 28px; text-align: center; opacity: 0.6; }
        .flabel2 { font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .finput { width: 100%; padding: 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000; outline: none; margin-bottom: 16px; font-weight: 600; }
        .finput::placeholder { color: #AEAEB2; font-weight: 400; }
        .pwrap { position: relative; margin-bottom: 16px; }
        .pinput { width: 100%; padding: 14px 48px 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000; outline: none; font-weight: 600; }
        .pinput::placeholder { color: #AEAEB2; font-weight: 400; }
        .peye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; }
        .rbtn2 { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .rbtn2:disabled { opacity: 0.5; cursor: not-allowed; }
        .bbtn { width: 100%; padding: 14px; background: transparent; border: none; color: #000; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 8px; opacity: 0.5; }
        .err2 { background: #FFF0EE; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #FF3B30; text-align: center; }
        .rgroup { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .ropt { flex: 1; min-width: 70px; padding: 10px 6px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 800; color: #000; background: #F2F2F7; border: 2px solid transparent; text-align: center; }
        .ropt.sel { background: #EBF5FF; color: #007AFF; border-color: #007AFF; }
        .role-opt { min-height: 94px; display: flex; align-items: center; justify-content: center; line-height: 1.2; white-space: normal; word-break: break-word; overflow: hidden; padding: 10px 8px; font-size: 11px; }
      `}</style>
      <div className="details-page">
        <div className="details-inner">
          <div className="reg-card2">
            <div className="logo-sec2">
              <img src="/fonseca_clear.png" style={{ height: 90, width: "auto", objectFit: "contain", marginBottom: 10 }} alt="Dr. Fonseca" />
              <p style={{ fontSize: 13, color: "#000", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PORTAL MÉDICO — REGISTRO DE STAFF</p>
            </div>
            <div className="form-sec2">
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>👤</div>
                <p className="reg-title2">Crear tu Cuenta</p>
              <p className="reg-sub2">Completa tu información de personal y selecciona tu sede</p>
              </div>
              {error && <div className="err2">⚠️ {error}</div>}
              <label className="flabel2">Nombre Completo</label>
              <input className="finput" placeholder="Dr. Ana García" value={fullName} onChange={e => setFullName(e.target.value)} />
              <label className="flabel2">Método de acceso</label>
              <div className="rgroup">
                <div className={`ropt${authMethod === "email" ? " sel" : ""}`} onClick={() => setAuthMethod("email")}>📧 Correo</div>
                <div className={`ropt${authMethod === "phone" ? " sel" : ""}`} onClick={() => setAuthMethod("phone")}>📱 Teléfono</div>
              </div>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "-6px 0 16px", lineHeight: 1.45, fontWeight: 600 }}>
                Puedes usar correo o teléfono (o ambos). Solo necesitas uno.
              </p>
              <label className="flabel2">Tu función</label>
              <div className="rgroup">
                {[
                  { id: "doctor", label: "👩‍⚕️ Doctora/👨‍⚕️ Doctor" },
                  { id: "enfermeria", label: "💉 Enfermería" },
                  { id: "coordinacion", label: "📋 Coordinación" },
                  { id: "post_quirofano", label: "🏥 Post-Q" },
                  { id: "staff", label: "🏢 Personal de oficina" },
                ].map((roleOption) => (
                  <div
                    key={roleOption.id}
                    className={`ropt role-opt${role === roleOption.id ? " sel" : ""}`}
                    onClick={() => setRole(roleOption.id as "doctor" | "enfermeria" | "coordinacion" | "post_quirofano" | "staff")}
                  >
                    {roleOption.label}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "-6px 0 16px", lineHeight: 1.45, fontWeight: 600 }}>
                Seguridad: el sistema nunca te da permisos de administrador automáticamente.
              </p>
              <label className="flabel2">Tu Sede</label>
              <div className="rgroup">
                {[
                  { id: "Guadalajara", label: "🏙️ Guadalajara" },
                  { id: "Tijuana", label: "🌊 Tijuana" },
                  { id: "Both", label: "🌐 Ambas sedes" },
                ].map((office) => (
                  <div key={office.id} className={`ropt${officeLocation === office.id ? " sel" : ""}`} onClick={() => setOfficeLocation(office.id as "Guadalajara" | "Tijuana" | "Both")}>
                    {office.label}
                  </div>
                ))}
              </div>
              <label className="flabel2">Correo Electrónico (opcional)</label>
              <input className="finput" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
              <label className="flabel2">Teléfono (opcional)</label>
              <input className="finput" inputMode="tel" placeholder="+52 664 123 4567" value={phone} onFocus={() => { if (!phone.trim()) setPhone("+52"); }} onChange={e => applyPhoneInput(e.target.value)} />
              <label className="flabel2">Contraseña</label>
              <div className="pwrap">
                <input className="pinput" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="peye" onClick={() => setShowPassword(p => !p)} type="button">{showPassword ? "🙈" : "👁️"}</button>
              </div>
              <label className="flabel2">Confirmar Contraseña</label>
              <div className="pwrap" style={{ marginBottom: 8 }}>
                <input className="pinput" type={showConfirm ? "text" : "password"} placeholder="Repite tu contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <button className="peye" onClick={() => setShowConfirm(p => !p)} type="button">{showConfirm ? "🙈" : "👁️"}</button>
              </div>
              <button className="rbtn2" onClick={handleRegister} disabled={loading}>{loading ? "Creando cuenta…" : "✅ Crear Mi Cuenta"}</button>
              <button className="bbtn" onClick={() => { setStep("code"); setError(""); }}>← Volver</button>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 28, textAlign: "center", fontWeight: 600 }}>© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery</p>
        </div>
      </div>
    </>
  );
}
