"use client";

export default function AdminHelpPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .help-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: linear-gradient(180deg, #EEF4FF 0%, #F8FAFC 35%, #F5F7FB 100%); }
        .help-topbar { position: sticky; top: 0; z-index: 50; min-height: calc(72px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); }
        .help-body { width: 100%; max-width: 980px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
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
          .help-topbar { align-items: flex-start; }
        }
      `}</style>

      <div className="help-shell">
        <div className="help-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Ayuda del panel</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>Guía rápida para saber qué hace cada parte</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={() => (window.location.href = "/admin")}>← Volver al panel</button>
            <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Ir al portal</button>
          </div>
        </div>

        <div className="help-body">
          <section className="hero">
            <p className="section-title" style={{ color: "rgba(255,255,255,0.72)" }}>Resumen rápido</p>
            <h1>Todo lo importante, explicado fácil</h1>
            <p>
              Esta pantalla está hecha para que puedas encontrar lo que necesitas sin pensar en temas técnicos.
              Aquí puedes exportar expedientes, revisar pacientes por sede, cambiar permisos del equipo y actualizar el código de invitación.
            </p>
          </section>

          <div className="grid-2">
            <section className="card">
              <p className="section-title">Qué puedes hacer</p>
              <h2>Acciones principales</h2>
              <ul>
                <li>Exportar un expediente individual de cualquier paciente.</li>
                <li>Exportar una lista completa filtrada por sede.</li>
                <li>Ver rápidamente cuántos procedimientos hay en Guadalajara y Tijuana.</li>
                <li>Asignar la sede correcta a cada miembro del equipo.</li>
                <li>Dar o quitar acceso administrativo al equipo.</li>
                <li>Cambiar el código de invitación para nuevos registros.</li>
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
                <h3>Filtra por sede</h3>
                <p>Usa los botones de Guadalajara, Tijuana o Todas para ver solo los pacientes que te interesan en ese momento.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div>
                <h3>Busca al paciente</h3>
                <p>Puedes escribir nombre, procedimiento, teléfono o sede para encontrarlo más rápido.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div>
                <h3>Exporta el expediente</h3>
                <p>Usa el botón de un paciente para sacar solo ese expediente, o el botón general para descargar todos los pacientes visibles con el filtro actual.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <div>
                <h3>Revisa tu equipo</h3>
                <p>En la sección del equipo puedes poner a cada persona en la sede correcta y decidir si tiene acceso administrativo o no.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">5</div>
              <div>
                <h3>Cambia el código cuando haga falta</h3>
                <p>Si quieres evitar nuevos registros con el código actual, solo cámbialo y comparte el nuevo con las personas correctas.</p>
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
