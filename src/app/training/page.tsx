"use client";

import Image from "next/image";
import { useState } from "react";

type Lang = "es" | "en";
type IconName =
  | "plus"
  | "search"
  | "settings"
  | "backTop"
  | "send"
  | "typing"
  | "quickReplies"
  | "alerts"
  | "photo"
  | "video"
  | "audio"
  | "document"
  | "prescription"
  | "call"
  | "team"
  | "staffChat"
  | "label"
  | "admin"
  | "info"
  | "trash";
type LegendItem = {
  icon: IconName;
  title: Record<Lang, string>;
  meaning: Record<Lang, string>;
};
type LegendGroup = {
  title: Record<Lang, string>;
  items: LegendItem[];
};

const groups: LegendGroup[] = [
  {
    title: { es: "Navegacion", en: "Navigation" },
    items: [
      { icon: "plus", title: { es: "Nuevo o adjuntar", en: "New or attach" }, meaning: { es: "Crear paciente o abrir opciones para enviar archivos.", en: "Create a patient or open file options." } },
      { icon: "search", title: { es: "Buscar", en: "Search" }, meaning: { es: "Encontrar pacientes, chats, personal o expedientes.", en: "Find patients, chats, staff, or records." } },
      { icon: "settings", title: { es: "Ajustes", en: "Settings" }, meaning: { es: "Cambiar idioma, apariencia, datos de cuenta y alertas.", en: "Change language, appearance, account details, and alerts." } },
      { icon: "backTop", title: { es: "Subir", en: "Back to top" }, meaning: { es: "Volver al inicio de una lista larga.", en: "Return to the top of a long list." } },
    ],
  },
  {
    title: { es: "Mensajes", en: "Messages" },
    items: [
      { icon: "send", title: { es: "Enviar", en: "Send" }, meaning: { es: "Enviar texto, audio, archivo o respuesta rapida.", en: "Send text, audio, a file, or a quick reply." } },
      { icon: "typing", title: { es: "Escribiendo", en: "Typing" }, meaning: { es: "La otra persona esta redactando en tiempo real.", en: "The other person is typing in real time." } },
      { icon: "quickReplies", title: { es: "Respuestas rapidas", en: "Quick replies" }, meaning: { es: "Abrir frases guardadas para responder mas rapido.", en: "Open saved phrases for faster replies." } },
      { icon: "alerts", title: { es: "Alertas", en: "Alerts" }, meaning: { es: "Activar notificaciones del dispositivo para mensajes nuevos.", en: "Enable device notifications for new messages." } },
    ],
  },
  {
    title: { es: "Archivos y cuidado", en: "Files and care" },
    items: [
      { icon: "photo", title: { es: "Foto", en: "Photo" }, meaning: { es: "Subir imagenes del paciente o del expediente interno.", en: "Upload patient or internal-record images." } },
      { icon: "video", title: { es: "Video", en: "Video" }, meaning: { es: "Enviar video seguro dentro de la sala.", en: "Send secure video inside the room." } },
      { icon: "audio", title: { es: "Audio", en: "Audio" }, meaning: { es: "Grabar o escuchar una nota de voz.", en: "Record or listen to a voice note." } },
      { icon: "document", title: { es: "Documento", en: "Document" }, meaning: { es: "Abrir archivos, historia clinica o formularios.", en: "Open files, clinical history, or forms." } },
      { icon: "prescription", title: { es: "Receta", en: "Prescription" }, meaning: { es: "Guardar o revisar medicamentos y documentos de receta.", en: "Save or review medication and prescription documents." } },
      { icon: "call", title: { es: "Llamar", en: "Call" }, meaning: { es: "Contactar al consultorio o a un integrante del equipo.", en: "Contact the clinic or a team member." } },
    ],
  },
  {
    title: { es: "Equipo y seguridad", en: "Team and security" },
    items: [
      { icon: "team", title: { es: "Equipo", en: "Team" }, meaning: { es: "Ver o asignar personal a una sala.", en: "View or assign staff to a room." } },
      { icon: "staffChat", title: { es: "Chat staff", en: "Staff chat" }, meaning: { es: "Coordinar internamente sin escribir al paciente.", en: "Coordinate internally without messaging the patient." } },
      { icon: "label", title: { es: "Etiqueta", en: "Label" }, meaning: { es: "Marcar seguimiento, prioridad o estado de un paciente.", en: "Mark follow-up, priority, or patient status." } },
      { icon: "admin", title: { es: "Admin", en: "Admin" }, meaning: { es: "Aprobar personal, permisos, seguridad y auditoria.", en: "Approve staff, permissions, security, and audit." } },
      { icon: "info", title: { es: "Informacion", en: "Information" }, meaning: { es: "Ver el alcance de un permiso o accion antes de usarlo.", en: "Review a permission or action before using it." } },
      { icon: "trash", title: { es: "Papelera", en: "Trash" }, meaning: { es: "Revisar archivo, restaurar o eliminar segun permiso.", en: "Review archive, restore, or delete when permitted." } },
    ],
  },
];

const copy = {
  es: {
    lang: "🇲🇽 ES",
    openPortal: "Portal",
    openAdmin: "Admin",
    openHelp: "Ayuda",
    kicker: "Referencia rapida",
    title: "Leyenda de iconos del portal",
    intro: "Guia compacta para personal y pacientes. No contiene datos reales y se puede revisar en menos de un minuto.",
    note: "Si un icono no aparece en tu cuenta, normalmente significa que ese permiso no esta activado o que no estas dentro de una sala asignada.",
  },
  en: {
    lang: "🇺🇸 EN",
    openPortal: "Portal",
    openAdmin: "Admin",
    openHelp: "Help",
    kicker: "Quick reference",
    title: "Portal icon legend",
    intro: "Compact guide for staff and patients. It contains no real data and can be reviewed in under a minute.",
    note: "If an icon is not visible on your account, that permission is usually not enabled or you are not inside an assigned room.",
  },
};

function PortalIcon({ name }: { name: IconName }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.35,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3.1" /><path d="M12 2.8v2" /><path d="M12 19.2v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2.8 12h2" /><path d="M19.2 12h2" /><path d="m4.9 19.1 1.4-1.4" /><path d="m17.7 6.3 1.4-1.4" /></svg>;
    case "backTop":
      return <svg {...common}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></svg>;
    case "send":
      return <svg {...common}><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" /></svg>;
    case "typing":
      return <svg {...common}><path d="M4 17h10l5 4v-4h1a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z" /><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case "quickReplies":
      return <svg {...common}><path d="M7 20 17 4" /><path d="M4 8h6" /><path d="M14 16h6" /></svg>;
    case "alerts":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></svg>;
    case "photo":
      return <svg {...common}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="m8 13 2.4-2.4a1.2 1.2 0 0 1 1.7 0L17 15.5" /><circle cx="16.5" cy="9.5" r="1.4" /></svg>;
    case "video":
      return <svg {...common}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>;
    case "audio":
      return <svg {...common}><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /></svg>;
    case "document":
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4" /><path d="M9.5 12h5" /><path d="M9.5 16h5" /></svg>;
    case "prescription":
      return <svg {...common}><path d="M6 20V4h7a4 4 0 0 1 0 8H6" /><path d="m12 12 6 8" /><path d="m18 12-6 8" /></svg>;
    case "call":
      return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z" /></svg>;
    case "team":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "staffChat":
      return <svg {...common}><path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
    case "label":
      return <svg {...common}><path d="M20 13 11 22 2 13V3h10Z" /><circle cx="7.5" cy="8.5" r="1.5" /></svg>;
    case "admin":
      return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7h.01" /></svg>;
    case "trash":
      return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 15h10l1-15" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
  }
}

export default function TrainingPage() {
  const [lang, setLang] = useState<Lang>("es");
  const t = copy[lang];
  const goTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #eef4fb; overflow: hidden; }
        .legend-shell { height: 100dvh; min-height: 100dvh; overflow-y: auto; overflow-x: hidden; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; background: #eef4fb; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .legend-topbar { position: sticky; top: 0; z-index: 20; min-height: calc(82px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(7, 56, 93, 0.94); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,0.12); }
        .legend-logo { width: 224px; max-width: 42vw; height: auto; display: block; object-fit: contain; }
        .legend-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .top-btn, .lang-btn { min-height: 44px; border: none; cursor: pointer; font-family: inherit; font-weight: 900; border-radius: 14px; background: #eff6ff; color: #0f172a; padding: 10px 14px; }
        .lang-btn { min-width: 92px; }
        .legend-body { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 calc(88px + env(safe-area-inset-bottom)); }
        .legend-head { margin-bottom: 22px; }
        .kicker { font-size: 12px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; color: #0b63ce; margin: 0 0 8px; }
        h1 { font-size: clamp(34px, 5.4vw, 58px); line-height: 1.02; margin: 0 0 12px; letter-spacing: 0; color: #082f49; }
        .intro { font-size: clamp(16px, 2vw, 20px); line-height: 1.55; margin: 0; color: #475569; max-width: 840px; }
        .legend-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
        .legend-section { background: rgba(255,255,255,.97); border: 1px solid #dbe7f7; border-radius: 8px; box-shadow: 0 12px 34px rgba(15,23,42,.07); padding: 16px; }
        .section-title { margin: 0 0 12px; font-size: 14px; font-weight: 950; color: #64748b; text-transform: uppercase; letter-spacing: .1em; }
        .legend-list { display: grid; gap: 10px; }
        .legend-item { display: grid; grid-template-columns: 50px 1fr; gap: 12px; align-items: center; padding: 10px; border-radius: 8px; background: #f8fbff; border: 1px solid #e4eefb; }
        .icon-box { width: 50px; height: 50px; border-radius: 8px; background: #0b63ce; color: white; display: grid; place-items: center; font-size: 23px; font-weight: 950; line-height: 1; }
        .item-title { margin: 0 0 3px; font-size: 16px; font-weight: 950; color: #0f172a; }
        .item-copy { margin: 0; color: #64748b; line-height: 1.42; font-size: 14px; font-weight: 650; }
        .note-band { margin-top: 16px; padding: 14px 16px; border-radius: 8px; background: #dbeafe; color: #0b3a5b; font-size: 14px; line-height: 1.5; font-weight: 800; }
        @media (max-width: 820px) {
          .legend-topbar { align-items: flex-start; flex-direction: column; }
          .legend-actions { width: 100%; justify-content: flex-start; }
          .legend-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .legend-topbar { min-height: auto; padding: calc(10px + env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left)); gap: 9px; }
          .legend-logo { width: 198px; max-width: 70vw; }
          .legend-actions { gap: 7px; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .legend-actions::-webkit-scrollbar { display: none; }
          .top-btn, .lang-btn { min-height: 40px; border-radius: 13px; font-size: 14px; flex: 0 0 auto; padding-left: 11px; padding-right: 11px; }
          .lang-btn { min-width: 78px; }
          .legend-body { width: calc(100% - 24px); padding-top: 20px; }
          h1 { font-size: 32px; }
          .intro { font-size: 15px; }
          .legend-section { padding: 13px; }
          .legend-item { grid-template-columns: 44px 1fr; gap: 10px; padding: 9px; }
          .icon-box { width: 44px; height: 44px; font-size: 20px; }
          .item-title { font-size: 15px; }
          .item-copy { font-size: 13px; }
        }
      `}</style>

      <main className="legend-shell">
        <header className="legend-topbar">
          <Image className="legend-logo" src="/fonseca_blue.png" alt="Dr. Miguel Fonseca" width={2120} height={606} priority />
          <div className="legend-actions">
            <button className="lang-btn" type="button" onClick={() => setLang((current) => (current === "es" ? "en" : "es"))}>{t.lang}</button>
            <button className="top-btn" type="button" onClick={() => goTo("/inbox")}>{t.openPortal}</button>
            <button className="top-btn" type="button" onClick={() => goTo("/admin")}>{t.openAdmin}</button>
            <button className="top-btn" type="button" onClick={() => goTo("/admin/ayuda")}>{t.openHelp}</button>
          </div>
        </header>

        <div className="legend-body">
          <section className="legend-head">
            <p className="kicker">{t.kicker}</p>
            <h1>{t.title}</h1>
            <p className="intro">{t.intro}</p>
          </section>

          <section className="legend-grid" aria-label={t.title}>
            {groups.map((group) => (
              <section className="legend-section" key={group.title.en}>
                <p className="section-title">{group.title[lang]}</p>
                <div className="legend-list">
                  {group.items.map((item) => (
                    <article className="legend-item" key={`${group.title.en}-${item.title.en}`}>
                      <div className="icon-box" aria-hidden="true"><PortalIcon name={item.icon} /></div>
                      <div>
                        <p className="item-title">{item.title[lang]}</p>
                        <p className="item-copy">{item.meaning[lang]}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <p className="note-band">{t.note}</p>
        </div>
      </main>
    </>
  );
}
