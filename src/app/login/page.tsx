"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type View = "login" | "forgot" | "sent";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Por favor ingresa tu correo y contraseña."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setError("Correo o contraseña incorrectos."); setLoading(false); return; }
    window.location.href = "/inbox";
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) { setError("Por favor ingresa tu correo electrónico."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError("Error enviando el correo. Verifica el correo ingresado."); setLoading(false); return; }
    setLoading(false);
    setView("sent");
  };

  return (
    <>
      <style>{`
        .login-page { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%); }
        .login-card { width: 100%; max-width: 420px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .logo-section { background: white; padding: 36px 28px 24px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #E5E5EA; }
        .form-section { padding: 32px 28px 40px; }
        .page-title { font-size: 26px; font-weight: 800; color: #000000; margin-bottom: 6px; }
        .page-sub { font-size: 16px; color: #000000; font-weight: 600; margin-bottom: 28px; opacity: 0.82; line-height: 1.5; }
        .form-label { font-size: 13px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; padding: 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000000; outline: none; margin-bottom: 16px; font-weight: 600; transition: all 0.15s; }
        .form-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.3); }
        .form-input::placeholder { color: #AEAEB2; font-weight: 400; }
        .pw-wrap { position: relative; margin-bottom: 8px; }
        .pw-input { width: 100%; padding: 14px 48px 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000000; outline: none; font-weight: 600; transition: all 0.15s; }
        .pw-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.3); }
        .pw-input::placeholder { color: #AEAEB2; font-weight: 400; }
        .pw-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; }
        .forgot-link { font-size: 13px; color: #007AFF; font-weight: 700; cursor: pointer; text-align: right; display: block; margin-bottom: 20px; }
        .main-btn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .main-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,122,255,0.4); }
        .main-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .back-btn { width: 100%; padding: 13px; background: #F2F2F7; border: none; border-radius: 14px; color: #000000; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 10px; }
        .back-btn:hover { background: #E5E5EA; }
        .error-box { background: #FFF0EE; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #FF3B30; text-align: center; }
        .footer-text { font-size: 14px; color: #000000; text-align: center; margin-top: 20px; font-weight: 600; opacity: 0.82; }
        .footer-text span { color: #007AFF; font-weight: 800; cursor: pointer; opacity: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="logo-section">
            <img src="/fonseca_clear.png" style={{ height: 90, width: "auto", objectFit: "contain", marginBottom: 10 }} alt="Dr. Fonseca" />
            <p style={{ fontSize: 13, color: "#000000", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PORTAL MÉDICO — STAFF</p>
          </div>

          <div className="form-section">

            {/* LOGIN VIEW */}
            {view === "login" && (
              <>
                <p className="page-title">Bienvenido 👋</p>
                <p className="page-sub">Ingresa tus credenciales para continuar</p>
                {error && <div className="error-box">⚠️ {error}</div>}
                <label className="form-label">Correo Electrónico</label>
                <input className="form-input" type="email" placeholder="correo@drmiguelfonseca.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} autoComplete="email" />
                <label className="form-label">Contraseña</label>
                <div className="pw-wrap">
                  <input className="pw-input" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} autoComplete="current-password" />
                  <button className="pw-eye" onClick={() => setShowPassword(p => !p)} type="button">{showPassword ? "🙈" : "👁️"}</button>
                </div>
                <span className="forgot-link" onClick={() => { setView("forgot"); setError(""); }}>¿Olvidaste tu contraseña?</span>
                <button className="main-btn" onClick={handleLogin} disabled={loading}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      Ingresando…
                    </div>
                  ) : "Ingresar al Portal →"}
                </button>
                <p className="footer-text">¿Eres nuevo? <span onClick={() => window.location.href = "/register"}>Regístrate aquí</span></p>
              </>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === "forgot" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📧</div>
                  <p className="page-title">Restablecer Contraseña</p>
                  <p className="page-sub">Te enviaremos un enlace a tu correo</p>
                </div>
                {error && <div className="error-box">⚠️ {error}</div>}
                <label className="form-label">Tu Correo Electrónico</label>
                <input className="form-input" type="email" placeholder="correo@drmiguelfonseca.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleReset(); }} autoComplete="email" style={{ marginBottom: 20 }} />
                <button className="main-btn" onClick={handleReset} disabled={loading}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      Enviando…
                    </div>
                  ) : "📧 Enviar Enlace de Restablecimiento"}
                </button>
                <button className="back-btn" onClick={() => { setView("login"); setError(""); }}>← Volver al Login</button>
              </>
            )}

            {/* EMAIL SENT VIEW */}
            {view === "sent" && (
              <>
                <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                  <p className="page-title">¡Correo Enviado!</p>
                  <p style={{ fontSize: 15, color: "#000000", fontWeight: 500, opacity: 0.7, marginBottom: 8, lineHeight: 1.6 }}>Enviamos un enlace de restablecimiento a:</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#007AFF", marginBottom: 24 }}>{resetEmail}</p>
                  <p style={{ fontSize: 13, color: "#000000", opacity: 0.5, fontWeight: 500, lineHeight: 1.6, marginBottom: 24 }}>Revisa tu bandeja de entrada y sigue las instrucciones. Si no lo ves revisa tu carpeta de spam.</p>
                  <button className="main-btn" onClick={() => { setView("login"); setError(""); setResetEmail(""); }}>← Volver al Login</button>
                </div>
              </>
            )}

          </div>
        </div>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 28, textAlign: "center", fontWeight: 600 }}>
          © 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery
        </p>
      </div>
    </>
  );
}
