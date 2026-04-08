"use client";

import { useState } from "react";

export default function AdminHelpPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .help-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: linear-gradient(180deg, #EEF4FF 0%, #F8FAFC 35%, #F5F7FB 100%); }
        .help-topbar { position: sticky; top: 0; z-index: 50; min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); }
        .help-body { width: 100%; max-width: 980px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { height: 42px; padding: 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #111827, #2563EB); color: white; border-radius: 28px; padding: 24px; margin-bottom: 18px; box-shadow: 0 18px 45px rgba(37,99,235,0.16); }
        .card { background: white; border-radius: 20px; padding: 22px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); margin-bottom: 16px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .section-title { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
        .card h2 { font-size: 24px; color: #111827; margin: 0 0 8px; }
        .card h3 { font-size: 18px; color: #111827; margin: 0 0 10px; }
        .hero h1 { font-size: 38px; margin: 0 0 10px; }
        .hero p, .card p, .card li { font-size: 15px; color: #4B5563; line-height: 1.7; }
        .hero p { color: rgba(255,255,255,0.88); }
        .card ul { padding-left: 18px; margin: 0; }
        .note { background: #EFF6FF; border-radius: 16px; padding: 14px 16px; color: #1D4ED8; font-weight: 700; margin-top: 14px; }
        .step { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .step-number { width: 32px; height: 32px; border-radius: 50%; background: #DBEAFE; color: #1D4ED8; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; flex-shrink: 0; }
        @media (max-width: 760px) {
          .grid-2 { grid-template-columns: 1fr; }
          .hero h1 { font-size: 30px; }
          .help-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; }
          .topbar-actions { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-btn { width: 100%; text-align: center; padding: 12px 12px; font-size: 13px; }
        }
      `}</style>

      <div className="help-shell">
        <div className="help-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Ayuda del panel</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>Guía rápida para saber qué hace cada parte</p>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn" onClick={() => goTo("/admin")}>← Volver al panel</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/auditoria")}>Auditoría</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/papelera")}>Papelera</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>Ir al portal</button>
          </div>
          <button
            className="menu-btn"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="menu-panel">
            <button className="topbar-btn" onClick={() => goTo("/admin")}>← Volver al panel</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/auditoria")}>Auditoría</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/papelera")}>Papelera</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>Ir al portal</button>
          </div>
        )}

        <div className="help-body">
          <section className="hero">
            <p className="section-title" style={{ color: "rgba(255,255,255,0.72)" }}>Resumen rápido</p>
            <h1>Todo lo importante, explicado fácil</h1>
            <p>
              Esta pantalla está hecha para que puedas encontrar lo que necesitas sin pensar en temas técnicos.
              Aquí puedes buscar pacientes, abrir expedientes, compartir o imprimir registros, cambiar permisos del personal y enviar enlaces de invitación.
            </p>
          </section>

          <div className="grid-2">
            <section className="card">
              <p className="section-title">Qué puedes hacer</p>
              <h2>Acciones principales</h2>
              <ul>
                <li>Buscar un expediente por nombre, teléfono, correo, procedimiento o sede.</li>
                <li>Abrir la ficha de un paciente y revisar su historial completo antes de exportar.</li>
                <li>Compartir o imprimir el expediente cuando ya revisaste el caso.</li>
                <li>Asignar la sede correcta a cada miembro del equipo.</li>
                <li>Dar o quitar acceso administrativo al equipo.</li>
                <li>Enviar un enlace de invitación para que el personal se registre con menos pasos.</li>
                <li>Revisar la auditoría y recuperar expedientes desde papelera o archivo.</li>
              </ul>
            </section>

            <section className="card">
              <p className="section-title">Qué incluye una exportación</p>
              <h2>Lo que verás en el expediente</h2>
              <ul>
                <li>Nombre del paciente y sus datos básicos.</li>
                <li>Procedimiento, sede y fecha de cirugía.</li>
                <li>Salas relacionadas con ese procedimiento.</li>
                <li>Mensajes completos con quién escribió y cuándo.</li>
                <li>Archivos, imágenes, audios y videos con sus enlaces.</li>
                <li>Contexto para entender por qué se compartió cada cosa.</li>
                <li>Opciones para compartirlo o llevarlo a PDF / impresión.</li>
              </ul>
              <div className="note">Piensa en la exportación como un expediente claro para revisar la historia completa del paciente.</div>
            </section>
          </div>

          <section className="card">
            <p className="section-title">Cómo usar el panel</p>
            <h2>Paso a paso</h2>

            <div className="step">
              <div className="step-number">1</div>
              <div>
                <h3>Busca al paciente</h3>
                <p>Escribe nombre, teléfono, correo o procedimiento para encontrar el expediente correcto.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div>
                <h3>Abre y revisa el expediente</h3>
                <p>Entra a la ficha del paciente para revisar procedimientos, medios y cronología completa antes de exportar.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div>
                <h3>Comparte o imprime si hace falta</h3>
                <p>Dentro del expediente puedes compartir el caso o abrir la versión lista para PDF / impresión.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <div>
                <h3>Revisa la auditoría</h3>
                <p>Si necesitas saber quién cambió algo y cuándo lo hizo, entra a la página de auditoría.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">5</div>
              <div>
                <h3>Revisa papelera y archivo</h3>
                <p>Ahí puedes recuperar expedientes archivados o enviados a papelera sin perder el control.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">6</div>
              <div>
                <h3>Administra al personal</h3>
                <p>En la sección del personal puedes corregir sedes, accesos administrativos y enlaces de invitación.</p>
              </div>
            </div>
          </section>

          <div className="grid-2">
            <section className="card">
              <p className="section-title">Si algo no se mueve</p>
              <h2>Qué hacer</h2>
              <ul>
                <li>Presiona el botón <strong>Actualizar datos</strong>.</li>
                <li>Recarga la página una vez.</li>
                <li>Si sigue igual, vuelve aquí y avísame qué botón tocaste y qué esperabas ver.</li>
              </ul>
            </section>

            <section className="card">
              <p className="section-title">Navegación</p>
              <h2>Cómo volver</h2>
              <ul>
                <li>Usa <strong>Volver al panel</strong> para regresar a esta pantalla.</li>
                <li>Usa <strong>Ir al portal</strong> para regresar al inbox o portal principal.</li>
                <li>Usa <strong>Salir</strong> cuando quieras cerrar tu sesión.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
