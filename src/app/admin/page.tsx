"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  adminColor,
  adminLabel,
  formatDate,
  initials,
  isMissingColumnError,
  logAdminEvent,
  normalizeAdminLevel,
  normalizeOffice,
  normalizeRecordStatus,
  officeLabel,
  recordStatusColor,
  recordStatusLabel,
  roleColor,
  roleLabel,
  type AdminLevel,
  type Office,
  type PatientRecord,
  type PatientRecordStatus,
  type ProcedureRecord,
  type RoomRecord,
  type StaffProfile,
} from "@/lib/adminPortal";
import { isOwnerEmail } from "@/lib/securityConfig";

type PatientCard = {
  patient: PatientRecord;
  procedures: ProcedureRecord[];
  rooms: RoomRecord[];
  offices: Office[];
  recordStatus: PatientRecordStatus;
  latestSurgery: string;
  matchesSearch: boolean;
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
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [officePhoneGdl, setOfficePhoneGdl] = useState("");
  const [officePhoneTjn, setOfficePhoneTjn] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [savingPhones, setSavingPhones] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unblockBusyKey, setUnblockBusyKey] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = isOwnerEmail(viewerEmail);
  const canManageAdmins = isOwnerEmail(viewerEmail);
  const canManageOwner = isOwnerEmail(viewerEmail);

  const officeText = (office: Office) => {
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

  const parseSettingList = (value: unknown) => {
    if (typeof value !== "string") return [] as string[];
    return value
      .split(/[,\n;]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

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
      .filter((card) => card.matchesSearch)
      .sort((a, b) => (a.patient.full_name || "").localeCompare(b.patient.full_name || "", "es"));
  }, [patientSearch, patients, procedures, rooms]);

  const hasActiveSearch = patientSearch.trim().length > 0;
  const visiblePatientCards = hasActiveSearch ? patientCards.slice(0, 12) : [];
  const hiddenPatientCount = Math.max(0, patientCards.length - visiblePatientCards.length);
  const inviteLink = typeof window !== "undefined" && inviteCode
    ? `${window.location.origin}/register?code=${encodeURIComponent(inviteCode)}`
    : "";

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

  const scrollAdminToTop = () => {
    const shell = document.querySelector(".admin-shell");
    if (shell instanceof HTMLElement) {
      shell.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fetchData = async () => {
    setPageError("");

    const [staffRes, patientsRes, proceduresRes, roomsRes, inviteRes, blockedEmailsRes, blockedPhonesRes, gdlPhoneRes, tjnPhoneRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("procedures").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "office_phone_guadalajara").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "office_phone_tijuana").maybeSingle(),
    ]);

    const issues = [
      staffRes.error ? "No pude cargar el equipo." : "",
      patientsRes.error ? "No pude cargar los pacientes." : "",
      proceduresRes.error ? "No pude cargar los procedimientos." : "",
      roomsRes.error ? "No pude cargar las salas." : "",
      inviteRes.error ? "No pude cargar el código de invitación." : "",
      blockedEmailsRes.error ? "No pude cargar correos bloqueados." : "",
      blockedPhonesRes.error ? "No pude cargar teléfonos bloqueados." : "",
      gdlPhoneRes.error ? "No pude cargar el teléfono de Guadalajara." : "",
      tjnPhoneRes.error ? "No pude cargar el teléfono de Tijuana." : "",
    ].filter(Boolean);

    setStaff((staffRes.data || []) as StaffProfile[]);
    setPatients((patientsRes.data || []) as PatientRecord[]);
    setProcedures((proceduresRes.data || []) as ProcedureRecord[]);
    setRooms((roomsRes.data || []) as RoomRecord[]);
    setInviteCode((inviteRes.data?.value as string) || "");
    setBlockedEmails(parseSettingList(blockedEmailsRes.data?.value).map((item) => item.toLowerCase()));
    setBlockedPhones(parseSettingList(blockedPhonesRes.data?.value));
    setOfficePhoneGdl((gdlPhoneRes.data?.value as string) || "");
    setOfficePhoneTjn((tjnPhoneRes.data?.value as string) || "");

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

    if (isOwnerEmail(email)) {
      const { error } = await supabase.from("profiles").update({ admin_level: "owner" }).eq("id", user.id);
      if (!error) {
        setViewerProfile((prev) => ({ ...(prev || { id: user.id }), admin_level: "owner" }));
      }
    }

    const computedAccess = isOwnerEmail(email);
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
    await logAdminEvent({
      action: Object.prototype.hasOwnProperty.call(payload, "admin_level") ? "staff_admin_updated" : "staff_office_updated",
      entityType: "staff_profile",
      entityId: member.id,
      entityName: member.full_name || member.display_name || "Personal",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: success,
      metadata: payload,
    });
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
    await logAdminEvent({
      action: "invite_code_updated",
      entityType: "app_setting",
      entityId: "invite_code",
      entityName: "Código de invitación",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: `Código actualizado a ${nextCode}.`,
      metadata: { invite_code: nextCode },
    });
    updateSuccess(isSpanish ? "Código de invitación actualizado." : "Invitation code updated.");
  };

  const saveOfficePhones = async () => {
    setSavingPhones(true);
    const payload = [
      { key: "office_phone_guadalajara", value: officePhoneGdl.trim(), updated_at: new Date().toISOString() },
      { key: "office_phone_tijuana", value: officePhoneTjn.trim(), updated_at: new Date().toISOString() },
    ];
    const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
    setSavingPhones(false);
    if (error) {
      setPageError(error.message || "No pude guardar los teléfonos de sede.");
      return;
    }
    await logAdminEvent({
      action: "office_phone_settings_updated",
      entityType: "app_setting",
      entityId: "office_phone_settings",
      entityName: "Teléfonos de sede",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: isSpanish ? "Se actualizaron los teléfonos de Guadalajara y Tijuana." : "Guadalajara and Tijuana office phones were updated.",
      metadata: { office_phone_guadalajara: officePhoneGdl, office_phone_tijuana: officePhoneTjn },
    });
    updateSuccess(isSpanish ? "Teléfonos de sede actualizados." : "Office phone numbers updated.");
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    updateSuccess(isSpanish ? "Enlace de invitación copiado." : "Invitation link copied.");
  };

  const shareInviteLink = async () => {
    if (!inviteLink) return;
    const nav = navigator as Navigator & { share?: (data?: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: isSpanish ? "Invitación al portal" : "Portal invitation",
          text: isSpanish
            ? "Usa este enlace para registrarte en el portal del equipo."
            : "Use this link to register for the team portal.",
          url: inviteLink,
        });
        updateSuccess(isSpanish ? "Se abrió el menú para compartir el enlace." : "The share menu opened for the invitation link.");
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyInviteLink();
  };

  const deleteStaff = async (member: StaffProfile) => {
    const name = member.full_name || "este usuario";
    if (!confirm(isSpanish ? `¿Revocar y eliminar la cuenta de ${name}?\n\nEsto bloqueará su correo y rotará automáticamente el código de invitación por seguridad.` : `Revoke and remove ${name}'s account?\n\nThis will block their email and automatically rotate the invitation code for security.`)) return;
    setDeletingId(member.id);
    const response = await fetch("/api/staff/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setDeletingId(null);

    if (!response.ok) {
      setPageError(payload?.error || "No pude revocar la cuenta.");
      return;
    }

    setStaff((previous) => previous.filter((item) => item.id !== member.id));
    if (typeof payload?.newInviteCode === "string" && payload.newInviteCode.trim()) {
      setInviteCode(payload.newInviteCode.trim());
    }
    await logAdminEvent({
      action: "staff_revoked",
      entityType: "staff_auth_profile",
      entityId: member.id,
      entityName: member.full_name || member.display_name || "Personal",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: isSpanish ? `Cuenta revocada para ${name}.` : `Account revoked for ${name}.`,
      metadata: {
        blocked_email: payload?.removedEmail || null,
        blocked_phone: payload?.removedPhone || null,
        invite_code_rotated: true,
      },
    });
    updateSuccess(
      isSpanish
        ? `Cuenta de ${name} revocada. Correo bloqueado y código renovado.`
        : `${name}'s account revoked. Email blocked and invite code rotated.`,
    );
    setBlockedEmails((previous) => {
      const next = new Set(previous);
      if (typeof payload?.removedEmail === "string" && payload.removedEmail.trim()) next.add(payload.removedEmail.trim().toLowerCase());
      return Array.from(next).sort();
    });
    setBlockedPhones((previous) => {
      const next = new Set(previous);
      if (typeof payload?.removedPhone === "string" && payload.removedPhone.trim()) next.add(payload.removedPhone.trim());
      return Array.from(next).sort();
    });
  };

  const unblockAccess = async (type: "email" | "phone", value: string) => {
    const key = `${type}:${value}`;
    setUnblockBusyKey(key);
    const response = await fetch("/api/staff/unblock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    const payload = await response.json().catch(() => ({}));
    setUnblockBusyKey("");
    if (!response.ok) {
      setPageError(payload?.error || (isSpanish ? "No pude quitar el bloqueo." : "I could not remove the block."));
      return;
    }
    if (type === "email") {
      setBlockedEmails((previous) => previous.filter((item) => item.toLowerCase() !== value.toLowerCase()));
    } else {
      setBlockedPhones((previous) => previous.filter((item) => item !== value));
    }
    updateSuccess(isSpanish ? "Acceso restablecido." : "Access restored.");
  };

  const handleExport = async (patientId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, file_url, file_name, file_type, message_type, type, created_at")
      .eq("room_id", patientId)
      .order("created_at", { ascending: true });

    if (error) {
      setPageError(error.message || "No pude preparar la exportación.");
      return;
    }

    const exportData = {
      messages: data || [],
      mediaUrls: (data || [])
        .filter((message) => message.file_url || ["image", "video", "audio", "file"].includes(message.message_type || message.type || ""))
        .map((message) => ({
          url: message.file_url || message.content,
          timestamp: message.created_at,
          fileType: message.file_type || message.message_type || message.type,
          fileName: message.file_name || null,
        })),
    };

    void exportData;
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
        .admin-topbar { background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 14px; position: sticky; top: 0; z-index: 100; }
        .admin-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-title { min-width: 0; }
        .topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { height: 42px; padding: 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 152px; height: 42px; padding: 0 36px 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px); background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #111827 0%, #1E3A8A 100%); color: white; border-radius: 30px; padding: 26px; margin-bottom: 18px; box-shadow: 0 18px 50px rgba(15,23,42,0.2); }
        .hero-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 18px; align-items: end; }
        .workspace-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr); gap: 16px; align-items: start; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin: 18px 0; }
        .stat-card, .card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .section-title { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .subtle { color: rgba(255,255,255,0.84); line-height: 1.6; font-size: 15px; }
        .quick-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .hero-link { padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: white; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .hero-link:disabled { opacity: 0.5; cursor: not-allowed; }
        .hero-note { padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.12); }
        .search-panel { display: grid; gap: 16px; }
        .search-toolbar { display: grid; gap: 12px; }
        .search-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; }
        .line-input.search-main { height: 52px; font-size: 16px; font-weight: 700; }
        .filter-stack { display: grid; gap: 10px; }
        .filter-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .filter-chip { padding: 10px 13px; border-radius: 999px; border: 1px solid #DCE7F5; background: #F8FBFF; color: #334155; font-size: 13px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .filter-chip.active { background: #1D4ED8; color: white; border-color: #1D4ED8; box-shadow: 0 10px 24px rgba(29,78,216,0.18); }
        .search-status { padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, #F8FBFF, #EEF4FF); color: #1E3A8A; font-size: 14px; font-weight: 800; line-height: 1.5; border: 1px solid #DBEAFE; }
        .summary-panel { display: grid; gap: 14px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .summary-item { padding: 14px; border-radius: 18px; background: #F8FAFC; border: 1px solid #E7EEF7; }
        .summary-label { font-size: 11px; font-weight: 900; color: #64748B; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .summary-value { font-size: 28px; font-weight: 900; color: #111827; line-height: 1; }
        .summary-copy { color: #6B7280; font-size: 13px; line-height: 1.5; margin-top: 6px; }
        .hero-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .hero-secondary-btn { padding: 12px 14px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .line-input { width: 100%; padding: 14px 16px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 16px; font-family: inherit; color: #111827; outline: none; font-weight: 600; }
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
        .muted { color: #4B5563; font-size: 15px; line-height: 1.65; }
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
        .admin-bottom-actions { margin-top: 16px; display: flex; justify-content: center; }
        .back-top-inline-btn { padding: 12px 20px; border-radius: 999px; border: 1px solid #DBEAFE; background: #EFF6FF; color: #1D4ED8; font-size: 14px; font-weight: 800; font-family: inherit; cursor: pointer; }
        .back-top-inline-btn:hover { background: #DBEAFE; }
        @media (max-width: 980px) {
          .hero-grid, .workspace-grid, .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 560px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .admin-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; align-items: center; }
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
          .search-input-row { grid-template-columns: 1fr; }
          .hero-pill-row,
          .filter-row,
          .hero-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .hero-secondary-btn { width: 100%; text-align: center; padding: 12px 12px; }
          .summary-grid { grid-template-columns: 1fr 1fr; }
          .patient-row, .staff-row { flex-direction: column; }
          .toast-stack { right: 12px; left: 12px; width: auto; }
          .header-row { flex-direction: column; }
        }
      `}</style>

      <div className="admin-shell">
        <div className="admin-topbar">
          <div className="topbar-title">
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{isSpanish ? "Centro de control" : "Control center"}</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", margin: 0 }}>{isSpanish ? "Expedientes, equipo y accesos del portal" : "Records, team, and portal access"}</p>
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
                <h1 className="big-title">{isSpanish ? "Busca al paciente y abre su expediente" : "Find the patient and open the record"}</h1>
                <p className="subtle">
                  {isSpanish
                    ? "Busca por nombre, teléfono, correo o procedimiento. Cuando encuentres al paciente correcto, abre su expediente para revisar toda la información con calma."
                    : "Search by name, phone, email, or procedure. Once you find the right patient, open the record to review everything carefully."}
                </p>
              </div>
              <div className="hero-note">
                <p className="section-title" style={{ color: "rgba(255,255,255,0.84)", marginBottom: 8 }}>{isSpanish ? "Cómo usar esta pantalla" : "How to use this screen"}</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.6 }}>
                  {isSpanish
                    ? "Primero busca. Después abre el expediente. La exportación y el resto de acciones viven dentro de cada expediente."
                    : "Search first. Then open the record. Export and the rest of the actions live inside each record."}
                </p>
              </div>
            </div>
          </section>

          <div className="workspace-grid">
            <div className="stack">
              <section className="card search-panel">
                <div className="header-row" style={{ marginBottom: 0 }}>
                  <div>
                    <p className="card-title">{isSpanish ? "Buscar paciente" : "Find patient"}</p>
                    <p className="muted">{isSpanish ? "Escribe nombre, teléfono, correo o procedimiento y después toca buscar." : "Type a name, phone, email, or procedure, then tap search."}</p>
                  </div>
                </div>

                <div className="search-toolbar">
                  <div className="search-input-row">
                    <input
                      className="line-input search-main"
                      placeholder={isSpanish ? "Nombre, teléfono, email, procedimiento o sede..." : "Name, phone, email, procedure, or office..."}
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                    />
                    <button
                      className="main-btn"
                      onClick={() => {
                        document.getElementById("expedientes")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      disabled={!hasActiveSearch}
                    >
                      {isSpanish ? "Buscar" : "Search"}
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        setPatientSearch("");
                      }}
                      disabled={!hasActiveSearch}
                    >
                      {isSpanish ? "Borrar" : "Clear"}
                    </button>
                  </div>

                  <div className="search-status">
                    {hasActiveSearch ? (
                      patientCards.length > 0 ? (
                        isSpanish
                          ? `Encontré ${patientCards.length} expediente(s). Ahora solo elige al paciente correcto y abre su expediente.`
                          : `I found ${patientCards.length} record(s). Now simply choose the right patient and open the record.`
                      ) : (
                        isSpanish
                          ? "No encontré coincidencias. Prueba con menos palabras o intenta otro dato del paciente."
                          : "No matches found. Try fewer words or a different patient detail."
                      )
                    ) : (
                      isSpanish
                        ? "Desde aquí solo buscas. La revisión completa y la exportación suceden dentro del expediente."
                        : "This screen is only for searching. Full review and export happen inside the record."
                    )}
                  </div>
                </div>
              </section>

              <section className="card" id="expedientes">
              <div className="header-row">
                <div>
                  <p className="card-title">{isSpanish ? "Resultados de búsqueda" : "Search results"}</p>
                  <p className="muted">{isSpanish ? "Aquí solo eliges al paciente correcto. La revisión completa y la exportación viven dentro del expediente." : "This is only for choosing the right patient. Full review and export live inside the record."}</p>
                </div>
                <div className="inline-actions">
                  {hasActiveSearch && (
                    <span className="result-count">
                      {isSpanish ? `${patientCards.length} resultado(s)` : `${patientCards.length} result(s)`}
                    </span>
                  )}
                </div>
              </div>

              {!hasActiveSearch ? (
                <div className="empty-state" style={{ padding: "24px 18px" }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "Empieza con una búsqueda" : "Start with a search"}</p>
                  <p className="muted">{isSpanish ? "Escribe el nombre, teléfono, correo o procedimiento del paciente." : "Type the patient's name, phone, email, or procedure."}</p>
                </div>
              ) : patientCards.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "No encontré expedientes con esa búsqueda" : "No records matched that search"}</p>
                  <p className="muted">{isSpanish ? "Prueba con menos palabras o con otro dato del paciente." : "Try fewer words or a different patient detail."}</p>
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
                          <button className="ghost-btn" onClick={() => handleExport(card.patient.id)}>
                            Export Patient Data
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              </section>
            </div>

            <div className="stack">
              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Herramientas del expediente" : "Record tools"}</p>
                    <p className="muted">{isSpanish ? "Cuando necesites revisar cambios o recuperar expedientes, entra aquí." : "When you need to review changes or recover records, start here."}</p>
                  </div>
                </div>
                <div className="inline-actions">
                  <button className="ghost-btn" onClick={() => goTo("/admin/auditoria")}>
                    {isSpanish ? "🕓 Auditoría" : "🕓 Audit log"}
                  </button>
                  <button className="ghost-btn" onClick={() => goTo("/admin/papelera")}>
                    {isSpanish ? "🗂️ Papelera y archivo" : "🗂️ Trash and archive"}
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Accesos bloqueados" : "Blocked access"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Si alguien regresa al equipo, quítalo de esta lista para permitir su registro nuevamente."
                        : "If someone rejoins the team, remove them here to allow registration again."}
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <p className="group-label">{isSpanish ? "Correos bloqueados" : "Blocked emails"}</p>
                    {blockedEmails.length === 0 ? (
                      <p className="small-note">{isSpanish ? "Sin correos bloqueados." : "No blocked emails."}</p>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {blockedEmails.map((emailValue) => {
                          const busy = unblockBusyKey === `email:${emailValue}`;
                          return (
                            <div key={emailValue} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 10px" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", wordBreak: "break-all" }}>{emailValue}</span>
                              <button className="mini-btn" disabled={busy} onClick={() => unblockAccess("email", emailValue)}>
                                {busy ? (isSpanish ? "..." : "...") : (isSpanish ? "Permitir" : "Allow")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="group-label">{isSpanish ? "Teléfonos bloqueados" : "Blocked phones"}</p>
                    {blockedPhones.length === 0 ? (
                      <p className="small-note">{isSpanish ? "Sin teléfonos bloqueados." : "No blocked phones."}</p>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {blockedPhones.map((phoneValue) => {
                          const busy = unblockBusyKey === `phone:${phoneValue}`;
                          return (
                            <div key={phoneValue} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 10px" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", wordBreak: "break-all" }}>{phoneValue}</span>
                              <button className="mini-btn" disabled={busy} onClick={() => unblockAccess("phone", phoneValue)}>
                                {busy ? (isSpanish ? "..." : "...") : (isSpanish ? "Permitir" : "Allow")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Invitar personal" : "Invite team member"}</p>
                    <p className="muted">{isSpanish ? "Envía este enlace a un nuevo integrante. El código ya va incluido para que el registro tenga menos pasos." : "Send this link to a new team member. The code is already included so registration has fewer steps."}</p>
                  </div>
                </div>

                <div className="export-card" style={{ marginBottom: 14 }}>
                  <p className="section-title">{isSpanish ? "Enlace de invitación" : "Invitation link"}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8", margin: 0, wordBreak: "break-word", lineHeight: 1.6 }}>
                    {inviteLink || (isSpanish ? "Primero carga un código de invitación." : "Load an invitation code first.")}
                  </p>
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    <button className="main-btn" onClick={copyInviteLink} disabled={!inviteLink}>
                      {isSpanish ? "Copiar enlace" : "Copy link"}
                    </button>
                    <button className="ghost-btn" onClick={shareInviteLink} disabled={!inviteLink}>
                      {isSpanish ? "Compartir" : "Share"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <p className="group-label" style={{ marginBottom: -2 }}>{isSpanish ? "Si quieres cambiar el código actual" : "If you want to change the current code"}</p>
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
                    <p className="card-title">{isSpanish ? "Teléfonos de sede" : "Office phone numbers"}</p>
                    <p className="muted">{isSpanish ? "Estos números alimentan el botón de llamada en el chat del paciente." : "These numbers power the call button inside the patient chat."}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <p className="group-label">{isSpanish ? "Guadalajara" : "Guadalajara"}</p>
                    <input className="line-input" value={officePhoneGdl} onChange={(event) => setOfficePhoneGdl(event.target.value)} placeholder={isSpanish ? "Ej: +52 33 1234 5678" : "e.g. +52 33 1234 5678"} />
                  </div>
                  <div>
                    <p className="group-label">{isSpanish ? "Tijuana" : "Tijuana"}</p>
                    <input className="line-input" value={officePhoneTjn} onChange={(event) => setOfficePhoneTjn(event.target.value)} placeholder={isSpanish ? "Ej: +52 664 123 4567" : "e.g. +52 664 123 4567"} />
                  </div>
                  <div className="inline-actions">
                    <button className="main-btn" onClick={saveOfficePhones} disabled={savingPhones}>
                      {savingPhones ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar teléfonos" : "Save phone numbers")}
                    </button>
                  </div>
                </div>
              </section>

            </div>
          </div>

          <section className="card" id="equipo" style={{ marginTop: 16 }}>
            <div className="header-row">
              <div>
                <p className="card-title">{isSpanish ? "Equipo y permisos" : "Team and permissions"}</p>
                <p className="muted">
                  {isSpanish
                    ? "Aquí corriges la sede del equipo y decides quién también puede entrar al centro de control. Los cambios se guardan al instante y verás una confirmación en pantalla."
                    : "Here you can correct team office assignments and decide who can also enter the control center. Changes save immediately and you will see an on-screen confirmation."}
                </p>
              </div>
            </div>

            {staff.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "Todavía no hay equipo" : "No team members yet"}</p>
                <p className="muted">{isSpanish ? "Cuando se registren aparecerán aquí." : "They will appear here once they register."}</p>
              </div>
            ) : (
              staff.map((member) => {
                const memberEmail = member.id === viewerId ? viewerEmail : "";
                const level = normalizeAdminLevel(member.admin_level, memberEmail);
                const memberOffice = normalizeOffice(member.office_location);
                const memberWorksBoth = member.office_location === null;
                const memberOfficeText = memberWorksBoth ? (isSpanish ? "🌐 Ambas sedes" : "🌐 Both offices") : officeLabel(memberOffice);
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
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{member.full_name || member.display_name || (isSpanish ? "Sin nombre" : "No name")}</p>
                      <div>
                        <span className="meta-badge" style={{ color: roleColor(member.role), background: `${roleColor(member.role)}18` }}>{roleText(member.role)}</span>
                        <span className="meta-badge" style={{ color: adminColor(level), background: `${adminColor(level)}18` }}>{adminText(level)}</span>
                        <span className="meta-badge" style={{ color: memberWorksBoth || memberOffice ? "#1D4ED8" : "#6B7280", background: memberWorksBoth || memberOffice ? "#EFF6FF" : "#F3F4F6" }}>
                          {memberOfficeText}
                        </span>
                      </div>

                      <div className="setting-group">
                        <p className="group-label">{isSpanish ? "Sede del equipo" : "Team office"}</p>
                        <div className="mini-actions">
                          {[
                            { value: "Guadalajara" as Office, label: "🏙️ Guadalajara", active: memberOffice === "Guadalajara" && !memberWorksBoth },
                            { value: "Tijuana" as Office, label: "🌊 Tijuana", active: memberOffice === "Tijuana" && !memberWorksBoth },
                            { value: null as string | null, label: isSpanish ? "🌐 Ambas sedes" : "🌐 Both offices", active: memberWorksBoth },
                          ].map((officeOption) => (
                            <button
                              key={`${member.id}-${officeOption.label}`}
                              className="mini-btn"
                              style={{
                                background: officeOption.active ? "#DBEAFE" : "#EFF3F8",
                                color: officeOption.active ? "#1D4ED8" : "#374151",
                                opacity: savingKey === officeKey ? 0.6 : 1,
                              }}
                              disabled={savingKey === officeKey}
                              onClick={() => updateStaffField(
                                member,
                                { office_location: officeOption.value },
                                isSpanish
                                  ? `Sede de ${member.full_name || "staff"} actualizada a ${officeOption.value || "Ambas sedes"}.`
                                  : `Office for ${member.full_name || "staff"} updated to ${officeOption.value || "Both offices"}.`,
                              )}
                            >
                              {officeOption.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="setting-group">
                        <p className="group-label">{isSpanish ? "Acceso al centro de control" : "Control center access"}</p>
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
                              onClick={() => updateStaffField(member, { admin_level: option }, isSpanish ? `Acceso de ${member.full_name || "staff"} actualizado a ${adminLabel(option)}.` : `Access for ${member.full_name || "staff"} updated to ${adminText(option)}.`)}
                            >
                              {adminText(option)}
                            </button>
                          ))}
                          {level === "owner" && (
                            <span className="meta-badge" style={{ color: adminColor("owner"), background: `${adminColor("owner")}18` }}>
                              {isSpanish ? "Protegido" : "Protected"}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="small-note" style={{ marginTop: 10 }}>
                        {isSpanish ? "Estado actual" : "Current status"}: {memberWorksBoth ? (isSpanish ? "Ambas sedes" : "Both offices") : (memberOffice || (isSpanish ? "Sin sede" : "No office"))} · {adminText(level)}
                      </p>
                    </div>

                    <div style={{ display: "grid", gap: 8, minWidth: 132 }}>
                      <button
                        className="mini-btn"
                        style={{ background: "#FFF1F2", color: "#E11D48", opacity: !canManageAdmins || (level === "owner" && !canManageOwner) ? 0.45 : 1 }}
                        disabled={deletingId === member.id || !canManageAdmins || (level === "owner" && !canManageOwner)}
                        onClick={() => deleteStaff(member)}
                      >
                        {deletingId === member.id ? (isSpanish ? "Eliminando..." : "Deleting...") : (isSpanish ? "🗑️ Eliminar" : "🗑️ Delete")}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <div className="admin-bottom-actions">
            <button type="button" className="back-top-inline-btn" onClick={scrollAdminToTop}>
              {isSpanish ? "⬆️ Volver arriba" : "⬆️ Back to top"}
            </button>
          </div>
        </div>

        <div className="toast-stack" aria-live="polite">
          {pageError && <div className="toast error">⚠️ {pageError}</div>}
          {successMsg && <div className="toast success">✅ {successMsg}</div>}
        </div>
      </div>
    </>
  );
}
