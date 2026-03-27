"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [savedCode, setSavedCode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const ADMIN_PASSWORD = "FonsecaAdmin2025";

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) { setAuthed(true); fetchData(); }
    else setAdminError("Contraseña incorrecta.");
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");
    setStaff(profiles || []);
    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "invite_code").single();
    if (setting) setInviteCode(setting.value);
    setLoading(false);
  };

  const saveInviteCode = async () => {
    if (!newInviteCode.trim()) return;
    setSavingCode(true);
    await supabase.from("app_settings").update({ value: newInviteCode.trim().toUpperCase(), updated_at: new Date().toISOString() }).eq("key", "invite_code");
    setInviteCode(newInviteCode.trim().toUpperCase());
    setNewInviteCode("");
    setSavingCode(false);
    setSavedCode(true);
    setTimeout(() => setSavedCode(false), 2500);
  };

  const deleteStaff = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la cuenta de ${name}?\n\nEsta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    await supabase.from("profiles").delete().eq("id", id);
    setStaff(p => p.filter(s => s.id !== id));
    setSuccessMsg(`Cuenta de ${name} eliminada.`);
    setTimeout(() => setSuccessMsg(""), 3000);
    setDeletingId(null);
  };

  const roleLabel = (r: string) => ({ doctor: "👨‍⚕️ Doctor", enfermeria: "💉 Enfermería", coordinacion: "📋 Coordinación", post_quirofano: "🏥 Post-Q", staff: "👤 Staff" } as any)[r] || "👤 Staff";
  const roleColor = (r: string) => ({ doctor: "#007AFF", enfermeria: "#00C7BE", coordinacion: "#FF9500", post_quirofano: "#AF52DE", staff: "#636366" } as any)[r] || "#636366";
  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() : "??";

  if (!authed) return (
    <>
      <style>{`
        .admin-login-page { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 50%, #1a1a2e 100%); }
        .admin-login-card { width: 100%; max-width: 420px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .admin-logo-section { background: white; padding: 36px 28px 24px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #E5E5EA; }
        .admin-form-section { padding: 32px 28px 40px; }
        .form-label { font-size: 13px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .pw-wrap { position: relative; margin-bottom: 24px; }
        .pw-input { width: 100%; padding: 14px 48px 14px 16px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: #000000; outline: none; font-weight: 600; transition: all 0.15s; }
        .pw-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.3); }
        .pw-input::placeholder { color: #AEAEB2; font-weight: 400; }
        .pw-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; }
        .login-btn { width: 100%; padding: 16px; background: #1C1C1E; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .login-btn:hover { background: #007AFF; transform: translateY(-1px); }
        .error-box { background: #FFF0EE; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #FF3B30; text-align: center; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-logo-section">
            <img src="/fonseca_clear.png" style={{ height: 90, width: "auto", objectFit: "contain", marginBottom: 10 }} alt="Dr. Fonseca" />
            <p style={{ fontSize: 13, color: "#000000", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PANEL DE ADMINISTRACIÓN</p>
          </div>
          <div className="admin-form-section">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#1C1C1E,#007AFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 14px" }}>🔐</div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "#000000", marginBottom: 6 }}>Acceso Admin</p>
              <p style={{ fontSize: 15, color: "#000000", fontWeight: 500, opacity: 0.6 }}>Solo para el Dr. Fonseca</p>
            </div>
            {adminError && <div className="error-box">⚠️ {adminError}</div>}
            <label className="form-label">Contraseña de Admin</label>
            <div className="pw-wrap">
              <input className="pw-input" type={showPassword ? "text" : "password"} placeholder="••••••••••••" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleAdminLogin(); }} />
              <button className="pw-eye" onClick={() => setShowPassword(p => !p)} type="button">{showPassword ? "🙈" : "👁️"}</button>
            </div>
            <button className="login-btn" onClick={handleAdminLogin}>Entrar al Panel →</button>
            <p style={{ fontSize: 12, color: "#000000", textAlign: "center", marginTop: 20, opacity: 0.4, fontWeight: 500 }}>¿Olvidaste la contraseña? Contacta al desarrollador.</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 28, textAlign: "center", fontWeight: 600 }}>© 2025 Dr. Miguel Fonseca · Siluety Plastic Surgery</p>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .admin-topbar { background: rgba(28,28,30,0.97); backdrop-filter: blur(20px); padding: 0 20px; display: flex; align-items: center; gap: 12px; height: 66px; position: sticky; top: 0; z-index: 100; width: 100%; }
        .admin-body { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px 16px 60px; }
        .card { background: white; border-radius: 18px; padding: 20px; margin-bottom: 14px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
        .section-title { font-size: 12px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .stat-card { background: white; border-radius: 16px; padding: 16px 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); text-align: center; }
        .stat-value { font-size: 20px; font-weight: 800; margin: 0 0 2px; }
        .stat-label { font-size: 11px; color: #000000; font-weight: 700; margin-top: 4px; }
        .staff-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #F2F2F7; }
        .staff-row:last-child { border-bottom: none; }
        .av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; }
        .staff-name { font-size: 15px; font-weight: 800; color: #000000; margin: 0 0 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .del-btn { padding: 8px 12px; background: #FFF0EE; border: none; border-radius: 10px; color: #FF3B30; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
        .del-btn:hover { background: #FF3B30; color: white; }
        .code-display { background: linear-gradient(135deg,#EBF5FF,#F0EBFF); border-radius: 14px; padding: 16px; margin-bottom: 12px; text-align: center; }
        .code-display-label { font-size: 11px; font-weight: 800; color: #000000; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
        .code-display-value { font-size: 24px; font-weight: 800; color: #007AFF; letter-spacing: 4px; margin: 0; word-break: break-all; }
        .form-input-admin { width: 100%; padding: 12px 14px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 15px; font-family: inherit; color: #000000; outline: none; font-weight: 700; letter-spacing: 2px; transition: all 0.15s; min-width: 0; }
        .form-input-admin:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.2); }
        .form-input-admin::placeholder { color: #8E8E93; letter-spacing: 0; font-weight: 500; }
        .quick-links { display: flex; gap: 8px; flex-wrap: wrap; }
        .ql { padding: 10px 16px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: 800; transition: all 0.15s; display: inline-block; }
        .ql:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .spinner { width: 20px; height: 20px; border: 2px solid #E5E5EA; border-top-color: #007AFF; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 400px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {/* STICKY TOPBAR */}
      <div className="admin-topbar">
        <img src="/fonseca_clear.png" style={{ height: 46, width: "auto", objectFit: "contain", flexShrink: 0, filter: "brightness(0) invert(1)" }} alt="Dr. Fonseca" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Panel de Administración</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>Dr. Miguel Fonseca · Control de Staff</p>
        </div>
        <button onClick={() => setAuthed(false)} style={{ padding: "8px 14px", background: "rgba(255,59,48,0.15)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FF3B30", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>🚪 Salir</button>
      </div>

      <div className="admin-body">
        {successMsg && <div style={{ background: "#EDFAF1", borderRadius: 12, padding: "13px 16px", marginBottom: 14, fontSize: 14, fontWeight: 700, color: "#34C759" }}>✅ {successMsg}</div>}

        {/* STATS */}
        <div className="stats-grid">
          <div className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 4 }}>👥</div>
            <p className="stat-value" style={{ color: "#007AFF" }}>{staff.length}</p>
            <p className="stat-label">Staff</p>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 4 }}>🔑</div>
            <p className="stat-value" style={{ color: "#34C759", fontSize: 13, wordBreak: "break-all" }}>{inviteCode || "—"}</p>
            <p className="stat-label">Código</p>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 4 }}>🟢</div>
            <p className="stat-value" style={{ color: "#34C759", fontSize: 13 }}>En línea</p>
            <p className="stat-label">Estado</p>
          </div>
        </div>

        {/* INVITE CODE */}
        <div className="card">
          <p className="section-title">🔑 Código de Invitación</p>
          <div className="code-display">
            <p className="code-display-label">Código Actual</p>
            <p className="code-display-value">{inviteCode}</p>
          </div>
          <p style={{ fontSize: 13, color: "#000000", fontWeight: 500, marginBottom: 12, lineHeight: 1.6, opacity: 0.6 }}>Comparte este código con tu staff. Cámbialo para revocar nuevos registros.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input-admin" value={newInviteCode} onChange={e => setNewInviteCode(e.target.value.toUpperCase())} placeholder="Nuevo código…" onKeyDown={e => { if (e.key === "Enter") saveInviteCode(); }} />
            <button onClick={saveInviteCode} disabled={savingCode || !newInviteCode.trim()} style={{ padding: "12px 16px", background: savedCode ? "#34C759" : "#007AFF", border: "none", borderRadius: 12, color: "white", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13, transition: "background 0.2s", whiteSpace: "nowrap" as const, opacity: !newInviteCode.trim() ? 0.4 : 1, flexShrink: 0 }}>
              {savedCode ? "✅ Listo" : savingCode ? "…" : "Cambiar"}
            </button>
          </div>
        </div>

        {/* STAFF LIST */}
        <div className="card">
          <p className="section-title">👥 Cuentas de Staff ({staff.length})</p>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><div className="spinner" /></div>
          ) : staff.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#000000", marginBottom: 4 }}>Sin staff aún</p>
              <p style={{ fontSize: 13, color: "#000000", opacity: 0.5, fontWeight: 500 }}>Comparte el código para que se registren</p>
            </div>
          ) : staff.map(s => (
            <div key={s.id} className="staff-row">
              <div className="av">{ini(s.full_name || "?")}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="staff-name">{s.full_name || "Sin nombre"}</p>
                <span style={{ fontSize: 11, fontWeight: 700, color: roleColor(s.role), background: roleColor(s.role) + "18", padding: "2px 8px", borderRadius: 99 }}>{roleLabel(s.role)}</span>
              </div>
              <button className="del-btn" onClick={() => deleteStaff(s.id, s.full_name || "este usuario")} disabled={deletingId === s.id}>
                {deletingId === s.id ? "…" : "🗑️ Eliminar"}
              </button>
            </div>
          ))}
        </div>

        {/* QUICK LINKS */}
        <div className="card">
          <p className="section-title">🔗 Accesos Rápidos</p>
          <div className="quick-links">
            <a href="/inbox" className="ql" style={{ background: "#007AFF", color: "white" }}>💬 Inbox</a>
            <a href="/login" className="ql" style={{ background: "#F2F2F7", color: "#000000" }}>🔑 Login</a>
            <a href="/register" className="ql" style={{ background: "#F2F2F7", color: "#000000" }}>➕ Registro</a>
          </div>
        </div>
      </div>
    </>
  );
}