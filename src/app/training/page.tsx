"use client";

import Image from "next/image";
import { useState } from "react";

type Lang = "es" | "en";
type LegendItem = {
  icon: string;
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
      { icon: "+", title: { es: "Nuevo o adjuntar", en: "New or attach" }, meaning: { es: "Crear paciente o abrir opciones para enviar archivos.", en: "Create a patient or open file options." } },
      { icon: "⌕", title: { es: "Buscar", en: "Search" }, meaning: { es: "Encontrar pacientes, chats, personal o expedientes.", en: "Find patients, chats, staff, or records." } },
      { icon: "⚙", title: { es: "Ajustes", en: "Settings" }, meaning: { es: "Cambiar idioma, apariencia, datos de cuenta y alertas.", en: "Change language, appearance, account details, and alerts." } },
      { icon: "↥", title: { es: "Subir", en: "Back to top" }, meaning: { es: "Volver al inicio de una lista larga.", en: "Return to the top of a long list." } },
    ],
  },
  {
    title: { es: "Mensajes", en: "Messages" },
    items: [
      { icon: "↗", title: { es: "Enviar", en: "Send" }, meaning: { es: "Enviar texto, audio, archivo o respuesta rapida.", en: "Send text, audio, a file, or a quick reply." } },
      { icon: "…", title: { es: "Escribiendo", en: "Typing" }, meaning: { es: "La otra persona esta redactando en tiempo real.", en: "The other person is typing in real time." } },
      { icon: "/", title: { es: "Respuestas rapidas", en: "Quick replies" }, meaning: { es: "Abrir frases guardadas para responder mas rapido.", en: "Open saved phrases for faster replies." } },
      { icon: "🔔", title: { es: "Alertas", en: "Alerts" }, meaning: { es: "Activar notificaciones del dispositivo para mensajes nuevos.", en: "Enable device notifications for new messages." } },
    ],
  },
  {
    title: { es: "Archivos y cuidado", en: "Files and care" },
    items: [
      { icon: "📷", title: { es: "Foto", en: "Photo" }, meaning: { es: "Subir imagenes del paciente o del expediente interno.", en: "Upload patient or internal-record images." } },
      { icon: "🎥", title: { es: "Video", en: "Video" }, meaning: { es: "Enviar video seguro dentro de la sala.", en: "Send secure video inside the room." } },
      { icon: "🎙", title: { es: "Audio", en: "Audio" }, meaning: { es: "Grabar o escuchar una nota de voz.", en: "Record or listen to a voice note." } },
      { icon: "▣", title: { es: "Documento", en: "Document" }, meaning: { es: "Abrir archivos, historia clinica o formularios.", en: "Open files, clinical history, or forms." } },
      { icon: "Rx", title: { es: "Receta", en: "Prescription" }, meaning: { es: "Guardar o revisar medicamentos y documentos de receta.", en: "Save or review medication and prescription documents." } },
      { icon: "☎", title: { es: "Llamar", en: "Call" }, meaning: { es: "Contactar al consultorio o a un integrante del equipo.", en: "Contact the clinic or a team member." } },
    ],
  },
  {
    title: { es: "Equipo y seguridad", en: "Team and security" },
    items: [
      { icon: "👥", title: { es: "Equipo", en: "Team" }, meaning: { es: "Ver o asignar personal a una sala.", en: "View or assign staff to a room." } },
      { icon: "💬", title: { es: "Chat staff", en: "Staff chat" }, meaning: { es: "Coordinar internamente sin escribir al paciente.", en: "Coordinate internally without messaging the patient." } },
      { icon: "🏷", title: { es: "Etiqueta", en: "Label" }, meaning: { es: "Marcar seguimiento, prioridad o estado de un paciente.", en: "Mark follow-up, priority, or patient status." } },
      { icon: "🛡", title: { es: "Admin", en: "Admin" }, meaning: { es: "Aprobar personal, permisos, seguridad y auditoria.", en: "Approve staff, permissions, security, and audit." } },
      { icon: "ⓘ", title: { es: "Informacion", en: "Information" }, meaning: { es: "Ver el alcance de un permiso o accion antes de usarlo.", en: "Review a permission or action before using it." } },
      { icon: "🗑", title: { es: "Papelera", en: "Trash" }, meaning: { es: "Revisar archivo, restaurar o eliminar segun permiso.", en: "Review archive, restore, or delete when permitted." } },
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
        body { background: #eef4fb; overflow-x: hidden; }
        .legend-shell { min-height: 100svh; overflow-x: hidden; background: #eef4fb; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
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
                      <div className="icon-box" aria-hidden="true">{item.icon}</div>
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
