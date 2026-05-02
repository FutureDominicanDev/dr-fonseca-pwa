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
  recordStatusColor,
  recordStatusLabel,
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

type StaffPrivateMessage = {
  id?: string;
  sender_id?: string | null;
  recipient_id?: string | null;
  receiver_id?: string | null;
  to_user_id?: string | null;
  target_user_id?: string | null;
  sender_name?: string | null;
  recipient_name?: string | null;
  receiver_name?: string | null;
  message?: string | null;
  content?: string | null;
  body?: string | null;
  created_at?: string | null;
};

type StaffPrivateConversation = {
  key: string;
  participantIds: string[];
  title: string;
  subtitle: string;
  messages: StaffPrivateMessage[];
  latestAt: string;
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
  const [staffPrivateMessages, setStaffPrivateMessages] = useState<StaffPrivateMessage[]>([]);
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
  const [staffNameDrafts, setStaffNameDrafts] = useState<Record<string, string>>({});
  const [staffPhoneDrafts, setStaffPhoneDrafts] = useState<Record<string, string>>({});
  const [deletingStaffId, setDeletingStaffId] = useState("");
  const [unblockBusyKey, setUnblockBusyKey] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState<{ type: "patient" | "staff"; id: string; title: string; body: string } | null>(null);

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = ["owner", "super_admin"].includes(viewerAdminLevel);
  const canManageAdmins = ["owner", "super_admin"].includes(viewerAdminLevel);
  const canManageOwner = isOwnerEmail(viewerEmail);

  const officeText = (office: Office) => {
    if (office === "Guadalajara") return "📍 Guadalajara";
    if (office === "Tijuana") return "📍 Tijuana";
    return isSpanish ? "📍 Sin sede" : "📍 No office";
  };

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

  const allPatientCards = useMemo<PatientCard[]>(() => {
    return patients
      .map((patient) => {
        const patientProcedures = procedures.filter((procedure) => procedure.patient_id === patient.id);
        const patientProcedureIds = new Set(patientProcedures.map((procedure) => procedure.id));
        const patientRooms = rooms.filter((room) => patientProcedureIds.has(room.procedure_id || ""));
        const offices = [...new Set(patientProcedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))] as Office[];

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
          matchesSearch: true,
        };
      })
      .sort((a, b) => (a.patient.full_name || "").localeCompare(b.patient.full_name || "", "es"));
  }, [patients, procedures, rooms]);

  const patientCards = useMemo<PatientCard[]>(() => {
    const normalizedSearch = patientSearch.trim().toLowerCase();

    return allPatientCards
      .map((card) => {
        const haystack = [
          card.patient.full_name,
          card.patient.phone,
          card.patient.email,
          ...card.procedures.map((procedure) => procedure.procedure_name || ""),
          ...card.offices,
        ]
          .join(" ")
          .toLowerCase();
        return { ...card, matchesSearch: !normalizedSearch || haystack.includes(normalizedSearch) };
      })
      .filter((card) => card.matchesSearch);
  }, [allPatientCards, patientSearch]);

  const hasActiveSearch = patientSearch.trim().length > 0;
  const visiblePatientCards = hasActiveSearch ? patientCards.slice(0, 12) : [];
  const hiddenPatientCount = Math.max(0, patientCards.length - visiblePatientCards.length);
  const inviteLink = typeof window !== "undefined" && inviteCode
    ? `${window.location.origin}/register?code=${encodeURIComponent(inviteCode)}`
    : "";
  const activePatientCount = patients.filter((patient) => normalizeRecordStatus(patient.record_status) === "active").length;
  const activePatientCards = allPatientCards.filter((card) => card.recordStatus === "active");
  const blockedAccessCount = blockedEmails.length + blockedPhones.length;
  const adminAccessCount = staff.filter((member) => normalizeAdminLevel(member.admin_level, member.id === viewerId ? viewerEmail : "") !== "none").length;
  const inviteCodePreview = inviteCode ? `${inviteCode.slice(0, Math.min(7, inviteCode.length))}••••` : "";
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const privateMessageText = (message: StaffPrivateMessage) => message.content || message.message || message.body || "";
  const privateRecipientId = (message: StaffPrivateMessage) => message.recipient_id || message.receiver_id || message.to_user_id || message.target_user_id || "";
  const staffPrivateConversations = useMemo<StaffPrivateConversation[]>(() => {
    const conversations = new Map<string, StaffPrivateMessage[]>();
    staffPrivateMessages.forEach((message) => {
      const senderId = message.sender_id || "";
      const recipientId = privateRecipientId(message);
      if (!senderId || !recipientId) return;
      const key = [senderId, recipientId].sort().join(":");
      conversations.set(key, [...(conversations.get(key) || []), message]);
    });

    return Array.from(conversations.entries())
      .map(([key, conversationMessages]) => {
        const participantIds = key.split(":");
        const participantNames = participantIds.map((participantId) => {
          const member = staffById.get(participantId);
          return member?.full_name || member?.display_name || participantId;
        });
        const sortedMessages = [...conversationMessages].sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
        const latestMessage = sortedMessages[0];
        return {
          key,
          participantIds,
          title: participantNames.join(" + "),
          subtitle: `${participantNames.length} ${isSpanish ? "participantes" : "participants"} · ${conversationMessages.length} ${isSpanish ? "mensaje(s) internos" : "internal message(s)"}`,
          messages: sortedMessages,
          latestAt: latestMessage?.created_at || "",
        };
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [isSpanish, staffById, staffPrivateMessages]);

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

  const scrollToAdminSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const [staffRes, patientsRes, proceduresRes, roomsRes, staffPrivateMessagesRes, inviteRes, blockedEmailsRes, blockedPhonesRes, gdlPhoneRes, tjnPhoneRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("procedures").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("staff_private_messages").select("*").order("created_at", { ascending: false }).limit(500),
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
    setStaffPrivateMessages(staffPrivateMessagesRes.error ? [] : ((staffPrivateMessagesRes.data || []) as StaffPrivateMessage[]));
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

    const computedAdminLevel = normalizeAdminLevel((profile as StaffProfile | null)?.admin_level, email);
    const computedAccess = ["owner", "super_admin"].includes(computedAdminLevel);
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
    const action = Object.prototype.hasOwnProperty.call(payload, "admin_level")
      ? "staff_admin_updated"
      : Object.prototype.hasOwnProperty.call(payload, "full_name") || Object.prototype.hasOwnProperty.call(payload, "display_name")
        ? "staff_name_updated"
        : "staff_profile_updated";

    await logAdminEvent({
      action,
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

  const deleteStaffMember = async (member: StaffProfile) => {
    const memberName = member.full_name || member.display_name || member.email || (isSpanish ? "este usuario" : "this user");
    const confirmed = window.confirm(
      isSpanish
        ? `Eliminar a ${memberName} quitará su acceso al portal, lo sacará de los expedientes asignados y bloqueará su correo/teléfono para que no pueda volver a registrarse con la invitación actual. ¿Continuar?`
        : `Deleting ${memberName} will remove portal access, detach them from assigned records, and block their email/phone from registering again with the current invite. Continue?`,
    );
    if (!confirmed) return;

    setDeletingStaffId(member.id);
    setPageError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token || "";
    const response = await fetch("/api/staff/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ userId: member.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setDeletingStaffId("");

    if (!response.ok) {
      setPageError(payload?.error || (isSpanish ? "No pude eliminar este usuario." : "I could not delete this user."));
      return;
    }

    setStaff((previous) => previous.filter((item) => item.id !== member.id));
    if (payload?.removedEmail) {
      setBlockedEmails((previous) => [...new Set([...previous, `${payload.removedEmail}`.toLowerCase()])].sort());
    }
    if (payload?.removedPhone) {
      setBlockedPhones((previous) => [...new Set([...previous, `${payload.removedPhone}`])].sort());
    }
    if (payload?.newInviteCode) {
      setInviteCode(`${payload.newInviteCode}`);
      setNewInviteCode("");
    }

    await logAdminEvent({
      action: "staff_user_deleted",
      entityType: "staff_profile",
      entityId: member.id,
      entityName: memberName,
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: isSpanish ? `Se eliminó el acceso de ${memberName}.` : `Deleted access for ${memberName}.`,
      metadata: { removedEmail: payload?.removedEmail || member.email || null, removedPhone: payload?.removedPhone || member.phone || null },
    }).catch(() => undefined);
    updateSuccess(isSpanish ? `${memberName} eliminado del portal.` : `${memberName} deleted from the portal.`);
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
    const inviteText = isSpanish
      ? `Invitación al portal médico privado del Dr. Fonseca: ${inviteLink}`
      : `Invitation to Dr. Fonseca's private medical portal: ${inviteLink}`;
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: isSpanish ? "Invitación al portal" : "Portal invitation",
          text: inviteText,
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

  const sendInviteText = () => {
    if (!inviteLink) return;
    const inviteText = isSpanish
      ? `Invitación al portal médico privado del Dr. Fonseca: ${inviteLink}`
      : `Invitation to Dr. Fonseca's private medical portal: ${inviteLink}`;
    window.location.href = `sms:?&body=${encodeURIComponent(inviteText)}`;
    updateSuccess(isSpanish ? "Abrí Mensajes con la invitación lista." : "Messages opened with the invitation ready.");
  };

  const openPatientExportMenu = (card: PatientCard) => {
    const body = [
      `Paciente: ${card.patient.full_name || "Sin nombre"}`,
      `Tel: ${card.patient.phone || "Sin teléfono"}`,
      `Correo: ${card.patient.email || "Sin correo"}`,
      `Procedimientos: ${card.procedures.map((procedure) => procedure.procedure_name).filter(Boolean).join(", ") || "Sin procedimientos"}`,
      `Chats: ${card.rooms.length}`,
    ].join("\n");
    setExportMenu({
      type: "patient",
      id: card.patient.id,
      title: card.patient.full_name || (isSpanish ? "Paciente" : "Patient"),
      body,
    });
  };

  const openStaffChatExportMenu = (conversation: StaffPrivateConversation) => {
    const recentMessages = conversation.messages
      .slice(0, 50)
      .map((message) => {
        const sender = staffById.get(message.sender_id || "");
        const recipient = staffById.get(privateRecipientId(message));
        const senderName = sender?.full_name || sender?.display_name || message.sender_name || (isSpanish ? "Personal" : "Staff");
        const recipientName = recipient?.full_name || recipient?.display_name || message.recipient_name || message.receiver_name || (isSpanish ? "Personal" : "Staff");
        return `${message.created_at ? new Date(message.created_at).toLocaleString() : ""} - ${senderName} → ${recipientName}: ${privateMessageText(message) || "—"}`;
      });
    const body = [
      isSpanish ? `Conversación privada: ${conversation.title}` : `Private conversation: ${conversation.title}`,
      `${isSpanish ? "Mensajes privados" : "Private messages"}: ${conversation.messages.length}`,
      "",
      ...(recentMessages.length ? recentMessages : [isSpanish ? "Sin mensajes privados registrados." : "No private messages recorded."]),
    ].join("\n");
    setExportMenu({ type: "staff", id: conversation.key, title: conversation.title, body });
  };

  const shareExportMenu = async () => {
    if (!exportMenu) return;
    const nav = navigator as Navigator & { share?: (data?: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: exportMenu.title, text: exportMenu.body });
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(exportMenu.body);
    updateSuccess(isSpanish ? "Datos copiados para compartir." : "Data copied for sharing.");
  };

  const printExportMenu = () => {
    if (!exportMenu) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    const safeBody = exportMenu.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    printWindow.document.write(`<html><head><title>${exportMenu.title}</title></head><body><pre style="font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:pre-wrap;">${safeBody}</pre></body></html>`);
    printWindow.document.close();
    printWindow.print();
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
      .select("id, sender_id, sender_type, content, file_url, file_name, file_type, message_type, type, message_hash, created_at")
      .eq("room_id", patientId)
      .order("created_at", { ascending: true });

    if (error) {
      setPageError(error.message || "No pude preparar la exportación.");
      return;
    }

    const escapeHtml = (value: unknown) =>
      `${value ?? ""}`
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const extensionFrom = (fileName: string | null, fileType: string | null, url: string, fallback: string) => {
      const fromName = fileName?.split(".").pop();
      if (fromName && fromName.length <= 5) return fromName.toLowerCase();
      const fromType = fileType?.split("/").pop()?.split(";")[0];
      if (fromType) return fromType === "mpeg" ? "mp3" : fromType;
      const fromUrl = url.split("?")[0].split(".").pop();
      return fromUrl && fromUrl.length <= 5 ? fromUrl.toLowerCase() : fallback;
    };
    const labels = {
      en: {
        title: "Patient Record Export",
        exportDate: "Export Date",
        timeline: "Message Timeline",
        sender: "Sender",
        type: "Type",
        file: "File",
        patient: "Patient",
        doctor: "Doctor",
        statement: "This document represents a system-generated export of patient communications.",
        total: "Total number of messages",
        timestamp: "Export timestamp",
        integrityHash: "Integrity Hash",
      },
      es: {
        title: "Exportación de Registro del Paciente",
        exportDate: "Fecha de Exportación",
        timeline: "Cronología de Mensajes",
        sender: "Remitente",
        type: "Tipo",
        file: "Archivo",
        patient: "Paciente",
        doctor: "Doctor",
        statement: "Este documento representa una exportación generada por el sistema de las comunicaciones del paciente.",
        total: "Total de mensajes",
        timestamp: "Marca de tiempo de exportación",
        integrityHash: "Hash de Integridad",
      },
    };
    const localTime = (value?: string | null) => value ? new Date(value).toLocaleString() : "";
    const senderLabel = (senderType?: string | null) => senderType === "patient" ? labels.en.patient : labels.en.doctor;
    const typeLabel = (value?: string | null) => {
      const normalized = value || "text";
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    };
    const sha256 = async (value: string) => {
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    const masterHash = await sha256((data || []).map((message) => message.message_hash || "").join(""));
    const exportData = {
      patient_id: patientId,
      export_date: new Date().toISOString(),
      integrity_hash: masterHash,
      messages: (data || []).map((message) => ({
        sender_id: message.sender_id || null,
        sender: message.sender_type === "patient" ? "Patient" : "Doctor",
        type: message.message_type || message.type || "text",
        content: message.file_url || message.content,
        file_name: message.file_name || null,
        file_type: message.file_type || null,
        message_hash: message.message_hash || null,
        created_at: message.created_at || null,
      })),
    };

    const textEncoder = new TextEncoder();
    const crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
    const crc32 = (bytes: Uint8Array) => {
      let crc = 0xffffffff;
      for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    };
    const u16 = (value: number) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
    const u32 = (value: number) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
    const dosTime = (date: Date) => ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff;
    const dosDate = (date: Date) => (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
    const createZip = (entries: Array<{ path: string; data: Uint8Array }>) => {
      const localParts: Uint8Array[] = [];
      const centralParts: Uint8Array[] = [];
      let offset = 0;
      const now = new Date();

      for (const entry of entries) {
        const name = textEncoder.encode(entry.path);
        const crc = crc32(entry.data);
        const localHeader = [
          u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime(now)), u16(dosDate(now)),
          u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name,
        ];
        const localSize = localHeader.reduce((sum, part) => sum + part.length, 0) + entry.data.length;
        localParts.push(...localHeader, entry.data);
        centralParts.push(
          u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime(now)), u16(dosDate(now)),
          u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0),
          u16(0), u16(0), u32(0), u32(offset), name,
        );
        offset += localSize;
      }

      const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
      const end = [
        u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
        u32(centralSize), u32(offset), u16(0),
      ];
      return new Blob([...localParts, ...centralParts, ...end] as BlobPart[], { type: "application/zip" });
    };
    const zipEntries: Array<{ path: string; data: Uint8Array }> = [];
    const mediaFiles: Record<string, string> = {};

    for (const [index, message] of exportData.messages.entries()) {
      const isMedia = ["image", "video", "audio", "file"].includes(message.type || "");
      if (!isMedia || !message.content) continue;
      try {
        const response = await fetch(message.content);
        if (!response.ok) continue;
        const blob = await response.blob();
        const extension = extensionFrom(message.file_name, blob.type || null, message.content, message.type || "file");
        const mediaName = `${message.type}${index + 1}.${extension}`;
        mediaFiles[message.content] = `media/${mediaName}`;
        zipEntries.push({ path: `patient-${patientId}/media/${mediaName}`, data: new Uint8Array(await blob.arrayBuffer()) });
      } catch {
      }
    }

    const reportRows = exportData.messages.map((message) => {
      const mediaPath = mediaFiles[message.content || ""];
      const content = mediaPath
        ? `<a href="${escapeHtml(mediaPath)}">${escapeHtml(message.file_name || mediaPath)}</a>`
        : `<div class="text">${escapeHtml(message.content)}</div>`;
      return `<tr><td>${escapeHtml(localTime(message.created_at))}</td><td>${escapeHtml(message.sender)}</td><td>${escapeHtml(typeLabel(message.type))}</td><td>${content}</td></tr>`;
    }).join("");
    const reportHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.en.title)} ${escapeHtml(patientId)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 32px; line-height: 1.5; background: #fff; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    h2 { margin-top: 26px; font-size: 18px; border-bottom: 1px solid #111; padding-bottom: 6px; }
    .meta, .integrity { color: #222; margin: 18px 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #E5E7EB; padding: 10px; vertical-align: top; text-align: left; }
    th { background: #F3F4F6; color: #111; }
    .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.en.title)}</h1>
  <h1>${escapeHtml(labels.es.title)}</h1>
  <div class="meta">Patient ID: ${escapeHtml(patientId)}<br />${escapeHtml(labels.en.exportDate)} / ${escapeHtml(labels.es.exportDate)}: ${escapeHtml(localTime(exportData.export_date))}</div>
  <h2>${escapeHtml(labels.en.timeline)} / ${escapeHtml(labels.es.timeline)}</h2>
  <table>
    <thead><tr><th>Timestamp</th><th>${escapeHtml(labels.en.sender)} / ${escapeHtml(labels.es.sender)}</th><th>${escapeHtml(labels.en.type)} / ${escapeHtml(labels.es.type)}</th><th>${escapeHtml(labels.en.file)} / ${escapeHtml(labels.es.file)}</th></tr></thead>
    <tbody>${reportRows}</tbody>
  </table>
  <div class="integrity">
    <p><strong>${escapeHtml(labels.en.total)} / ${escapeHtml(labels.es.total)}:</strong> ${exportData.messages.length}</p>
    <p><strong>${escapeHtml(labels.en.timestamp)} / ${escapeHtml(labels.es.timestamp)}:</strong> ${escapeHtml(localTime(exportData.export_date))}</p>
    <p><strong>${escapeHtml(labels.en.integrityHash)} / ${escapeHtml(labels.es.integrityHash)}:</strong> ${escapeHtml(masterHash)}</p>
    <p>${escapeHtml(labels.en.statement)}</p>
    <p>${escapeHtml(labels.es.statement)}</p>
  </div>
</body>
</html>`;

    const createPdf = (lines: string[]) => {
      const pdfEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      const objects: string[] = [];
      const pageObjects: number[] = [];
      const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 42)) }, (_, pageIndex) => lines.slice(pageIndex * 42, pageIndex * 42 + 42));
      objects.push("<< /Type /Catalog /Pages 2 0 R >>");
      objects.push("");
      objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
      for (const pageLines of pages) {
        const pageNumber = objects.length + 1;
        const contentNumber = pageNumber + 1;
        pageObjects.push(pageNumber);
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`);
        const text = `BT /F1 10 Tf 50 742 Td ${pageLines.map((line, index) => `${index === 0 ? "" : "0 -16 Td "}[${pdfEscape(line).slice(0, 110)}] TJ`).join(" ")} ET`;
        objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
      }
      objects[1] = `<< /Type /Pages /Kids [${pageObjects.map((page) => `${page} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;
      let pdf = "%PDF-1.4\n";
      const offsets = [0];
      objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
      });
      const xrefOffset = pdf.length;
      pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\n`;
      pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
      return textEncoder.encode(pdf);
    };
    const pdfLines = [
      labels.en.title,
      labels.es.title,
      `Patient ID: ${patientId}`,
      `${labels.en.exportDate} / ${labels.es.exportDate}: ${localTime(exportData.export_date)}`,
      `${labels.en.timeline} / ${labels.es.timeline}`,
      ...exportData.messages.flatMap((message) => [
        `${localTime(message.created_at)} | ${message.sender} | ${typeLabel(message.type)}`,
        `${message.file_name || message.content || ""}`,
      ]),
      `${labels.en.total} / ${labels.es.total}: ${exportData.messages.length}`,
      `${labels.en.timestamp} / ${labels.es.timestamp}: ${localTime(exportData.export_date)}`,
      `${labels.en.integrityHash} / ${labels.es.integrityHash}: ${masterHash}`,
      labels.en.statement,
      labels.es.statement,
    ];

    zipEntries.push({ path: `patient-${patientId}/report.html`, data: textEncoder.encode(reportHtml) });
    zipEntries.push({ path: `patient-${patientId}/report.pdf`, data: createPdf(pdfLines) });
    zipEntries.push({ path: `patient-${patientId}/data.json`, data: textEncoder.encode(JSON.stringify(exportData, null, 2)) });
    const zipBlob = createZip(zipEntries);
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `patient-${patientId}-court-export.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
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
        * { box-sizing: border-box; max-width: 100%; }
        body { background: #F5F7FB; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; overflow-x: hidden; }
        .admin-shell { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: radial-gradient(circle at top, rgba(59,130,246,0.10), transparent 26%), #F5F7FB; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.55; }
        .admin-topbar { background: #07334D; backdrop-filter: blur(18px); min-height: calc(86px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 10px; position: sticky; top: 0; z-index: 100; box-shadow: 0 8px 26px rgba(7,51,77,0.22); }
        .admin-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-title { min-width: 0; display: flex; align-items: center; gap: 14px; flex: 1 1 auto; }
        .admin-brand-logo { width: min(270px, 31vw); height: 64px; object-fit: contain; object-position: left center; display: block; }
        .admin-title-copy { min-width: 0; padding-left: 14px; border-left: 1px solid rgba(255,255,255,0.18); }
        .topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; flex: 0 0 auto; }
        .topbar-actions { display: flex; gap: 7px; flex-wrap: nowrap; justify-content: flex-end; }
        .topbar-btn { min-height: 44px; padding: 0 12px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 850; font-size: 15px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 96px; min-height: 44px; padding: 0 28px 0 12px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 850; font-size: 16px !important; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 15px) calc(50% - 3px), calc(100% - 10px) calc(50% - 3px); background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #0B2438 0%, #0E3F63 58%, #155C95 100%); color: white; border-radius: 30px; padding: 26px; margin-bottom: 18px; box-shadow: 0 18px 50px rgba(7,51,77,0.20); border: 1px solid rgba(255,255,255,0.12); }
        .hero-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 18px; align-items: end; }
        .workspace-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr); gap: 16px; align-items: start; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin: 18px 0; }
        .stat-card, .card { background: rgba(255,255,255,0.98); border: 1px solid rgba(102,132,163,0.14); border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(28,66,104,0.06); }
        .stat-card { display: block; width: 100%; padding: 18px 16px; min-height: 124px; appearance: none; text-align: left; font-family: inherit; cursor: pointer; transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease; }
        .stat-card:hover, .stat-card:focus-visible { transform: translateY(-2px); border-color: rgba(37,99,235,0.35); box-shadow: 0 14px 34px rgba(28,66,104,0.10); outline: none; }
        .stat-icon { width: 38px; height: 38px; border-radius: 14px; display: grid; place-items: center; background: #EAF5FF; color: #075EA8; font-size: 18px; margin-bottom: 12px; }
        .stat-label { color: #64748B; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; line-height: 1.35; }
        .stat-value { color: #0E2D4A; font-size: 30px; line-height: 1; font-weight: 950; }
        .stat-help { color: #64748B; font-size: 15px; font-weight: 700; line-height: 1.45; margin-top: 8px; }
        .section-title { font-size: 15px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; line-height: 1.35; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .subtle { color: rgba(255,255,255,0.84); line-height: 1.6; font-size: 15px; }
        .quick-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .hero-link { min-height: 44px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .hero-link:disabled { opacity: 0.5; cursor: not-allowed; }
        .hero-note { padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.12); }
        .search-panel { display: grid; gap: 16px; }
        .search-toolbar { display: grid; gap: 12px; }
        .search-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; }
        .line-input.search-main { height: 52px; font-size: 16px; font-weight: 700; }
        .filter-stack { display: grid; gap: 10px; }
        .filter-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .filter-chip { min-height: 44px; padding: 10px 13px; border-radius: 999px; border: 1px solid #DCE7F5; background: #F8FBFF; color: #334155; font-size: 15px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .filter-chip.active { background: #1D4ED8; color: white; border-color: #1D4ED8; box-shadow: 0 10px 24px rgba(29,78,216,0.18); }
        .search-status { padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, #F8FBFF, #EEF4FF); color: #1E3A8A; font-size: 14px; font-weight: 800; line-height: 1.5; border: 1px solid #DBEAFE; }
        .secure-invite { border: 1px solid #DBEAFE; background: linear-gradient(135deg, #F8FBFF, #EEF6FF); border-radius: 18px; padding: 16px; margin-bottom: 14px; }
        .secure-invite-label { color: #64748B; font-size: 15px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 8px; line-height: 1.35; }
        .secure-invite-main { color: #0E2D4A; font-size: 16px; font-weight: 900; margin: 0 0 4px; }
        .secure-invite-code { color: #1D4ED8; font-size: 15px; font-weight: 850; margin: 0; overflow-wrap: anywhere; }
        .summary-panel { display: grid; gap: 14px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .summary-item { padding: 14px; border-radius: 18px; background: #F8FAFC; border: 1px solid #E7EEF7; }
        .summary-label { font-size: 15px; font-weight: 900; color: #64748B; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; line-height: 1.35; }
        .summary-value { font-size: 28px; font-weight: 900; color: #111827; line-height: 1; }
        .summary-copy { color: #6B7280; font-size: 15px; line-height: 1.55; margin-top: 6px; overflow-wrap: anywhere; }
        .hero-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .hero-secondary-btn { min-height: 46px; padding: 12px 14px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 16px; cursor: pointer; font-family: inherit; }
        .main-btn { min-height: 48px; padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 16px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { min-height: 48px; padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 16px; cursor: pointer; font-family: inherit; }
        .line-input { width: 100%; padding: 14px 16px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 16px; font-family: inherit; color: #111827; outline: none; font-weight: 600; }
        .line-input:focus { border-color: rgba(0,122,255,0.5); background: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 380px; gap: 16px; align-items: start; }
        .stack { display: grid; gap: 16px; align-content: start; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        .staff-row, .patient-row { display: flex; gap: 14px; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #EEF2F7; }
        .staff-row:last-child, .patient-row:last-child { border-bottom: none; }
        .staff-row.compact { gap: 12px; padding: 14px 0; }
        .staff-heading-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .staff-contact { color: #64748B; font-size: 15px; font-weight: 700; line-height: 1.45; margin-top: 3px; overflow-wrap: anywhere; }
        .staff-controls { margin-top: 10px; border: 1px solid #E6EEF7; border-radius: 14px; overflow: hidden; background: #FBFDFF; }
        .staff-controls summary { list-style: none; min-height: 44px; padding: 10px 12px; cursor: pointer; color: #075EA8; font-size: 15px; font-weight: 900; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .staff-controls summary::-webkit-details-marker { display: none; }
        .staff-controls-body { padding: 0 12px 12px; }
        .danger-inline-btn { flex-shrink: 0; min-height: 44px; padding: 8px 10px; border-radius: 999px; border: none; background: #FFF1F2; color: #E11D48; font-size: 15px; font-weight: 900; cursor: pointer; font-family: inherit; }
        .danger-inline-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#111827,#1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .small-avatar { width: 42px; height: 42px; font-size: 13px; }
        .list-action-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; border: 1px solid #E7EEF7; background: #F8FAFC; color: #111827; text-align: left; cursor: pointer; font-family: inherit; }
        .list-action-row strong { display: block; font-size: 16px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .list-action-row span span { display: block; margin-top: 3px; color: #64748B; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; line-height: 1.4; }
        .list-action-row:hover, .list-action-row:focus-visible { border-color: #BFDBFE; background: #EFF6FF; outline: none; }
        .export-overlay { position: fixed; inset: 0; z-index: 170; display: grid; place-items: center; padding: 18px; background: rgba(15,23,42,0.42); }
        .export-modal { width: min(440px, 100%); border-radius: 22px; background: white; padding: 20px; box-shadow: 0 24px 80px rgba(15,23,42,0.28); }
        .export-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 14px; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; font-size: 15px; line-height: 1.25; font-weight: 800; margin-right: 6px; margin-top: 8px; }
        .mini-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .mini-btn { min-height: 44px; padding: 9px 12px; border-radius: 12px; border: none; cursor: pointer; font-size: 15px; font-weight: 800; font-family: inherit; transition: transform 0.15s ease, background 0.15s ease; }
        .mini-btn:disabled { cursor: not-allowed; }
        .mini-btn:not(:disabled):hover { transform: translateY(-1px); }
        .export-card { background: linear-gradient(135deg, #F8FBFF, #EFF6FF); border: 1px solid #DBEAFE; border-radius: 18px; padding: 16px; }
        .empty-state { text-align: center; padding: 32px 16px; color: #6B7280; border: 1px dashed #D6E0EB; border-radius: 18px; background: #FAFCFF; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #4B5563; font-size: 15px; line-height: 1.65; }
        .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .card-title { font-size: 22px; font-weight: 900; color: #111827; margin: 0 0 6px; }
        .helper-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .small-note { font-size: 15px; color: #64748B; line-height: 1.55; }
        .setting-group { margin-top: 12px; }
        .group-label { font-size: 15px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; line-height: 1.35; }
        .toast-stack { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
        .toast { border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 16px; font-weight: 800; line-height: 1.5; }
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
          .admin-brand-logo { width: min(245px, 34vw); }
          .admin-title-copy { display: none; }
        }
        @media (max-width: 560px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .admin-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; align-items: center; }
          .topbar-title { gap: 10px; }
          .admin-brand-logo { width: min(245px, 68vw); height: 62px; }
          .admin-title-copy { display: none; }
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
            <img className="admin-brand-logo" src="/fonseca_blue.png" alt="Dr. Miguel Fonseca" />
            <div className="admin-title-copy">
              <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{isSpanish ? "Centro de control" : "Control center"}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", margin: 0 }}>{isSpanish ? "Expedientes, equipo y accesos del portal" : "Records, team, and portal access"}</p>
            </div>
          </div>
          <div className="topbar-right">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 ES</option>
              <option value="en">🇺🇸 EN</option>
            </select>
            <div className="topbar-actions">
              <button className="topbar-btn" onClick={() => goTo("/admin/ayuda")}>{isSpanish ? "Ayuda" : "Help"}</button>
              <button className="topbar-btn" onClick={() => goTo("/inbox")}>Portal</button>
              <button className="topbar-btn" onClick={() => supabase.auth.signOut().then(() => goTo("/login"))}>{isSpanish ? "Salir" : "Exit"}</button>
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
              <option value="es">🇲🇽 ES</option>
              <option value="en">🇺🇸 EN</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin/ayuda")}>{isSpanish ? "Ayuda" : "Help"}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>Portal</button>
            <button className="topbar-btn" onClick={() => supabase.auth.signOut().then(() => goTo("/login"))}>{isSpanish ? "Salir" : "Exit"}</button>
          </div>
        )}

        <div className="admin-body">
          <section className="hero">
            <div className="hero-grid">
              <div>
                <h1 className="big-title">{isSpanish ? "Centro médico administrativo" : "Medical administration center"}</h1>
                <p className="subtle">
                  {isSpanish
                    ? "Busca pacientes, revisa expedientes, administra accesos del equipo y controla invitaciones desde una sola pantalla segura."
                    : "Search patients, review records, manage team access, and control invitations from one secure screen."}
                </p>
              </div>
              <div className="hero-note">
                <p className="section-title" style={{ color: "rgba(255,255,255,0.84)", marginBottom: 8 }}>{isSpanish ? "Flujo recomendado" : "Recommended flow"}</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.6 }}>
                  {isSpanish
                    ? "Primero busca al paciente. Después abre su expediente. Las acciones sensibles quedan separadas y confirmadas."
                    : "Search for the patient first. Then open the record. Sensitive actions stay separated and confirmed."}
                </p>
              </div>
            </div>
          </section>

          <section className="stats-grid" aria-label={isSpanish ? "Resumen administrativo" : "Administrative summary"}>
            <button type="button" className="stat-card" onClick={() => scrollToAdminSection("pacientes-activos")}>
              <div className="stat-icon">🏥</div>
              <p className="stat-label">{isSpanish ? "Pacientes activos" : "Active patients"}</p>
              <p className="stat-value">{activePatientCount}</p>
              <p className="stat-help">{isSpanish ? "Lista completa de pacientes" : "Complete patient list"}</p>
            </button>
            <button type="button" className="stat-card" onClick={() => scrollToAdminSection("staff-to-staff")}>
              <div className="stat-icon">💬</div>
              <p className="stat-label">{isSpanish ? "Comunicación interna" : "Internal chat"}</p>
              <p className="stat-value">{staffPrivateConversations.length}</p>
              <p className="stat-help">{isSpanish ? "Conversaciones privadas del equipo" : "Private staff conversations"}</p>
            </button>
            <button type="button" className="stat-card" onClick={() => scrollToAdminSection("equipo")}>
              <div className="stat-icon">👥</div>
              <p className="stat-label">{isSpanish ? "Equipo" : "Team"}</p>
              <p className="stat-value">{staff.length}</p>
              <p className="stat-help">{isSpanish ? `${adminAccessCount} con acceso admin` : `${adminAccessCount} with admin access`}</p>
            </button>
            <button type="button" className="stat-card" onClick={() => scrollToAdminSection("bloqueos")}>
              <div className="stat-icon">🔒</div>
              <p className="stat-label">{isSpanish ? "Bloqueos" : "Blocks"}</p>
              <p className="stat-value">{blockedAccessCount}</p>
              <p className="stat-help">{isSpanish ? "Correos y teléfonos restringidos" : "Restricted emails and phones"}</p>
            </button>
          </section>

          <div className="workspace-grid">
            <div className="stack">
              <section className="card" id="staff-to-staff">
                <div className="header-row">
                  <div>
	                    <p className="card-title">{isSpanish ? "Comunicación interna del equipo" : "Internal Team Communication"}</p>
	                    <p className="muted">
	                      {isSpanish
	                        ? "Lista administrativa para revisar y exportar conversaciones privadas entre miembros del equipo."
	                        : "Administrative list for reviewing and exporting private staff-to-staff conversations."}
                    </p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
	                  {staffPrivateConversations.length === 0 ? (
	                    <p className="muted">{isSpanish ? "Todavía no hay conversaciones privadas staff a staff registradas en la app." : "No app-recorded private staff-to-staff conversations yet."}</p>
	                  ) : (
	                    staffPrivateConversations.map((conversation) => (
	                      <button
	                        key={`staff-chat-${conversation.key}`}
	                        type="button"
	                        className="list-action-row"
	                        onClick={() => openStaffChatExportMenu(conversation)}
	                      >
	                        <span className="avatar small-avatar">{initials(conversation.title)}</span>
	                        <span style={{ minWidth: 0, flex: 1 }}>
	                          <strong>{conversation.title}</strong>
	                          <span>{conversation.subtitle}</span>
	                        </span>
	                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="card" id="pacientes-activos">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Pacientes activos" : "Active patients"}</p>
                    <p className="muted">{isSpanish ? "Lista completa de pacientes activos. Toca un paciente para opciones de exportación." : "Complete active patient list. Tap a patient for export options."}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {activePatientCards.length === 0 ? (
                    <p className="muted">{isSpanish ? "No hay pacientes activos." : "No active patients."}</p>
                  ) : (
                    activePatientCards.map((card) => (
                      <button
                        key={`active-${card.patient.id}`}
                        type="button"
                        className="list-action-row"
                        onClick={() => openPatientExportMenu(card)}
                      >
                        <span className="avatar small-avatar">{initials(card.patient.full_name)}</span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <strong>{card.patient.full_name || (isSpanish ? "Paciente sin nombre" : "Unnamed patient")}</strong>
                          <span>{card.patient.phone || (isSpanish ? "Sin teléfono" : "No phone")} · {card.patient.email || (isSpanish ? "Sin correo" : "No email")}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>

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
                          {card.procedures.length} {isSpanish ? "procedimiento(s)" : "procedure(s)"} · {card.rooms.length} chat(s) · {isSpanish ? "Última cirugía" : "Last surgery"}: {formatDate(card.latestSurgery)}
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
                            {isSpanish ? "Exportar datos" : "Export data"}
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
              <section className="card team-card" id="equipo">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Equipo y permisos" : "Team and permissions"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Nombre, teléfono, correo y acceso administrativo en una vista compacta."
                        : "Name, phone, email, and admin access in a compact view."}
                    </p>
                  </div>
                </div>

                {staff.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: 34, marginBottom: 8 }}>👥</div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "Todavía no hay equipo" : "No team members yet"}</p>
                    <p className="muted">{isSpanish ? "Cuando se registren aparecerán aquí." : "They will appear here once they register."}</p>
                  </div>
                ) : (
                  staff.map((member) => {
                    const memberEmail = member.id === viewerId ? viewerEmail : member.email || "";
                    const contactLine = [member.phone, memberEmail].filter(Boolean).join(" · ");
                    const level = normalizeAdminLevel(member.admin_level, memberEmail);
                    const canEditThisMember = canManageAdmins && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const isSelf = member.id === viewerId;
                    const canDeleteThisMember = canManageAdmins && !isSelf && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const accessKey = `${member.id}-admin_level`;
                    const nameKey = `${member.id}-full_name-display_name`;
                    const phoneKey = `${member.id}-phone`;
                    const nameDraft = staffNameDrafts[member.id] ?? (member.full_name || member.display_name || "");
                    const cleanNameDraft = nameDraft.trim();
                    const phoneDraft = staffPhoneDrafts[member.id] ?? (member.phone || "");
                    const cleanPhoneDraft = phoneDraft.trim();
                    const deleteBusy = deletingStaffId === member.id;

                    return (
                      <div key={member.id} className="staff-row compact">
                        <div className="avatar">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            initials(member.full_name || member.display_name)
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
	                          <div className="staff-heading-line">
	                            <div style={{ minWidth: 0 }}>
	                              <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 2 }}>{member.full_name || member.display_name || (isSpanish ? "Sin nombre" : "No name")}</p>
	                              <p className="staff-contact">{contactLine || (isSpanish ? "Sin teléfono o correo registrado" : "No phone or email listed")}</p>
	                            </div>
	                          </div>

	                          <details className="staff-controls">
	                            <summary>
	                              {isSpanish ? "Ajustar permisos" : "Adjust permissions"}
	                              <span>⌄</span>
	                            </summary>
		                            <div className="staff-controls-body">
                                  <div className="setting-group">
                                    <p className="group-label">{isSpanish ? "Nombre" : "Name"}</p>
                                    <div className="mini-actions" style={{ alignItems: "stretch" }}>
                                      <input
                                        className="line-input"
                                        value={nameDraft}
                                        disabled={!canEditThisMember}
                                        onChange={(event) => setStaffNameDrafts((current) => ({ ...current, [member.id]: event.target.value }))}
                                        placeholder={isSpanish ? "Nombre visible" : "Display name"}
                                        style={{ minWidth: 180, flex: "1 1 220px", height: 42, padding: "0 12px", fontSize: 14 }}
                                      />
                                      <button
                                        className="mini-btn"
                                        disabled={!canEditThisMember || savingKey === nameKey || !cleanNameDraft}
                                        onClick={() => updateStaffField(
                                          member,
                                          { full_name: cleanNameDraft, display_name: cleanNameDraft },
                                          isSpanish ? `Nombre actualizado a ${cleanNameDraft}.` : `Name updated to ${cleanNameDraft}.`
                                        )}
                                      >
                                        {savingKey === nameKey ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar nombre" : "Save name")}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="setting-group">
                                    <p className="group-label">{isSpanish ? "Teléfono" : "Phone"}</p>
                                    <div className="mini-actions" style={{ alignItems: "stretch" }}>
                                      <input
                                        className="line-input"
                                        value={phoneDraft}
                                        disabled={!canEditThisMember}
                                        inputMode="tel"
                                        autoComplete="tel"
                                        onChange={(event) => setStaffPhoneDrafts((current) => ({ ...current, [member.id]: event.target.value }))}
                                        placeholder="+52 664 123 4567"
                                        style={{ minWidth: 180, flex: "1 1 220px", height: 42, padding: "0 12px", fontSize: 14 }}
                                      />
                                      <button
                                        className="mini-btn"
                                        disabled={!canEditThisMember || savingKey === phoneKey}
                                        onClick={() => updateStaffField(
                                          member,
                                          { phone: cleanPhoneDraft || null },
                                          isSpanish ? `Teléfono de ${member.full_name || "staff"} actualizado.` : `Phone for ${member.full_name || "staff"} updated.`
                                        )}
                                      >
                                        {savingKey === phoneKey ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar teléfono" : "Save phone")}
                                      </button>
                                    </div>
                                  </div>
		                              <div className="setting-group">
		                                <p className="group-label">{isSpanish ? "Admin" : "Admin"}</p>
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
                                      disabled={!canEditThisMember || savingKey === accessKey || (option === "super_admin" && !canManageOwner)}
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
                              <div className="setting-group">
                                <p className="group-label">{isSpanish ? "Eliminar usuario" : "Delete user"}</p>
                                <div className="mini-actions">
                                  <button
                                    className="danger-inline-btn"
                                    disabled={!canDeleteThisMember || deleteBusy}
                                    onClick={() => deleteStaffMember(member)}
                                    title={
                                      isSelf
                                        ? (isSpanish ? "No puedes eliminar tu propia cuenta desde esta sesión." : "You cannot delete your own account from this session.")
                                        : level === "owner"
                                          ? (isSpanish ? "La cuenta propietaria está protegida." : "The owner account is protected.")
                                          : ""
                                    }
                                  >
                                    {deleteBusy ? (isSpanish ? "Eliminando..." : "Deleting...") : (isSpanish ? "Eliminar usuario" : "Delete user")}
                                  </button>
                                  {!canDeleteThisMember && (
                                    <span className="meta-badge" style={{ color: "#64748B", background: "#F1F5F9" }}>
                                      {isSelf
                                        ? (isSpanish ? "Cuenta actual" : "Current account")
                                        : level === "owner"
                                          ? (isSpanish ? "Protegido" : "Protected")
                                          : (isSpanish ? "Solo super admin" : "Super admin only")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

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

              <section className="card" id="bloqueos">
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

                <div className="secure-invite">
                  <p className="secure-invite-label">{isSpanish ? "Invitación segura" : "Secure invitation"}</p>
                  <p className="secure-invite-main">
                    {inviteLink
                      ? (isSpanish ? "Enlace listo para copiar" : "Invitation link ready to copy")
                      : (isSpanish ? "Primero carga un código de invitación" : "Load an invitation code first")}
                  </p>
                  <p className="secure-invite-code">
                    {inviteCodePreview
                      ? (isSpanish ? `Código activo: ${inviteCodePreview}` : `Active code: ${inviteCodePreview}`)
                      : (isSpanish ? "Sin código activo" : "No active code")}
                  </p>
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    <button className="main-btn" onClick={copyInviteLink} disabled={!inviteLink}>
                      {isSpanish ? "Copiar enlace" : "Copy link"}
                    </button>
                    <button className="ghost-btn" onClick={sendInviteText} disabled={!inviteLink}>
                      SMS
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
          <div className="admin-bottom-actions">
            <button type="button" className="back-top-inline-btn" onClick={scrollAdminToTop}>
              {isSpanish ? "⬆️ Volver arriba" : "⬆️ Back to top"}
            </button>
          </div>
        </div>

        {exportMenu && (
          <div className="export-overlay" onClick={() => setExportMenu(null)}>
            <div className="export-modal" onClick={(event) => event.stopPropagation()}>
              <div className="header-row" style={{ marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="card-title" style={{ margin: 0 }}>{exportMenu.title}</p>
                  <p className="muted" style={{ marginTop: 4 }}>{isSpanish ? "Opciones de exportación y compartir" : "Export and sharing options"}</p>
                </div>
                <button className="topbar-btn" onClick={() => setExportMenu(null)}>×</button>
              </div>
              <pre style={{ margin: 0, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 12, color: "#111827", fontFamily: "inherit", fontSize: 13, lineHeight: 1.45 }}>{exportMenu.body}</pre>
              <div className="export-grid">
                <button className="main-btn" onClick={shareExportMenu}>{isSpanish ? "Compartir" : "Share"}</button>
                <button className="ghost-btn" onClick={printExportMenu}>{isSpanish ? "Imprimir" : "Print"}</button>
                <button className="ghost-btn" onClick={() => { window.location.href = `https://wa.me/?text=${encodeURIComponent(exportMenu.body)}`; }}>WhatsApp</button>
                <button className="ghost-btn" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(exportMenu.title)}&body=${encodeURIComponent(exportMenu.body)}`; }}>Email</button>
                <button className="ghost-btn" onClick={() => { window.location.href = `sms:?&body=${encodeURIComponent(exportMenu.body)}`; }}>Messages</button>
                {exportMenu.type === "patient" && (
                  <button className="ghost-btn" onClick={() => handleExport(exportMenu.id)}>{isSpanish ? "Descargar" : "Download"}</button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="toast-stack" aria-live="polite">
          {pageError && <div className="toast error">⚠️ {pageError}</div>}
          {successMsg && <div className="toast success">✅ {successMsg}</div>}
        </div>
      </div>
    </>
  );
}
