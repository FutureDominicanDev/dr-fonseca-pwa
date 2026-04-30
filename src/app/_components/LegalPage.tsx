import Link from "next/link";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalPageProps = {
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
  children?: React.ReactNode;
};

const portalUrl = "https://portal.drfonsecacirujanoplastico.com";

export default function LegalPage({ title, subtitle, updated, sections, children }: LegalPageProps) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        background: "#f6f8fb",
        color: "#111827",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        padding: "calc(env(safe-area-inset-top) + 24px) 18px calc(env(safe-area-inset-bottom) + 32px)",
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
          overflow: "hidden",
        }}
      >
        <header style={{ padding: "28px 24px 22px", borderBottom: "1px solid #e5e7eb" }}>
          <Link
            href="/login"
            style={{
              color: "#0b66c3",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              marginBottom: 18,
            }}
          >
            Volver al portal
          </Link>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>
            Dr. Fonseca | Portal Medico
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 44px)", lineHeight: 1.08, letterSpacing: 0, color: "#0f172a" }}>
            {title}
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 18, lineHeight: 1.55, color: "#475569", fontWeight: 600 }}>
            {subtitle}
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b", fontWeight: 700 }}>
            Ultima actualizacion: {updated}
          </p>
        </header>

        <div style={{ padding: "24px" }}>
          {sections.map((section) => (
            <section key={section.title} style={{ marginBottom: 22 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 21, color: "#0f172a", letterSpacing: 0 }}>
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} style={{ margin: "0 0 10px", fontSize: 16, lineHeight: 1.66, color: "#334155" }}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          {children}

          <footer
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 16px",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <Link href="/privacy" style={{ color: "#0b66c3", textDecoration: "none" }}>
              Privacidad
            </Link>
            <Link href="/support" style={{ color: "#0b66c3", textDecoration: "none" }}>
              Soporte
            </Link>
            <Link href="/account-deletion" style={{ color: "#0b66c3", textDecoration: "none" }}>
              Eliminar cuenta
            </Link>
            <a href={portalUrl} style={{ color: "#0b66c3", textDecoration: "none" }}>
              Portal
            </a>
          </footer>
        </div>
      </article>
    </main>
  );
}
