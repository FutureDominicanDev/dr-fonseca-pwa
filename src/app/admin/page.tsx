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
import { isDeveloperAccessEmail, isOwnerIdentity } from "@/lib/securityConfig";
import {
  STAFF_PERMISSION_KEYS,
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
  permissionLabel,
  permissionPresetForAdminLevel,
  permissionsForProfile,
  type StaffPermissionMap,
  type StaffPermissionKey,
} from "@/lib/permissions";
import { createSignedChatFileUrl } from "@/lib/chatFileUrls";
import {
  ALERT_TONE_OPTIONS,
  alertToneText,
  type AlertTone,
} from "@/lib/alertToneSettings";

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
  manage_permissions: { es: "Puede cambiar permisos de otros usuarios, excepto derechos reservados al doctor.", en: "Can change other users' permissions except doctor-only rights." },
  delete_staff_accounts: { es: "Puede eliminar cuentas del equipo si el doctor le dio ese derecho.", en: "Can delete team accounts if the doctor granted that right." },
  delete_staff_chat: { es: "Puede eliminar conversaciones internas staff a staff si el doctor se lo autorizó.", en: "Can delete internal staff-to-staff conversations if the doctor authorized it." },
  access_audit_logs: { es: "Puede revisar auditoria y eventos administrativos.", en: "Can review audit and admin events." },
  access_settings_security: { es: "Puede abrir Admin. No elimina usuarios ni cambia permisos por sí solo.", en: "Can open Admin. It does not delete users or change permissions by itself." },
};

const permissionDetails: Record<StaffPermissionKey, { es: string; en: string }> = {
  view_patients: {
    es: "Permite ver la lista de pacientes y abrir solamente los chats o expedientes donde el usuario esté asignado, salvo que también tenga permisos administrativos superiores.",
    en: "Allows the user to see the patient list and open only the chats or records assigned to them, unless they also have higher administrative rights.",
  },
  create_patients: {
    es: "Permite crear pacientes, procedimientos, salas y enlaces seguros nuevos. No da permiso automático para eliminar cuentas ni cambiar permisos.",
    en: "Allows creating new patients, procedures, rooms, and secure links. It does not automatically allow deleting accounts or changing permissions.",
  },
  edit_patient_info: {
    es: "Permite editar datos demográficos y clínicos del expediente del paciente. Úsalo solo para personal que de verdad deba corregir expedientes.",
    en: "Allows editing demographic and clinical patient record details. Use it only for staff who truly need to correct records.",
  },
  archive_rooms: {
    es: "Permite cancelar o archivar salas activas para sacarlas del flujo normal. No borra permanentemente al paciente.",
    en: "Allows cancelling or archiving active rooms to remove them from normal workflow. It does not permanently delete the patient.",
  },
  restore_rooms: {
    es: "Permite regresar salas archivadas o canceladas al flujo activo.",
    en: "Allows restoring archived or cancelled rooms back to active workflow.",
  },
  view_clinical_history: {
    es: "Permite ver formularios de Historia Clínica y PDFs enviados por pacientes. Es acceso sensible a información médica.",
    en: "Allows viewing clinical history forms and PDFs submitted by patients. This is sensitive medical information access.",
  },
  view_upload_files: {
    es: "Permite ver, descargar o compartir archivos visibles del paciente como fotos, videos, audio y documentos del chat.",
    en: "Allows viewing, downloading, or sharing patient-visible files such as photos, videos, audio, and chat documents.",
  },
  view_internal_notes: {
    es: "Permite ver notas y fotos internas del equipo en expedientes asignados. Estas notas no son para pacientes.",
    en: "Allows viewing internal team notes and photos on assigned records. These notes are not patient-facing.",
  },
  manage_internal_notes: {
    es: "Permite crear o modificar notas y fotos internas del expediente.",
    en: "Allows creating or changing internal record notes and photos.",
  },
  manage_labels: {
    es: "Permite crear y asignar etiquetas de seguimiento a pacientes.",
    en: "Allows creating and assigning tracking labels to patients.",
  },
  manage_staff: {
    es: "Permite administrar equipo, teléfonos, solicitudes pendientes e invitaciones operativas. No permite borrar cuentas sin el derecho separado de eliminar cuentas.",
    en: "Allows managing staff, phones, pending requests, and operational invitations. It does not allow deleting accounts without the separate delete-account right.",
  },
  manage_permissions: {
    es: "Permite cambiar permisos comunes de otros usuarios. Los derechos delicados reservados al doctor no se pueden otorgar si la cuenta no es la propietaria.",
    en: "Allows changing common permissions for other users. Sensitive doctor-only rights cannot be granted by a non-owner account.",
  },
  delete_staff_accounts: {
    es: "Permite eliminar cuentas del equipo. La cuenta propietaria de Miguel Fonseca está protegida por el programa y no se puede eliminar con este permiso.",
    en: "Allows deleting team accounts. Miguel Fonseca's owner account is protected by the app and cannot be deleted with this permission.",
  },
  delete_staff_chat: {
    es: "Permite borrar conversaciones internas staff a staff desde Admin. Úsalo solo para personal de máxima confianza porque elimina mensajes internos.",
    en: "Allows deleting internal staff-to-staff conversations from Admin. Use it only for highly trusted staff because it removes internal messages.",
  },
  access_audit_logs: {
    es: "Permite revisar auditoría y eventos administrativos para ver quién cambió datos o accesos.",
    en: "Allows reviewing audit and administrative events to see who changed data or access.",
  },
  access_settings_security: {
    es: "Permite entrar al centro Admin. Por sí solo no permite eliminar usuarios, borrar chats, cambiar permisos ni tocar la cuenta protegida del doctor.",
    en: "Allows entering the Admin center. By itself, it does not allow deleting users, deleting chats, changing permissions, or touching the doctor's protected account.",
  },
};

const permissionGroups: Array<{ id: string; es: string; en: string; permissions: StaffPermissionKey[] }> = [
  { id: "patients", es: "Pacientes y salas", en: "Patients and rooms", permissions: ["view_patients", "create_patients", "edit_patient_info", "archive_rooms", "restore_rooms"] },
  { id: "clinical", es: "Expediente clinico", en: "Clinical record", permissions: ["view_clinical_history", "view_upload_files", "view_internal_notes", "manage_internal_notes", "manage_labels"] },
  { id: "admin", es: "Administracion y seguridad", en: "Administration and security", permissions: ["manage_staff", "manage_permissions", "delete_staff_accounts", "delete_staff_chat", "access_audit_logs", "access_settings_security"] },
];

const deleteStaffAccountsPermission: StaffPermissionKey = "delete_staff_accounts";
const doctorOnlyPermissions = new Set<StaffPermissionKey>(["delete_staff_accounts", "delete_staff_chat"]);

const samePermissionList = (left: readonly StaffPermissionKey[], right: readonly StaffPermissionKey[]) =>
  STAFF_PERMISSION_KEYS.every((permission) => left.includes(permission) === right.includes(permission));

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

type PendingSignupDetail = {
  device?: string | null;
  location?: string | null;
  registeredAt?: string | null;
  capturedAt?: string | null;
};

type NotificationReadiness = {
  staff: Array<{
    id: string;
    name: string;
    role?: string | null;
    adminLevel?: string | null;
    pushDevices: number;
    latestSubscriptionAt?: string | null;
    alertTone?: AlertTone | null;
  }>;
  patientRooms: Array<{
    roomId: string;
    patientId?: string | null;
    patientName: string;
    procedureName?: string | null;
    recordStatus?: string | null;
    pushDevices: number;
    latestSubscriptionAt?: string | null;
  }>;
  totals: {
    staffReady: number;
    staffTotal: number;
    staffMuted?: number;
    patientRoomsReady: number;
    patientRoomsTotal: number;
    staffPushDevices: number;
    patientPushDevices: number;
  };
};

type AdminSectionId =
  | "buscar-paciente"
  | "crear-paciente"
  | "equipo"
  | "solicitudes-pendientes"
  | "alertas"
  | "staff-to-staff"
  | "herramientas-expediente"
  | "developer-access"
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
  const [generatedInviteCode, setGeneratedInviteCode] = useState("");
  const [generatedInviteExpiresAt, setGeneratedInviteExpiresAt] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [officePhoneGdl, setOfficePhoneGdl] = useState("");
  const [officePhoneTjn, setOfficePhoneTjn] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [savingPhones, setSavingPhones] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [staffPhoneDrafts, setStaffPhoneDrafts] = useState<Record<string, string>>({});
  const [staffEmailDrafts, setStaffEmailDrafts] = useState<Record<string, string>>({});
  const [resetBusyId, setResetBusyId] = useState("");
  const [deletingStaffId, setDeletingStaffId] = useState("");
  const [deletingStaffChatKey, setDeletingStaffChatKey] = useState("");
  const [unblockBusyKey, setUnblockBusyKey] = useState("");
  const [developerEmailDraft, setDeveloperEmailDraft] = useState("mrdiazsr@icloud.com");
  const [developerNameDraft, setDeveloperNameDraft] = useState("Ray");
  const [developerAccessBusy, setDeveloperAccessBusy] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSectionId | "">("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState<{ type: "patient" | "staff"; id: string; title: string; body: string } | null>(null);
  const [expandedPendingStaffId, setExpandedPendingStaffId] = useState("");
  const [expandedStaffControlId, setExpandedStaffControlId] = useState("");
  const [permissionHelp, setPermissionHelp] = useState<StaffPermissionKey | null>(null);
  const [pendingSignupDetails, setPendingSignupDetails] = useState<Record<string, PendingSignupDetail>>({});
  const [staffPermissionMap, setStaffPermissionMap] = useState<StaffPermissionMap>({});
  const [staffPermissionDrafts, setStaffPermissionDrafts] = useState<Record<string, StaffPermissionKey[]>>({});
  const [notificationReadiness, setNotificationReadiness] = useState<NotificationReadiness | null>(null);
  const [notificationReadinessLoading, setNotificationReadinessLoading] = useState(false);

  const viewerPermissionProfile = viewerProfile
    ? { ...viewerProfile, permissions: staffPermissionMap[viewerProfile.id] ?? viewerProfile.permissions }
    : null;
  const hasAdminAccess = hasPermission(viewerPermissionProfile, viewerEmail, "access_settings_security");
  const canCreatePatients = hasPermission(viewerPermissionProfile, viewerEmail, "create_patients");
  const canManageAdmins = hasPermission(viewerPermissionProfile, viewerEmail, "manage_staff");
  const canManagePermissions = hasPermission(viewerPermissionProfile, viewerEmail, "manage_permissions");
  const canDeleteStaffAccounts = hasPermission(viewerPermissionProfile, viewerEmail, deleteStaffAccountsPermission);
  const canDeleteStaffChats = hasPermission(viewerPermissionProfile, viewerEmail, "delete_staff_chat");
  const canManageOwner = isOwnerIdentity({
    id: viewerId,
    email: viewerEmail,
    phone: viewerProfile?.phone,
    fullName: viewerProfile?.full_name,
    displayName: viewerProfile?.display_name,
    adminLevel: viewerProfile?.admin_level,
  });
  const canManageAlertToneDefaults = canManageOwner || normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail) === "super_admin";
  const canReviewAlertReadiness = canManageOwner || hasPermission(viewerPermissionProfile, viewerEmail, "access_settings_security");
  const canReviewAccessRequests = hasPermission(viewerPermissionProfile, viewerEmail, "manage_staff");

  const sanitizeEditablePermissions = (member: StaffProfile, requestedPermissions: StaffPermissionKey[]) => {
    const cleanPermissions = STAFF_PERMISSION_KEYS.filter((permission) => requestedPermissions.includes(permission));
    if (canManageOwner) return cleanPermissions;

    const existingProfile = { ...member, permissions: staffPermissionMap[member.id] ?? member.permissions };
    const existingPermissions = permissionsForProfile(existingProfile, member.email || "");
    const withoutDoctorOnlyPermissions = cleanPermissions.filter((permission) => !doctorOnlyPermissions.has(permission));
    doctorOnlyPermissions.forEach((permission) => {
      if (existingPermissions.has(permission)) withoutDoctorOnlyPermissions.push(permission);
    });
    return withoutDoctorOnlyPermissions;
  };

  const officeText = (office: Office) => {
    if (office === "Guadalajara") return "📍 Guadalajara";
    if (office === "Tijuana") return "📍 Tijuana";
    return isSpanish ? "📍 Sin sede" : "📍 No office";
  };
  const staffOfficeText = (office?: string | null) => office || (isSpanish ? "Ambas sedes" : "Both offices");
  const memberHasDeveloperAccess = (member: StaffProfile, emailOverride?: string | null) =>
    isDeveloperAccessEmail(emailOverride ?? member.email) ||
    `${member.role || ""}`.toLowerCase() === "developer";

  const parseSettingList = (value: unknown) => {
    if (typeof value !== "string") return [] as string[];
    return value
      .split(/[,\n;]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  };
  const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
  const activePatientCards = allPatientCards.filter((card) => card.recordStatus === "active");
  const displayedPatientCards = hasActiveSearch ? patientCards : activePatientCards;
  const visiblePatientCards = displayedPatientCards.slice(0, hasActiveSearch ? 12 : 50);
  const hiddenPatientCount = Math.max(0, displayedPatientCards.length - visiblePatientCards.length);
  const inviteLinkForCode = (code: string) =>
    typeof window !== "undefined" && code
      ? `${window.location.origin}/register?code=${encodeURIComponent(code)}`
      : "";
  const generatedInviteLink = inviteLinkForCode(generatedInviteCode);
  const inviteMessageFor = (code: string, link: string) => isSpanish
    ? [
        "Invitación privada al Portal Médico del Dr. Fonseca",
        "",
        "CÓDIGO DE ACCESO:",
        code,
        "",
        "Abre este enlace en tu teléfono:",
        link,
        "",
        "Completa tu perfil. Por seguridad, la cuenta queda pendiente hasta que Dr. Fonseca o un administrador autorizado la apruebe.",
      ].join("\n")
    : [
        "Private invitation to Dr. Fonseca's Medical Portal",
        "",
        "ACCESS CODE:",
        code,
        "",
        "Open this link on your phone:",
        link,
        "",
        "Complete your profile. For security, the account stays pending until Dr. Fonseca or an authorized administrator approves it.",
      ].join("\n");
  const activePatientCount = patients.filter((patient) => normalizeRecordStatus(patient.record_status) === "active").length;
  const blockedAccessCount = blockedEmails.length + blockedPhones.length;
  const pendingStaffMembers = staff.filter((member) => `${member.role || ""}`.toLowerCase() === "pending_staff");
  const pendingTotalCount = pendingAccessRequests.length + pendingStaffMembers.length;
  const inviteCodePreview = inviteCode ? `${inviteCode.slice(0, Math.min(7, inviteCode.length))}••••` : "";
  const generatedInviteExpiresText = generatedInviteExpiresAt
    ? new Date(generatedInviteExpiresAt).toLocaleString(isSpanish ? "es-MX" : "en-US", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const procedureById = useMemo(() => new Map(procedures.map((procedure) => [procedure.id, procedure])), [procedures]);
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const accessRequestTargetId = (request: StaffAccessRequest) => request.target_staff_id || request.requested_staff_id || "";
  const accessRequestPatientName = (request: StaffAccessRequest) => {
    const patientId = request.patient_id || (request.room_id ? procedureById.get(roomById.get(request.room_id)?.procedure_id || "")?.patient_id : "");
    return patientById.get(patientId || "")?.full_name || (isSpanish ? "Paciente sin nombre" : "Unnamed patient");
  };
  const visibleStaffEmail = (email?: string | null) => {
    const normalized = `${email || ""}`.trim().toLowerCase();
    return normalized.endsWith("@portal-staff.local") ? "" : normalized;
  };
  const pendingSignupMethod = (member: StaffProfile) => {
    const hasEmail = Boolean(visibleStaffEmail(member.email));
    const hasPhone = Boolean(member.phone);
    if (hasEmail && hasPhone) return isSpanish ? "Correo y teléfono" : "Email and phone";
    if (hasEmail) return isSpanish ? "Correo electrónico" : "Email";
    if (hasPhone) return isSpanish ? "Teléfono" : "Phone";
    return isSpanish ? "No registrado" : "Not recorded";
  };
  const pendingRegisteredAt = (member: StaffProfile) => {
    const registeredAt = pendingSignupDetails[member.id]?.registeredAt || member.created_at;
    if (!registeredAt) return isSpanish ? "No registrado" : "Not recorded";
    return new Date(registeredAt).toLocaleString(isSpanish ? "es-MX" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const pendingDetailItems = (member: StaffProfile) => {
    const signupDetail = pendingSignupDetails[member.id] || {};
    const notRecorded = isSpanish ? "No registrado en esta solicitud" : "Not recorded for this request";
    return [
      { label: isSpanish ? "Nombre enviado" : "Submitted name", value: member.full_name || member.display_name || (isSpanish ? "Sin nombre" : "No name") },
      { label: isSpanish ? "Correo" : "Email", value: visibleStaffEmail(member.email) || (isSpanish ? "No ingresó correo" : "No email entered") },
      { label: isSpanish ? "Teléfono" : "Phone", value: member.phone || (isSpanish ? "No ingresó teléfono" : "No phone entered") },
      { label: isSpanish ? "Sede solicitada" : "Requested office", value: staffOfficeText(member.office_location) },
      { label: isSpanish ? "Método de registro" : "Signup method", value: pendingSignupMethod(member) },
      { label: isSpanish ? "Fecha de registro" : "Registered", value: pendingRegisteredAt(member) },
      { label: isSpanish ? "Dispositivo" : "Device", value: signupDetail.device || notRecorded },
      { label: isSpanish ? "Ubicación aprox." : "Approx. location", value: signupDetail.location || notRecorded },
    ];
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
      id: "crear-paciente",
      code: "CP",
      label: isSpanish ? "Crear paciente" : "Create patient",
      detail: isSpanish ? "Abrir sala y enlace seguro" : "Open room and secure link",
      visible: canCreatePatients,
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
      detail: isSpanish ? "Aprobación de staff y salas" : "Staff and room approval",
      metric: `${pendingTotalCount}`,
      visible: canReviewAccessRequests,
    },
    {
      id: "alertas",
      code: "AL",
      label: isSpanish ? "Alertas" : "Alerts",
      detail: isSpanish ? "Estado de notificaciones" : "Notification readiness",
      metric: notificationReadiness
        ? `${notificationReadiness.totals.staffReady}/${notificationReadiness.totals.staffTotal}`
        : "",
      visible: canReviewAlertReadiness,
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
      id: "developer-access",
      code: "DV",
      label: isSpanish ? "Desarrollador" : "Developer",
      detail: isSpanish ? "Acceso técnico temporal" : "Temporary technical access",
      visible: canManageOwner,
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

  const openPatientCreator = () => {
    goTo(`/inbox?createPatient=1&lang=${lang}`);
  };

  const openAdminSection = (id: AdminSectionId) => {
    setActiveAdminSection(id);
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById("admin-active-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const scrollToAlertPanel = (panelId: "alert-readiness-staff" | "alert-readiness-patients") => {
    document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openStaffFromAlertReadiness = (staffId: string) => {
    setExpandedStaffControlId(staffId);
    openAdminSection("equipo");
  };

  const openPatientRoomFromAlertReadiness = (patientId?: string | null) => {
    if (patientId) {
      window.location.href = `/admin/paciente/${patientId}`;
      return;
    }
    openAdminSection("buscar-paciente");
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
    null
  );

  const loadPendingSignupDetails = async (userIds: string[]) => {
    const cleanUserIds = [...new Set(userIds.filter(Boolean))];
    if (cleanUserIds.length === 0) {
      setPendingSignupDetails({});
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff/pending-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userIds: cleanUserIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setPendingSignupDetails((payload?.details || {}) as Record<string, PendingSignupDetail>);
    } catch {
      // These details are helpful approval context, but the approval screen still works without them.
    }
  };

  const loadNotificationReadiness = async (allowed: boolean) => {
    if (!allowed) {
      setNotificationReadiness(null);
      return;
    }

    setNotificationReadinessLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      if (!accessToken) return;
      const response = await fetch("/api/admin/notification-readiness", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude cargar el estado de alertas." : "I could not load alert readiness."));
        return;
      }
      setNotificationReadiness(payload as NotificationReadiness);
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude cargar el estado de alertas." : "I could not load alert readiness."));
    } finally {
      setNotificationReadinessLoading(false);
    }
  };

  const fetchData = async (
    accessProfile = viewerPermissionProfile,
    accessEmail = viewerEmail,
    accessUserId = viewerId,
  ) => {
    setPageError("");

    const accessIsOwner = isOwnerIdentity({
      id: accessUserId,
      email: accessEmail,
      phone: accessProfile?.phone,
      fullName: accessProfile?.full_name,
      displayName: accessProfile?.display_name,
      adminLevel: accessProfile?.admin_level,
    });
    const mayLoadPatients = hasPermission(accessProfile, accessEmail, "view_patients");
    const mayLoadStaff = accessIsOwner || hasPermission(accessProfile, accessEmail, "manage_staff") || hasPermission(accessProfile, accessEmail, "create_patients");
    const mayLoadStaffPrivateMessages = accessIsOwner || hasPermission(accessProfile, accessEmail, "delete_staff_chat");
    const mayLoadAccessRequests = accessIsOwner || hasPermission(accessProfile, accessEmail, "manage_staff");
    const mayLoadNotificationReadiness = accessIsOwner || hasPermission(accessProfile, accessEmail, "access_settings_security");
    const emptyRows = Promise.resolve({ data: [], error: null });

    const [staffRes, patientsRes, proceduresRes, roomsRes, staffPrivateMessagesRes, accessRequestsRes, inviteRes, blockedEmailsRes, blockedPhonesRes, gdlPhoneRes, tjnPhoneRes, staffPermissionsRes] = await Promise.all([
      mayLoadStaff ? supabase.from("profiles").select("*").order("full_name") : emptyRows,
      mayLoadPatients ? supabase.from("patients").select("*").order("full_name") : emptyRows,
      mayLoadPatients ? supabase.from("procedures").select("*") : emptyRows,
      mayLoadPatients ? supabase.from("rooms").select("*").order("created_at", { ascending: false }) : emptyRows,
      mayLoadStaffPrivateMessages ? supabase.from("staff_private_messages").select("*").order("created_at", { ascending: false }).limit(500) : emptyRows,
      mayLoadAccessRequests ? supabase.from("staff_access_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }) : emptyRows,
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

    const loadedStaff = await Promise.all(((staffRes.data || []) as StaffProfile[]).map(async (member) => ({
      ...member,
      avatar_url: await createSignedChatFileUrl(supabase, member.avatar_url),
    })));
    setStaff(loadedStaff);
    await loadPendingSignupDetails(
      loadedStaff
        .filter((member) => `${member.role || ""}`.toLowerCase() === "pending_staff")
        .map((member) => member.id),
    );
    setPatients(await Promise.all(((patientsRes.data || []) as PatientRecord[]).map(async (patient) => ({
      ...patient,
      profile_picture_url: await createSignedChatFileUrl(supabase, patient.profile_picture_url),
    }))));
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
    setStaffPermissionDrafts({});
    setExpandedStaffControlId("");
    await loadNotificationReadiness(mayLoadNotificationReadiness);

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
    setStaffPermissionDrafts({});
    setExpandedStaffControlId("");
    setViewerProfile(profile || null);

    const bootProfile = profile as StaffProfile | null;
    const viewerIsOwner = isOwnerIdentity({
      id: user.id,
      email,
      phone: bootProfile?.phone || (user as any)?.phone || (user.user_metadata as any)?.phone,
      fullName: bootProfile?.full_name || (user.user_metadata as any)?.full_name,
      displayName: bootProfile?.display_name,
      adminLevel: bootProfile?.admin_level,
    });

    if (viewerIsOwner) {
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

    await fetchData(computedProfile, email, user.id);
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

  const collapseStaffControls = (memberId: string) => {
    setExpandedStaffControlId((current) => (current === memberId ? "" : current));
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
    collapseStaffControls(member.id);
  };

  const approvePendingStaff = async (member: StaffProfile) => {
    if (!canManageAdmins) return;
    setSavingKey(`${member.id}-role-admin_level`);
    setPageError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userId: member.id, lang }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude aprobar esta cuenta." : "I could not approve this account."));
        return;
      }
      setStaff((previous) => previous.map((item) => (item.id === member.id ? { ...item, role: "staff", admin_level: item.admin_level || "none" } : item)));
      const noticeText = payload?.notification?.sent
        ? (isSpanish ? " Aviso enviado por correo." : " Email notice sent.")
        : "";
      updateSuccess(
        isSpanish
          ? `${member.full_name || member.display_name || "Staff"} aprobado. Ahora solo verá salas asignadas hasta que le des más permisos.${noticeText}`
          : `${member.full_name || member.display_name || "Staff"} approved. They will only see assigned rooms unless you grant more permissions.${noticeText}`,
      );
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude aprobar esta cuenta." : "I could not approve this account."));
      return;
    } finally {
      setSavingKey("");
    }
    setPendingSignupDetails((previous) => {
      const next = { ...previous };
      delete next[member.id];
      return next;
    });
  };

  const denyPendingStaff = async (member: StaffProfile) => {
    if (!canDeleteStaffAccounts) return;
    const memberName = member.full_name || member.display_name || visibleStaffEmail(member.email) || member.phone || (isSpanish ? "este usuario" : "this user");
    const confirmed = window.confirm(
      isSpanish
        ? `Denegar a ${memberName} eliminará su cuenta pendiente, bloqueará su correo/teléfono registrado y rotará el código de invitación por seguridad. El bloqueo se puede quitar después en Bloqueos si el doctor decide permitir un nuevo registro. ¿Continuar?`
        : `Denying ${memberName} will delete their pending account, block their registered email/phone, and rotate the invite code for security. The block can be removed later in Blocked if the doctor decides to allow a new registration. Continue?`,
    );
    if (!confirmed) return;

    setSavingKey(`pending-deny-${member.id}`);
    setPageError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff/deny", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userId: member.id, lang }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude denegar esta cuenta." : "I could not deny this account."));
        return;
      }

      setStaff((previous) => previous.filter((item) => item.id !== member.id));
      setPendingSignupDetails((previous) => {
        const next = { ...previous };
        delete next[member.id];
        return next;
      });
      setPendingAccessRequests((previous) =>
        previous.filter((request) => accessRequestTargetId(request) !== member.id && request.requested_by !== member.id),
      );
      setExpandedPendingStaffId((current) => (current === member.id ? "" : current));
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
        action: "pending_staff_denied",
        entityType: "staff_profile",
        entityId: member.id,
        entityName: memberName,
        actorId: viewerId,
        actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
        actorEmail: viewerEmail,
        notes: isSpanish ? `Se denegó y eliminó la cuenta pendiente de ${memberName}.` : `Denied and deleted pending account for ${memberName}.`,
        metadata: {
          removedEmail: payload?.removedEmail || visibleStaffEmail(member.email) || null,
          removedPhone: payload?.removedPhone || member.phone || null,
          notification: payload?.notification || null,
          inviteRotated: Boolean(payload?.newInviteCode),
        },
      }).catch(() => undefined);

      const notificationSent = Boolean(payload?.notification?.sent);
      const phoneNoticeMissing = payload?.notification?.method === "phone" && !notificationSent;
      const emailNoticeMissing = payload?.notification?.method === "email" && !notificationSent;
      const noticeText = notificationSent
        ? (isSpanish ? " Aviso enviado por correo." : " Notice sent by email.")
        : phoneNoticeMissing
          ? (isSpanish ? " No hay SMS configurado para avisos por teléfono." : " SMS is not configured for phone notices.")
          : emailNoticeMissing
            ? (isSpanish ? " No se pudo enviar el aviso por correo." : " Email notice could not be sent.")
          : "";
      updateSuccess(
        isSpanish
          ? `${memberName} fue denegado, eliminado y bloqueado. Código de invitación rotado.${noticeText}`
          : `${memberName} was denied, deleted, and blocked. Invite code rotated.${noticeText}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      setPageError(message || (isSpanish ? "No pude denegar esta cuenta." : "I could not deny this account."));
    } finally {
      setSavingKey("");
    }
  };

  const sendStaffPasswordReset = async (member: StaffProfile) => {
    if (!canManageAdmins || resetBusyId) return;
    setResetBusyId(member.id);
    setPageError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/auth/staff-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ targetUserId: member.id, lang }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude enviar el enlace de recuperación." : "I could not send the reset link."));
        return;
      }
      updateSuccess(isSpanish ? "Enlace de recuperación enviado." : "Password reset link sent.");
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude enviar el enlace de recuperación." : "I could not send the reset link."));
    } finally {
      setResetBusyId("");
    }
  };

  const sendDeveloperAccess = async () => {
    if (!canManageOwner || developerAccessBusy) return;
    const email = developerEmailDraft.trim().toLowerCase();
    const fullName = developerNameDraft.trim() || (isSpanish ? "Acceso desarrollador" : "Developer Access");
    if (!validEmail(email)) {
      setPageError(isSpanish ? "Escribe un correo válido para el desarrollador." : "Enter a valid developer email.");
      return;
    }

    setDeveloperAccessBusy(true);
    setPageError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff/developer-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ email, fullName, lang }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude crear el acceso de desarrollador." : "I could not create developer access."));
        return;
      }
      await fetchData();
      updateSuccess(isSpanish ? "Enlace de desarrollador enviado." : "Developer access link sent.");
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude crear el acceso de desarrollador." : "I could not create developer access."));
    } finally {
      setDeveloperAccessBusy(false);
    }
  };

  const deleteStaffPrivateConversation = async (conversation: StaffPrivateConversation) => {
    if (!canDeleteStaffChats || deletingStaffChatKey) return;
    const confirmed = window.confirm(
      isSpanish
        ? `Eliminar la conversación interna "${conversation.title}" borrará estos mensajes staff a staff del portal. ¿Continuar?`
        : `Deleting the internal conversation "${conversation.title}" will remove these staff-to-staff messages from the portal. Continue?`,
    );
    if (!confirmed) return;

    setDeletingStaffChatKey(conversation.key);
    setPageError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff-private-messages/delete-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ participantIds: conversation.participantIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude eliminar este chat interno." : "I could not delete this internal chat."));
        return;
      }
      const participantSet = new Set(conversation.participantIds);
      setStaffPrivateMessages((previous) =>
        previous.filter((message) => {
          const senderId = message.sender_id || "";
          const recipientId = privateRecipientId(message);
          return !(participantSet.has(senderId) && participantSet.has(recipientId));
        }),
      );
      updateSuccess(isSpanish ? "Chat interno eliminado." : "Internal staff chat deleted.");
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude eliminar este chat interno." : "I could not delete this internal chat."));
    } finally {
      setDeletingStaffChatKey("");
    }
  };

  const updateStaffPermissions = async (member: StaffProfile, nextPermissions: StaffPermissionKey[], success: string) => {
    const cleanPermissions = sanitizeEditablePermissions(member, nextPermissions);
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
    setStaffPermissionDrafts((previous) => {
      const next = { ...previous };
      delete next[member.id];
      return next;
    });
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
    collapseStaffControls(member.id);
  };

  const applyStaffAccessPreset = async (member: StaffProfile, level: AdminLevel, success: string) => {
    const nextPermissions = sanitizeEditablePermissions(member, permissionPresetForAdminLevel(level));
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
    setStaffPermissionDrafts((previous) => {
      const next = { ...previous };
      delete next[member.id];
      return next;
    });
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
    collapseStaffControls(member.id);
  };

  const saveStaffAlertTone = async (member: StaffProfile, tone: AlertTone | null) => {
    if (!canManageAlertToneDefaults) return;
    setSavingKey(`${member.id}-alert-tone`);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/staff/alert-tone", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ staffId: member.id, tone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(payload?.error || (isSpanish ? "No pude guardar el tono de alertas." : "I could not save the alert tone."));
        return;
      }

      setNotificationReadiness((current) => current
        ? {
          ...current,
          staff: current.staff.map((item) => (item.id === member.id ? { ...item, alertTone: tone } : item)),
        }
        : current);
      await logAdminEvent({
        action: "staff_alert_tone_updated",
        entityType: "staff_profile",
        entityId: member.id,
        entityName: member.full_name || member.display_name || "Personal",
        actorId: viewerId,
        actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
        actorEmail: viewerEmail,
        notes: tone
          ? (isSpanish ? `Tono de alertas guardado: ${alertToneText(tone, true)}.` : `Saved alert tone: ${alertToneText(tone, false)}.`)
          : (isSpanish ? "Tono de alertas guardado removido." : "Saved alert tone removed."),
        metadata: { alertTone: tone },
      });
      updateSuccess(
        tone
          ? (isSpanish ? `${member.full_name || "Staff"} ahora tiene ${alertToneText(tone, true)} guardado, y puede cambiarlo desde Ajustes.` : `${member.full_name || "Staff"} now has ${alertToneText(tone, false)} saved and can still change it in Settings.`)
          : (isSpanish ? `${member.full_name || "Staff"} quedó sin tono guardado.` : `${member.full_name || "Staff"} now has no saved tone.`),
      );
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude guardar el tono de alertas." : "I could not save the alert tone."));
    } finally {
      setSavingKey("");
    }
  };

  const deleteStaffMember = async (member: StaffProfile) => {
    const memberName = member.full_name || member.display_name || member.email || (isSpanish ? "este usuario" : "this user");
    const hasDeveloperAccess = memberHasDeveloperAccess(member);
    const confirmed = window.confirm(
      hasDeveloperAccess
        ? (
            isSpanish
              ? `Eliminar a ${memberName} quitará su acceso de desarrollador al portal, pero NO bloqueará su correo ni rotará el código de invitación. El doctor podrá crear acceso de desarrollador otra vez cuando necesite soporte. ¿Continuar?`
              : `Deleting ${memberName} will remove developer portal access, but will NOT block the email or rotate the invite code. The doctor can create developer access again when support is needed. Continue?`
          )
        : (
            isSpanish
              ? `Eliminar a ${memberName} quitará su acceso al portal, lo sacará de los expedientes asignados y bloqueará su correo/teléfono para que no pueda volver a registrarse con la invitación actual. ¿Continuar?`
              : `Deleting ${memberName} will remove portal access, detach them from assigned records, and block their email/phone from registering again with the current invite. Continue?`
          ),
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
    if (payload?.blockedAccess !== false && payload?.removedEmail) {
      setBlockedEmails((previous) => [...new Set([...previous, `${payload.removedEmail}`.toLowerCase()])].sort());
    }
    if (payload?.blockedAccess !== false && payload?.removedPhone) {
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

  const createFreshInvite = async () => {
    setPageError("");
    setGeneratingInvite(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      if (!token) throw new Error(isSpanish ? "La sesión expiró. Inicia sesión otra vez." : "Session expired. Please sign in again.");

      const response = await fetch("/api/staff/invite-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.code) {
        throw new Error(payload?.error || (isSpanish ? "No pude crear la invitación." : "I could not create the invitation."));
      }

      const code = `${payload.code}`.trim().toUpperCase();
      const expiresAt = `${payload.expiresAt || ""}`;
      const link = inviteLinkForCode(code);
      setGeneratedInviteCode(code);
      setGeneratedInviteExpiresAt(expiresAt);
      return { code, link, text: inviteMessageFor(code, link), expiresAt };
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude crear la invitación." : "I could not create the invitation."));
      return null;
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    const invite = await createFreshInvite();
    if (!invite?.text) return;
    await navigator.clipboard.writeText(invite.text);
    updateSuccess(isSpanish ? "Invitación con código copiada." : "Invitation with code copied.");
  };

  const shareInviteLink = async () => {
    const invite = await createFreshInvite();
    if (!invite?.link) return;
    const nav = navigator as Navigator & { share?: (data?: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: isSpanish ? "Invitación al portal" : "Portal invitation",
          text: invite.text,
          url: invite.link,
        });
        updateSuccess(isSpanish ? "Se abrió el menú para compartir la invitación." : "The share menu opened for the invitation.");
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(invite.text);
    updateSuccess(isSpanish ? "Invitación con código copiada." : "Invitation with code copied.");
  };

  const sendInviteText = async () => {
    const invite = await createFreshInvite();
    if (!invite?.text) return;
    window.location.href = `sms:?&body=${encodeURIComponent(invite.text)}`;
    updateSuccess(isSpanish ? "Abrí Mensajes con la invitación lista." : "Messages opened with the invitation ready.");
  };

  const sendInviteEmail = async () => {
    const invite = await createFreshInvite();
    if (!invite?.text) return;
    const subject = isSpanish ? "Invitación al Portal Médico Dr. Fonseca" : "Invitation to Dr. Fonseca Medical Portal";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invite.text)}`;
    updateSuccess(isSpanish ? "Abrí el correo con la invitación lista." : "Email opened with the invitation ready.");
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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch("/api/staff/unblock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

  const alertLastSeen = (value?: string | null) =>
    value ? formatDate(value) : (isSpanish ? "Sin registro reciente" : "No recent registration");
  const staffAlertRows = notificationReadiness?.staff || [];
  const patientAlertRows = notificationReadiness?.patientRooms || [];
  const staffMissingAlerts = staffAlertRows.filter((member) => member.pushDevices === 0);
  const staffMutedAlerts = staffAlertRows.filter((member) => member.alertTone === "off");
  const patientRoomsMissingAlerts = patientAlertRows.filter((room) => room.pushDevices === 0);

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
        .admin-side-developer { order: 3; }
        .admin-side-phones { order: 4; }
        .admin-side-tools { order: 5; }
        .admin-side-blocks { order: 6; }
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
        .staff-controls-close-btn { width: 100%; min-height: 44px; border: 1px solid #BFDBFE; border-radius: 12px; background: #EFF6FF; color: #075EA8; font-family: inherit; font-size: 14px; font-weight: 950; cursor: pointer; }
        .staff-controls-close-btn.top { margin: 0 0 10px; }
        .staff-controls-close-btn.bottom { margin: 12px 0 0; }
        .staff-contact-settings-grid { display: grid; grid-template-columns: minmax(180px, 0.74fr) minmax(220px, 1fr) minmax(320px, 1.35fr); gap: 10px; align-items: start; }
        .staff-contact-settings-grid .setting-group { min-width: 0; }
        .staff-contact-settings-grid .mini-actions { flex-wrap: nowrap; align-items: stretch; }
        .staff-contact-settings-grid .line-input { min-width: 0 !important; flex: 1 1 auto !important; }
        .staff-contact-settings-grid .mini-btn { flex: 0 0 auto; white-space: nowrap; }
        .danger-inline-btn { flex-shrink: 0; min-height: 44px; padding: 8px 10px; border-radius: 999px; border: none; background: #FFF1F2; color: #E11D48; font-size: 15px; font-weight: 900; cursor: pointer; font-family: inherit; }
        .danger-inline-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#111827,#1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .small-avatar { width: 42px; height: 42px; font-size: 13px; }
        .list-action-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; border: 1px solid #E7EEF7; background: #F8FAFC; color: #111827; text-align: left; cursor: pointer; font-family: inherit; }
        .list-action-row strong { display: block; font-size: 16px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .list-action-row span span { display: block; margin-top: 3px; color: #64748B; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; line-height: 1.4; }
        .list-action-row:hover, .list-action-row:focus-visible { border-color: #BFDBFE; background: #EFF6FF; outline: none; }
        .conversation-row { cursor: default; justify-content: space-between; }
        .conversation-open-btn { min-width: 0; flex: 1; display: flex; align-items: center; gap: 12px; border: none; background: transparent; padding: 0; color: inherit; text-align: left; font-family: inherit; cursor: pointer; }
        .conversation-open-btn:focus-visible { outline: 2px solid #93C5FD; outline-offset: 3px; border-radius: 12px; }
        .pending-staff-card { display: grid; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid #FED7AA; background: #FFF7ED; }
        .pending-staff-summary { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .pending-staff-main { flex: 1; min-width: 0; }
        .pending-staff-main strong { display: block; color: #111827; font-size: 16px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pending-staff-main span { display: block; margin-top: 3px; color: #64748B; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; line-height: 1.4; }
        .pending-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; border-top: 1px solid #FED7AA; padding-top: 12px; }
        .pending-detail-item { min-width: 0; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.72); border: 1px solid #FFEDD5; }
        .pending-detail-item small { display: block; color: #9A3412; font-size: 12px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 4px; line-height: 1.25; }
        .pending-detail-item span { display: block; color: #111827; font-size: 14px; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; }
        .alert-readiness-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
        .alert-readiness-tile { width: 100%; min-height: 116px; border-radius: 18px; border: 1px solid #DCEBFA; background: #F8FBFF; padding: 15px; display: grid; align-content: space-between; text-align: left; font-family: inherit; cursor: pointer; }
        .alert-readiness-tile:hover, .alert-readiness-tile:focus-visible { border-color: #93C5FD; background: #EFF6FF; outline: none; }
        .alert-readiness-tile.warning { border-color: #FECACA; background: #FFF7F7; }
        .alert-readiness-tile strong { display: block; color: #0F172A; font-size: 28px; line-height: 1; font-weight: 950; }
        .alert-readiness-tile span { display: block; color: #64748B; font-size: 13px; line-height: 1.35; font-weight: 850; margin-top: 7px; }
        .alert-readiness-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .alert-readiness-panel { border-radius: 18px; border: 1px solid #E6EEF7; background: #FBFDFF; padding: 14px; min-width: 0; }
        .alert-readiness-panel h3 { margin: 0 0 10px; color: #0F172A; font-size: 17px; font-weight: 950; line-height: 1.2; }
        .alert-readiness-list { display: grid; gap: 8px; max-height: 460px; overflow-y: auto; padding-right: 2px; }
        .alert-readiness-row { width: 100%; display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 11px; border-radius: 14px; border: 1px solid #E7EEF7; background: white; text-align: left; font-family: inherit; cursor: pointer; }
        .alert-readiness-row:hover, .alert-readiness-row:focus-visible { border-color: #93C5FD; background: #EFF6FF; outline: none; }
        .alert-readiness-row.missing { border-color: #FECACA; background: #FFF7F7; }
        .alert-ready-dot { width: 42px; height: 42px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: #DCFCE7; color: #166534; font-size: 13px; font-weight: 950; }
        .alert-readiness-row.missing .alert-ready-dot { background: #FEE2E2; color: #B91C1C; }
        .alert-readiness-copy { min-width: 0; }
        .alert-readiness-copy strong { display: block; color: #0F172A; font-size: 15px; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .alert-readiness-copy span { display: block; margin-top: 3px; color: #64748B; font-size: 13px; font-weight: 750; line-height: 1.35; overflow-wrap: anywhere; }
        .alert-device-count { min-width: 34px; min-height: 30px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 9px; background: #EFF6FF; color: #1D4ED8; font-size: 13px; font-weight: 950; }
        .alert-readiness-row.missing .alert-device-count { background: #FEE2E2; color: #B91C1C; }
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
        .permission-title-line { display: flex; align-items: center; gap: 7px; justify-content: space-between; }
        .permission-title-line strong { min-width: 0; }
        .permission-info-btn { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 999px; border: 1px solid #BFDBFE; background: #EFF6FF; color: #1D4ED8; font-size: 13px; font-weight: 950; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .permission-info-btn:focus-visible { outline: 2px solid #93C5FD; outline-offset: 2px; }
        .permission-help-overlay { position: fixed; inset: 0; z-index: 190; display: grid; place-items: center; padding: 18px; background: rgba(15,23,42,0.46); }
        .permission-help-modal { width: min(520px, 100%); border-radius: 22px; background: white; padding: 22px; box-shadow: 0 28px 90px rgba(15,23,42,0.30); border: 1px solid #E6EEF7; }
        .permission-help-kicker { color: #1D4ED8; font-size: 12px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px; }
        .permission-help-title { color: #0F172A; font-size: 24px; font-weight: 950; line-height: 1.15; margin: 0 0 10px; }
        .permission-help-copy { color: #334155; font-size: 15px; font-weight: 700; line-height: 1.6; margin: 0; }
        .developer-card-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
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
          .alert-readiness-grid { grid-template-columns: 1fr 1fr; }
          .alert-readiness-columns { grid-template-columns: 1fr; }
          .staff-contact-settings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .staff-contact-settings-grid .setting-group:last-child { grid-column: 1 / -1; }
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
          .admin-topbar { position: sticky; top: 0; z-index: 120; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; align-items: center; transform: translateZ(0); }
          .topbar-title { gap: 10px; }
          .admin-brand-logo { width: min(245px, 68vw); height: 62px; }
          .admin-title-copy { display: none; }
          .topbar-right { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { position: fixed; top: calc(84px + env(safe-area-inset-top)); left: 0; right: 0; z-index: 119; display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 12px max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); box-shadow: 0 18px 42px rgba(15,23,42,0.30); }
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
          .pending-staff-summary { align-items: flex-start; flex-direction: column; }
          .pending-detail-grid { grid-template-columns: 1fr; }
          .alert-readiness-grid { grid-template-columns: 1fr; }
          .alert-readiness-row { grid-template-columns: 42px minmax(0, 1fr); }
          .alert-device-count { justify-self: start; grid-column: 2; }
          .conversation-row { align-items: stretch; flex-direction: column; }
          .conversation-open-btn { width: 100%; }
          .developer-card-grid { grid-template-columns: 1fr; }
          .staff-contact-settings-grid { grid-template-columns: 1fr; }
          .staff-contact-settings-grid .setting-group:last-child { grid-column: auto; }
          .staff-contact-settings-grid .mini-actions { flex-wrap: wrap; }
          .staff-contact-settings-grid .mini-btn { flex: 1 1 auto; }
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
              <button className="topbar-btn" onClick={() => goTo("/training")}>{isSpanish ? "Iconos" : "Icons"}</button>
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
            <button className="topbar-btn" onClick={() => goTo("/training")}>{isSpanish ? "Iconos" : "Icons"}</button>
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
                      <strong>{pendingTotalCount}</strong>
                      <span>{isSpanish ? "Solicitudes pendientes de staff o acceso" : "Pending staff or access requests"}</span>
                    </div>
                    <div className="overview-tile">
                      <strong>{blockedAccessCount}</strong>
                      <span>{isSpanish ? "Correos o teléfonos bloqueados" : "Blocked emails or phones"}</span>
                    </div>
                  </div>
                  <div className="overview-actions">
                    {canCreatePatients && (
                      <button type="button" className="ghost-btn" onClick={() => openAdminSection("crear-paciente")}>
                        {isSpanish ? "Crear paciente" : "Create patient"}
                      </button>
                    )}
                    <button type="button" className="ghost-btn" onClick={() => openAdminSection("invitar-personal")}>
                      {isSpanish ? "Invitar personal" : "Invite staff"}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => openAdminSection("equipo")}>
                      {isSpanish ? "Administrar equipo" : "Manage team"}
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
              {activeAdminSection === "crear-paciente" && (
              <section className="card admin-section-create" id="crear-paciente">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Crear paciente" : "Create patient"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Abre el creador protegido del portal para registrar paciente, procedimiento, consultorio, equipo asignado y enlace seguro."
                        : "Open the protected portal creator to register the patient, procedure, office, assigned team, and secure link."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
                </div>

                <div className="export-card">
                  <p className="secure-invite-label">{isSpanish ? "Flujo seguro existente" : "Existing secure flow"}</p>
                  <p className="secure-invite-main">
                    {isSpanish ? "Usa el mismo creador que ya genera la sala real del paciente." : "Use the same creator that already generates the real patient room."}
                  </p>
                  <p className="secure-invite-code" style={{ color: "#64748B" }}>
                    {isSpanish
                      ? "Se mantiene el permiso Crear pacientes y el sistema sigue creando paciente, procedimiento, sala, equipo y mensaje de bienvenida en un solo flujo."
                      : "The Create patients permission stays enforced, and the system still creates patient, procedure, room, team assignment, and welcome message in one flow."}
                  </p>
                  <div className="inline-actions" style={{ marginTop: 14 }}>
                    <button className="main-btn" type="button" onClick={openPatientCreator} disabled={!canCreatePatients}>
                      {isSpanish ? "Abrir creador de paciente" : "Open patient creator"}
                    </button>
                    <button className="ghost-btn" type="button" onClick={() => openAdminSection("buscar-paciente")}>
                      {isSpanish ? "Buscar existentes" : "Search existing"}
                    </button>
                  </div>
                </div>
              </section>
              )}

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
	                    staffPrivateConversations.map((conversation) => {
                        const deleteBusy = deletingStaffChatKey === conversation.key;
                        return (
                          <div key={`staff-chat-${conversation.key}`} className="list-action-row conversation-row">
                            <button type="button" className="conversation-open-btn" onClick={() => openStaffChatExportMenu(conversation)}>
                              <span className="avatar small-avatar">{initials(conversation.title)}</span>
                              <span style={{ minWidth: 0, flex: 1 }}>
                                <strong>{conversation.title}</strong>
                                <span>{conversation.subtitle}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="danger-inline-btn"
                              disabled={!canDeleteStaffChats || deleteBusy}
                              onClick={() => deleteStaffPrivateConversation(conversation)}
                              title={
                                canDeleteStaffChats
                                  ? ""
                                  : (isSpanish ? "El doctor debe dar el derecho de eliminar chats staff." : "The doctor must grant the delete staff chats right.")
                              }
                            >
                              {deleteBusy ? (isSpanish ? "Eliminando..." : "Deleting...") : (isSpanish ? "Eliminar" : "Delete")}
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </section>
              )}

              {canReviewAccessRequests && activeAdminSection === "solicitudes-pendientes" && (
                <section className="card admin-section-requests" id="solicitudes-pendientes">
                  <div className="header-row">
                    <div>
                      <p className="card-title">{isSpanish ? "Solicitudes pendientes" : "Pending requests"}</p>
                      <p className="muted">{isSpanish ? "Aprueba cuentas nuevas y solicitudes de acceso a pacientes." : "Approve new accounts and patient access requests."}</p>
                    </div>
                    {renderSectionTopButton()}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pendingTotalCount === 0 ? (
                      <p className="muted">{isSpanish ? "No hay solicitudes pendientes." : "No pending requests."}</p>
                    ) : (
                      <>
                      {pendingStaffMembers.map((member) => {
                        const busy = savingKey === `${member.id}-role-admin_level`;
                        const denyBusy = savingKey === `pending-deny-${member.id}`;
                        const detailsOpen = expandedPendingStaffId === member.id;
                        const contactLine = [member.phone, visibleStaffEmail(member.email), member.office_location].filter(Boolean).join(" · ");
                        return (
                          <div key={`pending-staff-${member.id}`} className="pending-staff-card">
                            <div className="pending-staff-summary">
                              <span className="avatar small-avatar">{initials(member.full_name || member.display_name)}</span>
                              <span className="pending-staff-main">
                                <strong>{member.full_name || member.display_name || (isSpanish ? "Personal nuevo" : "New staff")}</strong>
                                <span>{contactLine || (isSpanish ? "Registro pendiente de aprobación" : "Registration pending approval")}</span>
                              </span>
                              <div className="inline-actions">
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => setExpandedPendingStaffId((current) => (current === member.id ? "" : member.id))}
                                >
                                  {detailsOpen ? (isSpanish ? "Ocultar" : "Hide") : (isSpanish ? "Ver detalles" : "Details")}
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn"
                                  disabled={busy || denyBusy || !canManageAdmins}
                                  onClick={() => approvePendingStaff(member)}
                                  style={{ background: "#DCFCE7", color: "#166534" }}
                                >
                                  {busy ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Aprobar staff" : "Approve staff")}
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn"
                                  disabled={busy || denyBusy || !canDeleteStaffAccounts}
                                  onClick={() => denyPendingStaff(member)}
                                  title={
                                    canDeleteStaffAccounts
                                      ? ""
                                      : (isSpanish ? "El doctor debe dar el derecho de eliminar cuentas." : "The doctor must grant the delete accounts right.")
                                  }
                                  style={{ background: "#FEE2E2", color: "#B91C1C" }}
                                >
                                  {denyBusy ? (isSpanish ? "Eliminando..." : "Deleting...") : (isSpanish ? "Denegar" : "Deny")}
                                </button>
                              </div>
                            </div>
                            {detailsOpen && (
                              <div className="pending-detail-grid">
                                {pendingDetailItems(member).map((item) => (
                                  <div key={`${member.id}-${item.label}`} className="pending-detail-item">
                                    <small>{item.label}</small>
                                    <span>{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {pendingAccessRequests.map((request) => {
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
                      })}
                      </>
                    )}
                  </div>
                </section>
              )}

              {canReviewAlertReadiness && activeAdminSection === "alertas" && (
              <section className="card" id="alertas">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Estado de alertas" : "Alert readiness"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Revisa qué cuentas y salas tienen al menos un dispositivo registrado para push. Esto no sustituye los permisos del sistema operativo ni el modo No molestar."
                        : "Review which accounts and rooms have at least one device registered for push. This does not override operating system permissions or Do Not Disturb."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => loadNotificationReadiness(canReviewAlertReadiness)}
                    disabled={notificationReadinessLoading}
                  >
                    {notificationReadinessLoading ? (isSpanish ? "Actualizando..." : "Refreshing...") : (isSpanish ? "Actualizar" : "Refresh")}
                  </button>
                </div>

                <div className="alert-readiness-grid">
                  <button type="button" className="alert-readiness-tile" onClick={() => scrollToAlertPanel("alert-readiness-staff")}>
                    <div>
                      <strong>{notificationReadiness?.totals.staffReady ?? 0}/{notificationReadiness?.totals.staffTotal ?? 0}</strong>
                      <span>{isSpanish ? "Staff con push activo" : "Staff with push active"}</span>
                    </div>
                  </button>
                  <button type="button" className={`alert-readiness-tile ${staffMissingAlerts.length > 0 ? "warning" : ""}`} onClick={() => scrollToAlertPanel("alert-readiness-staff")}>
                    <div>
                      <strong>{staffMissingAlerts.length}</strong>
                      <span>{isSpanish ? "Staff sin dispositivo push" : "Staff missing push device"}</span>
                    </div>
                  </button>
                  <button type="button" className={`alert-readiness-tile ${staffMutedAlerts.length > 0 ? "warning" : ""}`} onClick={() => scrollToAlertPanel("alert-readiness-staff")}>
                    <div>
                      <strong>{notificationReadiness?.totals.staffMuted ?? staffMutedAlerts.length}</strong>
                      <span>{isSpanish ? "Staff con alertas en silencio" : "Staff with alerts muted"}</span>
                    </div>
                  </button>
                  <button type="button" className="alert-readiness-tile" onClick={() => scrollToAlertPanel("alert-readiness-patients")}>
                    <div>
                      <strong>{notificationReadiness?.totals.patientRoomsReady ?? 0}/{notificationReadiness?.totals.patientRoomsTotal ?? 0}</strong>
                      <span>{isSpanish ? "Salas de paciente con push" : "Patient rooms with push"}</span>
                    </div>
                  </button>
                  <button type="button" className={`alert-readiness-tile ${patientRoomsMissingAlerts.length > 0 ? "warning" : ""}`} onClick={() => scrollToAlertPanel("alert-readiness-patients")}>
                    <div>
                      <strong>{patientRoomsMissingAlerts.length}</strong>
                      <span>{isSpanish ? "Salas sin push registrado" : "Rooms missing push registration"}</span>
                    </div>
                  </button>
                </div>

                <div className="export-card" style={{ marginBottom: 14 }}>
                  <p className="secure-invite-label">{isSpanish ? "Punto crítico" : "Critical point"}</p>
                  <p className="secure-invite-code" style={{ color: "#334155" }}>
                    {isSpanish
                      ? "El portal ahora tiene tono Crítico repetido para alertas dentro de la app. Para una app médica de tienda, el siguiente paso debe ser capa nativa con APNs/FCM, canales de sonido, biometría y escalación redundante."
                      : "The portal now has a Critical repeat tone for in-app alerts. For a medical store app, the next step should be a native layer with APNs/FCM, sound channels, biometrics, and redundant escalation."}
                  </p>
                </div>

                <div className="alert-readiness-columns">
                  <div className="alert-readiness-panel" id="alert-readiness-staff">
                    <h3>{isSpanish ? "Staff" : "Staff"}</h3>
                    <div className="alert-readiness-list">
                      {staffAlertRows.length === 0 ? (
                        <p className="muted">{isSpanish ? "Sin registros de staff para revisar." : "No staff records to review."}</p>
                      ) : (
                        staffAlertRows.map((member) => {
                          const missingPush = member.pushDevices === 0;
                          const mutedAlerts = member.alertTone === "off";
                          return (
                            <button
                              key={`staff-alert-${member.id}`}
                              type="button"
                              className={`alert-readiness-row ${missingPush || mutedAlerts ? "missing" : ""}`}
                              onClick={() => openStaffFromAlertReadiness(member.id)}
                            >
                              <span className="alert-ready-dot">{missingPush ? "NO" : mutedAlerts ? "OFF" : "OK"}</span>
                              <span className="alert-readiness-copy">
                                <strong>{member.name}</strong>
                                <span>
                                  {[
                                    member.adminLevel || member.role || (isSpanish ? "Staff" : "Staff"),
                                    member.alertTone ? alertToneText(member.alertTone, isSpanish) : (isSpanish ? "Sin registro" : "No saved tone"),
                                    alertLastSeen(member.latestSubscriptionAt),
                                  ].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <span className="alert-device-count">{member.pushDevices}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="alert-readiness-panel" id="alert-readiness-patients">
                    <h3>{isSpanish ? "Pacientes activos" : "Active patients"}</h3>
                    <div className="alert-readiness-list">
                      {patientAlertRows.length === 0 ? (
                        <p className="muted">{isSpanish ? "Sin salas activas para revisar." : "No active rooms to review."}</p>
                      ) : (
                        patientAlertRows.map((room) => {
                          const missingPush = room.pushDevices === 0;
                          return (
                            <button
                              key={`room-alert-${room.roomId}`}
                              type="button"
                              className={`alert-readiness-row ${missingPush ? "missing" : ""}`}
                              onClick={() => openPatientRoomFromAlertReadiness(room.patientId)}
                            >
                              <span className="alert-ready-dot">{missingPush ? "NO" : "OK"}</span>
                              <span className="alert-readiness-copy">
                                <strong>{room.patientName}</strong>
                                <span>
                                  {[room.procedureName || (isSpanish ? "Procedimiento" : "Procedure"), alertLastSeen(room.latestSubscriptionAt)].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <span className="alert-device-count">{room.pushDevices}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
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

              {activeAdminSection === "buscar-paciente" && (
              <section className="card admin-section-results" id="expedientes">
              <div className="header-row" style={{ marginBottom: 0 }}>
                <span className="result-count">
                  {hasActiveSearch
                    ? (isSpanish ? `${displayedPatientCards.length} coincidencia(s)` : `${displayedPatientCards.length} match(es)`)
                    : (isSpanish ? `${displayedPatientCards.length} paciente(s) activo(s)` : `${displayedPatientCards.length} active patient(s)`)}
                </span>
                {renderSectionTopButton()}
              </div>

              {displayedPatientCards.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
                    {hasActiveSearch
                      ? (isSpanish ? "No encontré expedientes con esa búsqueda" : "No records matched that search")
                      : (isSpanish ? "No hay pacientes activos para mostrar" : "No active patients to show")}
                  </p>
                  <p className="muted">
                    {hasActiveSearch
                      ? (isSpanish ? "Prueba con menos palabras o con otro dato del paciente." : "Try fewer words or a different patient detail.")
                      : (isSpanish ? "El buscador sigue disponible arriba para encontrar archivo, papelera o coincidencias específicas." : "The search above is still available to find archive, trash, or specific matches.")}
                  </p>
                </div>
              ) : (
                <>
                  {hiddenPatientCount > 0 && (
                    <div className="export-card" style={{ marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>
                        {isSpanish ? `Mostrando ${visiblePatientCards.length} de ${displayedPatientCards.length} resultados.` : `Showing ${visiblePatientCards.length} of ${displayedPatientCards.length} results.`}
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
                    const memberIsOwner = isOwnerIdentity({
                      id: member.id,
                      email: rawMemberEmail,
                      phone: member.phone,
                      fullName: member.full_name,
                      displayName: member.display_name,
                      adminLevel: member.admin_level,
                    });
                    const isGlobalAccessMember = memberIsOwner || memberHasDeveloperAccess(member, rawMemberEmail);
                    const level = memberIsOwner ? "owner" : normalizeAdminLevel(member.admin_level, rawMemberEmail);
                    const canEditThisMember = canManageAdmins && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const isSelf = member.id === viewerId;
                    const canDeleteThisMember = canDeleteStaffAccounts && !isSelf && level !== "owner" && (canManageOwner || level !== "super_admin");
                    const accessKey = `${member.id}-admin_level`;
                    const permissionsKey = `${member.id}-permissions`;
                    const officeKey = `${member.id}-office_location`;
                    const phoneKey = `${member.id}-phone`;
                    const emailKey = `${member.id}-email`;
                    const phoneDraft = staffPhoneDrafts[member.id] ?? (member.phone || "");
                    const emailDraft = staffEmailDrafts[member.id] ?? visibleMemberEmail;
                    const cleanPhoneDraft = phoneDraft.trim();
                    const cleanEmailDraft = emailDraft.trim().toLowerCase();
                    const deleteBusy = deletingStaffId === member.id;
                    const memberPermissionProfile = { ...member, permissions: staffPermissionMap[member.id] ?? member.permissions };
                    const memberPermissionSet = permissionsForProfile(memberPermissionProfile, rawMemberEmail);
                    const savedPermissionList = STAFF_PERMISSION_KEYS.filter((permission) => memberPermissionSet.has(permission));
                    const draftPermissionList = staffPermissionDrafts[member.id] ?? savedPermissionList;
                    const draftPermissionSet = new Set(draftPermissionList);
                    const draftPermissionsDirty = !samePermissionList(draftPermissionList, savedPermissionList);
                    const canEditPermissionsForMember = canEditThisMember && canManagePermissions;
                    const canEditDeleteStaffAccountsPermission = canEditPermissionsForMember && canManageOwner;
                    const canEditOfficeForMember = !isGlobalAccessMember && canManageAdmins && (canManageOwner || (level !== "owner" && level !== "super_admin"));
                    const enabledPermissionCount = STAFF_PERMISSION_KEYS.filter((permission) => draftPermissionSet.has(permission)).length;
                    const isPendingStaff = `${member.role || ""}`.toLowerCase() === "pending_staff";
                    const canSendResetForMember = canManageAdmins && Boolean(visibleMemberEmail);
                    const savedAlertTone = notificationReadiness?.staff.find((item) => item.id === member.id)?.alertTone || null;
                    const alertToneSaving = savingKey === `${member.id}-alert-tone`;

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
                                  {!isGlobalAccessMember && (
                                    <span className="meta-badge" style={{ color: member.office_location ? "#1D4ED8" : "#0E7490", background: member.office_location ? "#EFF6FF" : "#ECFEFF" }}>
                                      {staffOfficeText(member.office_location)}
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

	                          <details
                              className="staff-controls"
                              open={expandedStaffControlId === member.id}
                              onToggle={(event) => {
                                const isOpen = event.currentTarget.open;
                                setExpandedStaffControlId((current) => {
                                  if (isOpen) return member.id;
                                  return current === member.id ? "" : current;
                                });
                              }}
                            >
	                            <summary>
	                              {isSpanish ? "Control de usuario" : "User controls"}
	                              <span>⌄</span>
	                            </summary>
		                            <div className="staff-controls-body">
                                  <button
                                    type="button"
                                    className="staff-controls-close-btn top"
                                    onClick={() => collapseStaffControls(member.id)}
                                  >
                                    {isSpanish ? "Cerrar opciones de staff" : "Close staff options"}
                                  </button>
                                  {isPendingStaff && (
                                    <div className="setting-group" style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}>
                                      <p className="group-label" style={{ color: "#9A3412" }}>{isSpanish ? "Aprobación pendiente" : "Pending approval"}</p>
                                      <p className="access-help" style={{ color: "#9A3412" }}>
                                        {isSpanish
                                          ? "Esta cuenta no puede ver pacientes ni chats hasta que el doctor o un admin la apruebe. Después seguirá viendo solo salas asignadas."
                                          : "This account cannot view patients or chats until the doctor or an admin approves it. After approval, it will still see assigned rooms only."}
                                      </p>
                                      <div className="mini-actions">
                                        <button
                                          type="button"
                                          className="main-btn"
                                          disabled={!canManageAdmins || savingKey === `${member.id}-role-admin_level`}
                                          onClick={() => approvePendingStaff(member)}
                                        >
                                          {savingKey === `${member.id}-role-admin_level`
                                            ? (isSpanish ? "Aprobando..." : "Approving...")
                                            : (isSpanish ? "Aprobar acceso" : "Approve access")}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  <div className="staff-contact-settings-grid">
                                    {!isGlobalAccessMember && (
                                      <div className="setting-group">
                                        <p className="group-label">{isSpanish ? "Consultorio asignado" : "Assigned office"}</p>
                                        <p className="access-help">
                                          {isSpanish
                                            ? "El creador de pacientes usa esta sede para mostrar quién puede asignarse."
                                            : "The patient creator uses this office for staff assignment."}
                                        </p>
                                        <div className="permission-toolbar">
                                          {(["Guadalajara", "Tijuana"] as Office[]).map((office) => {
                                            const selected = member.office_location === office;
                                            return (
                                              <button
                                                key={`${member.id}-${office}`}
                                                type="button"
                                                className="mini-btn"
                                                style={{
                                                  background: selected ? "#EFF6FF" : "#EFF3F8",
                                                  color: selected ? "#1D4ED8" : "#374151",
                                                  opacity: !canEditOfficeForMember || savingKey === officeKey ? 0.55 : 1,
                                                }}
                                                disabled={!canEditOfficeForMember || savingKey === officeKey}
                                                onClick={() => updateStaffField(
                                                  member,
                                                  { office_location: office },
                                                  isSpanish ? `${member.full_name || "Staff"} asignado a ${office}.` : `${member.full_name || "Staff"} assigned to ${office}.`
                                                )}
                                              >
                                                {office}
                                              </button>
                                            );
                                          })}
                                          <button
                                            type="button"
                                            className="mini-btn"
                                            style={{
                                              background: !member.office_location ? "#ECFEFF" : "#EFF3F8",
                                              color: !member.office_location ? "#0E7490" : "#374151",
                                              opacity: !canEditOfficeForMember || savingKey === officeKey ? 0.55 : 1,
                                            }}
                                            disabled={!canEditOfficeForMember || savingKey === officeKey}
                                            onClick={() => updateStaffField(
                                              member,
                                              { office_location: null },
                                              isSpanish ? `${member.full_name || "Staff"} asignado a ambas sedes.` : `${member.full_name || "Staff"} assigned to both offices.`
                                            )}
                                          >
                                            {isSpanish ? "Ambas sedes" : "Both offices"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="setting-group">
                                      <p className="group-label">{isSpanish ? "Teléfono" : "Phone"}</p>
                                      <div className="mini-actions">
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
                                      <p className="group-label">{isSpanish ? "Correo y recuperación" : "Email and recovery"}</p>
                                      <p className="access-help">
                                        {isSpanish
                                          ? "Correo real para recuperación y reset seguro."
                                          : "Real email for recovery and secure reset."}
                                      </p>
                                      <div className="mini-actions">
                                        <input
                                          className="line-input"
                                          value={emailDraft}
                                          disabled={!canEditThisMember}
                                          inputMode="email"
                                          autoComplete="email"
                                          onChange={(event) => setStaffEmailDrafts((current) => ({ ...current, [member.id]: event.target.value }))}
                                          placeholder="staff@correo.com"
                                          style={{ minWidth: 180, flex: "1 1 240px", height: 42, padding: "0 12px", fontSize: 14 }}
                                        />
                                        <button
                                          className="mini-btn"
                                          disabled={!canEditThisMember || savingKey === emailKey || (!!cleanEmailDraft && !validEmail(cleanEmailDraft))}
                                          onClick={() => updateStaffField(
                                            member,
                                            { email: cleanEmailDraft || null },
                                            isSpanish ? `Correo de ${member.full_name || "staff"} actualizado.` : `Email for ${member.full_name || "staff"} updated.`
                                          )}
                                        >
                                          {savingKey === emailKey ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar correo" : "Save email")}
                                        </button>
                                        <button
                                          className="mini-btn"
                                          disabled={!canSendResetForMember || resetBusyId === member.id}
                                          onClick={() => sendStaffPasswordReset(member)}
                                          style={{ background: "#ECFEFF", color: "#0E7490" }}
                                        >
                                          {resetBusyId === member.id ? (isSpanish ? "Enviando..." : "Sending...") : (isSpanish ? "Enviar reset" : "Send reset")}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  {canManageAlertToneDefaults && (
                                    <div className="setting-group">
                                      <p className="group-label">{isSpanish ? "Tono actual de alertas" : "Current alert tone"}</p>
                                      <p className="access-help">
                                        {isSpanish
                                          ? "El doctor o Super Admin puede encender alertas de una cuenta en silencio o escoger un tono inicial. El staff siempre puede cambiarlo después desde Ajustes."
                                          : "The doctor or Super Admin can turn alerts back on for a muted account or choose a starting tone. Staff can always change it later in Settings."}
                                      </p>
                                      <div className="permission-toolbar">
                                        <button
                                          type="button"
                                          className="mini-btn"
                                          disabled={alertToneSaving}
                                          onClick={() => saveStaffAlertTone(member, null)}
                                          style={{
                                            background: savedAlertTone ? "#EFF3F8" : "#ECFEFF",
                                            color: savedAlertTone ? "#374151" : "#0E7490",
                                            opacity: alertToneSaving ? 0.55 : 1,
                                          }}
                                        >
                                          {isSpanish ? "Sin registro" : "No saved tone"}
                                        </button>
                                        {ALERT_TONE_OPTIONS.map((tone) => (
                                          <button
                                            key={`${member.id}-alert-tone-${tone}`}
                                            type="button"
                                            className="mini-btn"
                                            disabled={alertToneSaving}
                                            onClick={() => saveStaffAlertTone(member, tone)}
                                            style={{
                                              background: savedAlertTone === tone ? "#EFF6FF" : "#EFF3F8",
                                              color: savedAlertTone === tone ? "#1D4ED8" : "#374151",
                                              opacity: alertToneSaving ? 0.55 : 1,
                                            }}
                                          >
                                            {alertToneText(tone, isSpanish)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
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
                                      {level === "owner" && (
                                        <span className="meta-badge" style={{ color: adminColor("owner"), background: `${adminColor("owner")}18` }}>
                                          {isSpanish ? "Protegido" : "Protected"}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        className="mini-btn"
                                        disabled={!canEditPermissionsForMember || savingKey === permissionsKey}
                                        onClick={() => {
                                          const next = canManageOwner
                                            ? [...STAFF_PERMISSION_KEYS]
                                            : STAFF_PERMISSION_KEYS.filter((permission) => !doctorOnlyPermissions.has(permission));
                                          setStaffPermissionDrafts((previous) => ({ ...previous, [member.id]: sanitizeEditablePermissions(member, next) }));
                                        }}
                                      >
                                        {isSpanish ? "Seleccionar todo" : "Select all"}
                                      </button>
                                      <button
                                        type="button"
                                        className="mini-btn"
                                        disabled={!canEditPermissionsForMember || savingKey === permissionsKey}
                                        onClick={() => {
                                          setStaffPermissionDrafts((previous) => ({ ...previous, [member.id]: sanitizeEditablePermissions(member, []) }));
                                        }}
                                        style={{ background: "#FEE2E2", color: "#B91C1C" }}
                                      >
                                        {isSpanish ? "Reiniciar todo" : "Reset all"}
                                      </button>
                                      <button
                                        type="button"
                                        className="mini-btn"
                                        disabled={!canEditPermissionsForMember || savingKey === permissionsKey || !draftPermissionsDirty}
                                        onClick={() => updateStaffPermissions(
                                          member,
                                          draftPermissionList,
                                          isSpanish
                                            ? `Permisos de ${member.full_name || "staff"} guardados.`
                                            : `Permissions for ${member.full_name || "staff"} saved.`
                                        )}
                                        style={{ background: draftPermissionsDirty ? "#DCFCE7" : "#EFF3F8", color: draftPermissionsDirty ? "#166534" : "#64748B" }}
                                      >
                                        {savingKey === permissionsKey ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Guardar permisos" : "Save permissions")}
                                      </button>
                                    </div>
                                    <div className="permission-grid">
                                      {permissionGroups.map((group) => (
                                        <div key={`${member.id}-${group.id}`} className="permission-card">
                                          <p className="permission-card-title">{isSpanish ? group.es : group.en}</p>
                                          <div className="permission-list">
                                            {group.permissions.map((permission) => {
                                              const checked = draftPermissionSet.has(permission);
                                              const isDoctorOnlyPermission = doctorOnlyPermissions.has(permission);
                                              const canEditThisPermission = canEditPermissionsForMember && (!isDoctorOnlyPermission || canEditDeleteStaffAccountsPermission);
                                              return (
                                                <label key={`${member.id}-${permission}`} className={`permission-row ${checked ? "enabled" : ""}`}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={!canEditThisPermission || savingKey === permissionsKey}
                                                    onChange={(event) => {
                                                      const next = STAFF_PERMISSION_KEYS.filter((candidate) =>
                                                        candidate === permission ? event.target.checked : draftPermissionSet.has(candidate)
                                                      );
                                                      setStaffPermissionDrafts((previous) => ({ ...previous, [member.id]: sanitizeEditablePermissions(member, next) }));
                                                    }}
                                                  />
                                                  <span>
                                                    <span className="permission-title-line">
                                                      <strong>{permissionLabel(permission, lang)}</strong>
                                                      <button
                                                        type="button"
                                                        className="permission-info-btn"
                                                        aria-label={isSpanish ? `Explicar ${permissionLabel(permission, lang)}` : `Explain ${permissionLabel(permission, lang)}`}
                                                        onClick={(event) => {
                                                          event.preventDefault();
                                                          event.stopPropagation();
                                                          setPermissionHelp(permission);
                                                        }}
                                                      >
                                                        i
                                                      </button>
                                                    </span>
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
                                          : !canDeleteStaffAccounts
                                            ? (isSpanish ? "Requiere permiso del doctor" : "Requires doctor permission")
                                            : (isSpanish ? "Solo doctor para super admin" : "Doctor only for super admin")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="staff-controls-close-btn bottom"
                                onClick={() => collapseStaffControls(member.id)}
                              >
                                {isSpanish ? "Cerrar opciones de staff" : "Close staff options"}
                              </button>
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

              {canManageOwner && activeAdminSection === "developer-access" && (
              <section className="card admin-side-developer" id="developer-access">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Acceso de desarrollador" : "Developer access"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Solo la cuenta propietaria de Miguel puede enviar este enlace. El desarrollador recibe acceso completo temporal, pero no queda protegido como propietario."
                        : "Only Miguel's owner account can send this link. The developer receives temporary full access, but is not protected as an owner."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
                </div>
                <div className="secure-invite">
                  <p className="secure-invite-label">{isSpanish ? "Soporte técnico" : "Technical support"}</p>
                  <p className="secure-invite-main">
                    {isSpanish ? "Crear o restaurar acceso para Ray" : "Create or restore access for Ray"}
                  </p>
                  <p className="small-note" style={{ marginTop: 8 }}>
                    {isSpanish
                      ? "Cuando el doctor elimine esta cuenta desde Equipo, el portal quitará el acceso pero no bloqueará el correo ni rotará el código de invitación."
                      : "When the doctor deletes this account from Team, the portal removes access but does not block the email or rotate the invitation code."}
                  </p>
                </div>
                <div className="developer-card-grid">
                  <div>
                    <p className="group-label">{isSpanish ? "Nombre" : "Name"}</p>
                    <input
                      className="line-input"
                      value={developerNameDraft}
                      onChange={(event) => setDeveloperNameDraft(event.target.value)}
                      placeholder={isSpanish ? "Nombre del desarrollador" : "Developer name"}
                    />
                  </div>
                  <div>
                    <p className="group-label">{isSpanish ? "Correo" : "Email"}</p>
                    <input
                      className="line-input"
                      value={developerEmailDraft}
                      onChange={(event) => setDeveloperEmailDraft(event.target.value)}
                      inputMode="email"
                      autoComplete="email"
                      placeholder="mrdiazsr@icloud.com"
                    />
                  </div>
                </div>
                <div className="inline-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="main-btn"
                    disabled={developerAccessBusy || !validEmail(developerEmailDraft)}
                    onClick={sendDeveloperAccess}
                  >
                    {developerAccessBusy
                      ? (isSpanish ? "Enviando..." : "Sending...")
                      : (isSpanish ? "Enviar acceso de desarrollador" : "Send developer access")}
                  </button>
                </div>
              </section>
              )}

              {activeAdminSection === "invitar-personal" && (
              <section className="card admin-side-invite" id="invitar-personal">
                <div className="header-row">
                  <div>
                    <p className="card-title">{isSpanish ? "Invitar personal" : "Invite team member"}</p>
                    <p className="muted">
                      {isSpanish
                        ? "Cada invitación crea un código nuevo de un solo uso. La cuenta queda pendiente hasta aprobación manual."
                        : "Each invitation creates a fresh one-time code. The account stays pending until manual approval."}
                    </p>
                  </div>
                  {renderSectionTopButton()}
                </div>

                <div className="secure-invite">
                  <p className="secure-invite-label">{isSpanish ? "Invitación segura" : "Secure invitation"}</p>
                  <p className="secure-invite-main">
                    {generatedInviteCode
                      ? (isSpanish ? "Última invitación creada" : "Latest invitation created")
                      : (isSpanish ? "Lista para generar" : "Ready to generate")}
                  </p>
                  <p className="secure-invite-code">
                    {generatedInviteCode
                      ? (isSpanish ? `Código creado: ${generatedInviteCode}` : `Created code: ${generatedInviteCode}`)
                      : (isSpanish ? "El código aparecerá claro en el mensaje del destinatario." : "The code will be clear in the recipient message.")}
                  </p>
                  {generatedInviteExpiresText && (
                    <p className="small-note" style={{ marginTop: 6 }}>
                      {isSpanish ? `Expira: ${generatedInviteExpiresText}` : `Expires: ${generatedInviteExpiresText}`}
                    </p>
                  )}
                  {generatedInviteLink && (
                    <p className="small-note" style={{ marginTop: 6, overflowWrap: "anywhere" }}>
                      {generatedInviteLink}
                    </p>
                  )}
                  <p className="small-note" style={{ marginTop: 8 }}>
                    {isSpanish
                      ? "El mensaje incluye el código en una línea separada para que no se pierda. Aunque alguien tenga el enlace, no ve pacientes hasta que lo apruebes desde Solicitudes o Equipo."
                      : "The message puts the code on its own line so it is not missed. Even with the link, the account cannot see patients until approved from Requests or Team."}
                  </p>
                  <div className="inline-actions" style={{ marginTop: 10 }}>
                    <button className="main-btn" onClick={copyInviteLink} disabled={generatingInvite}>
                      {generatingInvite ? (isSpanish ? "Generando..." : "Generating...") : (isSpanish ? "Copiar invitación" : "Copy invitation")}
                    </button>
                    <button className="ghost-btn" onClick={sendInviteText} disabled={generatingInvite}>
                      SMS
                    </button>
                    <button className="ghost-btn" onClick={sendInviteEmail} disabled={generatingInvite}>
                      Email
                    </button>
                    <button className="ghost-btn" onClick={shareInviteLink} disabled={generatingInvite}>
                      {isSpanish ? "Compartir" : "Share"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <p className="group-label" style={{ marginBottom: -2 }}>{isSpanish ? "Código manual de respaldo" : "Manual fallback code"}</p>
                  <p className="small-note">
                    {inviteCodePreview
                      ? (isSpanish ? `Respaldo activo: ${inviteCodePreview}` : `Active fallback: ${inviteCodePreview}`)
                      : (isSpanish ? "Sin respaldo manual activo" : "No active manual fallback")}
                  </p>
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

        {permissionHelp && (
          <div className="permission-help-overlay" onClick={() => setPermissionHelp(null)}>
            <div className="permission-help-modal" role="dialog" aria-modal="true" aria-labelledby="permission-help-title" onClick={(event) => event.stopPropagation()}>
              <p className="permission-help-kicker">{isSpanish ? "Derecho del portal" : "Portal right"}</p>
              <h2 id="permission-help-title" className="permission-help-title">{permissionLabel(permissionHelp, lang)}</h2>
              <p className="permission-help-copy">{permissionDetails[permissionHelp][lang]}</p>
              <div className="inline-actions" style={{ marginTop: 18 }}>
                <button className="main-btn" type="button" onClick={() => setPermissionHelp(null)}>
                  {isSpanish ? "Entendido" : "Got it"}
                </button>
              </div>
            </div>
          </div>
        )}

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
