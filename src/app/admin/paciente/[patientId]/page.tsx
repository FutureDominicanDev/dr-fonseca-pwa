"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  OWNER_EMAIL,
  buildExportHtml,
  buildPatientBundles,
  downloadFile,
  formatDate,
  formatDateTime,
  getMediaEntries,
  getTimelineEntries,
  initials,
  messageReason,
  messageTypeLabel,
  normalizeAdminLevel,
  normalizeOffice,
  officeLabel,
  roleColor,
  roleLabel,
  sanitizeFileName,
  type MessageRecord,
  type PatientRecord,
  type ProcedureRecord,
  type RoomRecord,
  type StaffProfile,
} from "@/lib/adminPortal";

export default function AdminPatientRecordPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Array.isArray(params?.patientId) ? params.patientId[0] : params?.patientId || "";

  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = viewerEmail.toLowerCase() === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(viewerAdminLevel);
  const staffById = useMemo(() => new Map(staffProfiles.map((member) => [member.id, member])), [staffProfiles]);

  const bundle = useMemo(() => {
    if (!patient) return null;
    const bundles = buildPatientBundles({
      patientIds: [patient.id],
      patients: [patient],
      procedures,
      rooms,
      messages,
    });
    return bundles[0] || null;
  }, [messages, patient, procedures, rooms]);

  const timeline = useMemo(() => (bundle ? getTimelineEntries(bundle) : []), [bundle]);
  const media = useMemo(() => (bundle ? getMediaEntries(bundle) : { images: [], videos: [], audios: [], files: [] }), [bundle]);
  const offices = useMemo(() => {
    return [...new Set(procedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))];
  }, [procedures]);

  const updateSuccess = (message: string) => {
    setPageError("");
    setSuccessMsg(message);
    window.clearTimeout((window as any).__adminPatientToastTimer);
    (window as any).__adminPatientToastTimer = window.setTimeout(() => setSuccessMsg(""), 3200);
  };

  const fetchRecord = async () => {
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

    const computedAccess = email === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(profile?.admin_level, email));
    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data: patientData, error: patientError } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
    if (patientError || !patientData) {
      setPageError(patientError?.message || "No pude cargar este expediente.");
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data: procedureData, error: procedureError } = await supabase.from("procedures").select("*").eq("patient_id", patientId);
    if (procedureError) {
      setPageError(procedureError.message || "No pude cargar los procedimientos.");
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const nextProcedures = (procedureData || []) as ProcedureRecord[];
    const procedureIds = nextProcedures.map((procedure) => procedure.id);

    let nextRooms: RoomRecord[] = [];
    if (procedureIds.length > 0) {
      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").in("procedure_id", procedureIds).order("created_at", { ascending: true });
      if (roomError) {
        setPageError(roomError.message || "No pude cargar las salas.");
        setSessionChecked(true);
        setLoading(false);
        return;
      }
      nextRooms = (roomData || []) as RoomRecord[];
    }

    const roomIds = nextRooms.map((room) => room.id);
    let nextMessages: MessageRecord[] = [];
    if (roomIds.length > 0) {
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .in("room_id", roomIds)
        .order("created_at", { ascending: true });

      if (messageError) {
        setPageError(messageError.message || "No pude cargar el historial.");
        setSessionChecked(true);
        setLoading(false);
        return;
      }
      nextMessages = (messageData || []) as MessageRecord[];
    }

    const senderIds = [...new Set(nextMessages.map((message) => message.sender_id).filter(Boolean))] as string[];
    let nextStaff: StaffProfile[] = [];
    if (senderIds.length > 0) {
      const { data: staffData } = await supabase.from("profiles").select("*").in("id", senderIds);
      nextStaff = (staffData || []) as StaffProfile[];
    }

    setPatient(patientData as PatientRecord);
    setProcedures(nextProcedures);
    setRooms(nextRooms);
    setMessages(nextMessages);
    setStaffProfiles(nextStaff);
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) fetchRecord();
  }, [patientId]);

  const exportRecord = async () => {
    if (!bundle || !patient) return;
    setExporting(true);

    try {
      const html = buildExportHtml({
        title: `Expediente exportado · ${patient.full_name || "Paciente"}`,
        subtitle: "Incluye procedimientos, sedes, historial completo y medios relacionados.",
        bundles: [bundle],
        staffById,
        generatedBy: viewerProfile?.full_name || viewerEmail,
      });

      downloadFile(
        `expediente-${sanitizeFileName(patient.full_name || "paciente")}.html`,
        html,
        "text/html;charset=utf-8"
      );
      updateSuccess(`Expediente de ${patient.full_name || "Paciente"} descargado.`);
    } catch (error: any) {
      setPageError(error?.message || "No pude exportar este expediente.");
    } finally {
      setExporting(false);
    }
  };

  const renderTimelineBody = (entry: typeof timeline[number]) => {
    const { message } = entry;
    const cleanFileName = (message.file_name || "").replace(/^\[(MED|BEFORE)\]\s*/i, "");

    if (message.deleted_by_staff || message.deleted_by_patient) {
      return <p className="body-muted">Este mensaje fue marcado como eliminado, pero se mantiene en el historial.</p>;
    }

    if (message.message_type === "image" && message.content) {
      return (
        <div className="preview-wrap">
          <img src={message.content} alt="" className="media-preview image" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">Abrir imagen</a>
        </div>
      );
    }

    if (message.message_type === "video" && message.content) {
      return (
        <div className="preview-wrap">
          <video src={message.content} controls className="media-preview video" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">Abrir video</a>
        </div>
      );
    }

    if (message.message_type === "audio" && message.content) {
      return (
        <div className="preview-wrap">
          <audio src={message.content} controls style={{ width: "100%" }} />
          <p className="body-muted">{cleanFileName || "Audio del chat"}</p>
        </div>
      );
    }

    if (message.message_type === "file" && message.content) {
      return (
        <div className="preview-wrap">
          <p style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>{cleanFileName || "Archivo"}</p>
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">Abrir archivo</a>
        </div>
      );
    }

    return <p className="body-copy">{message.content || "Sin contenido"}</p>;
  };

  const renderMediaGroup = (
    title: string,
    entries: typeof media.images,
    emptyLabel: string
  ) => (
    <section className="media-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">{title}</p>
          <p className="section-sub">{entries.length} elemento(s)</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-mini">{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => {
            const senderProfile = entry.message.sender_id ? staffById.get(entry.message.sender_id) : null;
            const senderOffice =
              normalizeOffice(entry.message.sender_office) ||
              normalizeOffice(senderProfile?.office_location) ||
              normalizeOffice(entry.procedure.office_location) ||
              "";
            const cleanFileName = (entry.message.file_name || "").replace(/^\[(MED|BEFORE)\]\s*/i, "");

            return (
              <div key={entry.message.id} className="media-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{cleanFileName || messageTypeLabel(entry.message)}</p>
                  <p className="body-muted">
                    {entry.message.sender_name || "Sin nombre"} · {roleLabel(entry.message.sender_role || entry.message.sender_type || "staff")} · {senderOffice || "Sin sede"}
                  </p>
                  <p className="body-muted">{formatDateTime(entry.message.created_at)}</p>
                </div>
                {entry.message.content && (
                  <a href={entry.message.content} target="_blank" rel="noopener noreferrer" className="open-link">
                    Abrir
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  if (!sessionChecked || loading) {
    return (
      <>
        <style>{`
          .record-loading-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #0F172A 0%, #111827 45%, #1D4ED8 100%); padding: 24px; }
          .record-loading-card { width: 100%; max-width: 420px; background: white; border-radius: 26px; padding: 32px 28px; text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.35); }
          .spinner { width: 38px; height: 38px; border: 3px solid rgba(0,122,255,0.18); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 18px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="record-loading-page">
          <div className="record-loading-card">
            <div className="spinner" />
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Abriendo expediente</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6 }}>Estoy reuniendo procedimientos, salas, medios e historial completo del paciente.</p>
          </div>
        </div>
      </>
    );
  }

  if (!viewerEmail) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F5F7FB" }}>
        <div style={{ maxWidth: 460, background: "white", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>🔐</div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Inicia sesión primero</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>Este expediente solo se puede abrir desde una sesión administrativa activa.</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/login")}>Ir a login</button>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F5F7FB" }}>
        <div style={{ maxWidth: 460, background: "white", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>⛔</div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Sin acceso</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>Tu cuenta puede usar el portal, pero no tiene permisos para revisar expedientes administrativos.</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/inbox")}>Volver al portal</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .record-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: linear-gradient(180deg, #EEF4FF 0%, #F8FAFC 28%, #F5F7FB 100%); }
        .record-topbar { position: sticky; top: 0; z-index: 50; min-height: calc(74px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); }
        .record-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .hero { background: linear-gradient(135deg, #111827, #1D4ED8); color: white; border-radius: 28px; padding: 24px; box-shadow: 0 18px 45px rgba(29,78,216,0.16); margin-bottom: 18px; }
        .hero-grid, .grid-2, .grid-4 { display: grid; gap: 16px; }
        .hero-grid { grid-template-columns: 1.1fr 0.9fr; align-items: center; }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; }
        .card, .stat-card, .timeline-card, .media-card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .hero-copy { color: rgba(255,255,255,0.86); font-size: 15px; line-height: 1.6; }
        .section-kicker { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; }
        .section-sub { font-size: 14px; color: #64748B; margin: 0; line-height: 1.6; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #6B7280; font-size: 14px; line-height: 1.65; }
        .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .procedure-list { display: grid; gap: 12px; }
        .procedure-item { border: 1px solid #E5EDF6; border-radius: 16px; padding: 14px 16px; background: #FCFDFF; }
        .media-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #EEF2F7; }
        .media-item:last-child { border-bottom: none; padding-bottom: 0; }
        .empty-mini { border: 1px dashed #D6E0EB; border-radius: 16px; padding: 16px; text-align: center; color: #6B7280; background: #FAFCFF; }
        .open-link { display: inline-flex; align-items: center; justify-content: center; padding: 10px 12px; border-radius: 12px; background: #EFF6FF; color: #1D4ED8; font-weight: 800; text-decoration: none; white-space: nowrap; }
        .timeline-list { display: grid; gap: 14px; }
        .timeline-item { border: 1px solid #E5EDF6; border-radius: 18px; padding: 16px; background: #FCFDFF; }
        .timeline-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .body-copy { color: #111827; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word; }
        .body-muted { color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0; }
        .preview-wrap { display: grid; gap: 10px; }
        .media-preview { width: 100%; border-radius: 16px; background: #E5E7EB; }
        .media-preview.image { max-width: 340px; object-fit: cover; }
        .media-preview.video { max-width: 420px; }
        .toast-stack { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
        .toast { border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 14px; font-weight: 800; line-height: 1.5; }
        .toast.error { background: #FFF1F2; color: #E11D48; }
        .toast.success { background: #EDFAF1; color: #15803D; }
        @media (max-width: 980px) {
          .hero-grid, .grid-2, .grid-4 { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .record-topbar { align-items: flex-start; }
          .toast-stack { right: 12px; left: 12px; width: auto; }
          .timeline-top, .section-head, .media-item { flex-direction: column; }
        }
      `}</style>

      <div className="record-shell">
        <div className="record-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Expediente del paciente</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>Revisión completa antes de exportar</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={() => (window.location.href = "/admin")}>← Volver al centro</button>
            <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Ir al portal</button>
            <button className="main-btn" onClick={exportRecord} disabled={!bundle || exporting}>
              {exporting ? "Exportando..." : "📦 Exportar expediente"}
            </button>
          </div>
        </div>

        <div className="record-body">
          {!patient ? (
            <div className="card">
              <p className="section-kicker">Expediente no disponible</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 8 }}>No pude abrir este paciente</p>
              <p className="muted">Vuelve al centro de control para buscarlo de nuevo o intenta recargar la página.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button className="main-btn" onClick={() => (window.location.href = "/admin")}>Volver al centro</button>
                <button className="ghost-btn" onClick={fetchRecord}>Recargar</button>
              </div>
            </div>
          ) : (
            <>
              <section className="hero">
                <div className="hero-grid">
                  <div>
                    <h1 className="big-title">{patient.full_name || "Paciente sin nombre"}</h1>
                    <p className="hero-copy">
                      Aquí puedes revisar datos del paciente, procedimientos, medios y toda la cronología del chat antes de decidir si quieres exportar este expediente.
                    </p>
                    <div className="pill-row">
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ☎️ {patient.phone || "Sin teléfono"}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ✉️ {patient.email || "Sin correo"}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        🎂 {formatDate(patient.birthdate)}
                      </span>
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(255,255,255,0.12)", color: "white", boxShadow: "none" }}>
                    <p className="section-kicker" style={{ color: "rgba(255,255,255,0.72)" }}>Sedes relacionadas</p>
                    <div className="pill-row">
                      {offices.length > 0 ? (
                        offices.map((office) => (
                          <span key={office} className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>
                            {officeLabel(office)}
                          </span>
                        ))
                      ) : (
                        <span className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>📍 Sin sede</span>
                      )}
                    </div>
                    <p className="hero-copy" style={{ marginTop: 12 }}>
                      Abre primero esta vista para revisar el caso completo. Si todo está correcto, exporta desde el botón de arriba.
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid-4">
                <div className="stat-card">
                  <p className="section-kicker">Procedimientos</p>
                  <div className="value-display">{procedures.length}</div>
                  <p className="muted">Relacionados al paciente</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">Salas</p>
                  <div className="value-display">{rooms.length}</div>
                  <p className="muted">Chats o salas del expediente</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">Eventos</p>
                  <div className="value-display">{timeline.length}</div>
                  <p className="muted">Mensajes y archivos en historial</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">Medios</p>
                  <div className="value-display">{media.images.length + media.videos.length + media.audios.length + media.files.length}</div>
                  <p className="muted">Imágenes, videos, audios y archivos</p>
                </div>
              </section>

              <div className="grid-2">
                <section className="card">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">Ficha básica</p>
                      <p className="section-sub">Datos generales del paciente y resumen del caso.</p>
                    </div>
                  </div>
                  <div className="procedure-list">
                    <div className="procedure-item">
                      <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Datos del paciente</p>
                      <p className="muted">Nombre: {patient.full_name || "Sin nombre"}</p>
                      <p className="muted">Teléfono: {patient.phone || "Sin teléfono"}</p>
                      <p className="muted">Correo: {patient.email || "Sin correo"}</p>
                      <p className="muted">Nacimiento: {formatDate(patient.birthdate)}</p>
                    </div>
                    <div className="procedure-item">
                      <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Resumen rápido</p>
                      <p className="muted">Último evento registrado: {timeline.length ? formatDateTime(timeline[timeline.length - 1]?.message.created_at) : "Sin actividad"}</p>
                      <p className="muted">Primera sala creada: {rooms.length ? formatDateTime(rooms[0]?.created_at) : "Sin salas"}</p>
                    </div>
                  </div>
                </section>

                <section className="card">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">Procedimientos y sedes</p>
                      <p className="section-sub">Qué procedimiento está relacionado, en qué sede y cuántas salas tiene.</p>
                    </div>
                  </div>
                  <div className="procedure-list">
                    {procedures.length === 0 ? (
                      <div className="empty-mini">No hay procedimientos registrados para este paciente.</div>
                    ) : (
                      procedures.map((procedure) => {
                        const relatedRooms = rooms.filter((room) => room.procedure_id === procedure.id);
                        return (
                          <div key={procedure.id} className="procedure-item">
                            <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 6 }}>{procedure.procedure_name || "Procedimiento sin nombre"}</p>
                            <p className="muted">Sede: {procedure.office_location || "Sin sede"}</p>
                            <p className="muted">Cirugía: {formatDate(procedure.surgery_date)}</p>
                            <p className="muted">Estatus: {procedure.status || "Sin estatus"}</p>
                            <p className="muted">Salas relacionadas: {relatedRooms.length}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <section className="card" style={{ marginTop: 16 }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Media y archivos</p>
                    <p className="section-sub">Aquí está todo el material enviado y recibido dentro del chat del paciente.</p>
                  </div>
                </div>
                <div className="grid-2">
                  {renderMediaGroup("Imágenes", media.images, "No hay imágenes en el historial.")}
                  {renderMediaGroup("Videos", media.videos, "No hay videos en el historial.")}
                  {renderMediaGroup("Audios", media.audios, "No hay audios en el historial.")}
                  {renderMediaGroup("Archivos", media.files, "No hay archivos en el historial.")}
                </div>
              </section>

              <section className="card" style={{ marginTop: 16 }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Cronología completa</p>
                    <p className="section-sub">Qué pasó, quién escribió, cuándo ocurrió, desde qué sede y con qué procedimiento estaba relacionado.</p>
                  </div>
                </div>

                {timeline.length === 0 ? (
                  <div className="empty-mini">No hay historial registrado todavía.</div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((entry) => {
                      const senderProfile = entry.message.sender_id ? staffById.get(entry.message.sender_id) : null;
                      const senderOffice =
                        normalizeOffice(entry.message.sender_office) ||
                        normalizeOffice(senderProfile?.office_location) ||
                        normalizeOffice(entry.procedure.office_location) ||
                        "";

                      return (
                        <div key={entry.message.id} className="timeline-item">
                          <div className="timeline-top">
                            <div>
                              <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
                                {entry.message.sender_name || (entry.message.sender_type === "patient" ? patient.full_name || "Paciente" : "Staff")}
                              </p>
                              <div className="pill-row">
                                <span className="meta-badge" style={{ color: roleColor(entry.message.sender_role || entry.message.sender_type), background: `${roleColor(entry.message.sender_role || entry.message.sender_type)}18` }}>
                                  {roleLabel(entry.message.sender_role || entry.message.sender_type || "staff")}
                                </span>
                                <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                  {officeLabel(senderOffice)}
                                </span>
                                <span className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                                  {messageTypeLabel(entry.message)}
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p className="body-muted">{formatDateTime(entry.message.created_at)}</p>
                              <p className="body-muted">Sala: {entry.room.id.slice(0, 8)}</p>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 10 }}>
                            {renderTimelineBody(entry)}
                            <div style={{ borderTop: "1px solid #EEF2F7", paddingTop: 10 }}>
                              <p className="body-muted">Procedimiento: {entry.procedure.procedure_name || "Sin procedimiento"}</p>
                              <p className="body-muted">Motivo / contexto: {messageReason(entry.message, entry.procedure)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="toast-stack" aria-live="polite">
          {pageError && <div className="toast error">⚠️ {pageError}</div>}
          {successMsg && <div className="toast success">✅ {successMsg}</div>}
        </div>
      </div>
    </>
  );
}
