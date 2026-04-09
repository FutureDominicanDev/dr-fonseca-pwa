"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { labelPatientLanguage } from "@/lib/patientMeta";

type Lang = "es" | "en";
type FontSizeLevel = "small" | "medium" | "large";

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
    online: "Equipo clínico en línea",
    addToHome: "Guarda este enlace para volver fácilmente a tu chat.",
    noMessages: "Todavía no hay mensajes.",
    noMessagesHint: "Cuando escribas, el equipo verá tu mensaje en su panel.",
    patient: "Paciente",
    clinic: "Clínica",
    quickReplyHint: "Toca una respuesta para enviarla rápido.",
    installedHint: "Puedes volver usando este mismo enlace cuando quieras.",
    installApp: "Agregar a pantalla inicial",
    installHelpTitle: "Guarda este chat en tu teléfono",
    installHelpIOS: "En iPhone o iPad: toca Compartir y luego Agregar a pantalla de inicio.",
    installHelpOther: "En tu navegador puedes instalar este chat para volver más rápido.",
    setupDone: "Tu acceso rápido ya quedó listo.",
    dismiss: "Ocultar",
    enableAlerts: "Activar notificaciones",
    alertsReady: "Notificaciones activadas",
    alertsBlocked: "Las notificaciones están bloqueadas en este navegador.",
    photoHelp: "Esta foto solo se guarda en este dispositivo.",
    callOffice: "Llamar a la oficina",
    callOfficeHint: "Si necesitas ayuda inmediata, llama a la sede asignada.",
    stopAndSendAudio: "Detener y enviar audio",
    stopAndSendVideo: "Detener y enviar video",
    preparingCamera: "Abriendo cámara...",
    takePhotoNow: "Tomar foto ahora",
    cancelCapture: "Cancelar",
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
    quickReplyHint: "Tap a quick reply to send it fast.",
    installedHint: "You can come back using this same link anytime.",
    installApp: "Add to home screen",
    installHelpTitle: "Save this chat on your device",
    installHelpIOS: "On iPhone or iPad: tap Share and then Add to Home Screen.",
    installHelpOther: "In your browser you can install this chat for faster return.",
    setupDone: "Your quick access is ready.",
    dismiss: "Hide",
    enableAlerts: "Enable notifications",
    alertsReady: "Notifications enabled",
    alertsBlocked: "Notifications are blocked in this browser.",
    photoHelp: "This photo only stays on this device.",
    callOffice: "Call office",
    callOfficeHint: "If you need immediate help, call the assigned office.",
    stopAndSendAudio: "Stop and send audio",
    stopAndSendVideo: "Stop and send video",
    preparingCamera: "Opening camera...",
    takePhotoNow: "Take photo now",
    cancelCapture: "Cancel",
  },
} as const;

const storageKeyForRoom = (roomId: string) => `patient-room-settings-${roomId}`;
const setupDismissedKeyForRoom = (roomId: string) => `patient-room-setup-dismissed-${roomId}`;

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
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | null>(null);
  const [preparingCapture, setPreparingCapture] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaLibraryInputRef = useRef<HTMLInputElement>(null);
  const isSending = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureRecorderRef = useRef<MediaRecorder | null>(null);
  const captureChunksRef = useRef<Blob[]>([]);
  const discardCaptureRef = useRef(false);

  const t = T[settings.lang];
  const fontSize = settings.fontSizeLevel === "small" ? 14 : settings.fontSizeLevel === "large" ? 19 : 16;
  const bg = settings.darkMode ? "#0F172A" : "#ECE5DD";
  const surface = settings.darkMode ? "#111827" : "#FFFFFF";
  const textColor = settings.darkMode ? "#F8FAFC" : "#111827";
  const subText = settings.darkMode ? "rgba(248,250,252,0.65)" : "#6B7280";
  const bubbleOut = "#DCF8C6";
  const bubbleIn = settings.darkMode ? "#1F2937" : "#FFFFFF";
  const border = settings.darkMode ? "rgba(255,255,255,0.08)" : "#E5E7EB";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKeyForRoom(roomId)) : null;
    const dismissed = typeof window !== "undefined" ? window.localStorage.getItem(setupDismissedKeyForRoom(roomId)) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PatientSettings;
        setSettings(parsed);
      } catch {}
    }
    if (dismissed === "1") setSetupDismissed(true);
  }, [roomId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKeyForRoom(roomId), JSON.stringify(settings));
    }
  }, [roomId, settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window) setNotificationsPermission(Notification.permission);
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
        setMessages((prev) => prev.some((entry) => entry.id === m.id) ? prev : [...prev, m]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

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

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });

    setMessages(msgs || []);
    setLoading(false);
  };

  const refreshMessages = async () => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    setMessages(msgs || []);
  };

  const sendMessage = async (override?: string) => {
    const content = (override || newMessage).trim();
    if (!content || isSending.current) return;

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

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      content,
      message_type: "text",
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false,
    });

    if (error) {
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId));
    }

    if (override || newMessage.startsWith("/")) {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
    if (!override) setNewMessage("");
    setSending(false);
    isSending.current = false;
  };

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsPermission(permission);
  };

  const promptInstall = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      if (deferredInstallPrompt.userChoice) await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(standalone));
      return;
    }
    setShowInstallHelp(true);
  };

  const hideSetupPanel = () => {
    setSetupDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem(setupDismissedKeyForRoom(roomId), "1");
  };

  const uploadPatientFile = async (file: File) => {
    setUploadingMedia(true);
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${roomId}/patient-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-files").upload(storagePath, file, { upsert: true });
    if (error) {
      setUploadingMedia(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
    let messageType = "file";
    if (file.type.startsWith("image/")) messageType = "image";
    else if (file.type.startsWith("video/")) messageType = "video";
    else if (file.type.startsWith("audio/")) messageType = "audio";

    await supabase.from("messages").insert({
      room_id: roomId,
      content: publicUrl.publicUrl,
      file_name: file.name,
      file_size: file.size,
      message_type: messageType,
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false,
    });
    await refreshMessages();
    setUploadingMedia(false);
  };

  const stopCaptureStream = () => {
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;
  };

  const stopAudioRecording = () => {
    if (!recordingAudio || !mediaRecorderRef.current) return;
    setRecordingAudio(false);
    mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingSeconds(0);
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        await uploadPatientFile(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type || "audio/webm" }));
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
        const recorder = new MediaRecorder(stream);
        captureRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) captureChunksRef.current.push(event.data);
        };
        recorder.onstop = async () => {
          const shouldDiscard = discardCaptureRef.current;
          const blob = new Blob(captureChunksRef.current, { type: recorder.mimeType || "video/webm" });
          captureChunksRef.current = [];
          captureRecorderRef.current = null;
          stopCaptureStream();
          setCaptureMode(null);
          setRecordingVideo(false);
          if (!shouldDiscard) {
            await uploadPatientFile(new File([blob], `video-${Date.now()}.webm`, { type: blob.type || "video/webm" }));
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
    setShowAttachMenu(false);
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

  const setupComplete = notificationsPermission === "granted" && (isStandalone || deferredInstallPrompt === null);
  const showSetupPanel = !setupDismissed && (!setupComplete || showInstallHelp);

  useEffect(() => {
    if (captureMode && captureVideoRef.current && captureStreamRef.current) {
      captureVideoRef.current.srcObject = captureStreamRef.current;
      captureVideoRef.current.play().catch(() => {});
    }
  }, [captureMode]);

  const renderMessage = (message: any) => {
    const isPatient = message.sender_type === "patient";
    const bubbleStyle: React.CSSProperties = {
      background: isPatient ? bubbleOut : bubbleIn,
      color: isPatient ? "#111827" : textColor,
      borderRadius: isPatient ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
      padding: message.message_type === "text" ? "11px 14px" : "8px",
      maxWidth: "82%",
      boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
      border: isPatient ? "none" : `1px solid ${border}`,
    };

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
    } else {
      body = <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize }}>{message.content}</div>;
    }

    return (
      <div key={message.id} style={{ display: "flex", flexDirection: "column", alignItems: isPatient ? "flex-end" : "flex-start", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isPatient ? "#166534" : subText }}>
          {isPatient ? patientName : t.clinic}
        </div>
        <div style={bubbleStyle}>
          {body}
          <div style={{ fontSize: 11, color: "rgba(17,24,39,0.55)", marginTop: 6, textAlign: "right" }}>{formatTime(message.created_at)}</div>
        </div>
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
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.displayName}</label>
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
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.fontSize}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["small", "medium", "large"] as const).map((level) => (
                      <button key={level} onClick={() => setSettings((prev) => ({ ...prev, fontSizeLevel: level }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.fontSizeLevel === level ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.fontSizeLevel === level ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.fontSizeLevel === level ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>
                        {level === "small" ? (settings.lang === "es" ? "Pequeño" : "Small") : level === "medium" ? (settings.lang === "es" ? "Normal" : "Medium") : (settings.lang === "es" ? "Grande" : "Large")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: subText, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>{t.language}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSettings((prev) => ({ ...prev, lang: "es", quickReplies: prev.quickReplies.length ? prev.quickReplies : DEFAULT_QUICK_REPLIES.es }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.lang === "es" ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.lang === "es" ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.lang === "es" ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>🇲🇽 Español</button>
                    <button onClick={() => setSettings((prev) => ({ ...prev, lang: "en", quickReplies: prev.quickReplies.length ? prev.quickReplies : DEFAULT_QUICK_REPLIES.en }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: settings.lang === "en" ? "2px solid #2563EB" : `1px solid ${border}`, background: settings.lang === "en" ? "#DBEAFE" : settings.darkMode ? "#0F172A" : "white", color: settings.lang === "en" ? "#2563EB" : textColor, fontWeight: 700, cursor: "pointer" }}>🇺🇸 English</button>
                  </div>
                  <p style={{ margin: "8px 0 0", color: subText, fontSize: 12 }}>{labelPatientLanguage(room?.procedures?.patients?.preferred_language, settings.lang)}</p>
                </div>
              </section>

              <section style={{ background: settings.darkMode ? "#111827" : "#F8FAFC", border: `1px solid ${border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#111827,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800 }}>
                    {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : patientName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: textColor, fontWeight: 700 }}>{t.profilePhoto}</div>
                    <div style={{ color: subText, fontSize: 12 }}>{t.photoHelp}</div>
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

      <div style={{ minHeight: "100dvh", background: bg, color: textColor, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#0F172A", color: "white", padding: "calc(env(safe-area-inset-top) + 16px) 18px 16px", boxShadow: "0 10px 30px rgba(15,23,42,0.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#111827,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, flexShrink: 0 }}>
              {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : patientName.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patientName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.secureChat}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setSettings((prev) => ({ ...prev, lang: prev.lang === "es" ? "en" : "es" }))} style={{ border: "none", background: "rgba(255,255,255,0.14)", color: "white", borderRadius: 999, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                {settings.lang === "es" ? "🇲🇽 ES" : "🇺🇸 EN"}
              </button>
              <button onClick={() => setSettingsOpen(true)} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "white", cursor: "pointer", fontSize: 20, flexShrink: 0 }}>⚙️</button>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              {t.online}
            </div>
            {officePhone && (
              <a href={`tel:${officePhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                📞 {t.callOffice}
              </a>
            )}
          </div>
          {showSetupPanel && (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.08)", fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "white" }}>{showInstallHelp ? t.installHelpTitle : t.addToHome}</div>
                <button onClick={hideSetupPanel} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t.dismiss}</button>
              </div>
              <div style={{ marginTop: 6 }}>{showInstallHelp ? (/iPad|iPhone|iPod/.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? t.installHelpIOS : t.installHelpOther) : t.installedHint}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {!isStandalone && (
                  <button onClick={promptInstall} style={{ border: "none", borderRadius: 999, padding: "10px 12px", background: "rgba(255,255,255,0.14)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    ⬇️ {t.installApp}
                  </button>
                )}
                {notificationsPermission !== "granted" ? (
                  <button onClick={requestNotifications} style={{ border: "none", borderRadius: 999, padding: "10px 12px", background: "rgba(255,255,255,0.14)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    🔔 {t.enableAlerts}
                  </button>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, background: "rgba(34,197,94,0.16)", color: "white", fontWeight: 700 }}>
                    🔔 {t.alertsReady}
                  </div>
                )}
              </div>
              {notificationsPermission === "denied" && <div style={{ marginTop: 6, fontSize: 12 }}>{t.alertsBlocked}</div>}
            </div>
          )}
          {!showSetupPanel && setupComplete && (
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>{t.setupDone}</div>
          )}
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: "16px 14px 120px", display: "flex", flexDirection: "column", gap: 14 }}>
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
                  <div style={{ background: settings.darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.82)", borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: subText }}>
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

        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: surface, borderTop: `1px solid ${border}`, padding: "10px 12px calc(env(safe-area-inset-bottom) + 10px)", boxShadow: "0 -10px 30px rgba(15,23,42,0.08)" }}>
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
              <button onClick={() => { setShowAttachMenu(false); mediaLibraryInputRef.current?.click(); }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🖼️</span>{t.photoLibrary}
              </button>
              <button onClick={() => openCapture("photo")} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>📷</span>{t.takePhoto}
              </button>
              <button onClick={() => startAudioRecording()} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎤</span>{t.recordAudioOption}
              </button>
              <button onClick={() => openCapture("video")} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎥</span>{t.recordVideoOption}
              </button>
              <button onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }} style={{ width: "100%", border: "none", background: "transparent", color: textColor, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>📁</span>{t.chooseFile}
              </button>
            </div>
          )}
          <div style={{ fontSize: 12, color: subText, margin: "0 0 8px 6px" }}>{t.quickRepliesSlashHint}</div>
          {recordingAudio && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "10px 12px", background: settings.darkMode ? "#111827" : "#FFF1F2", border: `1px solid ${border}`, borderRadius: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#DC2626", fontFamily: "monospace" }}>{`${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, "0")}`}</span>
              <span style={{ fontSize: 13, color: subText, flex: 1 }}>{settings.lang === "es" ? "Grabando audio..." : "Recording audio..."}</span>
              <button onClick={stopAudioRecording} style={{ border: "none", borderRadius: 12, padding: "10px 12px", background: "#DC2626", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.stopAndSendAudio}</button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => setShowAttachMenu((prev) => !prev)} style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: showAttachMenu ? "#2563EB" : "#0F172A", color: "white", cursor: "pointer", fontSize: 20, flexShrink: 0 }} title={t.attachmentOptions}>📎</button>
            <textarea
              value={newMessage}
              onChange={(event) => updateDraft(event.target.value, event.currentTarget)}
              placeholder={t.typeMessage}
              rows={1}
              style={{ flex: 1, resize: "none", minHeight: 46, maxHeight: 120, borderRadius: 20, border: `1px solid ${border}`, background: settings.darkMode ? "#111827" : "white", color: textColor, padding: "12px 14px", fontSize, fontFamily: "inherit", lineHeight: 1.5 }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  setShowAttachMenu(false);
                  if (showSlashMenu && slashMatches[0]) {
                    sendMessage(slashMatches[0]);
                    return;
                  }
                  sendMessage();
                }
              }}
            />
            <button onClick={() => {
              sendMessage();
            }} disabled={sending || !newMessage.trim() || recordingAudio} style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "#2563EB", color: "white", cursor: "pointer", fontWeight: 800, flexShrink: 0, opacity: sending || !newMessage.trim() || recordingAudio ? 0.45 : 1 }}>
              {t.send}
            </button>
          </div>
          {uploadingMedia && <div style={{ fontSize: 12, color: subText, margin: "8px 0 0 6px" }}>{settings.lang === "es" ? "Subiendo archivo..." : "Uploading file..."}</div>}
        </div>
      </div>
    </>
  );
}
