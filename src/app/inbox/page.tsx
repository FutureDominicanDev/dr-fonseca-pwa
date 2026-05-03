"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { displayToIsoDate, formatDateTyping, isoToDisplayDate } from "@/lib/dateInput";
import { PATIENT_LANGUAGE_OPTIONS, PATIENT_TIMEZONE_OPTIONS, currentTimeInZone, labelPatientLanguage, labelTimeZone, onboardingMessageForPatient } from "@/lib/patientMeta";
import { syncPushSubscription } from "@/lib/pushSubscriptions";
import { isOwnerEmail } from "@/lib/securityConfig";
import { FormMessage, parseFormMessage } from "@/components/FormMessage";

type Lang = "es" | "en";
type FileCategory = "general" | "medication" | "before_photo";
type PhoneCountryOption = { code: string; label: string };
type MediaTab = "media" | "audio" | "prescriptions" | "forms" | "docs";
type CareTeamFilter = "all" | "guadalajara" | "tijuana" | "selected";
type InternalNoteVisibility = "team" | "private";

const QUICK_EMOJIS = ["😀", "😂", "😍", "🙏", "👍", "👏", "❤️", "✅", "⚠️", "📎", "📸", "🎥"];

const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: "+52", label: "🇲🇽 +52 México" },
  { code: "+1", label: "🇺🇸🇨🇦 +1 USA / Canadá" },
  { code: "+34", label: "🇪🇸 +34 España" },
  { code: "+502", label: "🇬🇹 +502 Guatemala" },
  { code: "+503", label: "🇸🇻 +503 El Salvador" },
  { code: "+504", label: "🇭🇳 +504 Honduras" },
  { code: "+506", label: "🇨🇷 +506 Costa Rica" },
  { code: "+507", label: "🇵🇦 +507 Panamá" },
  { code: "+51", label: "🇵🇪 +51 Perú" },
  { code: "+54", label: "🇦🇷 +54 Argentina" },
  { code: "+55", label: "🇧🇷 +55 Brasil" },
  { code: "+56", label: "🇨🇱 +56 Chile" },
  { code: "+57", label: "🇨🇴 +57 Colombia" },
  { code: "+44", label: "🇬🇧 +44 UK" },
];

const formatPhoneLocal = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
};

const splitPhoneNumber = (value?: string | null) => {
  const raw = `${value || ""}`.trim();
  const option = PHONE_COUNTRY_OPTIONS.find((entry) => raw.replace(/\s/g, "").startsWith(entry.code));
  const code = option?.code || "+52";
  const local = raw
    .replace(/\s/g, "")
    .replace(new RegExp(`^\\${code}`), "")
    .replace(/^\+/, "");
  return { code, local: formatPhoneLocal(local) };
};

const joinPhoneNumber = (code: string, local: string) => {
  const digits = local.replace(/\D/g, "");
  return digits ? `${code}${digits}` : "";
};

const createPatientAccessToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const T = {
  es: {
    patients: "Pacientes", search: "Buscar paciente...", noPatients: "Sin pacientes aún",
    noPatientsHint: "Toca + para crear el primero", online: "En línea",
    patientLabel: "Paciente",
    typingSuffix: "está escribiendo...",
    typeMessage: "Escribe un mensaje o usa / para respuestas rápidas...",
    send: "Enviar", recording: "Grabando...", recordAudio: "Grabar audio",
    deleteMsg: "¿Eliminar este mensaje?", msgDeleted: "Mensaje eliminado",
    attachmentOptions: "Adjuntar",
    capture: "Capturar",
    photoMode: "Foto",
    videoMode: "Video",
    takePhoto: "Tomar foto",
    recordVideoOption: "Grabar video",
    chooseFile: "Elegir archivo",
    stopAndSendVideo: "Detener y revisar video",
    takePhotoNow: "Tomar foto ahora",
    reviewCapture: "Revisar antes de enviar",
    reviewAudio: "Revisar audio",
    reviewPhoto: "Revisar foto",
    reviewVideo: "Revisar video",
    sendRecording: "Enviar grabación",
    retake: "Volver a tomar",
    stopAndReview: "Detener y revisar",
    cancelCapture: "Cancelar",
    preparingCamera: "Abriendo cámara...",
    noMessages: "Sin mensajes aún", noMessagesHint: "Envía el primero para comenzar",
    selectPatient: "Selecciona un paciente", selectPatientHint: "para abrir su chat",
    newRoom: "Crear chat de paciente", patientFirstName: "Paciente *", patientLastName: "Apellido",
    patientFirstNamePH: "Ej: María González", patientLastNamePH: "Ej: González", phone: "Teléfono (WhatsApp)",
    phoneCode: "Clave internacional", phonePH: "123-456-7890", birthdate: "Fecha de Nacimiento",
    birthdatePH: "dd/mm/aaaa",
    email: "Correo Electrónico",
    emailPH: "paciente@correo.com",
    procedure: "Procedimiento *", procedurePH: "Ej: Rinoplastia, Lipo 360...",
    surgeryDate: "Fecha de Cirugía", location: "Consultorio *",
    surgeryDatePH: "dd/mm/aaaa",
    preferredLanguage: "Idioma Preferido",
    timezone: "Zona horaria del paciente",
    allergies: "Alergias",
    allergiesPH: "Ej: Penicilina, látex, anestesia...",
    medications: "Medicamentos Actuales",
    medicationsPH: "Ej: Ibuprofeno, metformina, vitaminas...",
    careTeam: "Equipo Asignado",
    careTeamHint: "Elige qué personas verán este chat. No se manda enlace al equipo; solo aparecerá en su portal.",
    careTeamFocused: "Consultorio elegido",
    careTeamShowAll: "Todos",
    careTeamShowOffice: "Consultorio",
    careTeamSelectAll: "Todos",
    careTeamClear: "Solo yo",
    careTeamSelected: "Seleccionados",
    careTeamFilterGdl: "Guadalajara",
    careTeamFilterTjn: "Tijuana",
    careTeamFilterSelected: "Elegidos",
    careTeamDoctorsGdl: "Doctores GDL",
    careTeamDoctorsTjn: "Doctores TJN",
    careTeamRoleDoctor: "Doctores",
    careTeamRoleEnfermeria: "Enfermería",
    careTeamRoleCoordinacion: "Coordinación",
    careTeamRolePost: "Post-operatorio",
    careTeamRoleStaff: "Personal",
    manageTeam: "Administrar equipo",
    saveTeam: "Guardar equipo",
    teamSaved: "Equipo actualizado.",
    patientInfo: "Ficha del Paciente",
    patientInfoHint: "Datos clínicos y operativos del caso",
    patientAccessLink: "Enlace del paciente",
    patientAccessLinkHint: "Este es el enlace seguro para reenviar el acceso del paciente a su chat.",
    patientCopyLink: "Copiar enlace",
    patientShareLink: "Compartir enlace",
    patientMessageLink: "Enviar por mensaje",
    patientLinkCopied: "Enlace copiado.",
    addCareStaff: "Agregar personal al cuidado",
    addCareStaffHint: "Selecciona personal de cualquier sede para agregarlo a este paciente.",
    inviteStaff: "Solicitar acceso",
    staffAdded: "Solicitud enviada para aprobación.",
    staffSearch: "Buscar personal...",
    noStaffFound: "No encontré personal con esa búsqueda.",
    callPatient: "Llamar paciente",
    videoCall: "Videollamada",
    mediaLibrary: "Archivos",
    prescriptions: "Recetas",
    forms: "Formularios",
    formFolderTitle: "Formularios del paciente",
    noForms: "Todavía no hay formularios enviados.",
    exportForm: "Exportar",
    shareForm: "Compartir",
    emailForm: "Correo",
    messageForm: "Mensaje",
    printForm: "PDF / Imprimir",
    noPrescriptions: "Sin recetas todavía.",
    prescriptionLabel: "Nombre de la receta",
    prescriptionLabelPH: "Ej: Ibuprofeno 800 mg",
    prescriptionInstructions: "Indicaciones de uso",
    prescriptionInstructionsPH: "Ej: Tomar una tableta cada 8 horas por 5 días.",
    prescriptionFile: "Archivo seleccionado",
    savePrescription: "Guardar en recetas",
    startVideoCall: "Iniciar videollamada",
    joinVideoCall: "Unirse a videollamada",
    videoCallInvite: "Invitación de videollamada",
    videoCallInviteBody: "Toca para entrar a la videollamada segura.",
    videoCallOpenError: "No pude abrir la videollamada. Revisa si tu navegador bloqueó la ventana.",
    requestVideoCall: "Solicitar videollamada",
    incomingCallRequest: "Solicitud de videollamada",
    callRequestBody: "El paciente está pidiendo iniciar una videollamada.",
    callRequestSent: "Solicitud enviada. Esperando al equipo clínico…",
    acceptCall: "Aceptar llamada",
    shareInvite: "Invitar",
    inviteCopied: "Enlace copiado",
    openInChat: "Abrir en chat",
    endAndReturn: "Terminar y volver al chat",
    callEndedNote: "Videollamada finalizada",
    patientLocalTime: "Hora Local del Paciente",
    internalNotes: "Notas internas del equipo",
    internalNotesHint: "Puedes guardar notas para todo el equipo asignado o privadas solo para ti.",
    addInternalNote: "Agregar nota interna",
    internalNotePH: "Escribe una nota clínica o administrativa para el equipo...",
    noInternalNotes: "Todavía no hay notas internas para este caso.",
    noteSaved: "Nota interna guardada.",
    noteVisibleTeam: "Visible para equipo",
    notePrivate: "Solo para mí",
    privateNoteBadge: "Privada",
    teamNoteBadge: "Equipo",
    uploadedBy: "Subido por",
    noTeamSelected: "Si no seleccionas a nadie, se asignará solo la persona que crea el chat.",
    noPatientInfo: "Todavía no hay datos extendidos para este paciente.",
    openFullRecord: "Abrir expediente",
    teamEmpty: "No hay personal asignado todavía.",
    beforeMaterials: "Material Pre-Op",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Foto de Perfil", beforePhotos: "Fotos Pre-Op",
    tapProfilePic: "Toca para subir foto de perfil",
    tapBeforePhotos: "Toca para subir fotos pre-op",
    createRoom: "Crear chat del paciente", creating: "Creando chat...",
    cancel: "Cancelar", roomCreated: "¡Sala Creada!", shareLink: "Comparte este enlace con el paciente:",
    copyLink: "📋 Copiar Enlace", copied: "✅ ¡Copiado!", whatsapp: "💬 Enviar por WhatsApp",
    done: "Listo", required: "Nombre del paciente y procedimiento son obligatorios.",
    fixErrors: "Corrige los errores antes de continuar.",
    invalidEmail: "El correo debe incluir un formato válido, por ejemplo nombre@correo.com.",
    invalidPhone: "El teléfono debe tener al menos 7 dígitos.",
    settings: "Ajustes", myProfile: "Mi Perfil",
    displayName: "Nombre a Mostrar",
    darkMode: "Modo Oscuro", fontSize: "Tamaño de Texto",
    role: "Rol", fileCategory: "¿Cómo clasificar este archivo?",
    general: "💬 General", medication: "💊 Medicamento", beforePhoto: "📸 Foto Pre-Op",
    generalSub: "Solo aparece en el chat", medicationSub: "Carpeta de medicamentos",
    beforeSub: "Carpeta Pre-Op", back: "← Atrás",
    quickReplies: "Respuestas Rápidas", edit: "Editar",
    shortcut: "Atajo (ej: hola)", message: "Mensaje completo",
    addReply: "Agregar Respuesta", save: "Guardar",
    noReplies: "Sin respuestas rápidas aún. Toca + para agregar.",
    typeSlash: "Escribe / para ver tus respuestas rápidas",
    saving: "Guardando...", saved: "✅ Guardado",
    changePhoto: "Cambiar Foto",
    small: "Pequeño", medium: "Normal", large: "Grande",
    editReply: "Editar Respuesta", deleteConfirm: "¿Eliminar esta respuesta?",
    privacySupport: "Privacidad y soporte",
    privacyPolicy: "Politica de privacidad",
    support: "Soporte",
    accountDeletion: "Eliminar cuenta",
  },
  en: {
    patients: "Patients", search: "Search patient...", noPatients: "No patients yet",
    noPatientsHint: "Tap + to create the first one", online: "Online",
    patientLabel: "Patient",
    typingSuffix: "is typing...",
    typeMessage: "Type a message or use / for quick replies...",
    send: "Send", recording: "Recording...", recordAudio: "Record audio",
    deleteMsg: "Delete this message?", msgDeleted: "Message deleted",
    attachmentOptions: "Attach",
    capture: "Capture",
    photoMode: "Photo",
    videoMode: "Video",
    takePhoto: "Take photo",
    recordVideoOption: "Record video",
    chooseFile: "Choose file",
    stopAndSendVideo: "Stop and review video",
    takePhotoNow: "Take photo now",
    reviewCapture: "Review before sending",
    reviewAudio: "Review audio",
    reviewPhoto: "Review photo",
    reviewVideo: "Review video",
    sendRecording: "Send recording",
    retake: "Retake",
    stopAndReview: "Stop and review",
    cancelCapture: "Cancel",
    preparingCamera: "Opening camera...",
    noMessages: "No messages yet", noMessagesHint: "Send the first one to get started",
    selectPatient: "Select a patient", selectPatientHint: "to open their chat",
    newRoom: "Create patient room", patientFirstName: "Patient *", patientLastName: "Last name",
    patientFirstNamePH: "e.g. Maria Gonzalez", patientLastNamePH: "e.g. Gonzalez", phone: "Phone (WhatsApp)",
    phoneCode: "Country Code", phonePH: "123-456-7890", birthdate: "Date of Birth",
    birthdatePH: "dd/mm/yyyy",
    email: "Email",
    emailPH: "patient@email.com",
    procedure: "Procedure *", procedurePH: "e.g. Rhinoplasty, Lipo 360...",
    surgeryDate: "Surgery Date", location: "Location *",
    surgeryDatePH: "dd/mm/yyyy",
    preferredLanguage: "Preferred Language",
    timezone: "Patient time zone",
    allergies: "Allergies",
    allergiesPH: "e.g. Penicillin, latex, anesthesia...",
    medications: "Current Medications",
    medicationsPH: "e.g. Ibuprofen, metformin, vitamins...",
    careTeam: "Assigned Care Team",
    careTeamHint: "Choose who will see this room inside the portal/app. No SMS or staff links are sent.",
    careTeamFocused: "Selected office",
    careTeamShowAll: "All",
    careTeamShowOffice: "Office",
    careTeamSelectAll: "All",
    careTeamClear: "Only me",
    careTeamSelected: "Selected",
    careTeamFilterGdl: "Guadalajara",
    careTeamFilterTjn: "Tijuana",
    careTeamFilterSelected: "Selected",
    careTeamDoctorsGdl: "GDL doctors",
    careTeamDoctorsTjn: "TJN doctors",
    careTeamRoleDoctor: "Doctors",
    careTeamRoleEnfermeria: "Nursing",
    careTeamRoleCoordinacion: "Coordination",
    careTeamRolePost: "Post-op",
    careTeamRoleStaff: "Staff",
    manageTeam: "Manage team",
    saveTeam: "Save team",
    teamSaved: "Team updated.",
    patientInfo: "Patient Info",
    patientInfoHint: "Clinical and operational case details",
    patientAccessLink: "Patient link",
    patientAccessLinkHint: "This is the secure link to resend patient access to their chat.",
    patientCopyLink: "Copy link",
    patientShareLink: "Share link",
    patientMessageLink: "Send by message",
    patientLinkCopied: "Link copied.",
    addCareStaff: "Add care staff",
    addCareStaffHint: "Select staff from any office to add them to this patient.",
    inviteStaff: "Request access",
    staffAdded: "Request sent for approval.",
    staffSearch: "Search staff...",
    noStaffFound: "No staff matched that search.",
    callPatient: "Call patient",
    videoCall: "Video call",
    mediaLibrary: "Files",
    prescriptions: "Prescriptions",
    forms: "Forms",
    formFolderTitle: "Patient forms",
    noForms: "No submitted forms yet.",
    exportForm: "Export",
    shareForm: "Share",
    emailForm: "Email",
    messageForm: "Message",
    printForm: "PDF / Print",
    noPrescriptions: "No prescriptions yet.",
    prescriptionLabel: "Prescription name",
    prescriptionLabelPH: "e.g. Ibuprofen 800 mg",
    prescriptionInstructions: "Instructions for use",
    prescriptionInstructionsPH: "e.g. Take one tablet every 8 hours for 5 days.",
    prescriptionFile: "Selected file",
    savePrescription: "Save to prescriptions",
    startVideoCall: "Start video call",
    joinVideoCall: "Join video call",
    videoCallInvite: "Video call invite",
    videoCallInviteBody: "Tap to join the secure video call.",
    videoCallOpenError: "I could not open the video call. Check if your browser blocked the popup.",
    requestVideoCall: "Request video call",
    incomingCallRequest: "Video call request",
    callRequestBody: "The patient is requesting to start a video call.",
    callRequestSent: "Request sent. Waiting for the care team…",
    acceptCall: "Accept call",
    shareInvite: "Invite",
    inviteCopied: "Link copied",
    openInChat: "Open in chat",
    endAndReturn: "End and return to chat",
    callEndedNote: "Video call ended",
    patientLocalTime: "Patient Local Time",
    internalNotes: "Internal team notes",
    internalNotesHint: "Save notes for the assigned care team or privately for your eyes only.",
    addInternalNote: "Add internal note",
    internalNotePH: "Write a clinical or administrative note for the team...",
    noInternalNotes: "There are no internal notes for this case yet.",
    noteSaved: "Internal note saved.",
    noteVisibleTeam: "Visible to team",
    notePrivate: "Only me",
    privateNoteBadge: "Private",
    teamNoteBadge: "Team",
    uploadedBy: "Uploaded by",
    noTeamSelected: "If you do not choose anyone, only the room creator will be assigned.",
    noPatientInfo: "There is no extended patient data yet.",
    openFullRecord: "Open record",
    teamEmpty: "No staff assigned yet.",
    beforeMaterials: "Pre-Op Material",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Profile Photo", beforePhotos: "Pre-Op Photos",
    tapProfilePic: "Tap to upload profile photo",
    tapBeforePhotos: "Tap to upload pre-op photos",
    createRoom: "Create patient room", creating: "Creating room...",
    cancel: "Cancel", roomCreated: "Room Created!", shareLink: "Share this link with the patient:",
    copyLink: "📋 Copy Link", copied: "✅ Copied!", whatsapp: "💬 Send via WhatsApp",
    done: "Done", required: "Patient name and procedure are required.",
    fixErrors: "Please correct the errors before continuing.",
    invalidEmail: "Email must use a valid format, for example name@email.com.",
    invalidPhone: "Phone number must contain at least 7 digits.",
    settings: "Settings", myProfile: "My Profile",
    displayName: "Display Name",
    darkMode: "Dark Mode", fontSize: "Font Size",
    role: "Role", fileCategory: "How to classify this file?",
    general: "💬 General", medication: "💊 Medication", beforePhoto: "📸 Pre-Op Photo",
    generalSub: "Appears in chat only", medicationSub: "Medication folder",
    beforeSub: "Pre-Op folder", back: "← Back",
    quickReplies: "Quick Replies", edit: "Edit",
    shortcut: "Shortcut (e.g. hello)", message: "Full message",
    addReply: "Add Reply", save: "Save",
    noReplies: "No quick replies yet. Tap + to add one.",
    typeSlash: "Type / to see your quick replies",
    saving: "Saving...", saved: "✅ Saved",
    changePhoto: "Change Photo",
    small: "Small", medium: "Normal", large: "Large",
    editReply: "Edit Reply", deleteConfirm: "Delete this reply?",
    privacySupport: "Privacy and support",
    privacyPolicy: "Privacy policy",
    support: "Support",
    accountDeletion: "Delete account",
  }
};

const VIDEO_CALL_PREFIX = "__VIDEO_CALL__::";
const CALL_REQUEST_PREFIX = "__CALL_REQUEST__::";
const INTERNAL_NOTE_PREFIX = "__DRF_INTERNAL_NOTE__:";

const normalizeCallRoomId = (roomId: string) =>
  String(roomId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 36) || "room";

const buildProviderRoomName = (roomId: string) => `dr-fonseca-${normalizeCallRoomId(roomId).toLowerCase()}`;
const buildVideoCallMessage = (providerRoomName: string) => `${VIDEO_CALL_PREFIX}${providerRoomName}`;

const parseVideoCallMessage = (content: string | null | undefined) => {
  const text = `${content || ""}`.trim();
  if (!text.startsWith(VIDEO_CALL_PREFIX)) return null;
  const roomName = text.slice(VIDEO_CALL_PREFIX.length).trim().toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(roomName)) return null;
  return roomName;
};

const buildCallRequestMessage = () => `${CALL_REQUEST_PREFIX}${new Date().toISOString()}`;

const parseCallRequestMessage = (content: string | null | undefined) => {
  const text = `${content || ""}`.trim();
  if (!text.startsWith(CALL_REQUEST_PREFIX)) return null;
  return text.slice(CALL_REQUEST_PREFIX.length).trim() || "request";
};

const serializeInternalNote = (body: string, visibility: InternalNoteVisibility) =>
  `${INTERNAL_NOTE_PREFIX}${JSON.stringify({ body, visibility })}`;

const parseInternalNote = (content?: string | null): { body: string; visibility: InternalNoteVisibility } => {
  const text = `${content || ""}`;
  if (!text.startsWith(INTERNAL_NOTE_PREFIX)) return { body: text, visibility: "team" };
  try {
    const parsed = JSON.parse(text.slice(INTERNAL_NOTE_PREFIX.length));
    return {
      body: `${parsed?.body || ""}`,
      visibility: parsed?.visibility === "private" ? "private" : "team",
    };
  } catch {
    return { body: text, visibility: "team" };
  }
};

const safeStorageSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "staff";

interface QuickReply { shortcut: string; message: string; }
interface RoomMessageSummary {
  room_id?: string | null;
  created_at?: string | null;
  content?: string | null;
  message_type?: string | null;
  file_name?: string | null;
}
interface CareTeamMember {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  office_location?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  email?: string | null;
}
type StaffPrivateMessage = {
  id?: string;
  sender_id?: string | null;
  recipient_id?: string | null;
  sender_name?: string | null;
  recipient_name?: string | null;
  content?: string | null;
  created_at?: string | null;
  read_at?: string | null;
};
type StaffPrivateConversation = {
  peerId: string;
  peer: CareTeamMember;
  messages: StaffPrivateMessage[];
  latestAt: string;
  latestText: string;
  unreadCount: number;
};
type StaffRoomPayload = {
  kind: "staff_room";
  roomId: string;
  roomName: string;
  memberIds: string[];
  text: string;
  messageId: string;
  createdBy?: string | null;
  actorId?: string | null;
  event?: "invite" | "message" | "accept" | "decline" | "leave";
};
type StaffRoomConversation = {
  roomId: string;
  roomName: string;
  memberIds: string[];
  activeMemberIds: string[];
  createdBy?: string | null;
  currentUserStatus: "accepted" | "pending" | "declined" | "left";
  messages: StaffPrivateMessage[];
  latestAt: string;
  latestText: string;
  unreadCount: number;
};
type MediaNotification = {
  id?: string;
  patient_id?: string | null;
  room_id?: string | null;
  chat_id?: string | null;
  staff_id?: string | null;
  type?: string | null;
  media_type?: string | null;
  message?: string | null;
  seen?: boolean | null;
  created_at?: string | null;
};
type PatientAlert = {
  id?: string;
  patient_id?: string | null;
  chat_id?: string | null;
  status?: string | null;
  escalation_level?: number | null;
  created_at?: string | null;
  acknowledged_at?: string | null;
};
type PatientLabel = {
  id: string;
  user_id?: string | null;
  name_es?: string | null;
  name_en?: string | null;
  name?: string | null;
  color?: string | null;
  assigned_patient_ids?: string[] | null;
};

const STAFF_ROOM_PREFIX = "__DRF_STAFF_ROOM__:";
const makeStaffRoomId = () =>
  `staff-room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const makeStaffRoomMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `staff-msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const serializeStaffRoomPayload = (payload: StaffRoomPayload) =>
  `${STAFF_ROOM_PREFIX}${JSON.stringify(payload)}`;
const parseStaffRoomPayload = (content?: string | null): StaffRoomPayload | null => {
  const value = `${content || ""}`;
  if (!value.startsWith(STAFF_ROOM_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(STAFF_ROOM_PREFIX.length));
    if (parsed?.kind !== "staff_room" || !parsed.roomId) return null;
    return {
      kind: "staff_room",
      roomId: `${parsed.roomId}`,
      roomName: `${parsed.roomName || "Staff"}`,
      memberIds: Array.isArray(parsed.memberIds) ? parsed.memberIds.map((id: any) => `${id}`).filter(Boolean) : [],
      text: `${parsed.text || ""}`,
      messageId: `${parsed.messageId || makeStaffRoomMessageId()}`,
      createdBy: parsed.createdBy || null,
      actorId: parsed.actorId || null,
      event: ["invite", "message", "accept", "decline", "leave"].includes(parsed.event) ? parsed.event : "message",
    };
  } catch {
    return null;
  }
};

const CARE_TEAM_ROLE_ORDER = ["doctor", "enfermeria", "coordinacion", "post_quirofano", "staff"] as const;

interface QREditorProps {
  show: boolean; onClose: () => void; quickReplies: QuickReply[];
  onSave: (replies: QuickReply[]) => void; savingQR: boolean; savedQR: boolean;
  darkMode: boolean; lang: "es" | "en"; t: typeof T["es"]; headerBg: string;
  sidebarBg: string; borderColor: string; cardBg: string; textColor: string; subTextColor: string;
}

function QREditor({ show, onClose, quickReplies, onSave, savingQR, savedQR, darkMode, lang, t, headerBg, sidebarBg, borderColor, cardBg, textColor, subTextColor }: QREditorProps) {
  const [editingIndex, setEditingIndex] = useState<number|null>(null);
  const [editingShortcut, setEditingShortcut] = useState("");
  const [editingMessage, setEditingMessage] = useState("");
  const [newShortcut, setNewShortcut] = useState("");
  const [newMessage, setNewMessage] = useState("");

  if (!show) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:260,display:"grid",placeItems:"center",padding:"18px max(18px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:420,maxHeight:"82dvh",background:darkMode?sidebarBg:"#FFFFFF",color:textColor,borderRadius:18,padding:18,boxShadow:"0 18px 50px rgba(0,0,0,0.28)",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <strong style={{fontSize:18,fontWeight:650}}>{t.quickReplies}</strong>
          <button onClick={onClose} style={{border:"none",background:"transparent",color:textColor,fontSize:28,lineHeight:1,cursor:"pointer"}}>×</button>
        </div>
        {(savingQR || savedQR) && (
          <div style={{fontSize:13,color:savedQR?"#16A34A":subTextColor,fontWeight:600,marginBottom:10}}>{savedQR ? t.saved : t.saving}</div>
        )}
        <div style={{display:"grid",gap:8,marginBottom:14}}>
          {quickReplies.length===0&&<div style={{border:`1px solid ${borderColor}`,background:cardBg,borderRadius:12,padding:"12px 14px",fontSize:15,color:subTextColor}}>{t.noReplies}</div>}
          {quickReplies.map((qr,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"center"}}>
              {editingIndex===i ? (
                <div style={{gridColumn:"1 / -1",display:"grid",gap:8,border:`1px solid ${borderColor}`,background:cardBg,borderRadius:12,padding:12}}>
                  <input value={editingShortcut} onChange={e=>setEditingShortcut(e.target.value.toLowerCase().replace(/\s/g,""))} placeholder={t.shortcut} style={{width:"100%",height:44,border:`1px solid ${borderColor}`,outline:"none",borderRadius:12,background:darkMode?"#253244":"white",color:textColor,padding:"0 12px",fontSize:15,fontFamily:"inherit"}}/>
                  <textarea value={editingMessage} onChange={e=>setEditingMessage(e.target.value)} placeholder={t.message} rows={2} style={{width:"100%",border:`1px solid ${borderColor}`,outline:"none",borderRadius:12,background:darkMode?"#253244":"white",color:textColor,padding:"10px 12px",fontSize:15,fontFamily:"inherit",resize:"none"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{if(!editingShortcut.trim()||!editingMessage.trim())return;const updated=[...quickReplies];updated[i]={shortcut:editingShortcut.trim(),message:editingMessage.trim()};onSave(updated);setEditingIndex(null);}} style={{height:42,border:"none",borderRadius:12,background:"#075e54",color:"#fff",fontSize:15,fontWeight:650,cursor:"pointer",fontFamily:"inherit"}}>{t.save}</button>
                    <button onClick={()=>setEditingIndex(null)} style={{height:42,border:"none",borderRadius:12,background:darkMode?"#253244":"#F1F5F9",color:textColor,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={()=>{setEditingIndex(i);setEditingShortcut(qr.shortcut);setEditingMessage(qr.message);}} style={{minHeight:46,border:`1px solid ${borderColor}`,background:darkMode?"#253244":"white",color:textColor,borderRadius:12,padding:"10px 12px",textAlign:"left",fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{qr.message}</button>
                  <button onClick={()=>{setEditingIndex(i);setEditingShortcut(qr.shortcut);setEditingMessage(qr.message);}} style={{border:"none",background:"#e8f4ff",color:"#007AFF",borderRadius:12,padding:"0 14px",height:46,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.edit}</button>
                  <button onClick={()=>{if(confirm(t.deleteConfirm)){onSave(quickReplies.filter((_,j)=>j!==i));}}} style={{border:"none",background:"#FEE2E2",color:"#B91C1C",borderRadius:12,padding:"0 14px",height:46,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{lang==="es"?"Borrar":"Delete"}</button>
                </>
              )}
            </div>
          ))}
        </div>
        <input value={newShortcut} onChange={e=>setNewShortcut(e.target.value.toLowerCase().replace(/\s/g,""))} placeholder={lang==="es"?"Atajo (ej: hola)":"Shortcut (ex: hello)"} style={{width:"100%",height:48,border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#253244":"white",color:textColor,padding:"0 14px",fontSize:15,fontFamily:"inherit",marginBottom:10}}/>
        <textarea value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder={lang==="es"?"Crear respuesta rápida":"Create quick reply"} rows={2} style={{width:"100%",border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#253244":"white",color:textColor,padding:"12px 14px",fontSize:15,fontFamily:"inherit",resize:"none",marginBottom:10}}/>
        <button onClick={()=>{if(!newShortcut.trim()||!newMessage.trim())return;onSave([...quickReplies,{shortcut:newShortcut.trim(),message:newMessage.trim()}]);setNewShortcut("");setNewMessage("");}} style={{width:"100%",height:52,border:"none",borderRadius:14,background:"#075e54",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t.addReply}</button>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];
  const [darkMode, setDarkMode] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<"small"|"medium"|"large">("medium");
  const fontSize = fontSizeLevel === "small" ? 17 : fontSizeLevel === "large" ? 22 : 19;
  const uiBaseSize = fontSizeLevel === "small" ? 16 : fontSizeLevel === "large" ? 18 : 17;
  const uiLabelSize = fontSizeLevel === "small" ? 15 : fontSizeLevel === "large" ? 17 : 16;
  const uiSmallSize = fontSizeLevel === "small" ? 15 : fontSizeLevel === "large" ? 16 : 15;

  const headerBg = "#07334D";
  const sidebarBg = darkMode ? "#2C2C2E" : "white";
  const inputBg = darkMode ? "#202C33" : "#F0F2F5";
  const textColor = darkMode ? "white" : "#1C1C1E";
  const subTextColor = darkMode ? "rgba(255,255,255,0.78)" : "#5F6B7A";
  const borderColor = darkMode ? "rgba(255,255,255,0.16)" : "#D9E4F2";
  const cardBg = darkMode ? "#3A3A3C" : "#F8F8F8";

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list"|"chat">("list");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pressedMsgId, setPressedMsgId] = useState<string|null>(null);
  const [activeMessageAction, setActiveMessageAction] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [staffContactMember, setStaffContactMember] = useState<CareTeamMember | null>(null);
  const [staffPrivateDraft, setStaffPrivateDraft] = useState("");
  const [savingStaffPrivateMessage, setSavingStaffPrivateMessage] = useState(false);
  const [staffPrivateMessages, setStaffPrivateMessages] = useState<StaffPrivateMessage[]>([]);
  const [showStaffChats, setShowStaffChats] = useState(false);
  const [activeStaffChatPeerId, setActiveStaffChatPeerId] = useState<string | null>(null);
  const [activeStaffRoomId, setActiveStaffRoomId] = useState<string | null>(null);
  const [staffPrivateReply, setStaffPrivateReply] = useState("");
  const [staffRoomReply, setStaffRoomReply] = useState("");
  const [showCreateStaffRoom, setShowCreateStaffRoom] = useState(false);
  const [newStaffRoomName, setNewStaffRoomName] = useState("");
  const [newStaffRoomInitialMessage, setNewStaffRoomInitialMessage] = useState("");
  const [newStaffRoomMemberIds, setNewStaffRoomMemberIds] = useState<string[]>([]);
  const [privateToast, setPrivateToast] = useState<StaffPrivateMessage | null>(null);
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [latestRoomMessages, setLatestRoomMessages] = useState<Record<string, RoomMessageSummary>>({});
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQREditor, setShowQREditor] = useState(false);
  const [newPatientFirstName, setNewPatientFirstName] = useState("");
  const [newPatientLastName, setNewPatientLastName] = useState("");
  const [newPatientPhoneCountry, setNewPatientPhoneCountry] = useState("+52");
  const [newPatientPhoneLocal, setNewPatientPhoneLocal] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newSurgeryDate, setNewSurgeryDate] = useState("");
  const [newBirthdate, setNewBirthdate] = useState("");
  const [newLocation, setNewLocation] = useState("Guadalajara");
  const [newPatientLanguage, setNewPatientLanguage] = useState<"es" | "en">("es");
  const [newPatientTimezone, setNewPatientTimezone] = useState("America/Mexico_City");
  const [newPatientAllergies, setNewPatientAllergies] = useState("");
  const [newPatientMedications, setNewPatientMedications] = useState("");
  const [profilePicFile, setProfilePicFile] = useState<File|null>(null);
  const [beforePhotosFiles, setBeforePhotosFiles] = useState<File[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<CareTeamMember[]>([]);
  const [selectedCareTeamIds, setSelectedCareTeamIds] = useState<string[]>([]);
  const [careTeamFilter, setCareTeamFilter] = useState<CareTeamFilter>("all");
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [selectedRoomTeam, setSelectedRoomTeam] = useState<CareTeamMember[]>([]);
  const [managedTeamIds, setManagedTeamIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [internalNoteVisibility, setInternalNoteVisibility] = useState<InternalNoteVisibility>("team");
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoomError, setNewRoomError] = useState("");
  const [createdRoomLink, setCreatedRoomLink] = useState<string|null>(null);
  const [createdPatientName, setCreatedPatientName] = useState("");
  const [createdPatientLanguage, setCreatedPatientLanguage] = useState<"es" | "en">("es");
  const [linkCopied, setLinkCopied] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<File|null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | null>(null);
  const [preparingCapture, setPreparingCapture] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState<"image" | "video" | "audio" | "file">("file");
  const [pendingPrescriptionFile, setPendingPrescriptionFile] = useState<File | null>(null);
  const [prescriptionLabel, setPrescriptionLabel] = useState("");
  const [prescriptionInstructions, setPrescriptionInstructions] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    { shortcut: "hola", message: "¡Hola! ¿Cómo se siente hoy?" },
    { shortcut: "cita", message: "Su próxima cita es mañana. Por favor llegue 10 minutos antes." },
    { shortcut: "med", message: "Por favor tome su medicamento a tiempo." },
    { shortcut: "gracias", message: "¡Excelente recuperación! Gracias por su confianza." },
    { shortcut: "duda", message: "Llame al consultorio si tiene alguna duda. Estamos para ayudarle." },
  ]);
  const [savingQR, setSavingQR] = useState(false);
  const [savedQR, setSavedQR] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<MediaTab>("media");
  const [showCareStaffInvite, setShowCareStaffInvite] = useState(false);
  const [careStaffInviteIds, setCareStaffInviteIds] = useState<string[]>([]);
  const [careStaffSearch, setCareStaffSearch] = useState("");
  const [mediaUnreadCounts, setMediaUnreadCounts] = useState<Record<string, number>>({});
  const [pendingAlertRoomIds, setPendingAlertRoomIds] = useState<Set<string>>(new Set());
  const [pendingAlertLevels, setPendingAlertLevels] = useState<Record<string, number>>({});
  const [userLabels, setUserLabels] = useState<PatientLabel[]>([]);
  const [activeLabelFilter, setActiveLabelFilter] = useState("");
  const [labelAssignModeId, setLabelAssignModeId] = useState("");
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#EF4444");
  const [savingLabel, setSavingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState("");
  const [editingLabelName, setEditingLabelName] = useState("");
  const [editingLabelColor, setEditingLabelColor] = useState("#EF4444");
  const [savingLabelAction, setSavingLabelAction] = useState("");
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [phoneCountryEdit, setPhoneCountryEdit] = useState("+52");
  const [phoneLocalEdit, setPhoneLocalEdit] = useState("");
  const phoneEdit = joinPhoneNumber(phoneCountryEdit, phoneLocalEdit);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savedPhone, setSavedPhone] = useState(false);
  const [editingPrescriptionEntry, setEditingPrescriptionEntry] = useState<any | null>(null);
  const [prescriptionEditTitle, setPrescriptionEditTitle] = useState("");
  const [prescriptionEditInstructions, setPrescriptionEditInstructions] = useState("");
  const [savingPrescriptionRename, setSavingPrescriptionRename] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [patientTyping, setPatientTyping] = useState(false);
  const [toastAlert, setToastAlert] = useState<{ roomId: string; title: string; body: string; kind?: "message" | "note" } | null>(null);
  const [medicationDraft, setMedicationDraft] = useState("");
  const [savingMedication, setSavingMedication] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [autoTranslateIncoming, setAutoTranslateIncoming] = useState(true);
  const [translatedIncoming, setTranslatedIncoming] = useState<Record<string, string>>({});
  const [callOverlayOpen, setCallOverlayOpen] = useState(false);
  const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
  const [activeCallRoomName, setActiveCallRoomName] = useState<string | null>(null);
  const [callInviteFeedback, setCallInviteFeedback] = useState("");
  const [preOpViewerIndex, setPreOpViewerIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const selectedRoomRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaCaptureVideoRef = useRef<HTMLVideoElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);
  const profilePicSettingsRef = useRef<HTMLInputElement>(null);
  const beforePhotosRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const internalNoteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureRecorderRef = useRef<MediaRecorder | null>(null);
  const captureChunksRef = useRef<Blob[]>([]);
  const discardCaptureRef = useRef(false);
  const discardAudioRef = useRef(false);
  const notifRef = useRef<string>("default");
  const isSending = useRef(false);
  const typingChannelRef = useRef<any>(null);
  const typingIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTypingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translationCacheRef = useRef<Record<string, string>>({});
  const pauseBackgroundRefreshRef = useRef(false);
  const messagePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStaffChatsRef = useRef(false);
  const activeStaffChatPeerIdRef = useRef<string | null>(null);
  const activeStaffRoomIdRef = useRef<string | null>(null);
  const privateToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0,2).toUpperCase() : "P";
  const fmtTime = (ts: string) => { if (!ts) return ""; return new Date(ts).toLocaleTimeString(lang==="es"?"es-MX":"en-US",{hour:"2-digit",minute:"2-digit"}); };
  const fmtDateLabel = (ts: string) => { if (!ts) return ""; return new Date(ts).toLocaleDateString(lang==="es"?"es-MX":"en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}); };
  const fmtChatDateLabel = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const today = startOf(new Date());
    const messageDay = startOf(date);
    if (messageDay === today) return lang === "es" ? "Hoy" : "Today";
    if (messageDay === today - 86400000) return lang === "es" ? "Ayer" : "Yesterday";
    return date.toLocaleDateString(lang==="es"?"es-MX":"en-US",{month:"long",day:"numeric"});
  };
  const fmtSize = (b: number) => !b?"":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";
  const fmtRec = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  const isImageUrl = (url: string) => { if (!url) return false; const u=url.toLowerCase(); return u.includes("supabase")&&(u.endsWith(".jpg")||u.endsWith(".jpeg")||u.endsWith(".png")||u.endsWith(".gif")||u.endsWith(".webp")||u.includes("before")||u.includes("patient-photo")); };
  const senderColor = (type: string, role: string) => type==="patient"?"#1A6B3C":({doctor:"#0050A0",post_quirofano:"#6B3A9E",enfermeria:"#007A7A",coordinacion:"#B35A00",staff:"#444"} as any)[role]||"#444";
  const prefersNativeCapture =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const pickRecorderMimeType = (kind: "audio" | "video") => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    const options = kind === "audio"
      ? [
          "audio/mp4;codecs=mp4a.40.2",
          "audio/mp4",
          "audio/webm;codecs=opus",
          "audio/webm",
        ]
      : [
          "video/mp4;codecs=h264,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
    return options.find((value) => MediaRecorder.isTypeSupported(value)) || "";
  };
  const extensionForMimeType = (mimeType: string, fallback: string) => {
    const value = mimeType.toLowerCase();
    if (value.includes("audio/mp4")) return "m4a";
    if (value.includes("audio/webm")) return "webm";
    if (value.includes("video/mp4")) return "mp4";
    if (value.includes("video/webm")) return "webm";
    if (value.includes("jpeg")) return "jpg";
    return fallback;
  };
  const patientFullName = `${newPatientFirstName.trim()} ${newPatientLastName.trim()}`.trim();
  const combinedPatientPhone = newPatientPhoneLocal.trim() ? `${newPatientPhoneCountry} ${newPatientPhoneLocal.trim()}` : "";
  const isMissingColumnError = (error: any) => {
    const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
    return message.includes("column") || message.includes("schema cache") || message.includes("relation");
  };
  const roleName = (role?: string | null) => {
    const labels = lang==="es"
      ? { doctor: "Doctor", enfermeria: "Enfermería", coordinacion: "Coordinación", post_quirofano: "Post-Q", staff: "Personal" }
      : { doctor: "Doctor", enfermeria: "Nursing", coordinacion: "Coordination", post_quirofano: "Post-Op", staff: "Staff" };
    return (labels as any)[role || "staff"] || (lang==="es" ? "Personal" : "Staff");
  };
  const displaySenderName = (message: any, isOutgoing: boolean) => {
    if (message.sender_type === "patient") return message.sender_name || t.patientLabel;
    return message.sender_name || (isOutgoing ? roleName(message.sender_role) : "Staff");
  };
  const normalizedName = (value?: string | null) => `${value || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
  const staffPhoneFor = (member: CareTeamMember | null | undefined) => {
    const raw = `${member?.phone || ""}`.trim();
    if (!raw) return "";
    return raw.startsWith("+") ? raw : raw.replace(/[^\d+]/g, "");
  };
  const labelName = (label: PatientLabel) => {
    const primary = lang === "es" ? label.name_es : label.name_en;
    const fallback = lang === "es" ? label.name_en : label.name_es;
    return primary || fallback || label.name || (lang === "es" ? "Etiqueta" : "Label");
  };
  const patientLabelIdsFor = useCallback((patient: any) => {
    const patientId = `${patient?.id || ""}`;
    const value = patient?.labels;
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === "object") {
      const ownLabels = value[currentUserId] || value[String(currentUserId || "")];
      if (Array.isArray(ownLabels)) return ownLabels.filter(Boolean);
    }
    if (patientId) {
      return userLabels
        .filter((label) => Array.isArray(label.assigned_patient_ids) && label.assigned_patient_ids.map(String).includes(patientId))
        .map((label) => label.id);
    }
    return [] as string[];
  }, [currentUserId, userLabels]);
  const patientLabelsFor = (patient: any) => {
    const ids = new Set(patientLabelIdsFor(patient));
    return userLabels.filter((label) => ids.has(label.id));
  };
  const selectedPatient = selectedRoom?.procedures?.patients || null;
  const selectedPatientLabelIds = patientLabelIdsFor(selectedPatient);
  const selectedPatientLabelSet = new Set(selectedPatientLabelIds);
  const patientCountForLabel = useCallback((labelId: string) => (
    patients.filter((patient) => patientLabelIdsFor(patient).includes(labelId)).length
  ), [patientLabelIdsFor, patients]);
  const activeLabel = activeLabelFilter ? userLabels.find((label) => label.id === activeLabelFilter) || null : null;
  const labelAssignMode = Boolean(activeLabel && labelAssignModeId === activeLabelFilter);
  const labelColors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];
  const findStaffMemberForMessage = (message: any): CareTeamMember | null => {
    if (!message?.sender_id || message.sender_type !== "staff") return null;
    const senderName = normalizedName(message.sender_name);
    return (
      staffDirectory.find((member) => member.id === message.sender_id) ||
      selectedRoomTeam.find((member) => member.id === message.sender_id) ||
      staffDirectory.find((member) => senderName && (normalizedName(member.full_name) === senderName || normalizedName(member.display_name) === senderName)) ||
      selectedRoomTeam.find((member) => senderName && (normalizedName(member.full_name) === senderName || normalizedName(member.display_name) === senderName)) ||
      {
        id: message.sender_id,
        full_name: message.sender_name || roleName(message.sender_role),
        display_name: message.sender_name || roleName(message.sender_role),
        role: message.sender_role || "staff",
        office_location: message.sender_office || null,
        avatar_url: null,
        phone: null,
        email: null,
      }
    );
  };
  const openStaffContact = (member: CareTeamMember | null) => {
    if (!member || member.id === currentUserId) return;
    if (messagePressTimerRef.current) {
      clearTimeout(messagePressTimerRef.current);
      messagePressTimerRef.current = null;
    }
    setActiveMessageAction(null);
    setPressedMsgId(null);
    setStaffContactMember(member);
  };
  const closeStaffContact = () => {
    setStaffContactMember(null);
    setStaffPrivateDraft("");
  };

  const upsertStaffPrivateMessage = useCallback((message: StaffPrivateMessage) => {
    if (!message?.id) return;
    setStaffPrivateMessages((previous) => {
      const exists = previous.some((entry) => entry.id === message.id);
      const next = exists
        ? previous.map((entry) => (entry.id === message.id ? { ...entry, ...message } : entry))
        : [message, ...previous];
      return next.sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
    });
  }, []);

  const fetchStaffPrivateMessages = useCallback(async () => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("staff_private_messages")
      .select("*")
      .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error) setStaffPrivateMessages((data || []) as StaffPrivateMessage[]);
  }, [currentUserId]);

  const sendStaffPrivateToMember = async (member: CareTeamMember, content: string) => {
    const cleanContent = content.trim();
    if (!cleanContent || !member?.id || !currentUserId || savingStaffPrivateMessage) return false;
    setSavingStaffPrivateMessage(true);
    const senderName = userProfile?.full_name || userProfile?.display_name || "Staff";
    const { data, error } = await supabase.from("staff_private_messages").insert({
      sender_id: currentUserId,
      recipient_id: member.id,
      sender_name: senderName,
      recipient_name: member.full_name || member.display_name || null,
      content: cleanContent,
      created_at: new Date().toISOString(),
    } as any).select("*").single();
    setSavingStaffPrivateMessage(false);
    if (error) {
      alert(lang === "es" ? "No pude guardar el mensaje privado. Falta configurar la tabla de mensajes privados staff a staff." : "I could not save the private message. The staff-to-staff private messages table is not configured yet.");
      return false;
    }
    if (data) upsertStaffPrivateMessage(data as StaffPrivateMessage);
    return true;
  };

  const sendStaffPrivateMessage = async () => {
    if (!staffContactMember) return;
    const sent = await sendStaffPrivateToMember(staffContactMember, staffPrivateDraft);
    if (!sent) return;
    setStaffPrivateDraft("");
    alert(lang === "es" ? "Mensaje privado enviado." : "Private message sent.");
    closeStaffContact();
  };
  const allStaffMembersForChat = useMemo<CareTeamMember[]>(() => {
    const map = new Map<string, CareTeamMember>();
    staffDirectory.forEach((member) => member?.id && map.set(member.id, member));
    selectedRoomTeam.forEach((member) => member?.id && !map.has(member.id) && map.set(member.id, member));
    staffPrivateMessages.forEach((message) => {
      const candidates = [
        { id: message.sender_id || "", name: message.sender_name || "" },
        { id: message.recipient_id || "", name: message.recipient_name || "" },
      ];
      candidates.forEach((candidate) => {
        if (!candidate.id || map.has(candidate.id)) return;
        map.set(candidate.id, {
          id: candidate.id,
          full_name: candidate.name || (lang === "es" ? "Personal" : "Staff"),
          display_name: candidate.name || null,
          role: "staff",
          office_location: null,
          avatar_url: null,
          phone: null,
          email: null,
        });
      });
    });
    if (currentUserId) {
      map.set(currentUserId, {
        id: currentUserId,
        full_name: userProfile?.full_name || userProfile?.display_name || (lang === "es" ? "Tú" : "You"),
        display_name: userProfile?.display_name || null,
        role: userProfile?.role || "staff",
        office_location: userProfile?.office_location || null,
        avatar_url: userProfile?.avatar_url || null,
        phone: userProfile?.phone || null,
        email: userProfile?.email || currentUserEmail || null,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.full_name || a.display_name || ""}`.localeCompare(`${b.full_name || b.display_name || ""}`, lang === "es" ? "es" : "en")
    );
  }, [currentUserEmail, currentUserId, lang, selectedRoomTeam, staffDirectory, staffPrivateMessages, userProfile]);
  const staffMemberById = useMemo(() => {
    const map = new Map<string, CareTeamMember>();
    allStaffMembersForChat.forEach((member) => member.id && map.set(member.id, member));
    return map;
  }, [allStaffMembersForChat]);
  const staffRoomMemberOptions = allStaffMembersForChat.filter((member) => member.id !== currentUserId);

  const sendStaffRoomMessage = async (
    roomId: string,
    roomName: string,
    memberIds: string[],
    content: string,
    options: {
      event?: StaffRoomPayload["event"];
      createdBy?: string | null;
      actorId?: string | null;
    } = {}
  ) => {
    const cleanContent = content.trim();
    if (!currentUserId || !cleanContent || savingStaffPrivateMessage) return false;
    const uniqueMemberIds = Array.from(new Set([currentUserId, ...memberIds].filter(Boolean)));
    const recipientIds = uniqueMemberIds.filter((id) => id !== currentUserId);
    if (recipientIds.length === 0) {
      alert(lang === "es" ? "Selecciona al menos un miembro del equipo." : "Select at least one staff member.");
      return false;
    }
    setSavingStaffPrivateMessage(true);
    const senderName = userProfile?.full_name || userProfile?.display_name || "Staff";
    const payload = serializeStaffRoomPayload({
      kind: "staff_room",
      roomId,
      roomName,
      memberIds: uniqueMemberIds,
      text: cleanContent,
      messageId: makeStaffRoomMessageId(),
      createdBy: options.createdBy || currentUserId,
      actorId: options.actorId || currentUserId,
      event: options.event || "message",
    });
    const rows = recipientIds.map((recipientId) => {
      const recipient = staffMemberById.get(recipientId);
      return {
        sender_id: currentUserId,
        recipient_id: recipientId,
        sender_name: senderName,
        recipient_name: recipient?.full_name || recipient?.display_name || null,
        content: payload,
        created_at: new Date().toISOString(),
      };
    });
    const { data, error } = await supabase.from("staff_private_messages").insert(rows as any).select("*");
    setSavingStaffPrivateMessage(false);
    if (error) {
      alert(lang === "es" ? "No pude guardar el chat staff. Revisa la tabla staff_private_messages." : "I could not save the staff chat. Please check the staff_private_messages table.");
      return false;
    }
    (data || []).forEach((entry) => upsertStaffPrivateMessage(entry as StaffPrivateMessage));
    return true;
  };

  const createStaffRoom = async () => {
    const roomName = newStaffRoomName.trim() || (lang === "es" ? "Chat del equipo" : "Team chat");
    const memberIds = Array.from(new Set([currentUserId, ...newStaffRoomMemberIds].filter(Boolean)));
    const roomId = makeStaffRoomId();
    const intro = newStaffRoomInitialMessage.trim() || (lang === "es" ? "Chat staff creado." : "Staff chat created.");
    const sent = await sendStaffRoomMessage(roomId, roomName, memberIds, intro, { event: "invite", createdBy: currentUserId });
    if (!sent) return;
    setShowCreateStaffRoom(false);
    setNewStaffRoomName("");
    setNewStaffRoomInitialMessage("");
    setNewStaffRoomMemberIds([]);
    setActiveStaffChatPeerId(null);
    setActiveStaffRoomId(roomId);
    setShowStaffChats(true);
  };

  const toggleNewStaffRoomMember = (memberId: string) => {
    setNewStaffRoomMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const selectAllStaffForRoom = () => {
    setNewStaffRoomMemberIds(staffRoomMemberOptions.map((member) => member.id));
  };

  const closeMessageActions = () => {
    setPressedMsgId(null);
    setActiveMessageAction(null);
    closeStaffContact();
  };
  const startStaffMessagePress = (messageId: string, enabled: boolean) => {
    if (!enabled) return;
    if (messagePressTimerRef.current) clearTimeout(messagePressTimerRef.current);
    messagePressTimerRef.current = setTimeout(() => {
      setPressedMsgId(messageId);
      setActiveMessageAction(messages.find((entry) => entry.id === messageId) || null);
      messagePressTimerRef.current = null;
    }, 550);
  };
  const cancelStaffMessagePress = () => {
    if (!messagePressTimerRef.current) return;
    clearTimeout(messagePressTimerRef.current);
    messagePressTimerRef.current = null;
  };
  const startStaffContactPress = (member: CareTeamMember | null) => {
    if (!member || member.id === currentUserId) return;
    if (messagePressTimerRef.current) clearTimeout(messagePressTimerRef.current);
    messagePressTimerRef.current = setTimeout(() => {
      setStaffContactMember(member);
      messagePressTimerRef.current = null;
    }, 450);
  };
  const setComposerText = (value: string) => {
    setNewMessage(value);
    if (composerRef.current && composerRef.current.textContent !== value) {
      composerRef.current.textContent = value;
    }
    if (value.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(value.slice(1));
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
  };
  const applyComposerInputHints = (node: HTMLDivElement | null) => {
    if (!node) return;
    node.setAttribute("autocomplete", "off");
    node.setAttribute("autocorrect", "off");
    node.setAttribute("autocapitalize", "sentences");
    node.setAttribute("enterkeyhint", "send");
    node.setAttribute("inputmode", "text");
    node.spellcheck = false;
  };
  const setComposerNode = (node: HTMLDivElement | null) => {
    composerRef.current = node;
    applyComposerInputHints(node);
  };
  const toggleCareTeamMember = (id: string) => {
    setSelectedCareTeamIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  };
  const careTeamRoleRank = (role?: string | null) => {
    if (role === "doctor") return 0;
    if (role === "enfermeria") return 1;
    if (role === "post_quirofano") return 2;
    if (role === "coordinacion") return 3;
    return 4;
  };
  const sortCareTeamMembers = (members: CareTeamMember[]) =>
    [...members].sort((a, b) => {
      const roleDiff = careTeamRoleRank(a.role) - careTeamRoleRank(b.role);
      if (roleDiff !== 0) return roleDiff;
      return (a.full_name || "").localeCompare(b.full_name || "", lang === "es" ? "es" : "en");
    });
  const addCareTeamMembers = (members: CareTeamMember[]) => {
    const ids = [currentUserId, ...members.map((member) => member.id)].filter(Boolean) as string[];
    setSelectedCareTeamIds((current) => Array.from(new Set([...current, ...ids])));
  };
  const isSuperAdmin = isOwnerEmail(currentUserEmail) || ["owner","super_admin"].includes((userProfile?.admin_level || "").toLowerCase());
  const canOpenAdmin = isSuperAdmin;
  const canManageCareTeam = isSuperAdmin;
  const canViewInternalNote = (entry: any) => {
    const note = parseInternalNote(entry?.content);
    if (note.visibility !== "private") return true;
    return isSuperAdmin || (!!currentUserId && entry?.sender_id === currentUserId);
  };
  const internalNoteText = (entry: any) => parseInternalNote(entry?.content).body;
  const internalNoteVisibilityFor = (entry: any) => parseInternalNote(entry?.content).visibility;
  const mediaUploaderName = (entry: any) =>
    entry?.sender_name && entry.sender_name !== "Sistema"
      ? entry.sender_name
      : lang === "es"
        ? "Equipo"
        : "Care team";
  const canCreatePatientRooms =
    isOwnerEmail(currentUserEmail) ||
    ["owner", "super_admin", "admin"].includes((userProfile?.admin_level || "").toLowerCase());
  const careTeamDirectory = sortCareTeamMembers(
    careTeamFilter === "guadalajara"
      ? staffDirectory.filter((member) => member.office_location === "Guadalajara" || !member.office_location)
      : careTeamFilter === "tijuana"
        ? staffDirectory.filter((member) => member.office_location === "Tijuana" || !member.office_location)
        : careTeamFilter === "selected"
          ? staffDirectory.filter((member) => selectedCareTeamIds.includes(member.id))
          : staffDirectory
  );
  const careTeamSelectedMembers = staffDirectory.filter((member) => selectedCareTeamIds.includes(member.id));
  const careStaffInviteDirectory = sortCareTeamMembers(
    staffDirectory.filter((member) => {
      const search = careStaffSearch.trim().toLowerCase();
      if (!search) return true;
      return [
        member.full_name,
        member.display_name,
        member.role,
        member.office_location,
        member.phone,
      ]
        .filter(Boolean)
        .some((value) => `${value}`.toLowerCase().includes(search));
    })
  );
  const staffPrivateConversations = useMemo<StaffPrivateConversation[]>(() => {
    if (!currentUserId) return [];
    const grouped = new Map<string, StaffPrivateMessage[]>();
    staffPrivateMessages.forEach((message) => {
      if (parseStaffRoomPayload(message.content)) return;
      const senderId = message.sender_id || "";
      const recipientId = message.recipient_id || "";
      if (!senderId || !recipientId) return;
      const peerId = senderId === currentUserId ? recipientId : senderId;
      if (!peerId || peerId === currentUserId) return;
      grouped.set(peerId, [...(grouped.get(peerId) || []), message]);
    });

    return Array.from(grouped.entries())
      .map(([peerId, conversationMessages]) => {
        const sorted = [...conversationMessages].sort((a, b) => `${a.created_at || ""}`.localeCompare(`${b.created_at || ""}`));
        const latest = sorted[sorted.length - 1] || {};
        const fallbackName =
          latest.sender_id === peerId
            ? latest.sender_name
            : latest.recipient_name;
        const peer = staffMemberById.get(peerId) || {
          id: peerId,
          full_name: fallbackName || (lang === "es" ? "Personal" : "Staff"),
          display_name: fallbackName || null,
          role: "staff",
          office_location: null,
          avatar_url: null,
          phone: null,
          email: null,
        };
        return {
          peerId,
          peer,
          messages: sorted,
          latestAt: latest.created_at || "",
          latestText: `${latest.content || ""}`.trim(),
          unreadCount: sorted.filter((message) => message.recipient_id === currentUserId && !message.read_at).length,
        };
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [currentUserId, lang, staffMemberById, staffPrivateMessages]);

  const staffRoomConversations = useMemo<StaffRoomConversation[]>(() => {
    if (!currentUserId) return [];
    const grouped = new Map<string, {
      roomName: string;
      memberIds: Set<string>;
      createdBy?: string | null;
      messages: Map<string, StaffPrivateMessage>;
      unread: Set<string>;
    }>();
    staffPrivateMessages.forEach((message) => {
      const payload = parseStaffRoomPayload(message.content);
      if (!payload) return;
      const senderId = message.sender_id || "";
      const recipientId = message.recipient_id || "";
      const memberIds = new Set<string>([...payload.memberIds, senderId, recipientId].filter(Boolean));
      if (!memberIds.has(currentUserId)) return;
      const existing = grouped.get(payload.roomId) || {
        roomName: payload.roomName || (lang === "es" ? "Chat staff" : "Staff chat"),
        memberIds: new Set<string>(),
        createdBy: payload.createdBy || null,
        messages: new Map<string, StaffPrivateMessage>(),
        unread: new Set<string>(),
      };
      memberIds.forEach((id) => existing.memberIds.add(id));
      if (payload.createdBy) {
        existing.createdBy = payload.createdBy;
        existing.memberIds.add(payload.createdBy);
      }
      const messageKey = payload.messageId || message.id || `${message.created_at}-${message.content}`;
      if (!existing.messages.has(messageKey)) existing.messages.set(messageKey, message);
      if (message.recipient_id === currentUserId && !message.read_at) existing.unread.add(messageKey);
      grouped.set(payload.roomId, existing);
    });
    return Array.from(grouped.entries())
      .map(([roomId, room]) => {
        const messages = Array.from(room.messages.values()).sort((a, b) => `${a.created_at || ""}`.localeCompare(`${b.created_at || ""}`));
        const latest = messages[messages.length - 1];
        const latestPayload = parseStaffRoomPayload(latest?.content);
        const memberIds = Array.from(room.memberIds);
        const hasInviteEvent = messages.some((message) => parseStaffRoomPayload(message.content)?.event === "invite");
        const memberStatuses = new Map<string, "accepted" | "pending" | "declined" | "left">();
        memberIds.forEach((id) => memberStatuses.set(id, hasInviteEvent ? "pending" : "accepted"));
        if (room.createdBy) memberStatuses.set(room.createdBy, "accepted");
        messages.forEach((message) => {
          const payload = parseStaffRoomPayload(message.content);
          if (!payload) return;
          payload.memberIds.forEach((id) => {
            if (!memberStatuses.has(id)) memberStatuses.set(id, hasInviteEvent ? "pending" : "accepted");
          });
          const actorId = payload.actorId || message.sender_id || "";
          if (!actorId) return;
          if (payload.event === "accept") memberStatuses.set(actorId, "accepted");
          if (payload.event === "decline") memberStatuses.set(actorId, "declined");
          if (payload.event === "leave") memberStatuses.set(actorId, "left");
          if (payload.event === "invite" && actorId === room.createdBy) memberStatuses.set(actorId, "accepted");
        });
        const currentUserStatus = memberStatuses.get(currentUserId) || "accepted";
        const activeMemberIds = Array.from(memberStatuses.entries())
          .filter(([, status]) => status === "accepted" || status === "pending")
          .map(([id]) => id);
        return {
          roomId,
          roomName: room.roomName,
          memberIds,
          activeMemberIds,
          createdBy: room.createdBy,
          currentUserStatus,
          messages,
          latestAt: latest?.created_at || "",
          latestText: latestPayload?.text || "",
          unreadCount: room.unread.size,
        };
      })
      .filter((conversation) => !["declined", "left"].includes(conversation.currentUserStatus))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [currentUserId, lang, staffPrivateMessages]);

  const staffPrivateUnread = staffPrivateConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const staffRoomUnread = staffRoomConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const totalStaffChatUnread = staffPrivateUnread + staffRoomUnread;
  const activeStaffPrivateConversation = staffPrivateConversations.find((conversation) => conversation.peerId === activeStaffChatPeerId) || null;
  const activeStaffRoomConversation = staffRoomConversations.find((conversation) => conversation.roomId === activeStaffRoomId) || null;

  const markStaffPrivateConversationRead = useCallback(async (peerId: string) => {
    if (!currentUserId || !peerId) return;
    const readAt = new Date().toISOString();
    setStaffPrivateMessages((previous) => previous.map((message) => (
      message.sender_id === peerId && message.recipient_id === currentUserId && !message.read_at
        ? { ...message, read_at: readAt }
        : message
    )));
    await supabase
      .from("staff_private_messages")
      .update({ read_at: readAt })
      .eq("sender_id", peerId)
      .eq("recipient_id", currentUserId)
      .is("read_at", null);
  }, [currentUserId]);

  const openStaffPrivateConversation = useCallback((peerId: string) => {
    if (!peerId) return;
    setShowStaffChats(true);
    setActiveStaffChatPeerId(peerId);
    setActiveStaffRoomId(null);
    setPrivateToast(null);
    markStaffPrivateConversationRead(peerId);
  }, [markStaffPrivateConversationRead]);

  const markStaffRoomRead = useCallback(async (roomId: string) => {
    if (!currentUserId || !roomId) return;
    const readAt = new Date().toISOString();
    const ids = staffPrivateMessages
      .filter((message) => parseStaffRoomPayload(message.content)?.roomId === roomId && message.recipient_id === currentUserId && !message.read_at && message.id)
      .map((message) => message.id as string);
    if (ids.length === 0) return;
    setStaffPrivateMessages((previous) => previous.map((message) => ids.includes(message.id || "") ? { ...message, read_at: readAt } : message));
    await supabase.from("staff_private_messages").update({ read_at: readAt }).in("id", ids);
  }, [currentUserId, staffPrivateMessages]);

  const openStaffRoomConversation = useCallback((roomId: string) => {
    if (!roomId) return;
    setShowStaffChats(true);
    setActiveStaffChatPeerId(null);
    setActiveStaffRoomId(roomId);
    setPrivateToast(null);
    markStaffRoomRead(roomId);
  }, [markStaffRoomRead]);

  const sendStaffPrivateReply = async () => {
    if (!activeStaffPrivateConversation || !staffPrivateReply.trim()) return;
    const sent = await sendStaffPrivateToMember(activeStaffPrivateConversation.peer, staffPrivateReply);
    if (sent) setStaffPrivateReply("");
  };

  const sendActiveStaffRoomReply = async () => {
    if (!activeStaffRoomConversation || !staffRoomReply.trim()) return;
    const sent = await sendStaffRoomMessage(
      activeStaffRoomConversation.roomId,
      activeStaffRoomConversation.roomName,
      activeStaffRoomConversation.activeMemberIds,
      staffRoomReply,
      { event: "message", createdBy: activeStaffRoomConversation.createdBy || currentUserId }
    );
    if (sent) setStaffRoomReply("");
  };

  const respondToStaffRoomInvite = async (conversation: StaffRoomConversation, response: "accept" | "decline") => {
    if (!currentUserId) return;
    const actorName = userProfile?.full_name || userProfile?.display_name || (lang === "es" ? "Personal" : "Staff");
    const text = response === "accept"
      ? (lang === "es" ? `${actorName} aceptó la invitación.` : `${actorName} accepted the invite.`)
      : (lang === "es" ? `${actorName} rechazó la invitación.` : `${actorName} declined the invite.`);
    const sent = await sendStaffRoomMessage(
      conversation.roomId,
      conversation.roomName,
      conversation.memberIds,
      text,
      { event: response, createdBy: conversation.createdBy || currentUserId, actorId: currentUserId }
    );
    if (!sent) return;
    if (response === "decline") {
      setActiveStaffRoomId(null);
      setStaffRoomReply("");
    }
  };

  const leaveActiveStaffRoom = async () => {
    if (!activeStaffRoomConversation || !currentUserId) return;
    const confirmed = window.confirm(
      lang === "es"
        ? "¿Quieres salir de este chat interno? Si sales, tendrás que ser invitado nuevamente por la persona que creó el chat."
        : "Leave this internal chat? If you leave, you must be invited again by the person who created the chat."
    );
    if (!confirmed) return;
    const actorName = userProfile?.full_name || userProfile?.display_name || (lang === "es" ? "Personal" : "Staff");
    const sent = await sendStaffRoomMessage(
      activeStaffRoomConversation.roomId,
      activeStaffRoomConversation.roomName,
      activeStaffRoomConversation.memberIds,
      lang === "es" ? `${actorName} salió del chat.` : `${actorName} left the chat.`,
      { event: "leave", createdBy: activeStaffRoomConversation.createdBy || currentUserId, actorId: currentUserId }
    );
    if (!sent) return;
    setActiveStaffRoomId(null);
    setStaffRoomReply("");
  };

  const openStaffChatsHome = () => {
    setShowStaffChats(true);
    setActiveStaffChatPeerId(null);
    setActiveStaffRoomId(null);
    setStaffPrivateReply("");
    setStaffRoomReply("");
    fetchStaffPrivateMessages();
  };

  const leaveCurrentChatView = () => {
    setMobileView("list");
    setSelectedRoom(null);
    setShowQREditor(false);
    setShowMediaMenu(false);
    setShowEmojiMenu(false);
    setShowSlashMenu(false);
    closeMessageActions();
  };

  const signOutToLogin = () => {
    supabase.auth.signOut().finally(() => {
      window.location.href = "/login";
    });
  };

  const requestNewPatientRoom = () => {
    if (!canCreatePatientRooms) {
      setNotificationFeedback({
        tone: "error",
        text:
          lang === "es"
            ? "No tienes permiso para crear pacientes. Solo el personal habilitado por Admin puede hacerlo."
            : "You do not have permission to create patients. Only admin-enabled staff can do this.",
      });
      return;
    }
    setShowNewRoom(true);
  };

  const StaffGlobalActions = ({ compact = false }: { compact?: boolean }) => (
    <div className="staff-global-actions">
      <button
        className="admin-inline-btn"
        onClick={openStaffChatsHome}
        title={lang==="es" ? "Comunicación interna del equipo" : "Internal team communication"}
        style={{position:"relative"}}
      >
        {compact ? "Staff" : (lang==="es" ? "Staff" : "Staff")}
        {totalStaffChatUnread > 0 && (
          <span style={{position:"absolute",top:-6,right:-6,minWidth:20,height:20,padding:"0 5px",borderRadius:99,background:"#EF4444",color:"white",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(239,68,68,0.35)"}}>
            {totalStaffChatUnread}
          </span>
        )}
      </button>
      {canCreatePatientRooms && (
        <button
          className="staff-plus-btn"
          onClick={requestNewPatientRoom}
          title={lang === "es" ? "Crear paciente" : "Create patient"}
          aria-label={lang === "es" ? "Crear paciente" : "Create patient"}
        >
          +
        </button>
      )}
      <button
        className="chat-exit-btn"
        type="button"
        onClick={signOutToLogin}
        title={lang==="es" ? "Salir" : "Exit"}
        aria-label={lang==="es" ? "Salir" : "Exit"}
      >
        <img src="/Exit_icon.png" alt="" style={{width:28,height:28,objectFit:"contain",display:"block"}} />
      </button>
    </div>
  );

  const closeTopMenu = () => setShowTopMenu(false);
  const careTeamOfficeGroups = [
    {
      key: "guadalajara",
      label: "Guadalajara",
      members: careTeamDirectory.filter((member) => member.office_location === "Guadalajara"),
    },
    {
      key: "tijuana",
      label: "Tijuana",
      members: careTeamDirectory.filter((member) => member.office_location === "Tijuana"),
    },
    {
      key: "both",
      label: lang === "es" ? "Ambos consultorios" : "Both offices",
      members: careTeamDirectory.filter((member) => !member.office_location),
    },
  ].filter((group) => group.members.length > 0);
  const guadalajaraDoctors = staffDirectory.filter((member) => member.role === "doctor" && member.office_location === "Guadalajara");
  const tijuanaDoctors = staffDirectory.filter((member) => member.role === "doctor" && member.office_location === "Tijuana");
  const careTeamRoleLabel = (role: string) => {
    if (role === "doctor") return t.careTeamRoleDoctor;
    if (role === "enfermeria") return t.careTeamRoleEnfermeria;
    if (role === "coordinacion") return t.careTeamRoleCoordinacion;
    if (role === "post_quirofano") return t.careTeamRolePost;
    return t.careTeamRoleStaff;
  };

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const armAudioAlerts = useCallback(() => {
    audioUnlockedRef.current = true;
    const context = ensureAudioContext();
    if (context?.state === "suspended") context.resume().catch(() => {});
  }, [ensureAudioContext]);

  const playIncomingTone = useCallback(() => {
    const context = ensureAudioContext();
    if (!context) return;
    const doPlay = () => {
      const startAt = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
      gain.connect(context.destination);

      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(660, startAt + 0.22);
      oscillator.connect(gain);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.24);
    };
    if (context.state === "suspended") {
      context.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  }, [ensureAudioContext]);

  const describeIncomingMessage = useCallback((message: RoomMessageSummary) => {
    if (parseCallRequestMessage(message.content)) return t.incomingCallRequest;
    if (parseFormMessage(message.content)) return lang==="es" ? "Formulario enviado" : "Form submitted";
    if (isClinicalFormPdfEntry(message)) return lang==="es" ? "PDF de historia clínica" : "Clinical history PDF";
    if (message.message_type === "audio") return lang==="es" ? "Nuevo audio" : "New audio";
    if (message.message_type === "video") return lang==="es" ? "Nuevo video" : "New video";
    if (message.message_type === "image") return lang==="es" ? "Nueva imagen" : "New image";
    if (message.message_type === "file") return lang==="es" ? "Nuevo archivo" : "New file";
    if (parseVideoCallMessage(message.content)) return t.videoCallInvite;
    const text = `${message.content || ""}`.trim();
    return text ? text.slice(0, 120) : lang==="es" ? "Nuevo mensaje" : "New message";
  }, [lang, t.incomingCallRequest, t.videoCallInvite]);

  const roomPatientName = useCallback((roomId: string) => {
    const patient = patients.find((entry) => entry.rooms?.some((room: any) => room.id === roomId));
    return patient?.full_name || t.patientLabel;
  }, [patients, t.patientLabel]);
  const translationKey = useCallback((messageId: string | number, targetLang: "es" | "en") => `incoming_translate_${String(messageId)}_${targetLang}`, []);
  const alertMessageStorageKey = useCallback((roomId: string) => `last_alert_message_${roomId}`, []);
  const incomingMessageKey = useCallback((message: any) => {
    if (!message) return "";
    return `${message.room_id || ""}:${message.id || "no-id"}:${message.created_at || ""}:${message.sender_type || ""}:${message.message_type || ""}`;
  }, []);
  const isMediaMessage = useCallback((message: any) => ["image", "video", "file"].includes(`${message?.message_type || ""}`), []);

  const updateAutoScrollPreference = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
    if (shouldAutoScrollRef.current) setShowJumpToLatest(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
  }, []);

  const pushNotif = useCallback((title: string, body: string) => {
    if (notifRef.current==="granted"&&"serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) =>
        registration.showNotification(title,{body,icon:"/apple-touch-icon.png",vibrate:[200,100,200]} as any)
      );
    }
  }, []);

  const showToastAlert = useCallback((roomId: string, title: string, body: string, kind: "message" | "note" = "message") => {
    setToastAlert({ roomId, title, body, kind });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (kind !== "note") {
      toastTimeoutRef.current = setTimeout(() => setToastAlert(null), 4500);
    }
  }, []);

  const patientIdForRoom = useCallback((roomId: string) => {
    const patient = patients.find((entry) => entry.rooms?.some((room: any) => room.id === roomId));
    return patient?.id || "";
  }, [patients]);

  const registerPatientAlertRoom = useCallback((roomId?: string | null, patientId?: string | null, notify = false, escalationLevel = 1) => {
    const alertRoomId = `${roomId || ""}`.trim();
    if (!alertRoomId) return;
    const assignedPatient = patients.find((entry) => entry.rooms?.some((room: any) => room.id === alertRoomId));
    const isAssigned = !!assignedPatient || selectedRoomRef.current?.id === alertRoomId;
    if (!isAssigned) return;
    const cleanLevel = Math.min(3, Math.max(1, Number(escalationLevel) || 1));

    setPendingAlertRoomIds((current) => {
      if (current.has(alertRoomId)) return current;
      const next = new Set(current);
      next.add(alertRoomId);
      return next;
    });
    setPendingAlertLevels((current) => current[alertRoomId] === cleanLevel ? current : { ...current, [alertRoomId]: cleanLevel });

    if (!notify) return;
    const patientName = assignedPatient?.full_name || (patientId ? patients.find((entry) => entry.id === patientId)?.full_name : "") || roomPatientName(alertRoomId);
    const body = cleanLevel >= 3
      ? (lang === "es" ? "🚨 URGENTE — atención inmediata requerida" : "🚨 URGENT — immediate attention required")
      : cleanLevel >= 2
        ? (lang === "es" ? "🚨 Alerta escalada" : "🚨 Alert escalated")
        : (lang === "es" ? "🚨 Necesito ayuda" : "🚨 I need help");
    playIncomingTone();
    showToastAlert(alertRoomId, patientName, body);
    pushNotif(patientName, body);
  }, [lang, patients, playIncomingTone, pushNotif, roomPatientName, showToastAlert]);

  const registerIncomingPatientAlert = useCallback((alert: PatientAlert) => {
    const roomId = `${alert.chat_id || ""}`.trim();
    if (!roomId) return;
    if (`${alert.status || "pending"}` !== "pending" || alert.acknowledged_at) {
      setPendingAlertRoomIds((current) => {
        if (!current.has(roomId)) return current;
        const next = new Set(current);
        next.delete(roomId);
        return next;
      });
      setPendingAlertLevels((current) => {
        if (!(roomId in current)) return current;
        const next = { ...current };
        delete next[roomId];
        return next;
      });
      return;
    }
    registerPatientAlertRoom(roomId, alert.patient_id, false, alert.escalation_level || 1);
  }, [registerPatientAlertRoom]);

  const registerIncomingMediaNotification = useCallback((notification: MediaNotification) => {
    const notificationType = `${notification.type || notification.media_type || ""}`.toLowerCase();
    if (notificationType === "alert" || notificationType === "alert_escalation") {
      const levelMatch = `${notification.message || ""}`.match(/nivel\s+(\d+)|level\s+(\d+)/i);
      const level = Number(levelMatch?.[1] || levelMatch?.[2] || (notificationType === "alert_escalation" ? 2 : 1));
      registerPatientAlertRoom(notification.chat_id || notification.room_id, notification.patient_id, true, level);
      return;
    }
    const patientId = notification.patient_id || (notification.room_id ? patientIdForRoom(notification.room_id) : "");
    const roomId = notification.room_id || patients.find((patient) => patient.id === patientId)?.rooms?.[0]?.id || "";
    if (!patientId) return;
    const patientName = roomId ? roomPatientName(roomId) : patients.find((patient) => patient.id === patientId)?.full_name || t.patientLabel;
    const body = notification.message || (lang === "es" ? "Nuevo archivo agregado" : "New file added");
    const toastBody = body.replace(/\s+para\s+.+$/i, "");

    setMediaUnreadCounts((current) => ({ ...current, [patientId]: (current[patientId] || 0) + 1 }));
    if (roomId) showToastAlert(roomId, patientName, toastBody);
    playIncomingTone();
    pushNotif(patientName, body);
  }, [lang, patientIdForRoom, patients, playIncomingTone, pushNotif, registerPatientAlertRoom, roomPatientName, showToastAlert, t.patientLabel]);

  const fetchPendingPatientAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from("patient_alerts")
      .select("chat_id, patient_id, status, escalation_level, acknowledged_at")
      .eq("status", "pending");
    if (error) return;
    const nextLevels: Record<string, number> = {};
    (data || []).forEach((alert: any) => {
      if (alert.chat_id && !alert.acknowledged_at) nextLevels[alert.chat_id] = Math.min(3, Math.max(1, Number(alert.escalation_level) || 1));
    });
    setPendingAlertRoomIds(new Set(Object.keys(nextLevels)));
    setPendingAlertLevels(nextLevels);
  }, []);

  const fetchMediaNotificationCounts = useCallback(async () => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("media_notifications")
      .select("patient_id, room_id")
      .eq("staff_id", currentUserId)
      .eq("seen", false);
    if (error) return;
    const next: Record<string, number> = {};
    (data || []).forEach((entry: any) => {
      const patientId = entry.patient_id || (entry.room_id ? patientIdForRoom(entry.room_id) : "");
      if (patientId) next[patientId] = (next[patientId] || 0) + 1;
    });
    setMediaUnreadCounts(next);
  }, [currentUserId, patientIdForRoom]);

  const markMediaNotificationsSeen = useCallback(async (patientId?: string | null) => {
    if (!currentUserId || !patientId) return;
    setMediaUnreadCounts((current) => {
      if (!current[patientId]) return current;
      const next = { ...current };
      delete next[patientId];
      return next;
    });
    await supabase
      .from("media_notifications")
      .update({ seen: true, status: "read", read_at: new Date().toISOString() })
      .eq("staff_id", currentUserId)
      .eq("patient_id", patientId)
      .eq("seen", false);
  }, [currentUserId]);

  const openToastRoom = useCallback((mode: "chat" | "read-note" | "add-note" = "chat") => {
    if (!toastAlert) return;
    const room = patients.flatMap((patient) => patient.rooms || []).find((entry: any) => entry.id === toastAlert.roomId) || null;
    if (room) setSelectedRoom(room);
    setMobileView("chat");
    if (mode !== "chat") {
      setShowPatientInfo(true);
      if (mode === "add-note") {
        window.setTimeout(() => internalNoteInputRef.current?.focus(), 120);
      }
    }
    setToastAlert(null);
  }, [patients, toastAlert]);

  const markRoomAsRead = useCallback((roomId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`last_seen_${roomId}`, new Date().toISOString());
      window.localStorage.setItem(`last_alert_${roomId}`, new Date().toISOString());
    }
    setUnreadCounts((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  const registerIncomingPatientMessage = useCallback((message: any, options?: { skipUnread?: boolean }) => {
    const roomId = message.room_id;
    const messageKey = incomingMessageKey(message);
    if (typeof window !== "undefined" && messageKey) {
      const lastAlertedMessage = window.localStorage.getItem(alertMessageStorageKey(roomId)) || "";
      if (lastAlertedMessage === messageKey) return;
      window.localStorage.setItem(alertMessageStorageKey(roomId), messageKey);
      window.localStorage.setItem(`last_alert_${roomId}`, message.created_at || new Date().toISOString());
    }
    const title = roomPatientName(roomId);
    const body = describeIncomingMessage(message);
    const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
    const isActiveRoom = selectedRoomRef.current?.id === roomId;

    playIncomingTone();

    if (!options?.skipUnread && (!isVisible || !isActiveRoom)) {
      setUnreadCounts((prev) => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
    }

    if (!isActiveRoom || !isVisible) {
      showToastAlert(roomId, title, body);
      pushNotif(title, body);
    }
  }, [alertMessageStorageKey, describeIncomingMessage, incomingMessageKey, playIncomingTone, pushNotif, roomPatientName, showToastAlert]);

  const registerIncomingInternalNote = useCallback((message: any) => {
    const roomId = message.room_id;
    const roomIsAssigned = selectedRoomRef.current?.id === roomId || patients.some((patient: any) => (patient.rooms || []).some((room: any) => room.id === roomId));
    if (!roomIsAssigned) return;
    const parsedNote = parseInternalNote(message.content);
    if (parsedNote.visibility === "private" && message.sender_id !== currentUserId && !isSuperAdmin) return;
    const messageKey = incomingMessageKey(message);
    if (typeof window !== "undefined" && messageKey) {
      const lastAlertedMessage = window.localStorage.getItem(alertMessageStorageKey(roomId)) || "";
      if (lastAlertedMessage === messageKey) return;
      window.localStorage.setItem(alertMessageStorageKey(roomId), messageKey);
      window.localStorage.setItem(`last_alert_${roomId}`, message.created_at || new Date().toISOString());
    }

    const patientName = roomPatientName(roomId);
    const author = message.sender_name || roleName(message.sender_role);
    const title = lang === "es" ? `Nota interna · ${patientName}` : `Internal note · ${patientName}`;
    const rawBody = parsedNote.body.trim();
    const body = rawBody
      ? `${author}: ${rawBody}`.slice(0, 120)
      : (lang === "es" ? "Nuevo seguimiento interno del equipo." : "New internal care-team follow-up.");
    const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
    const isActiveRoom = selectedRoomRef.current?.id === roomId;

    playIncomingTone();
    showToastAlert(roomId, title, body, "note");
    if (!isVisible || !isActiveRoom) {
      pushNotif(title, body);
    }
  }, [alertMessageStorageKey, incomingMessageKey, lang, patients, playIncomingTone, pushNotif, roomPatientName, showToastAlert]);

  const broadcastTypingState = useCallback((isTyping: boolean, roomId: string, name: string) => {
    if (!typingChannelRef.current) return;
    outgoingTypingRef.current = isTyping;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        roomId,
        senderType: "staff",
        name,
        isTyping,
        sentAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }, []);

  const updateTypingState = useCallback((nextValue: string, roomId?: string) => {
    const activeRoomId = roomId || selectedRoom?.id;
    const senderName = userProfile?.full_name || userProfile?.display_name || "Staff";
    if (!activeRoomId) return;
    const hasText = nextValue.trim().length > 0;
    if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);

    if (!hasText) {
      if (outgoingTypingRef.current) broadcastTypingState(false, activeRoomId, senderName);
      return;
    }

    broadcastTypingState(true, activeRoomId, senderName);
    typingIdleTimeoutRef.current = setTimeout(() => {
      broadcastTypingState(false, activeRoomId, senderName);
    }, 1400);
  }, [broadcastTypingState, selectedRoom?.id, userProfile?.display_name, userProfile?.full_name]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { window.location.href = "/login"; return; }
      if (event==="SIGNED_IN"||event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED") { setCurrentUserEmail(session.user.email?.toLowerCase()||""); setCurrentUserId(session.user.id); fetchRooms(); fetchProfile(session.user.id); fetchAssignableStaff(); }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
    if ("Notification" in window) {
      notifRef.current = Notification.permission;
      setNotificationPermission(Notification.permission);
      if (Notification.permission==="granted") subscribeStaffToPush();
    } else {
      setNotificationPermission("unsupported");
    }
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlock = () => armAudioAlerts();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [armAudioAlerts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("inbox_auto_translate_incoming");
    if (stored === "0") setAutoTranslateIncoming(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("inbox_auto_translate_incoming", autoTranslateIncoming ? "1" : "0");
  }, [autoTranslateIncoming]);

  useEffect(() => {
    setTranslatedIncoming({});
    translationCacheRef.current = {};
  }, [lang]);

  useEffect(() => {
    if (!autoTranslateIncoming) return;
    const candidates = messages.filter(
      (entry) =>
        entry?.sender_type === "patient" &&
        entry?.message_type === "text" &&
        !entry?.deleted_by_staff &&
        !entry?.deleted_by_patient &&
        !entry?.is_internal &&
        !parseVideoCallMessage(entry?.content) &&
        !parseCallRequestMessage(entry?.content) &&
        `${entry?.content || ""}`.trim().length > 0 &&
        entry?.id
    );
    if (!candidates.length) return;

    let cancelled = false;
    const run = async () => {
      for (const message of candidates) {
        const key = translationKey(message.id, lang);
        if (translationCacheRef.current[key]) continue;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: message.content,
              targetLang: lang,
              sourceLang: "auto",
            }),
          });
          const json = await res.json();
          const translatedText = `${json?.translatedText || ""}`.trim();
          if (!translatedText || cancelled) continue;
          translationCacheRef.current[key] = translatedText;
          setTranslatedIncoming((prev) => ({ ...prev, [key]: translatedText }));
        } catch {
          // Silent fallback: keep original text.
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [autoTranslateIncoming, lang, messages, translationKey]);

  // --- Web Push subscription for staff ---
  const urlBase64ToUint8Array = (b64: string) => {
    const padding = "=".repeat((4-(b64.length%4))%4);
    const base64 = (b64+padding).replace(/-/g,"+").replace(/_/g,"/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  };

  const sendPushNotification = useCallback(async (payload: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    fetch("/api/push",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify(payload),
    }).catch(()=>{});
  }, []);

  const subscribeStaffToPush = async () => {
    try {
      if (!("serviceWorker" in navigator)||!("PushManager" in window)) return;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey) });
      const { data } = await supabase.auth.getSession();
      await syncPushSubscription({ subscription: sub.toJSON(), userType: "staff", accessToken: data.session?.access_token });
    } catch(_) {}
  };

  const requestStaffNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotificationFeedback({
        tone: "error",
        text: lang === "es" ? "Este navegador no soporta notificaciones." : "This browser does not support notifications.",
      });
      return;
    }

    setNotificationBusy(true);
    setNotificationFeedback(null);

    try {
      const permission = await Notification.requestPermission();
      notifRef.current = permission;
      setNotificationPermission(permission);

      if (permission === "granted") {
        await subscribeStaffToPush();
        setNotificationFeedback({
          tone: "success",
          text: lang === "es" ? "Alertas activadas en este dispositivo." : "Alerts are enabled on this device.",
        });
      } else if (permission === "denied") {
        setNotificationFeedback({
          tone: "error",
          text: lang === "es" ? "Las notificaciones están bloqueadas en este navegador." : "Notifications are blocked in this browser.",
        });
      } else {
        setNotificationFeedback({
          tone: "info",
          text: lang === "es" ? "Permiso pendiente. Vuelve a intentarlo cuando el navegador lo permita." : "Permission is still pending. Try again when the browser allows it.",
        });
      }
    } finally {
      setNotificationBusy(false);
    }
  }, [lang]);

  // --- Unread badge polling: check all rooms every 20s for new patient messages ---
  // Uses localStorage timestamps so badges survive page refresh
  const checkUnreadBadges = async () => {
    if (pauseBackgroundRefreshRef.current) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("room_id, created_at, content, message_type, file_name")
      .eq("sender_type", "patient")
      .eq("is_internal", false)
      .order("created_at", { ascending: false })
      .limit(400);
    if (!msgs) return;
    const nextCounts: Record<string, number> = {};
    const latestByRoom: Record<string, RoomMessageSummary> = {};
    for (const m of msgs) {
      const roomId = m.room_id;
      const lastSeen = localStorage.getItem(`last_seen_${roomId}`) || "0";
      if (m.created_at > lastSeen) nextCounts[roomId] = (nextCounts[roomId] || 0) + 1;
      if (!latestByRoom[roomId]) latestByRoom[roomId] = m;
    }
    setUnreadCounts(nextCounts);
    setLatestRoomMessages(latestByRoom);

    for (const [roomId, latestMessage] of Object.entries(latestByRoom)) {
      if (selectedRoomRef.current?.id === roomId && typeof document !== "undefined" && document.visibilityState === "visible") continue;
      const lastSeen = localStorage.getItem(`last_seen_${roomId}`) || "0";
      const lastAlert = localStorage.getItem(`last_alert_${roomId}`) || "0";
      const latestMessageKey = incomingMessageKey(latestMessage);
      const lastAlertedMessage = localStorage.getItem(alertMessageStorageKey(roomId)) || "";
      if (latestMessageKey && latestMessageKey === lastAlertedMessage) continue;
      const latestCreatedAt = latestMessage.created_at || "";
      if (latestCreatedAt > lastSeen && latestCreatedAt > lastAlert) {
        playIncomingTone();
        showToastAlert(roomId, roomPatientName(roomId), describeIncomingMessage(latestMessage));
        pushNotif(roomPatientName(roomId), describeIncomingMessage(latestMessage));
        localStorage.setItem(`last_alert_${roomId}`, latestCreatedAt);
        if (latestMessageKey) localStorage.setItem(alertMessageStorageKey(roomId), latestMessageKey);
      }
    }
  };

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id",id).single();
    if (data) {
      const phoneParts = splitPhoneNumber(data.phone);
      setUserProfile(data);
      setDisplayNameEdit(data.full_name||data.display_name||"");
      setPhoneCountryEdit(phoneParts.code);
      setPhoneLocalEdit(phoneParts.local);
      if (data.quick_replies?.length) setQuickReplies(data.quick_replies);
    }
  };

  const fetchUserLabels = useCallback(async () => {
    if (!currentUserId) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (token) {
      try {
        const response = await fetch("/api/labels", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload?.labels)) {
          setUserLabels(payload.labels as PatientLabel[]);
          return;
        }
      } catch {
        // Fall back to direct reads below for older local environments.
      }
    }

    let query = await supabase.from("labels").select("*").eq("user_id", currentUserId).order("created_at", { ascending: true });
    if (query.error && isMissingColumnError(query.error)) query = await supabase.from("labels").select("*").eq("created_by", currentUserId).order("created_at", { ascending: true });
    if (!query.error) setUserLabels((query.data || []) as PatientLabel[]);
  }, [currentUserId]);

  const createPatientLabel = async () => {
    const name = newLabelName.trim();
    if (!currentUserId || !name || savingLabel) return;
    setSavingLabel(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (token) {
      try {
        const response = await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, name_es: name, name_en: name, color: newLabelColor }),
        });
        const payload = await response.json().catch(() => ({}));
        setSavingLabel(false);
        if (!response.ok || !payload?.label) {
          alert(payload?.error || (lang === "es" ? "No pude crear la etiqueta." : "I could not create the label."));
          return;
        }
        setUserLabels((current) => [...current, payload.label as PatientLabel]);
        setNewLabelName("");
        return;
      } catch {
        // Fall back to direct insert below for older local environments.
      }
    }

    let insert = await supabase.from("labels").insert({ user_id: currentUserId, name_es: name, name_en: name, name, color: newLabelColor, scope: "patient", created_by: currentUserId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select("*").single();
    if (insert.error && isMissingColumnError(insert.error)) insert = await supabase.from("labels").insert({ name, color: newLabelColor, scope: "patient", created_by: currentUserId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select("*").single();
    setSavingLabel(false);
    if (insert.error) {
      alert(insert.error.message || (lang === "es" ? "No pude crear la etiqueta." : "I could not create the label."));
      return;
    }
    if (insert.data) setUserLabels((current) => [...current, insert.data as PatientLabel]);
    setNewLabelName("");
  };

  const startEditingPatientLabel = (label: PatientLabel) => {
    setEditingLabelId(label.id);
    setEditingLabelName(labelName(label));
    setEditingLabelColor(label.color || "#EF4444");
  };

  const cancelEditingPatientLabel = () => {
    setEditingLabelId("");
    setEditingLabelName("");
    setEditingLabelColor("#EF4444");
  };

  const updatePatientLabel = async (labelId: string) => {
    const name = editingLabelName.trim();
    if (!currentUserId || !labelId || !name || savingLabelAction) return;
    setSavingLabelAction(`edit-${labelId}`);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    let updatedLabel: PatientLabel | null = null;
    let errorMessage = "";

    if (token) {
      try {
        const response = await fetch("/api/labels", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ labelId, name, name_es: name, name_en: name, color: editingLabelColor }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload?.label) updatedLabel = payload.label as PatientLabel;
        else errorMessage = payload?.error || "";
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "";
      }
    } else {
      let update = await supabase
        .from("labels")
        .update({ name, name_es: name, name_en: name, color: editingLabelColor, updated_at: new Date().toISOString() })
        .eq("id", labelId)
        .eq("user_id", currentUserId)
        .select("*")
        .single();
      if (update.error && isMissingColumnError(update.error)) {
        update = await supabase
          .from("labels")
          .update({ name, color: editingLabelColor })
          .eq("id", labelId)
          .eq("created_by", currentUserId)
          .select("*")
          .single();
      }
      if (update.error) errorMessage = update.error.message || "";
      else updatedLabel = update.data as PatientLabel;
    }

    setSavingLabelAction("");
    if (!updatedLabel) {
      alert(errorMessage || (lang === "es" ? "No pude editar la etiqueta." : "I could not edit the label."));
      return;
    }
    setUserLabels((current) => current.map((label) => (label.id === labelId ? { ...label, ...updatedLabel } : label)));
    if (activeLabelFilter === labelId) setActiveLabelFilter(labelId);
    cancelEditingPatientLabel();
  };

  const deletePatientLabel = async (label: PatientLabel) => {
    if (!currentUserId || savingLabelAction) return;
    const confirmed = window.confirm(
      lang === "es"
        ? `¿Eliminar la etiqueta "${labelName(label)}"? Se quitará de los pacientes donde esté asignada.`
        : `Delete "${labelName(label)}"? It will be removed from assigned patients.`
    );
    if (!confirmed) return;

    setSavingLabelAction(`delete-${label.id}`);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    let errorMessage = "";

    if (token) {
      try {
        const response = await fetch(`/api/labels?labelId=${encodeURIComponent(label.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) errorMessage = payload?.error || "";
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "";
      }
    } else {
      let removed = await supabase.from("labels").delete().eq("id", label.id).eq("user_id", currentUserId);
      if (removed.error && isMissingColumnError(removed.error)) removed = await supabase.from("labels").delete().eq("id", label.id).eq("created_by", currentUserId);
      if (removed.error) errorMessage = removed.error.message || "";
    }

    setSavingLabelAction("");
    if (errorMessage) {
      alert(errorMessage || (lang === "es" ? "No pude borrar la etiqueta." : "I could not delete the label."));
      return;
    }

    setUserLabels((current) => current.filter((entry) => entry.id !== label.id));
    if (activeLabelFilter === label.id) setActiveLabelFilter("");
    if (editingLabelId === label.id) cancelEditingPatientLabel();
    setPatients((current) => current.map((patient) => {
      const value = patient.labels;
      if (!value || typeof value !== "object" || Array.isArray(value)) return patient;
      const nextForUser = Array.isArray(value[currentUserId]) ? value[currentUserId].filter((id: string) => id !== label.id) : [];
      return { ...patient, labels: { ...value, [currentUserId]: nextForUser } };
    }));
    setSelectedRoom((room: any) => {
      const patient = room?.procedures?.patients;
      const value = patient?.labels;
      if (!room || !value || typeof value !== "object" || Array.isArray(value)) return room;
      const nextForUser = Array.isArray(value[currentUserId]) ? value[currentUserId].filter((id: string) => id !== label.id) : [];
      return {
        ...room,
        procedures: {
          ...room.procedures,
          patients: {
            ...patient,
            labels: { ...value, [currentUserId]: nextForUser },
          },
        },
      };
    });
  };

  const updatePatientLabels = async (patientToUpdate: any, roomId: string | undefined, nextLabelIds: string[]) => {
    if (!patientToUpdate?.id || !currentUserId) return false;
    const currentValue = patientToUpdate.labels;
    const nextLabels =
      currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
        ? { ...currentValue, [currentUserId]: nextLabelIds }
        : { [currentUserId]: nextLabelIds };
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    let error: { message?: string } | null = null;
    let savedLabels = nextLabels;
    let savedViaLabelRows = false;
    if (token) {
      try {
        const response = await fetch("/api/labels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ patientId: patientToUpdate.id, roomId, labelIds: nextLabelIds }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) error = { message: payload?.error };
        else if (payload?.labels) savedLabels = payload.labels;
        if (response.ok && payload?.assignmentStore === "labels") savedViaLabelRows = true;
      } catch (requestError) {
        error = { message: requestError instanceof Error ? requestError.message : "" };
      }
    } else {
      const result = await supabase.from("patients").update({ labels: nextLabels }).eq("id", patientToUpdate.id);
      error = result.error;
    }
    if (error) {
      alert(error.message || (lang === "es" ? "No pude guardar etiquetas." : "I could not save labels."));
      return false;
    }
    setUserLabels((current) => current.map((label) => {
      const assignedIds = new Set((label.assigned_patient_ids || []).map(String).filter(Boolean));
      if (nextLabelIds.includes(label.id)) assignedIds.add(patientToUpdate.id);
      else assignedIds.delete(patientToUpdate.id);
      return { ...label, assigned_patient_ids: Array.from(assignedIds) };
    }));
    setPatients((current) => current.map((patient) => {
      if (patient.id !== patientToUpdate.id) return patient;
      return savedViaLabelRows ? patient : { ...patient, labels: savedLabels };
    }));
    setSelectedRoom((room: any) => room ? {
      ...room,
      procedures: {
        ...room.procedures,
        patients: room.procedures?.patients?.id !== patientToUpdate.id || savedViaLabelRows ? room.procedures?.patients : {
          ...room.procedures?.patients,
          labels: savedLabels,
        },
      },
    } : room);
    return true;
  };

  const updateSelectedPatientLabels = async (nextLabelIds: string[]) => {
    await updatePatientLabels(selectedPatient, selectedRoom?.id, nextLabelIds);
  };

  const toggleSelectedPatientLabel = (labelId: string) => {
    const next = selectedPatientLabelSet.has(labelId)
      ? selectedPatientLabelIds.filter((id) => id !== labelId)
      : [...selectedPatientLabelIds, labelId];
    updateSelectedPatientLabels(next);
  };

  const toggleLabelForPatient = async (patient: any, labelId: string) => {
    const currentIds = patientLabelIdsFor(patient);
    const next = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];
    const roomId = patient?.rooms?.[0]?.id || "";
    await updatePatientLabels(patient, roomId, next);
  };

  const fetchAssignableStaff = async () => {
    let list: CareTeamMember[] = [];
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";

    if (token) {
      try {
        const response = await fetch("/api/staff/directory", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload?.staff)) list = payload.staff as CareTeamMember[];
      } catch {
        // Fall back to the client-visible profile rows below.
      }
    }

    if (list.length === 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, role, office_location, avatar_url, phone")
        .order("full_name", { ascending: true });
      list = (data || []) as CareTeamMember[];
    }

    const fallback = userProfile?.id ? [{
      id: userProfile.id,
      full_name: userProfile.full_name || userProfile.display_name || "Staff",
      display_name: userProfile.display_name || null,
      role: userProfile.role || "staff",
      office_location: userProfile.office_location || null,
      avatar_url: userProfile.avatar_url || null,
      phone: userProfile.phone || null,
      email: userProfile.email || null,
    }] : [];
    const merged = [...list];
    fallback.forEach((entry) => {
      if (!merged.some((member) => member.id === entry.id)) merged.unshift(entry);
    });
    setStaffDirectory(sortCareTeamMembers(merged));
  };

  const fetchSelectedRoomTeam = async (roomId: string) => {
    const { data: members, error } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId);

    if (error || !members?.length) {
      setSelectedRoomTeam([]);
      return;
    }

    const memberIds = Array.from(new Set(members.map((entry: any) => entry.user_id).filter(Boolean)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, role, office_location, avatar_url, phone")
      .in("id", memberIds);

    setSelectedRoomTeam((profiles || []) as CareTeamMember[]);
  };

  const saveQuickReplies = useCallback(async (replies: QuickReply[]) => {
    setQuickReplies(replies);
    if (userProfile?.id) {
      setSavingQR(true);
      await supabase.from("profiles").update({ quick_replies: replies }).eq("id",userProfile.id);
      setSavingQR(false); setSavedQR(true); setTimeout(()=>setSavedQR(false),2000);
    }
  }, [userProfile?.id]);

  const saveDisplayName = async () => {
    if (!userProfile?.id||!displayNameEdit.trim()) return;
    setSavingName(true);
    await supabase.from("profiles").update({ full_name: displayNameEdit.trim(), display_name: displayNameEdit.trim() }).eq("id",userProfile.id);
    setUserProfile((p: any)=>({...p,full_name:displayNameEdit.trim(),display_name:displayNameEdit.trim()}));
    setSavingName(false); setSavedName(true); setTimeout(()=>setSavedName(false),2000);
  };

  const saveProfilePhone = async () => {
    if (!userProfile?.id) return;
    const cleanPhone = phoneEdit.trim();
    setSavingPhone(true);
    const { error } = await supabase.from("profiles").update({ phone: cleanPhone || null }).eq("id", userProfile.id);
    setSavingPhone(false);
    if (error) {
      alert(lang === "es" ? "No pude guardar el teléfono." : "I could not save the phone number.");
      return;
    }
    setUserProfile((p: any)=>({...p,phone:cleanPhone || null}));
    setStaffDirectory((previous) => previous.map((member) => member.id === userProfile.id ? { ...member, phone: cleanPhone || null } : member));
    setSavedPhone(true);
    setTimeout(()=>setSavedPhone(false),2000);
  };

  const uploadProfilePhoto = async (file: File) => {
    if (!userProfile?.id) return;
    const fn = `profile-photos/${userProfile.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-files").upload(fn, file);
    if (!error) { const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn); await supabase.from("profiles").update({ avatar_url: ud.publicUrl }).eq("id",userProfile.id); setUserProfile((p: any)=>({...p,avatar_url:ud.publicUrl})); }
  };

  useEffect(()=>{ selectedRoomRef.current=selectedRoom; },[selectedRoom]);
  useEffect(()=>{ showStaffChatsRef.current=showStaffChats; },[showStaffChats]);
  useEffect(()=>{ activeStaffChatPeerIdRef.current=activeStaffChatPeerId; },[activeStaffChatPeerId]);
  useEffect(()=>{ activeStaffRoomIdRef.current=activeStaffRoomId; },[activeStaffRoomId]);
  useEffect(() => {
    if (!privateToast) return;
    if (privateToastTimeoutRef.current) clearTimeout(privateToastTimeoutRef.current);
    privateToastTimeoutRef.current = setTimeout(() => setPrivateToast(null), 9000);
    return () => {
      if (privateToastTimeoutRef.current) clearTimeout(privateToastTimeoutRef.current);
    };
  }, [privateToast]);

  useEffect(() => {
    if (!selectedRoom?.id) {
      if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);
      if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
      setPatientTyping(false);
      typingChannelRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`chat-signals:${selectedRoom.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.senderType !== "patient") return;
        if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);

        if (!payload?.isTyping) {
          setPatientTyping(false);
          return;
        }

        setPatientTyping(true);
        remoteTypingTimeoutRef.current = setTimeout(() => {
          setPatientTyping(false);
        }, 2600);
      });

    typingChannelRef.current = channel;
    channel.subscribe();

    return () => {
      if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);
      if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
      if (outgoingTypingRef.current) {
        channel.send({
          type: "broadcast",
          event: "typing",
          payload: {
            roomId: selectedRoom.id,
            senderType: "staff",
            name: userProfile?.full_name || userProfile?.display_name || "Staff",
            isTyping: false,
            sentAt: new Date().toISOString(),
          },
        }).catch(() => {});
      }
      typingChannelRef.current = null;
      setPatientTyping(false);
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, userProfile?.display_name, userProfile?.full_name]);

  useEffect(() => {
    if (currentUserId) fetchAssignableStaff();
  }, [currentUserId, userProfile]);

  useEffect(() => {
    fetchUserLabels();
  }, [fetchUserLabels]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchStaffPrivateMessages();

    const handlePrivateMessage = (message: StaffPrivateMessage) => {
      if (!message?.id) return;
      upsertStaffPrivateMessage(message);
      const roomPayload = parseStaffRoomPayload(message.content);
      const peerId = message.sender_id === currentUserId ? message.recipient_id || "" : message.sender_id || "";
      const incoming = message.recipient_id === currentUserId && message.sender_id !== currentUserId;

      if (incoming) {
        const isOpenRoom = !!roomPayload && showStaffChatsRef.current && activeStaffRoomIdRef.current === roomPayload.roomId;
        const isOpenConversation = !roomPayload && showStaffChatsRef.current && activeStaffChatPeerIdRef.current === peerId;
        if (isOpenConversation) {
          markStaffPrivateConversationRead(peerId);
        } else if (isOpenRoom) {
          const readAt = new Date().toISOString();
          setStaffPrivateMessages((previous) => previous.map((entry) => entry.id === message.id ? { ...entry, read_at: readAt } : entry));
          supabase.from("staff_private_messages").update({ read_at: readAt }).eq("id", message.id).then(() => {});
        } else {
          playIncomingTone();
          setPrivateToast(message);
          pushNotif(
            roomPayload ? (lang === "es" ? "Chat staff" : "Staff chat") : (lang === "es" ? "Mensaje privado del equipo" : "Private staff message"),
            roomPayload
              ? `${roomPayload.roomName}: ${roomPayload.text.slice(0, 120)}`
              : `${message.sender_name || (lang === "es" ? "Personal" : "Staff")}: ${`${message.content || ""}`.slice(0, 120)}`
          );
        }
      }
    };

    const channel = supabase
      .channel(`staff-private-messages:${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_private_messages", filter: `recipient_id=eq.${currentUserId}` }, ({ new: message }) => handlePrivateMessage(message as StaffPrivateMessage))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_private_messages", filter: `sender_id=eq.${currentUserId}` }, ({ new: message }) => handlePrivateMessage(message as StaffPrivateMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "staff_private_messages", filter: `recipient_id=eq.${currentUserId}` }, ({ new: message }) => upsertStaffPrivateMessage(message as StaffPrivateMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "staff_private_messages", filter: `sender_id=eq.${currentUserId}` }, ({ new: message }) => upsertStaffPrivateMessage(message as StaffPrivateMessage))
      .subscribe();
    const interval = window.setInterval(fetchStaffPrivateMessages, 30000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchStaffPrivateMessages, lang, markStaffPrivateConversationRead, playIncomingTone, pushNotif, upsertStaffPrivateMessage]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchMediaNotificationCounts();

    const channel = supabase
      .channel(`media-notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media_notifications", filter: `staff_id=eq.${currentUserId}` },
        ({ new: notification }) => registerIncomingMediaNotification(notification as MediaNotification)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchMediaNotificationCounts, registerIncomingMediaNotification]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchPendingPatientAlerts();

    const channel = supabase
      .channel(`patient-alerts:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patient_alerts" },
        ({ new: alert }) => registerIncomingPatientAlert(alert as PatientAlert)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patient_alerts" },
        ({ new: alert }) => registerIncomingPatientAlert(alert as PatientAlert)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "patient_alerts" },
        ({ old: alert }) => {
          const roomId = `${(alert as PatientAlert)?.chat_id || ""}`.trim();
          if (!roomId) return;
          setPendingAlertRoomIds((current) => {
            if (!current.has(roomId)) return current;
            const next = new Set(current);
            next.delete(roomId);
            return next;
          });
          setPendingAlertLevels((current) => {
            if (!(roomId in current)) return current;
            const next = { ...current };
            delete next[roomId];
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchPendingPatientAlerts, registerIncomingPatientAlert]);

  useEffect(() => {
    if (showNewRoom && currentUserId) {
      setSelectedCareTeamIds((current) => current.includes(currentUserId) ? current : [currentUserId, ...current]);
    }
  }, [showNewRoom, currentUserId]);

  useEffect(() => {
    setManagedTeamIds(selectedRoomTeam.map((member) => member.id));
  }, [selectedRoomTeam]);

  useEffect(() => {
    return () => {
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(()=>{
    const ch = supabase.channel("rt-msgs")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},({new:m})=>{
        if (m.sender_type==="patient") {
          setPatientTyping(false);
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
          registerIncomingPatientMessage(m, { skipUnread: selectedRoomRef.current?.id===m.room_id && typeof document !== "undefined" && document.visibilityState === "visible" });
        }
        if (m.sender_type === "staff" && m.is_internal && m.sender_id && m.sender_id !== currentUserId) {
          registerIncomingInternalNote(m);
        }
        if (selectedRoomRef.current?.id===m.room_id) {
          setMessages(prev=>{
            const ti=prev.findIndex(x=>typeof x.id==="string"&&x.id.startsWith("temp-")&&x.content===m.content&&x.sender_type===m.sender_type);
            if (ti!==-1){const u=[...prev];u[ti]=m;return u;}
            if (prev.some(x=>x.id===m.id)) return prev;
            return [...prev,m];
          });
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},({new:m})=>{ if (selectedRoomRef.current?.id===m.room_id) setMessages(p=>p.map(x=>x.id===m.id?m:x)); })
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[currentUserId, registerIncomingInternalNote, registerIncomingPatientMessage]);

  useEffect(() => {
    const activeRoomId = selectedRoomRef.current?.id;
    const filteredEntries = Object.entries(unreadCounts).filter(([roomId, count]) => count > 0 && roomId !== activeRoomId);
    setUnreadRooms(new Set(filteredEntries.map(([roomId]) => roomId)));
    setTotalUnread(filteredEntries.reduce((sum, [, count]) => sum + count, 0));
  }, [unreadCounts]);

  useEffect(()=>{
    const totalAlerts = totalUnread + staffPrivateUnread;
    document.title=totalAlerts>0?`(${totalAlerts}) Dr. Fonseca Portal`:"Dr. Fonseca Portal";
  },[staffPrivateUnread, totalUnread]);

  // Poll for unread badges every 20s and on tab focus
  useEffect(()=>{
    checkUnreadBadges();
    const interval = setInterval(checkUnreadBadges, 2000);
    const onVisible = () => { if (document.visibilityState==="visible") checkUnreadBadges(); };
    document.addEventListener("visibilitychange", onVisible);
    return ()=>{ clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  },[]);

  useEffect(() => {
    fetchMediaNotificationCounts();
  }, [fetchMediaNotificationCounts]);

  useEffect(()=>{
    if (selectedRoom) {
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      lastMessageCountRef.current = 0;
      fetchMessages(selectedRoom.id);
      fetchSelectedRoomTeam(selectedRoom.id);
      setMobileView("chat");
      markRoomAsRead(selectedRoom.id);
      markMediaNotificationsSeen(selectedRoom.procedures?.patients?.id);
    }
  },[markMediaNotificationsSeen, markRoomAsRead, selectedRoom]);

  useEffect(() => {
    if (showPatientInfo && selectedRoom) {
      markMediaNotificationsSeen(selectedRoom.procedures?.patients?.id);
    }
  }, [markMediaNotificationsSeen, selectedRoom, showPatientInfo]);

  // Fallback: refresh sidebar/messages frequently in case realtime drops events on mobile or background tabs
  useEffect(()=>{
    const refresh = () => {
      if (pauseBackgroundRefreshRef.current) return;
      fetchRooms();
      if (selectedRoomRef.current) fetchMessages(selectedRoomRef.current.id);
    };
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState==="visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refresh, 2000);
    return ()=>{ window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); clearInterval(interval); };
  },[]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  useEffect(() => {
    pauseBackgroundRefreshRef.current = showSettings || showStaffChats || showPatientInfo || showNewRoom || showQREditor;
  }, [showNewRoom, showPatientInfo, showQREditor, showSettings, showStaffChats]);

  useEffect(() => {
    const previousCount = lastMessageCountRef.current;
    const hasInitialMessages = previousCount === 0 && messages.length > 0;
    const hasNewMessages = messages.length > previousCount;
    const latestMessage = messages[messages.length - 1];
    const latestIsStaffMessage = latestMessage?.sender_type === "staff";
    const shouldScroll =
      hasInitialMessages ||
      (hasNewMessages && (shouldAutoScrollRef.current || latestIsStaffMessage));

    if (shouldScroll) {
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: hasInitialMessages ? "auto" : "smooth" });
      });
    } else if (hasNewMessages) {
      setShowJumpToLatest(true);
    }

    lastMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (captureMode && mediaCaptureVideoRef.current && captureStreamRef.current) {
      mediaCaptureVideoRef.current.srcObject = captureStreamRef.current;
      mediaCaptureVideoRef.current.play().catch(() => {});
    }
  }, [captureMode]);

  useEffect(() => {
    if (!callOverlayOpen) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      const serialized =
        typeof data === "string"
          ? data
          : (() => {
              try { return JSON.stringify(data); } catch { return ""; }
            })();
      const marker = serialized.toLowerCase();
      if (marker.includes("videoconferenceleft") || marker.includes("readytoclose") || marker.includes("hangup")) {
        closeCallOverlay().catch(() => {});
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [callOverlayOpen]);

  const fetchRooms = async () => {
    const extendedSelect = "*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, email, profile_picture_url, birthdate, preferred_language, timezone, allergies, current_medications, labels))";
    const fallbackSelect = "*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, profile_picture_url, birthdate))";
    const query = await supabase.from("rooms").select(extendedSelect).order("created_at",{ascending:false});
    let data = query.data;
    let error = query.error;

    if (error && isMissingColumnError(error)) {
      const fallbackQuery = await supabase.from("rooms").select(fallbackSelect).order("created_at",{ascending:false});
      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (!error&&data) { const pm: Record<string,any>={}; data.forEach(r=>{const p=r.procedures?.patients;if(!p)return;if(!pm[p.id])pm[p.id]={...p,rooms:[]};pm[p.id].rooms.push(r);}); setPatients(Object.values(pm)); }
    setLoading(false);
  };

  const patientRoomLink = (room: any) => {
    if (!room?.id || typeof window === "undefined") return "";
    const token = `${room.patient_access_token || ""}`.trim();
    return `${window.location.origin}/patient/${room.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  };
  const ensurePatientRoomLink = async () => {
    if (!selectedRoom) return "";
    if (`${selectedRoom.patient_access_token || ""}`.trim()) return patientRoomLink(selectedRoom);
    const nextToken = createPatientAccessToken();
    const { error } = await supabase.from("rooms").update({ patient_access_token: nextToken }).eq("id", selectedRoom.id);
    if (error) return patientRoomLink(selectedRoom);
    const nextRoom = { ...selectedRoom, patient_access_token: nextToken };
    setSelectedRoom(nextRoom);
    setPatients((current:any[]) => current.map((patient:any) => ({
      ...patient,
      rooms: (patient.rooms || []).map((room:any) => room.id === selectedRoom.id ? nextRoom : room),
    })));
    return patientRoomLink(nextRoom);
  };
  const copyPatientRoomLink = async () => {
    const link = await ensurePatientRoomLink();
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    alert(t.patientLinkCopied);
  };
  const sharePatientRoomLink = async () => {
    const link = await ensurePatientRoomLink();
    if (!link) return;
    if (navigator.share) await navigator.share({ title: t.patientAccessLink, text: t.patientAccessLinkHint, url: link });
    else await copyPatientRoomLink();
  };
  const messagePatientRoomLink = async () => {
    const link = await ensurePatientRoomLink();
    if (!link) return;
    window.location.href = `sms:?&body=${encodeURIComponent(link)}`;
  };

  const fetchMessages = async (roomId: string) => { const { data } = await supabase.from("messages").select("*").eq("room_id",roomId).order("created_at",{ascending:true}); setMessages(data||[]); };

  const sendMessage = async (content?: string) => {
    const msg=(content||newMessage).trim();
    if (!msg||!selectedRoom||isSending.current) return;
    updateTypingState("", selectedRoom.id);
    isSending.current=true; setSending(true);
    if (!content) setComposerText("");
    setShowSlashMenu(false);
    const sName=userProfile?.full_name||userProfile?.display_name||"Staff";
    const sRole=userProfile?.role||"staff";
    const sOffice=userProfile?.office_location||selectedRoom?.procedures?.office_location||null;
    const tempId="temp-"+Date.now();
    setMessages(p=>[...p,{id:tempId,room_id:selectedRoom.id,content:msg,message_type:"text",sender_type:"staff",sender_name:sName,sender_role:sRole,created_at:new Date().toISOString()}]);
    const { data: nm, error } = await supabase.from("messages").insert({room_id:selectedRoom.id,content:msg,message_type:"text",sender_type:"staff",sender_id:currentUserId||null,sender_name:sName,sender_role:sRole,sender_office:sOffice}).select().single();
    if (error) setMessages(p=>p.filter(m=>m.id!==tempId));
    else if (nm) setMessages(p=>p.map(m=>m.id===tempId?nm:m));
    // Push notification to patient — works even if their PWA is closed
    sendPushNotification({
      roomId:selectedRoom.id, userType:"patient",
      title: sName, body: msg.length>80?msg.slice(0,80)+"…":msg,
      url: window.location.href, tag: selectedRoom.id,
    });
    isSending.current=false; setSending(false);
  };

  const updateStaffMessage = async () => {
    const next = editingMessageText.trim();
    if (!editingMessage || !next) return;
    const messageId = editingMessage.id;
    setMessages((prev) => prev.map((entry) => (entry.id === messageId ? { ...entry, content: next } : entry)));
    setEditingMessage(null);
    setEditingMessageText("");
    setActiveMessageAction(null);
    const { error } = await supabase
      .from("messages")
      .update({ content: next })
      .eq("id", messageId)
      .eq("sender_id", currentUserId || "");
    if (error) fetchMessages(selectedRoom?.id || "");
  };

  const deleteStaffMessage = async (messageId: string) => {
    const deletedAt = new Date().toISOString();
    setActiveMessageAction(null);
    setPressedMsgId(null);
    setMessages((prev) => prev.map((entry) => (entry.id === messageId ? { ...entry, deleted_by_staff: true, deleted_at: deletedAt } : entry)));
    await supabase
      .from("messages")
      .update({ deleted_by_staff: true, deleted_at: deletedAt })
      .eq("id", messageId)
      .eq("sender_id", currentUserId || "");
  };

  const postSystemMessage = async (roomId: string, text: string) => {
    if (!roomId || !text.trim()) return;
    const tempId = "temp-system-" + Date.now();
    const tempMessage = {
      id: tempId,
      room_id: roomId,
      content: text,
      message_type: "text",
      sender_type: "staff",
      sender_name: "Sistema",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        room_id: roomId,
        content: text,
        message_type: "text",
        sender_type: "staff",
        sender_id: currentUserId || null,
        sender_name: "Sistema",
        sender_role: userProfile?.role || "staff",
      })
      .select()
      .single();
    if (error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      return;
    }
    if (data) {
      setMessages((prev) => prev.map((entry) => (entry.id === tempId ? data : entry)));
    }
  };

  const openCallOverlay = (url: string, providerRoomName: string) => {
    setActiveCallUrl(url);
    setActiveCallRoomName(providerRoomName);
    setCallOverlayOpen(true);
    setCallInviteFeedback("");
  };

  const getVideoCallFeedback = (error: unknown) => {
    const fallback = lang === "es" ? "La videollamada no está disponible por ahora." : "Video call is unavailable right now.";
    if (!(error instanceof Error)) return fallback;
    const message = `${error.message || ""}`.trim();
    if (!message) return fallback;
    if (message.includes("DAILY_API_KEY")) return fallback;
    return message;
  };

  const joinVideoCall = async (providerRoomName: string) => {
    if (!selectedRoom?.id) return;
    try {
      const actorName = userProfile?.full_name || userProfile?.display_name || "Staff";
      const response = await fetch("/api/video/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          providerRoomName,
          actorType: "staff",
          actorName,
        }),
      });
      const json = await response.json();
      const joinUrl = `${json?.joinUrl || ""}`.trim();
      if (!response.ok || !joinUrl) {
        throw new Error(json?.error || t.videoCallOpenError);
      }
      openCallOverlay(joinUrl, providerRoomName);
    } catch (error) {
      setCallInviteFeedback(getVideoCallFeedback(error));
      window.setTimeout(() => setCallInviteFeedback(""), 2600);
    }
  };

  const closeCallOverlay = async () => {
    const roomId = selectedRoom?.id;
    setCallOverlayOpen(false);
    setActiveCallUrl(null);
    setActiveCallRoomName(null);
    if (roomId) {
      const now = new Date();
      const time = now.toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
      await postSystemMessage(roomId, `📴 ${t.callEndedNote} · ${time}`);
    }
  };

  const shareCallInvite = async (providerRoomName: string) => {
    try {
      if (!selectedRoom?.id) throw new Error("room-missing");
      const actorName = userProfile?.full_name || userProfile?.display_name || "Staff";
      const response = await fetch("/api/video/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          providerRoomName,
          actorType: "staff",
          actorName,
        }),
      });
      const json = await response.json();
      const joinUrl = `${json?.joinUrl || ""}`.trim();
      if (!response.ok || !joinUrl) throw new Error(json?.error || t.videoCallOpenError);

      if (navigator.share) {
        await navigator.share({ title: t.videoCallInvite, text: t.videoCallInviteBody, url: joinUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        throw new Error("clipboard-unavailable");
      }
      setCallInviteFeedback(t.inviteCopied);
      window.setTimeout(() => setCallInviteFeedback(""), 1800);
    } catch {
      setCallInviteFeedback(t.videoCallOpenError);
      window.setTimeout(() => setCallInviteFeedback(""), 2200);
    }
  };

  const startVideoCall = async () => {
    if (!selectedRoom || isSending.current) return;
    updateTypingState("", selectedRoom.id);
    isSending.current = true;
    setSending(true);

    const providerRoomName = buildProviderRoomName(selectedRoom.id);
    const messageContent = buildVideoCallMessage(providerRoomName);
    const sName = userProfile?.full_name || userProfile?.display_name || "Staff";
    const sRole = userProfile?.role || "staff";
    const sOffice = userProfile?.office_location || selectedRoom?.procedures?.office_location || null;
    const tempId = "temp-call-" + Date.now();
    const tempMessage = {
      id: tempId,
      room_id: selectedRoom.id,
      content: messageContent,
      message_type: "text",
      sender_type: "staff",
      sender_name: sName,
      sender_role: sRole,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        room_id: selectedRoom.id,
        content: messageContent,
        message_type: "text",
        sender_type: "staff",
        sender_id: currentUserId || null,
        sender_name: sName,
        sender_role: sRole,
        sender_office: sOffice,
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      isSending.current = false;
      setSending(false);
      alert(error.message || t.videoCallOpenError);
      return;
    }

    if (inserted) {
      setMessages((prev) => prev.map((entry) => (entry.id === tempId ? inserted : entry)));
    }

    sendPushNotification({
        roomId: selectedRoom.id,
        userType: "patient",
        title: sName,
        body: t.videoCallInvite,
        url: window.location.href,
        tag: selectedRoom.id,
    });
    await joinVideoCall(providerRoomName);
    isSending.current = false;
    setSending(false);
  };

  const confirmUpload = async (cat: FileCategory) => { if (!pendingFile) return; setShowUploadMenu(false); await uploadFile(pendingFile,cat); setPendingFile(null); };
  const stagePreview = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewType(
      file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "file",
    );
  };
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewType("file");
  };
  const sendPreview = async () => {
    if (!previewFile) return;
    const file = previewFile;
    clearPreview();
    await uploadFile(file);
  };

  const uploadFile = async (file: File, cat: FileCategory="general", folderLabel = "") => {
    if (!selectedRoom) return; setSending(true);
    try {
      const sName=userProfile?.full_name||userProfile?.display_name||"Staff";
      const sRole=userProfile?.role||"staff";
      const sOffice=userProfile?.office_location||selectedRoom?.procedures?.office_location||null;
      const patientId = selectedRoom?.procedures?.patients?.id || selectedRoom.id;
      const notificationPatientId = selectedRoom?.procedures?.patients?.id || null;
      const mediaFolder =
        cat === "before_photo"
          ? "pre-op-photos"
          : cat === "medication"
            ? "prescriptions"
            : file.type.startsWith("image/")
              ? "patient-photos"
              : "chat-files";
      const fn=`patients/${patientId}/${mediaFolder}/uploaded-by-${safeStorageSegment(sName)}/${Date.now()}-${safeStorageSegment(file.name)}`;
      const { error: ue } = await supabase.storage.from("chat-files").upload(fn,file);
      if (ue){setSending(false);return;}
      const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn);
      let mt="file";
      if (file.type.startsWith("image/")) mt="image";
      else if (file.type.startsWith("video/")) mt="video";
      else if (file.type.startsWith("audio/")) mt="audio";
      const prefix=cat==="medication"?"[MED] ":cat==="before_photo"?"[BEFORE] ":"";
      const displayFileName = cat==="medication" ? `${prefix}${folderLabel.trim() || file.name}` : `${prefix}${file.name}`;
      const tempId="temp-file-"+Date.now();
      setMessages(p=>[...p,{id:tempId,room_id:selectedRoom.id,content:ud.publicUrl,message_type:mt,file_name:displayFileName,file_size:file.size,sender_type:"staff",sender_name:sName,sender_role:sRole,created_at:new Date().toISOString()}]);
      const { data: nm } = await supabase.from("messages").insert({room_id:selectedRoom.id,content:ud.publicUrl,message_type:mt,file_name:displayFileName,file_size:file.size,sender_type:"staff",sender_id:currentUserId||null,sender_name:sName,sender_role:sRole,sender_office:sOffice}).select().single();
      if (nm) setMessages(p=>p.map(m=>m.id===tempId?nm:m));
      else setMessages(p=>p.filter(m=>m.id!==tempId));
      if (mt === "image" || mt === "video") {
        await supabase.from("media_uploads").insert({
          patient_id: patientId,
          room_id: selectedRoom.id,
          message_id: nm?.id || null,
          uploaded_by: currentUserId || null,
          staff_name: sName,
          type: mt === "image" ? "photo" : "video",
          url: ud.publicUrl,
          created_at: new Date().toISOString(),
        }).then(() => undefined);
      }
      if (nm && isMediaMessage(nm)) {
        const patientRoomIds = notificationPatientId
          ? patients.find((patient) => patient.id === notificationPatientId)?.rooms?.map((room: any) => room.id).filter(Boolean) || [selectedRoom.id]
          : [selectedRoom.id];
        const { data: members } = await supabase
          .from("room_members")
          .select("user_id")
          .in("room_id", patientRoomIds);
        const patientName = selectedRoom.procedures?.patients?.full_name || t.patientLabel;
        const notificationMessage = `Nuevo archivo agregado por ${sName} para ${patientName}`;
        const createdAt = new Date().toISOString();
        const rows = Array.from(new Set((members || []).map((member: any) => member.user_id).filter(Boolean)))
          .filter((staffId) => staffId !== currentUserId)
          .map((staffId) => ({
            patient_id: notificationPatientId,
            room_id: selectedRoom.id,
            message_id: nm.id,
            staff_id: staffId,
            recipient_id: staffId,
            sender_id: currentUserId || null,
            media_type: mt,
            message: notificationMessage,
            seen: false,
            status: "unread",
            created_at: createdAt,
          }));
        if (rows.length) {
          const { error: notificationError } = await supabase.from("media_notifications").insert(rows);
          if (notificationError) console.error("media_notifications insert failed", notificationError);
        }
      }
      if (cat === "medication") {
        setMediaLibraryTab("docs");
        setShowMediaLibrary(true);
      }
    } catch(e){console.error(e);}
    setSending(false);
  };

  const saveInternalNote = async () => {
    if (!selectedRoom || !internalNoteDraft.trim() || savingInternalNote) return;
    setSavingInternalNote(true);
    const sName = userProfile?.full_name || userProfile?.display_name || "Staff";
    const sRole = userProfile?.role || "staff";
    const sOffice = userProfile?.office_location || selectedRoom?.procedures?.office_location || null;
    const noteBody = internalNoteDraft.trim();
    const noteContent = serializeInternalNote(noteBody, internalNoteVisibility);
    const tempId = "temp-note-" + Date.now();
    const tempMessage = {
      id: tempId,
      room_id: selectedRoom.id,
      content: noteContent,
      message_type: "text",
      sender_type: "staff",
      sender_id: currentUserId || null,
      sender_name: sName,
      sender_role: sRole,
      sender_office: sOffice,
      is_internal: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        room_id: selectedRoom.id,
        content: noteContent,
        message_type: "text",
        sender_type: "staff",
        sender_id: currentUserId || null,
        sender_name: sName,
        sender_role: sRole,
        sender_office: sOffice,
        is_internal: true,
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      alert(error.message || (lang==="es" ? "No pude guardar la nota interna." : "I could not save the internal note."));
    } else if (data) {
      setMessages((prev) => prev.map((entry) => entry.id === tempId ? data : entry));
      setInternalNoteDraft("");
      if (internalNoteVisibility === "team") sendPushNotification({
          roomId:selectedRoom.id,
          userType:"staff",
          title: lang === "es" ? `Nota interna · ${roomPatientName(selectedRoom.id)}` : `Internal note · ${roomPatientName(selectedRoom.id)}`,
          body: noteBody.slice(0, 120) || (lang === "es" ? "Nuevo seguimiento interno del equipo." : "New internal care-team follow-up."),
          url: window.location.href,
          tag: `internal-note-${selectedRoom.id}`,
      });
      alert(t.noteSaved);
    }

    setSavingInternalNote(false);
  };

  const updateSelectedPatientMedications = (nextValue: string) => {
    const patientId = selectedRoom?.procedures?.patients?.id;
    setSelectedRoom((current: any) => {
      if (!current?.procedures?.patients) return current;
      return {
        ...current,
        procedures: {
          ...current.procedures,
          patients: {
            ...current.procedures.patients,
            current_medications: nextValue,
          },
        },
      };
    });
    if (patientId) {
      setPatients((current) => current.map((patient: any) => {
        if (patient.id === patientId) return { ...patient, current_medications: nextValue };
        return {
          ...patient,
          rooms: (patient.rooms || []).map((room: any) => room.id === selectedRoom?.id
            ? {
                ...room,
                procedures: {
                  ...room.procedures,
                  patients: { ...(room.procedures?.patients || {}), current_medications: nextValue },
                },
              }
            : room),
        };
      }));
    }
  };

  const saveMedicationText = async (nextValue: string) => {
    const patientId = selectedRoom?.procedures?.patients?.id;
    if (!patientId) return false;
    const { error } = await supabase.from("patients").update({ current_medications: nextValue || null }).eq("id", patientId);
    if (error) {
      alert(error.message || (lang === "es" ? "No pude actualizar medicamentos." : "I could not update medications."));
      return false;
    }
    updateSelectedPatientMedications(nextValue);
    return true;
  };

  const addPatientMedication = async () => {
    const nextMedication = medicationDraft.trim();
    if (!nextMedication || savingMedication) return;
    const currentValue = `${selectedRoom?.procedures?.patients?.current_medications || ""}`.trim();
    const nextValue = [currentValue, nextMedication].filter(Boolean).join("\n");
    setSavingMedication(true);
    const saved = await saveMedicationText(nextValue);
    setSavingMedication(false);
    if (saved) setMedicationDraft("");
  };

  const removePatientMedication = async (index: number) => {
    if (!isSuperAdmin) {
      alert(lang === "es" ? "No tienes privilegios para eliminar medicamentos actuales. Solo super admin puede hacerlo." : "You do not have privileges to delete current medications. Only a super admin can do that.");
      return;
    }
    const medications = `${selectedRoom?.procedures?.patients?.current_medications || ""}`
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const nextValue = medications.filter((_, entryIndex) => entryIndex !== index).join("\n");
    setSavingMedication(true);
    await saveMedicationText(nextValue);
    setSavingMedication(false);
  };

  const saveManagedTeam = async () => {
    if (!canManageCareTeam) {
      alert(lang === "es" ? "Solo el doctor o un super admin puede cambiar el equipo asignado." : "Only the doctor or a super admin can change the assigned care team.");
      return;
    }
    if (!selectedRoom || savingTeam) return;
    setSavingTeam(true);
    const creatorId = selectedRoom.created_by || currentUserId || null;
    const ids = Array.from(new Set([creatorId, ...managedTeamIds].filter(Boolean))) as string[];
    const rows = ids.map((memberId) => {
      const profile = staffDirectory.find((entry) => entry.id === memberId);
      return {
        room_id: selectedRoom.id,
        user_id: memberId,
        role: profile?.role || (memberId === creatorId ? (userProfile?.role || "staff") : "staff"),
      };
    });

    const { error: deleteError } = await supabase.from("room_members").delete().eq("room_id", selectedRoom.id);
    if (!deleteError && rows.length) {
      const { error: insertError } = await supabase.from("room_members").insert(rows);
      if (!insertError) {
        await fetchSelectedRoomTeam(selectedRoom.id);
        setSavingTeam(false);
        setShowPatientInfo(false);
        alert(t.teamSaved);
        return;
      }
    }

    setSavingTeam(false);
    alert(lang === "es" ? "No pude actualizar el equipo." : "I could not update the team.");
  };

  const addCareStaffToSelectedRoom = async () => {
    if (!selectedRoom || careStaffInviteIds.length === 0 || savingTeam) return;
    const patientId = selectedRoom.procedures?.patients?.id || null;
    const existingIds = new Set(selectedRoomTeam.map((member) => member.id));
    const targetIds = careStaffInviteIds.filter((id) => !existingIds.has(id));
    if (targetIds.length === 0) return;
    setSavingTeam(true);
    const rows = targetIds.map((memberId) => ({
      patient_id: patientId,
      room_id: selectedRoom.id,
      requested_by: currentUserId || null,
      target_staff_id: memberId,
      status: "pending",
      created_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("staff_access_requests").insert(rows);
    setSavingTeam(false);
    if (error) {
      alert(error.message || (lang === "es" ? "No pude guardar la solicitud." : "I could not save the request."));
      return;
    }
    setCareStaffInviteIds([]);
    setCareStaffSearch("");
    setShowCareStaffInvite(false);
    alert(t.staffAdded);
  };

  const createRoom = async () => {
    if (creatingRoom) return;
    if (!canCreatePatientRooms) {
      setNewRoomError(
        lang === "es"
          ? "No tienes permiso para crear salas de pacientes. Pide a Dr. Fonseca que te habilite en Admin."
          : "You do not have permission to create patient rooms. Ask Dr. Fonseca to enable you in Admin."
      );
      return;
    }
    setNewRoomError("");
    if (!patientFullName.trim()||!newProcedureName.trim()){setNewRoomError(t.required);return;}
    if (newPatientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatientEmail.trim())) { setNewRoomError(t.invalidEmail); return; }
    if (newPatientPhoneLocal.trim() && newPatientPhoneLocal.replace(/\D/g, "").length < 7) { setNewRoomError(t.invalidPhone); return; }
    const birthdateIso = newBirthdate ? displayToIsoDate(newBirthdate) : "";
    const surgeryDateIso = newSurgeryDate ? displayToIsoDate(newSurgeryDate) : "";
    if (newBirthdate && !birthdateIso) { setNewRoomError(lang==="es" ? "La fecha de nacimiento debe ir en formato dd/mm/aaaa." : "Birth date must use dd/mm/yyyy format."); return; }
    if (newSurgeryDate && !surgeryDateIso) { setNewRoomError(lang==="es" ? "La fecha de cirugía debe ir en formato dd/mm/aaaa." : "Surgery date must use dd/mm/yyyy format."); return; }
    setCreatingRoom(true);
    try {
      const creatorId=currentUserId||userProfile?.id||null;
      const creatorRole=userProfile?.role||"staff";
      const creatorName=userProfile?.full_name||userProfile?.display_name||"Staff";
      const patientPayload = {
        full_name:patientFullName,
        phone:combinedPatientPhone||null,
        email:newPatientEmail.trim()||null,
        birthdate:birthdateIso||null,
        preferred_language:newPatientLanguage,
        timezone:newPatientTimezone||null,
        allergies:newPatientAllergies.trim()||null,
        current_medications:newPatientMedications.trim()||null,
      };

      let patientInsert = await supabase.from("patients").insert(patientPayload).select().single();
      if (patientInsert.error && isMissingColumnError(patientInsert.error)) {
        patientInsert = await supabase
          .from("patients")
          .insert({ full_name:patientFullName, phone:combinedPatientPhone||null, birthdate:birthdateIso||null })
          .select()
          .single();
      }

      const { data: pt, error: pe } = patientInsert;
      if (pe) throw pe;
      if (profilePicFile){const fn=`patients/${pt.id}/${Date.now()}-${profilePicFile.name}`;const{error:ue}=await supabase.storage.from("chat-files").upload(fn,profilePicFile);if(!ue){const{data:ud}=supabase.storage.from("chat-files").getPublicUrl(fn);await supabase.from("patients").update({profile_picture_url:ud.publicUrl}).eq("id",pt.id);}}
      const { data: pr, error: pre } = await supabase.from("procedures").insert({patient_id:pt.id,procedure_name:newProcedureName.trim(),surgery_date:surgeryDateIso||null,office_location:newLocation,status:"scheduled"}).select().single();
      if (pre) throw pre;
      const patientAccessToken = createPatientAccessToken();
      let roomInsert = await supabase
        .from("rooms")
        .insert({procedure_id:pr.id,created_by:creatorId,patient_access_token:patientAccessToken})
        .select()
        .single();

      if (roomInsert.error && isMissingColumnError(roomInsert.error)) {
        roomInsert = await supabase
          .from("rooms")
          .insert({procedure_id:pr.id,created_by:creatorId})
          .select()
          .single();
      }

      const { data: rm, error: re } = roomInsert;
      if (re) throw re;
      const roomLinkToken = typeof (rm as { patient_access_token?: unknown })?.patient_access_token === "string"
        ? (rm as { patient_access_token: string }).patient_access_token
        : "";

      const memberIds = Array.from(new Set([creatorId, ...selectedCareTeamIds].filter(Boolean))) as string[];
      if (memberIds.length) {
        const selectedProfiles = staffDirectory.filter((entry) => memberIds.includes(entry.id));
        const rows = memberIds.map((memberId) => {
          const profile = selectedProfiles.find((entry) => entry.id === memberId);
          return {
            room_id: rm.id,
            user_id: memberId,
            role: profile?.role || (memberId === creatorId ? creatorRole : "staff"),
          };
        });

        await supabase.from("room_members").insert(rows);
      }
      const patientFirstName = patientFullName.trim().split(/\s+/)[0] || patientFullName.trim();
      const welcomeMessage = newPatientLanguage === "en"
        ? `Hello ${patientFirstName}, welcome. This will be your direct communication channel with our team throughout your care.\n\nPlease tap the + button and open Forms to complete your Medical history. Once you save it, our team will be able to review it from the Forms folder.\n\nIf you need immediate assistance, press the call button to connect with the clinic. We are here to help you.`
        : `Hola ${patientFirstName}, bienvenido(a). Este será tu canal de comunicación directo con nuestro equipo durante todo tu proceso de cuidado.\n\nPor favor presiona el botón + y abre Formularios para completar tu Historia clínica. Al guardarla, nuestro equipo podrá revisarla desde la carpeta Formularios.\n\nSi necesitas asistencia inmediata, presiona el botón de llamada para comunicarte con la clínica. Estamos aquí para ayudarte.`;
      await supabase.from("messages").insert({
        room_id: rm.id,
        content: welcomeMessage,
        message_type: "text",
        sender_type: "staff",
        sender_id: creatorId,
        sender_name: "Equipo Dr. Fonseca",
        sender_role: creatorRole,
        sender_office: newLocation,
      });
      for (let i = 0; i < beforePhotosFiles.length; i++) {
        const f = beforePhotosFiles[i];
        const fn2 = `patients/${pt.id}/pre-op-photos/uploaded-by-${safeStorageSegment(creatorName)}/${Date.now()}-${i}-${safeStorageSegment(f.name)}`;
        const { error: ue2 } = await supabase.storage.from("chat-files").upload(fn2, f);
        if (!ue2) {
          const { data: ud2 } = supabase.storage.from("chat-files").getPublicUrl(fn2);
          await supabase.from("messages").insert({
            room_id: rm.id,
            content: ud2.publicUrl,
            message_type: "image",
            file_name: `[BEFORE] Foto Pre-Op ${i + 1}`,
            sender_type: "staff",
            sender_id: creatorId,
            sender_name: creatorName,
            sender_role: creatorRole,
            sender_office: newLocation,
            is_internal: true,
          });
        }
      }
      setCreatedRoomLink(`${window.location.origin}/patient/${rm.id}${roomLinkToken ? `?token=${encodeURIComponent(roomLinkToken)}` : ""}`);
      setCreatedPatientName(patientFullName);
      setCreatedPatientLanguage(newPatientLanguage);
      setNewPatientFirstName("");setNewPatientLastName("");setNewPatientPhoneCountry("+52");setNewPatientPhoneLocal("");setNewPatientEmail("");setNewProcedureName("");setNewSurgeryDate("");setNewBirthdate("");setNewLocation("Guadalajara");setNewPatientLanguage("es");setNewPatientTimezone("America/Mexico_City");setNewPatientAllergies("");setNewPatientMedications("");setSelectedCareTeamIds([]);setProfilePicFile(null);setBeforePhotosFiles([]);setShowNewRoom(false);
      fetchRooms();
    } catch(err:any){console.error(err);setNewRoomError("Error: "+(err?.message||JSON.stringify(err)));}
    setCreatingRoom(false);
  };

  const copyLink = async () => { if (!createdRoomLink) return; await navigator.clipboard.writeText(createdRoomLink); setLinkCopied(true); setTimeout(()=>setLinkCopied(false),2500); };
  const whatsAppLink = () => { if (!createdRoomLink) return; window.open(`https://wa.me/?text=${encodeURIComponent(onboardingMessageForPatient({ patientName: createdPatientName, roomLink: createdRoomLink, preferredLanguage: createdPatientLanguage }))}`, "_blank"); };

  const startRec = async () => {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mimeType = pickRecorderMimeType("audio");
      const mr=mimeType ? new MediaRecorder(stream,{ mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current=mr; audioChunksRef.current=[];
      mr.ondataavailable=e=>{if(e.data.size>0)audioChunksRef.current.push(e.data);};
      mr.onstop=async()=>{
        const shouldDiscard = discardAudioRef.current;
        const finalMimeType = mr.mimeType || mimeType || "audio/webm";
        const b=new Blob(audioChunksRef.current,{type:finalMimeType});
        stream.getTracks().forEach(t=>t.stop());
        audioChunksRef.current=[];
        discardAudioRef.current=false;
        if (shouldDiscard || b.size===0) return;
        const ext = extensionForMimeType(finalMimeType, "webm");
        stagePreview(new File([b],`voice-${Date.now()}.${ext}`,{type:finalMimeType}));
      };
      mr.start(); setRecording(true); setRecordingSeconds(0); discardAudioRef.current=false;
      recordingTimerRef.current=setInterval(()=>setRecordingSeconds(s=>s+1),1000);
    } catch {alert("No se pudo acceder al micrófono.");}
  };
  const stopRec = (discard=false) => { if (mediaRecorderRef.current&&recording){discardAudioRef.current=discard;mediaRecorderRef.current.stop();setRecording(false);clearInterval(recordingTimerRef.current);setRecordingSeconds(0);} };
  const stopCaptureStream = () => {
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;
  };
  const openCapture = async (mode: "photo" | "video") => {
    try {
      setPreparingCapture(true);
      setShowMediaMenu(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: mode === "video" });
      captureStreamRef.current = stream;
      setCaptureMode(mode);
      if (mode === "video") {
        captureChunksRef.current = [];
        discardCaptureRef.current = false;
        const mimeType = pickRecorderMimeType("video");
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        captureRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) captureChunksRef.current.push(event.data);
        };
        recorder.onstop = async () => {
          const shouldDiscard = discardCaptureRef.current;
          const finalMimeType = recorder.mimeType || mimeType || "video/webm";
          const blob = new Blob(captureChunksRef.current, { type: finalMimeType });
          captureChunksRef.current = [];
          captureRecorderRef.current = null;
          stopCaptureStream();
          setCaptureMode(null);
          setRecordingVideo(false);
          if (!shouldDiscard && blob.size > 0) {
            const ext = extensionForMimeType(finalMimeType, "webm");
            stagePreview(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type || finalMimeType }));
          }
        };
        recorder.start();
        setRecordingVideo(true);
      }
    } catch {
      stopCaptureStream();
      alert(lang==="es" ? "No se pudo abrir la cámara." : "I could not open the camera.");
    } finally {
      setPreparingCapture(false);
    }
  };
  const cancelCapture = () => {
    if (captureMode === "video" && captureRecorderRef.current) {
      discardCaptureRef.current = true;
      captureRecorderRef.current.stop();
      return;
    }
    stopCaptureStream();
    setCaptureMode(null);
    setRecordingVideo(false);
  };
  const takePhotoNow = async () => {
    if (!mediaCaptureVideoRef.current || !captureStreamRef.current) return;
    const video = mediaCaptureVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    stopCaptureStream();
    setCaptureMode(null);
    if (blob) {
      stagePreview(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }
  };
  const sendCapturedVideo = () => {
    if (captureMode === "video" && captureRecorderRef.current) {
      discardCaptureRef.current = false;
      captureRecorderRef.current.stop();
    }
  };

  const isPrescriptionEntry = (entry: any) => `${entry?.file_name || ""}`.startsWith("[MED]");
  const isClinicalFormPdfEntry = (entry: any) => `${entry?.file_name || ""}`.startsWith("[FORM PDF]");
  const isPatientFolderEntry = (entry: any) => {
    const fileName = `${entry?.file_name || ""}`;
    return (
      fileName.startsWith("[MED]") ||
      fileName.startsWith("[FORM PDF]") ||
      fileName.startsWith("[BEFORE]") ||
      fileName.startsWith("[PROFILE]") ||
      fileName.startsWith("profile.") ||
      `${entry?.content || ""}`.includes("patient-profiles/") ||
      `${entry?.content || ""}`.includes("patient-photos/")
    );
  };
  const slashFiltered = quickReplies.filter(r=>slashFilter===""||r.shortcut.toLowerCase().includes(slashFilter.toLowerCase())||r.message.toLowerCase().includes(slashFilter.toLowerCase()));
  const roomMediaEntries = messages
    .filter((entry) => !entry.deleted_by_staff && !entry.deleted_by_patient && !entry.is_internal)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const roomImageVideoEntries = roomMediaEntries.filter((entry) => !isPatientFolderEntry(entry) && (entry.message_type === "image" || entry.message_type === "video"));
  const roomAudioEntries = roomMediaEntries.filter((entry) => !isPatientFolderEntry(entry) && entry.message_type === "audio");
  const roomPrescriptionEntries = roomMediaEntries.filter((entry) => isPrescriptionEntry(entry));
  const roomFormEntries = roomMediaEntries.filter((entry) => !!parseFormMessage(entry.content) || isClinicalFormPdfEntry(entry));
  const roomFileEntries = roomMediaEntries.filter((entry) => entry.message_type === "file" && !isPatientFolderEntry(entry));
  const prescriptionInfo = (entry: any) => {
    const clean = `${entry?.file_name || t.prescriptions}`.replace(/^\[MED\]\s*/, "").trim();
    const [title, ...instructions] = clean.split(/\n+/);
    return {
      title: (title || t.prescriptions).trim(),
      instructions: instructions.join("\n").trim(),
    };
  };
  const openPrescriptionRename = (entry: any) => {
    const info = prescriptionInfo(entry);
    setEditingPrescriptionEntry(entry);
    setPrescriptionEditTitle(info.title);
    setPrescriptionEditInstructions(info.instructions);
  };
  const savePrescriptionRename = async () => {
    if (!editingPrescriptionEntry?.id || !prescriptionEditTitle.trim() || savingPrescriptionRename) return;
    const nextName = `[MED] ${prescriptionEditTitle.trim()}${prescriptionEditInstructions.trim() ? `\n${prescriptionEditInstructions.trim()}` : ""}`;
    setSavingPrescriptionRename(true);
    const { data, error } = await supabase
      .from("messages")
      .update({ file_name: nextName })
      .eq("id", editingPrescriptionEntry.id)
      .select()
      .single();
    setSavingPrescriptionRename(false);
    if (error) {
      alert(error.message || (lang === "es" ? "No pude renombrar la receta." : "I could not rename this prescription."));
      return;
    }
    if (data) setMessages((current) => current.map((entry) => entry.id === data.id ? data : entry));
    setEditingPrescriptionEntry(null);
    setPrescriptionEditTitle("");
    setPrescriptionEditInstructions("");
  };
  const formExportText = (entry: any) => {
    const payload = parseFormMessage(entry.content);
    if (!payload) return "";
    const labels = lang === "es"
      ? {
          title: "Formulario del paciente",
          fullName: "Nombre completo",
          birthdate: "Fecha de nacimiento",
          phone: "Teléfono",
          email: "Correo",
          allergies: "Alergias",
          medications: "Medicamentos actuales",
          conditions: "Enfermedades o condiciones",
          surgeries: "Cirugías previas",
          notes: "Notas importantes",
          submitted: "Enviado",
        }
      : {
          title: "Patient form",
          fullName: "Full name",
          birthdate: "Date of birth",
          phone: "Phone",
          email: "Email",
          allergies: "Allergies",
          medications: "Current medications",
          conditions: "Medical conditions",
          surgeries: "Previous surgeries",
          notes: "Important notes",
          submitted: "Submitted",
        };
    const submitted = payload.submittedAt ? new Date(payload.submittedAt).toLocaleString(lang === "es" ? "es-MX" : "en-US") : fmtDateLabel(entry.created_at || "");
    return [
      labels.title,
      `${labels.submitted}: ${submitted}`,
      "",
      `${labels.fullName}: ${payload.values.fullName || "-"}`,
      `${labels.birthdate}: ${payload.values.birthdate || "-"}`,
      `${labels.phone}: ${payload.values.phone || "-"}`,
      `${labels.email}: ${payload.values.email || "-"}`,
      `${labels.allergies}: ${payload.values.allergies || "-"}`,
      `${labels.medications}: ${payload.values.medications || "-"}`,
      `${labels.conditions}: ${payload.values.conditions || "-"}`,
      `${labels.surgeries}: ${payload.values.surgeries || "-"}`,
      `${labels.notes}: ${payload.values.notes || "-"}`,
    ].join("\n");
  };
  const formExportTitle = (entry: any) => {
    const payload = parseFormMessage(entry.content);
    const patientName = payload?.values.fullName || selectedRoom?.procedures?.patients?.full_name || (lang === "es" ? "Paciente" : "Patient");
    return `${lang === "es" ? "Formulario" : "Form"} - ${patientName}`;
  };
  const shareFormEntry = async (entry: any) => {
    const text = formExportText(entry);
    if (!text) return;
    if (navigator.share) {
      await navigator.share({ title: formExportTitle(entry), text });
      return;
    }
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    alert(lang === "es" ? "Formulario copiado para compartir." : "Form copied for sharing.");
  };
  const emailFormEntry = (entry: any) => {
    const subject = encodeURIComponent(formExportTitle(entry));
    const body = encodeURIComponent(formExportText(entry));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const messageFormEntry = (entry: any) => {
    const body = encodeURIComponent(formExportText(entry));
    window.location.href = `sms:?&body=${body}`;
  };
  const printFormEntry = (entry: any) => {
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const title = formExportTitle(entry);
    const text = formExportText(entry);
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin:24px;color:#111;line-height:1.55}h1{font-size:24px;margin:0 0 16px}pre{white-space:pre-wrap;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}@media print{body{margin:12mm}}</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(text)}</pre><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`);
    printWindow.document.close();
  };
  const appendEmojiToDraft = (emoji: string) => {
    const next = `${newMessage}${emoji}`;
    setComposerText(next);
    updateTypingState(next);
    setShowSlashMenu(false);
    composerRef.current?.focus();
  };
  const selectQuickReply = (reply: QuickReply) => {
    setComposerText(reply.message);
    updateTypingState(reply.message);
    setShowSlashMenu(false);
    setSlashFilter("");
    composerRef.current?.focus();
  };
  const filtPts = patients
    .filter(p=>{
      const q=searchQuery.toLowerCase();
      if (activeLabelFilter && !labelAssignMode && !patientLabelIdsFor(p).includes(activeLabelFilter)) return false;
      return (
        p.full_name?.toLowerCase().includes(q) ||
        String(p.phone || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q) ||
        p.rooms.some((r:any)=>
          r.procedures?.procedure_name?.toLowerCase().includes(q) ||
          r.procedures?.office_location?.toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) => {
      const unreadA = a.rooms.reduce((sum:number, room:any) => sum + (unreadCounts[room.id] || 0), 0);
      const unreadB = b.rooms.reduce((sum:number, room:any) => sum + (unreadCounts[room.id] || 0), 0);
      if (unreadA !== unreadB) return unreadB - unreadA;
      return (a.full_name || "").localeCompare(b.full_name || "", lang==="es" ? "es" : "en");
    });
  const roomPreview = (room: { id?: string } | null | undefined) => {
    const roomId = room?.id || "";
    const latest = roomId ? latestRoomMessages[roomId] : undefined;
    if (latest) return describeIncomingMessage(latest);
    return lang === "es" ? "Sin mensajes recientes" : "No recent messages";
  };
  const roomPreviewTime = (room: { id?: string } | null | undefined) => {
    const roomId = room?.id || "";
    const latest = roomId ? latestRoomMessages[roomId] : undefined;
    if (latest?.created_at) return fmtTime(latest.created_at);
    return "";
  };
  const groupedMessages = () => {
    const groups: {date:string;msgs:any[]}[]=[];
    let currentDate="";
    messages.forEach(m=>{
      if (m.deleted_by_staff || m.is_internal || isPatientFolderEntry(m)) return;
      const d=new Date(m.created_at).toDateString();
      if (d!==currentDate){currentDate=d;groups.push({date:m.created_at,msgs:[]});}
      groups[groups.length-1].msgs.push(m);
    });
    return groups;
  };

  const renderMsg = (msg: any) => {
    const isOut=msg.sender_type==="staff"||!msg.sender_type;
    const isSystem=msg.sender_name==="Sistema";
    const canDeleteOwnStaffMessage =
      isOut &&
      !isSystem &&
      !msg.deleted_by_patient &&
      !msg.deleted_by_staff &&
      !!currentUserId &&
      !!msg.sender_id &&
      msg.sender_id === currentUserId;
    const sc=senderColor(msg.sender_type||"staff",msg.sender_role||"staff");
    const sn = displaySenderName(msg, isOut);
    const staffContact =
      msg.sender_type === "staff" && msg.sender_id && msg.sender_id !== currentUserId
        ? findStaffMemberForMessage(msg)
        : null;
    const videoCallRoomName = parseVideoCallMessage(msg.content);
    const callRequestToken = parseCallRequestMessage(msg.content);
    const translated = !isOut && autoTranslateIncoming && msg.message_type === "text" && msg.id && !videoCallRoomName && !callRequestToken
      ? translatedIncoming[translationKey(msg.id, lang)] || ""
      : "";
    const contentToRender = translated || msg.content;
    const effectiveType=msg.message_type==="text"&&isImageUrl(msg.content)?"image":msg.message_type;
    const formPayload = parseFormMessage(msg.content);

    if (isSystem) return (
      <div key={msg.id} style={{display:"flex",justifyContent:"center",margin:"8px 0"}}>
        <div style={{background:"rgba(0,0,0,0.08)",borderRadius:99,padding:"4px 14px",fontSize:12,color:"#555",fontWeight:600}}>{msg.content}</div>
      </div>
    );

    const isOwn = isOut && !!currentUserId && msg.sender_id === currentUserId;
    const bubbleBg = isOut ? "#FFFFFF" : darkMode ? "#1F2C34" : "#E1F2FA";
    const bubbleRadius=isOut?"16px 16px 6px 16px":"16px 16px 16px 6px";
    const bubbleStyle:React.CSSProperties={background:bubbleBg,color:darkMode&&!isOut?"#F8FAFC":"#07111F",borderRadius:bubbleRadius,maxWidth:"min(82%, 680px)",padding:"10px 12px 8px",boxShadow:"0 1px 2px rgba(15,23,42,0.13)",position:"relative",border:isOut?`1px solid ${borderColor}`:"none",fontSize, fontWeight:560,lineHeight:1.38,letterSpacing:0};
    const patientDeletedNotice = msg.deleted_by_patient ? <div style={{marginTop:7,paddingTop:6,borderTop:"1px solid rgba(17,24,39,0.14)",fontSize:12,fontStyle:"italic",opacity:0.72}}>(This message was Deleted by user)</div> : null;
    const bubbleHeader = (style: React.CSSProperties = {}) => (
      <div style={{marginBottom:5,lineHeight:1.15,...style}}>
	        <button
	          type="button"
	          onClick={(event)=>{
	            event.stopPropagation();
	            openStaffContact(staffContact);
	          }}
	          onPointerDown={(event)=>{event.stopPropagation();startStaffContactPress(staffContact);}}
	          onPointerUp={(event)=>{event.stopPropagation();cancelStaffMessagePress();}}
	          onPointerCancel={cancelStaffMessagePress}
	          onContextMenu={(event)=>{ if (staffContact) { event.preventDefault(); event.stopPropagation(); openStaffContact(staffContact); } }}
	          style={{border:"none",background:"transparent",padding:"4px 0",margin:0,fontFamily:"inherit",fontSize:Math.max(fontSize - 4, 15),fontWeight:850,color:sc,cursor:staffContact?"pointer":"default",touchAction:"manipulation",WebkitTouchCallout:"none"}}
	        >
          {sn}
        </button>
      </div>
    );
    const bubbleTime = (showTicks = false, style: React.CSSProperties = {}) => (
      <div style={{fontSize:Math.max(fontSize - 6, 13),opacity:0.78,marginTop:4,textAlign:"right",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,fontWeight:520,lineHeight:1.15,...style}}>
        {fmtTime(msg.created_at)}
        {showTicks&&<span style={{color:"#007AFF"}}>✓✓</span>}
      </div>
    );

    return (
      <div
        key={msg.id}
        onClick={(event)=>{
          event.stopPropagation();
          if (staffContact) {
            openStaffContact(staffContact);
            return;
          }
          if (canDeleteOwnStaffMessage) setActiveMessageAction(msg);
        }}
        onMouseDown={()=> staffContact ? startStaffContactPress(staffContact) : startStaffMessagePress(msg.id, canDeleteOwnStaffMessage)}
        onMouseUp={cancelStaffMessagePress}
        onMouseLeave={cancelStaffMessagePress}
        onTouchStart={()=> staffContact ? startStaffContactPress(staffContact) : startStaffMessagePress(msg.id, canDeleteOwnStaffMessage)}
        onTouchEnd={cancelStaffMessagePress}
        onContextMenu={(event)=>{
          if (staffContact) {
            event.preventDefault();
            openStaffContact(staffContact);
            return;
          }
          if (canDeleteOwnStaffMessage) { event.preventDefault(); setPressedMsgId(msg.id); setActiveMessageAction(msg); }
        }}
        style={{display:"flex",flexDirection:"column",alignItems:isOut?"flex-end":"flex-start",marginBottom:5,position:"relative",cursor:staffContact?"pointer":"default"}}
      >
        {effectiveType==="image"?(
          <div style={{...bubbleStyle,padding:4}}>
            {bubbleHeader({padding:"6px 8px 2px",marginBottom:2})}
            <img src={msg.content} alt="" style={{width:"100%",maxWidth:160,maxHeight:160,borderRadius:12,display:"block",objectFit:"cover"}} onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
            {patientDeletedNotice}
            {bubbleTime(false,{padding:"4px 6px 2px",marginTop:0})}
          </div>
        ):effectiveType==="video"?(
          <div style={{...bubbleStyle,padding:4}}>
            {bubbleHeader({padding:"6px 8px 2px",marginBottom:2})}
            <video src={msg.content} controls style={{width:"100%",maxWidth:170,maxHeight:170,borderRadius:12,display:"block",objectFit:"cover"}}/>
            {patientDeletedNotice}
            {bubbleTime(false,{padding:"4px 6px 2px",marginTop:0})}
          </div>
        ):effectiveType==="audio"?(
          <div style={{...bubbleStyle,minWidth:180,maxWidth:240}}>
            {bubbleHeader()}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:20}}>🎤</span><span style={{fontSize:14,fontWeight:600}}>Audio</span></div>
            <audio src={msg.content} controls style={{width:"100%"}}/>
            {patientDeletedNotice}
            {bubbleTime(false,{marginTop:6})}
          </div>
        ):effectiveType==="file"?(
          <div style={{...bubbleStyle,cursor:"pointer"}}>
            {bubbleHeader()}
            <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,color:"inherit",textDecoration:"none"}}>
              <span style={{fontSize:28}}>📄</span>
              <div><div style={{fontSize:14,fontWeight:600}}>{(msg.file_name||"Archivo").replace(/^\[MED\] |\[BEFORE\] /,"")}</div><div style={{fontSize:12,opacity:0.78}}>{fmtSize(msg.file_size)}</div></div>
            </a>
            {patientDeletedNotice}
            {bubbleTime(false,{marginTop:6})}
          </div>
        ):formPayload ? (
          <div style={{...bubbleStyle,padding:0,background:"transparent",border:"none",boxShadow:"none"}}>
            <FormMessage payload={formPayload} lang={lang} templateUrl="/forms/historia-clinica.pdf" />
          </div>
        ):callRequestToken ? (
          <div style={{ ...bubbleStyle, padding: 12, minWidth: 250 }}>
            {bubbleHeader()}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>📲</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{isOut ? t.callRequestSent : t.incomingCallRequest}</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 10 }}>
              {isOut ? t.callRequestSent : t.callRequestBody}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "8px 10px" }}>
              {lang === "es" ? "Videollamadas desactivadas temporalmente." : "Video calls are temporarily disabled."}
            </div>
            {patientDeletedNotice}
            {bubbleTime(false,{marginTop:8})}
          </div>
        ):videoCallRoomName ? (
          <div style={{ ...bubbleStyle, padding: 12, minWidth: 240 }}>
            {bubbleHeader()}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🎥</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{t.videoCallInvite}</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 10 }}>{t.videoCallInviteBody}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "8px 10px" }}>
              {lang === "es" ? "Videollamadas desactivadas temporalmente." : "Video calls are temporarily disabled."}
            </div>
            {patientDeletedNotice}
            {bubbleTime(false,{marginTop:8})}
          </div>
        ):(
          <div style={{...bubbleStyle,wordBreak:"break-word"}}>
            {bubbleHeader()}
            <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{contentToRender}</div>
            {patientDeletedNotice}
            {bubbleTime(isOut)}
          </div>
        )}
      </div>
    );
  };

  const SettingsPanel = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:"max(16px, env(safe-area-inset-top))",paddingLeft:"max(0px, env(safe-area-inset-left))",paddingRight:"max(0px, env(safe-area-inset-right))",overflow:"hidden"}} onClick={()=>setShowSettings(false)}>
      <div className="settings-sheet" style={{background:sidebarBg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"calc(100dvh - max(16px, env(safe-area-inset-top)))",overflowY:"auto",overflowX:"hidden",padding:`0 0 calc(40px + env(safe-area-inset-bottom))`,WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:sidebarBg,zIndex:10,padding:"max(20px, calc(env(safe-area-inset-top) + 8px)) max(20px, env(safe-area-inset-right)) 16px max(20px, env(safe-area-inset-left))",borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:22,fontWeight:800,color:textColor}}>⚙️ {t.settings}</p>
          <button onClick={()=>setShowSettings(false)} style={{background:cardBg,border:"none",borderRadius:99,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer",color:textColor,fontFamily:"inherit",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"0 20px"}}>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4,marginBottom:12,lineHeight:1.35}}>{lang==="es"?"Mi nombre":"My name"}</p>
            <label style={{display:"block",fontSize:uiBaseSize,fontWeight:700,color:textColor,marginBottom:8,lineHeight:1.4}}>{t.displayName}</label>
            <input
              value={displayNameEdit}
              onChange={(event)=>setDisplayNameEdit(event.target.value)}
              placeholder={lang==="es"?"Nombre visible para pacientes y equipo":"Name shown to patients and team"}
              style={{width:"100%",height:48,border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#253244":"white",color:textColor,padding:"0 14px",fontSize:16,fontFamily:"inherit",fontWeight:650,marginBottom:10}}
            />
            <button onClick={saveDisplayName} disabled={savingName || !displayNameEdit.trim()} style={{width:"100%",height:48,border:"none",borderRadius:14,background:"#2563EB",color:"white",fontSize:uiBaseSize,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:savingName || !displayNameEdit.trim()?0.55:1}}>
              {savingName ? (lang==="es"?"Guardando...":"Saving...") : savedName ? t.saved : t.save}
            </button>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4,marginBottom:12,lineHeight:1.35}}>{lang==="es"?"Teléfono / WhatsApp":"Phone / WhatsApp"}</p>
            <label style={{display:"block",fontSize:uiBaseSize,fontWeight:700,color:textColor,marginBottom:8,lineHeight:1.4}}>
              {lang==="es"?"Número para llamadas internas del equipo":"Number for internal team calls"}
            </label>
            <div style={{display:"grid",gridTemplateColumns:"minmax(132px, 0.45fr) 1fr",gap:8,marginBottom:10}}>
              <select
                value={phoneCountryEdit}
                onChange={(event)=>setPhoneCountryEdit(event.target.value)}
                aria-label={t.phoneCode}
                style={{width:"100%",height:48,border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#253244":"white",color:textColor,padding:"0 10px",fontSize:15,fontFamily:"inherit",fontWeight:850}}
              >
                {PHONE_COUNTRY_OPTIONS.map((option)=>(
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
              <input
                value={phoneLocalEdit}
                onChange={(event)=>setPhoneLocalEdit(formatPhoneLocal(event.target.value))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder={t.phonePH}
                style={{width:"100%",height:48,border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#253244":"white",color:textColor,padding:"0 14px",fontSize:16,fontFamily:"inherit",fontWeight:650}}
              />
            </div>
            <button onClick={saveProfilePhone} disabled={savingPhone} style={{width:"100%",height:48,border:"none",borderRadius:14,background:"#2563EB",color:"white",fontSize:uiBaseSize,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:savingPhone?0.55:1}}>
              {savingPhone ? (lang==="es"?"Guardando...":"Saving...") : savedPhone ? t.saved : t.save}
            </button>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4,marginBottom:14,lineHeight:1.35}}>🎨 {lang==="es"?"Apariencia":"Appearance"}</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontSize:uiBaseSize,color:textColor,fontWeight:650,lineHeight:1.4}}>🌙 {t.darkMode}</span>
              <button onClick={()=>setDarkMode(d=>!d)} style={{width:52,height:30,borderRadius:99,background:darkMode?"#34C759":"#E5E5EA",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"white",position:"absolute",top:2,left:darkMode?24:2,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>
            <span style={{fontSize:uiBaseSize,color:textColor,fontWeight:650,display:"block",marginBottom:10,lineHeight:1.4}}>🔤 {t.fontSize}</span>
            <div style={{display:"flex",gap:8}}>
              {(["small","medium","large"] as const).map(level=>(
                <button key={level} onClick={()=>setFontSizeLevel(level)} style={{flex:1,padding:"11px 8px",minHeight:48,borderRadius:12,border:fontSizeLevel===level?"2px solid #007AFF":`2px solid ${borderColor}`,background:fontSizeLevel===level?"#EBF5FF":(darkMode?"#2C2C2E":"white"),color:fontSizeLevel===level?"#007AFF":textColor,fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:level==="large"?18:16,lineHeight:1.25}}>
                  {t[level]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const StaffChatsPanel = () => {
    const activePeer = activeStaffPrivateConversation?.peer || null;
    const activeRoom = activeStaffRoomConversation;
    const activeRoomMembers = activeRoom?.memberIds
      .map((id) => staffMemberById.get(id))
      .filter(Boolean) as CareTeamMember[];
    const closePanel = () => {
      setShowStaffChats(false);
      setActiveStaffChatPeerId(null);
      setActiveStaffRoomId(null);
      setStaffPrivateReply("");
      setStaffRoomReply("");
      setShowCreateStaffRoom(false);
    };
    return (
      <div className="modal-overlay" onClick={closePanel}>
        <div className="modal-scroll" onClick={e=>e.stopPropagation()} style={{maxWidth:720}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14}}>
            <div style={{minWidth:0}}>
              <p className="modal-title" style={{margin:0}}>{lang==="es"?"Comunicación interna del equipo":"Internal Team Communication"}</p>
              <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700,lineHeight:1.45,marginTop:4}}>
                {activeRoom
                  ? activeRoom.roomName
                  : activePeer
                  ? (activePeer.full_name || activePeer.display_name || (lang==="es"?"Personal":"Staff"))
                  : (lang==="es"?"Mensajes privados y salas internas del equipo.":"Private messages and internal team rooms.")}
              </p>
            </div>
            <button onClick={closePanel} title={lang==="es" ? "Salir" : "Exit"} aria-label={lang==="es" ? "Salir" : "Exit"} style={{width:58,height:58,minHeight:58,background:cardBg,border:`1px solid ${borderColor}`,borderRadius:999,padding:8,cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0}}>
              <img src="/Exit_icon.png" alt="" style={{width:36,height:36,objectFit:"contain",display:"block"}} />
            </button>
          </div>

          {!activeStaffPrivateConversation && !activeRoom ? (
            <div style={{display:"grid",gap:10}}>
              <button className="pbtn" onClick={()=>setShowCreateStaffRoom((value)=>!value)}>
                {showCreateStaffRoom ? (lang==="es"?"Cerrar creación":"Close creator") : (lang==="es"?"+ Crear chat interno":"+ Create internal chat")}
              </button>
              {showCreateStaffRoom && (
                <div style={{display:"grid",gap:12,padding:14,borderRadius:18,background:cardBg,border:`1px solid ${borderColor}`}}>
                  <input className="finput" value={newStaffRoomName} onChange={(event)=>setNewStaffRoomName(event.target.value)} placeholder={lang==="es"?"Nombre del chat, ej. Todo el staff":"Chat name, ex. All staff"} />
                  <textarea className="finput" rows={3} value={newStaffRoomInitialMessage} onChange={(event)=>setNewStaffRoomInitialMessage(event.target.value)} placeholder={lang==="es"?"Primer mensaje":"First message"} style={{resize:"vertical",minHeight:92}} />
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <p style={{fontSize:uiSmallSize,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4}}>{lang==="es"?"Participantes":"Participants"}</p>
                    <button className="sbtn" onClick={selectAllStaffForRoom} style={{width:"auto",padding:"0 12px"}}>{lang==="es"?"Todo el staff":"All staff"}</button>
                  </div>
                  <div style={{display:"grid",gap:8,maxHeight:220,overflowY:"auto",paddingRight:2}}>
                    {staffRoomMemberOptions.length === 0 ? (
                      <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700}}>{lang==="es"?"No hay otros miembros disponibles.":"No other staff members available."}</p>
                    ) : staffRoomMemberOptions.map((member) => (
                      <label key={member.id} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:14,border:`1px solid ${borderColor}`,background:darkMode?"#253244":"white",cursor:"pointer"}}>
                        <input type="checkbox" checked={newStaffRoomMemberIds.includes(member.id)} onChange={()=>toggleNewStaffRoomMember(member.id)} style={{width:18,height:18,accentColor:"#2563EB"}} />
                        <span style={{fontSize:uiBaseSize,fontWeight:850,color:textColor,overflowWrap:"anywhere"}}>{member.full_name || member.display_name || (lang==="es"?"Personal":"Staff")}</span>
                      </label>
                    ))}
                  </div>
                  <button className="pbtn" disabled={savingStaffPrivateMessage || newStaffRoomMemberIds.length === 0} onClick={createStaffRoom}>
                    {savingStaffPrivateMessage ? (lang==="es"?"Creando...":"Creating...") : (lang==="es"?"Crear chat":"Create chat")}
                  </button>
                </div>
              )}
              {staffRoomConversations.length > 0 && (
                <>
                  <p style={{fontSize:uiSmallSize,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4,marginTop:4}}>{lang==="es"?"Chats internos":"Internal chats"}</p>
                  {staffRoomConversations.map((conversation) => {
                    const participantNames = conversation.memberIds
                      .map((id) => staffMemberById.get(id))
                      .filter(Boolean)
                      .map((member) => member!.full_name || member!.display_name || (lang==="es"?"Personal":"Staff"));
                    const label = participantNames.length > 0 ? participantNames.join(" + ") : conversation.roomName;
                    const isPending = conversation.currentUserStatus === "pending";
                    return (
                      <div
                        key={conversation.roomId}
                        style={{display:"grid",gap:10,width:"100%",border:`1px solid ${conversation.unreadCount || isPending ? "#93C5FD" : borderColor}`,background:conversation.unreadCount || isPending ? (darkMode?"rgba(37,99,235,0.18)":"#EFF6FF") : cardBg,borderRadius:18,padding:14,fontFamily:"inherit"}}
                      >
                        <button
                          onClick={()=>openStaffRoomConversation(conversation.roomId)}
                          style={{display:"flex",alignItems:"center",gap:12,width:"100%",border:"none",background:"transparent",padding:0,textAlign:"left",fontFamily:"inherit",cursor:"pointer",minWidth:0}}
                        >
                          <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#0F766E,#2563EB)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}>👥</div>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",minWidth:0}}>
                              <p style={{fontSize:uiBaseSize,fontWeight:900,color:textColor,overflowWrap:"anywhere",lineHeight:1.25}}>{label}</p>
                              <span style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:750,whiteSpace:"nowrap",flexShrink:0}}>{fmtTime(conversation.latestAt)}</span>
                            </div>
                            <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:750,lineHeight:1.35,overflowWrap:"anywhere"}}>
                              {isPending ? (lang==="es"?"Invitación pendiente":"Pending invite") : `${conversation.memberIds.length} ${lang==="es"?"participantes":"participants"}`}
                            </p>
                          </div>
                          {conversation.unreadCount > 0 && <span style={{minWidth:24,height:24,borderRadius:99,background:"#2563EB",color:"white",fontSize:13,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{conversation.unreadCount}</span>}
                        </button>
                        {isPending && (
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            <button className="pbtn" onClick={()=>respondToStaffRoomInvite(conversation, "accept")} disabled={savingStaffPrivateMessage} style={{minHeight:42}}>{lang==="es"?"Aceptar":"Accept"}</button>
                            <button className="sbtn" onClick={()=>respondToStaffRoomInvite(conversation, "decline")} disabled={savingStaffPrivateMessage} style={{minHeight:42}}>{lang==="es"?"Rechazar":"Refuse"}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              <p style={{fontSize:uiSmallSize,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.4,marginTop:4}}>{lang==="es"?"Mensajes directos":"Direct messages"}</p>
              {staffPrivateConversations.length === 0 ? (
                <div style={{padding:22,borderRadius:18,background:cardBg,border:`1px solid ${borderColor}`,color:subTextColor,fontSize:uiBaseSize,fontWeight:700,lineHeight:1.5}}>
                  {lang==="es"?"Todavía no hay mensajes privados staff a staff.":"No private staff-to-staff messages yet."}
                </div>
              ) : staffPrivateConversations.map((conversation) => (
                <button
                  key={conversation.peerId}
                  onClick={()=>openStaffPrivateConversation(conversation.peerId)}
                  style={{display:"flex",alignItems:"center",gap:12,width:"100%",border:`1px solid ${conversation.unreadCount ? "#93C5FD" : borderColor}`,background:conversation.unreadCount ? (darkMode?"rgba(37,99,235,0.18)":"#EFF6FF") : cardBg,borderRadius:18,padding:14,textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}
                >
                  <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#111827,#2563EB)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}>
                    {conversation.peer.avatar_url ? <img src={conversation.peer.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} /> : ini(conversation.peer.full_name || conversation.peer.display_name || "S")}
                  </div>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",minWidth:0}}>
                      <p style={{fontSize:uiBaseSize,fontWeight:900,color:textColor,overflowWrap:"anywhere",lineHeight:1.25}}>{conversation.peer.full_name || conversation.peer.display_name || (lang==="es"?"Personal":"Staff")}</p>
                      <span style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:750,whiteSpace:"nowrap",flexShrink:0}}>{fmtTime(conversation.latestAt)}</span>
                    </div>
                    <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:750,lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical",overflow:"hidden",overflowWrap:"anywhere"}}>
                      {conversation.latestText || (lang==="es"?"Mensaje privado":"Private message")}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && <span style={{minWidth:24,height:24,borderRadius:99,background:"#2563EB",color:"white",fontSize:13,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{conversation.unreadCount}</span>}
                </button>
              ))}
            </div>
          ) : activeRoom ? (
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button className="sbtn" onClick={()=>{setActiveStaffRoomId(null);setStaffRoomReply("");}} title={lang==="es"?"Volver":"Back"} aria-label={lang==="es"?"Volver":"Back"} style={{width:58,minWidth:58,height:58,minHeight:58,padding:6,borderRadius:999,display:"grid",placeItems:"center",flexShrink:0}}>
                  <img src="/Back_icon.jpg" alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover",display:"block"}} />
                </button>
                <span style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700}}>{activeRoomMembers.length} {lang==="es"?"participantes":"participants"}</span>
                {activeRoom.currentUserStatus === "accepted" && (
                  <button className="sbtn" onClick={leaveActiveStaffRoom} title={lang==="es"?"Salir del chat":"Leave chat"} aria-label={lang==="es"?"Salir del chat":"Leave chat"} style={{width:58,minWidth:58,height:58,minHeight:58,padding:6,borderRadius:999,marginLeft:"auto",display:"grid",placeItems:"center",flexShrink:0}}>
                    <img src="/Exit_icon.png" alt="" style={{width:38,height:38,objectFit:"contain",display:"block"}} />
                  </button>
                )}
              </div>
              {activeRoom.currentUserStatus === "pending" && (
                <div style={{display:"grid",gap:10,padding:14,borderRadius:18,background:darkMode?"rgba(37,99,235,0.18)":"#EFF6FF",border:"1px solid #93C5FD"}}>
                  <p style={{fontSize:uiBaseSize,fontWeight:850,color:textColor,lineHeight:1.45,margin:0}}>
                    {lang==="es"?"Te invitaron a este chat interno. Acepta para participar o rechaza si no deseas entrar.":"You were invited to this internal chat. Accept to participate or refuse if you do not want to join."}
                  </p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button className="pbtn" onClick={()=>respondToStaffRoomInvite(activeRoom, "accept")} disabled={savingStaffPrivateMessage}>{lang==="es"?"Aceptar chat":"Accept chat"}</button>
                    <button className="sbtn" onClick={()=>respondToStaffRoomInvite(activeRoom, "decline")} disabled={savingStaffPrivateMessage}>{lang==="es"?"Rechazar":"Refuse"}</button>
                  </div>
                </div>
              )}
              <div style={{display:"grid",gap:8,maxHeight:"45dvh",overflowY:"auto",padding:"12px",borderRadius:18,background:darkMode?"#111827":"#F8FAFC",border:`1px solid ${borderColor}`}}>
                {activeRoom.messages.map((message) => {
                  const mine = message.sender_id === currentUserId;
                  const payload = parseStaffRoomPayload(message.content);
                  const eventLabel = payload?.event && payload.event !== "message"
                    ? payload.text
                    : "";
                  if (eventLabel) {
                    return (
                      <div key={payload?.messageId || message.id || `${message.created_at}-${message.content}`} style={{display:"flex",justifyContent:"center"}}>
                        <div style={{maxWidth:"90%",borderRadius:999,background:darkMode?"#253244":"#E5E7EB",color:subTextColor,padding:"7px 12px",fontSize:uiSmallSize,fontWeight:800,lineHeight:1.35,textAlign:"center",overflowWrap:"anywhere"}}>
                          {eventLabel}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={payload?.messageId || message.id || `${message.created_at}-${message.content}`} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"86%",borderRadius:mine?"16px 16px 4px 16px":"16px 16px 16px 4px",background:mine?"#2563EB":(darkMode?"#253244":"white"),color:mine?"white":textColor,border:mine?"none":`1px solid ${borderColor}`,padding:"10px 12px",boxShadow:"0 1px 2px rgba(15,23,42,0.08)"}}>
                        {!mine && <p style={{fontSize:Math.max(uiSmallSize - 1, 12),fontWeight:900,opacity:0.82,marginBottom:4}}>{message.sender_name || (lang==="es"?"Personal":"Staff")}</p>}
                        <p style={{fontSize:uiBaseSize,fontWeight:650,lineHeight:1.45,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{payload?.text || ""}</p>
                        <p style={{fontSize:Math.max(uiSmallSize - 1, 12),opacity:0.78,textAlign:"right",marginTop:5,fontWeight:700}}>{fmtTime(message.created_at || "")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <textarea
                className="finput"
                rows={3}
                value={staffRoomReply}
                onChange={(event)=>setStaffRoomReply(event.target.value)}
                placeholder={lang==="es"?"Mensaje para la sala staff":"Message the staff room"}
                style={{resize:"vertical",minHeight:96}}
                disabled={activeRoom.currentUserStatus !== "accepted"}
              />
              <button className="pbtn" disabled={activeRoom.currentUserStatus !== "accepted" || !staffRoomReply.trim() || savingStaffPrivateMessage} onClick={sendActiveStaffRoomReply}>
                {savingStaffPrivateMessage ? (lang==="es"?"Enviando...":"Sending...") : (lang==="es"?"Enviar al chat staff":"Send to staff chat")}
              </button>
            </div>
          ) : (
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button className="sbtn" onClick={()=>{setActiveStaffChatPeerId(null);setStaffPrivateReply("");}} title={lang==="es"?"Volver":"Back"} aria-label={lang==="es"?"Volver":"Back"} style={{width:58,minWidth:58,height:58,minHeight:58,padding:6,borderRadius:999,display:"grid",placeItems:"center",flexShrink:0}}>
                  <img src="/Back_icon.jpg" alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover",display:"block"}} />
                </button>
                <button
                  className="pbtn"
                  disabled={!activePeer?.phone}
                  onClick={()=>{ if (activePeer?.phone) window.location.href = `tel:${activePeer.phone}`; }}
                  title={lang==="es"?"Llamar":"Call"}
                  aria-label={lang==="es"?"Llamar":"Call"}
                  style={{width:"auto",minWidth:94,height:48,minHeight:48,padding:"0 16px",borderRadius:999,opacity:activePeer?.phone?1:0.5,display:"grid",placeItems:"center",flexShrink:0}}
                >
                  {lang==="es"?"Llamar":"Call"}
                </button>
                {!activePeer?.phone && <span style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700}}>{lang==="es"?"Sin teléfono registrado. Puede agregarlo en Ajustes.":"No phone listed. They can add it in Settings."}</span>}
              </div>
              <div style={{display:"grid",gap:8,maxHeight:"45dvh",overflowY:"auto",padding:"12px",borderRadius:18,background:darkMode?"#111827":"#F8FAFC",border:`1px solid ${borderColor}`}}>
                {activeStaffPrivateConversation!.messages.map((message) => {
                  const mine = message.sender_id === currentUserId;
                  return (
                    <div key={message.id || `${message.created_at}-${message.content}`} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"82%",borderRadius:mine?"16px 16px 4px 16px":"16px 16px 16px 4px",background:mine?"#2563EB":(darkMode?"#253244":"white"),color:mine?"white":textColor,border:mine?"none":`1px solid ${borderColor}`,padding:"10px 12px",boxShadow:"0 1px 2px rgba(15,23,42,0.08)"}}>
                        <p style={{fontSize:uiBaseSize,fontWeight:650,lineHeight:1.45,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.content}</p>
                        <p style={{fontSize:Math.max(uiSmallSize - 1, 12),opacity:0.78,textAlign:"right",marginTop:5,fontWeight:700}}>{fmtTime(message.created_at || "")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <textarea
                className="finput"
                rows={3}
                value={staffPrivateReply}
                onChange={(event)=>setStaffPrivateReply(event.target.value)}
                placeholder={lang==="es"?"Responder mensaje privado":"Reply privately"}
                style={{resize:"vertical",minHeight:96}}
              />
              <button className="pbtn" disabled={!staffPrivateReply.trim() || savingStaffPrivateMessage} onClick={sendStaffPrivateReply}>
                {savingStaffPrivateMessage ? (lang==="es"?"Enviando...":"Sending...") : (lang==="es"?"Enviar respuesta":"Send reply")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const PatientInfoPanel = () => {
    const patient = selectedRoom?.procedures?.patients;
    const beforeEntries = messages.filter((entry) => (entry.file_name || "").startsWith("[BEFORE]"));
    const activePreOpEntry = preOpViewerIndex !== null ? beforeEntries[preOpViewerIndex] : null;
    const isOldBrokenNote = (entry: any) => {
      const content = `${entry?.content || ""}`.trim();
      return (
        !content ||
        (content.startsWith("http") && (content.includes("/patient-photos/") || content.includes("/patient-profiles/") || isImageUrl(content))) ||
        `${entry?.file_name || ""}`.startsWith("[BEFORE]") ||
        `${entry?.file_name || ""}`.startsWith("[PROFILE]")
      );
    };
    const internalNotes = messages
      .filter((entry) => entry.is_internal && !isOldBrokenNote(entry) && canViewInternalNote(entry))
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const locale = lang === "es" ? "es-MX" : "en-US";
    const localTime = currentTimeInZone(patient?.timezone, locale);
    const panelCareTeamDirectory = staffDirectory.filter((member) => !member.office_location || member.office_location === selectedRoom?.procedures?.office_location);
    const panelCareTeamGroups = CARE_TEAM_ROLE_ORDER.map((role) => ({
      role,
      members: panelCareTeamDirectory.filter((member) => (member.role || "staff") === role),
    })).filter((group) => group.members.length > 0);
    const patientMedications = `${patient?.current_medications || ""}`
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:210,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:"max(16px, env(safe-area-inset-top))",paddingLeft:"max(0px, env(safe-area-inset-left))",paddingRight:"max(0px, env(safe-area-inset-right))",overflow:"hidden"}} onClick={()=>setShowPatientInfo(false)}>
        <div className="patient-info-sheet" style={{background:sidebarBg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:580,maxHeight:"calc(100dvh - max(16px, env(safe-area-inset-top)))",overflowY:"auto",overflowX:"hidden",padding:`0 0 calc(40px + env(safe-area-inset-bottom))`,WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}} onClick={e=>e.stopPropagation()}>
          <div style={{position:"sticky",top:0,background:sidebarBg,zIndex:10,padding:"max(20px, calc(env(safe-area-inset-top) + 8px)) max(20px, env(safe-area-inset-right)) 16px max(20px, env(safe-area-inset-left))",borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{fontSize:22,fontWeight:700,color:textColor}}>{t.patientInfo}</p>
	              <p style={{fontSize:uiSmallSize,color:subTextColor,marginTop:4,lineHeight:1.45,overflowWrap:"anywhere"}}>{t.patientInfoHint}</p>
            </div>
            <button onClick={()=>setShowPatientInfo(false)} style={{background:cardBg,border:"none",borderRadius:99,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer",color:textColor,fontFamily:"inherit"}}>✕</button>
          </div>
          <div style={{padding:"0 20px",display:"grid",gap:14}}>
            <div style={{background:darkMode?"#102033":"#EFF6FF",border:`1px solid ${darkMode?"rgba(147,197,253,0.22)":"#BFDBFE"}`,borderRadius:18,padding:16}}>
              <p style={{fontSize:uiLabelSize,fontWeight:900,color:darkMode?"#BFDBFE":"#1D4ED8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,lineHeight:1.35}}>{t.patientAccessLink}</p>
              <p style={{fontSize:uiSmallSize,color:subTextColor,marginBottom:12,lineHeight:1.45}}>{t.patientAccessLinkHint}</p>
              <div style={{padding:"10px 12px",borderRadius:14,background:darkMode?"#0F172A":"white",border:`1px solid ${borderColor}`,fontSize:uiSmallSize,fontWeight:800,color:textColor,overflowWrap:"anywhere",marginBottom:10}}>
                {patientRoomLink(selectedRoom)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                <button type="button" onClick={()=>void copyPatientRoomLink()} style={{minHeight:44,border:"none",borderRadius:12,background:"#DBEAFE",color:"#1D4ED8",fontFamily:"inherit",fontSize:uiSmallSize,fontWeight:900,cursor:"pointer"}}>{t.patientCopyLink}</button>
                <button type="button" onClick={()=>void sharePatientRoomLink()} style={{minHeight:44,border:"none",borderRadius:12,background:"#DCFCE7",color:"#166534",fontFamily:"inherit",fontSize:uiSmallSize,fontWeight:900,cursor:"pointer"}}>{t.patientShareLink}</button>
                <button type="button" onClick={()=>void messagePatientRoomLink()} style={{minHeight:44,border:"none",borderRadius:12,background:"#FEF3C7",color:"#92400E",fontFamily:"inherit",fontSize:uiSmallSize,fontWeight:900,cursor:"pointer"}}>{t.patientMessageLink}</button>
              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16,display:"grid",gridTemplateColumns:"88px 1fr",gap:14,alignItems:"center"}}>
              <div style={{width:88,height:88,borderRadius:20,overflow:"hidden",background:"linear-gradient(135deg,#0F172A,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:28,fontWeight:800}}>
                {patient?.profile_picture_url ? <img src={patient.profile_picture_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini(patient?.full_name || "P")}
              </div>
              <div style={{minWidth:0}}>
                <p style={{fontSize:22,fontWeight:800,color:textColor}}>{patient?.full_name || (lang==="es" ? "Paciente sin nombre" : "Unnamed patient")}</p>
	                <p style={{fontSize:uiBaseSize,color:subTextColor,marginTop:4,lineHeight:1.45,overflowWrap:"anywhere"}}>{selectedRoom?.procedures?.procedure_name || (lang==="es" ? "Sin procedimiento" : "No procedure")}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
	                  <span style={{padding:"7px 10px",borderRadius:999,background:"#EBF5FF",color:"#2563EB",fontSize:uiSmallSize,fontWeight:800,lineHeight:1.25}}>{selectedRoom?.procedures?.office_location || (lang==="es" ? "Sin sede" : "No office")}</span>
                </div>
              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
	              <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12,lineHeight:1.35}}>{lang==="es" ? "Datos principales" : "Core details"}</p>
	              <div style={{display:"grid",gap:12,fontSize:uiBaseSize,lineHeight:1.5,overflowWrap:"anywhere"}}>
	                <div><strong style={{color:textColor}}>{t.phone}:</strong> <span style={{color:subTextColor,overflowWrap:"anywhere"}}>{patient?.phone || "—"}</span></div>
	                <div><strong style={{color:textColor}}>{t.email}:</strong> <span style={{color:subTextColor,overflowWrap:"anywhere"}}>{patient?.email || "—"}</span></div>
	                <div><strong style={{color:textColor}}>{t.birthdate}:</strong> <span style={{color:subTextColor}}>{patient?.birthdate ? new Date(patient.birthdate).toLocaleDateString(locale) : "—"}</span></div>
	                <div><strong style={{color:textColor}}>{t.timezone}:</strong> <span style={{color:subTextColor,overflowWrap:"anywhere"}}>{labelTimeZone(patient?.timezone)}</span></div>
	                {localTime && <div><strong style={{color:textColor}}>{t.patientLocalTime}:</strong> <span style={{color:subTextColor}}>{localTime}</span></div>}
	                <div><strong style={{color:textColor}}>{t.allergies}:</strong> <span style={{color:subTextColor,overflowWrap:"anywhere"}}>{patient?.allergies || "—"}</span></div>
	              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,lineHeight:1.35}}>{t.medications}</p>
              <p style={{fontSize:uiSmallSize,color:subTextColor,marginBottom:12,lineHeight:1.5,overflowWrap:"anywhere"}}>
                {lang==="es" ? "El equipo asignado puede ver y agregar medicamentos. Solo super admin puede eliminar." : "Assigned staff can view and add medications. Only super admins can delete."}
              </p>
              {patientMedications.length === 0 ? (
                <p style={{fontSize:uiBaseSize,color:subTextColor,marginBottom:12,lineHeight:1.45}}>{lang==="es" ? "Sin medicamentos registrados." : "No medications listed."}</p>
              ) : (
                <div style={{display:"grid",gap:8,marginBottom:12}}>
                  {patientMedications.map((medication, index)=>(
                    <div key={`${medication}-${index}`} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:14,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`}}>
                      <div style={{flex:1,minWidth:0,fontSize:uiBaseSize,fontWeight:750,color:textColor,lineHeight:1.45,overflowWrap:"anywhere"}}>{medication}</div>
                      <button
                        type="button"
                        onClick={()=>removePatientMedication(index)}
                        disabled={savingMedication}
                        style={{border:"none",borderRadius:12,background:isSuperAdmin?"#FEE2E2":"#F3F4F6",color:isSuperAdmin?"#B91C1C":subTextColor,padding:"9px 12px",minHeight:44,fontSize:uiSmallSize,fontWeight:850,fontFamily:"inherit",cursor:savingMedication?"not-allowed":"pointer",opacity:savingMedication?0.55:1}}
                      >
                        {lang==="es" ? "Eliminar" : "Delete"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) auto",gap:8}}>
                <input
                  value={medicationDraft}
                  onChange={(event)=>setMedicationDraft(event.target.value)}
                  placeholder={t.medicationsPH}
                  style={{minWidth:0,height:48,border:`1px solid ${borderColor}`,outline:"none",borderRadius:14,background:darkMode?"#0F172A":"white",color:textColor,padding:"0 12px",fontSize:16,fontFamily:"inherit",fontWeight:650}}
                />
                <button onClick={addPatientMedication} disabled={savingMedication || !medicationDraft.trim()} style={{height:48,border:"none",borderRadius:14,background:"#2563EB",color:"white",padding:"0 14px",fontSize:uiBaseSize,fontWeight:850,cursor:"pointer",fontFamily:"inherit",opacity:savingMedication || !medicationDraft.trim()?0.55:1}}>
                  {lang==="es" ? "Agregar" : "Add"}
                </button>
              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12,lineHeight:1.35}}>{lang==="es" ? "Equipo asignado" : "Assigned care team"}</p>
              {selectedRoomTeam.length===0 ? (
                <p style={{fontSize:uiBaseSize,color:subTextColor,lineHeight:1.45}}>{t.teamEmpty}</p>
              ) : (
                <div style={{display:"grid",gap:10}}>
                  {selectedRoomTeam.map((member) => {
                    const canContactStaff = member.id !== currentUserId;
                    return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={()=>openStaffContact(member)}
                      onMouseDown={()=>startStaffContactPress(member)}
                      onMouseUp={cancelStaffMessagePress}
                      onMouseLeave={cancelStaffMessagePress}
                      onTouchStart={()=>startStaffContactPress(member)}
                      onTouchEnd={cancelStaffMessagePress}
                      onContextMenu={(event)=>{ if (canContactStaff) { event.preventDefault(); openStaffContact(member); } }}
                      disabled={!canContactStaff}
                      aria-label={`${lang==="es" ? "Contactar a" : "Contact"} ${member.full_name || member.display_name || "Staff"}`}
                      style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",borderRadius:14,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`,textAlign:"left",fontFamily:"inherit",cursor:canContactStaff?"pointer":"default",opacity:canContactStaff?1:0.72}}
                    >
                      <div style={{width:42,height:42,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#111827,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800}}>
                        {member.avatar_url ? <img src={member.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini(member.full_name || "S")}
                      </div>
                      <div style={{minWidth:0}}>
	                        <div style={{fontSize:uiBaseSize,fontWeight:800,color:textColor,lineHeight:1.35,overflowWrap:"anywhere"}}>{member.full_name || (lang==="es" ? "Sin nombre" : "No name")}</div>
	                        <div style={{fontSize:uiSmallSize,color:subTextColor,lineHeight:1.35,overflowWrap:"anywhere"}}>{roleName(member.role)} · {member.office_location || "—"}</div>
                      </div>
                    </button>
                  );})}
                </div>
              )}
              {canManageCareTeam && (
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${borderColor}`}}>
	                  <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,lineHeight:1.35}}>{t.manageTeam}</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
	                    <span style={{padding:"8px 12px",borderRadius:999,background:"white",border:`1px solid ${borderColor}`,fontSize:uiSmallSize,fontWeight:800,color:textColor,lineHeight:1.25}}>
                      {t.careTeamSelected}: {managedTeamIds.length}
                    </span>
                  </div>
                  <div style={{display:"grid",gap:10,marginBottom:12}}>
                    {panelCareTeamGroups.map((group)=>(
                      <div key={group.role} style={{background:darkMode?"#1F2937":"white",border:`1px solid ${borderColor}`,borderRadius:16,padding:12}}>
	                        <p style={{fontSize:uiSmallSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,lineHeight:1.35}}>{careTeamRoleLabel(group.role)}</p>
                        <div style={{display:"grid",gap:8}}>
                          {group.members.map((member)=>(
                            <label key={member.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:managedTeamIds.includes(member.id)?"#EBF5FF":(darkMode?"#111827":"#F8FBFF"),border:managedTeamIds.includes(member.id)?"1px solid #93C5FD":`1px solid ${borderColor}`,cursor:"pointer"}}>
                              <input type="checkbox" checked={managedTeamIds.includes(member.id)} onChange={()=>setManagedTeamIds((current)=>current.includes(member.id)?current.filter((entry)=>entry!==member.id):[...current, member.id])} style={{width:16,height:16,accentColor:"#2563EB"}} />
                              <div style={{flex:1,minWidth:0}}>
	                                <div style={{fontSize:uiBaseSize,fontWeight:800,color:textColor,lineHeight:1.35,overflowWrap:"anywhere"}}>{member.full_name || (lang==="es" ? "Personal" : "Staff")}</div>
	                                <div style={{fontSize:uiSmallSize,color:subTextColor,lineHeight:1.35,overflowWrap:"anywhere"}}>{roleName(member.role)}{member.office_location ? ` · ${member.office_location}` : ""}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
	                  <button onClick={saveManagedTeam} disabled={savingTeam} style={{width:"100%",padding:12,minHeight:48,borderRadius:14,border:"none",background:"#2563EB",color:"white",fontSize:uiBaseSize,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:savingTeam?0.5:1}}>
                    {savingTeam ? (lang==="es" ? "Guardando..." : "Saving...") : t.saveTeam}
                  </button>
                </div>
              )}
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12,lineHeight:1.35}}>{t.beforeMaterials}</p>
              {beforeEntries.length===0 ? (
                <p style={{fontSize:uiBaseSize,color:subTextColor,lineHeight:1.45}}>{lang==="es" ? "No hay material preoperatorio cargado todavía." : "No pre-op material has been uploaded yet."}</p>
              ) : (
                <div style={{display:"flex",gap:12,overflowX:"auto",overflowY:"hidden",overscrollBehaviorX:"contain",touchAction:"pan-x",padding:"2px 2px 8px",maxWidth:"100%"}}>
                  {beforeEntries.map((entry, index) => (
                    <button key={entry.id} type="button" onClick={()=>setPreOpViewerIndex(index)} style={{display:"block",border:"none",padding:0,background:"transparent",cursor:"pointer",flex:"0 0 118px"}}>
                      <div style={{aspectRatio:"1 / 1",borderRadius:14,overflow:"hidden",background:"#E5E7EB"}}>
                        <img src={entry.content} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>
                      <div style={{fontSize:Math.max(uiSmallSize - 1, 12),color:subTextColor,fontWeight:800,lineHeight:1.25,marginTop:6,textAlign:"left",overflowWrap:"anywhere"}}>
                        {t.uploadedBy}: {mediaUploaderName(entry)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:uiLabelSize,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,lineHeight:1.35}}>{t.internalNotes}</p>
              <p style={{fontSize:uiSmallSize,color:subTextColor,margin:"0 0 12px",lineHeight:1.45}}>{t.internalNotesHint}</p>
              {internalNotes.length===0 ? (
                <p style={{fontSize:uiBaseSize,color:subTextColor,marginBottom:12,lineHeight:1.45}}>{t.noInternalNotes}</p>
              ) : (
                <div style={{display:"grid",gap:10,marginBottom:12}}>
                  {internalNotes.map((note)=>(
                    <div key={note.id} style={{padding:"12px 14px",borderRadius:14,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",minWidth:0}}>
	                        <strong style={{color:textColor,fontSize:uiSmallSize,lineHeight:1.35,overflowWrap:"anywhere"}}>{note.sender_name && note.sender_name !== "Sistema" ? note.sender_name : roleName(note.sender_role)}</strong>
                          <span style={{padding:"4px 8px",borderRadius:999,background:internalNoteVisibilityFor(note)==="private"?"#FEF3C7":"#DBEAFE",color:internalNoteVisibilityFor(note)==="private"?"#92400E":"#1D4ED8",fontSize:Math.max(uiSmallSize - 2, 11),fontWeight:900,lineHeight:1}}>
                            {internalNoteVisibilityFor(note)==="private" ? t.privateNoteBadge : t.teamNoteBadge}
                          </span>
                        </div>
                        <span style={{fontSize:uiSmallSize,color:subTextColor,lineHeight:1.35,whiteSpace:"nowrap"}}>{fmtTime(note.created_at)} · {new Date(note.created_at).toLocaleDateString(locale)}</span>
                      </div>
	                      <div style={{fontSize:uiBaseSize,color:textColor,lineHeight:1.55,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{internalNoteText(note)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                {(["team","private"] as InternalNoteVisibility[]).map((option)=>(
                  <button
                    key={option}
                    type="button"
                    onClick={()=>setInternalNoteVisibility(option)}
                    style={{minHeight:44,border:`1px solid ${internalNoteVisibility===option?"#2563EB":borderColor}`,borderRadius:14,background:internalNoteVisibility===option?"#DBEAFE":(darkMode?"#0F172A":"white"),color:internalNoteVisibility===option?"#1D4ED8":textColor,fontFamily:"inherit",fontSize:uiSmallSize,fontWeight:900,cursor:"pointer"}}
                  >
                    {option === "team" ? t.noteVisibleTeam : t.notePrivate}
                  </button>
                ))}
              </div>
              <textarea ref={internalNoteInputRef} value={internalNoteDraft} onChange={(event)=>setInternalNoteDraft(event.target.value)} rows={3} placeholder={t.internalNotePH} style={{width:"100%",padding:"12px 14px",borderRadius:14,border:`1px solid ${borderColor}`,background:darkMode?"#0F172A":"white",color:textColor,fontFamily:"inherit",fontSize:16,resize:"vertical",marginBottom:10,lineHeight:1.5}} />
              <button onClick={saveInternalNote} disabled={savingInternalNote || !internalNoteDraft.trim()} style={{width:"100%",padding:12,minHeight:48,borderRadius:14,border:"none",background:"#2563EB",color:"white",fontSize:uiBaseSize,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:savingInternalNote || !internalNoteDraft.trim()?0.5:1}}>
                {savingInternalNote ? (lang==="es" ? "Guardando..." : "Saving...") : t.addInternalNote}
              </button>
            </div>

            {canOpenAdmin && patient?.id && (
              <button onClick={()=>window.location.href=`/admin/paciente/${patient.id}`} style={{width:"100%",padding:14,minHeight:48,borderRadius:14,border:"none",background:"#0F172A",color:"white",fontSize:uiBaseSize,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                {t.openFullRecord}
              </button>
            )}
          </div>
          {activePreOpEntry && (
            <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:"max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))"}} onClick={()=>setPreOpViewerIndex(null)}>
              <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:760,display:"grid",gap:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <button disabled={preOpViewerIndex === 0} onClick={()=>setPreOpViewerIndex((current)=>current === null ? current : Math.max(0,current - 1))} style={{width:46,height:46,border:"none",borderRadius:999,background:"rgba(255,255,255,0.96)",color:"#111827",fontSize:22,fontWeight:900,cursor:"pointer",opacity:preOpViewerIndex === 0 ? 0.4 : 1}}>‹</button>
                  <div style={{padding:"9px 13px",borderRadius:999,background:"rgba(255,255,255,0.96)",color:"#111827",fontSize:13,fontWeight:900}}>
                    {(preOpViewerIndex || 0) + 1} / {beforeEntries.length}
                  </div>
                  <button disabled={preOpViewerIndex === beforeEntries.length - 1} onClick={()=>setPreOpViewerIndex((current)=>current === null ? current : Math.min(beforeEntries.length - 1,current + 1))} style={{width:46,height:46,border:"none",borderRadius:999,background:"rgba(255,255,255,0.96)",color:"#111827",fontSize:22,fontWeight:900,cursor:"pointer",opacity:preOpViewerIndex === beforeEntries.length - 1 ? 0.4 : 1}}>›</button>
                  <button onClick={()=>setPreOpViewerIndex(null)} style={{width:46,height:46,border:"none",borderRadius:999,background:"rgba(255,255,255,0.96)",color:"#111827",fontSize:20,fontWeight:900,cursor:"pointer"}}>×</button>
                </div>
                <div style={{borderRadius:18,overflow:"hidden",background:"#0F172A",boxShadow:"0 18px 50px rgba(0,0,0,0.28)"}}>
                  <img src={activePreOpEntry.content} alt="" style={{display:"block",width:"100%",maxHeight:"78dvh",objectFit:"contain"}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
	        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; max-width: 100%; }
	        html, body { height: 100%; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; overflow-x: hidden; }
	        .shell { --app-ui-font-size: ${uiBaseSize}px; --app-ui-label-size: ${uiLabelSize}px; --app-ui-small-size: ${uiSmallSize}px; display: flex; flex-direction: column; height: 100%; min-height: -webkit-fill-available; position: absolute; inset: 0; background: ${darkMode ? "#0B141A" : "#F2F7FB"}; overflow: hidden; max-width: 100vw; }
	        .shell p, .shell label, .shell button, .shell input, .shell textarea, .shell select, .shell summary { overflow-wrap: anywhere; }
	        .shell button, .shell [role="button"], .shell input, .shell textarea, .shell select { min-height: 44px; }
        .topbar { position: relative; flex-shrink: 0; background: ${headerBg}; display: grid; grid-template-columns: minmax(52px, 1fr) minmax(280px, 760px) minmax(52px, 1fr); align-items: center; padding: 0 max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left)); z-index: 100; height: calc(98px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); box-shadow: 0 8px 24px rgba(7,51,77,0.18); }
        .topbar::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: rgba(255,255,255,0.18); box-shadow: 0 1px 0 rgba(0,0,0,0.14); }
        .topbar-logo { grid-column: 2; justify-self: center; align-self: center; height: 96px; width: min(760px, 96vw); object-fit: contain; object-position: center; display: block; }
        .topbar-actions { position: absolute; right: max(18px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 46px); transform: translateY(-50%); display: flex; align-items: center; gap: 8px; }
        .top-menu-wrap { position: relative; flex-shrink: 0; }
        .top-menu-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; border: 1px solid ${darkMode?"rgba(255,255,255,0.14)":"#BFDBFE"}; background: ${darkMode?"#253244":"#EEF6FF"}; color: ${darkMode?"#E0F2FE":"#075EA8"}; font-size: 24px; font-weight: 950; line-height: 1; display: grid; place-items: center; cursor: pointer; box-shadow: 0 2px 8px rgba(15,23,42,0.08); font-family: inherit; }
        .top-menu-panel { position: absolute; top: calc(100% + 10px); right: 0; width: min(265px, calc(100vw - 28px)); max-width: min(265px, calc(100vw - 28px)); background: ${darkMode?"#1F2C34":"#FFFFFF"}; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 16px; box-shadow: 0 18px 46px rgba(15,23,42,0.22); overflow: hidden; z-index: 260; }
        .top-menu-item { width: 100%; min-height: 48px; border: none; border-bottom: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.08)"}; background: transparent; color: ${textColor}; padding: 13px 16px; text-align: left; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 850; display: flex; align-items: center; gap: 10px; }
        .top-menu-item:last-child { border-bottom: none; }
        .top-menu-item:hover { background: ${darkMode?"#263846":"#F1F7FF"}; }
	        .admin-inline-btn { padding: 0 12px; min-height: 44px; border-radius: 999px; background: ${darkMode?"#253244":"#EEF6FF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.12)":"#BFDBFE"}; color: ${darkMode?"#E0F2FE":"#075EA8"}; font-size: var(--app-ui-small-size); font-weight: 850; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: inherit; box-shadow: 0 2px 8px rgba(15,23,42,0.08); }
        .staff-global-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; max-width: 100%; }
        .staff-plus-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; background: #007AFF; border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,122,255,0.3); font-size: 26px; line-height: 1; font-weight: 850; font-family: inherit; flex-shrink: 0; }
        .chat-exit-btn { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 1px solid ${darkMode?"rgba(255,255,255,0.12)":"#D5E4F2"}; border-radius: 50%; background: ${darkMode?"#1F2C34":"#F5F9FF"}; color: ${darkMode?"#DBEAFE":"#075EA8"}; cursor: pointer; flex-shrink: 0; font-family: inherit; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(15,23,42,0.08); }
        .chat-exit-btn:hover { background: ${darkMode?"#263846":"#EAF3FF"}; }
        .logout-icon { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; display: block; }
        .body { display: flex; flex: 1; overflow: hidden; overflow-x: hidden; position: relative; background: ${darkMode ? "#0B141A" : "#F2F7FB"}; touch-action: pan-y; }
        .sidebar { position: absolute; inset: 0; width: 100%; flex-shrink: 0; background: ${darkMode ? "#111B21" : "#F2F7FB"}; display: flex; flex-direction: column; overflow: hidden; transition: transform 0.25s ease; z-index: 10; }
        .sidebar-head { padding: 16px 16px 12px; background: ${darkMode?"#111B21":"linear-gradient(180deg,#FFFFFF 0%,#F2F7FB 100%)"}; border-bottom: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"rgba(102,132,163,0.16)"}; box-shadow: ${darkMode?"none":"0 8px 24px rgba(28,66,104,0.06)"}; }
        .sidebar-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .search-bar { display: flex; align-items: center; gap: 9px; min-height: 50px; background: ${darkMode?"#1F2C34":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.14)":"#D5E4F2"}; border-radius: 14px; padding: 9px 12px; box-shadow: ${darkMode?"none":"0 8px 22px rgba(28,66,104,0.08)"}; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; }
        .search-bar:focus-within { border-color: #2563EB; box-shadow: ${darkMode?"0 0 0 3px rgba(37,99,235,0.22)":"0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(15,23,42,0.08)"}; }
        .search-bar svg { stroke: ${darkMode?"#CBD5E1":"#64748B"}; }
        .search-input { flex: 1; border: none; background: transparent; font-size: 15px; outline: none; color: ${textColor}; font-family: inherit; font-weight: 650; min-width: 0; }
        .search-input::placeholder { color: ${darkMode?"#94A3B8":"#7C8797"}; opacity: 1; font-weight: 650; }
        .label-filter-row { display: flex; gap: 8px; overflow-x: auto; padding: 10px 2px 0; scrollbar-width: none; }
        .label-filter-row::-webkit-scrollbar { display: none; }
        .label-chip { min-height: 30px; max-width: 118px; border: none; border-radius: 999px; padding: 5px 8px; color: #FFFFFF; font-size: 12px; font-weight: 900; font-family: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
        .label-chip.all { color: ${textColor}; background: ${darkMode?"#253244":"#EAF2FB"}; border: 1px solid ${borderColor}; }
        .label-chip.active { box-shadow: 0 0 0 2px ${darkMode?"#E5E7EB":"#0F172A"} inset; }
        .label-chip-name { min-width: 0; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .label-chip-count { min-width: 17px; height: 17px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; background: rgba(255,255,255,0.28); color: inherit; font-size: 10px; line-height: 1; flex-shrink: 0; }
        .patient-label-row { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
        .patient-label-chip { max-width: 86px; border-radius: 999px; padding: 3px 7px; color: #FFFFFF; font-size: 10px; line-height: 1.2; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .label-option-row { display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 9px 10px; border: 1px solid ${borderColor}; border-radius: 14px; background: ${cardBg}; cursor: pointer; }
        .label-option-row input { width: 20px; height: 20px; min-height: 20px; flex-shrink: 0; }
        .label-option-main { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .label-manage-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .label-mini-btn { min-width: 38px; min-height: 38px; border: 1px solid ${borderColor}; border-radius: 12px; background: ${darkMode?"#253244":"#F8FAFC"}; color: ${textColor}; cursor: pointer; font-size: 13px; font-weight: 900; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; padding: 0 9px; }
        .label-mini-btn.danger { background: ${darkMode?"#3B1D24":"#FEE2E2"}; color: ${darkMode?"#FCA5A5":"#991B1B"}; border-color: ${darkMode?"#7F1D1D":"#FECACA"}; }
        .label-edit-box { display: grid; gap: 10px; padding: 12px; border: 1px solid ${borderColor}; border-radius: 14px; background: ${darkMode?"#111827":"#F8FAFC"}; }
        .label-color-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 2px 0 10px; }
        .label-color-btn { width: 34px; height: 34px; min-height: 34px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; }
        .label-color-btn.active { border-color: ${textColor}; box-shadow: 0 0 0 2px ${cardBg}; }
        .patient-list { flex: 1; overflow-y: auto; padding: 10px 12px calc(18px + env(safe-area-inset-bottom)); }
        .patient-list::-webkit-scrollbar { display: none; }
        .patient-row { position: relative; display: flex; align-items: center; gap: 12px; min-height: 86px; padding: 13px 13px; cursor: pointer; border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"rgba(102,132,163,0.16)"}; border-radius: 18px; background: ${darkMode?"#15232B":"rgba(255,255,255,0.96)"}; margin-bottom: 9px; box-shadow: ${darkMode?"none":"0 8px 24px rgba(28,66,104,0.07)"}; transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease; }
        .patient-row:hover { background: ${darkMode?"#1B2D36":"#FFFFFF"}; transform: translateY(-1px); }
        .patient-row.active { background: ${darkMode?"#203744":"#EAF5FF"}; border-color: ${darkMode?"rgba(125,211,252,0.30)":"#B9D8F2"}; }
        .patient-row.label-assign-selected { border-color: #7C3AED; box-shadow: ${darkMode?"0 0 0 2px rgba(167,139,250,0.24) inset":"0 0 0 2px rgba(124,58,237,0.22) inset, 0 8px 24px rgba(28,66,104,0.07)"}; }
        .label-assign-check { width: 34px; height: 34px; min-height: 34px; border-radius: 999px; border: 2px solid #7C3AED; background: #FFFFFF; color: #7C3AED; display: grid; place-items: center; font-size: 18px; font-weight: 950; flex-shrink: 0; }
        .label-assign-check.selected { background: #7C3AED; color: #FFFFFF; }
        .label-assign-bar { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: ${darkMode?"rgba(124,58,237,0.20)":"#F3E8FF"}; color: ${darkMode?"#DDD6FE":"#5B21B6"}; border: 1px solid ${darkMode?"rgba(196,181,253,0.28)":"#DDD6FE"}; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; font-weight: 850; line-height: 1.35; }
        .label-assign-done { min-height: 34px; border: none; border-radius: 999px; padding: 0 12px; background: #7C3AED; color: #FFFFFF; font: inherit; font-size: 13px; font-weight: 950; cursor: pointer; white-space: nowrap; }
        .patient-alert-badge { position: absolute; top: 8px; right: 10px; z-index: 3; min-width: 18px; min-height: 18px; border-radius: 999px; background: #DC2626; color: #FFFFFF; padding: 2px 6px; font-size: 12px; line-height: 1.1; font-weight: 950; display: grid; place-items: center; box-shadow: 0 8px 20px rgba(220,38,38,0.32); border: 2px solid ${darkMode ? "#15232B" : "#FFFFFF"}; }
        .patient-alert-badge.level-2 { animation: alertPulse 1.6s ease-in-out infinite; }
        .patient-alert-badge.level-3 { min-height: 24px; padding: 4px 9px; font-size: 11px; letter-spacing: 0.04em; }
        .av { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,#123E5E,#2B78B7); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 850; color: white; flex-shrink: 0; overflow: hidden; position: relative; box-shadow: 0 5px 16px rgba(16,52,83,0.18); }
        .av-badge { position: absolute; top: 0; right: 0; width: 14px; height: 14px; background: #25D366; border-radius: 50%; border: 2px solid ${darkMode ? "#15232B" : "#FFFFFF"}; }
        .av-badge.media { background: #EF4444; }
        .patient-info { flex: 1; min-width: 0; }
        .patient-main-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }
        .patient-name { font-size: 17px; font-weight: 850; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0; }
	        .patient-time { flex-shrink: 0; font-size: var(--app-ui-small-size); color: ${subTextColor}; font-weight: 750; }
	        .patient-meta { font-size: var(--app-ui-small-size); color: ${subTextColor}; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 650; }
	        .patient-preview { font-size: var(--app-ui-small-size); color: ${darkMode?"#B6C6D5":"#52677D"}; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 650; }
        .unread-count { min-width: 24px; height: 24px; padding: 0 8px; background: #25D366; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 850; box-shadow: 0 4px 12px rgba(37,211,102,0.28); }
        .unread-dot { width: 13px; height: 13px; background: #25D366; border-radius: 50%; flex-shrink: 0; }
        .main-area { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; background: ${darkMode ? "#0B141A" : "#F2F7FB"}; transition: transform 0.25s ease; z-index: 20; }
        .sidebar.hidden { transform: translateX(-100%); pointer-events: none; }
        .main-area.hidden { transform: translateX(100%); pointer-events: none; }
        .chat-bg { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; background-color: ${darkMode ? "#0B141A" : "#F7FAFD"}; background-image: ${darkMode ? "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)" : "radial-gradient(rgba(7,51,77,0.040) 1px, transparent 1px)"}; background-size: 18px 18px; overscroll-behavior-x: none; }
        .chat-bg::-webkit-scrollbar { display: none; }
        .date-sep { display: flex; justify-content: center; margin: 16px 0 12px; }
	        .date-sep-pill { background: ${darkMode?"rgba(17,27,33,0.92)":"rgba(255,255,255,0.96)"}; border-radius: 10px; padding: 6px 13px; font-size: var(--app-ui-small-size); color: ${darkMode?"#F8FAFC":"#111827"}; font-weight: 850; box-shadow: 0 1px 4px rgba(15,23,42,0.10); border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.08)"}; }
        .chat-head { flex-shrink: 0; background: ${darkMode?"#111B21":"rgba(255,255,255,0.98)"}; padding: 9px max(14px, env(safe-area-inset-right)) 9px max(14px, env(safe-area-inset-left)); display: flex; align-items: center; gap: 10px; z-index: 50; min-height: 62px; border-bottom: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"rgba(102,132,163,0.18)"}; box-shadow: ${darkMode?"none":"0 6px 18px rgba(28,66,104,0.08)"}; }
        .back-btn { width: 38px; height: 38px; border-radius: 50%; background: ${darkMode?"#1F2C34":"#EAF3FF"}; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: ${darkMode?"#DBEAFE":"#075EA8"}; font-size: 21px; font-weight: 850; transition: background 0.15s; }
        .back-btn:hover { background: ${darkMode?"#263846":"#DCEEFF"}; }
        .chat-av { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg,#123E5E,#2B78B7); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 850; color: white; flex-shrink: 0; overflow: hidden; box-shadow: 0 4px 14px rgba(16,52,83,0.18); }
        .chat-head-name { font-size: 17px; font-weight: 850; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	        .chat-head-sub { font-size: var(--app-ui-small-size); color: ${subTextColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; font-weight: 650; }
        .chat-alert-banner { position: sticky; top: 0; z-index: 49; margin: 0; padding: 9px max(16px, env(safe-area-inset-right)) 9px max(16px, env(safe-area-inset-left)); background: ${darkMode ? "rgba(127,29,29,0.34)" : "#FEE2E2"}; color: ${darkMode ? "#FECACA" : "#991B1B"}; border-bottom: 1px solid ${darkMode ? "rgba(248,113,113,0.22)" : "#FECACA"}; font-size: var(--app-ui-small-size); font-weight: 950; line-height: 1.25; }
        .chat-alert-banner.level-3 { background: #DC2626; color: #FFFFFF; border-bottom-color: #B91C1C; }
        .input-area { position: sticky; bottom: 0; flex-shrink: 0; background: ${darkMode ? "rgba(17,27,33,0.98)" : "rgba(239,244,249,0.98)"}; backdrop-filter: blur(10px); padding: 10px max(14px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); display: flex; align-items: center; gap: 10px; border-top: 1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)"}; box-shadow: 0 -8px 24px rgba(15,23,42,0.10); z-index: 42; }
        .msg-input { flex: 1; padding: 13px 18px; background: ${darkMode?"#253244":"white"}; border: none; border-radius: 999px; font-size: ${Math.max(fontSize - 1, 15)}px; font-family: inherit; color: ${textColor}; outline: none; min-width: 0; max-height: 84px; resize: none; line-height: 1.35; box-shadow: 0 3px 12px rgba(15,23,42,0.08); }
        .msg-input::placeholder { color: #AEAEB2; }
        .msg-input:empty::before { content: attr(data-placeholder); color: #AEAEB2; pointer-events: none; }
        .icon-btn { width: 64px; height: 64px; border-radius: 50%; background: ${darkMode?"#253244":"#EAF3FF"}; color: #075EA8; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 28px; transition: background 0.15s, transform 0.15s; box-shadow: 0 4px 14px rgba(15,23,42,0.08); }
        .icon-btn:hover { background: ${darkMode?"#30415A":"#DCEEFF"}; transform: translateY(-1px); }
        .plus-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; background: ${showMediaMenu ? "#007064" : darkMode ? "#253244" : "#E1E3E7"}; color: ${showMediaMenu ? "white" : "#111827"}; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 25px; line-height: 1; box-shadow: 0 3px 12px rgba(15,23,42,0.10); }
        .staff-menu-popup { position: absolute; left: max(16px, env(safe-area-inset-left)); bottom: calc(64px + env(safe-area-inset-bottom)); width: min(310px, calc(100vw - 32px)); background: white; border: 1px solid rgba(15,23,42,0.10); border-radius: 18px; overflow: hidden; box-shadow: 0 18px 45px rgba(15,23,42,0.22); z-index: 40; }
        .staff-menu-item { width: 100%; border: none; border-bottom: 1px solid rgba(15,23,42,0.08); background: white; color: #111827; padding: 18px 24px; text-align: left; cursor: pointer; font-family: inherit; font-size: 20px; font-weight: 900; }
        .staff-menu-item:last-child { border-bottom: none; }
        .send-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; background: #EAF3FF; color: #075EA8; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 3px 12px rgba(15,23,42,0.08); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .phone-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; background: transparent; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; text-decoration: none; }
        .phone-btn img { width: 30px; height: 30px; object-fit: contain; display: block; }
        .mic-btn { width: 44px; height: 44px; min-height: 44px; border-radius: 50%; background: transparent; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .mic-btn img { width: 36px; height: 36px; object-fit: contain; display: block; }
        .slash-popup { position: fixed; left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); bottom: calc(86px + env(safe-area-inset-bottom)); z-index: 45; pointer-events: none; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-height: min(42dvh, 260px); overflow-y: auto; padding: 0 0 8px; }
        .slash-item { width: fit-content; max-width: calc(100vw - 20px); border: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.10)"}; background: ${darkMode?"#253244":"white"}; color: ${textColor}; border-radius: 12px; padding: 12px 14px; text-align: left; font-size: 16px; font-weight: 600; box-shadow: 0 8px 24px rgba(15,23,42,0.16); pointer-events: auto; cursor: pointer; font-family: inherit; }
        .slash-item:hover { background: ${darkMode?"#30415A":"#F8FAFC"}; }
        @keyframes alertPulse { 0%, 100% { transform: scale(1); box-shadow: 0 8px 20px rgba(220,38,38,0.32); } 50% { transform: scale(1.12); box-shadow: 0 0 0 7px rgba(220,38,38,0.16); } }
	        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.32); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); overflow-y: auto; overflow-x: hidden; padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); }
	        .modal { background: ${darkMode?sidebarBg:"#FFFFFF"}; border-radius: 24px; width: min(560px, calc(100vw - 36px)); max-width: 100%; max-height: calc(100dvh - 36px); overflow-y: auto; overflow-x: hidden; padding: 24px; box-shadow: 0 18px 50px rgba(15,23,42,0.18); }
	        .modal-scroll { background: ${darkMode?sidebarBg:"#FFFFFF"}; border-radius: 24px 24px 0 0; width: 100%; max-width: min(560px, 100vw); position: fixed; top: 6vh; bottom: 0; left: 50%; transform: translateX(-50%); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 24px max(18px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); z-index: 201; box-shadow: 0 -12px 40px rgba(15,23,42,0.12); }
        .modal-title { font-size: 20px; font-weight: 700; color: ${textColor}; margin-bottom: 20px; }
        .room-create-modal { max-width: 680px; top: 4vh; background: ${darkMode?"#111B21":"#F8FBFF"}; padding-top: 18px; }
        .room-modal-head { background: linear-gradient(135deg,#07334D 0%,#0E4C75 100%); border-radius: 22px; padding: 18px; color: white; margin-bottom: 14px; box-shadow: 0 16px 34px rgba(7,51,77,0.18); }
	        .room-modal-kicker { font-size: var(--app-ui-label-size); font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.72); margin-bottom: 8px; }
	        .room-modal-title { font-size: clamp(27px, 7vw, 34px); font-weight: 900; line-height: 1.12; margin-bottom: 8px; overflow-wrap: anywhere; }
	        .room-modal-copy { color: rgba(255,255,255,0.88); font-size: var(--app-ui-font-size); line-height: 1.55; font-weight: 650; overflow-wrap: anywhere; }
        .room-progress { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
        .room-progress-step { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 9px 10px; border-radius: 14px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.12); color: white; font-size: 12px; font-weight: 850; }
        .room-progress-num { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,0.92); color: #07334D; font-size: 12px; font-weight: 950; flex-shrink: 0; }
        .room-create-card { background: ${darkMode?"#1F2C34":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"#DDE9F6"}; border-radius: 22px; padding: 18px; margin-bottom: 12px; box-shadow: ${darkMode?"none":"0 10px 28px rgba(28,66,104,0.07)"}; }
        .room-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .room-section-num { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #EAF5FF; color: #075EA8; font-size: 14px; font-weight: 950; flex-shrink: 0; }
        .room-section-title { color: ${textColor}; font-size: 18px; font-weight: 900; line-height: 1.15; }
	        .room-section-copy { color: ${subTextColor}; font-size: var(--app-ui-small-size); line-height: 1.5; margin-top: 2px; font-weight: 650; overflow-wrap: anywhere; }
        .room-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .room-phone-grid { display: grid; grid-template-columns: minmax(160px, 220px) 1fr; gap: 10px; }
        .room-field { min-width: 0; }
        .room-field .finput { margin-bottom: 12px; background: ${darkMode?"#253244":"#FFFFFF"}; }
        .room-toggle { background: ${darkMode?"#1F2C34":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"#DDE9F6"}; border-radius: 20px; padding: 0; margin-bottom: 12px; box-shadow: ${darkMode?"none":"0 8px 22px rgba(28,66,104,0.06)"}; overflow: hidden; }
        .room-toggle > summary { list-style: none; cursor: pointer; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .room-toggle > summary::-webkit-details-marker { display: none; }
        .room-toggle-title { color: ${textColor}; font-size: 16px; font-weight: 900; margin-bottom: 3px; }
	        .room-toggle-copy { color: ${subTextColor}; font-size: var(--app-ui-small-size); line-height: 1.5; font-weight: 650; overflow-wrap: anywhere; }
        .room-toggle-chevron { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: ${darkMode?"#253244":"#EAF3FF"}; color: #075EA8; font-size: 18px; font-weight: 900; flex-shrink: 0; transition: transform 0.16s ease; }
        .room-toggle[open] .room-toggle-chevron { transform: rotate(180deg); }
        .room-toggle-body { padding: 0 18px 18px; }
	        .room-note { background: ${darkMode?"rgba(37,99,235,0.16)":"#EAF5FF"}; border: 1px solid ${darkMode?"rgba(125,211,252,0.16)":"#CFE5FA"}; color: ${darkMode?"#DBEAFE":"#174769"}; border-radius: 16px; padding: 12px 14px; font-size: var(--app-ui-small-size); font-weight: 750; line-height: 1.5; margin-bottom: 12px; overflow-wrap: anywhere; }
        .room-action-bar { position: static; background: ${darkMode?"rgba(17,27,33,0.96)":"rgba(248,251,255,0.96)"}; backdrop-filter: blur(12px); margin: 16px calc(-1 * max(20px, env(safe-area-inset-right))) 0 calc(-1 * max(20px, env(safe-area-inset-left))); padding: 12px max(20px, env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); border-top: 1px solid ${darkMode?"rgba(255,255,255,0.10)":"#DDE9F6"}; }
        .care-team-panel { background: ${darkMode?"#2C2C2E":"#F8FBFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"#D9E4F2"}; border-radius: 18px; padding: 14px; }
        .care-team-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .care-team-count { font-size: 12px; font-weight: 850; color: ${subTextColor}; text-transform: uppercase; letter-spacing: 0.6px; }
        .care-team-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .care-team-chip { padding: 8px 12px; border-radius: 999px; border: none; background: #E8F0FE; color: #2563EB; font-size: 12px; font-weight: 850; cursor: pointer; font-family: inherit; }
        .care-team-chip.active { background: #2563EB; color: #FFFFFF; }
        .care-team-chip.secondary { background: #EEF2F7; color: #475569; }
        .care-team-chip:disabled { opacity: 0.42; cursor: not-allowed; }
        .care-team-quick-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .care-team-groups { display: grid; gap: 10px; }
        .care-team-group { border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"#E6EEF7"}; background: ${darkMode?"#17212B":"#FFFFFF"}; border-radius: 16px; padding: 10px; }
        .care-team-group-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: ${subTextColor}; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .care-team-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
        .care-team-option { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 10px 12px; border-radius: 14px; background: ${darkMode?"#111827":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"#E6EEF7"}; cursor: pointer; }
        .care-team-option.selected { background: #EBF5FF; border-color: #93C5FD; }
        .care-team-option.selected .care-team-name { color: #0F172A; }
        .care-team-option.selected .care-team-meta { color: #475569; }
        .care-team-avatar { width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg,#0F172A,#2563EB); display: grid; place-items: center; color: white; font-size: 12px; font-weight: 900; flex-shrink: 0; }
        .care-team-name { color: ${textColor}; font-size: 14px; font-weight: 900; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .care-team-meta { color: ${subTextColor}; font-size: 12px; font-weight: 700; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .care-team-empty { color: ${subTextColor}; font-size: 13px; font-weight: 700; padding: 8px 2px 0; }
	        .flabel { font-size: var(--app-ui-label-size); font-weight: 800; color: ${subTextColor}; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 7px; display: block; line-height: 1.35; }
	        .finput { width: 100%; min-height: 48px; padding: 14px 16px; background: ${darkMode?"#3A3A3C":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"#D9E4F2"}; border-radius: 14px; font-size: 16px; font-family: inherit; color: ${textColor}; outline: none; margin-bottom: 14px; line-height: 1.45; box-shadow: ${darkMode?"none":"0 1px 2px rgba(15,23,42,0.04)"}; }
        .finput::placeholder { color: #AEAEB2; }
        .loc-group { display: flex; gap: 10px; margin-bottom: 14px; }
	        .loc-opt { flex: 1; min-height: 48px; padding: 13px; border-radius: 14px; cursor: pointer; font-size: var(--app-ui-font-size); font-weight: 750; color: ${subTextColor}; background: ${darkMode?"#3A3A3C":"#FFFFFF"}; border: 1px solid ${darkMode?"rgba(255,255,255,0.08)":"#D9E4F2"}; text-align: center; box-shadow: ${darkMode?"none":"0 1px 2px rgba(15,23,42,0.04)"}; display: flex; align-items: center; justify-content: center; line-height: 1.3; }
        .loc-opt.sel { background: #EBF5FF; color: #007AFF; border-color: #007AFF; }
	        .file-box { width: 100%; min-height: 54px; padding: 16px; border: 2px dashed ${darkMode?"#555":"#C7D8EA"}; border-radius: 14px; cursor: pointer; text-align: center; font-size: var(--app-ui-font-size); font-weight: 650; color: ${subTextColor}; margin-bottom: 14px; background: ${darkMode?"transparent":"#F8FBFF"}; overflow-wrap: anywhere; line-height: 1.45; }
	        .pbtn { width: 100%; min-height: 50px; padding: 15px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: var(--app-ui-font-size); font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .pbtn:disabled { opacity: 0.45; }
	        .sbtn { width: 100%; min-height: 48px; padding: 13px; background: ${darkMode?cardBg:"#F5F8FC"}; border: 1px solid ${darkMode?"transparent":"#D9E4F2"}; border-radius: 14px; color: ${textColor}; font-size: var(--app-ui-font-size); font-weight: 750; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 40px; text-align: center; }
        @keyframes spin { to { transform: rotate(360deg); } }
	        @media (max-width: 700px) {
          .topbar { height: calc(146px + env(safe-area-inset-top)); grid-template-columns: 1fr; padding-left: max(12px, env(safe-area-inset-left)); padding-right: max(12px, env(safe-area-inset-right)); }
          .topbar-logo { grid-column: 1; justify-self: center; align-self: start; height: 92px; width: min(620px, 92vw); }
          .topbar-actions { right: max(12px, env(safe-area-inset-right)); left: max(12px, env(safe-area-inset-left)); top: auto; bottom: 8px; transform: none; justify-content: flex-end; }
          .topbar-actions .admin-inline-btn { min-height: 40px; padding: 0 10px; font-size: 14px; }
          .topbar-actions .chat-exit-btn { width: 40px; height: 40px; min-height: 40px; padding: 0; }
          .topbar-actions .staff-plus-btn { width: 40px; height: 40px; min-height: 40px; }
          .top-menu-btn { width: 40px; height: 40px; min-height: 40px; }
          .sidebar-head { padding: 15px 14px 12px; }
          .patient-list { padding-left: 10px; padding-right: 10px; }
          .chat-head { min-height: 62px; }
          .input-area { gap: 8px; padding-left: max(12px, env(safe-area-inset-left)); padding-right: max(12px, env(safe-area-inset-right)); }
          .plus-btn { width: 42px; height: 42px; font-size: 28px; }
          .icon-btn, .send-btn { width: 42px; height: 42px; font-size: 20px; }
          .phone-btn, .mic-btn { width: 42px; height: 42px; }
          .phone-btn img { width: 30px; height: 30px; }
          .mic-btn img { width: 36px; height: 36px; }
          .msg-input { padding: 15px 18px; }
	          .modal, .modal-scroll, .settings-sheet, .patient-info-sheet { width: 100%; max-width: 100vw; }
	          .room-create-modal { top: 0; max-height: 100dvh; border-radius: 0; }
	          .room-modal-head { border-radius: 0 0 22px 22px; margin-left: calc(-1 * max(20px, env(safe-area-inset-left))); margin-right: calc(-1 * max(20px, env(safe-area-inset-right))); margin-top: -18px; padding-top: calc(18px + env(safe-area-inset-top)); }
	          .room-modal-title { font-size: clamp(28px, 8.2vw, 34px); }
	          .room-progress { grid-template-columns: 1fr; }
	          .room-grid-2, .room-phone-grid { grid-template-columns: 1fr; }
	          .room-progress-step { padding: 8px 10px; }
          .chat-exit-btn { width: 40px; height: 40px; min-height: 40px; padding: 0; }
	        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){setPendingPrescriptionFile(f);setPrescriptionLabel("");setPrescriptionInstructions("");setShowMediaMenu(false);}e.target.value="";}}/>
      <input ref={galleryInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)stagePreview(f);e.target.value="";}}/>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)stagePreview(f);e.target.value="";}}/>
      <input ref={audioInputRef} type="file" accept="audio/*" capture style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)stagePreview(f);e.target.value="";}}/>
      <input ref={videoInputRef} type="file" accept="video/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)stagePreview(f);e.target.value="";}}/>
      <input ref={profilePicRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)setProfilePicFile(f);}}/>
      <input ref={beforePhotosRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>setBeforePhotosFiles(p=>[...p,...Array.from(e.target.files||[])])}/>

      {(captureMode || preparingCapture) && (
        <div className="modal-overlay" onClick={cancelCapture}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"88vh",paddingTop:16}}>
            <p style={{fontSize:18,fontWeight:700,marginBottom:12,color:textColor}}>
              {preparingCapture ? t.preparingCamera : captureMode==="photo" ? t.takePhoto : t.recordVideoOption}
            </p>
            <div style={{background:"#000",borderRadius:18,overflow:"hidden",aspectRatio:"3 / 4",display:"grid",placeItems:"center",marginBottom:14}}>
              {preparingCapture ? (
                <span style={{color:"white",fontWeight:700}}>{t.preparingCamera}</span>
              ) : (
                <video ref={mediaCaptureVideoRef} muted playsInline autoPlay style={{width:"100%",height:"100%",objectFit:"cover"}} />
              )}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={cancelCapture} className="sbtn" style={{marginTop:0,flex:1}}>{t.cancelCapture}</button>
              {captureMode==="photo" ? (
                <button onClick={takePhotoNow} className="pbtn" style={{marginTop:0,flex:1}}>{t.takePhotoNow}</button>
              ) : (
                <button onClick={sendCapturedVideo} className="pbtn" style={{marginTop:0,flex:1,background:"#DC2626"}}>{t.stopAndSendVideo}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewFile && previewUrl && (
        <div className="modal-overlay" onClick={clearPreview}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"88vh",paddingTop:16}}>
            <p style={{fontSize:18,fontWeight:700,marginBottom:6,color:textColor}}>
              {previewType==="audio" ? t.reviewAudio : previewType==="image" ? t.reviewPhoto : previewType==="video" ? t.reviewVideo : t.reviewCapture}
            </p>
            <p style={{fontSize:13,color:subTextColor,marginBottom:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {previewFile.name}
            </p>
            <div style={{background:darkMode?"#0B1120":"#F8FAFC",border:`1px solid ${borderColor}`,borderRadius:18,overflow:"hidden",display:"grid",placeItems:"center",minHeight:previewType==="audio"?92:220,marginBottom:14}}>
              {previewType==="image" ? (
                <img src={previewUrl} alt="" style={{width:"100%",maxHeight:"58vh",objectFit:"contain",display:"block"}} />
              ) : previewType==="video" ? (
                <video src={previewUrl} controls playsInline style={{width:"100%",maxHeight:"58vh",display:"block",background:"#000"}} />
              ) : previewType==="audio" ? (
                <audio src={previewUrl} controls style={{width:"calc(100% - 28px)"}} />
              ) : (
                <div style={{padding:18,fontSize:14,fontWeight:700,color:textColor,textAlign:"center",wordBreak:"break-word"}}>
                  {previewFile.name}
                </div>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={clearPreview} className="sbtn" style={{marginTop:0}}>{t.cancelCapture}</button>
              <button onClick={sendPreview} className="pbtn" style={{marginTop:0}} disabled={sending}>
                {previewType==="audio" ? t.sendRecording : t.send}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadMenu&&pendingFile&&(
        <div className="modal-overlay" onClick={()=>{setShowUploadMenu(false);setPendingFile(null);}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"50vh"}}>
            <p style={{fontSize:18,fontWeight:700,marginBottom:6,color:textColor}}>{t.fileCategory}</p>
            <p style={{fontSize:13,color:subTextColor,marginBottom:16}}>{pendingFile.name}</p>
            {([{c:"medication" as FileCategory,icon:"💊",label:t.medication,sub:t.medicationSub}]).map(opt=>(
              <button key={opt.c} onClick={()=>confirmUpload(opt.c)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"13px 14px",background:cardBg,border:`1px solid ${borderColor}`,borderRadius:14,cursor:"pointer",marginBottom:8,fontFamily:"inherit"}}>
                <span style={{fontSize:28}}>{opt.icon}</span>
                <div style={{textAlign:"left"}}><p style={{fontSize:15,fontWeight:700,color:textColor,margin:0}}>{opt.label}</p><p style={{fontSize:12,color:subTextColor,margin:0}}>{opt.sub}</p></div>
              </button>
            ))}
            <button onClick={()=>{setShowUploadMenu(false);setPendingFile(null);}} className="sbtn">{t.cancel}</button>
          </div>
        </div>
      )}

      {showNewRoom&&(
        <div className="modal-overlay" onClick={()=>setShowNewRoom(false)}>
          <div className="modal-scroll room-create-modal" onClick={e=>e.stopPropagation()}>
            <div className="room-modal-head">
              <p className="room-modal-kicker">{lang==="es" ? "Nuevo expediente" : "New record"}</p>
              <p className="room-modal-title">{t.newRoom}</p>
              <p className="room-modal-copy">
                {lang==="es"
                  ? "Crea el chat con lo esencial. El equipo puede completar datos clínicos después desde el expediente."
                  : "Create the chat with only the essentials. The team can complete clinical details later from the record."}
              </p>
            </div>
            {newRoomError && <div style={{background:"#FFF1F2",color:"#E11D48",borderRadius:14,padding:"12px 14px",fontSize:14,fontWeight:800,marginBottom:14}}>⚠️ {t.fixErrors} {newRoomError}</div>}

            <section className="room-create-card">
              <div className="room-section-head">
                <div className="room-section-num">1</div>
                <div>
                  <p className="room-section-title">{lang==="es" ? "Datos para abrir la sala" : "Room essentials"}</p>
                  <p className="room-section-copy">
                    {lang==="es" ? "Solo nombre del paciente, procedimiento y consultorio son necesarios." : "Only patient name, procedure, and office are needed."}
                  </p>
                </div>
              </div>

              <div className="room-field">
                <label className="flabel">{t.patientFirstName}</label>
                <input className="finput" placeholder={t.patientFirstNamePH} value={newPatientFirstName} onChange={e=>{setNewPatientFirstName(e.target.value);if(newRoomError)setNewRoomError("");}}/>
              </div>

              <div className="room-phone-grid">
                <div className="room-field">
                  <label className="flabel">{t.phoneCode}</label>
                  <select className="finput" value={newPatientPhoneCountry} onChange={e=>setNewPatientPhoneCountry(e.target.value)}>
                    {PHONE_COUNTRY_OPTIONS.map((option)=>(
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="room-field">
                  <label className="flabel">{t.phone}</label>
                  <input className="finput" inputMode="tel" placeholder={t.phonePH} value={newPatientPhoneLocal} onChange={e=>{setNewPatientPhoneLocal(formatPhoneLocal(e.target.value));if(newRoomError)setNewRoomError("");}}/>
                </div>
              </div>

              <div className="room-grid-2">
                <div className="room-field">
                  <label className="flabel">{t.procedure}</label>
                  <input className="finput" placeholder={t.procedurePH} value={newProcedureName} onChange={e=>{setNewProcedureName(e.target.value);if(newRoomError)setNewRoomError("");}}/>
                </div>
                <div className="room-field">
                  <label className="flabel">{t.surgeryDate}</label>
                  <input className="finput" inputMode="numeric" placeholder={t.surgeryDatePH} value={isoToDisplayDate(newSurgeryDate)} onChange={e=>setNewSurgeryDate(formatDateTyping(e.target.value))}/>
                </div>
              </div>

              <label className="flabel">{t.location}</label>
              <div className="loc-group">
                <div className={`loc-opt${newLocation==="Guadalajara"?" sel":""}`} onClick={()=>setNewLocation("Guadalajara")}>{t.gdl}</div>
                <div className={`loc-opt${newLocation==="Tijuana"?" sel":""}`} onClick={()=>setNewLocation("Tijuana")}>{t.tjn}</div>
              </div>

              <label className="flabel">{t.preferredLanguage}</label>
              <div className="loc-group" style={{marginBottom:0}}>
                {PATIENT_LANGUAGE_OPTIONS.map((option)=>(
                  <div key={option.value} className={`loc-opt${newPatientLanguage===option.value?" sel":""}`} onClick={()=>setNewPatientLanguage(option.value)}>
                    {lang==="es" ? option.labelEs : option.labelEn}
                  </div>
                ))}
              </div>
            </section>

            <details className="room-toggle">
              <summary>
                <div>
                  <p className="room-toggle-title">{lang==="es" ? "Datos opcionales del paciente" : "Optional patient details"}</p>
                  <p className="room-toggle-copy">
                    {lang==="es" ? "Correo, nacimiento, horario, alergias, medicamentos y fotos." : "Email, birth date, time zone, allergies, medications, and photos."}
                  </p>
                </div>
                <span className="room-toggle-chevron">⌄</span>
              </summary>
              <div className="room-toggle-body">
                <div className="room-field">
                  <label className="flabel">{t.email}</label>
                  <input className="finput" type="email" placeholder={t.emailPH} value={newPatientEmail} onChange={e=>{setNewPatientEmail(e.target.value);if(newRoomError)setNewRoomError("");}}/>
                </div>
                <div className="room-grid-2">
                  <div className="room-field">
                    <label className="flabel">{t.birthdate}</label>
                    <input className="finput" inputMode="numeric" placeholder={t.birthdatePH} value={isoToDisplayDate(newBirthdate)} onChange={e=>setNewBirthdate(formatDateTyping(e.target.value))}/>
                  </div>
                  <div className="room-field">
                    <label className="flabel">{t.timezone}</label>
                    <select className="finput" value={newPatientTimezone} onChange={e=>setNewPatientTimezone(e.target.value)}>
                      {PATIENT_TIMEZONE_OPTIONS.map((option)=>(
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="room-note">
                  {lang==="es"
                    ? "El horario ayuda al equipo médico a responder sin confundir la hora local del paciente."
                    : "The time zone helps the medical team reply without confusing the patient's local time."}
                </p>
                <label className="flabel">{t.allergies}</label>
                <textarea className="finput" placeholder={t.allergiesPH} value={newPatientAllergies} onChange={e=>setNewPatientAllergies(e.target.value)} rows={3} style={{resize:"vertical"}}/>
                <label className="flabel">{t.medications}</label>
                <textarea className="finput" placeholder={t.medicationsPH} value={newPatientMedications} onChange={e=>setNewPatientMedications(e.target.value)} rows={3} style={{resize:"vertical"}}/>
                <label className="flabel">📸 {t.profilePic}</label>
                <div className="file-box" onClick={()=>profilePicRef.current?.click()}>
                  {profilePicFile?<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><img src={URL.createObjectURL(profilePicFile)} alt="" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover"}}/><span>{profilePicFile.name}</span></div>:t.tapProfilePic}
                </div>
                <label className="flabel">📷 {t.beforePhotos}</label>
                {beforePhotosFiles.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{beforePhotosFiles.map((f,i)=><img key={i} src={URL.createObjectURL(f)} style={{width:60,height:60,borderRadius:10,objectFit:"cover"}} alt=""/>)}</div>}
                <div className="file-box" onClick={()=>beforePhotosRef.current?.click()}>
                  {beforePhotosFiles.length===0?t.tapBeforePhotos:`📷 ${beforePhotosFiles.length} foto(s)`}
                </div>
              </div>
            </details>

            <details className="room-toggle">
              <summary>
                <div>
                  <p className="room-toggle-title">{t.careTeam}</p>
                  <p className="room-toggle-copy">
                    {careTeamSelectedMembers.length > 0
                      ? `${t.careTeamSelected}: ${careTeamSelectedMembers.length}`
                      : t.noTeamSelected}
                  </p>
                </div>
                <span className="room-toggle-chevron">⌄</span>
              </summary>
              <div className="room-toggle-body">
                <p className="room-note">{t.careTeamHint}</p>
                <div className="care-team-panel">
                  <div className="care-team-toolbar">
                    <p className="care-team-count">
                      {t.careTeamSelected}: {careTeamSelectedMembers.length} · {staffDirectory.length} {lang==="es" ? "en el equipo" : "on team"}
                    </p>
                    <div className="care-team-actions">
                      {([
                        { key: "all", label: t.careTeamShowAll },
                        { key: "guadalajara", label: t.careTeamFilterGdl },
                        { key: "tijuana", label: t.careTeamFilterTjn },
                        { key: "selected", label: t.careTeamFilterSelected },
                      ] as { key: CareTeamFilter; label: string }[]).map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          className={`care-team-chip${careTeamFilter === filter.key ? " active" : ""}`}
                          onClick={() => setCareTeamFilter(filter.key)}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="care-team-quick-row">
                      <button
                        type="button"
                        className="care-team-chip"
                        onClick={() => addCareTeamMembers(guadalajaraDoctors)}
                        disabled={guadalajaraDoctors.length === 0}
                      >
                        {t.careTeamDoctorsGdl}
                      </button>
                      <button
                        type="button"
                        className="care-team-chip"
                        onClick={() => addCareTeamMembers(tijuanaDoctors)}
                        disabled={tijuanaDoctors.length === 0}
                      >
                        {t.careTeamDoctorsTjn}
                      </button>
                      <button
                        type="button"
                        className="care-team-chip secondary"
                        onClick={() => setSelectedCareTeamIds(currentUserId ? [currentUserId] : [])}
                      >
                        {t.careTeamClear}
                      </button>
                  </div>
                  <div className="care-team-groups">
                    {careTeamOfficeGroups.map((group) => (
                      <div className="care-team-group" key={group.key}>
                        <div className="care-team-group-head">
                          <span>{group.label}</span>
                          <span>{group.members.length}</span>
                        </div>
                        <div className="care-team-list">
                          {group.members.map((member)=>(
                            <label key={member.id} className={`care-team-option${selectedCareTeamIds.includes(member.id) ? " selected" : ""}`}>
                              <input type="checkbox" checked={selectedCareTeamIds.includes(member.id)} onChange={()=>toggleCareTeamMember(member.id)} style={{width:16,height:16,accentColor:"#2563EB",flexShrink:0}} />
                              <div className="care-team-avatar">
                                {member.avatar_url ? <img src={member.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini(member.full_name || member.display_name || "S")}
                              </div>
                              <div style={{minWidth:0,flex:1}}>
                                <div className="care-team-name">{member.full_name || member.display_name || (lang==="es"?"Personal":"Staff")}</div>
                                <div className="care-team-meta">{roleName(member.role)}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {careTeamOfficeGroups.length === 0 && (
                    <div className="care-team-empty">{lang==="es" ? "No hay personal visible con este filtro." : "No staff visible with this filter."}</div>
                  )}
                </div>
                <p style={{fontSize:12,color:subTextColor,marginTop:10,marginBottom:0,lineHeight:1.45,fontWeight:650}}>
                  {t.noTeamSelected}
                </p>
              </div>
            </details>

            <div className="room-action-bar">
              <button className="pbtn" onClick={createRoom} disabled={creatingRoom}>{creatingRoom?t.creating:t.createRoom}</button>
              {newRoomError && (
                <div style={{background:"#FFF1F2",color:"#E11D48",borderRadius:12,padding:"10px 12px",fontSize:13,fontWeight:800,marginTop:8,marginBottom:4}}>
                  ⚠️ {newRoomError}
                </div>
              )}
              <button className="sbtn" onClick={()=>setShowNewRoom(false)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {createdRoomLink&&(
        <div className="modal-overlay" onClick={()=>setCreatedRoomLink(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:52,marginBottom:10}}>🎉</div>
              <p style={{fontSize:20,fontWeight:700,color:textColor}}>{t.roomCreated}</p>
              <p style={{fontSize:15,color:subTextColor,marginTop:4}}>{t.shareLink} <strong style={{color:textColor}}>{createdPatientName}</strong></p>
              <p style={{fontSize:13,color:subTextColor,marginTop:8,lineHeight:1.45}}>
                {lang==="es"
                  ? "El equipo asignado verá la sala dentro del portal; no se les manda enlace por texto."
                  : "Assigned staff will see the room inside the portal; no text link is sent to them."}
              </p>
            </div>
            <div style={{background:darkMode?"#3A3A3C":"#F2F2F7",borderRadius:12,padding:"12px 14px",marginBottom:16,wordBreak:"break-all",fontSize:13,color:"#007AFF"}}>{createdRoomLink}</div>
            <button onClick={copyLink} style={{width:"100%",padding:14,background:linkCopied?"#34C759":"#007AFF",border:"none",borderRadius:14,color:"white",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{linkCopied?t.copied:t.copyLink}</button>
            <button onClick={whatsAppLink} style={{width:"100%",padding:14,background:"#25D366",border:"none",borderRadius:14,color:"white",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{t.whatsapp}</button>
            <button onClick={()=>setCreatedRoomLink(null)} className="sbtn">{t.done}</button>
          </div>
        </div>
      )}

      {callOverlayOpen && activeCallUrl && (
        <div style={{position:"fixed",inset:0,zIndex:260,background:"rgba(2,6,23,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div style={{width:"min(1180px,100%)",height:"min(92dvh,900px)",background:"#020617",borderRadius:18,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(148,163,184,0.35)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",background:"rgba(15,23,42,0.95)",borderBottom:"1px solid rgba(148,163,184,0.2)"}}>
              <div style={{color:"white",fontSize:14,fontWeight:800}}>🎥 {t.videoCall}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>{ if (activeCallRoomName) shareCallInvite(activeCallRoomName); }} style={{border:"none",borderRadius:10,padding:"8px 10px",background:"rgba(37,99,235,0.2)",color:"white",fontSize:12,fontWeight:800,cursor:"pointer"}}>🔗 {t.shareInvite}</button>
                <button onClick={()=>closeCallOverlay()} style={{border:"none",borderRadius:10,padding:"8px 10px",background:"#DC2626",color:"white",fontSize:12,fontWeight:800,cursor:"pointer"}}>📴 {t.endAndReturn}</button>
              </div>
            </div>
            {callInviteFeedback && (
              <div style={{padding:"8px 12px",fontSize:12,fontWeight:700,color:"#BFDBFE",background:"rgba(30,58,138,0.45)"}}>
                {callInviteFeedback}
              </div>
            )}
            <iframe
              src={activeCallUrl}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              style={{border:"none",width:"100%",height:"100%",background:"#000"}}
              title="Video Call"
            />
          </div>
        </div>
      )}

      {pendingPrescriptionFile && (
        <div className="modal-overlay" onClick={()=>{setPendingPrescriptionFile(null);setPrescriptionLabel("");setPrescriptionInstructions("");}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
            <p className="modal-title">{t.prescriptions}</p>
            <label className="flabel">{t.prescriptionFile}</label>
            <div style={{padding:"13px 16px",border:`1px solid ${borderColor}`,borderRadius:14,background:cardBg,color:textColor,fontWeight:800,marginBottom:14,wordBreak:"break-word"}}>
              {pendingPrescriptionFile.name}
            </div>
            <label className="flabel">{t.prescriptionLabel}</label>
            <textarea
              className="finput"
              rows={2}
              value={prescriptionLabel}
              onChange={(e)=>setPrescriptionLabel(e.target.value)}
              placeholder={t.prescriptionLabelPH}
              style={{resize:"vertical",minHeight:72}}
            />
            <label className="flabel">{t.prescriptionInstructions}</label>
            <textarea
              className="finput"
              rows={3}
              value={prescriptionInstructions}
              onChange={(e)=>setPrescriptionInstructions(e.target.value)}
              placeholder={t.prescriptionInstructionsPH}
              style={{resize:"vertical",minHeight:96}}
            />
            <button
              className="pbtn"
              disabled={!prescriptionLabel.trim() || sending}
              onClick={async()=>{
                const file = pendingPrescriptionFile;
                const label = prescriptionLabel.trim();
                const instructions = prescriptionInstructions.trim();
                if (!file || !label) return;
                setPendingPrescriptionFile(null);
                setPrescriptionLabel("");
                setPrescriptionInstructions("");
                await uploadFile(file,"medication",instructions ? `${label}\n${instructions}` : label);
              }}
            >
              {sending ? (lang==="es" ? "Guardando..." : "Saving...") : t.savePrescription}
            </button>
            <button className="sbtn" onClick={()=>{setPendingPrescriptionFile(null);setPrescriptionLabel("");setPrescriptionInstructions("");}}>{t.cancel}</button>
          </div>
        </div>
      )}

      {showMediaLibrary && (
        <div className="modal-overlay" onClick={()=>setShowMediaLibrary(false)}>
          <div className="modal-scroll" onClick={e=>e.stopPropagation()} style={{maxWidth:760}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p className="modal-title" style={{margin:0}}>🖼️ {lang==="es"?"Media del paciente":"Patient media"}</p>
              <button onClick={()=>setShowMediaLibrary(false)} style={{background:cardBg,border:"none",borderRadius:999,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer",color:textColor,fontFamily:"inherit"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {([
                { key:"media", label: lang==="es" ? "Media" : "Media" },
                { key:"audio", label: lang==="es" ? "Audios" : "Audio" },
                { key:"prescriptions", label: lang==="es" ? "Recetas" : "Prescriptions" },
                { key:"forms", label: t.forms },
                { key:"docs", label: lang==="es" ? "Archivos" : "Files" },
              ] as { key: MediaTab; label: string }[]).map((tab)=>(
                <button key={tab.key} onClick={()=>setMediaLibraryTab(tab.key)} style={{padding:"10px 14px",borderRadius:999,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:800,background:mediaLibraryTab===tab.key?"#DBEAFE":cardBg,color:mediaLibraryTab===tab.key?"#1D4ED8":textColor}}>
                  {tab.label}
                </button>
              ))}
            </div>
            {mediaLibraryTab==="media" && (
              <div style={{display:"flex",gap:10,overflowX:"auto",overflowY:"hidden",scrollSnapType:"x mandatory",overscrollBehaviorX:"contain",touchAction:"pan-x",padding:"2px 2px 10px",maxWidth:"100%",WebkitOverflowScrolling:"touch"}}>
                {roomImageVideoEntries.length===0 && <div style={{fontSize:14,color:subTextColor}}>{lang==="es"?"Sin imágenes o videos todavía.":"No images or videos yet."}</div>}
                {roomImageVideoEntries.map((entry:any)=>(
                  <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{display:"block",borderRadius:14,overflow:"hidden",textDecoration:"none",background:darkMode?"#111827":"#F8FAFC",border:`1px solid ${borderColor}`,width:"min(76vw,240px)",minWidth:"min(76vw,240px)",scrollSnapAlign:"start"}}>
                    {entry.message_type==="image" ? (
                      <img src={entry.content} alt="" style={{width:"100%",height:180,maxHeight:300,objectFit:"cover",display:"block"}} />
                    ) : (
                      <video src={entry.content} style={{width:"100%",height:180,maxHeight:300,objectFit:"cover",display:"block"}} />
                    )}
                    <div style={{padding:"8px 10px",display:"grid",gap:3}}>
                      <div style={{fontSize:12,color:subTextColor}}>{fmtDateLabel(entry.created_at)}</div>
                      <div style={{fontSize:12,color:textColor,fontWeight:850,overflowWrap:"anywhere"}}>{t.uploadedBy}: {mediaUploaderName(entry)}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {mediaLibraryTab==="audio" && (
              <div style={{display:"grid",gap:10}}>
                {roomAudioEntries.length===0 && <div style={{fontSize:14,color:subTextColor}}>{lang==="es"?"Sin audios todavía.":"No audio files yet."}</div>}
                {roomAudioEntries.map((entry:any)=>(
                  <div key={entry.id} style={{padding:12,borderRadius:14,background:cardBg,border:`1px solid ${borderColor}`}}>
                    <audio src={entry.content} controls style={{width:"100%"}} />
                    <div style={{fontSize:12,color:subTextColor,fontWeight:800,marginTop:6,overflowWrap:"anywhere"}}>{t.uploadedBy}: {mediaUploaderName(entry)}</div>
                  </div>
                ))}
              </div>
            )}
            {mediaLibraryTab==="prescriptions" && (
              <div style={{display:"grid",gap:10}}>
                <div style={{fontSize:13,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6}}>{t.prescriptions}</div>
                {roomPrescriptionEntries.length===0 && <div style={{fontSize:14,color:subTextColor}}>{t.noPrescriptions}</div>}
                {roomPrescriptionEntries.map((entry:any)=>(
                  <div key={entry.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:14,background:cardBg,border:`1px solid ${borderColor}`,textDecoration:"none",color:textColor}}>
                    <span style={{fontSize:22}}>💊</span>
                    {(() => {
                      const info = prescriptionInfo(entry);
                      return (
                        <a href={entry.content} target="_blank" rel="noopener noreferrer" style={{display:"grid",gap:3,flex:1,minWidth:0,textDecoration:"none",color:textColor}}>
                          <div style={{fontWeight:800,fontSize:14,overflowWrap:"anywhere"}}>{info.title}</div>
                          {info.instructions && <div style={{fontWeight:600,fontSize:12,color:subTextColor,lineHeight:1.35,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{info.instructions}</div>}
                          <div style={{fontWeight:800,fontSize:12,color:subTextColor}}>{t.uploadedBy}: {mediaUploaderName(entry)}</div>
                        </a>
                      );
                    })()}
                    <button type="button" onClick={()=>openPrescriptionRename(entry)} style={{border:"none",borderRadius:12,background:"#DBEAFE",color:"#1D4ED8",padding:"9px 10px",fontFamily:"inherit",fontSize:12,fontWeight:900,cursor:"pointer",flexShrink:0}}>
                      {lang === "es" ? "Editar" : "Edit"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {mediaLibraryTab==="forms" && (
              <div style={{display:"grid",gap:10}}>
                <div style={{fontSize:13,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6}}>{t.formFolderTitle}</div>
                {roomFormEntries.length===0 && <div style={{fontSize:14,color:subTextColor}}>{t.noForms}</div>}
                {roomFormEntries.map((entry:any)=> {
                  const payload = parseFormMessage(entry.content);
                  if (!payload && isClinicalFormPdfEntry(entry)) {
                    return (
                      <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:16,background:cardBg,border:`1px solid ${borderColor}`,textDecoration:"none",color:textColor}}>
                        <span style={{fontSize:24}}>📄</span>
                        <div style={{display:"grid",gap:3,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:900,overflowWrap:"anywhere"}}>{`${entry.file_name || ""}`.replace(/^\[FORM PDF\]\s*/, "") || (lang==="es" ? "Historia clínica PDF" : "Clinical history PDF")}</div>
                          <div style={{fontSize:12,fontWeight:800,color:subTextColor}}>{fmtDateLabel(entry.created_at || "")}</div>
                        </div>
                      </a>
                    );
                  }
                  if (!payload) return null;
                  return (
                    <div key={entry.id} style={{display:"grid",gap:10,padding:12,borderRadius:16,background:cardBg,border:`1px solid ${borderColor}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:16,fontWeight:900,color:textColor}}>{formExportTitle(entry)}</div>
                          <div style={{fontSize:12,fontWeight:800,color:subTextColor}}>{fmtDateLabel(entry.created_at || "")}</div>
                        </div>
                        <div style={{fontSize:12,fontWeight:900,color:"#1D4ED8",background:"#DBEAFE",borderRadius:999,padding:"6px 10px"}}>{t.forms}</div>
                      </div>
                      <FormMessage payload={payload} lang={lang} templateUrl="/forms/historia-clinica.pdf" />
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))",gap:8}}>
                        <button type="button" onClick={()=>void shareFormEntry(entry)} style={{minHeight:44,border:"none",borderRadius:12,background:"#DBEAFE",color:"#1D4ED8",fontFamily:"inherit",fontSize:14,fontWeight:900,cursor:"pointer"}}>{t.shareForm}</button>
                        <button type="button" onClick={()=>emailFormEntry(entry)} style={{minHeight:44,border:"none",borderRadius:12,background:"#FEF3C7",color:"#92400E",fontFamily:"inherit",fontSize:14,fontWeight:900,cursor:"pointer"}}>{t.emailForm}</button>
                        <button type="button" onClick={()=>messageFormEntry(entry)} style={{minHeight:44,border:"none",borderRadius:12,background:"#DCFCE7",color:"#166534",fontFamily:"inherit",fontSize:14,fontWeight:900,cursor:"pointer"}}>{t.messageForm}</button>
                        <button type="button" onClick={()=>printFormEntry(entry)} style={{minHeight:44,border:"none",borderRadius:12,background:"#E0E7FF",color:"#3730A3",fontFamily:"inherit",fontSize:14,fontWeight:900,cursor:"pointer"}}>{t.printForm}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {mediaLibraryTab==="docs" && (
              <div style={{display:"grid",gap:10}}>
                <div style={{fontSize:13,fontWeight:900,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6}}>{lang==="es" ? "Archivos" : "Files"}</div>
                {roomFileEntries.length===0 && <div style={{fontSize:14,color:subTextColor}}>{lang==="es"?"Sin archivos todavía.":"No files yet."}</div>}
                {roomFileEntries.map((entry:any)=>(
                  <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:12,borderRadius:14,background:cardBg,border:`1px solid ${borderColor}`,textDecoration:"none",color:textColor}}>
                    <span style={{fontSize:22}}>📄</span>
                    <div style={{display:"grid",gap:3,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,overflowWrap:"anywhere"}}>{entry.file_name || (lang==="es"?"Archivo":"File")}</div>
                      <div style={{fontWeight:800,fontSize:12,color:subTextColor,overflowWrap:"anywhere"}}>{t.uploadedBy}: {mediaUploaderName(entry)}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCareStaffInvite && selectedRoom && (
        <div className="modal-overlay" onClick={()=>setShowCareStaffInvite(false)}>
          <div className="modal-scroll" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <p className="modal-title" style={{margin:0}}>{t.addCareStaff}</p>
                <p style={{fontSize:uiSmallSize,color:subTextColor,lineHeight:1.45,marginTop:4}}>{t.addCareStaffHint}</p>
              </div>
              <button onClick={()=>setShowCareStaffInvite(false)} style={{background:cardBg,border:"none",borderRadius:999,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer",color:textColor,fontFamily:"inherit"}}>✕</button>
            </div>
            <input
              className="finput"
              value={careStaffSearch}
              onChange={(event)=>setCareStaffSearch(event.target.value)}
              placeholder={t.staffSearch}
              style={{marginBottom:12}}
            />
            <div style={{display:"grid",gap:8,maxHeight:"50dvh",overflowY:"auto",paddingRight:2}}>
              {careStaffInviteDirectory.length === 0 ? (
                <p style={{fontSize:uiBaseSize,color:subTextColor,lineHeight:1.45}}>{t.noStaffFound}</p>
              ) : careStaffInviteDirectory.map((member)=> {
                const alreadyAssigned = selectedRoomTeam.some((entry)=>entry.id === member.id);
                const checked = alreadyAssigned || careStaffInviteIds.includes(member.id);
                return (
                  <label key={member.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:14,border:`1px solid ${checked?"#93C5FD":borderColor}`,background:checked?"#EBF5FF":cardBg,cursor:alreadyAssigned?"default":"pointer",opacity:alreadyAssigned?0.72:1}}>
                    <input type="checkbox" checked={checked} disabled={alreadyAssigned} onChange={()=>setCareStaffInviteIds((current)=>current.includes(member.id)?current.filter((id)=>id!==member.id):[...current,member.id])} style={{width:18,height:18,accentColor:"#2563EB"}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:uiBaseSize,fontWeight:900,color:textColor,overflowWrap:"anywhere"}}>{member.full_name || member.display_name || (lang==="es"?"Personal":"Staff")}</div>
                      <div style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:750,overflowWrap:"anywhere"}}>
                        {roleName(member.role)}{member.office_location ? ` · ${member.office_location}` : ""}{member.phone ? ` · ${member.phone}` : ""}
                      </div>
                    </div>
                    {alreadyAssigned && <span style={{fontSize:12,fontWeight:900,color:"#166534"}}>{lang==="es"?"Asignado":"Added"}</span>}
                  </label>
                );
              })}
            </div>
            <button className="pbtn" disabled={savingTeam || careStaffInviteIds.length===0} onClick={addCareStaffToSelectedRoom} style={{marginTop:14}}>
              {savingTeam ? (lang==="es"?"Guardando...":"Saving...") : t.inviteStaff}
            </button>
          </div>
        </div>
      )}

      {showSettings && SettingsPanel()}
      {showStaffChats && StaffChatsPanel()}
      {showPatientInfo&&selectedRoom&&PatientInfoPanel()}
      {editingPrescriptionEntry && (
        <div className="modal-overlay" onClick={()=>setEditingPrescriptionEntry(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:460}}>
            <p className="modal-title">{lang === "es" ? "Editar nombre de receta" : "Edit prescription name"}</p>
            <label className="flabel">{lang === "es" ? "Nombre visible" : "Display name"}</label>
            <input
              className="finput"
              value={prescriptionEditTitle}
              onChange={(event)=>setPrescriptionEditTitle(event.target.value)}
              placeholder={lang === "es" ? "Ej: Clindamicina" : "Example: Clindamycin"}
            />
            <label className="flabel" style={{marginTop:12}}>{t.prescriptionInstructions}</label>
            <textarea
              className="finput"
              rows={3}
              value={prescriptionEditInstructions}
              onChange={(event)=>setPrescriptionEditInstructions(event.target.value)}
              placeholder={lang === "es" ? "Ej: 1 tableta cada 8 horas por 7 días" : "Example: 1 tablet every 8 hours for 7 days"}
              style={{resize:"vertical",minHeight:90}}
            />
            <button className="pbtn" disabled={!prescriptionEditTitle.trim() || savingPrescriptionRename} onClick={savePrescriptionRename}>
              {savingPrescriptionRename ? (lang === "es" ? "Guardando..." : "Saving...") : t.save}
            </button>
            <button className="sbtn" onClick={()=>setEditingPrescriptionEntry(null)}>{t.cancel}</button>
          </div>
        </div>
      )}
      {activeMessageAction && (
        <div className="modal-overlay" onClick={closeMessageActions}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <p className="modal-title">{lang==="es" ? "Mensaje" : "Message"}</p>
            {activeMessageAction.message_type === "text" && (
              <button
                className="pbtn"
                onClick={()=>{
                  setEditingMessage(activeMessageAction);
                  setEditingMessageText(activeMessageAction.content || "");
                  setActiveMessageAction(null);
                }}
              >
                {lang==="es" ? "Editar mensaje" : "Edit message"}
              </button>
            )}
            <button
              className="sbtn"
              onClick={()=>{
                if (confirm(t.deleteMsg)) deleteStaffMessage(activeMessageAction.id);
              }}
              style={{color:"#B91C1C"}}
            >
              {lang==="es" ? "Eliminar mensaje" : "Delete message"}
            </button>
            <button className="sbtn" onClick={closeMessageActions}>{t.cancel}</button>
          </div>
        </div>
      )}
      {editingMessage && (
        <div className="modal-overlay" onClick={()=>{setEditingMessage(null);setEditingMessageText("");}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
            <p className="modal-title">{lang==="es" ? "Editar mensaje" : "Edit message"}</p>
            <textarea
              className="finput"
              rows={4}
              value={editingMessageText}
              onChange={(event)=>setEditingMessageText(event.target.value)}
              style={{resize:"vertical",minHeight:110}}
            />
            <button className="pbtn" disabled={!editingMessageText.trim()} onClick={updateStaffMessage}>{t.save}</button>
            <button className="sbtn" onClick={()=>{setEditingMessage(null);setEditingMessageText("");}}>{t.cancel}</button>
          </div>
        </div>
      )}
      {staffContactMember && (
        <div className="modal-overlay" onClick={closeStaffContact} style={{alignItems:"center",padding:"max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))"}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:460,borderRadius:24,paddingBottom:"max(24px, env(safe-area-inset-bottom))"}}>
            <p className="modal-title">{staffContactMember.full_name || staffContactMember.display_name || (lang==="es" ? "Personal" : "Staff")}</p>
            <div style={{fontSize:uiBaseSize,color:subTextColor,marginBottom:14,lineHeight:1.45,overflowWrap:"anywhere"}}>
              {roleName(staffContactMember.role)}{staffContactMember.office_location ? ` · ${staffContactMember.office_location}` : ""}
            </div>
            <button
              className="pbtn"
              disabled={!staffPhoneFor(staffContactMember)}
              onClick={()=>{ const phone = staffPhoneFor(staffContactMember); if (phone) window.location.href = `tel:${phone}`; }}
              style={{opacity:staffPhoneFor(staffContactMember) ? 1 : 0.55,cursor:staffPhoneFor(staffContactMember) ? "pointer" : "not-allowed"}}
            >
              {staffPhoneFor(staffContactMember) ? (lang==="es" ? `Llamar ${staffPhoneFor(staffContactMember)}` : `Call ${staffPhoneFor(staffContactMember)}`) : (lang==="es" ? "Sin teléfono registrado" : "No phone listed")}
            </button>
            {!staffPhoneFor(staffContactMember) && (
              <div style={{fontSize:uiSmallSize,color:subTextColor,marginTop:8,marginBottom:12,lineHeight:1.45}}>
                {lang==="es"
                  ? "Para llamar, este miembro debe agregar su teléfono en Ajustes o un admin puede guardarlo en Equipo y permisos."
                  : "To call, this team member needs to add a phone number in Settings, or an admin can save it in Team and permissions."}
              </div>
            )}
            <label className="flabel" style={{marginTop:12}}>{lang==="es" ? "Mensaje privado" : "Private message"}</label>
            <textarea
              className="finput"
              rows={3}
              value={staffPrivateDraft}
              onChange={(event)=>setStaffPrivateDraft(event.target.value)}
              placeholder={lang==="es" ? "Escribe un mensaje privado para este miembro del equipo" : "Write a private message to this staff member"}
              style={{resize:"vertical",minHeight:96}}
            />
            <button
              className="sbtn"
              disabled={!staffPrivateDraft.trim() || savingStaffPrivateMessage}
              onClick={sendStaffPrivateMessage}
            >
              {savingStaffPrivateMessage ? (lang==="es" ? "Enviando..." : "Sending...") : (lang==="es" ? "Enviar mensaje privado" : "Send private message")}
            </button>
            <button className="sbtn" onClick={closeStaffContact}>{t.cancel}</button>
          </div>
        </div>
      )}

      <QREditor
        show={showQREditor}
        onClose={()=>setShowQREditor(false)}
        quickReplies={quickReplies}
        onSave={saveQuickReplies}
        savingQR={savingQR}
        savedQR={savedQR}
        darkMode={darkMode}
        lang={lang}
        t={t}
        headerBg={headerBg}
        sidebarBg={sidebarBg}
        borderColor={borderColor}
        cardBg={cardBg}
        textColor={textColor}
        subTextColor={subTextColor}
      />

      {showLabelSelector && selectedPatient && (
        <div className="modal-overlay" onClick={()=>setShowLabelSelector(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:16}}>
              <div>
                <p className="modal-title" style={{marginBottom:4}}>{lang === "es" ? "Etiquetas" : "Labels"}</p>
                <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700}}>{selectedPatient.full_name}</p>
              </div>
              <button onClick={()=>setShowLabelSelector(false)} style={{width:40,height:40,minHeight:40,border:"none",borderRadius:999,background:cardBg,color:textColor,fontSize:20,fontWeight:900,cursor:"pointer"}}>×</button>
            </div>
            <div style={{display:"grid",gap:8,marginBottom:18}}>
              {userLabels.length === 0 ? (
                <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700,lineHeight:1.45}}>
                  {lang === "es" ? "Todavía no tienes etiquetas." : "You do not have labels yet."}
                </p>
              ) : userLabels.map((label)=>(
                editingLabelId === label.id ? (
                  <div key={label.id} className="label-edit-box">
                    <input
                      className="finput"
                      value={editingLabelName}
                      onChange={(event)=>setEditingLabelName(event.target.value)}
                      placeholder={lang === "es" ? "Nombre de etiqueta" : "Label name"}
                    />
                    <div className="label-color-row">
                      {labelColors.map((color)=>(
                        <button
                          key={color}
                          className={`label-color-btn${editingLabelColor === color ? " active" : ""}`}
                          style={{background: color}}
                          onClick={()=>setEditingLabelColor(color)}
                          aria-label={color}
                        />
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <button className="ghost-btn" onClick={cancelEditingPatientLabel} disabled={!!savingLabelAction}>
                        {lang === "es" ? "Cancelar" : "Cancel"}
                      </button>
                      <button className="pbtn" onClick={()=>updatePatientLabel(label.id)} disabled={!editingLabelName.trim() || !!savingLabelAction}>
                        {savingLabelAction === `edit-${label.id}` ? (lang === "es" ? "Guardando..." : "Saving...") : (lang === "es" ? "Guardar" : "Save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={label.id} className="label-option-row">
                    <label className="label-option-main">
                      <input
                        type="checkbox"
                        checked={selectedPatientLabelSet.has(label.id)}
                        onChange={()=>toggleSelectedPatientLabel(label.id)}
                      />
                      <span className="label-chip" style={{background: label.color || "#64748B"}}>
                        {labelName(label)}
                      </span>
                    </label>
                    <div className="label-manage-actions">
                      <button className="label-mini-btn" type="button" onClick={()=>startEditingPatientLabel(label)} disabled={!!savingLabelAction}>
                        {lang === "es" ? "Editar" : "Edit"}
                      </button>
                      <button className="label-mini-btn danger" type="button" onClick={()=>deletePatientLabel(label)} disabled={!!savingLabelAction}>
                        {savingLabelAction === `delete-${label.id}` ? "..." : (lang === "es" ? "Borrar" : "Delete")}
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
            <div style={{borderTop:`1px solid ${borderColor}`,paddingTop:16}}>
              <label className="flabel">{lang === "es" ? "Crear etiqueta" : "Create label"}</label>
              <input
                className="finput"
                value={newLabelName}
                onChange={e=>setNewLabelName(e.target.value)}
                placeholder={lang === "es" ? "Nombre de etiqueta" : "Label name"}
              />
              <div className="label-color-row">
                {labelColors.map((color)=>(
                  <button
                    key={color}
                    className={`label-color-btn${newLabelColor === color ? " active" : ""}`}
                    style={{background: color}}
                    onClick={()=>setNewLabelColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
              <button className="pbtn" disabled={!newLabelName.trim() || savingLabel} onClick={createPatientLabel}>
                {savingLabel ? (lang === "es" ? "Creando..." : "Creating...") : "+ Crear etiqueta"}
              </button>
            </div>
          </div>
        </div>
      )}

	      <div className="shell" data-text-size={fontSizeLevel} onClick={()=>{closeMessageActions();setShowSlashMenu(false);closeTopMenu();}}>
        <div className="topbar">
          <img className="topbar-logo" src="/fonseca_blue.png" alt="Dr. Fonseca"/>
          <div className="topbar-actions">
            {totalUnread>0&&<div style={{background:"#FF3B30",color:"white",fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{totalUnread}</div>}
            <div className="top-menu-wrap" onClick={e=>e.stopPropagation()}>
              <button
                className="top-menu-btn"
                type="button"
                onClick={()=>setShowTopMenu((open)=>!open)}
                aria-label={lang==="es" ? "Abrir menú" : "Open menu"}
                title={lang==="es" ? "Menú" : "Menu"}
              >
                ☰
              </button>
              {showTopMenu && (
                <div className="top-menu-panel">
                  <button className="top-menu-item" onClick={()=>{closeTopMenu();openStaffChatsHome();}}>
                    <span>💬</span>
                    <span>{lang==="es" ? "Chat staff" : "Staff chat"}</span>
                  </button>
                  {canOpenAdmin && (
                    <button className="top-menu-item" onClick={()=>{closeTopMenu();window.location.href="/admin";}}>
                      <span>⚙</span>
                      <span>Admin</span>
                    </button>
                  )}
                  {canCreatePatientRooms && (
                    <button className="top-menu-item" onClick={()=>{closeTopMenu();requestNewPatientRoom();}}>
                      <span>＋</span>
                      <span>{lang==="es" ? "Crear paciente" : "Create patient"}</span>
                    </button>
                  )}
                  {selectedPatient && (
                    <button className="top-menu-item" onClick={()=>{closeTopMenu();setShowLabelSelector(true);}}>
                      <span>🏷</span>
                      <span>{lang==="es" ? "Etiquetas" : "Labels"}</span>
                    </button>
                  )}
                  <button className="top-menu-item" onClick={()=>{closeTopMenu();setShowSettings(true);}}>
                    <span>☰</span>
                    <span>{t.settings}</span>
                  </button>
                  <button className="top-menu-item" onClick={()=>{closeTopMenu();signOutToLogin();}} title={lang==="es" ? "Salir" : "Exit"} aria-label={lang==="es" ? "Salir" : "Exit"}>
                    <img src="/Exit_icon.png" alt="" style={{width:24,height:24,objectFit:"contain",display:"block"}} />
                    <span>{lang==="es" ? "Salir" : "Exit"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {toastAlert && (
          <div style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 78px)",right:16,zIndex:250,width:"min(380px, calc(100vw - 32px))",background:darkMode?"rgba(17,24,39,0.96)":"rgba(255,255,255,0.98)",color:textColor,border:`1px solid ${borderColor}`,borderRadius:18,boxShadow:"0 18px 46px rgba(15,23,42,0.2)",padding:"14px 16px",cursor:"pointer"}} onClick={()=>openToastRoom(toastAlert.kind==="note"?"read-note":"chat")}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:"#25D366",flexShrink:0}} />
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:toastAlert.kind==="note"?"#2563EB":"#16A34A",marginBottom:2}}>
                  {toastAlert.kind==="note"
                    ? (lang==="es" ? "Nueva nota interna" : "New internal note")
                    : (lang==="es" ? "Nuevo mensaje del paciente" : "New patient message")}
                </div>
                <div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{toastAlert.title}</div>
                <div style={{fontSize:13,color:subTextColor,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{toastAlert.body}</div>
              </div>
              <button onClick={(event)=>{event.stopPropagation();setToastAlert(null);}} style={{border:"none",background:"transparent",color:subTextColor,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
            </div>
            {toastAlert.kind==="note" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                <button onClick={(event)=>{event.stopPropagation();openToastRoom("read-note");}} style={{border:"none",borderRadius:12,background:"#DBEAFE",color:"#1D4ED8",padding:"10px 8px",fontSize:12,fontWeight:850,fontFamily:"inherit",cursor:"pointer"}}>{lang==="es" ? "Leer" : "Read it"}</button>
                <button onClick={(event)=>{event.stopPropagation();openToastRoom("add-note");}} style={{border:"none",borderRadius:12,background:"#DCFCE7",color:"#166534",padding:"10px 8px",fontSize:12,fontWeight:850,fontFamily:"inherit",cursor:"pointer"}}>{lang==="es" ? "Agregar" : "Add to it"}</button>
                <button onClick={(event)=>{event.stopPropagation();setToastAlert(null);}} style={{border:"none",borderRadius:12,background:darkMode?"#253244":"#F1F5F9",color:textColor,padding:"10px 8px",fontSize:12,fontWeight:850,fontFamily:"inherit",cursor:"pointer"}}>{lang==="es" ? "Entendido" : "Acknowledge"}</button>
              </div>
            )}
          </div>
        )}

        {!callOverlayOpen && callInviteFeedback && (
          <div style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 78px)",left:16,zIndex:240,maxWidth:"min(420px, calc(100vw - 32px))",background:darkMode?"rgba(17,24,39,0.97)":"rgba(255,255,255,0.99)",color:textColor,border:`1px solid ${borderColor}`,borderRadius:14,boxShadow:"0 10px 28px rgba(15,23,42,0.22)",padding:"10px 12px",fontSize:13,fontWeight:700}}>
            {callInviteFeedback}
          </div>
        )}
        {privateToast && (
          <div
            role="button"
            tabIndex={0}
            onClick={()=>{
              const payload = parseStaffRoomPayload(privateToast.content);
              if (payload?.roomId) openStaffRoomConversation(payload.roomId);
              else openStaffPrivateConversation(privateToast.sender_id || "");
            }}
            onKeyDown={(event)=>{ if (event.key === "Enter" || event.key === " ") {
              const payload = parseStaffRoomPayload(privateToast.content);
              if (payload?.roomId) openStaffRoomConversation(payload.roomId);
              else openStaffPrivateConversation(privateToast.sender_id || "");
            } }}
            style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 78px)",right:16,zIndex:245,width:"min(360px, calc(100vw - 32px))",background:darkMode?"rgba(17,24,39,0.98)":"rgba(255,255,255,0.99)",color:textColor,border:`1px solid ${borderColor}`,borderRadius:18,boxShadow:"0 18px 45px rgba(15,23,42,0.24)",padding:14,cursor:"pointer"}}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:6}}>
              <p style={{fontSize:uiSmallSize,fontWeight:900,color:"#2563EB",textTransform:"uppercase",letterSpacing:0.4}}>{parseStaffRoomPayload(privateToast.content) ? (lang==="es"?"Chat staff":"Staff chat") : (lang==="es"?"Mensaje privado":"Private message")}</p>
              <button onClick={(event)=>{event.stopPropagation();setPrivateToast(null);}} style={{border:"none",background:cardBg,borderRadius:999,width:34,height:34,minHeight:34,color:textColor,fontWeight:900,cursor:"pointer"}}>×</button>
            </div>
            <p style={{fontSize:uiBaseSize,fontWeight:900,marginBottom:4,overflowWrap:"anywhere"}}>{parseStaffRoomPayload(privateToast.content)?.roomName || privateToast.sender_name || (lang==="es"?"Personal":"Staff")}</p>
            <p style={{fontSize:uiSmallSize,color:subTextColor,fontWeight:700,lineHeight:1.45,overflowWrap:"anywhere"}}>{`${parseStaffRoomPayload(privateToast.content)?.text || privateToast.content || ""}`.slice(0, 160)}</p>
          </div>
        )}

        <div className="body">
          <div className={`sidebar${mobileView==="chat"?" hidden":""}`}>
            <div className="sidebar-head">
              <div className="sidebar-title-row">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:22,fontWeight:700,color:textColor}}>{t.patients}</span>
                  {totalUnread>0&&<span style={{background:"#25D366",color:"white",fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:99}}>{totalUnread}</span>}
                </div>
              </div>
              <div className="search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input className="search-input" placeholder={t.search} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              </div>
              {userLabels.length > 0 && (
                <div className="label-filter-row">
                  <button className={`label-chip all${!activeLabelFilter ? " active" : ""}`} onClick={()=>{setActiveLabelFilter("");setLabelAssignModeId("");}}>
                    {lang === "es" ? "Todos" : "All"}
                  </button>
                  {userLabels.map((label)=>{
                    const count = patientCountForLabel(label.id);
                    return (
                      <button
                        key={label.id}
                        className={`label-chip${activeLabelFilter === label.id ? " active" : ""}`}
                        style={{background: label.color || "#64748B"}}
                        onClick={()=>{
                          if (activeLabelFilter === label.id) {
                            if (labelAssignModeId === label.id) {
                              setLabelAssignModeId("");
                            } else {
                              setLabelAssignModeId(label.id);
                            }
                            return;
                          }
                          setActiveLabelFilter(label.id);
                          setLabelAssignModeId(label.id);
                        }}
                        title={`${labelName(label)} · ${count} ${lang === "es" ? "paciente(s)" : "patient(s)"}`}
                      >
                        <span className="label-chip-name">{labelName(label)}</span>
                        <span className="label-chip-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {activeLabel && (
                <div className="label-assign-bar">
                  <span>
                    {labelAssignMode
                      ? (lang === "es" ? `Toca pacientes para aplicar o quitar "${labelName(activeLabel)}".` : `Tap patients to apply or remove "${labelName(activeLabel)}".`)
                      : (lang === "es" ? `Viendo pacientes con "${labelName(activeLabel)}".` : `Viewing patients with "${labelName(activeLabel)}".`)}
                  </span>
                  <button
                    className="label-assign-done"
                    type="button"
                    onClick={()=>setLabelAssignModeId(labelAssignMode ? "" : activeLabel.id)}
                  >
                    {labelAssignMode ? (lang === "es" ? "Listo" : "Done") : (lang === "es" ? "Asignar" : "Assign")}
                  </button>
                </div>
              )}
              {notificationFeedback && (
                <div style={{marginTop:10,padding:"10px 12px",borderRadius:14,background:notificationFeedback.tone==="success"?"#DCFCE7":notificationFeedback.tone==="error"?"#FEE2E2":"#DBEAFE",color:notificationFeedback.tone==="success"?"#166534":notificationFeedback.tone==="error"?"#991B1B":"#1D4ED8",fontSize:13,fontWeight:700,lineHeight:1.4}}>
                  {notificationFeedback.text}
                </div>
              )}
            </div>
            <div className="patient-list">
              {loading?(
                <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:28,height:28,border:"2px solid #E5E5EA",borderTopColor:"#007AFF",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/></div>
              ):filtPts.length===0?(
                <div style={{padding:"60px 20px",textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:12}}>🏥</div>
                  <p style={{fontSize:17,fontWeight:600,color:textColor}}>
                    {activeLabelFilter
                      ? (lang === "es" ? "No hay pacientes con esta etiqueta" : "No patients with this label")
                      : t.noPatients}
                  </p>
                  <p style={{fontSize:14,color:subTextColor,marginTop:6}}>
                    {activeLabelFilter
                      ? (lang === "es" ? "Toca Todos para ver la lista completa." : "Tap All to see the full list.")
                      : t.noPatientsHint}
                  </p>
                </div>
              ):filtPts.map(pt=>{
                const ptUnreadCount=pt.rooms.reduce((sum:number,r:any)=>sum+(unreadCounts[r.id]||0),0);
                const ptUnread=ptUnreadCount>0;
                const ptMediaUnread=(mediaUnreadCounts[pt.id]||0)>0;
                const alertRoom=pt.rooms.find((r:any)=>pendingAlertRoomIds.has(r.id));
                const firstRoom=alertRoom||pt.rooms[0];
                const proc=firstRoom?.procedures;
                const surgDate=proc?.surgery_date?new Date(proc.surgery_date).toLocaleDateString(lang==="es"?"es-MX":"en-US",{day:"2-digit",month:"2-digit",year:"2-digit"}):"";
                const isActive=pt.rooms.some((r:any)=>r.id===selectedRoom?.id);
                const latestPreview=roomPreview(firstRoom);
                const latestTime=roomPreviewTime(firstRoom);
                const ptLabels=patientLabelsFor(pt);
                const labelAssignSelected=activeLabelFilter?patientLabelIdsFor(pt).includes(activeLabelFilter):false;
                const ptHasAlert=!!alertRoom;
                const alertLevel=alertRoom ? Math.min(3, Math.max(1, pendingAlertLevels[alertRoom.id] || 1)) : 0;
                return (
                  <div key={pt.id} className={`patient-row${isActive&&!labelAssignMode?" active":""}${labelAssignMode&&labelAssignSelected?" label-assign-selected":""}`} onClick={()=>{
                    if (labelAssignMode && activeLabelFilter) {
                      toggleLabelForPatient(pt, activeLabelFilter);
                      return;
                    }
                    setSelectedRoom(firstRoom);setMobileView("chat");
                  }}>
                    {labelAssignMode&&(
                      <div className={`label-assign-check${labelAssignSelected?" selected":""}`} aria-hidden="true">
                        {labelAssignSelected ? "✓" : "+"}
                      </div>
                    )}
                    {ptHasAlert&&<div className={`patient-alert-badge level-${alertLevel}`}>{alertLevel>=3?"URGENTE":"●"}</div>}
                    <div className="av">
                      {pt.profile_picture_url?<img src={pt.profile_picture_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:ini(pt.full_name)}
                      {(ptUnread||ptMediaUnread)&&<div className={`av-badge${ptMediaUnread?" media":""}`}/>}
                    </div>
                    <div className="patient-info">
                      <div className="patient-main-line">
                        <div className="patient-name">{pt.full_name}</div>
                        {latestTime&&<div className="patient-time">{latestTime}</div>}
                      </div>
                      {ptLabels.length > 0 && (
                        <div className="patient-label-row">
                          {ptLabels.slice(0, 3).map((label)=>(
                            <span key={label.id} className="patient-label-chip" style={{background: label.color || "#64748B"}}>
                              {labelName(label)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="patient-meta">
                        {proc?.procedure_name&&<span>{proc.procedure_name}</span>}
                        {surgDate&&<span> · {surgDate}</span>}
                        {proc?.office_location&&<span> · 📍{proc.office_location==="Guadalajara"?"GDL":"TJN"}</span>}
                      </div>
                      <div className="patient-preview">{latestPreview}</div>
                    </div>
                    {ptUnread&&<div className="unread-count">{ptUnreadCount}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`main-area${mobileView==="list"?" hidden":""}`}>
            {!selectedRoom?(
              <div className="welcome">
                <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#2C2C2E,#007AFF)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <p style={{fontSize:24,fontWeight:700,color:textColor}}>{t.selectPatient}</p>
                <p style={{fontSize:16,color:subTextColor,maxWidth:280,lineHeight:1.6,textAlign:"center"}}>{t.selectPatientHint}</p>
              </div>
            ):(
              <>
                <div className="chat-head">
                  <button className="back-btn" onClick={()=>{setMobileView("list");setSelectedRoom(null);setShowQREditor(false);}}>←</button>
                  <div className="chat-av">
                    {selectedRoom.procedures?.patients?.profile_picture_url
                      ?<img src={selectedRoom.procedures.patients.profile_picture_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                      :ini(selectedRoom.procedures?.patients?.full_name||"P")}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="chat-head-name">{selectedRoom.procedures?.patients?.full_name||"Paciente"}</div>
                    <div className="chat-head-sub">
                      {selectedRoom.procedures?.procedure_name}
                      {selectedRoom.procedures?.surgery_date&&` · ${new Date(selectedRoom.procedures.surgery_date).toLocaleDateString(lang==="es"?"es-MX":"en-US",{day:"2-digit",month:"2-digit",year:"2-digit"})}`}
                      {selectedRoom.procedures?.office_location&&` · 📍${selectedRoom.procedures.office_location}`}
                    </div>
                    {patientTyping && (
                      <div style={{fontSize:12,color:"#93C5FD",fontWeight:700,marginTop:4}}>
                        {(selectedRoom.procedures?.patients?.full_name || t.patientLabel)} {t.typingSuffix}
                      </div>
                    )}
                  </div>
                  <button
                    className="phone-btn"
                    onClick={()=>setShowLabelSelector(true)}
                    title={lang === "es" ? "Etiquetas" : "Labels"}
                    aria-label={lang === "es" ? "Etiquetas" : "Labels"}
                    style={{color:textColor,fontSize:21,fontWeight:900}}
                  >
                    🏷
                  </button>
                </div>

                {pendingAlertRoomIds.has(selectedRoom.id) && (
                  <div className={`chat-alert-banner level-${Math.min(3, Math.max(1, pendingAlertLevels[selectedRoom.id] || 1))}`}>
                    {(pendingAlertLevels[selectedRoom.id] || 1) >= 3
                      ? "🚨 URGENTE — atención inmediata requerida"
                      : "🚨 Paciente requiere atención"}
                  </div>
                )}

                <div
                  className="chat-bg"
                  ref={chatScrollRef}
                  onScroll={updateAutoScrollPreference}
                  onClick={()=>{
                    setShowSlashMenu(false);
                    setShowEmojiMenu(false);
                    setShowMediaMenu(false);
                  }}
                >
                  {messages.filter(m=>!m.deleted_by_staff).length===0?(
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:40,textAlign:"center"}}>
                      <div style={{fontSize:44}}>💬</div>
                      <p style={{fontSize:17,fontWeight:600,color:textColor}}>{t.noMessages}</p>
                      <p style={{fontSize:15,color:subTextColor}}>{t.noMessagesHint}</p>
                    </div>
                  ):groupedMessages().map((group,gi)=>(
                    <div key={gi}>
                      <div className="date-sep"><div className="date-sep-pill">{fmtChatDateLabel(group.date)}</div></div>
                      {group.msgs.map(renderMsg)}
                    </div>
                  ))}
                  <div ref={messagesEndRef}/>
                </div>
                {showSlashMenu&&slashFiltered.length>0&&(
                  <div className="slash-popup" onClick={e=>e.stopPropagation()}>
                    {slashFiltered.map((r,i)=>(
                      <button key={`${r.shortcut}-${i}`} className="slash-item" onClick={()=>selectQuickReply(r)}>
                        {r.message}
                      </button>
                    ))}
                  </div>
                )}

                {recording?(
                  <div style={{background:inputBg,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,borderTop:`1px solid ${borderColor}`}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:"#FF3B30",flexShrink:0,animation:"pulse 1s infinite"}}/>
                    <span style={{fontSize:17,fontWeight:700,color:"#FF3B30",fontFamily:"monospace",flex:1}}>{fmtRec(recordingSeconds)}</span>
                    <span style={{fontSize:14,color:subTextColor}}>{t.recording}</span>
                    <button onClick={()=>stopRec(true)} style={{padding:"8px 16px",background:"#6B7280",color:"white",border:"none",borderRadius:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t.cancelCapture}</button>
                    <button onClick={()=>stopRec(false)} style={{padding:"8px 16px",background:"#FF3B30",color:"white",border:"none",borderRadius:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏹ {t.stopAndReview}</button>
                  </div>
                ):(
                  <div className="input-area" onClick={e=>{e.stopPropagation();closeMessageActions();}}>
                    {showMediaMenu&&(
                      <div className="staff-menu-popup">
                        <button className="staff-menu-item" onClick={()=>{
                          setShowMediaMenu(false);
                          openCapture("photo");
                        }}>{t.capture}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);fileInputRef.current?.click();}}>{lang==="es" ? "Recetas" : "Prescriptions"}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);setShowMediaLibrary(true);}}>{t.mediaLibrary}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);setCareStaffInviteIds([]);setShowCareStaffInvite(true);}}>{t.addCareStaff}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);setShowQREditor(true);}}>{t.quickReplies}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);setShowPatientInfo(true);}}>{t.patientInfo}</button>
                        <button className="staff-menu-item" onClick={()=>{setShowMediaMenu(false);setShowSettings(true);}}>{t.settings}</button>
                      </div>
                    )}
                    {showEmojiMenu && (
                      <div style={{position:"absolute",left:64,bottom:`calc(66px + env(safe-area-inset-bottom))`,width:250,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`,borderRadius:18,padding:10,boxShadow:"0 14px 34px rgba(15,23,42,0.16)",zIndex:31}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
                          {QUICK_EMOJIS.map((emoji)=>(
                            <button key={emoji} onClick={()=>appendEmojiToDraft(emoji)} style={{border:"none",background:cardBg,borderRadius:10,padding:"8px 0",fontSize:20,cursor:"pointer"}}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button className="plus-btn" onClick={()=>{setShowEmojiMenu(false);setShowMediaMenu(v=>!v);}} aria-label={showMediaMenu ? t.cancel : t.attachmentOptions}>{showMediaMenu ? "×" : "+"}</button>
                    <div
                      ref={setComposerNode}
                      className="msg-input"
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label={lang==="es" ? "Mensaje" : "Message"}
                      data-placeholder={lang==="es" ? "Mensaje" : "Message"}
                      onFocus={()=>{closeMessageActions();jumpToLatest();}}
                      onInput={e=>{
                        const v=e.currentTarget.textContent || "";
                        setNewMessage(v);
                        updateTypingState(v);
                        setShowMediaMenu(false);
                        setShowEmojiMenu(false);
                        if(v.startsWith("/")){setShowSlashMenu(true);setSlashFilter(v.slice(1));}
                        else{setShowSlashMenu(false);setSlashFilter("");}
                      }}
                      onBlur={()=>updateTypingState("")}
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&!e.shiftKey){
                          e.preventDefault();
                          setShowEmojiMenu(false);
                          if(showSlashMenu&&slashFiltered.length>0){selectQuickReply(slashFiltered[0]);}
                          else sendMessage();
                        }
                        if(e.key==="Escape")setShowSlashMenu(false);
                      }}
                    />
                    <button className="send-btn" onClick={()=>sendMessage()} disabled={sending || !newMessage.trim()} aria-label={t.send}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                    {selectedRoom.procedures?.patients?.phone && (
                      <a className="phone-btn" href={`tel:${selectedRoom.procedures.patients.phone}`} title={t.callPatient} aria-label={t.callPatient}>
                        <img src="/Phone_icon.png" alt="" />
                      </a>
                    )}
                    <button className="mic-btn" onPointerDown={e=>{e.preventDefault();startRec();}} aria-label={t.recordAudio}>
                      <img src="/Microphone_icon.png" alt="" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
