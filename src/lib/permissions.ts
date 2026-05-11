import { isOwnerEmail } from "@/lib/securityConfig";

export const STAFF_PERMISSION_KEYS = [
  "view_patients",
  "create_patients",
  "edit_patient_info",
  "archive_rooms",
  "restore_rooms",
  "view_clinical_history",
  "view_upload_files",
  "view_internal_notes",
  "manage_internal_notes",
  "manage_labels",
  "manage_staff",
  "manage_permissions",
  "access_audit_logs",
  "access_settings_security",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];
export type PermissionLang = "es" | "en";
export type StaffPermissionMap = Record<string, StaffPermissionKey[]>;

export const STAFF_PERMISSIONS_SETTING_KEY = "staff_permissions";

export type PermissionProfile = {
  email?: string | null;
  admin_level?: string | null;
  role?: string | null;
  permissions?: unknown;
};

export const STAFF_PERMISSION_LABELS: Record<StaffPermissionKey, { es: string; en: string }> = {
  view_patients: { es: "Ver pacientes", en: "View patients" },
  create_patients: { es: "Crear pacientes", en: "Create patients" },
  edit_patient_info: { es: "Editar datos del paciente", en: "Edit patient info" },
  archive_rooms: { es: "Cancelar o archivar salas", en: "Cancel or archive rooms" },
  restore_rooms: { es: "Restaurar salas", en: "Restore rooms" },
  view_clinical_history: { es: "Ver Historia Clinica", en: "View clinical history" },
  view_upload_files: { es: "Ver y subir archivos", en: "View and upload files" },
  view_internal_notes: { es: "Ver notas y fotos internas", en: "View internal notes/photos" },
  manage_internal_notes: { es: "Gestionar notas y fotos internas", en: "Manage internal notes/photos" },
  manage_labels: { es: "Gestionar etiquetas", en: "Manage labels" },
  manage_staff: { es: "Gestionar personal", en: "Manage staff" },
  manage_permissions: { es: "Gestionar permisos", en: "Manage permissions" },
  access_audit_logs: { es: "Ver auditoria", en: "Access audit logs" },
  access_settings_security: { es: "Ajustes y seguridad", en: "Settings and security" },
};

export const LEGACY_ROLE_PERMISSION_DEFAULTS: Record<string, StaffPermissionKey[]> = {
  owner: [...STAFF_PERMISSION_KEYS],
  super_admin: [
    "view_patients",
    "create_patients",
    "edit_patient_info",
    "archive_rooms",
    "restore_rooms",
    "view_clinical_history",
    "view_upload_files",
    "view_internal_notes",
    "manage_internal_notes",
    "manage_labels",
    "manage_staff",
    "access_audit_logs",
    "access_settings_security",
  ],
  admin: [
    "view_patients",
    "create_patients",
    "view_upload_files",
    "manage_labels",
    "access_settings_security",
  ],
  none: ["view_patients", "view_upload_files", "manage_labels"],
};

export const permissionLabel = (key: StaffPermissionKey, lang: PermissionLang) =>
  STAFF_PERMISSION_LABELS[key][lang];

export const normalizePermissionList = (value: unknown): StaffPermissionKey[] => {
  if (!value) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key)
      : [];

  return raw.filter((key): key is StaffPermissionKey =>
    STAFF_PERMISSION_KEYS.includes(key as StaffPermissionKey)
  );
};

export const parseStaffPermissionMap = (value: unknown): StaffPermissionMap => {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([staffId, permissions]) => [staffId, normalizePermissionList(permissions)])
    );
  } catch {
    return {};
  }
};

export const permissionsForProfile = (profile: PermissionProfile | null | undefined, email = ""): Set<StaffPermissionKey> => {
  const resolvedEmail = email || `${profile?.email || ""}`;
  if (isOwnerEmail(resolvedEmail)) return new Set(STAFF_PERMISSION_KEYS);
  if (`${profile?.role || ""}`.toLowerCase() === "pending_staff") return new Set();

  const explicit = normalizePermissionList(profile?.permissions);
  if (explicit.length) return new Set(explicit);

  const level = `${profile?.admin_level || "none"}`.toLowerCase();
  return new Set(LEGACY_ROLE_PERMISSION_DEFAULTS[level] || LEGACY_ROLE_PERMISSION_DEFAULTS.none);
};

export const permissionPresetForAdminLevel = (level: string) =>
  [...(LEGACY_ROLE_PERMISSION_DEFAULTS[`${level || "none"}`.toLowerCase()] || LEGACY_ROLE_PERMISSION_DEFAULTS.none)];

export const hasPermission = (
  profile: PermissionProfile | null | undefined,
  email: string,
  permission: StaffPermissionKey,
) => permissionsForProfile(profile, email).has(permission);
