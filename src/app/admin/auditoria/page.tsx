"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  OWNER_EMAIL,
  formatDateTime,
  isMissingColumnError,
  normalizeAdminLevel,
  type AdminAuditEvent,
  type StaffProfile,
} from "@/lib/adminPortal";

type AuditFilter = "all" | "patient" | "staff" | "system";

export default function AdminAuditPage() {
  const { lang, setLang, isSpanish } = useAdminLang();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AuditFilter>("all");

  const hasAdminAccess =
    viewerEmail.toLowerCase() === OWNER_EMAIL ||
    ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail));

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
  };

  const actionText = (action?: string | null) => {
    const labelsEs: Record<string, string> = {
      patient_details_updated: "Datos del paciente editados",
      procedure_updated: "Procedimiento editado",
      patient_photo_updated: "Foto del paciente actualizada",
      record_status_changed: "Estado del expediente cambiado",
      record_shared: "Expediente compartido",
      record_preview_opened: "Vista previa del expediente abierta",
      record_downloaded: "Expediente descargado",
      record_pdf_opened: "Versión PDF / impresión abierta",
      staff_admin_updated: "Permiso administrativo cambiado",
      staff_office_updated: "Sede del personal cambiada",
      staff_profile_deleted: "Perfil de personal eliminado",
      invite_code_updated: "Código de invitación actualizado",
    };

    const labelsEn: Record<string, string> = {
      patient_details_updated: "Patient details edited",
      procedure_updated: "Procedure edited",
      patient_photo_updated: "Patient photo updated",
      record_status_changed: "Record status changed",
      record_shared: "Record shared",
      record_preview_opened: "Record preview opened",
      record_downloaded: "Record downloaded",
      record_pdf_opened: "PDF / print view opened",
      staff_admin_updated: "Admin access changed",
      staff_office_updated: "Staff office changed",
      staff_profile_deleted: "Staff profile deleted",
      invite_code_updated: "Invitation code updated",
    };

    return (isSpanish ? labelsEs : labelsEn)[action || ""] || (action || (isSpanish ? "Evento" : "Event"));
  };

  const filterText = (value: AuditFilter) =>
    ({
      all: isSpanish ? "Todo" : "All",
      patient: isSpanish ? "Pacientes" : "Patients",
      staff: isSpanish ? "Personal" : "Staff",
      system: isSpanish ? "Sistema" : "System",
    } as const)[value];

  const entityTypeBucket = (entityType?: string | null): AuditFilter => {
    if (entityType === "patient" || entityType === "procedure") return "patient";
    if (entityType === "staff_profile") return "staff";
    return "system";
  };

  const filteredEvents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesFilter = filter === "all" ? true : entityTypeBucket(event.entity_type) === filter;
      const haystack = [event.actor_name, event.actor_email, event.entity_name, event.notes, actionText(event.action)].join(" ").toLowerCase();
      const matchesSearch = !normalized || haystack.includes(normalized);
      return matchesFilter && matchesSearch;
    });
  }, [events, filter, search, isSpanish]);

  const fetchAudit = async () => {
    setLoading(true);
    setPageError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const email = user.email?.toLowerCase() || "";
    setViewerEmail(email);

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setViewerProfile(profile || null);

    const computedAccess =
      email === OWNER_EMAIL ||
      ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(profile?.admin_level, email));

    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("admin_audit_events").select("*").order("created_at", { ascending: false }).limit(250);
    if (error) {
      if (isMissingColumnError(error)) {
        setPageError(
          isSpanish
            ? "La tabla de auditoría todavía no existe en Supabase. Corre el archivo SQL actualizado para activar esta página."
            : "The audit table does not exist in Supabase yet. Run the updated SQL file to activate this page."
        );
      } else {
        setPageError(error.message || (isSpanish ? "No pude cargar la auditoría." : "I could not load the audit log."));
      }
      setEvents([]);
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    setEvents((data || []) as AdminAuditEvent[]);
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  if (!sessionChecked || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{isSpanish ? "Cargando auditoría..." : "Loading audit log..."}</div>
      </div>
    );
  }

  if (!viewerEmail) {
    window.location.href = "/login";
    return null;
  }

  if (!hasAdminAccess) {
    window.location.href = "/admin";
    return null;
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .audit-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: radial-gradient(circle at top, rgba(59,130,246,0.08), transparent 30%), #F5F7FB; }
        .audit-topbar { background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 14px; position: sticky; top: 0; z-index: 100; }
        .audit-body { width: 100%; max-width: 1080px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { height: 42px; padding: 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 152px; height: 42px; padding: 0 36px 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; }
        .menu-panel { display: none; }
        .hero, .card { background: white; border-radius: 22px; padding: 22px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .hero { background: linear-gradient(135deg, #111827 0%, #1E3A8A 100%); color: white; margin-bottom: 16px; }
        .hero h1 { margin: 0 0 8px; font-size: 34px; }
        .hero p { margin: 0; color: rgba(255,255,255,0.86); line-height: 1.6; }
        .toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; margin-top: 16px; }
        .line-input { width: 100%; padding: 14px 16px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 15px; font-family: inherit; color: #111827; outline: none; font-weight: 600; }
        .filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip { padding: 10px 13px; border-radius: 999px; border: 1px solid #DCE7F5; background: #F8FBFF; color: #334155; font-size: 13px; font-weight: 800; cursor: pointer; }
        .chip.active { background: #1D4ED8; color: white; border-color: #1D4ED8; }
        .card-title { font-size: 24px; font-weight: 900; color: #111827; margin: 0 0 8px; }
        .muted { color: #6B7280; font-size: 14px; line-height: 1.6; }
        .events { display: grid; gap: 12px; margin-top: 16px; }
        .event-row { display: grid; gap: 10px; padding: 16px; border-radius: 18px; background: #F8FAFC; border: 1px solid #E7EEF7; }
        .event-meta { display: flex; gap: 8px; flex-wrap: wrap; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; background: #EFF6FF; color: #1D4ED8; }
        .toast { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 14px; font-weight: 800; background: #FFF1F2; color: #E11D48; }
        @media (max-width: 760px) {
          .audit-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; }
          .topbar-actions { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-btn,
          .menu-panel .topbar-select { width: 100%; }
          .toolbar { grid-template-columns: 1fr; }
          .hero h1 { font-size: 28px; }
        }
      `}</style>

      <div className="audit-shell">
        <div className="audit-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{isSpanish ? "Auditoría" : "Audit log"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>{isSpanish ? "Quién hizo qué, cuándo y sobre qué expediente" : "Who did what, when, and on which record"}</p>
          </div>
          <div className="topbar-actions">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin")}>{isSpanish ? "← Volver" : "← Back"}</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/papelera")}>{isSpanish ? "Papelera" : "Trash"}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{isSpanish ? "Portal" : "Portal"}</button>
          </div>
          <button className="menu-btn" onClick={() => setMobileMenuOpen((prev) => !prev)} aria-label={isSpanish ? "Abrir menú" : "Open menu"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="menu-panel">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin")}>{isSpanish ? "← Volver" : "← Back"}</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/papelera")}>{isSpanish ? "Papelera" : "Trash"}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{isSpanish ? "Portal" : "Portal"}</button>
          </div>
        )}

        <div className="audit-body">
          <section className="hero">
            <h1>{isSpanish ? "Todo queda registrado" : "Everything is recorded"}</h1>
            <p>
              {isSpanish
                ? "Aquí puedes revisar cambios importantes del panel: ediciones del paciente, cambios de estado, permisos del personal y acciones relacionadas con los expedientes."
                : "Here you can review important admin changes: patient edits, status changes, staff permissions, and record-related actions."}
            </p>
            <div className="toolbar">
              <input
                className="line-input"
                placeholder={isSpanish ? "Buscar por persona, expediente o acción..." : "Search by person, record, or action..."}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="filters">
                {(["all", "patient", "staff", "system"] as AuditFilter[]).map((option) => (
                  <button key={option} className={`chip${filter === option ? " active" : ""}`} onClick={() => setFilter(option)}>
                    {filterText(option)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <p className="card-title">{isSpanish ? "Eventos recientes" : "Recent events"}</p>
            <p className="muted">
              {isSpanish
                ? "La bitácora muestra quién hizo el cambio, cuándo ocurrió y qué expediente o persona estuvo involucrada."
                : "The log shows who made the change, when it happened, and which record or person was involved."}
            </p>

            <div className="events">
              {filteredEvents.length === 0 ? (
                <div className="event-row">
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
                    {isSpanish ? "Todavía no hay eventos para mostrar." : "There are no events to show yet."}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    {isSpanish
                      ? "Si ya hiciste cambios y aquí sigue vacío, probablemente falta correr la actualización de Supabase para activar la tabla de auditoría."
                      : "If you already made changes and this is still empty, the Supabase update for the audit table probably still needs to be run."}
                  </p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div key={event.id} className="event-row">
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#111827" }}>{actionText(event.action)}</p>
                        <p className="muted" style={{ margin: "6px 0 0" }}>
                          {event.actor_name || (isSpanish ? "Sin nombre" : "No name")} · {event.actor_email || (isSpanish ? "Sin correo" : "No email")}
                        </p>
                      </div>
                      <span className="badge">{formatDateTime(event.created_at)}</span>
                    </div>
                    <div className="event-meta">
                      {event.entity_name && <span className="badge">{event.entity_name}</span>}
                      {event.entity_type && <span className="badge">{event.entity_type}</span>}
                    </div>
                    {event.notes && <p className="muted" style={{ margin: 0 }}>{event.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {pageError && <div className="toast">⚠️ {pageError}</div>}
        {successMsg && <div className="toast" style={{ background: "#EDFAF1", color: "#15803D" }}>✅ {successMsg}</div>}
      </div>
    </>
  );
}
