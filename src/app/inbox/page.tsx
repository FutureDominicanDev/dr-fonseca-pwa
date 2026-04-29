"use client";

// ALL chat UI MUST be handled inside ChatShell.tsx.
// DO NOT duplicate UI here.

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { displayToIsoDate, formatDateTyping, isoToDisplayDate } from "@/lib/dateInput";
import { PATIENT_LANGUAGE_OPTIONS, PATIENT_TIMEZONE_OPTIONS, currentTimeInZone, labelPatientLanguage, labelTimeZone, onboardingMessageForPatient } from "@/lib/patientMeta";
import { syncPushSubscription } from "@/lib/pushSubscriptions";
import { isOwnerEmail } from "@/lib/securityConfig";
import ChatShell from "@/components/chat/ChatShell";

type Lang = "es" | "en";
type FileCategory = "general" | "medication" | "before_photo";
type PhoneCountryOption = { code: string; label: string };
type MediaTab = "media" | "audio" | "docs";

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
    takePhoto: "Tomar foto",
    recordVideoOption: "Grabar video",
    chooseFile: "Elegir archivo",
    stopAndSendVideo: "Detener y enviar video",
    takePhotoNow: "Tomar foto ahora",
    cancelCapture: "Cancelar",
    preparingCamera: "Abriendo cámara...",
    noMessages: "Sin mensajes aún", noMessagesHint: "Envía el primero para comenzar",
    selectPatient: "Selecciona un paciente", selectPatientHint: "para abrir su sala de chat",
    newRoom: "Nueva Sala de Paciente", patientFirstName: "Nombre *", patientLastName: "Apellido *",
    patientFirstNamePH: "Ej: María", patientLastNamePH: "Ej: González", phone: "Teléfono (WhatsApp)",
    phoneCode: "Clave internacional", phonePH: "123-456-7890", birthdate: "Fecha de Nacimiento",
    birthdatePH: "dd/mm/aaaa",
    email: "Correo Electrónico",
    emailPH: "paciente@correo.com",
    procedure: "Procedimiento *", procedurePH: "Ej: Rinoplastia, Lipo 360...",
    surgeryDate: "Fecha de Cirugía", location: "Sede *",
    surgeryDatePH: "dd/mm/aaaa",
    preferredLanguage: "Idioma Preferido",
    timezone: "Zona horaria del paciente",
    allergies: "Alergias",
    allergiesPH: "Ej: Penicilina, látex, anestesia...",
    medications: "Medicamentos Actuales",
    medicationsPH: "Ej: Ibuprofeno, metformina, vitaminas...",
    careTeam: "Equipo Asignado",
    careTeamHint: "Selecciona quién tendrá acceso y alertas. Al crear la sala, el equipo seleccionado verá el paciente como no leído.",
    careTeamFocused: "Mostrando primero personal de la sede elegida para evitar errores.",
    careTeamShowAll: "Mostrar todo el personal",
    careTeamShowOffice: "Ver solo sede elegida",
    careTeamSelectAll: "Seleccionar todos",
    careTeamClear: "Limpiar selección",
    careTeamSelected: "Seleccionados",
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
    callPatient: "Llamar paciente",
    videoCall: "Videollamada",
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
    internalNotesHint: "Solo el equipo asignado puede ver estas notas.",
    addInternalNote: "Agregar nota interna",
    internalNotePH: "Escribe una nota clínica o administrativa para el equipo...",
    noInternalNotes: "Todavía no hay notas internas para este caso.",
    noteSaved: "Nota interna guardada.",
    noTeamSelected: "Si no eliges a nadie, se asignará solo la persona que crea la sala.",
    noPatientInfo: "Todavía no hay datos extendidos para este paciente.",
    openFullRecord: "Abrir expediente",
    teamEmpty: "No hay personal asignado todavía.",
    beforeMaterials: "Material Pre-Op",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Foto de Perfil", beforePhotos: "Fotos Pre-Op",
    tapProfilePic: "Toca para subir foto de perfil",
    tapBeforePhotos: "Toca para subir fotos pre-op",
    createRoom: "✅ Crear Sala del Paciente", creating: "Creando sala...",
    cancel: "Cancelar", roomCreated: "¡Sala Creada!", shareLink: "Comparte este enlace con",
    copyLink: "📋 Copiar Enlace", copied: "✅ ¡Copiado!", whatsapp: "💬 Enviar por WhatsApp",
    done: "Listo", required: "Nombre, apellido y procedimiento son obligatorios.",
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
    takePhoto: "Take photo",
    recordVideoOption: "Record video",
    chooseFile: "Choose file",
    stopAndSendVideo: "Stop and send video",
    takePhotoNow: "Take photo now",
    cancelCapture: "Cancel",
    preparingCamera: "Opening camera...",
    noMessages: "No messages yet", noMessagesHint: "Send the first one to get started",
    selectPatient: "Select a patient", selectPatientHint: "to open their chat room",
    newRoom: "New Patient Room", patientFirstName: "First Name *", patientLastName: "Last Name *",
    patientFirstNamePH: "e.g. Maria", patientLastNamePH: "e.g. Gonzalez", phone: "Phone (WhatsApp)",
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
    careTeamHint: "Choose who gets access and alerts. When the room is created, selected staff will see it as unread.",
    careTeamFocused: "Showing staff from the selected office first to avoid assignment mistakes.",
    careTeamShowAll: "Show all staff",
    careTeamShowOffice: "Show selected office only",
    careTeamSelectAll: "Select all",
    careTeamClear: "Clear selection",
    careTeamSelected: "Selected",
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
    callPatient: "Call patient",
    videoCall: "Video call",
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
    internalNotesHint: "Only the assigned care team can see these notes.",
    addInternalNote: "Add internal note",
    internalNotePH: "Write a clinical or administrative note for the team...",
    noInternalNotes: "There are no internal notes for this case yet.",
    noteSaved: "Internal note saved.",
    noTeamSelected: "If you do not choose anyone, only the room creator will be assigned.",
    noPatientInfo: "There is no extended patient data yet.",
    openFullRecord: "Open record",
    teamEmpty: "No staff assigned yet.",
    beforeMaterials: "Pre-Op Material",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Profile Photo", beforePhotos: "Pre-Op Photos",
    tapProfilePic: "Tap to upload profile photo",
    tapBeforePhotos: "Tap to upload pre-op photos",
    createRoom: "✅ Create Patient Room", creating: "Creating room...",
    cancel: "Cancel", roomCreated: "Room Created!", shareLink: "Share this link with",
    copyLink: "📋 Copy Link", copied: "✅ Copied!", whatsapp: "💬 Send via WhatsApp",
    done: "Done", required: "First name, last name, and procedure are required.",
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
  }
};

const VIDEO_CALL_PREFIX = "__VIDEO_CALL__::";
const CALL_REQUEST_PREFIX = "__CALL_REQUEST__::";

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

interface QuickReply { shortcut: string; message: string; }
interface CareTeamMember {
  id: string;
  full_name?: string | null;
  role?: string | null;
  office_location?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  mobile_phone?: string | null;
}

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

  return null;
}

export default function InboxPage() {
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];
  const [darkMode, setDarkMode] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<"small"|"medium"|"large">("medium");
  const fontSize = fontSizeLevel === "small" ? 16 : fontSizeLevel === "large" ? 21 : 18;

  const bg = darkMode ? "#0B141A" : "#EFEAE2";
  const headerBg = darkMode ? "#111" : "#0F172A";
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
  const [message, setMessage] = useState("");
  const newMessage = message;
  const setNewMessage = setMessage;
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list"|"chat">("list");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pressedMsgId, setPressedMsgId] = useState<string|null>(null);
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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
  const [showAllCareTeamOptions, setShowAllCareTeamOptions] = useState(false);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [selectedRoomTeam, setSelectedRoomTeam] = useState<CareTeamMember[]>([]);
  const [managedTeamIds, setManagedTeamIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoomError, setNewRoomError] = useState("");
  const [createdRoomLink, setCreatedRoomLink] = useState<string|null>(null);
  const [createdPatientName, setCreatedPatientName] = useState("");
  const [createdPatientLanguage, setCreatedPatientLanguage] = useState<"es" | "en">("es");
  const [linkCopied, setLinkCopied] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<File|null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | null>(null);
  const [preparingCapture, setPreparingCapture] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
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
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [patientTyping, setPatientTyping] = useState(false);
  const [toastAlert, setToastAlert] = useState<{ roomId: string; title: string; body: string } | null>(null);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const selectedRoomRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaCaptureVideoRef = useRef<HTMLVideoElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);
  const profilePicSettingsRef = useRef<HTMLInputElement>(null);
  const beforePhotosRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
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

  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0,2).toUpperCase() : "P";
  const fmtTime = (ts: string) => { if (!ts) return ""; return new Date(ts).toLocaleTimeString(lang==="es"?"es-MX":"en-US",{hour:"2-digit",minute:"2-digit"}); };
  const fmtDateLabel = (ts: string) => { if (!ts) return ""; return new Date(ts).toLocaleDateString(lang==="es"?"es-MX":"en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}); };
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
  const toggleCareTeamMember = (id: string) => {
    setSelectedCareTeamIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  };
  const canOpenAdmin = isOwnerEmail(currentUserEmail);
  const canManageCareTeam = (userProfile?.role || "").toLowerCase() === "doctor" || ["owner","super_admin"].includes(userProfile?.admin_level || "");
  const canCreatePatientRooms =
    isOwnerEmail(currentUserEmail) ||
    ["owner", "super_admin", "admin"].includes((userProfile?.admin_level || "").toLowerCase());
  const careTeamDirectory = showAllCareTeamOptions
    ? staffDirectory
    : staffDirectory.filter((member) => !member.office_location || member.office_location === newLocation);
  const careTeamSelectedMembers = staffDirectory.filter((member) => selectedCareTeamIds.includes(member.id));
  const careTeamGroups = CARE_TEAM_ROLE_ORDER.map((role) => ({
    role,
    members: careTeamDirectory.filter((member) => (member.role || "staff") === role),
  })).filter((group) => group.members.length > 0);
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

  const describeIncomingMessage = useCallback((message: any) => {
    if (parseCallRequestMessage(message.content)) return t.incomingCallRequest;
    if (message.message_type === "audio") return lang==="es" ? "Nuevo audio" : "New audio";
    if (message.message_type === "video") return lang==="es" ? "Nuevo video" : "New video";
    if (message.message_type === "image") return lang==="es" ? "Nueva imagen" : "New image";
    if (message.message_type === "file") return lang==="es" ? "Nuevo archivo" : "New file";
    if (parseVideoCallMessage(message.content)) return t.videoCallInvite;
    const text = `${message.content || ""}`.trim();
    return text ? text.slice(0, 120) : lang==="es" ? "Nuevo mensaje" : "New message";
  }, [lang, t.videoCallInvite]);

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

  const showToastAlert = useCallback((roomId: string, title: string, body: string) => {
    setToastAlert({ roomId, title, body });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastAlert(null), 4500);
  }, []);

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
    const messageKey = incomingMessageKey(message);
    if (typeof window !== "undefined" && messageKey) {
      const lastAlertedMessage = window.localStorage.getItem(alertMessageStorageKey(roomId)) || "";
      if (lastAlertedMessage === messageKey) return;
      window.localStorage.setItem(alertMessageStorageKey(roomId), messageKey);
      window.localStorage.setItem(`last_alert_${roomId}`, message.created_at || new Date().toISOString());
    }

    const patientName = roomPatientName(roomId);
    const title = lang === "es" ? `Nota interna · ${patientName}` : `Internal note · ${patientName}`;
    const rawBody = `${message.content || ""}`.trim();
    const body = rawBody
      ? rawBody.slice(0, 120)
      : (lang === "es" ? "Nuevo seguimiento interno del equipo." : "New internal care-team follow-up.");
    const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
    const isActiveRoom = selectedRoomRef.current?.id === roomId;

    playIncomingTone();
    showToastAlert(roomId, title, body);
    if (!isVisible || !isActiveRoom) {
      pushNotif(title, body);
    }
  }, [alertMessageStorageKey, incomingMessageKey, lang, playIncomingTone, pushNotif, roomPatientName, showToastAlert]);

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

  const subscribeStaffToPush = async () => {
    try {
      if (!("serviceWorker" in navigator)||!("PushManager" in window)) return;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey) });
      await syncPushSubscription({ subscription: sub.toJSON(), userType: "staff" });
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
    const latestByRoom: Record<string, any> = {};
    for (const m of msgs) {
      const roomId = m.room_id;
      const lastSeen = localStorage.getItem(`last_seen_${roomId}`) || "0";
      if (m.created_at > lastSeen) nextCounts[roomId] = (nextCounts[roomId] || 0) + 1;
      if (!latestByRoom[roomId]) latestByRoom[roomId] = m;
    }
    setUnreadCounts(nextCounts);

    for (const [roomId, latestMessage] of Object.entries(latestByRoom)) {
      if (selectedRoomRef.current?.id === roomId && typeof document !== "undefined" && document.visibilityState === "visible") continue;
      const lastSeen = localStorage.getItem(`last_seen_${roomId}`) || "0";
      const lastAlert = localStorage.getItem(`last_alert_${roomId}`) || "0";
      const latestMessageKey = incomingMessageKey(latestMessage);
      const lastAlertedMessage = localStorage.getItem(alertMessageStorageKey(roomId)) || "";
      if (latestMessageKey && latestMessageKey === lastAlertedMessage) continue;
      if (latestMessage.created_at > lastSeen && latestMessage.created_at > lastAlert) {
        playIncomingTone();
        showToastAlert(roomId, roomPatientName(roomId), describeIncomingMessage(latestMessage));
        pushNotif(roomPatientName(roomId), describeIncomingMessage(latestMessage));
        localStorage.setItem(`last_alert_${roomId}`, latestMessage.created_at);
        if (latestMessageKey) localStorage.setItem(alertMessageStorageKey(roomId), latestMessageKey);
      }
    }
  };

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id",id).single();
    if (data) { setUserProfile(data); setDisplayNameEdit(data.full_name||data.display_name||""); if (data.quick_replies?.length) setQuickReplies(data.quick_replies); }
  };

  const fetchAssignableStaff = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    const list = (data || []) as CareTeamMember[];
    const fallback = userProfile?.id ? [{
      id: userProfile.id,
      full_name: userProfile.full_name || userProfile.display_name || "Staff",
      role: userProfile.role || "staff",
      office_location: userProfile.office_location || null,
      avatar_url: userProfile.avatar_url || null,
      phone: userProfile.phone || userProfile.phone_number || userProfile.mobile_phone || null,
    }] : [];
    const merged = [...list];
    fallback.forEach((entry) => {
      if (!merged.some((member) => member.id === entry.id)) merged.unshift(entry);
    });
    setStaffDirectory(merged);
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
      .select("*")
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

  const uploadProfilePhoto = async (file: File) => {
    if (!userProfile?.id) return;
    const fn = `profile-photos/${userProfile.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-files").upload(fn, file);
    if (!error) { const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn); await supabase.from("profiles").update({ avatar_url: ud.publicUrl }).eq("id",userProfile.id); setUserProfile((p: any)=>({...p,avatar_url:ud.publicUrl})); }
  };

  useEffect(()=>{ selectedRoomRef.current=selectedRoom; },[selectedRoom]);

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

  useEffect(()=>{ document.title=totalUnread>0?`(${totalUnread}) Dr. Fonseca Portal`:"Dr. Fonseca Portal"; },[totalUnread]);

  // Poll for unread badges every 20s and on tab focus
  useEffect(()=>{
    checkUnreadBadges();
    const interval = setInterval(checkUnreadBadges, 2000);
    const onVisible = () => { if (document.visibilityState==="visible") checkUnreadBadges(); };
    document.addEventListener("visibilitychange", onVisible);
    return ()=>{ clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  },[]);

  useEffect(()=>{
    if (selectedRoom) {
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      lastMessageCountRef.current = 0;
      fetchMessages(selectedRoom.id);
      fetchSelectedRoomTeam(selectedRoom.id);
      setMobileView("chat");
      markRoomAsRead(selectedRoom.id);
    }
  },[markRoomAsRead, selectedRoom]);

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
    pauseBackgroundRefreshRef.current = showSettings || showPatientInfo || showNewRoom || showQREditor;
  }, [showNewRoom, showPatientInfo, showQREditor, showSettings]);

  useEffect(()=>{
    if (!shouldAutoScrollRef.current) return;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages]);

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && !shouldAutoScrollRef.current) {
      setShowJumpToLatest(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);

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
    const extendedSelect = "*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, email, profile_picture_url, birthdate, preferred_language, timezone, allergies, current_medications))";
    const fallbackSelect = "*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, profile_picture_url, birthdate))";
    let query = await supabase.from("rooms").select(extendedSelect).order("created_at",{ascending:false});
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

  const fetchMessages = async (roomId: string) => { const { data } = await supabase.from("messages").select("*").eq("room_id",roomId).order("created_at",{ascending:true}); setMessages(data||[]); };

  const sendMessage = async (content?: string) => {
    const msg=(content||newMessage).trim();
    if (!msg||!selectedRoom||isSending.current) return;
    updateTypingState("", selectedRoom.id);
    isSending.current=true; setSending(true);
    if (!content) setNewMessage("");
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
    fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      roomId:selectedRoom.id, userType:"patient",
      title: sName, body: msg.length>80?msg.slice(0,80)+"…":msg,
      url: window.location.href, tag: selectedRoom.id,
    })}).catch(()=>{});
    isSending.current=false; setSending(false);
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

    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: selectedRoom.id,
        userType: "patient",
        title: sName,
        body: t.videoCallInvite,
        url: window.location.href,
        tag: selectedRoom.id,
      }),
    }).catch(() => {});
    await joinVideoCall(providerRoomName);
    isSending.current = false;
    setSending(false);
  };

  const confirmUpload = async (cat: FileCategory) => { if (!pendingFile) return; setShowUploadMenu(false); await uploadFile(pendingFile,cat); setPendingFile(null); };

  const uploadFile = async (file: File, cat: FileCategory="general") => {
    if (!selectedRoom) return; setSending(true);
    try {
      const fn=`patients/${selectedRoom.id}/${Date.now()}-${file.name}`;
      const { error: ue } = await supabase.storage.from("chat-files").upload(fn,file);
      if (ue){setSending(false);return;}
      const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn);
      let mt="file";
      if (file.type.startsWith("image/")) mt="image";
      else if (file.type.startsWith("video/")) mt="video";
      else if (file.type.startsWith("audio/")) mt="audio";
      const prefix=cat==="medication"?"[MED] ":cat==="before_photo"?"[BEFORE] ":"";
      const sName=userProfile?.full_name||userProfile?.display_name||"Staff";
      const sRole=userProfile?.role||"staff";
      const sOffice=userProfile?.office_location||selectedRoom?.procedures?.office_location||null;
      const tempId="temp-file-"+Date.now();
      setMessages(p=>[...p,{id:tempId,room_id:selectedRoom.id,content:ud.publicUrl,message_type:mt,file_name:prefix+file.name,file_size:file.size,sender_type:"staff",sender_name:sName,sender_role:sRole,created_at:new Date().toISOString()}]);
      const { data: nm } = await supabase.from("messages").insert({room_id:selectedRoom.id,content:ud.publicUrl,message_type:mt,file_name:prefix+file.name,file_size:file.size,sender_type:"staff",sender_id:currentUserId||null,sender_name:sName,sender_role:sRole,sender_office:sOffice}).select().single();
      if (nm) setMessages(p=>p.map(m=>m.id===tempId?nm:m));
      else setMessages(p=>p.filter(m=>m.id!==tempId));
    } catch(e){console.error(e);}
    setSending(false);
  };

  const saveInternalNote = async () => {
    if (!selectedRoom || !internalNoteDraft.trim() || savingInternalNote) return;
    setSavingInternalNote(true);
    const sName = userProfile?.full_name || userProfile?.display_name || "Staff";
    const sRole = userProfile?.role || "staff";
    const sOffice = userProfile?.office_location || selectedRoom?.procedures?.office_location || null;
    const tempId = "temp-note-" + Date.now();
    const tempMessage = {
      id: tempId,
      room_id: selectedRoom.id,
      content: internalNoteDraft.trim(),
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
        content: internalNoteDraft.trim(),
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
      fetch("/api/push",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          roomId:selectedRoom.id,
          userType:"staff",
          title: lang === "es" ? `Nota interna · ${roomPatientName(selectedRoom.id)}` : `Internal note · ${roomPatientName(selectedRoom.id)}`,
          body: `${data.content || ""}`.trim().slice(0, 120) || (lang === "es" ? "Nuevo seguimiento interno del equipo." : "New internal care-team follow-up."),
          url: window.location.href,
          tag: `internal-note-${selectedRoom.id}`,
        }),
      }).catch(()=>{});
      alert(t.noteSaved);
    }

    setSavingInternalNote(false);
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
        alert(t.teamSaved);
        return;
      }
    }

    setSavingTeam(false);
    alert(lang === "es" ? "No pude actualizar el equipo." : "I could not update the team.");
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
    if (!newPatientFirstName.trim()||!newPatientLastName.trim()||!newProcedureName.trim()){setNewRoomError(t.required);return;}
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
      await supabase.from("messages").insert({
        room_id: rm.id,
        content: lang === "es" ? "✅ Sala creada y equipo asignado." : "✅ Room created and care team assigned.",
        message_type: "text",
        sender_type: "staff",
        sender_id: creatorId,
        sender_name: "Sistema",
        sender_role: creatorRole,
        sender_office: newLocation,
      });
      for (let i = 0; i < beforePhotosFiles.length; i++) {
        const f = beforePhotosFiles[i];
        const fn2 = `patients/${rm.id}/${Date.now()}-${i}-${f.name}`;
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
            sender_name: "Sistema",
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
        await uploadFile(new File([b],`voice-${Date.now()}.${ext}`,{type:finalMimeType}));
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
      setMenuOpen(false);
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
          if (!shouldDiscard) {
            const ext = extensionForMimeType(finalMimeType, "webm");
            await uploadFile(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type || finalMimeType }));
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
      await uploadFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }
  };
  const sendCapturedVideo = () => {
    if (captureMode === "video" && captureRecorderRef.current) {
      discardCaptureRef.current = false;
      captureRecorderRef.current.stop();
    }
  };
  const handleSend = () => sendMessage();
  const handleMic = () => {
    if (recording) stopRec();
    else startRec();
  };
  const handleCamera = () => {
    if (prefersNativeCapture) cameraInputRef.current?.click();
    else openCapture("photo");
  };
  const handleVideo = () => {
    if (prefersNativeCapture) videoInputRef.current?.click();
    else openCapture("video");
  };
  const handleCall = () => {
    window.location.href = "tel:+YOUR_NUMBER";
  };
  const handlePlus = () => {
    setMenuOpen(prev => !prev);
  };

  const slashFiltered = quickReplies.filter(r=>slashFilter===""||r.shortcut.toLowerCase().includes(slashFilter.toLowerCase())||r.message.toLowerCase().includes(slashFilter.toLowerCase()));
  const roomMediaEntries = messages
    .filter((entry) => !entry.deleted_by_staff && !entry.deleted_by_patient && !entry.is_internal)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const roomImageVideoEntries = roomMediaEntries.filter((entry) => entry.message_type === "image" || entry.message_type === "video");
  const roomAudioEntries = roomMediaEntries.filter((entry) => entry.message_type === "audio");
  const roomFileEntries = roomMediaEntries.filter((entry) => entry.message_type === "file");
  const appendEmojiToDraft = (emoji: string) => {
    setNewMessage((previous) => {
      const next = `${previous}${emoji}`;
      updateTypingState(next);
      return next;
    });
    setShowSlashMenu(false);
  };
  const filtPts = patients
    .filter(p=>{
      const q=searchQuery.toLowerCase();
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

  const SettingsPanel = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:"max(16px, env(safe-area-inset-top))"}} onClick={()=>setShowSettings(false)}>
      <div style={{background:sidebarBg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:540,maxHeight:"calc(100dvh - max(16px, env(safe-area-inset-top)))",overflowY:"auto",padding:`0 0 calc(40px + env(safe-area-inset-bottom))`,WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:sidebarBg,zIndex:10,padding:"max(20px, calc(env(safe-area-inset-top) + 8px)) max(20px, env(safe-area-inset-right)) 16px max(20px, env(safe-area-inset-left))",borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:22,fontWeight:700,color:textColor}}>⚙️ {t.settings}</p>
          <button onClick={()=>setShowSettings(false)} style={{background:cardBg,border:"none",borderRadius:99,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer",color:textColor,fontFamily:"inherit",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"0 20px"}}>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:700,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:14}}>{t.myProfile}</p>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
              <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,#2C2C2E,#007AFF)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:24,fontWeight:700,overflow:"hidden",flexShrink:0}}>
                {userProfile?.avatar_url?<img src={userProfile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:ini(userProfile?.full_name||"S")}
              </div>
              <div>
                <p style={{fontSize:17,fontWeight:700,color:textColor}}>{userProfile?.full_name||userProfile?.display_name||"Staff"}</p>
                <p style={{fontSize:13,color:subTextColor,marginTop:2}}>{t.role}: {userProfile?.role||"staff"}</p>
                <input ref={profilePicSettingsRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfilePhoto(f);}}/>
                <button onClick={()=>profilePicSettingsRef.current?.click()} style={{marginTop:8,background:"#007AFF",border:"none",borderRadius:8,color:"white",padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📷 {t.changePhoto}</button>
              </div>
            </div>
            <p style={{fontSize:13,fontWeight:700,color:subTextColor,marginBottom:6}}>{t.displayName}</p>
            <div style={{display:"flex",gap:8}}>
              <input value={displayNameEdit} onChange={e=>setDisplayNameEdit(e.target.value)} style={{flex:1,padding:"11px 14px",background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`,borderRadius:10,fontSize:15,fontFamily:"inherit",color:textColor,outline:"none"}}/>
              <button onClick={saveDisplayName} disabled={savingName} style={{padding:"11px 16px",background:savedName?"#34C759":"#007AFF",border:"none",borderRadius:10,color:"white",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>{savedName?"✅":savingName?"...":t.save}</button>
            </div>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5}}>⚡ {t.quickReplies} ({quickReplies.length})</p>
                <p style={{fontSize:13,color:subTextColor,marginTop:6}}>{t.typeSlash}</p>
              </div>
              <button onClick={()=>{setShowSettings(false);setShowQREditor(true);}} style={{background:"#007AFF",border:"none",borderRadius:10,color:"white",padding:"8px 16px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✏️ {t.edit}</button>
            </div>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:700,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:14}}>🎨 {lang==="es"?"Apariencia":"Appearance"}</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <span style={{fontSize:16,color:textColor,fontWeight:500}}>🌙 {t.darkMode}</span>
              <button onClick={()=>setDarkMode(d=>!d)} style={{width:52,height:30,borderRadius:99,background:darkMode?"#34C759":"#E5E5EA",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"white",position:"absolute",top:2,left:darkMode?24:2,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>
            <span style={{fontSize:16,color:textColor,fontWeight:500,display:"block",marginBottom:10}}>🔤 {t.fontSize}</span>
            <div style={{display:"flex",gap:8}}>
              {(["small","medium","large"] as const).map(level=>(
                <button key={level} onClick={()=>setFontSizeLevel(level)} style={{flex:1,padding:"10px 0",borderRadius:10,border:fontSizeLevel===level?"2px solid #007AFF":`2px solid ${borderColor}`,background:fontSizeLevel===level?"#EBF5FF":(darkMode?"#2C2C2E":"white"),color:fontSizeLevel===level?"#007AFF":textColor,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:level==="small"?13:level==="large"?18:15}}>
                  {t[level]}
                </button>
              ))}
            </div>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:700,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>🌐 {lang==="es"?"Idioma":"Language"}</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setLang("es")} style={{flex:1,padding:12,borderRadius:10,border:lang==="es"?"2px solid #007AFF":`2px solid ${borderColor}`,background:lang==="es"?"#EBF5FF":(darkMode?"#2C2C2E":"white"),color:lang==="es"?"#007AFF":textColor,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>🇲🇽 Español</button>
              <button onClick={()=>setLang("en")} style={{flex:1,padding:12,borderRadius:10,border:lang==="en"?"2px solid #007AFF":`2px solid ${borderColor}`,background:lang==="en"?"#EBF5FF":(darkMode?"#2C2C2E":"white"),color:lang==="en"?"#007AFF":textColor,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>🇺🇸 English</button>
            </div>
          </div>
          <div style={{background:cardBg,borderRadius:16,padding:16,marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:700,color:subTextColor,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>🌍 {lang==="es" ? "Traducción" : "Translation"}</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div>
                <p style={{fontSize:15,fontWeight:700,color:textColor,margin:0}}>
                  {lang==="es" ? "Traducir mensajes de pacientes automáticamente" : "Auto-translate patient messages"}
                </p>
                <p style={{fontSize:13,color:subTextColor,marginTop:6}}>
                  {lang==="es" ? "Solo cambia cómo se muestran tus mensajes entrantes." : "Only changes how incoming messages are displayed."}
                </p>
              </div>
              <button onClick={()=>setAutoTranslateIncoming((prev)=>!prev)} style={{width:52,height:30,borderRadius:99,background:autoTranslateIncoming?"#34C759":"#E5E5EA",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"white",position:"absolute",top:2,left:autoTranslateIncoming?24:2,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PatientInfoPanel = () => {
    const patient = selectedRoom?.procedures?.patients;
    const beforeEntries = messages.filter((entry) => (entry.file_name || "").startsWith("[BEFORE]"));
    const internalNotes = messages.filter((entry) => entry.is_internal).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const locale = lang === "es" ? "es-MX" : "en-US";
    const localTime = currentTimeInZone(patient?.timezone, locale);
    const panelCareTeamDirectory = staffDirectory.filter((member) => !member.office_location || member.office_location === selectedRoom?.procedures?.office_location);
    const panelCareTeamGroups = CARE_TEAM_ROLE_ORDER.map((role) => ({
      role,
      members: panelCareTeamDirectory.filter((member) => (member.role || "staff") === role),
    })).filter((group) => group.members.length > 0);

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:210,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:"max(16px, env(safe-area-inset-top))",overflow:"hidden",touchAction:"none",overscrollBehavior:"none"}} onClick={()=>setShowPatientInfo(false)}>
        <div style={{background:sidebarBg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:580,maxHeight:"calc(100dvh - max(16px, env(safe-area-inset-top)))",overflow:"hidden",padding:0,touchAction:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{position:"sticky",top:0,background:sidebarBg,zIndex:10,padding:"max(20px, calc(env(safe-area-inset-top) + 8px)) max(20px, env(safe-area-inset-right)) 16px max(20px, env(safe-area-inset-left))",borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{fontSize:22,fontWeight:700,color:textColor}}>{t.patientInfo}</p>
              <p style={{fontSize:13,color:subTextColor,marginTop:4}}>{t.patientInfoHint}</p>
            </div>
            <button onClick={()=>setShowPatientInfo(false)} style={{width:44,height:44,background:"#0B3C5D",border:"none",borderRadius:"50%",fontSize:24,fontWeight:900,cursor:"pointer",color:"#fff",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 18px rgba(11,60,93,0.28)"}}>×</button>
          </div>
          <div style={{padding:"0 20px calc(40px + env(safe-area-inset-bottom))",display:"grid",gap:14,maxHeight:"calc(100dvh - max(16px, env(safe-area-inset-top)) - 84px)",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",touchAction:"pan-y"}}>
            <div style={{background:cardBg,borderRadius:18,padding:16,display:"grid",gridTemplateColumns:"88px 1fr",gap:14,alignItems:"center"}}>
              <div style={{width:88,height:88,borderRadius:20,overflow:"hidden",background:"linear-gradient(135deg,#0F172A,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:28,fontWeight:800}}>
                {patient?.profile_picture_url ? <img src={patient.profile_picture_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini(patient?.full_name || "P")}
              </div>
              <div style={{minWidth:0}}>
                <p style={{fontSize:22,fontWeight:800,color:textColor}}>{patient?.full_name || (lang==="es" ? "Paciente sin nombre" : "Unnamed patient")}</p>
                <p style={{fontSize:14,color:subTextColor,marginTop:4}}>{selectedRoom?.procedures?.procedure_name || (lang==="es" ? "Sin procedimiento" : "No procedure")}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
                  <span style={{padding:"6px 10px",borderRadius:999,background:"#EBF5FF",color:"#2563EB",fontSize:12,fontWeight:700}}>{selectedRoom?.procedures?.office_location || (lang==="es" ? "Sin sede" : "No office")}</span>
                  <span style={{padding:"6px 10px",borderRadius:999,background:"#EEFDF3",color:"#15803D",fontSize:12,fontWeight:700}}>{labelPatientLanguage(patient?.preferred_language, lang)}</span>
                </div>
              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:13,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:12}}>{lang==="es" ? "Datos principales" : "Core details"}</p>
              <div style={{display:"grid",gap:10}}>
                <div><strong style={{color:textColor}}>{t.phone}:</strong> <span style={{color:subTextColor}}>{patient?.phone || "—"}</span></div>
                <div><strong style={{color:textColor}}>{t.email}:</strong> <span style={{color:subTextColor}}>{patient?.email || "—"}</span></div>
                <div><strong style={{color:textColor}}>{t.birthdate}:</strong> <span style={{color:subTextColor}}>{patient?.birthdate ? new Date(patient.birthdate).toLocaleDateString(locale) : "—"}</span></div>
                <div><strong style={{color:textColor}}>{t.timezone}:</strong> <span style={{color:subTextColor}}>{labelTimeZone(patient?.timezone)}</span></div>
                {localTime && <div><strong style={{color:textColor}}>{t.patientLocalTime}:</strong> <span style={{color:subTextColor}}>{localTime}</span></div>}
                <div><strong style={{color:textColor}}>{t.allergies}:</strong> <span style={{color:subTextColor}}>{patient?.allergies || "—"}</span></div>
                <div><strong style={{color:textColor}}>{t.medications}:</strong> <span style={{color:subTextColor}}>{patient?.current_medications || "—"}</span></div>
              </div>
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:13,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:12}}>{lang==="es" ? "Equipo asignado" : "Assigned care team"}</p>
              {selectedRoomTeam.length===0 ? (
                <p style={{fontSize:14,color:subTextColor}}>{t.teamEmpty}</p>
              ) : (
                <div style={{display:"grid",gap:10}}>
                  {selectedRoomTeam.map((member) => (
                    <div key={member.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:14,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`}}>
                      <div style={{width:42,height:42,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#111827,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800}}>
                        {member.avatar_url ? <img src={member.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini(member.full_name || "S")}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:textColor}}>{member.full_name || (lang==="es" ? "Sin nombre" : "No name")}</div>
                        <div style={{fontSize:13,color:subTextColor}}>{roleName(member.role)} · {member.office_location || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {canManageCareTeam && (
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${borderColor}`}}>
                  <p style={{fontSize:13,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:10}}>{t.manageTeam}</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = [selectedRoom?.created_by, ...panelCareTeamDirectory.map((member)=>member.id)].filter(Boolean) as string[];
                        setManagedTeamIds(Array.from(new Set(ids)));
                      }}
                      style={{padding:"8px 12px",borderRadius:999,border:"none",background:"#DBEAFE",color:"#1D4ED8",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
                    >
                      {t.careTeamSelectAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagedTeamIds(selectedRoom?.created_by ? [selectedRoom.created_by] : [])}
                      style={{padding:"8px 12px",borderRadius:999,border:"none",background:"#EEF2F7",color:"#475569",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
                    >
                      {t.careTeamClear}
                    </button>
                    <span style={{padding:"8px 12px",borderRadius:999,background:"white",border:`1px solid ${borderColor}`,fontSize:12,fontWeight:800,color:textColor}}>
                      {t.careTeamSelected}: {managedTeamIds.length}
                    </span>
                  </div>
                  <div style={{display:"grid",gap:10,marginBottom:12}}>
                    {panelCareTeamGroups.map((group)=>(
                      <div key={group.role} style={{background:darkMode?"#1F2937":"white",border:`1px solid ${borderColor}`,borderRadius:16,padding:12}}>
                        <p style={{fontSize:12,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:10}}>{careTeamRoleLabel(group.role)}</p>
                        <div style={{display:"grid",gap:8}}>
                          {group.members.map((member)=>(
                            <label key={member.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:managedTeamIds.includes(member.id)?"#EBF5FF":(darkMode?"#111827":"#F8FBFF"),border:managedTeamIds.includes(member.id)?"1px solid #93C5FD":`1px solid ${borderColor}`,cursor:"pointer"}}>
                              <input type="checkbox" checked={managedTeamIds.includes(member.id)} onChange={()=>setManagedTeamIds((current)=>current.includes(member.id)?current.filter((entry)=>entry!==member.id):[...current, member.id])} style={{width:16,height:16,accentColor:"#2563EB"}} />
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:14,fontWeight:800,color:textColor}}>{member.full_name || (lang==="es" ? "Personal" : "Staff")}</div>
                                <div style={{fontSize:12,color:subTextColor}}>{roleName(member.role)}{member.office_location ? ` · ${member.office_location}` : ""}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={saveManagedTeam} disabled={savingTeam} style={{width:"100%",padding:12,borderRadius:14,border:"none",background:"#2563EB",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:savingTeam?0.5:1}}>
                    {savingTeam ? (lang==="es" ? "Guardando..." : "Saving...") : t.saveTeam}
                  </button>
                </div>
              )}
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:13,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:12}}>{t.beforeMaterials}</p>
              {beforeEntries.length===0 ? (
                <p style={{fontSize:14,color:subTextColor}}>{lang==="es" ? "No hay material preoperatorio cargado todavía." : "No pre-op material has been uploaded yet."}</p>
              ) : (
                <div style={{display:"flex",gap:10,overflowX:"auto",overflowY:"hidden",WebkitOverflowScrolling:"touch",overscrollBehaviorX:"contain",touchAction:"pan-x",paddingBottom:4}}>
                  {beforeEntries.map((entry) => (
                    <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",flex:"0 0 92px"}}>
                      <div style={{aspectRatio:"1 / 1",borderRadius:14,overflow:"hidden",background:"#E5E7EB"}}>
                        <img src={entry.content} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div style={{background:cardBg,borderRadius:18,padding:16}}>
              <p style={{fontSize:13,fontWeight:800,color:subTextColor,textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>{t.internalNotes}</p>
              <p style={{fontSize:13,color:subTextColor,margin:"0 0 12px"}}>{t.internalNotesHint}</p>
              {internalNotes.length===0 ? (
                <p style={{fontSize:14,color:subTextColor,marginBottom:12}}>{t.noInternalNotes}</p>
              ) : (
                <div style={{display:"grid",gap:10,marginBottom:12}}>
                  {internalNotes.map((note)=>(
                    <div key={note.id} style={{padding:"12px 14px",borderRadius:14,background:darkMode?"#2C2C2E":"white",border:`1px solid ${borderColor}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                        <strong style={{color:textColor,fontSize:14}}>{note.sender_name || roleName(note.sender_role)}</strong>
                        <span style={{fontSize:12,color:subTextColor}}>{fmtTime(note.created_at)} · {new Date(note.created_at).toLocaleDateString(locale)}</span>
                      </div>
                      <div style={{fontSize:14,color:textColor,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{note.content}</div>
                    </div>
                  ))}
                </div>
              )}
              <textarea value={internalNoteDraft} onChange={(event)=>setInternalNoteDraft(event.target.value)} rows={3} placeholder={t.internalNotePH} style={{width:"100%",padding:"12px 14px",borderRadius:14,border:`1px solid ${borderColor}`,background:darkMode?"#0F172A":"white",color:textColor,fontFamily:"inherit",fontSize:14,resize:"vertical",marginBottom:10}} />
              <button onClick={saveInternalNote} disabled={savingInternalNote || !internalNoteDraft.trim()} style={{width:"100%",padding:12,borderRadius:14,border:"none",background:"#2563EB",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:savingInternalNote || !internalNoteDraft.trim()?0.5:1}}>
                {savingInternalNote ? (lang==="es" ? "Guardando..." : "Saving...") : t.addInternalNote}
              </button>
            </div>

            {canOpenAdmin && patient?.id && (
              <button onClick={()=>window.location.href=`/admin/paciente/${patient.id}`} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"#0F172A",color:"white",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                {t.openFullRecord}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .page { height: 100dvh; width: 100vw; background: ${bg}; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .topbar { height: 64px; background: ${headerBg}; color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; padding-top: env(safe-area-inset-top); box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
        .body { height: calc(100dvh - 64px); display: flex; overflow: hidden; }
        .sidebar { width: 370px; max-width: 42vw; background: ${sidebarBg}; border-right: 1px solid ${borderColor}; display: flex; flex-direction: column; min-width: 300px; }
        .sidebar-head { padding: 18px; border-bottom: 1px solid ${borderColor}; }
        .sidebar-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .search-bar { height: 42px; background: ${inputBg}; border-radius: 14px; display: flex; align-items: center; gap: 10px; padding: 0 13px; }
        .search-input { flex: 1; border: none; outline: none; background: transparent; color: ${textColor}; font-size: 15px; font-family: inherit; }
        .patient-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .patient-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-bottom: 1px solid ${borderColor}; cursor: pointer; transition: background 0.12s ease; }
        .patient-row:hover, .patient-row.active { background: ${darkMode ? "#1F2937" : "#EFF6FF"}; }
        .av { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#007AFF,#34C759); color: white; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; position: relative; overflow: hidden; flex-shrink: 0; }
        .av-badge { position: absolute; right: 0; bottom: 0; width: 13px; height: 13px; border-radius: 50%; background: #25D366; border: 2px solid ${sidebarBg}; }
        .patient-info { min-width: 0; flex: 1; }
        .patient-name { color: ${textColor}; font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .patient-meta { color: ${subTextColor}; font-size: 12px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .main-area { flex: 1; min-width: 0; height: 100%; background: ${bg}; display: flex; flex-direction: column; }
        .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 28px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 820px) {
          .body { display: block; }
          .sidebar { width: 100%; max-width: none; height: 100%; min-width: 0; border-right: none; }
          .main-area { height: 100%; }
          .hidden { display: none !important; }
        }
      `}</style>

      <div className="page">
        <div className="topbar">
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            {mobileView==="chat"&&(
              <button onClick={()=>setMobileView("list")} style={{width:38,height:38,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.12)",color:"white",fontSize:22,cursor:"pointer"}} aria-label="Back">‹</button>
            )}
            <div style={{minWidth:0}}>
              <div style={{fontSize:18,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {selectedRoom?.patients?.full_name || "Dr. Fonseca Portal"}
              </div>
              <div style={{fontSize:12,opacity:0.76,fontWeight:700}}>
                {selectedRoom ? t.online : "Staff"}
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {totalUnread>0&&<div style={{background:"#FF3B30",color:"white",fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{totalUnread}</div>}
            {canOpenAdmin&&<button onClick={()=>window.location.href="/admin"} style={{padding:"0 14px",height:42,borderRadius:99,background:"rgba(255,255,255,0.1)",border:"none",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>Admin</button>}
          </div>
        </div>

        {toastAlert && (
          <div style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 78px)",right:16,zIndex:250,width:"min(360px, calc(100vw - 32px))",background:darkMode?"rgba(17,24,39,0.96)":"rgba(255,255,255,0.98)",color:textColor,border:`1px solid ${borderColor}`,borderRadius:18,boxShadow:"0 18px 46px rgba(15,23,42,0.2)",padding:"14px 16px",cursor:"pointer"}} onClick={()=>{const room = patients.flatMap((patient)=>patient.rooms||[]).find((entry:any)=>entry.id===toastAlert.roomId) || null; setSelectedRoom(room); setMobileView("chat"); setToastAlert(null);}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:"#25D366",flexShrink:0}} />
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:"#16A34A",marginBottom:2}}>{lang==="es" ? "Nuevo mensaje del paciente" : "New patient message"}</div>
                <div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{toastAlert.title}</div>
                <div style={{fontSize:13,color:subTextColor,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{toastAlert.body}</div>
              </div>
              <button onClick={(event)=>{event.stopPropagation();setToastAlert(null);}} style={{border:"none",background:"transparent",color:subTextColor,cursor:"pointer",fontSize:18,lineHeight:1}}>x</button>
            </div>
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
                <button
                  onClick={() => {
                    if (!canCreatePatientRooms) {
                      setNotificationFeedback({
                        tone: "error",
                        text: lang === "es"
                          ? "No tienes permiso para crear pacientes. Solo el personal habilitado por Admin puede hacerlo."
                          : "You do not have permission to create patients. Only admin-enabled staff can do this.",
                      });
                      return;
                    }
                    setShowNewRoom(true);
                  }}
                  style={{width:38,height:38,borderRadius:"50%",background:"#007AFF",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,122,255,0.3)"}}
                  title={canCreatePatientRooms ? (lang === "es" ? "Crear paciente" : "Create patient") : (lang === "es" ? "Permiso requerido" : "Permission required")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              <div className="search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input className="search-input" placeholder={t.search} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              </div>
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
                  <div style={{fontSize:48,marginBottom:12}}>+</div>
                  <p style={{fontSize:17,fontWeight:600,color:textColor}}>{t.noPatients}</p>
                  <p style={{fontSize:14,color:subTextColor,marginTop:6}}>{t.noPatientsHint}</p>
                </div>
              ):filtPts.map(pt=>{
                const ptUnreadCount=pt.rooms.reduce((sum:number,r:any)=>sum+(unreadCounts[r.id]||0),0);
                const ptUnread=ptUnreadCount>0;
                const firstRoom=pt.rooms[0];
                const proc=firstRoom?.procedures;
                const surgDate=proc?.surgery_date?new Date(proc.surgery_date).toLocaleDateString(lang==="es"?"es-MX":"en-US",{day:"2-digit",month:"2-digit",year:"2-digit"}):"";
                const isActive=pt.rooms.some((r:any)=>r.id===selectedRoom?.id);
                return (
                  <div key={pt.id} className={`patient-row${isActive?" active":""}`} onClick={()=>{setSelectedRoom(firstRoom);setMobileView("chat");}}>
                    <div className="av">
                      {pt.profile_picture_url?<img src={pt.profile_picture_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:ini(pt.full_name)}
                      {ptUnread&&<div className="av-badge"/>}
                    </div>
                    <div className="patient-info">
                      <div className="patient-name">{pt.full_name}</div>
                      <div className="patient-meta">
                        {proc?.procedure_name&&<span>{proc.procedure_name}</span>}
                        {surgDate&&<span> - {surgDate}</span>}
                        {proc?.office_location&&<span> - {proc.office_location==="Guadalajara"?"GDL":"TJN"}</span>}
                      </div>
                    </div>
                    {ptUnread&&<div style={{minWidth:24,height:24,padding:"0 8px",background:"#25D366",borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:12,fontWeight:800}}>{ptUnreadCount}</div>}
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
              <ChatShell
                mode="staff"
                messages={messages}
                message={message}
                onChange={setMessage}
                onSend={handleSend}
                onMic={handleMic}
                onCamera={handleCamera}
                onVideo={handleVideo}
                onPlusClick={handlePlus}
                onCall={handleCall}
                menuOpen={menuOpen}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
