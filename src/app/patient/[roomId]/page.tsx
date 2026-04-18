"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { labelPatientLanguage } from "@/lib/patientMeta";
import { syncPushSubscription } from "@/lib/pushSubscriptions";

type Lang = "es" | "en";
type FontSizeLevel = "small" | "medium" | "large";
type MediaTab = "media" | "audio" | "docs";

const QUICK_EMOJIS = ["😀", "😂", "😍", "🙏", "👍", "👏", "❤️", "✅", "⚠️", "📎", "📸", "🎥"];

type PatientSettings = {
  displayName: string;
  darkMode: boolean;
  fontSizeLevel: FontSizeLevel;
  lang: Lang;
  avatarDataUrl: string;
  quickReplies: string[];
};

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DEFAULT_QUICK_REPLIES = {
  es: ["Hola", "Gracias", "Tengo una duda", "Voy en camino", "Me siento bien"],
  en: ["Hello", "Thank you", "I have a question", "I am on my way", "I feel okay"],
};

const T = {
  es: {
    loading: "Abriendo chat privado...",
    invalidLink: "Este enlace ya no es válido.",
    invalidLinkHint: "Pide un enlace actualizado al equipo del Dr. Fonseca.",
    roomTitle: "Chat del paciente",
    secureChat: "Conversación privada con tu equipo médico",
    settings: "Ajustes",
    displayName: "Tu nombre visible",
    darkMode: "Modo oscuro",
    fontSize: "Tamaño de texto",
    language: "Idioma",
    quickReplies: "Respuestas rápidas",
    quickRepliesSlashHint: "Escribe / para ver tus respuestas rápidas.",
    addReply: "Agregar respuesta",
    replyPlaceholder: "Ej: Tengo una duda",
    profilePhoto: "Foto de perfil",
    uploadPhoto: "Subir foto",
    close: "Cerrar",
    save: "Guardar",
    typeMessage: "Escribe tu mensaje...",
    recordAudio: "Grabar audio",
    recordVideo: "Grabar video",
    attachmentOptions: "Adjuntar",
    takePhoto: "Tomar foto",
    photoLibrary: "Fotos y videos",
    takePhotoVideo: "Tomar foto o video",
    recordAudioOption: "Grabar audio",
    recordVideoOption: "Grabar video",
    chooseFile: "Elegir archivo",
    send: "Enviar",
    online: "Clínica en línea",
    addToHome: "Guarda este enlace para volver fácilmente a tu chat.",
    noMessages: "Todavía no hay mensajes.",
    noMessagesHint: "Cuando escribas, el equipo verá tu mensaje en su panel.",
    patient: "Paciente",
    clinic: "Clínica",
    careTeamLabel: "Equipo clínico",
    typingSuffix: "está escribiendo...",
    quickReplyHint: "Toca una respuesta para enviarla rápido.",
    installedHint: "Puedes volver usando este mismo enlace cuando quieras.",
    installApp: "Agregar a pantalla inicial",
    installHelpTitle: "Guarda este chat en tu teléfono",
    installHelpIOS: "En iPhone o iPad: toca Compartir y luego Agregar a pantalla de inicio.",
    installHelpOther: "En tu navegador puedes instalar este chat para volver más rápido.",
    setupDone: "Listo. Puedes volver a este chat cuando quieras.",
    dismiss: "Ocultar",
    enableAlerts: "Activar notificaciones",
    alertsReady: "Notificaciones activadas",
    alertsBlocked: "Las notificaciones están bloqueadas en este navegador.",
    photoHelp: "Esta foto solo se guarda en este dispositivo.",
    callOffice: "Llamar a la oficina",
    callOfficeHint: "Si necesitas ayuda inmediata, llama a la sede asignada.",
    startVideoCall: "Iniciar videollamada",
    requestVideoCall: "Solicitar videollamada",
    joinVideoCall: "Unirse a videollamada",
    videoCallInvite: "Invitación de videollamada",
    videoCallInviteBody: "Toca para entrar a la videollamada segura.",
    videoCallOpenError: "No pude abrir la videollamada. Revisa si tu navegador bloqueó la ventana.",
    incomingCallRequest: "Solicitud de videollamada",
    callRequestBody: "Se avisó al equipo clínico para iniciar la llamada.",
    callRequestSent: "Solicitud enviada. Esperando al equipo clínico…",
    shareInvite: "Invitar",
    inviteCopied: "Enlace copiado",
    openInChat: "Abrir en chat",
    endAndReturn: "Terminar y volver al chat",
    callEndedNote: "Videollamada finalizada",
    stopAndSendAudio: "Detener y enviar audio",
    stopAndSendVideo: "Detener y enviar video",
    preparingCamera: "Abriendo cámara...",
    takePhotoNow: "Tomar foto ahora",
    cancelCapture: "Cancelar",
    deleteMsg: "¿Eliminar este mensaje?",
    msgDeleted: "Mensaje eliminado",
    deleteAction: "Eliminar",
  },
  en: {
    loading: "Opening private chat...",
    invalidLink: "This link is no longer valid.",
    invalidLinkHint: "Ask Dr. Fonseca's team for an updated link.",
    roomTitle: "Patient chat",
    secureChat: "Private conversation with your care team",
    settings: "Settings",
    displayName: "Your visible name",
    darkMode: "Dark mode",
    fontSize: "Text size",
    language: "Language",
    quickReplies: "Quick replies",
    quickRepliesSlashHint: "Type / to see your quick replies.",
    addReply: "Add reply",
    replyPlaceholder: "e.g. I have a question",
    profilePhoto: "Profile photo",
    uploadPhoto: "Upload photo",
    close: "Close",
    save: "Save",
    typeMessage: "Type your message...",
    recordAudio: "Record audio",
    recordVideo: "Record video",
    attachmentOptions: "Attach",
    takePhoto: "Take photo",
    photoLibrary: "Photo library",
    takePhotoVideo: "Take photo or video",
    recordAudioOption: "Record audio",
    recordVideoOption: "Record video",
    chooseFile: "Choose file",
    send: "Send",
    online: "Care team online",
    addToHome: "Save this link so you can easily come back to your chat.",
    noMessages: "There are no messages yet.",
    noMessagesHint: "When you write, the care team will see your message in their panel.",
    patient: "Patient",
    clinic: "Clinic",
    careTeamLabel: "Care team",
    typingSuffix: "is typing...",
    quickReplyHint: "Tap a quick reply to send it fast.",
    installedHint: "You can come back using this same link anytime.",
    installApp: "Add to home screen",
    installHelpTitle: "Save this chat on your device",
    installHelpIOS: "On iPhone or iPad: tap Share and then Add to Home Screen.",
    installHelpOther: "In your browser you can install this chat for faster return.",
    setupDone: "Done. You can return to this chat anytime.",
    dismiss: "Hide",
    enableAlerts: "Enable notifications",
    alertsReady: "Notifications enabled",
    alertsBlocked: "Notifications are blocked in this browser.",
    photoHelp: "This photo only stays on this device.",
    callOffice: "Call office",
    callOfficeHint: "If you need immediate help, call the assigned office.",
    startVideoCall: "Start video call",
    requestVideoCall: "Request video call",
    joinVideoCall: "Join video call",
    videoCallInvite: "Video call invite",
    videoCallInviteBody: "Tap to join the secure video call.",
    videoCallOpenError: "I could not open the video call. Check if your browser blocked the popup.",
    incomingCallRequest: "Video call request",
    callRequestBody: "The care team has been notified to start the call.",
    callRequestSent: "Request sent. Waiting for the care team…",
    shareInvite: "Invite",
    inviteCopied: "Link copied",
    openInChat: "Open in chat",
    endAndReturn: "End and return to chat",
    callEndedNote: "Video call ended",
    stopAndSendAudio: "Stop and send audio",
    stopAndSendVideo: "Stop and send video",
    preparingCamera: "Opening camera...",
    takePhotoNow: "Take photo now",
    cancelCapture: "Cancel",
    deleteMsg: "Delete this message?",
    msgDeleted: "Message deleted",
    deleteAction: "Delete",
  },
} as const;

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

const storageKeyForRoom = (roomId: string) => `patient-room-settings-${roomId}`;
const setupDismissedKeyForRoom = (roomId: string) => `patient-room-setup-dismissed-${roomId}`;
const setupDismissedGlobalKey = "patient-room-setup-dismissed-global-v1";
const lastAlertedStaffMessageKeyForRoom = (roomId: string) => `patient-last-alerted-staff-message-${roomId}`;

export default function PatientPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [officePhones, setOfficePhones] = useState<{ Guadalajara: string; Tijuana: string }>({ Guadalajara: "", Tijuana: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [notificationsPermission, setNotificationsPermission] = useState<NotificationPermission>("default");
  const [isStandalone, setIsStandalone] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [setupFeedback, setSetupFeedback] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [toastAlert, setToastAlert] = useState<{ title: string; body: string } | null>(null);
  const [autoTranslateIncoming, setAutoTranslateIncoming] = useState(true);
  const [translatedIncoming, setTranslatedIncoming] = useState<Record<string, string>>({});
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [callOverlayOpen, setCallOverlayOpen] = useState(false);
  const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
  const [activeCallRoomName, setActiveCallRoomName] = useState<string | null>(null);
  const [callInviteFeedback, setCallInviteFeedback] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<MediaTab>("media");
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | null>(null);
  const [preparingCapture, setPreparingCapture] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const [staffTypingName, setStaffTypingName] = useState("");
  const [settings, setSettings] = useState<PatientSettings>({
    displayName: "",
    darkMode: false,
    fontSizeLevel: "medium",
    lang: "es",
    avatarDataUrl: "",
    quickReplies: DEFAULT_QUICK_REPLIES.es,
  });
  const [newQuickReply, setNewQuickReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaLibraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isSending = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureRecorderRef = useRef<MediaRecorder | null>(null);
  const captureChunksRef = useRef<Blob[]>([]);
  const discardCaptureRef = useRef(false);
  const discardAudioRef = useRef(false);
  const typingChannelRef = useRef<any>(null);
  const typingIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTypingRef = useRef(false);
  const notificationsPermissionRef = useRef<NotificationPermission>("default");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownStaffMessageKeyRef = useRef("");
  const translationCacheRef = useRef<Record<string, string>>({});

  const t = T[settings.lang];
  const fontSize = settings.fontSizeLevel === "small" ? 15 : settings.fontSizeLevel === "large" ? 21 : 18;
  const bg = settings.darkMode ? "#0B141A" : "#EFEAE2";
  const surface = settings.darkMode ? "#111827" : "#FFFFFF";
  const inputBg = settings.darkMode ? "#202C33" : "#F0F2F5";
  const textColor = settings.darkMode ? "#F8FAFC" : "#111827";
  const subText = settings.darkMode ? "rgba(248,250,252,0.82)" : "#4B5563";
  const bubbleOut = "#DCF8C6";
  const bubbleIn = settings.darkMode ? "#1F2C34" : "#FFFFFF";
  const border = settings.darkMode ? "rgba(255,255,255,0.16)" : "#D1D9E6";
  const prefersNativeCapture =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isAppleMobile =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const isSchemaColumnError = (error: any) => {
    const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
    return message.includes("column") || message.includes("schema cache") || message.includes("relation");
  };
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

  const patientName = settings.displayName.trim() || room?.procedures?.patients?.full_name || t.patient;
  const officePhone = room?.procedures?.office_location === "Tijuana" ? officePhones.Tijuana : officePhones.Guadalajara;
  const slashMatches = useMemo(() => {
    const filter = slashFilter.trim().toLowerCase();
    return settings.quickReplies.filter((reply) => !filter || reply.toLowerCase().includes(filter));
  }, [settings.quickReplies, slashFilter]);

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: any[] }[] = [];
    let currentDate = "";
    messages.forEach((message) => {
      if (message.is_internal || message.deleted_by_staff) return;
      const key = new Date(message.created_at).toDateString();
      if (key !== currentDate) {
        currentDate = key;
        groups.push({ date: message.created_at, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(message);
    });
    return groups;
  }, [messages]);
  const roomMediaEntries = useMemo(
    () =>
      messages
        .filter((message) => !message.is_internal && !message.deleted_by_staff && !message.deleted_by_patient)
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [messages]
  );
  const roomImageVideoEntries = useMemo(
    () => roomMediaEntries.filter((message) => message.message_type === "image" || message.message_type === "video"),
    [roomMediaEntries]
  );
  const roomAudioEntries = useMemo(
    () => roomMediaEntries.filter((message) => message.message_type === "audio"),
    [roomMediaEntries]
  );
  const roomFileEntries = useMemo(
    () => roomMediaEntries.filter((message) => message.message_type === "file"),
    [roomMediaEntries]
  );
  const appendEmojiToDraft = (emoji: string) => {
    setNewMessage((previous) => {
      const next = `${previous}${emoji}`;
      updateTypingState(next);
      return next;
    });
    setShowSlashMenu(false);
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
    if (message.message_type === "audio") return settings.lang === "es" ? "Nuevo audio" : "New audio";
    if (message.message_type === "video") return settings.lang === "es" ? "Nuevo video" : "New video";
    if (message.message_type === "image") return settings.lang === "es" ? "Nueva imagen" : "New image";
    if (message.message_type === "file") return settings.lang === "es" ? "Nuevo archivo" : "New file";
    if (parseVideoCallMessage(message.content)) return t.videoCallInvite;
    const text = `${message.content || ""}`.trim();
    return text ? text.slice(0, 120) : settings.lang === "es" ? "Nuevo mensaje" : "New message";
  }, [settings.lang, t.incomingCallRequest, t.videoCallInvite]);

  const messageIdentity = useCallback((message: any) => {
    if (!message) return "";
    return `${message.id || "no-id"}:${message.created_at || ""}:${message.sender_type || ""}`;
  }, []);
  const translationKey = useCallback((messageId: string | number, targetLang: "es" | "en") => `incoming_translate_${String(messageId)}_${targetLang}`, []);

  const showIncomingToast = useCallback((title: string, body: string) => {
    setToastAlert({ title, body });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastAlert(null), 4500);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const notifyIncomingMessage = useCallback(async (message: any) => {
    const messageKey = messageIdentity(message);
    if (typeof window !== "undefined" && messageKey) {
      const lastAlerted = window.localStorage.getItem(lastAlertedStaffMessageKeyForRoom(roomId)) || "";
      if (lastAlerted === messageKey) return;
      window.localStorage.setItem(lastAlertedStaffMessageKeyForRoom(roomId), messageKey);
    }

    playIncomingTone();
    showIncomingToast(message.sender_name || staffTypingName || t.careTeamLabel, describeIncomingMessage(message));
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (document.visibilityState === "visible") return;
    if (notificationsPermissionRef.current !== "granted") return;

    const title = message.sender_name || staffTypingName || t.careTeamLabel;
    const options = {
      body: describeIncomingMessage(message),
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      data: { url: window.location.href },
    };

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration) {
        await registration.showNotification(title, options as NotificationOptions);
        return;
      }
    }

    if ("Notification" in window) new Notification(title, options);
  }, [describeIncomingMessage, messageIdentity, playIncomingTone, roomId, showIncomingToast, staffTypingName, t.careTeamLabel]);

  const broadcastTypingState = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current) return;
    outgoingTypingRef.current = isTyping;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        roomId,
        senderType: "patient",
        name: patientName,
        isTyping,
        sentAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }, [patientName, roomId]);

  const updateTypingState = useCallback((nextValue: string) => {
    const hasText = nextValue.trim().length > 0;
    if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);

    if (!hasText) {
      if (outgoingTypingRef.current) broadcastTypingState(false);
      return;
    }

    broadcastTypingState(true);
    typingIdleTimeoutRef.current = setTimeout(() => {
      broadcastTypingState(false);
    }, 1400);
  }, [broadcastTypingState]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && !shouldAutoScrollRef.current) {
      setShowJumpToLatest(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKeyForRoom(roomId)) : null;
    const dismissed = typeof window !== "undefined" ? window.localStorage.getItem(setupDismissedKeyForRoom(roomId)) : null;
    const dismissedGlobal = typeof window !== "undefined" ? window.localStorage.getItem(setupDismissedGlobalKey) : null;
    const translatePref = typeof window !== "undefined" ? window.localStorage.getItem(`patient_auto_translate_incoming_${roomId}`) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PatientSettings;
        setSettings(parsed);
      } catch {}
    }
    if (translatePref === "0") setAutoTranslateIncoming(false);
    if (dismissed === "1" || dismissedGlobal === "1") setSetupDismissed(true);
  }, [roomId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKeyForRoom(roomId), JSON.stringify(settings));
    }
  }, [roomId, settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`patient_auto_translate_incoming_${roomId}`, autoTranslateIncoming ? "1" : "0");
  }, [autoTranslateIncoming, roomId]);

  useEffect(() => {
    setTranslatedIncoming({});
    translationCacheRef.current = {};
  }, [settings.lang]);

  useEffect(() => {
    if (!autoTranslateIncoming) return;
    const candidates = messages.filter(
      (entry) =>
        entry?.sender_type === "staff" &&
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
        const key = translationKey(message.id, settings.lang);
        if (translationCacheRef.current[key]) continue;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: message.content,
              targetLang: settings.lang,
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
  }, [autoTranslateIncoming, messages, settings.lang, translationKey]);

  // Helper: convert VAPID public key to Uint8Array for push subscription
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  };

  // Subscribe this patient device to Web Push and save to Supabase
  const subscribeToPushNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error(settings.lang === "es" ? "Este navegador no soporta notificaciones push." : "This browser does not support push notifications.");
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      throw new Error(settings.lang === "es" ? "Falta la configuración de notificaciones en el servidor." : "Notification configuration is missing on the server.");
    }
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await syncPushSubscription({ subscription: sub.toJSON(), userType: "patient", roomId });
    return true;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("Notification" in window) {
      setNotificationsPermission(Notification.permission);
      notificationsPermissionRef.current = Notification.permission;
      if (Notification.permission === "granted") {
        subscribeToPushNotifications().catch((error) => {
          setSetupFeedback({
            tone: "error",
            text: error instanceof Error ? error.message : settings.lang === "es" ? "No pude activar las notificaciones todavía." : "I could not enable notifications yet.",
          });
        });
      }
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(standalone));

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as DeferredInstallPrompt);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    fetchRoom();
    fetchOfficePhones();

    const ch = supabase.channel("patient-rt-" + roomId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      }, ({ new: m }) => {
        if (m.is_internal) return;
        if (m.sender_type === "staff") {
          lastKnownStaffMessageKeyRef.current = messageIdentity(m);
          setStaffTyping(false);
          setStaffTypingName("");
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
          notifyIncomingMessage(m);
        }
        setMessages((prev) => {
          const ti = prev.findIndex((x) => typeof x.id === "string" && x.id.startsWith("temp-") && x.content === m.content && x.sender_type === m.sender_type);
          if (ti !== -1) { const u = [...prev]; u[ti] = m; return u; }
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .on("postgres_changes", {
        // When staff deletes a message, remove it from patient view immediately — no "deleted" indicator shown
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      }, ({ new: m }) => {
        if (m.deleted_by_staff) {
          // Completely remove from patient's message list — patient sees nothing
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [messageIdentity, notifyIncomingMessage, roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-signals:${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.senderType !== "staff") return;
        if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);

        if (!payload?.isTyping) {
          setStaffTyping(false);
          setStaffTypingName("");
          return;
        }

        setStaffTyping(true);
        setStaffTypingName(payload?.name || t.careTeamLabel);
        remoteTypingTimeoutRef.current = setTimeout(() => {
          setStaffTyping(false);
          setStaffTypingName("");
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
            roomId,
            senderType: "patient",
            name: patientName,
            isTyping: false,
            sentAt: new Date().toISOString(),
          },
        }).catch(() => {});
      }
      typingChannelRef.current = null;
      setStaffTyping(false);
      setStaffTypingName("");
      supabase.removeChannel(channel);
    };
  }, [patientName, roomId, t.careTeamLabel]);

  const fetchOfficePhones = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["office_phone_guadalajara", "office_phone_tijuana"]);

    if (!data) return;
    setOfficePhones({
      Guadalajara: data.find((entry: any) => entry.key === "office_phone_guadalajara")?.value || "",
      Tijuana: data.find((entry: any) => entry.key === "office_phone_tijuana")?.value || "",
    });
  };

  const loadMessages = async () => {
    let query = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });

    if (query.error && isSchemaColumnError(query.error)) {
      query = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
    }

    return query;
  };

  const fetchRoom = async () => {
    const extendedSelect = "*, procedures(procedure_name, office_location, patients(full_name, preferred_language))";
    const fallbackSelect = "*, procedures(procedure_name, office_location, patients(full_name))";

    let roomQuery = await supabase.from("rooms").select(extendedSelect).eq("id", roomId).single();
    if (roomQuery.error) {
      roomQuery = await supabase.from("rooms").select(fallbackSelect).eq("id", roomId).single();
    }

    const rm = roomQuery.data;
    if (roomQuery.error || !rm) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRoom(rm);
    setSettings((prev) => {
      const nextLang = prev.lang || (rm.procedures?.patients?.preferred_language === "en" ? "en" : "es");
      return {
        ...prev,
        lang: nextLang,
        quickReplies: prev.quickReplies?.length ? prev.quickReplies : DEFAULT_QUICK_REPLIES[nextLang],
      };
    });

    const { data: msgs } = await loadMessages();
    const nextMessages = (msgs || []).filter((message: any) => !message?.is_internal);
    setMessages(nextMessages);
    const latestStaffMessage = [...nextMessages].reverse().find((message: any) => message.sender_type === "staff");
    const latestStaffMessageKey = latestStaffMessage ? messageIdentity(latestStaffMessage) : "";
    lastKnownStaffMessageKeyRef.current = latestStaffMessageKey;
    if (typeof window !== "undefined") {
      if (latestStaffMessageKey) {
        window.localStorage.setItem(lastAlertedStaffMessageKeyForRoom(roomId), latestStaffMessageKey);
      } else {
        window.localStorage.removeItem(lastAlertedStaffMessageKeyForRoom(roomId));
      }
    }
    setLoading(false);
  };

  const refreshMessages = async () => {
    const { data: msgs } = await loadMessages();
    setMessages((msgs || []).filter((message: any) => !message?.is_internal));
  };

  const deletePatientMessage = async (messageId: string) => {
    if (!confirm(t.deleteMsg)) return;
    const deletedAt = new Date().toISOString();
    let result = await supabase
      .from("messages")
      .update({ deleted_by_patient: true, deleted_at: deletedAt })
      .eq("id", messageId);

    if (result.error && isSchemaColumnError(result.error)) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      return;
    }

    if (result.error) {
      alert(settings.lang === "es" ? "No pude eliminar este mensaje." : "I could not delete this message.");
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, deleted_by_patient: true, deleted_at: deletedAt } : message
      )
    );
  };

  const sendMessage = async (override?: string) => {
    const content = (override || newMessage).trim();
    if (!content || isSending.current) return;
    updateTypingState("");

    isSending.current = true;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        content,
        message_type: "text",
        sender_type: "patient",
        sender_name: patientName,
        created_at: new Date().toISOString(),
      },
    ]);

    let insert = await supabase.from("messages").insert({
      room_id: roomId,
      content,
      message_type: "text",
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false,
    }).select().single();

    if (insert.error && isSchemaColumnError(insert.error)) {
      insert = await supabase.from("messages").insert({
        room_id: roomId,
        content,
        message_type: "text",
        sender_type: "patient",
        sender_name: patientName,
      }).select().single();
    }

    if (insert.error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
    } else if (insert.data) {
      setMessages((prev) => prev.map((entry) => entry.id === tempId ? insert.data : entry));
    }

    // Push notification to all staff so they know immediately — even if app is closed
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        userType: "staff",
        title: patientName || "Paciente",
        body: content.length > 80 ? content.slice(0, 80) + "…" : content,
        url: "/inbox",
      }),
    }).catch(() => {});

    if (override || newMessage.startsWith("/")) {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
    if (!override) setNewMessage("");
    setSending(false);
    isSending.current = false;
  };

  const postSystemMessage = async (text: string) => {
    if (!text.trim()) return;
    const tempId = `temp-system-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        content: text,
        message_type: "text",
        sender_type: "staff",
        sender_name: "Sistema",
        created_at: new Date().toISOString(),
      },
    ]);

    let insertResult = await supabase.from("messages").insert({
      room_id: roomId,
      content: text,
      message_type: "text",
      sender_type: "staff",
      sender_name: "Sistema",
      is_internal: false,
    }).select().single();

    if (insertResult.error && isSchemaColumnError(insertResult.error)) {
      insertResult = await supabase.from("messages").insert({
        room_id: roomId,
        content: text,
        message_type: "text",
        sender_type: "staff",
        sender_name: "Sistema",
      }).select().single();
    }

    if (insertResult.error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      return;
    }
    if (insertResult.data) {
      setMessages((prev) => prev.map((entry) => (entry.id === tempId ? insertResult.data : entry)));
    }
  };

  const openCallOverlay = (url: string, providerRoomName: string) => {
    setActiveCallUrl(url);
    setActiveCallRoomName(providerRoomName);
    setCallOverlayOpen(true);
    setCallInviteFeedback("");
  };

  const getVideoCallFeedback = (error: unknown) => {
    const fallback = settings.lang === "es" ? "La videollamada no está disponible por ahora." : "Video call is unavailable right now.";
    if (!(error instanceof Error)) return fallback;
    const message = `${error.message || ""}`.trim();
    if (!message) return fallback;
    if (message.includes("DAILY_API_KEY")) return fallback;
    return message;
  };

  const joinVideoCall = async (providerRoomName: string) => {
    try {
      const response = await fetch("/api/video/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          providerRoomName,
          actorType: "patient",
          actorName: patientName || (settings.lang === "es" ? "Paciente" : "Patient"),
        }),
      });
      const json = await response.json();
      const joinUrl = `${json?.joinUrl || ""}`.trim();
      if (!response.ok || !joinUrl) throw new Error(json?.error || t.videoCallOpenError);
      openCallOverlay(joinUrl, providerRoomName);
    } catch (error) {
      setCallInviteFeedback(getVideoCallFeedback(error));
      window.setTimeout(() => setCallInviteFeedback(""), 2600);
    }
  };

  const closeCallOverlay = async () => {
    setCallOverlayOpen(false);
    setActiveCallUrl(null);
    setActiveCallRoomName(null);
    const now = new Date();
    const time = now.toLocaleTimeString(settings.lang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
    await postSystemMessage(`📴 ${t.callEndedNote} · ${time}`);
  };

  const shareCallInvite = async (providerRoomName: string) => {
    try {
      const response = await fetch("/api/video/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          providerRoomName,
          actorType: "patient",
          actorName: patientName || (settings.lang === "es" ? "Paciente" : "Patient"),
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

  const requestVideoCall = async () => {
    if (isSending.current) return;
    updateTypingState("");
    isSending.current = true;
    setSending(true);

    const messageContent = buildCallRequestMessage();
    const tempId = `temp-call-request-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        content: messageContent,
        message_type: "text",
        sender_type: "patient",
        sender_name: patientName,
        created_at: new Date().toISOString(),
      },
    ]);

    let insert = await supabase.from("messages").insert({
      room_id: roomId,
      content: messageContent,
      message_type: "text",
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false,
    }).select().single();

    if (insert.error && isSchemaColumnError(insert.error)) {
      insert = await supabase.from("messages").insert({
        room_id: roomId,
        content: messageContent,
        message_type: "text",
        sender_type: "patient",
        sender_name: patientName,
      }).select().single();
    }

    if (insert.error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      isSending.current = false;
      setSending(false);
      alert(insert.error.message || t.videoCallOpenError);
      return;
    } else if (insert.data) {
      setMessages((prev) => prev.map((entry) => (entry.id === tempId ? insert.data : entry)));
    }

    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        userType: "staff",
        title: patientName || (settings.lang === "es" ? "Paciente" : "Patient"),
        body: t.incomingCallRequest,
        url: "/inbox",
      }),
    }).catch(() => {});

    setSending(false);
    isSending.current = false;
  };

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (isAppleMobile && !isStandalone) {
      setShowInstallHelp(true);
      setSetupFeedback({
        tone: "info",
        text: settings.lang === "es"
          ? "En iPhone y iPad primero abre este chat desde la pantalla de inicio. Después podrás activar notificaciones."
          : "On iPhone and iPad, first open this chat from the Home Screen. After that you can enable notifications.",
      });
      return;
    }

    setNotificationBusy(true);
    setSetupFeedback(null);
    const permission = await Notification.requestPermission();
    setNotificationsPermission(permission);
    notificationsPermissionRef.current = permission;
    if (permission === "granted") {
      try {
        await subscribeToPushNotifications();
        setShowInstallHelp(false);
        setSetupFeedback({
          tone: "success",
          text: settings.lang === "es" ? "Notificaciones activadas en este dispositivo." : "Notifications are enabled on this device.",
        });
      } catch (error) {
        setSetupFeedback({
          tone: "error",
          text: error instanceof Error ? error.message : settings.lang === "es" ? "No pude activar las notificaciones todavía." : "I could not enable notifications yet.",
        });
      }
    } else if (permission === "denied") {
      setSetupFeedback({
        tone: "error",
        text: settings.lang === "es" ? "Las notificaciones están bloqueadas. Revísalas en la configuración del navegador." : "Notifications are blocked. Please check your browser settings.",
      });
    } else {
      setSetupFeedback({
        tone: "info",
        text: settings.lang === "es" ? "Cuando quieras, vuelve a tocar el botón para activar alertas." : "Whenever you are ready, tap the button again to enable alerts.",
      });
    }
    setNotificationBusy(false);
  };

  const promptInstall = async () => {
    setSetupFeedback(null);
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = deferredInstallPrompt.userChoice ? await deferredInstallPrompt.userChoice : null;
      setDeferredInstallPrompt(null);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(standalone));
      setShowInstallHelp(!standalone);
      setSetupFeedback({
        tone: choice?.outcome === "accepted" ? "success" : "info",
        text:
          choice?.outcome === "accepted"
            ? (settings.lang === "es" ? "Instalación iniciada. Abre el chat desde tu pantalla de inicio y luego activa notificaciones." : "Install started. Open the chat from your Home Screen and then enable notifications.")
            : (settings.lang === "es" ? "Puedes instalar este chat después cuando quieras." : "You can install this chat later whenever you want."),
      });
      return;
    }
    setShowInstallHelp(true);
    setSetupFeedback({
      tone: "info",
      text: isAppleMobile
        ? t.installHelpIOS
        : t.installHelpOther,
    });
  };

  const hideSetupPanel = () => {
    setSetupDismissed(true);
    setShowInstallHelp(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(setupDismissedKeyForRoom(roomId), "1");
      window.localStorage.setItem(setupDismissedGlobalKey, "1");
    }
  };

  const uploadPatientFile = async (file: File) => {
    setUploadingMedia(true);
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${roomId}/patient-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-files").upload(storagePath, file, { upsert: true });
    if (error) {
      setUploadingMedia(false);
      alert(settings.lang === "es" ? "No pude subir el archivo." : "I could not upload the file.");
      return;
    }

    const { data: publicUrl } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
    let messageType = "file";
    if (file.type.startsWith("image/")) messageType = "image";
    else if (file.type.startsWith("video/")) messageType = "video";
    else if (file.type.startsWith("audio/")) messageType = "audio";

    const tempId = `temp-file-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        content: publicUrl.publicUrl,
        file_name: file.name,
        file_size: file.size,
        message_type: messageType,
        sender_type: "patient",
        sender_name: patientName,
        created_at: new Date().toISOString(),
      },
    ]);

    let insertResult = await supabase.from("messages").insert({
      room_id: roomId,
      content: publicUrl.publicUrl,
      file_name: file.name,
      file_size: file.size,
      message_type: messageType,
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false,
    }).select().single();

    if (insertResult.error && isSchemaColumnError(insertResult.error)) {
      insertResult = await supabase.from("messages").insert({
        room_id: roomId,
        content: publicUrl.publicUrl,
        file_name: file.name,
        file_size: file.size,
        message_type: messageType,
        sender_type: "patient",
        sender_name: patientName,
      }).select().single();
    }

    if (insertResult.error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      setUploadingMedia(false);
      alert(settings.lang === "es" ? "El archivo se subió, pero no pude enviarlo al chat." : "The file uploaded, but I could not send it to the chat.");
      return;
    }

    if (insertResult.data) {
      setMessages((prev) => prev.map((entry) => (entry.id === tempId ? insertResult.data : entry)));
    } else {
      await refreshMessages();
    }
    setUploadingMedia(false);
  };

  const stopCaptureStream = () => {
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;
  };

  const stopAudioRecording = (discard = false) => {
    if (!recordingAudio || !mediaRecorderRef.current) return;
    discardAudioRef.current = discard;
    setRecordingAudio(false);
    mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingSeconds(0);
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = pickRecorderMimeType("audio");
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      discardAudioRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        const shouldDiscard = discardAudioRef.current;
        stream.getTracks().forEach((track) => track.stop());
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        discardAudioRef.current = false;
        if (blob.size === 0 || shouldDiscard) {
          return;
        }
        const ext = extensionForMimeType(finalMimeType, "webm");
        await uploadPatientFile(new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type || finalMimeType }));
      };
      recorder.start();
      setRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch {
      alert(settings.lang === "es" ? "No pude acceder al micrófono." : "I could not access the microphone.");
    }
  };

  const openCapture = async (mode: "photo" | "video") => {
    try {
      setPreparingCapture(true);
      setShowAttachMenu(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: mode === "video",
      });
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
            await uploadPatientFile(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type || finalMimeType }));
          }
        };
        recorder.start();
        setRecordingVideo(true);
      }
    } catch {
      stopCaptureStream();
      alert(settings.lang === "es" ? "No pude abrir la cámara." : "I could not open the camera.");
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

  const sendCapturedVideo = () => {
    if (captureMode === "video" && captureRecorderRef.current) {
      discardCaptureRef.current = false;
      captureRecorderRef.current.stop();
    }
  };

  const takePhotoNow = async () => {
    if (!captureVideoRef.current || !captureStreamRef.current) return;
    const video = captureVideoRef.current;
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
      await uploadPatientFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }
  };

  const onSelectProfilePhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, avatarDataUrl: typeof reader.result === "string" ? reader.result : "" }));
    };
    reader.readAsDataURL(file);
  };

  const addQuickReply = () => {
    const value = newQuickReply.trim();
    if (!value) return;
    setSettings((prev) => ({ ...prev, quickReplies: [...prev.quickReplies, value] }));
    setNewQuickReply("");
  };

  const updateDraft = (value: string, target?: HTMLTextAreaElement) => {
    setNewMessage(value);
    updateTypingState(value);
    setShowAttachMenu(false);
    setShowEmojiMenu(false);
    if (value.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(value.slice(1));
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
    if (target) {
      target.style.height = "46px";
      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
    }
  };

  const formatDateLabel = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(settings.lang === "es" ? "es-MX" : "en-US", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })
      : "";

  const formatTime = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString(settings.lang === "es" ? "es-MX" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const setupComplete = notificationsPermission === "granted" && (isStandalone || !isAppleMobile);
  const showSetupPanel = !setupDismissed && !isStandalone && (!setupComplete || showInstallHelp);

  useEffect(() => {
    let cancelled = false;

    const refreshMessagesWithFallback = async () => {
      if (loading || notFound) return;
      const { data: msgs } = await loadMessages();
      if (cancelled || !msgs) return;
      const nextMessages = msgs.filter((message: any) => !message?.is_internal);
      setMessages(nextMessages);
      const latestStaffMessage = [...nextMessages].reverse().find((message: any) => message.sender_type === "staff");
      const latestKey = latestStaffMessage ? messageIdentity(latestStaffMessage) : "";

      if (!lastKnownStaffMessageKeyRef.current) {
        lastKnownStaffMessageKeyRef.current = latestKey;
        return;
      }

      if (latestStaffMessage && latestKey && latestKey !== lastKnownStaffMessageKeyRef.current) {
        lastKnownStaffMessageKeyRef.current = latestKey;
        notifyIncomingMessage(latestStaffMessage).catch(() => {});
      }
    };

    const interval = setInterval(refreshMessagesWithFallback, 2000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshMessagesWithFallback();
    };
    const onFocus = () => refreshMessagesWithFallback();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadMessages, loading, messageIdentity, notFound, notifyIncomingMessage]);

  useEffect(() => {
    if (captureMode && captureVideoRef.current && captureStreamRef.current) {
      captureVideoRef.current.srcObject = captureStreamRef.current;
      captureVideoRef.current.play().catch(() => {});
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

  const renderMessage = (message: any) => {
    const isPatient = message.sender_type === "patient";
    const videoCallRoomName = parseVideoCallMessage(message.content);
    const callRequestToken = parseCallRequestMessage(message.content);
    const senderDisplayName = isPatient
      ? (settings.lang === "es" ? "Tú" : "You")
      : (message.sender_name || t.careTeamLabel);
    const bubbleStyle: React.CSSProperties = {
      background: isPatient ? bubbleOut : bubbleIn,
      color: isPatient ? "#111827" : textColor,
      borderRadius: isPatient ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
      padding: message.message_type === "text" ? "9px 12px" : "8px",
      maxWidth: "78%",
      boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
      border: isPatient ? "none" : `1px solid ${border}`,
    };
    const translated = !isPatient && autoTranslateIncoming && message.message_type === "text" && message.id && !videoCallRoomName && !callRequestToken
      ? translatedIncoming[translationKey(message.id, settings.lang)] || ""
      : "";
    const contentToRender = translated || message.content;

    if (message.deleted_by_patient) {
      return (
        <div key={message.id} style={{ display: "flex", flexDirection: "column", alignItems: isPatient ? "flex-end" : "flex-start", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isPatient ? "#166534" : subText }}>
            {senderDisplayName}
          </div>
          <div style={{ ...bubbleStyle, fontStyle: "italic", opacity: 0.68, padding: "11px 14px" }}>
            {t.msgDeleted}
            <div style={{ fontSize: 12, color: "rgba(17,24,39,0.75)", marginTop: 6, textAlign: "right" }}>{formatTime(message.created_at)}</div>
          </div>
        </div>
      );
    }

    let body: React.ReactNode;
    if (message.message_type === "image") {
      body = <img src={message.content} alt="" style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} />;
    } else if (message.message_type === "video") {
      body = <video src={message.content} controls style={{ width: "100%", maxWidth: 280, borderRadius: 14 }} />;
    } else if (message.message_type === "audio") {
      body = <audio src={message.content} controls style={{ width: "100%", minWidth: 220 }} />;
    } else if (message.message_type === "file") {
      body = (
        <a href={message.content} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{message.file_name || (settings.lang === "es" ? "Archivo" : "File")}</span>
        </a>
      );
    } else if (callRequestToken) {
      body = (
        <div style={{ minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{t.incomingCallRequest}</span>
          </div>
          <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 10 }}>
            {isPatient ? t.callRequestSent : t.callRequestBody}
          </div>
        </div>
      );
    } else if (videoCallRoomName) {
      body = (
        <div style={{ minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🎥</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{t.videoCallInvite}</span>
          </div>
          <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 10 }}>{t.videoCallInviteBody}</div>
          <button
            onClick={() => joinVideoCall(videoCallRoomName)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 10,
              background: "#2563EB",
              border: "none",
              color: "white",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🎬 {t.openInChat}
          </button>
          <button
            onClick={() => shareCallInvite(videoCallRoomName)}
            style={{
              marginLeft: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 10,
              background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(37,99,235,0.35)",
              color: "#1D4ED8",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🔗 {t.shareInvite}
          </button>
        </div>
      );
    } else {
      body = <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize, lineHeight: 1.58, letterSpacing: "0.01em", fontWeight: 500 }}>{contentToRender}</div>;
    }

    return (
      <div key={message.id} style={{ display: "flex", flexDirection: "column", alignItems: isPatient ? "flex-end" : "flex-start", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isPatient ? "#166534" : subText }}>
          {senderDisplayName}
        </div>
        <div style={bubbleStyle}>
          {body}
          <div style={{ fontSize: 12, color: "rgba(17,24,39,0.75)", marginTop: 6, textAlign: "right" }}>{formatTime(message.created_at)}</div>
        </div>
        {isPatient && (
          <button
            onClick={() => deletePatientMessage(message.id)}
            style={{
              border: "none",
              background: "transparent",
              color: "#DC2626",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            🗑 {t.deleteAction}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: bg, color: textColor, fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(37,99,235,0.15)", borderTopColor: "#2563EB", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 18, fontWeight: 700 }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: bg, padding: 24, fontFamily: "Arial, sans-serif" }}>
        <div style={{ maxWidth: 420, width: "100%", background: surface, borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 10px 40px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 28, color: textColor, marginBottom: 8 }}>{t.invalidLink}</h1>
          <p style={{ color: subText, lineHeight: 1.6 }}>{t.invalidLinkHint}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={mediaLibraryInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        capture
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientFile(file);
          event.target.value = "";
        }}
      />

      {(captureMode || preparingCapture) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,23,42,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#111827", borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "14px 16px", color: "white", fontWeight: 800 }}>
              {preparingCapture ? t.preparingCamera : captureMode === "photo" ? t.takePhoto : t.recordVideoOption}
            </div>
            <div style={{ background: "#000", aspectRatio: "3 / 4", display: "grid", placeItems: "center" }}>
              {preparingCapture ? (
                <div style={{ color: "white", fontWeight: 700 }}>{t.preparingCamera}</div>
              ) : (
                <video ref={captureVideoRef} muted playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 10, padding: 16 }}>
              <button onClick={cancelCapture} style={{ flex: 1, border: "none", borderRadius: 14, padding: "12px 14px", background: "#374151", color: "white", fontWeight: 700, cursor: "pointer" }}>{t.cancelCapture}</button>
              {captureMode === "photo" ? (
                <button onClick={takePhotoNow} style={{ flex: 1, border: "none", borderRadius: 14, padding: "12px 14px", background: "#2563EB", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.takePhotoNow}</button>
              ) : (
                <button onClick={sendCapturedVideo} style={{ flex: 1, border: "none", borderRadius: 14, padding: "12px 14px", background: "#DC2626", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.stopAndSendVideo}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "center", alignItems: "flex-end" }} onClick={() => setSettingsOpen(false)}>
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "92dvh", overflowY: "auto", background: surface, borderRadius: "24px 24px 0 0", padding: "22px 20px 38px" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, color: textColor, fontSize: 24 }}>{t.settings}</h2>
                <p style={{ margin: "4px 0 0", color: subText, fontSize: 14 }}>{t.installedHint}</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} style={{ border: "none", background: settings.darkMode ? "#1F2937" : "#F3F4F6", color: textColor, borderRadius: 999, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{t.close}</button>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.displayName}</label>
                <input value={settings.displayName} onChange={(event) => setSettings((prev) => ({ ...prev, displayName: event.target.value }))} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, background: settings.darkMode ? "#0F172A" : "white", color: textColor, fontSize: 15 }} />
              </section>

              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: textColor, fontWeight: 700 }}>{t.darkMode}</span>
                  <button onClick={() => setSettings((prev) => ({ ...prev, darkMode: !prev.darkMode }))} style={{ width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: settings.darkMode ? "#2563EB" : "#D1D5DB" }}>
                    <div style={{ position: "absolute", top: 2, left: settings.darkMode ? 24 : 2, width: 26, height: 26, borderRadius: "50%", background: "white", transition: "left .2s" }} />
                  </button>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.fontSize}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["small", "medium", "large"] as const).map((level) => (
                      <button key={level} onClick={() => setSettings((prev) => ({ ...prev, fontSizeLevel: level }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.fontSizeLevel === level ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.fontSizeLevel === level ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.fontSizeLevel === level ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>
                        {level === "small" ? (settings.lang === "es" ? "Pequeño" : "Small") : level === "medium" ? (settings.lang === "es" ? "Normal" : "Medium") : (settings.lang === "es" ? "Grande" : "Large")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.language}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSettings((prev) => ({ ...prev, lang: "es", quickReplies: prev.quickReplies.length ? prev.quickReplies : DEFAULT_QUICK_REPLIES.es }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.lang === "es" ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.lang === "es" ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.lang === "es" ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>🇲🇽 Español</button>
                    <button onClick={() => setSettings((prev) => ({ ...prev, lang: "en", quickReplies: prev.quickReplies.length ? prev.quickReplies : DEFAULT_QUICK_REPLIES.en }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.lang === "en" ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.lang === "en" ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.lang === "en" ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>🇺🇸 English</button>
                  </div>
                  <p style={{ margin: "8px 0 0", color: subText, fontSize: 13 }}>{labelPatientLanguage(room?.procedures?.patients?.preferred_language, settings.lang)}</p>
                </div>
              </section>

              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ color: textColor, fontWeight: 700, fontSize: 15 }}>
                      {settings.lang === "es" ? "Traducir mensajes del equipo automáticamente" : "Auto-translate care-team messages"}
                    </div>
                    <div style={{ color: subText, fontSize: 13, marginTop: 6 }}>
                      {settings.lang === "es" ? "Solo cambia cómo se muestran tus mensajes recibidos." : "Only changes how incoming messages are displayed."}
                    </div>
                  </div>
                  <button onClick={() => setAutoTranslateIncoming((prev) => !prev)} style={{ width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: autoTranslateIncoming ? "#2563EB" : "#D1D5DB" }}>
                    <div style={{ position: "absolute", top: 2, left: autoTranslateIncoming ? 24 : 2, width: 26, height: 26, borderRadius: "50%", background: "white", transition: "left .2s" }} />
                  </button>
                </div>
              </section>

              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#111827,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800 }}>
                    {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : patientName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: textColor, fontWeight: 700 }}>{t.profilePhoto}</div>
                    <div style={{ color: subText, fontSize: 13 }}>{t.photoHelp}</div>
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelectProfilePhoto(file); }} />
              </section>

              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ color: textColor, fontWeight: 700, marginBottom: 8 }}>{t.quickReplies}</div>
                <p style={{ color: subText, fontSize: 13, marginTop: 0 }}>{t.quickReplyHint}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {settings.quickReplies.map((reply, index) => (
                    <div key={`${reply}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6, background: settings.darkMode ? "#0F172A" : "white", border: `1px solid ${border}`, padding: "8px 10px", borderRadius: 999 }}>
                      <span style={{ color: textColor, fontSize: 13 }}>{reply}</span>
                      <button onClick={() => setSettings((prev) => ({ ...prev, quickReplies: prev.quickReplies.filter((_, itemIndex) => itemIndex !== index) }))} style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", fontWeight: 700 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newQuickReply} onChange={(event) => setNewQuickReply(event.target.value)} placeholder={t.replyPlaceholder} style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, background: settings.darkMode ? "#0F172A" : "white", color: textColor }} />
                  <button onClick={addQuickReply} style={{ border: "none", borderRadius: 12, background: "#2563EB", color: "white", fontWeight: 700, padding: "0 14px", cursor: "pointer" }}>{t.addReply}</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: "100dvh", minHeight: "100dvh", background: bg, color: textColor, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#0F172A", color: "white", padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#111827,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, flexShrink: 0 }}>
              {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : patientName.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patientName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.secureChat}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setSettings((prev) => ({ ...prev, lang: prev.lang === "es" ? "en" : "es" }))} style={{ border: "none", background: "rgba(255,255,255,0.14)", color: "white", borderRadius: 999, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                {settings.lang === "es" ? "🇲🇽 ES" : "🇺🇸 EN"}
              </button>
              <button onClick={requestVideoCall} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "white", cursor: "pointer", fontSize: 18, flexShrink: 0 }} title={t.requestVideoCall}>🎥</button>
              <button onClick={() => { setShowMediaLibrary(true); setMediaLibraryTab("media"); }} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "white", cursor: "pointer", fontSize: 18, flexShrink: 0 }} title={settings.lang === "es" ? "Media" : "Media"}>🖼️</button>
              <button onClick={() => setSettingsOpen(true)} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "white", cursor: "pointer", fontSize: 20, flexShrink: 0 }}>⚙️</button>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              {t.online}
            </div>
            {staffTyping && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, background: "rgba(37,99,235,0.18)", color: "white", fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#93C5FD", display: "inline-block" }} />
                {(staffTypingName || t.careTeamLabel)} {t.typingSuffix}
              </div>
            )}
            {officePhone && (
              <a href={`tel:${officePhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                📞 {t.callOffice}
              </a>
            )}
          </div>
        </header>

        {toastAlert && (
          <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 122px)", left: 12, right: 12, zIndex: 120, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 420px)", background: settings.darkMode ? "rgba(17,24,39,0.96)" : "rgba(255,255,255,0.98)", color: textColor, border: `1px solid ${border}`, borderRadius: 18, boxShadow: "0 18px 46px rgba(15,23,42,0.16)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: settings.darkMode ? "#93C5FD" : "#1D4ED8" }}>
                    {settings.lang === "es" ? "Nuevo mensaje del equipo" : "New message from the care team"}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toastAlert.title}</div>
                  <div style={{ fontSize: 13, color: subText, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toastAlert.body}</div>
                </div>
                <button onClick={() => setToastAlert(null)} style={{ border: "none", background: "transparent", color: subText, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            </div>
          </div>
        )}

        {!callOverlayOpen && callInviteFeedback && (
          <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 122px)", left: 12, right: 12, zIndex: 121, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 420px)", background: settings.darkMode ? "rgba(17,24,39,0.96)" : "rgba(255,255,255,0.98)", color: textColor, border: `1px solid ${border}`, borderRadius: 14, boxShadow: "0 18px 46px rgba(15,23,42,0.16)", padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
              {callInviteFeedback}
            </div>
          </div>
        )}

        {callOverlayOpen && activeCallUrl && (
          <div style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(2,6,23,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            <div style={{ width: "min(1180px,100%)", height: "min(92dvh,900px)", background: "#020617", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(148,163,184,0.35)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: "rgba(15,23,42,0.95)", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <div style={{ color: "white", fontSize: 14, fontWeight: 800 }}>🎥 {t.startVideoCall}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => { if (activeCallRoomName) shareCallInvite(activeCallRoomName); }} style={{ border: "none", borderRadius: 10, padding: "8px 10px", background: "rgba(37,99,235,0.2)", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>🔗 {t.shareInvite}</button>
                  <button onClick={() => closeCallOverlay()} style={{ border: "none", borderRadius: 10, padding: "8px 10px", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>📴 {t.endAndReturn}</button>
                </div>
              </div>
              {callInviteFeedback && (
                <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#BFDBFE", background: "rgba(30,58,138,0.45)" }}>
                  {callInviteFeedback}
                </div>
              )}
              <iframe
                src={activeCallUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                style={{ border: "none", width: "100%", height: "100%", background: "#000" }}
                title="Video Call"
              />
            </div>
          </div>
        )}

        {showMediaLibrary && (
          <div style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingTop: "max(14px, env(safe-area-inset-top))" }} onClick={() => setShowMediaLibrary(false)}>
            <div style={{ width: "100%", maxWidth: 760, maxHeight: "92dvh", overflowY: "auto", background: surface, borderRadius: "24px 24px 0 0", padding: "18px 16px calc(30px + env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ color: textColor, fontSize: 20, fontWeight: 900 }}>🖼️ {settings.lang === "es" ? "Media del chat" : "Chat media"}</div>
                <button onClick={() => setShowMediaLibrary(false)} style={{ border: "none", borderRadius: 999, padding: "8px 14px", background: settings.darkMode ? "#1F2937" : "#EEF2F7", color: textColor, fontWeight: 700, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {([
                  { key: "media", label: settings.lang === "es" ? "Media" : "Media" },
                  { key: "audio", label: settings.lang === "es" ? "Audios" : "Audio" },
                  { key: "docs", label: settings.lang === "es" ? "Archivos" : "Files" },
                ] as { key: MediaTab; label: string }[]).map((tab) => (
                  <button key={tab.key} onClick={() => setMediaLibraryTab(tab.key)} style={{ border: "none", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 800, background: mediaLibraryTab === tab.key ? "#DBEAFE" : settings.darkMode ? "#1F2937" : "#EEF2F7", color: mediaLibraryTab === tab.key ? "#1D4ED8" : textColor }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              {mediaLibraryTab === "media" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
                  {roomImageVideoEntries.length === 0 && <div style={{ color: subText, fontSize: 14 }}>{settings.lang === "es" ? "Sin imágenes o videos todavía." : "No images or videos yet."}</div>}
                  {roomImageVideoEntries.map((entry: any) => (
                    <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: 14, overflow: "hidden", textDecoration: "none", background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}` }}>
                      {entry.message_type === "image" ? (
                        <img src={entry.content} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                      ) : (
                        <video src={entry.content} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                      )}
                      <div style={{ padding: "8px 10px", fontSize: 12, color: subText }}>{formatDateLabel(entry.created_at)}</div>
                    </a>
                  ))}
                </div>
              )}
              {mediaLibraryTab === "audio" && (
                <div style={{ display: "grid", gap: 10 }}>
                  {roomAudioEntries.length === 0 && <div style={{ color: subText, fontSize: 14 }}>{settings.lang === "es" ? "Sin audios todavía." : "No audio files yet."}</div>}
                  {roomAudioEntries.map((entry: any) => (
                    <div key={entry.id} style={{ padding: 12, borderRadius: 14, border: `1px solid ${border}`, background: settings.darkMode ? "#111827" : "#F8FAFC" }}>
                      <audio src={entry.content} controls style={{ width: "100%" }} />
                    </div>
                  ))}
                </div>
              )}
              {mediaLibraryTab === "docs" && (
                <div style={{ display: "grid", gap: 10 }}>
                  {roomFileEntries.length === 0 && <div style={{ color: subText, fontSize: 14 }}>{settings.lang === "es" ? "Sin archivos todavía." : "No files yet."}</div>}
                  {roomFileEntries.map((entry: any) => (
                    <a key={entry.id} href={entry.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${border}`, background: settings.darkMode ? "#111827" : "#F8FAFC", textDecoration: "none", color: textColor }}>
                      <span style={{ fontSize: 22 }}>📄</span>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{entry.file_name || (settings.lang === "es" ? "Archivo" : "File")}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <main
          ref={(node) => { chatScrollRef.current = node; }}
          onScroll={updateAutoScrollPreference}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 12, backgroundColor: bg, backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
          {groupedMessages.length === 0 ? (
            <div style={{ marginTop: 36, background: surface, borderRadius: 24, padding: 24, textAlign: "center", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: textColor }}>{t.noMessages}</div>
              <div style={{ marginTop: 8, color: subText, lineHeight: 1.6 }}>{t.noMessagesHint}</div>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.date}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ background: settings.darkMode ? "rgba(17,27,33,0.85)" : "rgba(255,255,255,0.92)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: settings.darkMode ? "#D1D5DB" : "#54656F" }}>
                    {formatDateLabel(group.date)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.msgs.map(renderMessage)}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </main>
        {showJumpToLatest && (
          <button
            onClick={jumpToLatest}
            style={{
              position: "fixed",
              right: 16,
              bottom: "calc(env(safe-area-inset-bottom) + 92px)",
              zIndex: 130,
              border: "none",
              borderRadius: 999,
              padding: "10px 14px",
              background: "#2563EB",
              color: "white",
              fontWeight: 800,
              boxShadow: "0 10px 24px rgba(37,99,235,0.35)",
              cursor: "pointer",
            }}
          >
            {settings.lang === "es" ? "Nuevos mensajes ↓" : "New messages ↓"}
          </button>
        )}

        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: inputBg, borderTop: `1px solid ${border}`, padding: "8px 12px calc(env(safe-area-inset-bottom) + 8px)", boxShadow: "0 -8px 22px rgba(15,23,42,0.08)" }}>
          {showSlashMenu && slashMatches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, background: settings.darkMode ? "#111827" : "#FFFFFF", border: `1px solid ${border}`, borderRadius: 18, padding: 10, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}>
              {slashMatches.map((reply, index) => (
                <button key={`${reply}-slash-${index}`} onClick={() => sendMessage(reply)} style={{ border: "none", background: settings.darkMode ? "#1F2937" : "#F8FAFC", color: textColor, borderRadius: 12, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontWeight: 700 }}>
                  / {reply}
                </button>
              ))}
            </div>
          )}
          {showAttachMenu && (
            <div style={{ marginBottom: 10, width: 220, background: settings.darkMode ? "#111827" : "#FFFFFF", border: `1px solid ${border}`, borderRadius: 20, padding: 8, boxShadow: "0 14px 34px rgba(15,23,42,0.16)" }}>
              <button onClick={() => {
                setShowAttachMenu(false);
                if (prefersNativeCapture) cameraInputRef.current?.click();
                else openCapture("photo");
              }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>📷</span>{t.takePhoto}
              </button>
              <button onClick={() => {
                setShowAttachMenu(false);
                if (prefersNativeCapture) audioInputRef.current?.click();
                else startAudioRecording();
              }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎤</span>{t.recordAudioOption}
              </button>
              <button onClick={() => {
                setShowAttachMenu(false);
                if (prefersNativeCapture) videoInputRef.current?.click();
                else openCapture("video");
              }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎥</span>{t.recordVideoOption}
              </button>
              <button onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>📁</span>{t.chooseFile}
              </button>
            </div>
          )}
          {showEmojiMenu && (
            <div style={{ marginBottom: 10, width: 250, marginLeft: 52, background: settings.darkMode ? "#111827" : "#FFFFFF", border: `1px solid ${border}`, borderRadius: 20, padding: 8, boxShadow: "0 14px 34px rgba(15,23,42,0.16)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => appendEmojiToDraft(emoji)} style={{ border: "none", background: settings.darkMode ? "#1F2937" : "#F3F4F6", borderRadius: 10, padding: "8px 0", fontSize: 20, cursor: "pointer" }}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, color: subText, margin: "0 0 8px 6px" }}>{t.quickRepliesSlashHint}</div>
          {recordingAudio && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "10px 12px", background: settings.darkMode ? "#111827" : "#FFF1F2", border: `1px solid ${border}`, borderRadius: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#DC2626", fontFamily: "monospace" }}>{`${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, "0")}`}</span>
              <span style={{ fontSize: 13, color: subText, flex: 1 }}>{settings.lang === "es" ? "Grabando audio..." : "Recording audio..."}</span>
              <button onClick={() => stopAudioRecording(true)} style={{ border: "none", borderRadius: 12, padding: "10px 12px", background: "#6B7280", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.cancelCapture}</button>
              <button onClick={() => stopAudioRecording(false)} style={{ border: "none", borderRadius: 12, padding: "10px 12px", background: "#DC2626", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.stopAndSendAudio}</button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => setShowAttachMenu((prev) => !prev)} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: showAttachMenu ? "#00A884" : settings.darkMode ? "#2A3942" : "#E9EDEF", color: settings.darkMode ? "white" : "#54656F", cursor: "pointer", fontSize: 20, flexShrink: 0 }} title={t.attachmentOptions}>📎</button>
            <button onClick={() => setShowEmojiMenu((prev) => !prev)} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: showEmojiMenu ? "#00A884" : settings.darkMode ? "#2A3942" : "#E9EDEF", color: settings.darkMode ? "white" : "#54656F", cursor: "pointer", fontSize: 20, flexShrink: 0 }} title="Emoji">😊</button>
            <textarea
              value={newMessage}
              onChange={(event) => updateDraft(event.target.value, event.currentTarget)}
              onBlur={() => updateTypingState("")}
              placeholder={t.typeMessage}
              rows={1}
              style={{ flex: 1, resize: "none", minHeight: 42, maxHeight: 120, borderRadius: 10, border: "none", background: settings.darkMode ? "#2A3942" : "white", color: textColor, padding: "10px 14px", fontSize, fontFamily: "inherit", lineHeight: 1.58, letterSpacing: "0.01em" }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  setShowAttachMenu(false);
                  setShowEmojiMenu(false);
                  if (showSlashMenu && slashMatches[0]) {
                    sendMessage(slashMatches[0]);
                    return;
                  }
                  sendMessage();
                }
              }}
            />
            <button onClick={() => {
              if (recordingAudio) {
                stopAudioRecording();
                return;
              }
              sendMessage();
            }} disabled={sending || (!newMessage.trim() && !recordingAudio)} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: recordingAudio ? "#DC2626" : "#00A884", color: "white", cursor: "pointer", fontWeight: 800, flexShrink: 0, opacity: sending || (!newMessage.trim() && !recordingAudio) ? 0.45 : 1 }}>
              {recordingAudio ? "⏹" : t.send}
            </button>
          </div>
          {uploadingMedia && <div style={{ fontSize: 13, color: subText, margin: "8px 0 0 6px" }}>{settings.lang === "es" ? "Subiendo archivo..." : "Uploading file..."}</div>}
        </div>
      </div>
    </>
  );
}
