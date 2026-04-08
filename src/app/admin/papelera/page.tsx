"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  OWNER_EMAIL,
  formatDate,
  initials,
  isMissingColumnError,
  logAdminEvent,
  normalizeAdminLevel,
  normalizeRecordStatus,
  type PatientRecord,
  type PatientRecordStatus,
  type ProcedureRecord,
  type StaffProfile,
} from "@/lib/adminPortal";

type TrashView = "archived" | "trash";

export default function AdminTrashPage() {
  const { lang, setLang, isSpanish } = useAdminLang();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TrashView>("archived");
  const [savingId, setSavingId] = useState("");

  const hasAdminAccess =
    viewerEmail.toLowerCase() === OWNER_EMAIL ||
    ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail));

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
  };

  const updateSuccess = (message: string) => {
    setPageError("");
    setSuccessMsg(message);
    window.clearTimeout((window as any).__trashToastTimer);
    (window as any).__trashToastTimer = window.setTimeout(() => setSuccessMsg(""), 3200);
  };

  const visiblePatients = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return patients
      .filter((patient) => normalizeRecordStatus(patient.record_status) === view)
      .filter((patient) => {
        const relatedProcedures = procedures.filter((procedure) => procedure.patient_id === patient.id);
        const haystack = [patient.full_name, patient.phone, patient.email, ...relatedProcedures.map((procedure) => procedure.procedure_name || "")].join(" ").toLowerCase();
        return !normalized || haystack.includes(normalized);
      });
  }, [patients, procedures, search, view]);

  const fetchData = async () => {
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

    const [patientsRes, proceduresRes] = await Promise.all([
      supabase.from("patients").select("*").in("record_status", ["archived", "trash"]).order("full_name"),
      supabase.from("procedures").select("*"),
    ]);

    if (patientsRes.error) {
      if (isMissingColumnError(patientsRes.error)) {
        setPageError(
          isSpanish
            ? "La configuración de papelera todavía no existe en Supabase. Corre el archivo SQL actualizado para activar esta página."
            : "The archive/trash setup does not exist in Supabase yet. Run the updated SQL file to activate this page."
        );
      } else {
        setPageError(patientsRes.error.message || (isSpanish ? "No pude cargar expedientes archivados." : "I could not load archived records."));
      }
      setPatients([]);
      setProcedures([]);
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    setPatients((patientsRes.data || []) as PatientRecord[]);
    setProcedures((proceduresRes.data || []) as ProcedureRecord[]);
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateStatus = async (patient: PatientRecord, nextStatus: PatientRecordStatus) => {
    setSavingId(patient.id);
    const { data, error } = await supabase
      .from("patients")
      .update({
        record_status: nextStatus,
        record_status_changed_at: new Date().toISOString(),
        record_status_changed_by: viewerProfile?.id || null,
      })
      .eq("id", patient.id)
      .select()
      .single();
    setSavingId("");

    if (error) {
      setPageError(error.message || (isSpanish ? "No pude mover este expediente." : "I could not move this record."));
      return;
    }

    setPatients((previous) =>
      previous
        .map((item) => (item.id === patient.id ? (data as PatientRecord) : item))
        .filter((item) => normalizeRecordStatus(item.record_status) !== "active")
    );
    await logAdminEvent({
      action: "record_status_changed",
      entityType: "patient",
      entityId: patient.id,
      entityName: patient.full_name || "Paciente",
      patientId: patient.id,
      actorId: viewerProfile?.id || null,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: `Estado cambiado a ${nextStatus}.`,
      metadata: { next_status: nextStatus },
    });
    updateSuccess(
      nextStatus === "active"
        ? isSpanish
          ? "Expediente restaurado como activo."
          : "Record restored as active."
        : nextStatus === "archived"
          ? isSpanish
            ? "Expediente archivado."
            : "Record archived."
          : isSpanish
            ? "Expediente enviado a papelera."
            : "Record moved to trash."
    );
  };

  if (!sessionChecked || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{isSpanish ? "Cargando archivo y papelera..." : "Loading archive and trash..."}</div>
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
        .trash-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: radial-gradient(circle at top, rgba(59,130,246,0.08), transparent 30%), #F5F7FB; }
        .trash-topbar { background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 14px; position: sticky; top: 0; z-index: 100; }
        .trash-body { width: 100%; max-width: 1080px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
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
        .records { display: grid; gap: 12px; margin-top: 16px; }
        .record-row { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid #EEF2F7; }
        .record-row:last-child { border-bottom: none; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#111827,#1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; background: #EFF6FF; color: #1D4ED8; margin-right: 6px; margin-top: 8px; }
        .mini-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .toast { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 14px; font-weight: 800; background: #FFF1F2; color: #E11D48; }
        @media (max-width: 760px) {
          .trash-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; }
          .topbar-actions { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-btn,
          .menu-panel .topbar-select { width: 100%; }
          .toolbar { grid-template-columns: 1fr; }
          .hero h1 { font-size: 28px; }
          .record-row { flex-direction: column; }
        }
      `}</style>

      <div className="trash-shell">
        <div className="trash-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{isSpanish ? "Papelera y archivo" : "Trash and archive"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>{isSpanish ? "Expedientes que ya no viven en la vista diaria" : "Records that no longer live in the daily view"}</p>
          </div>
          <div className="topbar-actions">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin")}>{isSpanish ? "← Volver" : "← Back"}</button>
            <button className="topbar-btn" onClick={() => goTo("/admin/auditoria")}>{isSpanish ? "Auditoría" : "Audit"}</button>
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
            <button className="topbar-btn" onClick={() => goTo("/admin/auditoria")}>{isSpanish ? "Auditoría" : "Audit"}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{isSpanish ? "Portal" : "Portal"}</button>
          </div>
        )}

        <div className="trash-body">
          <section className="hero">
            <h1>{isSpanish ? "Recupera expedientes sin perder el control" : "Recover records without losing control"}</h1>
            <p>
              {isSpanish
                ? "Aquí puedes revisar expedientes archivados o enviados a papelera, abrirlos de nuevo y restaurarlos cuando haga falta."
                : "Here you can review archived or trashed records, reopen them, and restore them when needed."}
            </p>
            <div className="toolbar">
              <input
                className="line-input"
                placeholder={isSpanish ? "Buscar por nombre, teléfono, correo o procedimiento..." : "Search by name, phone, email, or procedure..."}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="filters">
                <button className={`chip${view === "archived" ? " active" : ""}`} onClick={() => setView("archived")}>
                  {isSpanish ? "Archivados" : "Archived"}
                </button>
                <button className={`chip${view === "trash" ? " active" : ""}`} onClick={() => setView("trash")}>
                  {isSpanish ? "Papelera" : "Trash"}
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="card-title">{view === "archived" ? (isSpanish ? "Expedientes archivados" : "Archived records") : (isSpanish ? "Expedientes en papelera" : "Records in trash")}</p>
            <p className="muted">
              {view === "archived"
                ? (isSpanish ? "Los archivados siguen conservados y pueden volver a activo en cualquier momento." : "Archived records are still preserved and can become active again at any time.")
                : (isSpanish ? "La papelera es para expedientes que ya no quieres ver en la operación diaria, pero que todavía puedes recuperar." : "Trash is for records you no longer want in the daily workflow, but can still recover.")}
            </p>

            <div className="records">
              {visiblePatients.length === 0 ? (
                <div className="record-row">
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
                      {isSpanish ? "No encontré expedientes aquí." : "No records found here."}
                    </p>
                    <p className="muted" style={{ margin: "6px 0 0" }}>
                      {isSpanish ? "Prueba con otro nombre o cambia entre archivados y papelera." : "Try another name or switch between archived and trash."}
                    </p>
                  </div>
                </div>
              ) : (
                visiblePatients.map((patient) => {
                  const relatedProcedures = procedures.filter((procedure) => procedure.patient_id === patient.id);
                  return (
                    <div key={patient.id} className="record-row">
                      <div className="avatar">
                        {patient.profile_picture_url ? (
                          <img src={patient.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          initials(patient.full_name)
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>{patient.full_name || (isSpanish ? "Paciente sin nombre" : "Unnamed patient")}</p>
                        <p className="muted" style={{ margin: "6px 0 0" }}>
                          {patient.phone || (isSpanish ? "Sin teléfono" : "No phone")} · {patient.email || (isSpanish ? "Sin correo" : "No email")}
                        </p>
                        <div>
                          <span className="badge">{normalizeRecordStatus(patient.record_status) === "archived" ? (isSpanish ? "Archivado" : "Archived") : (isSpanish ? "Papelera" : "Trash")}</span>
                          {relatedProcedures.slice(0, 2).map((procedure) => (
                            <span key={procedure.id} className="badge">
                              {procedure.procedure_name || (isSpanish ? "Procedimiento" : "Procedure")} · {formatDate(procedure.surgery_date)}
                            </span>
                          ))}
                        </div>
                        <div className="mini-actions">
                          <button className="main-btn" onClick={() => goTo(`/admin/paciente/${patient.id}`)}>
                            {isSpanish ? "Abrir expediente" : "Open record"}
                          </button>
                          <button className="ghost-btn" onClick={() => updateStatus(patient, "active")} disabled={savingId === patient.id}>
                            {isSpanish ? "Restaurar" : "Restore"}
                          </button>
                          {view === "archived" && (
                            <button className="ghost-btn" onClick={() => updateStatus(patient, "trash")} disabled={savingId === patient.id}>
                              {isSpanish ? "Mover a papelera" : "Move to trash"}
                            </button>
                          )}
                          {view === "trash" && (
                            <button className="ghost-btn" onClick={() => updateStatus(patient, "archived")} disabled={savingId === patient.id}>
                              {isSpanish ? "Enviar a archivo" : "Move to archive"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
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
