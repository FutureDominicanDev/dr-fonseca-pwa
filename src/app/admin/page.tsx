"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  adminColor,
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
import {
  STAFF_PERMISSION_KEYS,
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  normalizePermissionList,
  parseStaffPermissionMap,
  permissionLabel,
  permissionPresetForAdminLevel,
  permissionsForProfile,
  type StaffPermissionMap,
  type StaffPermissionKey,
} from "@/lib/permissions";

const permissionDescriptions: Record<StaffPermissionKey, { es: string; en: string }> = {
  view_patients: { es: "Puede ver la lista y abrir chats asignados.", en: "Can view the list and open assigned chats." },
  create_patients: { es: "Puede crear pacientes, procedimientos y salas nuevas.", en: "Can create new patients, procedures, and rooms." },
  edit_patient_info: { es: "Puede editar datos clínicos y demográficos del expediente.", en: "Can edit clinical and demographic record details." },
  archive_rooms: { es: "Puede cancelar salas y sacarlas del flujo activo.", en: "Can cancel rooms and remove them from the active workflow." },
  restore_rooms: { es: "Puede restaurar salas archivadas o canceladas.", en: "Can restore archived or cancelled rooms." },
  view_clinical_history: { es: "Puede ver formularios de Historia Clinica y PDFs enviados.", en: "Can view clinical history forms and submitted PDFs." },
  view_upload_files: { es: "Puede ver y compartir archivos visibles del paciente.", en: "Can view and share patient-visible files." },
  view_internal_notes: { es: "Puede ver notas y fotos internas del equipo asignado.", en: "Can view internal notes and photos for the assigned team." },
  manage_internal_notes: { es: "Puede crear notas y fotos internas del expediente.", en: "Can create internal record notes and photos." },
  manage_labels: { es: "Puede crear y asignar etiquetas de pacientes.", en: "Can create and assign patient labels." },
  manage_staff: { es: "Puede administrar equipo, teléfonos y solicitudes.", en: "Can manage staff, phones, and access requests." },
  manage_permissions: { es: "Puede cambiar permisos de otros usuarios.", en: "Can change permissions for other users." },
  access_audit_logs: { es: "Puede revisar auditoria y eventos administrativos.", en: "Can review audit and admin events." },
  access_settings_security: { es: "Puede entrar al centro admin y ajustes de seguridad.", en: "Can enter admin center and security settings." },
};

const permissionGroups: Array<{ id: string; es: string; en: string; permissions: StaffPermissionKey[] }> = [
  { id: "patients", es: "Pacientes y salas", en: "Patients and rooms", permissions: ["view_patients", "create_patients", "edit_patient_info", "archive_rooms", "restore_rooms"] },
  { id: "clinical", es: "Expediente clinico", en: "Clinical record", permissions: ["view_clinical_history", "view_upload_files", "view_internal_notes", "manage_internal_notes", "manage_labels"] },
  { id: "admin", es: "Administracion y seguridad", en: "Administration and security", permissions: ["manage_staff", "manage_permissions", "access_audit_logs", "access_settings_security"] },
];

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

type StaffAccessRequest = {
  id: string;
  patient_id?: string | null;
  room_id?: string | null;
  requested_by?: string | null;
  target_staff_id?: string | null;
  requested_staff_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AdminSectionId =
  | "buscar-paciente"
  | "equipo"
  | "solicitudes-pendientes"
  | "staff-to-staff"
  | "herramientas-expediente"
  | "invitar-personal"
  | "telefonos-sede"
  | "bloqueos";

export default function AdminPage() {
  const { lang, setLang, isSpanish } = useAdminLang();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [pendingAccessRequests, setPendingAccessRequests] = useState<StaffAccessRequest[]>([]);
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
  const [staffPhoneDrafts, setStaffPhoneDrafts] = useState<Record<string, string>>({});
  const [deletingStaffId, setDeletingStaffId] = useState("");
  const [unblockBusyKey, setUnblockBusyKey] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSectionId | "">("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState<{ type: "patient" | "staff"; id: string; title: string; body: string } | null>(null);
  const [staffPermissionMap, setStaffPermissionMap] = useState<StaffPermissionMap>({});

  const viewerPermissionProfile = viewerProfile
    ? { ...viewerProfile, permissions: staffPermissionMap[viewerProfile.id] ?? viewerProfile.permissions }
    : null;
  const hasAdminAccess = hasPermission(viewerPermissionProfile, viewerEmail, "access_settings_security");
  const canManageAdmins = hasPermission(viewerPermissionProfile, viewerEmail, "manage_staff");
  const canManagePermissions = hasPermission(viewerPermissionProfile, viewerEmail, "manage_permissions");
  const canManageOwner = isOwnerEmail(viewerEmail);
  const canReviewAccessRequests = hasPermission(viewerPermissionProfile, viewerEmail, "manage_staff");

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
      ? (
          {
            owner: "👑 Propietario",
            super_admin: "Avanzado",
            admin: "Crear pacientes",
            none: "Solo chats",
          } as const
        )[level]
      : (
          {
            owner: "👑 Owner",
            super_admin: "Advanced",
            admin: "Create patients",
            none: "Assigned chats",
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
  const blockedAccessCount = blockedEmails.length + blockedPhones.length;
  const inviteCodePreview = inviteCode ? `${inviteCode.slice(0, Math.min(7, inviteCode.length))}••••` : "";
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const procedureById = useMemo(() => new Map(procedures.map((procedure) => [procedure.id, procedure])), [procedures]);
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const accessRequestTargetId = (request: StaffAccessRequest) => request.target_staff_id || request.requested_staff_id || "";
  const accessRequestPatientName = (request: StaffAccessRequest) => {
    const patientId = request.patient_id || (request.room_id ? procedureById.get(roomById.get(request.room_id)?.procedure_id || "")?.patient_id : "");
    return patientById.get(patientId || "")?.full_name || (isSpanish ? "Paciente sin nombre" : "Unnamed patient");
  };
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

  const adminNavItems = ([
    {
      id: "buscar-paciente",
      code: "PT",
      label: isSpanish ? "Pacientes" : "Patients",
      detail: isSpanish ? "Buscar y abrir expedientes" : "Search and open records",
      metric: `${activePatientCount}`,
    },
    {
      id: "equipo",
      code: "EQ",
      label: isSpanish ? "Equipo" : "Team",
      detail: isSpanish ? "Usuarios, teléfonos y permisos" : "Users, phones, and rights",
      metric: `${staff.length}`,
    },
    {
      id: "solicitudes-pendientes",
      code: "AC",
      label: isSpanish ? "Solicitudes" : "Requests",
      detail: isSpanish ? "Acceso pendiente a salas" : "Pending room access",
      metric: `${pendingAccessRequests.length}`,
      visible: canReviewAccessRequests,
    },
    {
      id: "staff-to-staff",
      code: "CH",
      label: isSpanish ? "Chat staff" : "Staff chat",
      detail: isSpanish ? "Conversaciones internas" : "Internal conversations",
      metric: `${staffPrivateConversations.length}`,
    },
    {
      id: "herramientas-expediente",
      code: "AR",
      label: isSpanish ? "Archivo" : "Archive",
      detail: isSpanish ? "Auditoría, archivo y papelera" : "Audit, archive, and trash",
    },
    {
      id: "invitar-personal",
      code: "IN",
      label: isSpanish ? "Invitar" : "Invite",
      detail: isSpanish ? "Alta segura de personal" : "Secure staff onboarding",
    },
    {
      id: "telefonos-sede",
      code: "TL",
      label: isSpanish ? "Teléfonos" : "Phones",
      detail: isSpanish ? "Números por consultorio" : "Office numbers",
    },
    {
      id: "bloqueos",
      code: "BL",
      label: isSpanish ? "Bloqueos" : "Blocked",
      detail: isSpanish ? "Correos y teléfonos bloqueados" : "Blocked emails and phones",
      metric: `${blockedAccessCount}`,
    },
  ] satisfies Array<{
    id: AdminSectionId;
    code: string;
    label: string;
    detail: string;
    metric?: string;
    visible?: boolean;
  }>).filter((item) => item.visible !== false);

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

  const openAdminSection = (id: AdminSectionId) => {
    setActiveAdminSection(id);
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById("admin-active-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const scrollAdminToTop = () => {
    const shell = document.querySelector(".admin-shell");
    if (shell instanceof HTMLElement) {
      shell.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderSectionTopButton = () => (
    <button type="button" className="section-top-btn" onClick={scrollAdminToTop}>
      {isSpanish ? "Arriba" : "Top"}
    </button>
  );

  const fetchData = async () => {
    setPageError("");

    const [staffRes, patientsRes, proceduresRes, roomsRes, staffPrivateMessagesRes, accessRequestsRes, inviteRes, blockedEmailsRes, blockedPhonesRes, gdlPhoneRes, tjnPhoneRes, staffPermissionsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("procedures").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("staff_private_messages").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("staff_access_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "office_phone_guadalajara").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "office_phone_tijuana").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);

    const issues = [
      staffRes.error ? "No pude cargar el equipo." : "",
      patientsRes.error ? "No pude cargar los pacientes." : "",
      proceduresRes.error ? "No pude cargar los procedimientos." : "",
      roomsRes.error ? "No pude cargar las salas." : "",
      accessRequestsRes.error ? "No pude cargar solicitudes pendientes." : "",
      inviteRes.error ? "No pude cargar el código de invitación." : "",
      blockedEmailsRes.error ? "No pude cargar correos bloqueados." : "",
      blockedPhonesRes.error ? "No pude cargar teléfonos bloqueados." : "",
      gdlPhoneRes.error ? "No pude cargar el teléfono de Guadalajara." : "",
      tjnPhoneRes.error ? "No pude cargar el teléfono de Tijuana." : "",
      staffPermissionsRes.error ? "No pude cargar permisos del equipo." : "",
    ].filter(Boolean);

    setStaff((staffRes.data || []) as StaffProfile[]);
    setPatients((patientsRes.data || []) as PatientRecord[]);
    setProcedures((proceduresRes.data || []) as ProcedureRecord[]);
    setRooms((roomsRes.data || []) as RoomRecord[]);
    setStaffPrivateMessages(staffPrivateMessagesRes.error ? [] : ((staffPrivateMessagesRes.data || []) as StaffPrivateMessage[]));
    setPendingAccessRequests(accessRequestsRes.error ? [] : ((accessRequestsRes.data || []) as StaffAccessRequest[]));
    setInviteCode((inviteRes.data?.value as string) || "");
    setBlockedEmails(parseSettingList(blockedEmailsRes.data?.value).map((item) => item.toLowerCase()));
    setBlockedPhones(parseSettingList(blockedPhonesRes.data?.value));
    setOfficePhoneGdl((gdlPhoneRes.data?.value as string) || "");
    setOfficePhoneTjn((tjnPhoneRes.data?.value as string) || "");
    setStaffPermissionMap(parseStaffPermissionMap(staffPermissionsRes.data?.value));

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

    const [{ data: profile }, staffPermissionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const loadedStaffPermissionMap = parseStaffPermissionMap(staffPermissionsRes.data?.value);
    setStaffPermissionMap(loadedStaffPermissionMap);
    setViewerProfile(profile || null);

    if (isOwnerEmail(email)) {
      const { error } = await supabase.from("profiles").update({ admin_level: "owner" }).eq("id", user.id);
      if (!error) {
        setViewerProfile((prev) => ({ ...(prev || { id: user.id }), admin_level: "owner" }));
      }
    }

    const computedProfile = profile ? { ...(profile as StaffProfile), permissions: loadedStaffPermissionMap[user.id] ?? (profile as StaffProfile).permissions } : null;
    const computedAccess = hasPermission(computedProfile, email, "access_settings_security");
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

  const updateStaffPermissions = async (member: StaffProfile, nextPermissions: StaffPermissionKey[], success: string) => {
    const cleanPermissions = STAFF_PERMISSION_KEYS.filter((permission) => nextPermissions.includes(permission));
    const nextMap = { ...staffPermissionMap, [member.id]: cleanPermissions };
    setSavingKey(`${member.id}-permissions`);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: STAFF_PERMISSIONS_SETTING_KEY, value: JSON.stringify(nextMap), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    setSavingKey("");

    if (error) {
      setPageError(error.message || (isSpanish ? "No pude guardar permisos." : "I could not save permissions."));
      return;
    }

    setStaffPermissionMap(nextMap);
    await logAdminEvent({
      action: "staff_permissions_updated",
      entityType: "staff_profile",
      entityId: member.id,
      entityName: member.full_name || member.display_name || "Personal",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: success,
      metadata: { permissions: cleanPermissions },
    });
    updateSuccess(success);
  };

  const applyStaffAccessPreset = async (member: StaffProfile, level: AdminLevel, success: string) => {
    const nextPermissions = permissionPresetForAdminLevel(level);
    const nextMap = { ...staffPermissionMap, [member.id]: nextPermissions };
    setSavingKey(`${member.id}-admin_level`);
    const [profileUpdate, permissionsUpdate] = await Promise.all([
      supabase.from("profiles").update({ admin_level: level }).eq("id", member.id),
      supabase
        .from("app_settings")
        .upsert(
          { key: STAFF_PERMISSIONS_SETTING_KEY, value: JSON.stringify(nextMap), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        ),
    ]);
    setSavingKey("");

    const error = profileUpdate.error || permissionsUpdate.error;
    if (error) {
      setPageError(error.message || (isSpanish ? "No pude guardar el preset de acceso." : "I could not save the access preset."));
      return;
    }

    setStaff((previous) => previous.map((item) => (item.id === member.id ? { ...item, admin_level: level } : item)));
    setStaffPermissionMap(nextMap);
    await logAdminEvent({
      action: "staff_permissions_preset_applied",
      entityType: "staff_profile",
      entityId: member.id,
      entityName: member.full_name || member.display_name || "Personal",
      actorId: viewerId,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: success,
      metadata: { admin_level: level, permissions: nextPermissions },
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

  const approveAccessRequest = async (request: StaffAccessRequest) => {
    if (!canReviewAccessRequests) return;
    const targetStaffId = accessRequestTargetId(request);
    if (!request.room_id || !targetStaffId) {
      setPageError(isSpanish ? "Solicitud incompleta." : "Incomplete request.");
      return;
    }

    setSavingKey(`access-request-${request.id}`);
    const targetStaff = staffById.get(targetStaffId);
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: request.room_id,
      user_id: targetStaffId,
      role: targetStaff?.role || "staff",
    });

    if (memberError) {
      setSavingKey("");
      setPageError(memberError.message || (isSpanish ? "No pude aprobar la solicitud." : "I could not approve the request."));
      return;
    }

    const { error: requestError } = await supabase
      .from("staff_access_requests")
      .update({ status: "approved", reviewed_by: viewerId || null, reviewed_at: new Date().toISOString() })
      .eq("id", request.id);

    setSavingKey("");
    if (requestError) {
      setPageError(requestError.message || (isSpanish ? "No pude cerrar la solicitud." : "I could not close the request."));
      return;
    }

    setPendingAccessRequests((current) => current.filter((item) => item.id !== request.id));
    updateSuccess(isSpanish ? "Solicitud aprobada." : "Request approved.");
  };

  const rejectAccessRequest = async (request: StaffAccessRequest) => {
    if (!canReviewAccessRequests) return;
    setSavingKey(`access-request-${request.id}`);
    const { error } = await supabase
      .from("staff_access_requests")
      .update({ status: "rejected", reviewed_by: viewerId || null, reviewed_at: new Date().toISOString() })
      .eq("id", request.id);

    setSavingKey("");
    if (error) {
      setPageError(error.message || (isSpanish ? "No pude rechazar la solicitud." : "I could not reject the request."));
      return;
    }

    setPendingAccessRequests((current) => current.filter((item) => item.id !== request.id));
    updateSuccess(isSpanish ? "Solicitud rechazada." : "Request rejected.");
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
        body { background: #F2F6FB; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; overflow-x: hidden; }
        .admin-shell { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: radial-gradient(circle at 18% 0%, rgba(29,78,216,0.10), transparent 28%), #F2F6FB; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.55; }
        .admin-topbar { background: #07334D; backdrop-filter: blur(18px); min-height: calc(86px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 10px; position: sticky; top: 0; z-index: 100; box-shadow: 0 8px 26px rgba(7,51,77,0.22); }
        .admin-body { width: 100%; max-width: 1440px; margin: 0 auto; padding: 20px max(18px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); }
        .admin-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
        .admin-sidebar { position: sticky; top: calc(104px + env(safe-area-inset-top)); align-self: start; min-height: calc(100dvh - 138px - env(safe-area-inset-top)); background: rgba(255,255,255,0.96); border: 1px solid rgba(102,132,163,0.16); border-radius: 24px; padding: 16px; box-shadow: 0 18px 55px rgba(28,66,104,0.10); }
        .sidebar-practice { display: flex; align-items: center; gap: 12px; padding: 8px 8px 14px; border-bottom: 1px solid #E6EEF7; margin-bottom: 14px; }
        .sidebar-logo-mark { width: 42px; height: 42px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: #0B3B59; color: white; font-size: 14px; font-weight: 950; letter-spacing: 0.04em; flex-shrink: 0; }
        .sidebar-practice strong { display: block; color: #0F172A; font-size: 15px; font-weight: 950; line-height: 1.15; }
        .sidebar-practice span:not(.sidebar-logo-mark) { display: block; color: #64748B; font-size: 12px; font-weight: 800; margin-top: 3px; line-height: 1.25; }
        .sidebar-stat-card { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; border-radius: 18px; background: linear-gradient(135deg, #F8FBFF, #EEF6FF); border: 1px solid #DBEAFE; margin-bottom: 14px; }
        .sidebar-stat { min-width: 0; }
        .sidebar-stat strong { display: block; color: #0F172A; font-size: 20px; line-height: 1; font-weight: 950; }
        .sidebar-stat span { display: block; color: #64748B; font-size: 11px; font-weight: 850; line-height: 1.25; margin-top: 5px; }
        .sidebar-section-label { color: #64748B; font-size: 11px; font-weight: 950; letter-spacing: 0.10em; text-transform: uppercase; margin: 6px 8px 8px; }
        .sidebar-nav { display: grid; gap: 6px; }
        .sidebar-btn { width: 100%; min-height: 58px; display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 10px; align-items: center; border-radius: 16px; border: 1px solid transparent; background: transparent; color: #334155; padding: 9px; text-align: left; cursor: pointer; font-family: inherit; }
        .sidebar-btn:hover, .sidebar-btn:focus-visible { background: #F8FBFF; border-color: #D7E7FA; outline: none; }
        .sidebar-btn.active { background: #EFF6FF; border-color: #BFDBFE; box-shadow: 0 10px 26px rgba(29,78,216,0.10); color: #0F172A; }
        .nav-icon { width: 38px; height: 38px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; background: #EEF2F7; color: #475569; font-size: 11px; font-weight: 950; letter-spacing: 0.04em; }
        .sidebar-btn.active .nav-icon { background: #1D4ED8; color: white; }
        .nav-copy { min-width: 0; }
        .nav-copy strong { display: block; color: inherit; font-size: 14px; font-weight: 950; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-copy span { display: block; color: #64748B; font-size: 12px; font-weight: 750; line-height: 1.25; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-metric { min-width: 26px; height: 26px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; background: #E2E8F0; color: #334155; font-size: 12px; font-weight: 950; }
        .sidebar-btn.active .nav-metric { background: #DBEAFE; color: #1D4ED8; }
        .sidebar-footer { display: grid; gap: 7px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #E6EEF7; }
        .sidebar-link-btn { min-height: 42px; border-radius: 14px; border: 1px solid #E6EEF7; background: #F8FAFC; color: #334155; font-size: 13px; font-weight: 900; font-family: inherit; cursor: pointer; text-align: left; padding: 0 12px; }
        .sidebar-link-btn:hover, .sidebar-link-btn:focus-visible { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; outline: none; }
        .admin-main-panel { min-width: 0; }
        .topbar-title { min-width: 0; display: flex; align-items: center; gap: 14px; flex: 1 1 auto; }
        .admin-brand-logo { width: min(270px, 31vw); height: 64px; object-fit: contain; object-position: left center; display: block; }
        .admin-title-copy { min-width: 0; padding-left: 14px; border-left: 1px solid rgba(255,255,255,0.18); }
        .topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; flex: 0 0 auto; }
        .topbar-actions { display: flex; gap: 7px; flex-wrap: nowrap; justify-content: flex-end; }
        .topbar-btn { min-height: 44px; padding: 0 12px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 850; font-size: 15px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 96px; min-height: 44px; padding: 0 28px 0 12px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 850; font-size: 16px !important; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 15px) calc(50% - 3px), calc(100% - 10px) calc(50% - 3px); background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #0B2438 0%, #0E3F63 58%, #155C95 100%); color: white; border-radius: 24px; padding: 24px 26px; margin-bottom: 16px; box-shadow: 0 18px 50px rgba(7,51,77,0.18); border: 1px solid rgba(255,255,255,0.12); }
        .hero-grid { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: end; }
        .workspace-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr); gap: 16px; align-items: start; }
        .workspace-grid.active-workspace { grid-template-columns: minmax(0, 1fr); }
        .card { background: rgba(255,255,255,0.98); border: 1px solid rgba(102,132,163,0.14); border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(28,66,104,0.06); }
        .section-title { font-size: 15px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; line-height: 1.35; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .subtle { color: rgba(255,255,255,0.84); line-height: 1.6; font-size: 15px; }
        .quick-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .hero-link { min-height: 44px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .hero-link:disabled { opacity: 0.5; cursor: not-allowed; }
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
        .command-strip { display: none; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0 0 18px; }
        .command-btn { min-height: 78px; padding: 14px 15px; border-radius: 16px; border: 1px solid #D7E7FA; background: #FFFFFF; color: #0E2D4A; text-align: left; font-family: inherit; cursor: pointer; box-shadow: 0 8px 22px rgba(28,66,104,0.05); }
        .command-btn strong { display: block; font-size: 17px; font-weight: 950; line-height: 1.25; }
        .command-btn span { display: block; margin-top: 5px; color: #64748B; font-size: 14px; font-weight: 750; line-height: 1.35; }
        .command-btn:hover, .command-btn:focus-visible, .command-btn.active { border-color: #93C5FD; background: #F8FBFF; outline: none; }
        .admin-section-search { order: 1; }
        .admin-section-results { order: 2; }
        .admin-section-requests { order: 3; }
        .admin-section-internal { order: 4; }
        .admin-side-team { order: 1; }
        .admin-side-invite { order: 2; }
        .admin-side-phones { order: 3; }
        .admin-side-tools { order: 4; }
        .admin-side-blocks { order: 5; }
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
        .staff-badge-row { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 8px; }
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
        .section-top-btn { min-height: 40px; padding: 9px 13px; border-radius: 999px; border: 1px solid #DBEAFE; background: #EFF6FF; color: #1D4ED8; font-size: 13px; font-weight: 900; font-family: inherit; cursor: pointer; white-space: nowrap; }
        .access-help { padding: 10px 12px; border-radius: 14px; background: #F8FAFC; border: 1px solid #E6EEF7; color: #64748B; font-size: 14px; line-height: 1.45; font-weight: 700; }
        .permission-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
        .permission-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .permission-card { border: 1px solid #E6EEF7; background: #FFFFFF; border-radius: 14px; padding: 12px; min-width: 0; }
        .permission-card-title { color: #075EA8; font-size: 14px; font-weight: 950; margin: 0 0 9px; line-height: 1.25; }
        .permission-list { display: grid; gap: 7px; }
        .permission-row { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 9px; align-items: start; padding: 9px; border-radius: 12px; border: 1px solid #E9F0F8; background: #F8FAFC; cursor: pointer; }
        .permission-row.enabled { background: #EFF6FF; border-color: #BFDBFE; }
        .permission-row input { width: 18px; height: 18px; margin-top: 2px; accent-color: #1D4ED8; }
        .permission-row strong { display: block; color: #111827; font-size: 13px; line-height: 1.25; font-weight: 900; }
        .permission-row small { display: block; color: #64748B; font-size: 12px; line-height: 1.35; font-weight: 650; margin-top: 3px; }
        .permission-row:has(input:disabled) { cursor: not-allowed; opacity: 0.64; }
        .permission-locked { color: #64748B; font-size: 13px; font-weight: 750; line-height: 1.45; margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #F8FAFC; border: 1px dashed #D6E0EB; }
        .admin-overview { display: grid; gap: 18px; }
        .overview-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
        .overview-kicker { color: #1D4ED8; font-size: 13px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px; }
        .overview-title { color: #0F172A; font-size: 26px; font-weight: 950; line-height: 1.1; margin: 0; }
        .overview-copy { color: #64748B; font-size: 15px; font-weight: 700; line-height: 1.55; margin-top: 8px; max-width: 680px; }
        .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .overview-tile { min-height: 118px; border-radius: 18px; border: 1px solid #E6EEF7; background: #F8FAFC; padding: 15px; display: grid; align-content: space-between; }
        .overview-tile strong { display: block; color: #0F172A; font-size: 28px; line-height: 1; font-weight: 950; }
        .overview-tile span { display: block; color: #64748B; font-size: 13px; line-height: 1.35; font-weight: 850; margin-top: 7px; }
        .overview-actions { display: flex; flex-wrap: wrap; gap: 9px; }
        @media (max-width: 980px) {
          .hero-grid, .workspace-grid, .grid-2, .grid-3, .permission-grid { grid-template-columns: 1fr; }
          .admin-layout { grid-template-columns: 236px minmax(0, 1fr); gap: 12px; }
          .admin-sidebar { padding: 12px; border-radius: 20px; }
          .sidebar-stat-card { grid-template-columns: 1fr; }
          .overview-grid { grid-template-columns: 1fr 1fr; }
          .admin-brand-logo { width: min(245px, 34vw); }
          .admin-title-copy { display: none; }
        }
        @media (max-width: 720px) {
          .admin-layout { display: block; }
          .admin-sidebar { display: none; }
          .command-strip { display: grid; grid-template-columns: 1fr 1fr; }
          .overview-header { flex-direction: column; }
          .overview-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
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
          .command-strip { grid-template-columns: 1fr 1fr; }
          .command-btn { min-height: 64px; padding: 11px 12px; }
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
          </div>
        )}

        <div className="admin-body">
          <div className="admin-layout">
            <aside className="admin-sidebar" aria-label={isSpanish ? "Navegación administrativa" : "Admin navigation"}>
              <div className="sidebar-practice">
                <span className="sidebar-logo-mark">DF</span>
                <div style={{ minWidth: 0 }}>
                  <strong>Dr. Fonseca</strong>
                  <span>{isSpanish ? "Portal médico" : "Medical portal"}</span>
                </div>
              </div>
              <div className="sidebar-stat-card">
                <div className="sidebar-stat">
                  <strong>{activePatientCount}</strong>
                  <span>{isSpanish ? "Pacientes activos" : "Active patients"}</span>
                </div>
                <div className="sidebar-stat">
                  <strong>{staff.length}</strong>
                  <span>{isSpanish ? "Usuarios staff" : "Staff users"}</span>
                </div>
              </div>
              <p className="sidebar-section-label">{isSpanish ? "Administración" : "Administration"}</p>
              <nav className="sidebar-nav">
                {adminNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-btn ${activeAdminSection === item.id ? "active" : ""}`}
                    onClick={() => openAdminSection(item.id)}
                  >
                    <span className="nav-icon">{item.code}</span>
                    <span className="nav-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </span>
                    {item.metric !== undefined && <span className="nav-metric">{item.metric}</span>}
                  </button>
                ))}
              </nav>
              <div className="sidebar-footer">
                <button type="button" className="sidebar-link-btn" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? (isSpanish ? "Actualizando..." : "Refreshing...") : (isSpanish ? "Actualizar datos" : "Refresh data")}
                </button>
                <button type="button" className="sidebar-link-btn" onClick={() => goTo("/admin/auditoria")}>
                  {isSpanish ? "Auditoría" : "Audit log"}
                </button>
                <button type="button" className="sidebar-link-btn" onClick={() => goTo("/admin/papelera")}>
                  {isSpanish ? "Papelera y archivo" : "Trash and archive"}
                </button>
              </div>
            </aside>

            <main className="admin-main-panel">
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
                </div>
              </section>

              <section className="command-strip" aria-label={isSpanish ? "Navegación del centro administrativo" : "Admin center navigation"}>
                {adminNavItems.map((item) => (
                  <button key={item.id} type="button" className={`command-btn ${activeAdminSection === item.id ? "active" : ""}`} onClick={() => openAdminSection(item.id)}>
                    <strong>{item.label}</strong>
                    <span>{item.metric !== undefined ? `${item.metric} · ${item.detail}` : item.detail}</span>
                  </button>
                ))}
              </section>

              {!activeAdminSection && (
                <section id="admin-active-section" className="card admin-overview">
                  <div className="overview-header">
                    <div>
                      <p className="overview-kicker">{isSpanish ? "Vista de escritorio" : "Desktop view"}</p>
                      <h2 className="overview-title">{isSpanish ? "Elige una sección del panel lateral" : "Choose a section from the sidebar"}</h2>
                      <p className="overview-copy">
                        {isSpanish
                          ? "El panel mantiene las herramientas separadas por trabajo: pacientes, equipo, permisos, solicitudes, archivo e invitaciones."
                          : "The panel keeps tools separated by job: patients, team, permissions, requests, archive, and invitations."}
                      </p>
                    </div>
                    <button type="button" className="main-btn" onClick={() => openAdminSection("buscar-paciente")}>
                      {isSpanish ? "Buscar paciente" : "Find patient"}
                    </button>
                  </div>
                  <div className="overview-grid">
                    <div className="overview-tile">
                      <strong>{activePatientCount}</strong>
                      <span>{isSpanish ? "Pacientes activos visibles para flujo normal" : "Active patients in the normal workflow"}</span>
                    </div>
                    <div className="overview-tile">
                      <strong>{staff.length}</strong>
                      <span>{isSpanish ? "Cuentas del equipo configurables" : "Configurable team accounts"}</span>
                    </div>
                    <div className="overview-tile">
                      <strong>{pendingAccessRequests.length}</strong>
                      <span>{isSpanish ? "Solicitudes pendientes de acceso" : "Pending access requests"}</span>
                    </div>
                    <div className="overview-tile">
                      <strong>{blockedAccessCount}</strong>
                      <span>{isSpanish ? "Correos o teléfonos bloqueados" : "Blocked emails or phones"}</span>
                    </div>
                  </div>
                  <div className="overview-actions">
                    <button type="button" className="ghost-btn" onClick={() => openAdminSection("equipo")}>
                      {isSpanish ? "Administrar equipo" : "Manage team"}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => openAdminSection("invitar-personal")}>
                      {isSpanish ? "Invitar personal" : "Invite staff"}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => openAdminSection("herramientas-expediente")}>
                      {isSpanish ? "Abrir herramientas" : "Open tools"}
                    </button>
                  </div>
                </section>
              )}

              {activeAdminSection && (
          <div id="admin-active-section" className="workspace-grid active-workspace">
            <div className="stack">
              {activeAdminSection === "staff-to-staff" && (
              <section className="card admin-section-internal" id="staff-to-staff">
                <div className="header-row">
                  <div>
	                    <p className="card-title">{isSpanish ? "Comunicación interna del equipo" : "Internal Team Communication"}</p>
	                    <p className="muted">
	                      {isSpanish
	                        ? "Lista administrativa para revisar y exportar conversaciones privadas entre miembros del equipo."
	                        : "Administrative list for reviewing and exporting private staff-to-staff conversations."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
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
              )}

              {canReviewAccessRequests && activeAdminSection === "solicitudes-pendientes" && (
                <section className="card admin-section-requests" id="solicitudes-pendientes">
                  <div className="header-row">
                    <div>
                      <p className="card-title">Solicitudes pendientes</p>
                      <p className="muted">{isSpanish ? "Revisa quién pidió acceso a un paciente." : "Review who requested access to a patient."}</p>
                    </div>
                    {renderSectionTopButton()}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pendingAccessRequests.length === 0 ? (
                      <p className="muted">{isSpanish ? "No hay solicitudes pendientes." : "No pending requests."}</p>
                    ) : (
                      pendingAccessRequests.map((request) => {
                        const targetStaffId = accessRequestTargetId(request);
                        const targetStaff = staffById.get(targetStaffId);
                        const busy = savingKey === `access-request-${request.id}`;
                        return (
                          <div key={request.id} className="list-action-row">
                            <span className="avatar small-avatar">{initials(targetStaff?.full_name || targetStaff?.display_name)}</span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <strong>{targetStaff?.full_name || targetStaff?.display_name || (isSpanish ? "Personal" : "Staff")}</strong>
                              <span>{accessRequestPatientName(request)}</span>
                            </span>
                            <div className="inline-actions">
                              <button className="mini-btn" disabled={busy} onClick={() => approveAccessRequest(request)} style={{ background: "#DCFCE7", color: "#166534" }}>
                                {busy ? (isSpanish ? "Guardando..." : "Saving...") : "Aprobar"}
                              </button>
                              <button className="mini-btn" disabled={busy} onClick={() => rejectAccessRequest(request)} style={{ background: "#FEE2E2", color: "#B91C1C" }}>
                                {busy ? (isSpanish ? "Guardando..." : "Saving...") : "Rechazar"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {activeAdminSection === "buscar-paciente" && (
              <section className="card search-panel admin-section-search" id="buscar-paciente">
                <div className="header-row" style={{ marginBottom: 0 }}>
                  <div>
                    <p className="card-title">{isSpanish ? "Buscar paciente" : "Find patient"}</p>
                    <p className="muted">{isSpanish ? "Escribe nombre, teléfono, correo o procedimiento y después toca buscar." : "Type a name, phone, email, or procedure, then tap search."}</p>
                  </div>
                  {renderSectionTopButton()}
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

                  {hasActiveSearch && (
                    <div className="search-status">
                      {patientCards.length > 0 ? (
                        isSpanish
                          ? `Encontré ${patientCards.length} expediente(s). Ahora solo elige al paciente correcto y abre su expediente.`
                          : `I found ${patientCards.length} record(s). Now simply choose the right patient and open the record.`
                      ) : (
                        isSpanish
                          ? "No encontré coincidencias. Prueba con menos palabras o intenta otro dato del paciente."
                          : "No matches found. Try fewer words or a different patient detail."
                      )}
                    </div>
                  )}
                </div>
              </section>
              )}

              {activeAdminSection === "buscar-paciente" && hasActiveSearch && (
              <section className="card admin-section-results" id="expedientes">
              <div className="header-row" style={{ marginBottom: 0 }}>
                <span className="result-count">
                  {isSpanish ? `${patientCards.length} coincidencia(s)` : `${patientCards.length} match(es)`}
                </span>
                {renderSectionTopButton()}
              </div>

              {patientCards.length === 0 ? (
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
              )}
            </div>

            <div className="stack">
              {activeAdminSection === "equipo" && (
              <section className="card team-card admin-side-team" id="equipo">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Equipo" : "Team"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Teléfonos, consultorio y nivel de acceso. El nombre lo edita cada usuario desde su perfil."
                        : "Phones, office, and access level. Each user edits their own name from their profile."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
                </div>

                {staff.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: 34, marginBottom: 8 }}>👥</div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{isSpanish ? "Todavía no hay equipo" : "No team members yet"}</p>
                    <p className="muted">{isSpanish ? "Cuando se registren aparecerán aquí." : "They will appear here once they register."}</p>
                  </div>
                ) : (
                  staff.map((member) => {
                    const rawMemberEmail = member.id === viewerId ? viewerEmail : member.email || "";
                    const visibleMemberEmail = rawMemberEmail.endsWith("@portal-staff.local") ? "" : rawMemberEmail;
                    const contactLine = [member.phone, visibleMemberEmail].filter(Boolean).join(" · ");
                    const level = normalizeAdminLevel(member.admin_level, rawMemberEmail);
                    const canEditThisMember = canManageAdmins && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const isSelf = member.id === viewerId;
                    const canDeleteThisMember = canManageAdmins && !isSelf && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const accessKey = `${member.id}-admin_level`;
                    const permissionsKey = `${member.id}-permissions`;
                    const phoneKey = `${member.id}-phone`;
                    const phoneDraft = staffPhoneDrafts[member.id] ?? (member.phone || "");
                    const cleanPhoneDraft = phoneDraft.trim();
                    const deleteBusy = deletingStaffId === member.id;
                    const memberPermissionProfile = { ...member, permissions: staffPermissionMap[member.id] ?? member.permissions };
                    const memberPermissionSet = permissionsForProfile(memberPermissionProfile, rawMemberEmail);
                    const explicitPermissionCount = normalizePermissionList(memberPermissionProfile.permissions).length;
                    const canEditPermissionsForMember = canEditThisMember && canManagePermissions;
                    const enabledPermissionCount = STAFF_PERMISSION_KEYS.filter((permission) => memberPermissionSet.has(permission)).length;

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
                                <div className="staff-badge-row">
                                  <span className="meta-badge" style={{ color: adminColor(level), background: `${adminColor(level)}18` }}>
                                    {adminText(level)}
                                  </span>
                                  {member.office_location && (
                                    <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                      {member.office_location}
                                    </span>
                                  )}
                                  {member.role && (
                                    <span className="meta-badge" style={{ color: "#475569", background: "#F1F5F9" }}>
                                      {member.role}
                                    </span>
                                  )}
                                  <span className="meta-badge" style={{ color: "#0E7490", background: "#ECFEFF" }}>
                                    {enabledPermissionCount}/{STAFF_PERMISSION_KEYS.length} {isSpanish ? "permisos" : "rights"}
                                  </span>
                                </div>
	                            </div>
	                          </div>

	                          <details className="staff-controls">
	                            <summary>
	                              {isSpanish ? "Control de usuario" : "User controls"}
	                              <span>⌄</span>
	                            </summary>
		                            <div className="staff-controls-body">
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
		                                <p className="group-label">{isSpanish ? "Permisos del portal" : "Portal permissions"}</p>
                                    <p className="access-help">
                                      {isSpanish
                                        ? "Los botones de preset solo llenan una base. La lista de abajo muestra los derechos reales que este usuario recibe."
                                        : "Preset buttons only fill a starting point. The list below shows the exact rights this user receives."}
                                    </p>
                                    <div className="permission-toolbar">
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
                                          onClick={() => applyStaffAccessPreset(member, option, isSpanish ? `Preset de ${member.full_name || "staff"} actualizado a ${adminText(option)}.` : `Preset for ${member.full_name || "staff"} updated to ${adminText(option)}.`)}
                                        >
                                          {adminText(option)}
                                        </button>
                                      ))}
                                      <span className="meta-badge" style={{ color: explicitPermissionCount ? "#0E7490" : "#64748B", background: explicitPermissionCount ? "#ECFEFF" : "#F1F5F9" }}>
                                        {explicitPermissionCount ? (isSpanish ? "Personalizado" : "Custom") : (isSpanish ? "Preset heredado" : "Inherited preset")}
                                      </span>
                                      {level === "owner" && (
                                        <span className="meta-badge" style={{ color: adminColor("owner"), background: `${adminColor("owner")}18` }}>
                                          {isSpanish ? "Protegido" : "Protected"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="permission-grid">
                                      {permissionGroups.map((group) => (
                                        <div key={`${member.id}-${group.id}`} className="permission-card">
                                          <p className="permission-card-title">{isSpanish ? group.es : group.en}</p>
                                          <div className="permission-list">
                                            {group.permissions.map((permission) => {
                                              const checked = memberPermissionSet.has(permission);
                                              return (
                                                <label key={`${member.id}-${permission}`} className={`permission-row ${checked ? "enabled" : ""}`}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={!canEditPermissionsForMember || savingKey === permissionsKey}
                                                    onChange={(event) => {
                                                      const next = STAFF_PERMISSION_KEYS.filter((candidate) =>
                                                        candidate === permission ? event.target.checked : memberPermissionSet.has(candidate)
                                                      );
                                                      updateStaffPermissions(
                                                        member,
                                                        next,
                                                        isSpanish
                                                          ? `Permisos de ${member.full_name || "staff"} actualizados.`
                                                          : `Permissions for ${member.full_name || "staff"} updated.`
                                                      );
                                                    }}
                                                  />
                                                  <span>
                                                    <strong>{permissionLabel(permission, lang)}</strong>
                                                    <small>{permissionDescriptions[permission][lang]}</small>
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {!canEditPermissionsForMember && (
                                      <p className="permission-locked">
                                        {level === "owner"
                                          ? (isSpanish ? "La cuenta propietaria siempre conserva acceso total." : "The owner account always keeps full access.")
                                          : !canManagePermissions
                                            ? (isSpanish ? "Tu cuenta puede administrar equipo, pero no cambiar permisos finos." : "Your account can manage staff but cannot change granular permissions.")
                                            : (isSpanish ? "No puedes editar permisos de este usuario." : "You cannot edit permissions for this user.")}
                                      </p>
                                    )}
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
              )}

              {activeAdminSection === "herramientas-expediente" && (
              <section className="card admin-side-tools" id="herramientas-expediente">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Herramientas del expediente" : "Record tools"}</p>
                    <p className="muted">{isSpanish ? "Cuando necesites revisar cambios o recuperar expedientes, entra aquí." : "When you need to review changes or recover records, start here."}</p>
                  </div>
                  {renderSectionTopButton()}
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
              )}

              {activeAdminSection === "bloqueos" && (
              <section className="card admin-side-blocks" id="bloqueos">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Accesos bloqueados" : "Blocked access"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Si alguien regresa al equipo, quítalo de esta lista para permitir su registro nuevamente."
                        : "If someone rejoins the team, remove them here to allow registration again."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
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
              )}

              {activeAdminSection === "invitar-personal" && (
              <section className="card admin-side-invite" id="invitar-personal">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Invitar personal" : "Invite team member"}</p>
                    <p className="muted">{isSpanish ? "Envía este enlace a un nuevo integrante. El código ya va incluido para que el registro tenga menos pasos." : "Send this link to a new team member. The code is already included so registration has fewer steps."}</p>
                  </div>
                  {renderSectionTopButton()}
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
              )}

              {activeAdminSection === "telefonos-sede" && (
              <section className="card admin-side-phones" id="telefonos-sede">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Teléfonos de sede" : "Office phone numbers"}</p>
                    <p className="muted">{isSpanish ? "Estos números alimentan el botón de llamada en el chat del paciente." : "These numbers power the call button inside the patient chat."}</p>
                  </div>
                  {renderSectionTopButton()}
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
              )}

            </div>
          </div>
          )}
          {activeAdminSection && (
          <div className="admin-bottom-actions">
            <button type="button" className="back-top-inline-btn" onClick={scrollAdminToTop}>
              {isSpanish ? "⬆️ Volver arriba" : "⬆️ Back to top"}
            </button>
          </div>
          )}
            </main>
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
