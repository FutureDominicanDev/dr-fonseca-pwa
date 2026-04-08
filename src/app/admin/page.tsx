"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  OWNER_EMAIL,
  adminColor,
  adminLabel,
  buildExportHtml,
  buildPatientBundles,
  downloadFile,
  formatDate,
  initials,
  isMissingColumnError,
  normalizeAdminLevel,
  normalizeOffice,
  normalizeRecordStatus,
  officeLabel,
  recordStatusColor,
  recordStatusLabel,
  roleColor,
  roleLabel,
  sanitizeFileName,
  type AdminLevel,
  type MessageRecord,
  type Office,
  type OfficeFilter,
  type PatientRecord,
  type PatientRecordStatus,
  type ProcedureRecord,
  type RoomRecord,
  type StaffProfile,
} from "@/lib/adminPortal";

type PatientCard = {
  patient: PatientRecord;
  procedures: ProcedureRecord[];
  rooms: RoomRecord[];
  offices: Office[];
  recordStatus: PatientRecordStatus;
  latestSurgery: string;
  matchesSearch: boolean;
};

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function AdminPage() {
  const { lang, setLang, isSpanish } = useAdminLang();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState<OfficeFilter>("Todas");
  const [recordFilter, setRecordFilter] = useState<PatientRecordStatus>("active");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = viewerEmail.toLowerCase() === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(viewerAdminLevel);
  const canManageAdmins = viewerAdminLevel === "owner" || viewerAdminLevel === "super_admin";
  const canManageOwner = viewerEmail.toLowerCase() === OWNER_EMAIL || viewerAdminLevel === "owner";

  const officeText = (office: OfficeFilter | Office) => {
    if (office === "Todas") return isSpanish ? "🏥 Todas las sedes" : "🏥 All offices";
    if (office === "Guadalajara") return "📍 Guadalajara";
    if (office === "Tijuana") return "📍 Tijuana";
    return isSpanish ? "📍 Sin sede" : "📍 No office";
  };

  const roleText = (role: string | null | undefined) =>
    isSpanish
      ? roleLabel(role)
      : (
          {
            doctor: "👨‍⚕️ Doctor",
            enfermeria: "💉 Nursing",
            coordinacion: "📋 Coordination",
            post_quirofano: "🏥 Post-Op",
            staff: "👤 Staff",
            patient: "🧑 Patient",
            system: "⚙️ System",
          } as Record<string, string>
        )[role || ""] || "👤 Staff";

  const adminText = (level: AdminLevel) =>
    isSpanish
      ? adminLabel(level)
      : (
          {
            owner: "👑 Full access",
            super_admin: "⭐ Advanced admin",
            admin: "🛡️ Admin",
            none: "No admin",
          } as const
        )[level];

  const recordText = (value: PatientRecordStatus) =>
    isSpanish
      ? recordStatusLabel(value)
      : (
          {
            active: "🟢 Active",
            archived: "🗂️ Archived",
            trash: "🗑️ Trash",
          } as const
        )[value];

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);

  const patientCards = useMemo<PatientCard[]>(() => {
    const normalizedSearch = patientSearch.trim().toLowerCase();

    return patients
      .map((patient) => {
        const patientProcedures = procedures.filter((procedure) => procedure.patient_id === patient.id);
        const patientProcedureIds = new Set(patientProcedures.map((procedure) => procedure.id));
        const patientRooms = rooms.filter((room) => patientProcedureIds.has(room.procedure_id || ""));
        const offices = [...new Set(patientProcedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))] as Office[];

        const haystack = [
          patient.full_name,
          patient.phone,
          patient.email,
          ...patientProcedures.map((procedure) => procedure.procedure_name || ""),
          ...offices,
        ]
          .join(" ")
          .toLowerCase();

        return {
          patient,
          procedures: patientProcedures,
          rooms: patientRooms,
          offices,
          recordStatus: normalizeRecordStatus(patient.record_status),
          latestSurgery:
            patientProcedures
              .map((procedure) => procedure.surgery_date)
              .filter(Boolean)
              .sort()
              .reverse()[0] || "",
          matchesSearch: !normalizedSearch || haystack.includes(normalizedSearch),
        };
      })
      .filter((card) => (officeFilter === "Todas" ? true : card.offices.includes(officeFilter)))
      .filter((card) => card.recordStatus === recordFilter)
      .filter((card) => card.matchesSearch)
      .sort((a, b) => (a.patient.full_name || "").localeCompare(b.patient.full_name || "", "es"));
  }, [officeFilter, patientSearch, patients, procedures, recordFilter, rooms]);

  const officeCounts = useMemo(() => {
    return procedures.reduce(
      (counts, procedure) => {
        const office = normalizeOffice(procedure.office_location);
        if (office) counts[office] += 1;
        return counts;
      },
      { Guadalajara: 0, Tijuana: 0 }
    );
  }, [procedures]);

  const recordCounts = useMemo(() => {
    return patients.reduce(
      (counts, patient) => {
        counts[normalizeRecordStatus(patient.record_status)] += 1;
        return counts;
      },
      { active: 0, archived: 0, trash: 0 }
    );
  }, [patients]);

  const hasActiveSearch = patientSearch.trim().length > 0 || officeFilter !== "Todas" || recordFilter !== "active";
  const visiblePatientCards = hasActiveSearch ? patientCards.slice(0, 12) : [];
  const hiddenPatientCount = Math.max(0, patientCards.length - visiblePatientCards.length);

  const updateSuccess = (message: string) => {
    setPageError("");
    setSuccessMsg(message);
    window.clearTimeout((window as any).__adminToastTimer);
    (window as any).__adminToastTimer = window.setTimeout(() => setSuccessMsg(""), 3200);
  };

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
  };

  const fetchData = async () => {
    setPageError("");

    const [staffRes, patientsRes, proceduresRes, roomsRes, inviteRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("procedures").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle(),
    ]);

    const issues = [
      staffRes.error ? "No pude cargar el equipo." : "",
      patientsRes.error ? "No pude cargar los pacientes." : "",
      proceduresRes.error ? "No pude cargar los procedimientos." : "",
      roomsRes.error ? "No pude cargar las salas." : "",
      inviteRes.error ? "No pude cargar el código de invitación." : "",
    ].filter(Boolean);

    setStaff((staffRes.data || []) as StaffProfile[]);
    setPatients((patientsRes.data || []) as PatientRecord[]);
    setProcedures((proceduresRes.data || []) as ProcedureRecord[]);
    setRooms((roomsRes.data || []) as RoomRecord[]);
    setInviteCode((inviteRes.data?.value as string) || "");

    if (issues.length > 0) setPageError(issues.join(" "));
  };

  const bootstrap = async () => {
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
    setViewerId(user.id);

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setViewerProfile(profile || null);

    if (email === OWNER_EMAIL) {
      const { error } = await supabase.from("profiles").update({ admin_level: "owner" }).eq("id", user.id);
      if (!error) {
        setViewerProfile((prev) => ({ ...(prev || { id: user.id }), admin_level: "owner" }));
      }
    }

    const computedAccess = email === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(profile?.admin_level, email));
    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    await fetchData();
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    updateSuccess("Datos actualizados.");
  };

  const updateStaffField = async (member: StaffProfile, payload: Partial<StaffProfile>, success: string) => {
    setSavingKey(`${member.id}-${Object.keys(payload).join("-")}`);
    const { error } = await supabase.from("profiles").update(payload).eq("id", member.id);
    setSavingKey("");

    if (error) {
      if (isMissingColumnError(error)) {
        setPageError("Falta completar la configuración inicial del portal para guardar sedes y permisos avanzados.");
        return;
      }
      setPageError(error.message || "No pude guardar el cambio.");
      return;
    }

    setStaff((previous) => previous.map((item) => (item.id === member.id ? { ...item, ...payload } : item)));
    updateSuccess(success);
  };

  const saveInviteCode = async () => {
    if (!newInviteCode.trim()) return;
    setSavingCode(true);
    const nextCode = newInviteCode.trim().toUpperCase();
    const { error } = await supabase
      .from("app_settings")
      .update({ value: nextCode, updated_at: new Date().toISOString() })
      .eq("key", "invite_code");
    setSavingCode(false);

    if (error) {
      setPageError(error.message || "No pude cambiar el código.");
      return;
    }

    setInviteCode(nextCode);
    setNewInviteCode("");
    updateSuccess(isSpanish ? "Código de invitación actualizado." : "Invitation code updated.");
  };

  const deleteStaff = async (member: StaffProfile) => {
    const name = member.full_name || "este usuario";
    if (!confirm(isSpanish ? `¿Eliminar la cuenta de ${name}?\n\nEsta acción solo borra el perfil visible en el portal.` : `Delete ${name}'s account?\n\nThis only removes the visible profile from the portal.`)) return;
    setDeletingId(member.id);
    const { error } = await supabase.from("profiles").delete().eq("id", member.id);
    setDeletingId(null);

    if (error) {
      setPageError(error.message || "No pude eliminar la cuenta.");
      return;
    }

    setStaff((previous) => previous.filter((item) => item.id !== member.id));
    updateSuccess(`Cuenta de ${name} eliminada.`);
  };

  const exportPatients = async (mode: "filtered" | "single", patientId?: string) => {
    const selectedPatientIds = mode === "single" && patientId ? [patientId] : patientCards.map((card) => card.patient.id);

    if (selectedPatientIds.length === 0) {
      setPageError("No hay pacientes para exportar con ese filtro.");
      return;
    }

    const exportKey = mode === "single" && patientId ? `patient-${patientId}` : "filtered";
    setExportingKey(exportKey);

    try {
      const selectedProcedures = procedures.filter((procedure) => selectedPatientIds.includes(procedure.patient_id || ""));
      const selectedProcedureIds = new Set(selectedProcedures.map((procedure) => procedure.id));
      const selectedRooms = rooms.filter((room) => selectedProcedureIds.has(room.procedure_id || ""));
      const roomIds = selectedRooms.map((room) => room.id);

      let messages: MessageRecord[] = [];
      if (roomIds.length > 0) {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .in("room_id", roomIds)
          .order("created_at", { ascending: true });

        if (error) throw error;
        messages = (data || []) as MessageRecord[];
      }

      const bundles = buildPatientBundles({
        patientIds: selectedPatientIds,
        patients,
        procedures,
        rooms,
        messages,
      });

      const firstPatient = bundles[0]?.patient.full_name || "paciente";
      const title =
        mode === "single" && patientId
          ? `Expediente exportado · ${firstPatient}`
          : `Exportación filtrada de pacientes (${bundles.length})`;
      const subtitle =
        mode === "single" && patientId
          ? "Incluye procedimientos, sedes, salas, mensajes y archivos relacionados."
          : `Filtro aplicado: ${officeFilter}${patientSearch.trim() ? ` · Búsqueda: ${patientSearch.trim()}` : ""}`;
      const html = buildExportHtml({
        title,
        subtitle,
        bundles,
        staffById,
        generatedBy: viewerProfile?.full_name || viewerEmail,
      });
      const filename =
        mode === "single" && patientId
          ? `expediente-${sanitizeFileName(firstPatient || "paciente")}.html`
          : `pacientes-filtrados-${sanitizeFileName(officeFilter === "Todas" ? "todas-las-sedes" : officeFilter)}-${new Date().toISOString().slice(0, 10)}.html`;
      downloadFile(filename, html, "text/html;charset=utf-8");
      updateSuccess(mode === "single" ? `Expediente de ${firstPatient} descargado.` : "Resultados descargados.");
    } catch (error: any) {
      setPageError(error?.message || "No pude exportar los pacientes.");
    } finally {
      setExportingKey("");
    }
  };

  if (!sessionChecked || loading) {
    return (
      <>
        <style>{`
          .admin-loading-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #0F172A 0%, #111827 45%, #1D4ED8 100%); padding: 24px; }
          .admin-loading-card { width: 100%; max-width: 420px; background: white; border-radius: 26px; padding: 32px 28px; text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.35); }
          .spinner { width: 38px; height: 38px; border: 3px solid rgba(0,122,255,0.18); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 18px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="admin-loading-page">
          <div className="admin-loading-card">
            <div className="spinner" />
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Preparando centro de control</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6 }}>Estoy cargando pacientes, equipo y configuración del portal.</p>
          </div>
        </div>
      </>
    );
  }

  if (!viewerId) {
    return (
      <>
        <style>{`
          .blocked-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #111827 0%, #1F2937 50%, #111827 100%); padding: 24px; }
          .blocked-card { width: 100%; max-width: 460px; background: white; border-radius: 26px; padding: 34px 28px; text-align: center; box-shadow: 0 28px 80px rgba(0,0,0,0.4); }
          .main-btn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 14px; }
          .ghost-btn { width: 100%; padding: 15px; background: #F3F4F6; border: none; border-radius: 14px; color: #111827; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 10px; }
        `}</style>
        <div className="blocked-page">
          <div className="blocked-card">
            <div style={{ fontSize: 56, marginBottom: 10 }}>🔐</div>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Inicia sesión primero</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7 }}>Este centro de control usa la misma sesión real del portal. Entra con tu cuenta y vuelve a abrir esta pantalla.</p>
            <button className="main-btn" onClick={() => (window.location.href = "/login")}>Ir a login</button>
            <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Abrir portal</button>
          </div>
        </div>
      </>
    );
  }

  if (!hasAdminAccess) {
    return (
      <>
        <style>{`
          .blocked-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #111827 0%, #1F2937 50%, #111827 100%); padding: 24px; }
          .blocked-card { width: 100%; max-width: 480px; background: white; border-radius: 26px; padding: 34px 28px; text-align: center; box-shadow: 0 28px 80px rgba(0,0,0,0.4); }
          .main-btn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 14px; }
        `}</style>
        <div className="blocked-page">
          <div className="blocked-card">
            <div style={{ fontSize: 56, marginBottom: 10 }}>⛔</div>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Tu cuenta no tiene acceso</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7 }}>Esta cuenta puede usar el portal, pero todavía no tiene permisos para entrar al centro de control.</p>
            <button className="main-btn" onClick={() => (window.location.href = "/inbox")}>{isSpanish ? "Volver al portal" : "Back to portal"}</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .admin-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: radial-gradient(circle at top, rgba(59,130,246,0.10), transparent 26%), #F5F7FB; }
        .admin-topbar { background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 14px; position: sticky; top: 0; z-index: 100; }
        .admin-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-title { min-width: 0; }
        .topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { padding: 10px 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 152px; padding: 10px 36px 10px 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px); background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 44px; height: 44px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #111827 0%, #1D4ED8 100%); color: white; border-radius: 28px; padding: 24px; margin-bottom: 18px; box-shadow: 0 18px 45px rgba(29,78,216,0.18); }
        .hero-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 18px; align-items: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin: 18px 0; }
        .stat-card, .card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .section-title { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .subtle { color: rgba(255,255,255,0.84); line-height: 1.6; font-size: 15px; }
        .quick-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .hero-link { padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: white; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .line-input { width: 100%; padding: 14px 16px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 15px; font-family: inherit; color: #111827; outline: none; font-weight: 600; }
        .line-input:focus { border-color: rgba(0,122,255,0.5); background: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 380px; gap: 16px; align-items: start; }
        .stack { display: grid; gap: 16px; align-content: start; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        .staff-row, .patient-row { display: flex; gap: 14px; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #EEF2F7; }
        .staff-row:last-child, .patient-row:last-child { border-bottom: none; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#111827,#1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-right: 6px; margin-top: 8px; }
        .mini-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .mini-btn { padding: 9px 12px; border-radius: 12px; border: none; cursor: pointer; font-size: 12px; font-weight: 800; font-family: inherit; transition: transform 0.15s ease, background 0.15s ease; }
        .mini-btn:disabled { cursor: not-allowed; }
        .mini-btn:not(:disabled):hover { transform: translateY(-1px); }
        .export-card { background: linear-gradient(135deg, #F8FBFF, #EFF6FF); border: 1px solid #DBEAFE; border-radius: 18px; padding: 16px; }
        .empty-state { text-align: center; padding: 32px 16px; color: #6B7280; border: 1px dashed #D6E0EB; border-radius: 18px; background: #FAFCFF; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #6B7280; font-size: 14px; line-height: 1.6; }
        .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .card-title { font-size: 22px; font-weight: 900; color: #111827; margin: 0 0 6px; }
        .helper-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .small-note { font-size: 12px; color: #64748B; line-height: 1.5; }
        .setting-group { margin-top: 12px; }
        .group-label { font-size: 12px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; }
        .toast-stack { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
        .toast { border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 14px; font-weight: 800; line-height: 1.5; }
        .toast.error { background: #FFF1F2; color: #E11D48; }
        .toast.success { background: #EDFAF1; color: #15803D; }
        .result-count { font-size: 13px; color: #64748B; font-weight: 700; }
        .inline-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        @media (max-width: 980px) {
          .hero-grid, .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 560px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .admin-topbar { position: static; padding-bottom: 10px; align-items: center; }
          .topbar-right { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-select,
          .menu-panel .topbar-btn { width: 100%; }
          .topbar-btn { text-align: center; padding: 12px 12px; font-size: 13px; }
          .hero { padding: 18px; border-radius: 24px; }
          .big-title { font-size: 24px; line-height: 1.08; }
          .subtle { font-size: 14px; }
          .quick-links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .quick-links .hero-link:last-child { grid-column: 1 / -1; }
          .hero-link { width: 100%; text-align: center; padding: 10px 12px; font-size: 13px; }
          .patient-row, .staff-row { flex-direction: column; }
          .toast-stack { right: 12px; left: 12px; width: auto; }
          .header-row { flex-direction: column; }
        }
      `}</style>

      <div className="admin-shell">
        <div className="admin-topbar">
          <div className="topbar-title">
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{isSpanish ? "Centro de control" : "Control center"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>{isSpanish ? "Expedientes, equipo y accesos del portal" : "Records, team, and portal access"}</p>
          </div>
          <div className="topbar-right">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <div className="topbar-actions">
              <button className="topbar-btn" onClick={() => goTo("/admin/ayuda")}>{isSpanish ? "Ayuda" : "Help"}</button>
              <button className="topbar-btn" onClick={() => goTo("/inbox")}>{isSpanish ? "Volver al portal" : "Back to portal"}</button>
              <button className="topbar-btn" onClick={() => supabase.auth.signOut().then(() => goTo("/login"))}>{isSpanish ? "Salir" : "Sign out"}</button>
            </div>
          </div>
          <button
            className="menu-btn"
            aria-label={mobileMenuOpen ? (isSpanish ? "Cerrar menú" : "Close menu") : (isSpanish ? "Abrir menú" : "Open menu")}
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
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin/ayuda")}>{isSpanish ? "Ayuda" : "Help"}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{isSpanish ? "Volver al portal" : "Back to portal"}</button>
            <button className="topbar-btn" onClick={() => supabase.auth.signOut().then(() => goTo("/login"))}>{isSpanish ? "Salir" : "Sign out"}</button>
          </div>
        )}

        <div className="admin-body">
          <section className="hero">
            <div className="hero-grid">
              <div>
                <h1 className="big-title">{isSpanish ? "Busca, revisa y luego exporta" : "Search, review, then export"}</h1>
                <p className="subtle">
                  {isSpanish ? "Primero encuentra el expediente correcto. Después abre la ficha del paciente, revisa su historia completa y decide si quieres exportarla." : "First find the right record. Then open the patient file, review the full history, and decide whether to export it."}
                </p>
                <div className="quick-links">
                  <button className="hero-link" onClick={() => scrollToSection("expedientes")}>{isSpanish ? "📂 Buscar expediente" : "📂 Find record"}</button>
                  <button className="hero-link" onClick={() => scrollToSection("equipo")}>{isSpanish ? "👥 Equipo" : "👥 Team"}</button>
                  <button className="hero-link" onClick={() => (window.location.href = "/admin/ayuda")}>{isSpanish ? "❓ Ayuda" : "❓ Help"}</button>
                </div>
              </div>

              <div className="card" style={{ background: "rgba(255,255,255,0.12)", color: "white", boxShadow: "none" }}>
                <p className="section-title" style={{ color: "rgba(255,255,255,0.7)" }}>{isSpanish ? "Acciones rápidas" : "Quick actions"}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  <button className="main-btn" onClick={handleRefresh} disabled={refreshing}>
                    {refreshing ? (isSpanish ? "Actualizando..." : "Refreshing...") : (isSpanish ? "🔄 Actualizar datos" : "🔄 Refresh data")}
                  </button>
                  <button className="ghost-btn" style={{ background: "rgba(255,255,255,0.14)", color: "white" }} onClick={() => scrollToSection("expedientes")}>
                    {isSpanish ? "🔎 Ir a expedientes" : "🔎 Go to records"}
                  </button>
                  <button className="ghost-btn" style={{ background: "rgba(255,255,255,0.14)", color: "white" }} onClick={() => scrollToSection("equipo")}>
                    {isSpanish ? "👥 Ir al equipo" : "👥 Go to team"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <p className="section-title">{isSpanish ? "Equipo total" : "Total staff"}</p>
              <div className="value-display">{staff.length}</div>
              <p className="muted">{isSpanish ? "Usuarios visibles en el portal" : "Users visible in the portal"}</p>
            </div>
            <div className="stat-card">
              <p className="section-title">{isSpanish ? "Activos" : "Active"}</p>
              <div className="value-display">{recordCounts.active}</div>
              <p className="muted">{isSpanish ? "Expedientes en uso diario" : "Records in daily use"}</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Guadalajara</p>
              <div className="value-display">{officeCounts.Guadalajara}</div>
              <p className="muted">{isSpanish ? "Procedimientos en GDL" : "Procedures in GDL"}</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Tijuana</p>
              <div className="value-display">{officeCounts.Tijuana}</div>
              <p className="muted">{isSpanish ? "Procedimientos en TJN" : "Procedures in TJN"}</p>
            </div>
          </section>

          <div className="grid-2">
            <section className="card" id="expedientes">
              <div className="header-row">
                <div>
                  <p className="card-title">{isSpanish ? "Buscar expediente" : "Find record"}</p>
                  <p className="muted">{isSpanish ? "Escribe nombre, teléfono, correo, procedimiento o sede. Después abre el expediente para revisarlo con calma antes de exportar." : "Type a name, phone number, email, procedure, or office. Then open the record and review it before exporting."}</p>
                </div>
                <div className="inline-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setPatientSearch("");
                      setOfficeFilter("Todas");
                      setRecordFilter("active");
                    }}
                    disabled={!hasActiveSearch}
                  >
                    {isSpanish ? "Borrar" : "Clear"}
                  </button>
                  <button
                    className="main-btn"
                    onClick={() => exportPatients("filtered")}
                    disabled={!hasActiveSearch || patientCards.length === 0 || exportingKey === "filtered"}
                  >
                    {exportingKey === "filtered" ? (isSpanish ? "Exportando..." : "Exporting...") : (isSpanish ? "Descargar resultados" : "Download results")}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                <input
                  className="line-input"
                  placeholder={isSpanish ? "Buscar por nombre, teléfono, email, procedimiento o sede..." : "Search by name, phone, email, procedure, or office..."}
                  value={patientSearch}
                  onChange={(event) => setPatientSearch(event.target.value)}
                />
                <div className="pill-row">
                  {([
                    ["active", isSpanish ? `🟢 Activos (${recordCounts.active})` : `🟢 Active (${recordCounts.active})`],
                    ["archived", isSpanish ? `🗂️ Archivados (${recordCounts.archived})` : `🗂️ Archived (${recordCounts.archived})`],
                    ["trash", isSpanish ? `🗑️ Papelera (${recordCounts.trash})` : `🗑️ Trash (${recordCounts.trash})`],
                  ] as Array<[PatientRecordStatus, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      className={`hero-link${recordFilter === value ? " active" : ""}`}
                      style={{
                        background: recordFilter === value ? "#111827" : "#EFF3F8",
                        color: recordFilter === value ? "white" : "#111827",
                        borderColor: recordFilter === value ? "#111827" : "#D7E1EC",
                      }}
                      onClick={() => setRecordFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="helper-row">
                  <div className="pill-row">
                    {(["Todas", "Guadalajara", "Tijuana"] as OfficeFilter[]).map((option) => (
                      <button
                        key={option}
                        className={`hero-link${officeFilter === option ? " active" : ""}`}
                        style={{
                          background: officeFilter === option ? "#111827" : "#EFF3F8",
                          color: officeFilter === option ? "white" : "#111827",
                          borderColor: officeFilter === option ? "#111827" : "#D7E1EC",
                        }}
                        onClick={() => setOfficeFilter(option)}
                      >
                        {officeText(option)}
                      </button>
                    ))}
                  </div>
                  {hasActiveSearch && (
                    <span className="result-count">
                      {isSpanish ? `${patientCards.length} resultado(s)` : `${patientCards.length} result(s)`}
                    </span>
                  )}
                </div>
              </div>

              {!hasActiveSearch ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔎</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "Empieza con una búsqueda" : "Start with a search"}</p>
                  <p className="muted">{isSpanish ? "Busca por nombre, teléfono o sede. Si quieres revisar archivo o papelera, solo cambia el filtro de estado." : "Search by name, phone number, or office. If you want archived or trash records, just change the status filter."}</p>
                </div>
              ) : patientCards.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "No encontré expedientes con ese filtro" : "No records matched that filter"}</p>
                  <p className="muted">{isSpanish ? "Prueba cambiando la sede o usando menos palabras en la búsqueda." : "Try changing the office or using fewer words in the search."}</p>
                </div>
              ) : (
                <>
                  {hiddenPatientCount > 0 && (
                    <div className="export-card" style={{ marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>
                        {isSpanish ? `Mostrando ${visiblePatientCards.length} de ${patientCards.length} resultados.` : `Showing ${visiblePatientCards.length} of ${patientCards.length} results.`}
                      </p>
                      <p className="small-note" style={{ marginTop: 6 }}>
                        {isSpanish ? "Para ver menos resultados, agrega más detalle como teléfono, nombre completo o procedimiento." : "To narrow the list, add more detail like a phone number, full name, or procedure."}
                      </p>
                    </div>
                  )}

                  {visiblePatientCards.map((card) => (
                    <div key={card.patient.id} className="patient-row">
                      <div className="avatar">
                        {card.patient.profile_picture_url ? (
                          <img src={card.patient.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          initials(card.patient.full_name)
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{card.patient.full_name || (isSpanish ? "Paciente sin nombre" : "Unnamed patient")}</p>
                        <p className="muted">
                          {isSpanish ? "Tel" : "Phone"}: {card.patient.phone || (isSpanish ? "Sin teléfono" : "No phone")} · {isSpanish ? "Correo" : "Email"}: {card.patient.email || (isSpanish ? "Sin correo" : "No email")}
                        </p>
                        <p className="muted">
                          {card.procedures.length} {isSpanish ? "procedimiento(s)" : "procedure(s)"} · {card.rooms.length} {isSpanish ? "sala(s)" : "room(s)"} · {isSpanish ? "Última cirugía" : "Last surgery"}: {formatDate(card.latestSurgery)}
                        </p>
                        <div>
                          <span
                            className="meta-badge"
                            style={{ color: recordStatusColor(card.recordStatus), background: `${recordStatusColor(card.recordStatus)}18` }}
                          >
                            {recordText(card.recordStatus)}
                          </span>
                          {card.offices.length === 0 ? (
                            <span className="meta-badge" style={{ color: "#6B7280", background: "#F3F4F6" }}>{isSpanish ? "📍 Sin sede registrada" : "📍 No office assigned"}</span>
                          ) : (
                            card.offices.map((office) => (
                              <span key={`${card.patient.id}-${office}`} className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                {officeText(office)}
                              </span>
                            ))
                          )}
                          {card.procedures.slice(0, 2).map((procedure) => (
                            <span key={procedure.id} className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                              🩺 {procedure.procedure_name || (isSpanish ? "Procedimiento" : "Procedure")}
                            </span>
                          ))}
                        </div>
                        <div className="mini-actions">
                          <button className="main-btn" onClick={() => (window.location.href = `/admin/paciente/${card.patient.id}`)}>
                            {isSpanish ? "📂 Ver expediente" : "📂 Open record"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>

            <div className="stack">
              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Código de invitación" : "Invitation code"}</p>
                    <p className="muted">{isSpanish ? "Cámbialo si quieres detener nuevos registros con el código actual." : "Change it if you want to stop new registrations using the current code."}</p>
                  </div>
                </div>

                <div className="export-card" style={{ marginBottom: 14 }}>
                  <p className="section-title">{isSpanish ? "Código actual" : "Current code"}</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: "#1D4ED8", letterSpacing: "0.12em", margin: 0, wordBreak: "break-word" }}>{inviteCode || "SIN CÓDIGO"}</p>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    className="line-input"
                    value={newInviteCode}
                    onChange={(event) => setNewInviteCode(event.target.value.toUpperCase())}
                    placeholder={isSpanish ? "Nuevo código..." : "New code..."}
                  />
                  <div className="inline-actions">
                    <button className="main-btn" onClick={saveInviteCode} disabled={savingCode || !newInviteCode.trim()}>
                      {savingCode ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar" : "Save")}
                    </button>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Guía rápida" : "Quick guide"}</p>
                    <p className="muted">{isSpanish ? "Solo lo esencial para moverte rápido y sin dudas." : "Only the essentials so you can move quickly without guessing."}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="export-card">
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{isSpanish ? "1. Busca" : "1. Search"}</p>
                    <p className="muted">{isSpanish ? "Filtra por sede o escribe nombre, teléfono, correo o procedimiento." : "Filter by office or type a name, phone number, email, or procedure."}</p>
                  </div>
                  <div className="export-card">
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{isSpanish ? "2. Revisa" : "2. Review"}</p>
                    <p className="muted">{isSpanish ? "Abre el expediente del paciente y revisa historia, medios y cronología completa." : "Open the patient record and review the history, media, and full timeline."}</p>
                  </div>
                  <div className="export-card">
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>3. Decide</p>
                    <p className="muted">{isSpanish ? "Si todo está correcto, exporta ese expediente o los resultados filtrados." : "If everything looks correct, export that record or the filtered results."}</p>
                  </div>
                </div>
                <div className="inline-actions" style={{ marginTop: 14 }}>
                  <button className="main-btn" onClick={() => (window.location.href = "/admin/ayuda")}>{isSpanish ? "Abrir ayuda" : "Open help"}</button>
                  <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>{isSpanish ? "Ir al portal" : "Go to portal"}</button>
                </div>
              </section>
            </div>
          </div>

          <section className="card" id="equipo" style={{ marginTop: 16 }}>
            <div className="header-row">
              <div>
                <p className="card-title">Equipo y permisos</p>
                <p className="muted">Aquí corriges la sede del equipo y decides quién también puede entrar al centro de control. Los cambios se guardan al instante y verás una confirmación en pantalla.</p>
              </div>
            </div>

            {staff.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Todavía no hay equipo</p>
                <p className="muted">Cuando se registren aparecerán aquí.</p>
              </div>
            ) : (
              staff.map((member) => {
                const memberEmail = member.id === viewerId ? viewerEmail : "";
                const level = normalizeAdminLevel(member.admin_level, memberEmail);
                const memberOffice = normalizeOffice(member.office_location);
                const canEditThisMember = canManageAdmins && !(level === "owner" && !canManageOwner);
                const accessKey = `${member.id}-admin_level`;
                const officeKey = `${member.id}-office_location`;

                return (
                  <div key={member.id} className="staff-row">
                    <div className="avatar">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        initials(member.full_name || member.display_name)
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{member.full_name || member.display_name || "Sin nombre"}</p>
                      <div>
                        <span className="meta-badge" style={{ color: roleColor(member.role), background: `${roleColor(member.role)}18` }}>{roleLabel(member.role)}</span>
                        <span className="meta-badge" style={{ color: adminColor(level), background: `${adminColor(level)}18` }}>{adminLabel(level)}</span>
                        <span className="meta-badge" style={{ color: memberOffice ? "#1D4ED8" : "#6B7280", background: memberOffice ? "#EFF6FF" : "#F3F4F6" }}>
                          {officeLabel(memberOffice)}
                        </span>
                      </div>

                      <div className="setting-group">
                        <p className="group-label">Sede del equipo</p>
                        <div className="mini-actions">
                          {(["Guadalajara", "Tijuana"] as Office[]).map((office) => (
                            <button
                              key={`${member.id}-${office}`}
                              className="mini-btn"
                              style={{
                                background: memberOffice === office ? "#DBEAFE" : "#EFF3F8",
                                color: memberOffice === office ? "#1D4ED8" : "#374151",
                                opacity: savingKey === officeKey ? 0.6 : 1,
                              }}
                              disabled={savingKey === officeKey}
                              onClick={() => updateStaffField(member, { office_location: office }, `Sede de ${member.full_name || "staff"} actualizada a ${office}.`)}
                            >
                              {office === "Guadalajara" ? "🏙️ Guadalajara" : "🌊 Tijuana"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="setting-group">
                        <p className="group-label">Acceso al centro de control</p>
                        <div className="mini-actions">
                          {(["none", "admin", "super_admin"] as AdminLevel[]).map((option) => (
                            <button
                              key={`${member.id}-${option}`}
                              className="mini-btn"
                              style={{
                                background: level === option ? `${adminColor(option)}18` : "#EFF3F8",
                                color: level === option ? adminColor(option) : "#374151",
                                opacity: !canEditThisMember || savingKey === accessKey ? 0.55 : 1,
                              }}
                              disabled={!canEditThisMember || savingKey === accessKey}
                              onClick={() => updateStaffField(member, { admin_level: option }, `Acceso de ${member.full_name || "staff"} actualizado a ${adminLabel(option)}.`)}
                            >
                              {adminLabel(option)}
                            </button>
                          ))}
                          {level === "owner" && (
                            <span className="meta-badge" style={{ color: adminColor("owner"), background: `${adminColor("owner")}18` }}>
                              Protegido
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="small-note" style={{ marginTop: 10 }}>
                        Estado actual: {memberOffice || "Sin sede"} · {adminLabel(level)}
                      </p>
                    </div>

                    <div style={{ display: "grid", gap: 8, minWidth: 132 }}>
                      <button
                        className="mini-btn"
                        style={{ background: "#FFF1F2", color: "#E11D48", opacity: !canManageAdmins || (level === "owner" && !canManageOwner) ? 0.45 : 1 }}
                        disabled={deletingId === member.id || !canManageAdmins || (level === "owner" && !canManageOwner)}
                        onClick={() => deleteStaff(member)}
                      >
                        {deletingId === member.id ? "Eliminando..." : "🗑️ Eliminar"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>

        <div className="toast-stack" aria-live="polite">
          {pageError && <div className="toast error">⚠️ {pageError}</div>}
          {successMsg && <div className="toast success">✅ {successMsg}</div>}
        </div>
      </div>
    </>
  );
}
