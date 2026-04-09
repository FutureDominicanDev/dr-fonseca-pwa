"use client";

export default function PatientsPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F5F7FB" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 24, padding: 28, boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
          Ruta protegida
        </p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34, lineHeight: 1.1, color: "#0F172A" }}>
          La creación directa de pacientes fue retirada
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: "#475569" }}>
          Esto es normal. Ahora los pacientes se crean desde el flujo principal del inbox y del expediente para evitar rutas antiguas que escribían datos clínicos fuera del proceso normal.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <button
            onClick={() => (window.location.href = "/inbox")}
            style={{ border: "none", borderRadius: 14, background: "#2563EB", color: "white", fontWeight: 800, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Ir al inbox
          </button>
          <button
            onClick={() => (window.location.href = "/admin")}
            style={{ border: "none", borderRadius: 14, background: "#E2E8F0", color: "#0F172A", fontWeight: 800, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Ir al centro de control
          </button>
        </div>
      </div>
    </main>
  );
}
