"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { parseFormMessage } from "@/components/FormMessage";
import { displayToIsoDate, formatDateTyping, isoToDisplayDate } from "@/lib/dateInput";
import { PATIENT_LANGUAGE_OPTIONS, PATIENT_TIMEZONE_OPTIONS, currentTimeInZone, labelPatientLanguage, labelTimeZone } from "@/lib/patientMeta";
import { useAdminLang } from "@/lib/useAdminLang";
import { STAFF_PERMISSIONS_SETTING_KEY, hasPermission, parseStaffPermissionMap } from "@/lib/permissions";
import {
  PROCEDURE_STATUS_OPTIONS,
  buildExportHtml,
  buildPatientBundles,
  downloadFile,
  getMediaEntries,
  getTimelineEntries,
  initials,
  isStaffRecordPhotoMessage,
  isMissingColumnError,
  logAdminEvent,
  normalizeAdminLevel,
  normalizeOffice,
  openPrintPreview,
  parseInternalNoteText,
  normalizeRecordStatus,
  officeLabel,
  procedureStatusLabel,
  recordStatusColor,
  recordStatusLabel,
  roleColor,
  roleLabel,
  sanitizeFileName,
  type MessageRecord,
  type Office,
  type PatientRecord,
  type PatientRecordStatus,
  type ProcedureRecord,
  type RoomRecord,
  type StaffProfile,
} from "@/lib/adminPortal";

type PatientDraft = {
  full_name: string;
  phone: string;
  email: string;
  birthdate: string;
  preferred_language: string;
  timezone: string;
  allergies: string;
  current_medications: string;
};

type ProcedureDraft = {
  procedure_name: string;
  office_location: Office;
  status: string;
  surgery_date: string;
};

type RecordSectionId = "documentos" | "procedimientos" | "datos-paciente" | "archivo-interno" | "media" | "historial";

export default function AdminPatientRecordPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Array.isArray(params?.patientId) ? params.patientId[0] : params?.patientId || "";
  const { lang, setLang, isSpanish } = useAdminLang();

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
  const [patientDraft, setPatientDraft] = useState<PatientDraft>({
    full_name: "",
    phone: "",
    email: "",
    birthdate: "",
    preferred_language: "es",
    timezone: "America/Mexico_City",
    allergies: "",
    current_medications: "",
  });
  const [procedureDrafts, setProcedureDrafts] = useState<Record<string, ProcedureDraft>>({});
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingProcedureId, setSavingProcedureId] = useState("");
  const [statusSaving, setStatusSaving] = useState<PatientRecordStatus | "">("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [timelineQuery, setTimelineQuery] = useState("");
  const [timelineFrom, setTimelineFrom] = useState("");
  const [timelineTo, setTimelineTo] = useState("");
  const [activeRecordSection, setActiveRecordSection] = useState<RecordSectionId | "">("");
  const [selectedClinicalHistoryEntry, setSelectedClinicalHistoryEntry] = useState<any | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const timelineSectionRef = useRef<HTMLElement | null>(null);

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = hasPermission(viewerProfile, viewerEmail, "view_patients");
  const canEditRecord = hasPermission(viewerProfile, viewerEmail, "edit_patient_info") && (viewerAdminLevel === "owner" || viewerProfile?.role === "doctor");
  const staffById = useMemo(() => new Map(staffProfiles.map((member) => [member.id, member])), [staffProfiles]);
  const patientStatus = normalizeRecordStatus(patient?.record_status);

  const t = {
    loadingTitle: isSpanish ? "Abriendo expediente" : "Opening record",
    loadingCopy: isSpanish
      ? "Estoy reuniendo procedimientos, salas, medios e historial completo del paciente."
      : "I am gathering procedures, rooms, media, and the full patient history.",
    signInTitle: isSpanish ? "Inicia sesión primero" : "Sign in first",
    signInCopy: isSpanish
      ? "Este expediente solo se puede abrir desde una sesión administrativa activa."
      : "This record can only be opened from an active admin session.",
    signInButton: isSpanish ? "Ir a login" : "Go to login",
    noAccessTitle: isSpanish ? "Sin acceso" : "No access",
    noAccessCopy: isSpanish
      ? "Tu cuenta puede usar el portal, pero no tiene permisos para revisar expedientes administrativos."
      : "Your account can use the portal, but it does not have permission to review admin records.",
    backToPortal: isSpanish ? "Volver al portal" : "Back to portal",
    recordTitle: isSpanish ? "Expediente del paciente" : "Patient record",
    recordSubtitle: isSpanish ? "Revisión completa antes de exportar" : "Full review before export",
    backToCenter: isSpanish ? "← Volver al centro" : "← Back to control center",
    goToPortal: isSpanish ? "Ir al portal" : "Go to portal",
    exporting: isSpanish ? "Preparando..." : "Preparing...",
    exportRecord: isSpanish ? "📤 Exportar PDF" : "📤 Export PDF",
    printRecord: isSpanish ? "🖨️ PDF / Imprimir" : "🖨️ PDF / Print",
    unavailableTitle: isSpanish ? "Expediente no disponible" : "Record unavailable",
    unavailableCopy: isSpanish
      ? "Vuelve al centro de control para buscarlo de nuevo o intenta recargar la página."
      : "Go back to the control center to search again or reload the page.",
    reload: isSpanish ? "Recargar" : "Reload",
    unnamedPatient: isSpanish ? "Paciente sin nombre" : "Unnamed patient",
    noPhone: isSpanish ? "Sin teléfono" : "No phone",
    noEmail: isSpanish ? "Sin correo" : "No email",
    noBirthdate: isSpanish ? "Sin fecha" : "No date",
    relatedOffices: isSpanish ? "Sedes relacionadas" : "Related offices",
    noOffice: isSpanish ? "📍 Sin sede" : "📍 No office",
    heroCopy: isSpanish
      ? "Documento, procedimiento, sede, datos y medios viven en secciones separadas para revisar el expediente sin buscar entre todo el historial."
      : "Documents, procedure, office, details, and media live in separate sections so the record can be reviewed without digging through the full history.",
    heroHelper: isSpanish
      ? "Solo el doctor con control total puede modificar datos clínicos. El equipo revisa el expediente en modo lectura."
      : "Only the doctor with full control can modify clinical data. The team reviews the record in read-only mode.",
    patientPhoto: isSpanish ? "Foto del paciente" : "Patient photo",
    addPhoto: isSpanish ? "Agregar foto" : "Add photo",
    changePhoto: isSpanish ? "Cambiar foto" : "Change photo",
    uploadPhotoHelp: isSpanish
      ? "Úsalo si el paciente nunca subió foto o si quieres corregirla."
      : "Use this if the patient never uploaded a photo or if you need to correct it.",
    basicInfo: isSpanish ? "Datos del paciente" : "Patient details",
    basicInfoCopy: isSpanish
      ? "Nombre, teléfono, correo, fecha de nacimiento, idioma, zona horaria, alergias y medicamentos."
      : "Name, phone, email, birth date, language, time zone, allergies, and medications.",
    dateHint: isSpanish ? "Usa formato dd/mm/aaaa" : "Use dd/mm/yyyy format",
    patientLanguage: isSpanish ? "Idioma del paciente" : "Patient language",
    patientTimezone: isSpanish ? "Zona horaria del paciente" : "Patient time zone",
    patientAllergies: isSpanish ? "Alergias" : "Allergies",
    patientMedications: isSpanish ? "Medicamentos actuales" : "Current medications",
    patientLocalTime: isSpanish ? "Hora local actual" : "Current local time",
    savePatient: isSpanish ? "Guardar datos del paciente" : "Save patient details",
    savingPatient: isSpanish ? "Guardando..." : "Saving...",
    quickSummary: isSpanish ? "Resumen rápido" : "Quick summary",
    lastEvent: isSpanish ? "Último evento registrado" : "Latest recorded event",
    firstRoom: isSpanish ? "Primera sala creada" : "First room created",
    noActivity: isSpanish ? "Sin actividad" : "No activity",
    noRooms: isSpanish ? "Sin salas" : "No rooms",
    recordStatus: isSpanish ? "Estado del expediente" : "Record status",
    recordStatusCopy: isSpanish
      ? "Usa activo, archivado o papelera. El chat no se borra."
      : "Use active, archived, or trash. The chat is not deleted.",
    active: isSpanish ? "🟢 Activo" : "🟢 Active",
    archived: isSpanish ? "🗂️ Archivado" : "🗂️ Archived",
    trash: isSpanish ? "🗑️ Papelera" : "🗑️ Trash",
    proceduresTitle: isSpanish ? "Procedimientos y sedes" : "Procedures and offices",
    proceduresCopy: isSpanish
      ? "Procedimiento, sede y fecha de cirugía del expediente."
      : "Procedure, office, and surgery date for this record.",
    selectStatus: isSpanish ? "Selecciona estatus" : "Select status",
    saveProcedure: isSpanish ? "Guardar procedimiento" : "Save procedure",
    savingProcedure: isSpanish ? "Guardando..." : "Saving...",
    statusPermissionHint: isSpanish ? "Solo doctor o super admin puede cambiar estatus." : "Only doctor or super admin can change status.",
    statusPermissionError: isSpanish ? "Solo doctor o super admin puede cambiar el estatus del procedimiento." : "Only doctor or super admin can change procedure status.",
    recordEditLocked: isSpanish ? "Modo lectura para el equipo. Solo el doctor con control total puede modificar este expediente." : "Team read-only mode. Only the doctor with full control can modify this record.",
    doctorEditNote: isSpanish ? "Edición disponible solo para el doctor con control total." : "Editing is available only to the doctor with full control.",
    procedureLockedError: isSpanish ? "Solo el doctor con control total puede modificar procedimiento, sede o fecha." : "Only the doctor with full control can modify procedure, office, or date.",
    noProcedures: isSpanish ? "No hay procedimientos registrados para este paciente." : "There are no procedures registered for this patient.",
    roomsRelated: isSpanish ? "Salas relacionadas" : "Related rooms",
    documentsTitle: isSpanish ? "Documento" : "Documents",
    documentsCopy: isSpanish ? "Historia Clinica y formularios enviados por el paciente viven separados de fotos, videos y mensajes." : "Historia Clinica and patient-submitted forms stay separate from photos, videos, and messages.",
    noDocuments: isSpanish ? "No hay documentos en el historial." : "There are no documents in the history.",
    mediaTitle: isSpanish ? "Media y archivos" : "Media and files",
    mediaCopy: isSpanish ? "Fotos, videos, audios y archivos generales enviados o recibidos dentro del chat del paciente." : "Photos, videos, audio files, and general files sent or received inside the patient chat.",
    staffRecordTitle: isSpanish ? "Archivo interno del equipo" : "Internal team record",
    staffRecordCopy: isSpanish ? "Notas y fotos internas visibles solo para el equipo autorizado. El paciente no ve esta sección." : "Internal notes and photos visible only to authorized staff. The patient cannot see this section.",
    internalNotes: isSpanish ? "Notas internas" : "Internal notes",
    internalPhotos: isSpanish ? "Fotos internas" : "Internal photos",
    noInternalNotes: isSpanish ? "No hay notas internas." : "There are no internal notes.",
    noInternalPhotos: isSpanish ? "No hay fotos internas." : "There are no internal photos.",
    images: isSpanish ? "Imágenes" : "Images",
    videos: isSpanish ? "Videos" : "Videos",
    audios: isSpanish ? "Audios" : "Audio files",
    files: isSpanish ? "Archivos" : "Files",
    noImages: isSpanish ? "No hay imágenes en el historial." : "There are no images in the history.",
    noVideos: isSpanish ? "No hay videos en el historial." : "There are no videos in the history.",
    noAudios: isSpanish ? "No hay audios en el historial." : "There are no audio files in the history.",
    noFiles: isSpanish ? "No hay archivos en el historial." : "There are no files in the history.",
    open: isSpanish ? "Abrir" : "Open",
    timelineTitle: isSpanish ? "Cronología completa" : "Full timeline",
    timelineCopy: isSpanish
      ? "Qué pasó, quién escribió, cuándo ocurrió, desde qué sede y con qué procedimiento estaba relacionado."
      : "What happened, who wrote it, when it happened, from which office, and which procedure it was tied to.",
    timelineSearch: isSpanish ? "Buscar en historial" : "Search history",
    timelineSearchPH: isSpanish ? "Buscar por texto, remitente, rol o procedimiento..." : "Search by text, sender, role, or procedure...",
    fromDate: isSpanish ? "Desde" : "From",
    toDate: isSpanish ? "Hasta" : "To",
    clearFilters: isSpanish ? "Limpiar filtros" : "Clear filters",
    showingEntries: isSpanish ? "Mostrando" : "Showing",
    jumpTop: isSpanish ? "⬆️ Ir arriba" : "⬆️ Back to top",
    noTimeline: isSpanish ? "No hay historial registrado todavía." : "There is no recorded history yet.",
    roomLabel: isSpanish ? "Sala" : "Room",
    procedureLabel: isSpanish ? "Procedimiento" : "Procedure",
    reasonLabel: isSpanish ? "Motivo / contexto" : "Reason / context",
    deletedMessage: isSpanish
      ? "Este mensaje fue marcado como eliminado, pero se mantiene en el historial."
      : "This message was marked as deleted, but it remains in the history.",
    patientSaved: isSpanish ? "Datos del paciente guardados." : "Patient details saved.",
    photoSaved: isSpanish ? "Foto del paciente actualizada." : "Patient photo updated.",
    uploadError: isSpanish ? "No pude subir la foto del paciente." : "I could not upload the patient photo.",
    fieldSetupError: isSpanish
      ? "Falta correr la configuración de Supabase para guardar esta información nueva."
      : "The Supabase setup still needs to be run before this new information can be saved.",
    shareOpened: isSpanish ? "Se abrió el menú para compartir el expediente." : "The share menu opened for this record.",
    sharePreview: isSpanish ? "Abrí una vista previa del expediente para que puedas compartirlo desde el navegador." : "I opened a record preview so you can share it from the browser.",
    recordDownloaded: isSpanish ? "Abrí el expediente listo para guardarlo como PDF." : "I opened the record ready to save as PDF.",
    pdfOpened: isSpanish ? "Se abrió la versión lista para imprimir o guardar en PDF." : "The print-ready version opened.",
  };

  const formatDateLocal = (value?: string | null) => {
    if (!value) return t.noBirthdate;
    return new Date(value).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTimeLocal = (value?: string | null) => {
    if (!value) return t.noBirthdate;
    return new Date(value).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const officeText = (office: string | null | undefined) => {
    if (office === "Guadalajara") return "📍 Guadalajara";
    if (office === "Tijuana") return "📍 Tijuana";
    return t.noOffice;
  };

  const recordStatusText = (status: PatientRecordStatus) =>
    isSpanish
      ? recordStatusLabel(status)
      : (
          {
            active: "🟢 Active",
            archived: "🗂️ Archived",
            trash: "🗑️ Trash",
          } as const
        )[status];

  const messageTypeText = (message: MessageRecord) => {
    if (isStaffRecordPhotoMessage(message)) return isSpanish ? "Foto interna" : "Internal photo";
    if (message.is_internal) return isSpanish ? "Nota interna" : "Internal note";
    if (message.message_type === "image") return isSpanish ? "Imagen" : "Image";
    if (message.message_type === "video") return isSpanish ? "Video" : "Video";
    if (message.message_type === "audio") return isSpanish ? "Audio" : "Audio";
    if (message.message_type === "file") return isSpanish ? "Archivo" : "File";
    return isSpanish ? "Mensaje" : "Message";
  };

  const messageReasonText = (message: MessageRecord, procedure: ProcedureRecord) => {
    const rawName = message.file_name || "";
    if (isStaffRecordPhotoMessage(message)) return isSpanish ? "Archivo interno del equipo" : "Internal team record";
    if (message.is_internal) return isSpanish ? "Seguimiento interno del equipo" : "Internal team follow-up";
    if (rawName.startsWith("[MED]")) return isSpanish ? "Seguimiento de medicamento" : "Medication follow-up";
    if (rawName.startsWith("[BEFORE]")) return isSpanish ? "Material preoperatorio" : "Pre-op material";
    if (rawName.startsWith("[FORM]")) return "Historia Clinica";
    if (message.message_type === "image") return isSpanish ? "Imagen compartida en el chat" : "Image shared in chat";
    if (message.message_type === "video") return isSpanish ? "Video compartido en el chat" : "Video shared in chat";
    if (message.message_type === "audio") return isSpanish ? "Audio compartido en el chat" : "Audio shared in chat";
    if (message.message_type === "file") return isSpanish ? "Archivo compartido en el chat" : "File shared in chat";
    return procedure.procedure_name || (isSpanish ? "Seguimiento general del paciente" : "General patient follow-up");
  };

  const payloadFieldChanged = (previousValue: string | null | undefined, nextValue: string | null | undefined, field: string) => {
    const before = previousValue || "";
    const after = nextValue || "";
    return before === after ? null : field;
  };

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

  const timeline = useMemo(
    () => (bundle ? getTimelineEntries(bundle).filter((entry) => !parseFormMessage(entry.message.content)) : []),
    [bundle]
  );
  const media = useMemo(() => (bundle ? getMediaEntries(bundle) : { images: [], videos: [], audios: [], files: [] }), [bundle]);
  const clinicalHistoryEntries = useMemo(() => {
    const latestByRoom = new Map<string, typeof media.files[number]>();
    media.files.forEach((entry) => {
      if (!`${entry.message.file_name || ""}`.startsWith("[FORM]")) return;
      latestByRoom.set(entry.room.id, entry);
    });
    return Array.from(latestByRoom.values());
  }, [media.files]);
  const regularFileEntries = useMemo(
    () => media.files.filter((entry) => !`${entry.message.file_name || ""}`.startsWith("[FORM]")),
    [media.files]
  );
  const internalNoteEntries = useMemo(
    () => timeline.filter((entry) => entry.message.is_internal && entry.message.message_type === "text"),
    [timeline]
  );
  const internalPhotoEntries = useMemo(
    () => timeline.filter((entry) => isStaffRecordPhotoMessage(entry.message)),
    [timeline]
  );
  const publicImageEntries = useMemo(
    () => media.images.filter((entry) => !isStaffRecordPhotoMessage(entry.message)),
    [media.images]
  );
  const filteredTimeline = useMemo(() => {
    const q = timelineQuery.trim().toLowerCase();
    const fromMs = timelineFrom ? new Date(`${timelineFrom}T00:00:00`).getTime() : null;
    const toMs = timelineTo ? new Date(`${timelineTo}T23:59:59.999`).getTime() : null;

    return timeline.filter((entry) => {
      const createdMs = entry.message.created_at ? new Date(entry.message.created_at).getTime() : 0;
      if (fromMs && createdMs < fromMs) return false;
      if (toMs && createdMs > toMs) return false;
      if (!q) return true;

      const haystack = [
        entry.message.sender_name,
        entry.message.sender_role,
        entry.message.sender_type,
        entry.message.content,
        entry.message.file_name,
        entry.message.message_type,
        entry.procedure.procedure_name,
        entry.procedure.office_location,
        entry.room.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [timeline, timelineFrom, timelineQuery, timelineTo]);
  const offices = useMemo(() => {
    return [...new Set(procedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))];
  }, [procedures]);
  const patientLocalTime = currentTimeInZone(patient?.timezone, lang === "es" ? "es-MX" : "en-US");
  const scrollTimelineTop = () => {
    timelineSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openRecordSection = (id: RecordSectionId) => {
    setActiveRecordSection(id);
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  useEffect(() => {
    if (!patient) return;
    setPatientDraft({
      full_name: patient.full_name || "",
      phone: patient.phone || "",
      email: patient.email || "",
      birthdate: isoToDisplayDate(patient.birthdate),
      preferred_language: patient.preferred_language || "es",
      timezone: patient.timezone || "America/Mexico_City",
      allergies: patient.allergies || "",
      current_medications: patient.current_medications || "",
    });
  }, [patient]);

  useEffect(() => {
    const nextDrafts: Record<string, ProcedureDraft> = {};
    procedures.forEach((procedure) => {
      nextDrafts[procedure.id] = {
        procedure_name: procedure.procedure_name || "",
        office_location: normalizeOffice(procedure.office_location),
        status: procedure.status || "",
        surgery_date: isoToDisplayDate(procedure.surgery_date),
      };
    });
    setProcedureDrafts(nextDrafts);
  }, [procedures]);

  const updateSuccess = (message: string) => {
    setPageError("");
    setSuccessMsg(message);
    window.clearTimeout((window as any).__adminPatientToastTimer);
    (window as any).__adminPatientToastTimer = window.setTimeout(() => setSuccessMsg(""), 3200);
  };

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
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

    const [profileRes, permissionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionsRes.data?.value);
    const profile = profileRes.data ? { ...(profileRes.data as StaffProfile), permissions: permissionMap[user.id] ?? (profileRes.data as StaffProfile).permissions } : null;
    setViewerProfile(profile || null);

    const computedAccess = hasPermission(profile as StaffProfile | null, email, "view_patients");
    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (!token) {
      setPageError(isSpanish ? "Tu sesión expiró. Vuelve a iniciar sesión." : "Your session expired. Please sign in again.");
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/admin/patient-record/${encodeURIComponent(patientId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPageError(payload?.error || (isSpanish ? "No pude cargar este expediente." : "I could not load this record."));
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    setPatient(payload.patient as PatientRecord);
    setProcedures((payload.procedures || []) as ProcedureRecord[]);
    setRooms((payload.rooms || []) as RoomRecord[]);
    setMessages((payload.messages || []) as MessageRecord[]);
    setStaffProfiles((payload.staffProfiles || []) as StaffProfile[]);
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) fetchRecord();
  }, [patientId]);

  const savePatientInfo = async () => {
    if (!patient) return;
    if (!canEditRecord) {
      setPageError(t.procedureLockedError);
      return;
    }
    const birthdateIso = patientDraft.birthdate ? displayToIsoDate(patientDraft.birthdate) : "";
    if (patientDraft.birthdate && !birthdateIso) {
      setPageError(isSpanish ? "La fecha de nacimiento debe ir en formato dd/mm/aaaa." : "Birth date must use dd/mm/yyyy format.");
      return;
    }
    setSavingPatient(true);

    const payload = {
      full_name: patientDraft.full_name.trim() || null,
      phone: patientDraft.phone.trim() || null,
      email: patientDraft.email.trim() || null,
      birthdate: birthdateIso || null,
      preferred_language: patientDraft.preferred_language || null,
      timezone: patientDraft.timezone || null,
      allergies: patientDraft.allergies.trim() || null,
      current_medications: patientDraft.current_medications.trim() || null,
    };

    const changedFields = [
      payloadFieldChanged(patient.full_name, patientDraft.full_name.trim(), "full_name"),
      payloadFieldChanged(patient.phone, patientDraft.phone.trim(), "phone"),
      payloadFieldChanged(patient.email, patientDraft.email.trim(), "email"),
      payloadFieldChanged(patient.birthdate, birthdateIso, "birthdate"),
      payloadFieldChanged(patient.preferred_language, patientDraft.preferred_language, "preferred_language"),
      payloadFieldChanged(patient.timezone, patientDraft.timezone, "timezone"),
      payloadFieldChanged(patient.allergies, patientDraft.allergies.trim(), "allergies"),
      payloadFieldChanged(patient.current_medications, patientDraft.current_medications.trim(), "current_medications"),
    ].filter(Boolean) as string[];

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (!token) {
      setSavingPatient(false);
      setPageError(isSpanish ? "Tu sesión expiró. Vuelve a iniciar sesión." : "Your session expired. Please sign in again.");
      return;
    }

    const response = await fetch(`/api/admin/patient-record/${encodeURIComponent(patient.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "updatePatient",
        payload,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSavingPatient(false);

    if (!response.ok || !result?.patient) {
      setPageError(result?.error || (isSpanish ? "No pude guardar los datos del paciente." : "I could not save the patient details."));
      return;
    }

    const data = result.patient as PatientRecord;
    setPatient(data as PatientRecord);
    await logAdminEvent({
      action: "patient_details_updated",
      entityType: "patient",
      entityId: patient.id,
      entityName: patientDraft.full_name.trim() || patient.full_name || t.unnamedPatient,
      patientId: patient.id,
      actorId: viewerProfile?.id || null,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: `Se actualizaron datos del paciente: ${changedFields.join(", ") || "sin cambios detectados"}.`,
      metadata: payload,
    });
    updateSuccess(t.patientSaved);
  };

  const saveProcedure = async (procedureId: string) => {
    if (!canEditRecord) {
      setPageError(t.procedureLockedError);
      return;
    }
    const draft = procedureDrafts[procedureId];
    if (!draft) return;
    const currentProcedure = procedures.find((procedure) => procedure.id === procedureId);
    if (!currentProcedure) return;
    const surgeryDateIso = draft.surgery_date ? displayToIsoDate(draft.surgery_date) : "";
    if (draft.surgery_date && !surgeryDateIso) {
      setPageError(isSpanish ? "La fecha de cirugía debe ir en formato dd/mm/aaaa." : "Surgery date must use dd/mm/yyyy format.");
      return;
    }
    setSavingProcedureId(procedureId);
    const payload = {
      procedure_name: draft.procedure_name.trim() || null,
      office_location: draft.office_location || null,
      surgery_date: surgeryDateIso || null,
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (!token) {
      setSavingProcedureId("");
      setPageError(isSpanish ? "Tu sesión expiró. Vuelve a iniciar sesión." : "Your session expired. Please sign in again.");
      return;
    }

    const response = await fetch(`/api/admin/patient-record/${encodeURIComponent(patient?.id || patientId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "updateProcedure",
        procedureId,
        payload,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSavingProcedureId("");

    if (!response.ok || !result?.procedure) {
      setPageError(result?.error || (isSpanish ? "No pude guardar el procedimiento." : "I could not save the procedure."));
      return;
    }

    const data = result.procedure as ProcedureRecord;
    setProcedures((previous) => previous.map((procedure) => (procedure.id === procedureId ? (data as ProcedureRecord) : procedure)));
    await logAdminEvent({
      action: "procedure_updated",
      entityType: "procedure",
      entityId: procedureId,
      entityName: draft.procedure_name.trim() || "Procedimiento",
      patientId: patient?.id || null,
      actorId: viewerProfile?.id || null,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: `Se actualizó el procedimiento ${draft.procedure_name.trim() || procedureId}.`,
      metadata: payload,
    });
    updateSuccess(isSpanish ? "Procedimiento guardado." : "Procedure saved.");
  };

  const changeRecordStatus = async (nextStatus: PatientRecordStatus) => {
    if (!patient || patientStatus === nextStatus) return;
    setStatusSaving(nextStatus);

    const payload = {
      record_status: nextStatus,
      record_status_changed_at: new Date().toISOString(),
      record_status_changed_by: viewerProfile?.id || null,
    };

    const { data, error } = await supabase.from("patients").update(payload).eq("id", patient.id).select().single();
    setStatusSaving("");

    if (error) {
      if (isMissingColumnError(error)) {
        setPageError(t.fieldSetupError);
        return;
      }
      setPageError(error.message || (isSpanish ? "No pude cambiar el estado del expediente." : "I could not change the record status."));
      return;
    }

    setPatient(data as PatientRecord);
    await logAdminEvent({
      action: "record_status_changed",
      entityType: "patient",
      entityId: patient.id,
      entityName: patient.full_name || t.unnamedPatient,
      patientId: patient.id,
      actorId: viewerProfile?.id || null,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: `Estado del expediente cambiado de ${patientStatus} a ${nextStatus}.`,
      metadata: {
        previous_status: patientStatus,
        next_status: nextStatus,
      },
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

  const uploadPatientPhoto = async (file: File) => {
    if (!patient) return;
    if (!canEditRecord) {
      setPageError(t.procedureLockedError);
      return;
    }
    setPhotoUploading(true);

    const storagePath = `patients/${patient.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("chat-files").upload(storagePath, file);

    if (uploadError) {
      setPhotoUploading(false);
      setPageError(uploadError.message || t.uploadError);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("patients")
      .update({ profile_picture_url: publicUrl.publicUrl })
      .eq("id", patient.id)
      .select()
      .single();

    setPhotoUploading(false);

    if (error) {
      setPageError(error.message || t.uploadError);
      return;
    }

    setPatient(data as PatientRecord);
    await logAdminEvent({
      action: "patient_photo_updated",
      entityType: "patient",
      entityId: patient.id,
      entityName: patient.full_name || t.unnamedPatient,
      patientId: patient.id,
      actorId: viewerProfile?.id || null,
      actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
      actorEmail: viewerEmail,
      notes: "Se actualizó la foto del paciente.",
      metadata: { profile_picture_url: publicUrl.publicUrl },
    });
    updateSuccess(t.photoSaved);
  };

  const exportRecord = async () => {
    if (!bundle || !patient) return;
    setExporting(true);

    try {
      const html = buildExportHtml({
        title: `${isSpanish ? "Expediente exportado" : "Exported record"} · ${patient.full_name || t.unnamedPatient}`,
        subtitle: isSpanish
          ? "Incluye procedimientos, sedes, historial completo y medios relacionados."
          : "Includes procedures, offices, full history, and related media.",
        bundles: [bundle],
        staffById,
        generatedBy: viewerProfile?.full_name || viewerEmail,
      });
      const opened = openPrintPreview({
        title: patient.full_name || t.unnamedPatient,
        html,
      });
      if (opened) {
        await logAdminEvent({
          action: "record_pdf_export_opened",
          entityType: "patient",
          entityId: patient.id,
          entityName: patient.full_name || t.unnamedPatient,
          patientId: patient.id,
          actorId: viewerProfile?.id || null,
          actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
          actorEmail: viewerEmail,
          notes: "Se abrió el expediente listo para exportar o guardar en PDF.",
        });
        updateSuccess(t.recordDownloaded);
        return;
      }

      const fileName = `expediente-${sanitizeFileName(patient.full_name || "patient")}.html`;
      downloadFile(fileName, html, "text/html;charset=utf-8");
      updateSuccess(isSpanish ? "No pude abrir la vista PDF automática. Descargué el respaldo en HTML." : "I could not open the automatic PDF view. I downloaded an HTML backup.");
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude exportar este expediente." : "I could not export this record."));
    } finally {
      setExporting(false);
    }
  };

  const printRecord = async () => {
    if (!bundle || !patient) return;

    const html = buildExportHtml({
      title: `${isSpanish ? "Expediente PDF" : "PDF record"} · ${patient.full_name || t.unnamedPatient}`,
      subtitle: isSpanish
        ? "Versión preparada para imprimir, guardar como PDF o compartir."
        : "Version prepared for printing, saving as PDF, or sharing.",
      bundles: [bundle],
      staffById,
      generatedBy: viewerProfile?.full_name || viewerEmail,
    });

    const opened = openPrintPreview({
      title: patient.full_name || t.unnamedPatient,
      html,
    });

    if (opened) {
      await logAdminEvent({
        action: "record_pdf_opened",
        entityType: "patient",
        entityId: patient.id,
        entityName: patient.full_name || t.unnamedPatient,
        patientId: patient.id,
        actorId: viewerProfile?.id || null,
        actorName: viewerProfile?.full_name || viewerProfile?.display_name || viewerEmail,
        actorEmail: viewerEmail,
        notes: "Se abrió la versión preparada para PDF / impresión.",
      });
      updateSuccess(t.pdfOpened);
    }
  };

  const clinicalHistoryUrl = selectedClinicalHistoryEntry?.message?.content || "";
  const closeClinicalHistoryViewer = () => setSelectedClinicalHistoryEntry(null);
  const showClinicalHistoryShareBlocked = () => {
    alert(isSpanish
      ? "Por privacidad, no se enviara un enlace del formulario. Usa Compartir desde un dispositivo que permita adjuntar el PDF."
      : "For privacy, a form link will not be sent. Use Share from a device that can attach the PDF file.");
  };
  const shareClinicalHistoryEntry = async () => {
    if (!clinicalHistoryUrl) return;
    try {
      const response = await fetch(clinicalHistoryUrl);
      if (!response.ok) throw new Error("pdf-download-failed");
      const blob = await response.blob();
      const file = new File([blob], "Historia Clinica.pdf", { type: blob.type || "application/pdf" });
      const shareData = { title: "Historia Clinica", text: "Historia Clinica", files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error: any) {
          if (error?.name === "AbortError") return;
        }
      }
    } catch {}
    showClinicalHistoryShareBlocked();
  };

  const renderTimelineBody = (entry: (typeof timeline)[number]) => {
    const { message } = entry;
    const cleanFileName = (message.file_name || "").replace(/^\[(MED|BEFORE|FORM|STAFF_RECORD)\]\s*/i, "");
    const isClinicalHistoryFile = `${message.file_name || ""}`.startsWith("[FORM]");

    if (message.deleted_by_staff || message.deleted_by_patient) {
      return <p className="body-muted">{t.deletedMessage}</p>;
    }

    if (message.is_internal && message.message_type === "text") {
      return <p className="body-copy">{parseInternalNoteText(message.content) || (isSpanish ? "Nota interna sin contenido." : "Internal note has no content.")}</p>;
    }

    if (message.message_type === "image" && message.content) {
      return (
        <div className="preview-wrap">
          <img src={message.content} alt="" className="media-preview image" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir imagen" : "Open image"}</a>
        </div>
      );
    }

    if (message.message_type === "video" && message.content) {
      return (
        <div className="preview-wrap">
          <video src={message.content} controls className="media-preview video" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir video" : "Open video"}</a>
        </div>
      );
    }

    if (message.message_type === "audio" && message.content) {
      return (
        <div className="preview-wrap">
          <audio src={message.content} controls style={{ width: "100%" }} />
          <p className="body-muted">{cleanFileName || (isSpanish ? "Audio del chat" : "Chat audio")}</p>
        </div>
      );
    }

    if (message.message_type === "file" && message.content) {
      return (
        <div className="preview-wrap">
          <p style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>{cleanFileName || (isSpanish ? "Archivo" : "File")}</p>
          {isClinicalHistoryFile ? (
            <button type="button" className="open-link" onClick={() => setSelectedClinicalHistoryEntry(entry)}>{isSpanish ? "Abrir archivo" : "Open file"}</button>
          ) : (
            <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir archivo" : "Open file"}</a>
          )}
        </div>
      );
    }

    return <p className="body-copy">{message.content || (isSpanish ? "Sin contenido" : "No content")}</p>;
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
          <p className="section-sub">{entries.length} {isSpanish ? "elemento(s)" : "item(s)"}</p>
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
            const cleanFileName = (entry.message.file_name || "").replace(/^\[(MED|BEFORE|FORM)\]\s*/i, "");
            const isClinicalHistoryFile = `${entry.message.file_name || ""}`.startsWith("[FORM]");

            return (
              <div key={entry.message.id} className="media-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{cleanFileName || messageTypeText(entry.message)}</p>
                  <p className="body-muted">
                    {entry.message.sender_name || (isSpanish ? "Sin nombre" : "No name")} · {roleText(entry.message.sender_role || entry.message.sender_type || "staff")} · {senderOffice ? officeText(senderOffice) : t.noOffice}
                  </p>
                  <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                </div>
                {entry.message.content && (
                  isClinicalHistoryFile ? (
                    <button type="button" className="open-link" onClick={() => setSelectedClinicalHistoryEntry(entry)}>
                      {t.open}
                    </button>
                  ) : (
                    <a href={entry.message.content} target="_blank" rel="noopener noreferrer" className="open-link">
                      {t.open}
                    </a>
                  )
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
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{t.loadingTitle}</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6 }}>{t.loadingCopy}</p>
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
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.signInTitle}</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>{t.signInCopy}</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/login")}>{t.signInButton}</button>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F5F7FB" }}>
        <div style={{ maxWidth: 460, background: "white", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>⛔</div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.noAccessTitle}</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>{t.noAccessCopy}</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/inbox")}>{t.backToPortal}</button>
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
        .record-topbar { position: sticky; top: 0; z-index: 50; min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); }
        .record-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { height: 42px; padding: 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 152px; height: 42px; padding: 0 36px 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px); background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #111827, #1D4ED8); color: white; border-radius: 28px; padding: 24px; box-shadow: 0 18px 45px rgba(29,78,216,0.16); margin-bottom: 18px; }
        .hero-grid, .grid-2, .grid-4 { display: grid; gap: 16px; }
        .hero-grid { grid-template-columns: 1.1fr 0.9fr; align-items: center; }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; }
        .card, .stat-card, .timeline-card, .media-card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .hero-copy { color: rgba(255,255,255,0.94); font-size: 16px; line-height: 1.7; }
        .section-kicker { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; }
        .section-sub { font-size: 14px; color: #64748B; margin: 0; line-height: 1.6; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #4B5563; font-size: 15px; line-height: 1.7; }
        .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .procedure-list { display: grid; gap: 12px; }
        .procedure-item { border: 1px solid #E5EDF6; border-radius: 16px; padding: 14px 16px; background: #FCFDFF; }
        .media-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #EEF2F7; }
        .media-item:last-child { border-bottom: none; padding-bottom: 0; }
        .empty-mini { border: 1px dashed #D6E0EB; border-radius: 16px; padding: 16px; text-align: center; color: #6B7280; background: #FAFCFF; }
        .open-link { display: inline-flex; align-items: center; justify-content: center; padding: 10px 12px; border: none; border-radius: 12px; background: #EFF6FF; color: #1D4ED8; font-weight: 800; font-family: inherit; text-decoration: none; white-space: nowrap; cursor: pointer; }
        .timeline-list { display: grid; gap: 14px; }
        .timeline-item { border: 1px solid #E5EDF6; border-radius: 18px; padding: 16px; background: #FCFDFF; }
        .timeline-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .timeline-filters { display: grid; gap: 10px; margin-bottom: 14px; }
        .timeline-filters input { width: 100%; border: 1px solid #D7E2F0; border-radius: 12px; padding: 10px 12px; font-size: 14px; font-family: inherit; background: #FFFFFF; color: #111827; }
        .timeline-filters input:focus { outline: 2px solid rgba(37,99,235,0.2); border-color: #93C5FD; }
        .timeline-date-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .timeline-date-grid label { display: grid; gap: 6px; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .timeline-filter-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: space-between; }
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
        .line-input { width: 100%; padding: 13px 14px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 16px; color: #111827; font-family: inherit; outline: none; }
        .line-input:focus { background: white; border-color: rgba(0,122,255,0.4); }
        .field-label { font-size: 13px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .photo-card { display: grid; gap: 14px; align-content: start; }
        .patient-photo { width: 124px; height: 124px; border-radius: 22px; object-fit: cover; background: #E5E7EB; box-shadow: 0 10px 24px rgba(15,23,42,0.12); }
        .photo-fallback { width: 124px; height: 124px; border-radius: 22px; background: linear-gradient(135deg,#111827,#1D4ED8); display: flex; align-items: center; justify-content: center; color: white; font-size: 34px; font-weight: 900; }
        .photo-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .record-nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 0 0 16px; }
        .record-nav-btn { min-height: 82px; border-radius: 16px; border: 1px solid #D7E7FA; background: #FFFFFF; color: #0E2D4A; font-family: inherit; cursor: pointer; box-shadow: 0 8px 22px rgba(28,66,104,0.05); text-align: left; padding: 14px; }
        .record-nav-btn strong { display: block; font-size: 16px; font-weight: 950; line-height: 1.25; }
        .record-nav-btn span { display: block; color: #64748B; font-size: 13px; font-weight: 800; line-height: 1.35; margin-top: 5px; }
        .record-nav-btn:hover, .record-nav-btn:focus-visible, .record-nav-btn.active { border-color: #93C5FD; background: #F8FBFF; outline: none; }
        .record-section-shell { margin-top: 16px; }
        .locked-note { border: 1px solid #DBEAFE; background: #F8FBFF; color: #1D4ED8; border-radius: 16px; padding: 12px 14px; font-size: 14px; font-weight: 850; line-height: 1.5; margin: 0 0 14px; }
        .readonly-field { min-height: 52px; display: flex; align-items: center; padding: 13px 14px; background: #F8FAFC; border: 1px solid #E5EDF6; border-radius: 14px; color: #111827; font-size: 16px; font-weight: 850; line-height: 1.45; overflow-wrap: anywhere; }
        @media (max-width: 980px) {
          .hero-grid, .grid-2, .grid-4 { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .record-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; }
          .topbar-right { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-select,
          .menu-panel .topbar-btn { width: 100%; }
          .topbar-btn { text-align: center; padding: 12px 12px; font-size: 13px; }
          .toast-stack { right: 12px; left: 12px; width: auto; }
          .record-nav { grid-template-columns: 1fr 1fr; }
          .timeline-top, .section-head, .media-item { flex-direction: column; }
          .timeline-date-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientPhoto(file);
          event.target.value = "";
        }}
      />

      <div className="record-shell">
        <div className="record-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{t.recordTitle}</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", margin: 0 }}>{t.recordSubtitle}</p>
          </div>
          <div className="topbar-right">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <div className="topbar-actions">
              <button className="topbar-btn" onClick={() => goTo("/admin")}>{t.backToCenter}</button>
              <button className="topbar-btn" onClick={printRecord} disabled={!bundle || exporting}>{t.printRecord}</button>
              <button className="topbar-btn" onClick={() => goTo("/inbox")}>{t.goToPortal}</button>
              <button className="topbar-btn" style={{ background: "#007AFF", color: "white" }} onClick={exportRecord} disabled={!bundle || exporting}>
                {exporting ? t.exporting : t.exportRecord}
              </button>
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
            <button className="topbar-btn" onClick={() => goTo("/admin")}>{t.backToCenter}</button>
            <button className="topbar-btn" onClick={printRecord} disabled={!bundle || exporting}>{t.printRecord}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{t.goToPortal}</button>
            <button className="topbar-btn" style={{ background: "#007AFF", color: "white" }} onClick={exportRecord} disabled={!bundle || exporting}>
              {exporting ? t.exporting : t.exportRecord}
            </button>
          </div>
        )}

        <div className="record-body">
          {!patient ? (
            <div className="card">
              <p className="section-kicker">{t.unavailableTitle}</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.unavailableTitle}</p>
              <p className="muted">{t.unavailableCopy}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button className="main-btn" onClick={() => (window.location.href = "/admin")}>{t.backToCenter}</button>
                <button className="ghost-btn" onClick={fetchRecord}>{t.reload}</button>
              </div>
            </div>
          ) : (
            <>
              <section className="hero">
                <div className="hero-grid">
                  <div>
                    <h1 className="big-title">{patient.full_name || t.unnamedPatient}</h1>
                    <p className="hero-copy">{t.heroCopy}</p>
                    <div className="pill-row">
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ☎️ {patient.phone || t.noPhone}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ✉️ {patient.email || t.noEmail}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        🎂 {formatDateLocal(patient.birthdate)}
                      </span>
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(255,255,255,0.12)", color: "white", boxShadow: "none" }}>
                    <p className="section-kicker" style={{ color: "rgba(255,255,255,0.86)" }}>{t.relatedOffices}</p>
                    <div className="pill-row">
                      {offices.length > 0 ? (
                        offices.map((office) => (
                          <span key={office} className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>
                            {officeText(office)}
                          </span>
                        ))
                      ) : (
                        <span className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>{t.noOffice}</span>
                      )}
                    </div>
                    <p className="hero-copy" style={{ marginTop: 12 }}>{t.heroHelper}</p>
                  </div>
                </div>
              </section>

              <section className="record-nav" aria-label={isSpanish ? "Navegación del expediente" : "Record navigation"}>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "documentos" ? "active" : ""}`} onClick={() => openRecordSection("documentos")}>
                  <strong>{isSpanish ? "Documento" : "Documents"}</strong>
                  <span>{clinicalHistoryEntries.length} {isSpanish ? "Historia Clinica" : "clinical form"}</span>
                </button>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "procedimientos" ? "active" : ""}`} onClick={() => openRecordSection("procedimientos")}>
                  <strong>{isSpanish ? "Procedimiento y sede" : "Procedure and office"}</strong>
                  <span>{procedures.length} {isSpanish ? "procedimiento(s)" : "procedure(s)"}</span>
                </button>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "datos-paciente" ? "active" : ""}`} onClick={() => openRecordSection("datos-paciente")}>
                  <strong>{isSpanish ? "Datos" : "Details"}</strong>
                  <span>{isSpanish ? "Información del paciente" : "Patient information"}</span>
                </button>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "archivo-interno" ? "active" : ""}`} onClick={() => openRecordSection("archivo-interno")}>
                  <strong>{isSpanish ? "Archivo interno" : "Internal record"}</strong>
                  <span>{internalNoteEntries.length + internalPhotoEntries.length} {isSpanish ? "elemento(s)" : "item(s)"}</span>
                </button>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "media" ? "active" : ""}`} onClick={() => openRecordSection("media")}>
                  <strong>Media</strong>
                  <span>{publicImageEntries.length + media.videos.length + media.audios.length + regularFileEntries.length} {isSpanish ? "archivo(s)" : "file(s)"}</span>
                </button>
                <button type="button" className={`record-nav-btn ${activeRecordSection === "historial" ? "active" : ""}`} onClick={() => openRecordSection("historial")}>
                  <strong>{isSpanish ? "Historial" : "History"}</strong>
                  <span>{timeline.length} {isSpanish ? "evento(s)" : "event(s)"}</span>
                </button>
              </section>

              {!canEditRecord && <p className="locked-note">{t.recordEditLocked}</p>}

              <div
                className="grid-2 record-section-shell"
                style={{
                  alignItems: "start",
                  marginBottom: 16,
                  display: activeRecordSection === "documentos" || activeRecordSection === "procedimientos" ? "grid" : "none",
                  gridTemplateColumns: "minmax(0, 1fr)",
                }}
              >
                <section className="card" id="documentos" style={{ display: activeRecordSection === "documentos" ? "block" : "none" }}>
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.documentsTitle}</p>
                      <p className="section-sub">{t.documentsCopy}</p>
                    </div>
                  </div>
                  {clinicalHistoryEntries.length === 0 ? (
                    <div className="empty-mini">{t.noDocuments}</div>
                  ) : (
                    <div className="procedure-list">
                      {clinicalHistoryEntries.map((entry) => {
                        const senderProfile = entry.message.sender_id ? staffById.get(entry.message.sender_id) : null;
                        const senderOffice =
                          normalizeOffice(entry.message.sender_office) ||
                          normalizeOffice(senderProfile?.office_location) ||
                          normalizeOffice(entry.procedure.office_location) ||
                          "";

                        return (
                          <div key={entry.message.id} className="procedure-item">
                            <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Historia Clinica.pdf</p>
                            <p className="body-muted">
                              {entry.message.sender_name || patient.full_name || t.unnamedPatient} · {roleText(entry.message.sender_role || entry.message.sender_type || "patient")} · {senderOffice ? officeText(senderOffice) : t.noOffice}
                            </p>
                            <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                            <div className="pill-row">
                              <button type="button" className="open-link" onClick={() => setSelectedClinicalHistoryEntry(entry)}>{t.open}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="card" id="procedimientos" style={{ display: activeRecordSection === "procedimientos" ? "block" : "none" }}>
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.proceduresTitle}</p>
                      <p className="section-sub">{t.proceduresCopy}</p>
                    </div>
                  </div>
                  <div className="procedure-list">
                    {procedures.length === 0 ? (
                      <div className="empty-mini">{t.noProcedures}</div>
                    ) : (
                      procedures.map((procedure) => {
                        const relatedRooms = rooms.filter((room) => room.procedure_id === procedure.id);
                        const draft = procedureDrafts[procedure.id] || {
                          procedure_name: procedure.procedure_name || "",
                          office_location: normalizeOffice(procedure.office_location),
                          status: procedure.status || "",
                          surgery_date: procedure.surgery_date || "",
                        };

                        return (
                          <div key={procedure.id} className="procedure-item">
                            <div className="form-grid">
                              <div>
                                <label className="field-label">{isSpanish ? "Procedimiento" : "Procedure"}</label>
                                {canEditRecord ? (
                                  <input
                                    className="line-input"
                                    value={draft.procedure_name}
                                    onChange={(event) =>
                                      setProcedureDrafts((prev) => ({
                                        ...prev,
                                        [procedure.id]: { ...draft, procedure_name: event.target.value },
                                      }))
                                    }
                                  />
                                ) : (
                                  <div className="readonly-field">{procedure.procedure_name || (isSpanish ? "Sin procedimiento" : "No procedure")}</div>
                                )}
                              </div>
                              <div>
                                <label className="field-label">{isSpanish ? "Fecha de cirugía" : "Surgery date"}</label>
                                {canEditRecord ? (
                                  <input
                                    className="line-input"
                                    inputMode="numeric"
                                    placeholder={t.dateHint}
                                    value={draft.surgery_date}
                                    onChange={(event) =>
                                      setProcedureDrafts((prev) => ({
                                        ...prev,
                                        [procedure.id]: { ...draft, surgery_date: formatDateTyping(event.target.value) },
                                      }))
                                    }
                                  />
                                ) : (
                                  <div className="readonly-field">{isoToDisplayDate(procedure.surgery_date) || t.noBirthdate}</div>
                                )}
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label className="field-label">{isSpanish ? "Sede" : "Office"}</label>
                                {canEditRecord ? (
                                  <div className="pill-row" style={{ marginTop: 0 }}>
                                    {(["Guadalajara", "Tijuana"] as Office[]).map((office) => (
                                      <button
                                        key={`${procedure.id}-${office}`}
                                        className="ghost-btn"
                                        style={{
                                          background: draft.office_location === office ? "#DBEAFE" : "#EFF3F8",
                                          color: draft.office_location === office ? "#1D4ED8" : "#111827",
                                        }}
                                        onClick={() =>
                                          setProcedureDrafts((prev) => ({
                                            ...prev,
                                            [procedure.id]: { ...draft, office_location: office },
                                          }))
                                        }
                                      >
                                        {office === "Guadalajara" ? "🏙️ Guadalajara" : "🌊 Tijuana"}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="readonly-field">{officeText(normalizeOffice(procedure.office_location))}</div>
                                )}
                              </div>
                            </div>

                            <div className="pill-row">
                              <span className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                                {t.roomsRelated}: {relatedRooms.length}
                              </span>
                              <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                {officeText(normalizeOffice(procedure.office_location))}
                              </span>
                            </div>

                            {canEditRecord && (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                                <button className="main-btn" onClick={() => saveProcedure(procedure.id)} disabled={savingProcedureId === procedure.id}>
                                  {savingProcedureId === procedure.id ? t.savingProcedure : t.saveProcedure}
                                </button>
                                <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                  {t.doctorEditNote}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <div className="grid-2 record-section-shell" style={{ display: activeRecordSection === "datos-paciente" ? "grid" : "none" }}>
                <section className="card" id="datos-paciente">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.basicInfo}</p>
                      <p className="section-sub">{t.basicInfoCopy}</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="field-label">{isSpanish ? "Nombre completo" : "Full name"}</label>
                      <input className="line-input" disabled={!canEditRecord} value={patientDraft.full_name} onChange={(event) => setPatientDraft((prev) => ({ ...prev, full_name: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Teléfono" : "Phone"}</label>
                      <input className="line-input" disabled={!canEditRecord} value={patientDraft.phone} onChange={(event) => setPatientDraft((prev) => ({ ...prev, phone: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Correo" : "Email"}</label>
                      <input className="line-input" disabled={!canEditRecord} type="email" value={patientDraft.email} onChange={(event) => setPatientDraft((prev) => ({ ...prev, email: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Fecha de nacimiento" : "Birth date"}</label>
                      <input className="line-input" disabled={!canEditRecord} inputMode="numeric" placeholder={t.dateHint} value={patientDraft.birthdate} onChange={(event) => setPatientDraft((prev) => ({ ...prev, birthdate: formatDateTyping(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="field-label">{t.patientLanguage}</label>
                      <select className="line-input" disabled={!canEditRecord} value={patientDraft.preferred_language} onChange={(event) => setPatientDraft((prev) => ({ ...prev, preferred_language: event.target.value }))}>
                        {PATIENT_LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{isSpanish ? option.labelEs : option.labelEn}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">{t.patientTimezone}</label>
                      <select className="line-input" disabled={!canEditRecord} value={patientDraft.timezone} onChange={(event) => setPatientDraft((prev) => ({ ...prev, timezone: event.target.value }))}>
                        {PATIENT_TIMEZONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="field-label">{t.patientAllergies}</label>
                      <textarea className="line-input" disabled={!canEditRecord} rows={3} value={patientDraft.allergies} onChange={(event) => setPatientDraft((prev) => ({ ...prev, allergies: event.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="field-label">{t.patientMedications}</label>
                      <textarea className="line-input" disabled={!canEditRecord} rows={3} value={patientDraft.current_medications} onChange={(event) => setPatientDraft((prev) => ({ ...prev, current_medications: event.target.value }))} />
                    </div>
                  </div>

                  {canEditRecord && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <button className="main-btn" onClick={savePatientInfo} disabled={savingPatient}>
                        {savingPatient ? t.savingPatient : t.savePatient}
                      </button>
                    </div>
                  )}

                  <div className="procedure-list" style={{ marginTop: 16 }}>
                    <div className="procedure-item">
                      <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>{t.quickSummary}</p>
                      <p className="muted">{t.lastEvent}: {timeline.length ? formatDateTimeLocal(timeline[timeline.length - 1]?.message.created_at) : t.noActivity}</p>
                      <p className="muted">{t.firstRoom}: {rooms.length ? formatDateTimeLocal(rooms[0]?.created_at) : t.noRooms}</p>
                      <p className="muted">{t.patientLanguage}: {labelPatientLanguage(patient.preferred_language, lang)}</p>
                      <p className="muted">{t.patientTimezone}: {labelTimeZone(patient.timezone)}</p>
                      {patientLocalTime && <p className="muted">{t.patientLocalTime}: {patientLocalTime}</p>}
                    </div>
                  </div>
                </section>

                <section className="card photo-card">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.patientPhoto}</p>
                      <p className="section-sub">{t.uploadPhotoHelp}</p>
                    </div>
                  </div>

                  {patient.profile_picture_url ? (
                    <img src={patient.profile_picture_url} alt="" className="patient-photo" />
                  ) : (
                    <div className="photo-fallback">{initials(patient.full_name)}</div>
                  )}

                  {canEditRecord && (
                    <div className="photo-actions">
                      <button className="main-btn" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                        {photoUploading ? (isSpanish ? "Subiendo..." : "Uploading...") : patient.profile_picture_url ? t.changePhoto : t.addPhoto}
                      </button>
                    </div>
                  )}
                </section>
              </div>

              <section className="card record-section-shell" id="archivo-interno" style={{ display: activeRecordSection === "archivo-interno" ? "block" : "none" }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.staffRecordTitle}</p>
                    <p className="section-sub">{t.staffRecordCopy}</p>
                  </div>
                </div>
                <div className="grid-2">
                  <section className="media-card">
                    <div className="section-head">
                      <div>
                        <p className="section-kicker">{t.internalNotes}</p>
                        <p className="section-sub">{internalNoteEntries.length} {isSpanish ? "nota(s)" : "note(s)"}</p>
                      </div>
                    </div>
                    {internalNoteEntries.length === 0 ? (
                      <div className="empty-mini">{t.noInternalNotes}</div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {internalNoteEntries.map((entry) => (
                          <div key={entry.message.id} className="procedure-item">
                            <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>
                              {entry.message.sender_name || (isSpanish ? "Staff" : "Staff")}
                            </p>
                            <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                            <p className="body-copy">{parseInternalNoteText(entry.message.content) || (isSpanish ? "Nota interna sin contenido." : "Internal note has no content.")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  {renderMediaGroup(t.internalPhotos, internalPhotoEntries, t.noInternalPhotos)}
                </div>
              </section>

              <section className="card record-section-shell" id="media" style={{ display: activeRecordSection === "media" ? "block" : "none" }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.mediaTitle}</p>
                    <p className="section-sub">{t.mediaCopy}</p>
                  </div>
                </div>
                <div className="grid-2">
                  {renderMediaGroup(t.images, publicImageEntries, t.noImages)}
                  {renderMediaGroup(t.videos, media.videos, t.noVideos)}
                  {renderMediaGroup(t.audios, media.audios, t.noAudios)}
                  {renderMediaGroup(t.files, regularFileEntries, t.noFiles)}
                </div>
              </section>

              <section className="card record-section-shell" id="historial" style={{ display: activeRecordSection === "historial" ? "block" : "none" }} ref={timelineSectionRef}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.timelineTitle}</p>
                    <p className="section-sub">{t.timelineCopy}</p>
                  </div>
                </div>
                <div className="timeline-filters">
                  <input
                    value={timelineQuery}
                    onChange={(event) => setTimelineQuery(event.target.value)}
                    placeholder={t.timelineSearchPH}
                    aria-label={t.timelineSearch}
                  />
                  <div className="timeline-date-grid">
                    <label>
                      {t.fromDate}
                      <input type="date" value={timelineFrom} onChange={(event) => setTimelineFrom(event.target.value)} />
                    </label>
                    <label>
                      {t.toDate}
                      <input type="date" value={timelineTo} onChange={(event) => setTimelineTo(event.target.value)} />
                    </label>
                  </div>
                  <div className="timeline-filter-row">
                    <span className="body-muted">{t.showingEntries}: {filteredTimeline.length} / {timeline.length}</span>
                    <button className="ghost-btn" onClick={() => { setTimelineQuery(""); setTimelineFrom(""); setTimelineTo(""); }}>{t.clearFilters}</button>
                    <button className="ghost-btn" onClick={scrollTimelineTop}>{t.jumpTop}</button>
                  </div>
                </div>

                {filteredTimeline.length === 0 ? (
                  <div className="empty-mini">{t.noTimeline}</div>
                ) : (
                  <div className="timeline-list">
                    {filteredTimeline.map((entry) => {
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
                                {entry.message.sender_name || (entry.message.sender_type === "patient" ? patient.full_name || t.unnamedPatient : isSpanish ? "Staff" : "Staff")}
                              </p>
                              <div className="pill-row">
                                <span className="meta-badge" style={{ color: roleColor(entry.message.sender_role || entry.message.sender_type), background: `${roleColor(entry.message.sender_role || entry.message.sender_type)}18` }}>
                                  {roleText(entry.message.sender_role || entry.message.sender_type || "staff")}
                                </span>
                                <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                  {officeText(senderOffice)}
                                </span>
                                <span className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                                  {messageTypeText(entry.message)}
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                              <p className="body-muted">{t.roomLabel}: {entry.room.id.slice(0, 8)}</p>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 10 }}>
                            {renderTimelineBody(entry)}
                            <div style={{ borderTop: "1px solid #EEF2F7", paddingTop: 10 }}>
                              <p className="body-muted">{t.procedureLabel}: {entry.procedure.procedure_name || (isSpanish ? "Sin procedimiento" : "No procedure")}</p>
                              <p className="body-muted">{t.reasonLabel}: {messageReasonText(entry.message, entry.procedure)}</p>
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

        {selectedClinicalHistoryEntry && clinicalHistoryUrl && (
          <div style={{ position: "fixed", inset: 0, background: "#F8FAFC", color: "#111827", zIndex: 300, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flexShrink: 0, padding: "calc(14px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 12px max(14px, env(safe-area-inset-left))", background: "#FFFFFF", borderBottom: "1px solid #D9E4F2", boxShadow: "0 6px 18px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <div style={{ minWidth: 0, fontSize: 17, fontWeight: 900, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Historia Clinica</div>
                <button type="button" onClick={closeClinicalHistoryViewer} style={{ border: "none", borderRadius: 999, background: "#EFF3F8", color: "#111827", minWidth: 86, height: 44, padding: "0 14px", fontSize: 15, fontWeight: 850, fontFamily: "inherit", cursor: "pointer" }}>
                  {isSpanish ? "Cerrar" : "Close"}
                </button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <button type="button" onClick={() => void shareClinicalHistoryEntry()} style={{ border: "none", borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", minHeight: 46, fontSize: 16, fontWeight: 850, fontFamily: "inherit", cursor: "pointer" }}>{isSpanish ? "Compartir" : "Share"}</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
              <iframe src={clinicalHistoryUrl} title="Historia Clinica" style={{ width: "100%", height: "100%", minHeight: "70dvh", border: "none", borderRadius: 14, background: "#fff", boxShadow: "0 8px 28px rgba(15,23,42,0.14)" }} />
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
