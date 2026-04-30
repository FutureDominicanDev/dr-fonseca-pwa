"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const passwordError = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (confirmPassword && password !== confirmPassword) return "Las contraseñas no coinciden.";
    return "";
  }, [password, confirmPassword]);

  useEffect(() => {
    const applyRecoverySession = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "recovery") {
        setError("Enlace inválido o expirado. Solicita uno nuevo.");
        setValidating(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        setError("El enlace de recuperación no es válido o expiró.");
        setValidating(false);
        return;
      }

      window.history.replaceState({}, document.title, "/reset-password");
      setReady(true);
      setValidating(false);
    };

    applyRecoverySession();
  }, []);

  const submit = async () => {
    if (!ready) return;
    if (!password || !confirmPassword) {
      setError("Completa ambos campos.");
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
      setError("No se pudo actualizar la contraseña. Solicita un nuevo enlace.");
      return;
    }

    setDone(true);
  };

  return (
    <>
      <style>{`
        .reset-page { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%); }
        .reset-card { width: 100%; max-width: 430px; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .logo-section { background: white; padding: 36px 28px 24px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #E5E5EA; }
        .form-section { padding: 32px 28px 40px; }
        .title { font-size: 28px; font-weight: 800; color: #000; margin-bottom: 6px; }
        .sub { font-size: 16px; color: #000; opacity: 0.78; font-weight: 600; line-height: 1.5; margin-bottom: 22px; }
        .label { font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; display:block; }
        .input { width: 100%; padding: 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000; outline: none; margin-bottom: 14px; font-weight: 600; }
        .input:focus { background: #fff; box-shadow: 0 0 0 2px rgba(0,122,255,0.28); }
        .input::placeholder { color: #AEAEB2; font-weight: 400; }
        .main-btn { width:100%; padding:16px; background:#007AFF; border:none; border-radius:14px; color:#fff; font-size:16px; font-weight:800; cursor:pointer; font-family:inherit; }
        .main-btn:disabled { opacity:.5; cursor:not-allowed; }
        .ghost-btn { width:100%; padding:13px; margin-top:10px; background:#F2F2F7; border:none; border-radius:14px; color:#000; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit; }
        .error { background:#FFF0EE; border-radius:10px; padding:12px 14px; margin-bottom:16px; font-size:14px; font-weight:700; color:#FF3B30; text-align:center; }
      `}</style>
      <div className="reset-page">
        <div className="reset-card">
          <div className="logo-section">
            <img src="/fonseca_clear.png" style={{ height: 90, width: "auto", objectFit: "contain", marginBottom: 10 }} alt="Dr. Fonseca" />
            <p style={{ fontSize: 13, color: "#000", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PORTAL MÉDICO — STAFF</p>
          </div>
          <div className="form-section">
            {validating ? (
              <>
                <p className="title">Validando enlace…</p>
                <p className="sub">Espera un momento por favor.</p>
              </>
            ) : done ? (
              <>
                <p className="title">¡Listo!</p>
                <p className="sub">Tu contraseña se actualizó correctamente.</p>
                <button className="main-btn" onClick={() => { window.location.href = "/login"; }}>
                  Ir al login
                </button>
              </>
            ) : (
              <>
                <p className="title">Nueva contraseña</p>
                <p className="sub">Ingresa y confirma tu nueva contraseña.</p>
                {error && <div className="error">⚠️ {error}</div>}
                <label className="label">Nueva contraseña</label>
                <input className="input" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
                <label className="label">Confirmar contraseña</label>
                <input className="input" type="password" placeholder="Repite tu contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <button className="main-btn" onClick={submit} disabled={loading || !ready}>
                  {loading ? "Guardando…" : "Actualizar contraseña"}
                </button>
                <button className="ghost-btn" onClick={() => { window.location.href = "/login"; }}>
                  ← Volver al login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
