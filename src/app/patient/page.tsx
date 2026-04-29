import Link from "next/link";

export default function PatientLandingPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #1d4ed8 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 24px 80px rgba(2, 6, 23, 0.35)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30, color: "#111827", fontWeight: 900 }}>Patient Access Link</h1>
        <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.6 }}>
          This page needs your personal room link to open chat.
        </p>
        <p style={{ margin: "8px 0 0", color: "#4b5563", lineHeight: 1.6 }}>
          Esta página necesita tu enlace personal de sala para abrir el chat.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <Link
            href="/"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Go to Portal / Ir al portal
          </Link>
          <Link
            href="/login"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "#eff6ff",
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Staff Login
          </Link>
        </div>
      </section>
    </main>
  );
}

