"use client";

export default function CreateRoomPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "max(18px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", background: "#F5F7FB", overflowX: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 22, padding: "24px 20px", boxShadow: "0 20px 60px rgba(15,23,42,0.08)", overflowWrap: "anywhere" }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.35, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748B" }}>
          Ruta protegida
        </p>
        <h1 style={{ margin: "10px 0 10px", fontSize: "clamp(28px, 8vw, 34px)", lineHeight: 1.12, color: "#0F172A", overflowWrap: "anywhere" }}>
          Esta página ya no se usa
        </h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "#475569" }}>
          Esto es normal. La creación de expedientes y salas ya vive dentro del flujo principal del portal para evitar rutas antiguas con acceso directo a tablas sensibles.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <button
            onClick={() => (window.location.href = "/inbox")}
            style={{ border: "none", borderRadius: 14, background: "#2563EB", color: "white", fontWeight: 800, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 17, minHeight: 48, flex: "1 1 180px" }}
          >
            Ir al inbox
          </button>
          <button
            onClick={() => (window.location.href = "/admin")}
            style={{ border: "none", borderRadius: 14, background: "#E2E8F0", color: "#0F172A", fontWeight: 800, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 17, minHeight: 48, flex: "1 1 180px" }}
          >
            Ir al centro de control
          </button>
        </div>
      </div>
    </main>
  );
}
