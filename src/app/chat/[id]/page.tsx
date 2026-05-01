"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Message = {
  id: string;
  content: string;
  sender_id?: string | null;
  sender_type?: string;
  sender_name?: string | null;
  sender_role?: string | null;
  type?: "text" | "image" | "video" | "audio" | "file";
  message_type: "text" | "image" | "video" | "audio" | "file";
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  message_hash?: string | null;
  deleted_by_patient?: boolean | null;
  deleted_by_staff?: boolean | null;
  deleted_at?: string | null;
  created_at?: string;
};

type RoomAccess = {
  id: string;
  patient_access_token?: string | null;
  procedures?: {
    office_location?: string | null;
    patients?: {
      full_name?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
};

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const viewerType = searchParams.get("view") === "staff" ? "staff" : "patient";
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickRepliesManageOpen, setQuickRepliesManageOpen] = useState(false);
  const [prescriptionsOpen, setPrescriptionsOpen] = useState(false);
  const [lastPrescriptionSeenAt, setLastPrescriptionSeenAt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(["Gracias", "Tengo una pregunta", "Voy en camino"]);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingReplyIndex, setEditingReplyIndex] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [recording, setRecording] = useState(false);
  const [uiLang, setUiLang] = useState<"es" | "en">("en");
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [fileAccept, setFileAccept] = useState("*");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior, block: "end" }));
  };
  const setComposerText = (value: string) => {
    setText(value);
    if (composerRef.current && composerRef.current.textContent !== value) {
      composerRef.current.textContent = value;
    }
    setQuickRepliesOpen(value.startsWith("/"));
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
  const prescriptionSeenKey = `patient_seen_recetas_${id}`;

  const normalizeLang = (value?: string | null): "es" | "en" | null => {
    const normalized = `${value || ""}`.toLowerCase();
    if (normalized.startsWith("es")) return "es";
    if (normalized.startsWith("en")) return "en";
    return null;
  };
  useEffect(() => {
    const browserLang = typeof navigator !== "undefined" ? normalizeLang(navigator.language) : null;
    setUiLang(browserLang || "es");
  }, []);

  useEffect(() => {
    const patient = room?.procedures?.patients;
    const patientLang = normalizeLang(Array.isArray(patient) ? patient[0]?.preferred_language : patient?.preferred_language);
    if (patientLang) setUiLang(patientLang);
  }, [room]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLastPrescriptionSeenAt(window.localStorage.getItem(prescriptionSeenKey) || "");
  }, [prescriptionSeenKey]);

  useEffect(() => {
    let mounted = true;

    const isSchemaColumnError = (error: unknown) => {
      const value = error as { message?: string; details?: string; hint?: string };
      const message = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
      return message.includes("column") || message.includes("schema cache") || message.includes("relation");
    };

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUserId(data.user?.id || null);
    });

    const validateRoom = async () => {
      setAccessReady(false);
      setAccessDenied(false);

      let roomQuery = await supabase
        .from("rooms")
        .select("id, patient_access_token, procedures(office_location, patients(full_name, preferred_language))")
        .eq("id", id)
        .single();

      if (roomQuery.error && isSchemaColumnError(roomQuery.error)) {
        roomQuery = await supabase
          .from("rooms")
          .select("id, procedures(office_location)")
          .eq("id", id)
          .single();
      }

      const roomData = roomQuery.data as RoomAccess | null;
      if (!mounted) return false;

      if (roomQuery.error || !roomData) {
        setAccessDenied(true);
        setAccessReady(true);
        return false;
      }

      if (roomData.patient_access_token && roomData.patient_access_token !== token) {
        setAccessDenied(true);
        setAccessReady(true);
        return false;
      }

      setRoom(roomData);
      setAccessReady(true);
      return true;
    };

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: true });

      if (mounted) setMessages((data || []) as Message[]);
    };

    validateRoom().then((allowed) => {
      if (allowed) loadMessages();
    });

    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${id}`,
        },
        ({ new: message }: { new: Message }) => {
          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) return current;
            return [...current, message];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${id}`,
        },
        ({ new: message }: { new: Message }) => {
          setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id, token]);

  useEffect(() => {
    scrollToLatest();
  }, [messages]);

  const isLegacyRoomCreatedMessage = (message: Message) => {
    const normalized = `${message.content || ""}`.toLowerCase();
    return (
      normalized.includes("sala creada y equipo asignado") ||
      normalized.includes("room created and care team assigned")
    );
  };

  const translationKey = (messageId: string, targetLang: "es" | "en") => `${messageId}:${targetLang}`;

  useEffect(() => {
    if (!accessReady || viewerType !== "patient") return;
    const candidates = messages.filter((message) => (
      message.id &&
      message.message_type === "text" &&
      message.sender_type === "staff" &&
      !message.deleted_by_patient &&
      !message.deleted_by_staff &&
      !isLegacyRoomCreatedMessage(message) &&
      `${message.content || ""}`.trim()
    ));
    const missing = candidates.filter((message) => !translatedMessages[translationKey(message.id, uiLang)]).slice(-30);
    if (!missing.length) return;

    const controller = new AbortController();
    let cancelled = false;
    missing.forEach((message) => {
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content, targetLang: uiLang, sourceLang: "auto" }),
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (cancelled) return;
          const translatedText = `${data?.translatedText || message.content || ""}`.trim();
          setTranslatedMessages((current) => {
            const key = translationKey(message.id, uiLang);
            if (current[key]) return current;
            return { ...current, [key]: translatedText || message.content };
          });
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accessReady, messages, translatedMessages, uiLang, viewerType]);

  const generateMessageHash = async (content: string, createdAt: string, senderId: string | null) => {
    const input = `${content}${createdAt}${senderId || ""}`;
    const bytes = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const logMessageAudit = async (timestamp: string) => {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: currentUserId,
      action: "message_sent",
      timestamp,
      room_id: id,
    });
    if (error) console.warn("audit log failed", error.message);
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content || accessDenied || !accessReady) return;

    setComposerText("");
    const createdAt = new Date().toISOString();
    const messageHash = await generateMessageHash(content, createdAt, currentUserId);
    const payload = {
      room_id: id,
      content,
      sender_id: currentUserId,
      sender_type: "patient",
      message_type: "text",
      created_at: createdAt,
      message_hash: messageHash,
    };
    let insert = await supabase
      .from("messages")
      .insert(payload)
      .select("*")
      .single();
    if (insert.error && `${insert.error.message || ""} ${insert.error.details || ""}`.toLowerCase().includes("column")) {
      const { message_hash: _messageHash, ...compatiblePayload } = payload;
      insert = await supabase.from("messages").insert(compatiblePayload).select("*").single();
    }

    const data = insert.data;
    if (data) {
      await logMessageAudit(createdAt);
      setMessages((current) => {
        if (current.some((item) => item.id === data.id)) return current;
        return [...current, data as Message];
      });
    }
  };

  const deletePatientMessage = async (messageId: string) => {
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("messages")
      .update({ deleted_by_patient: true, deleted_at: deletedAt })
      .eq("id", messageId)
      .eq("room_id", id)
      .eq("sender_type", "patient");

    if (error) return;
    setDeleteMenuMessageId(null);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, deleted_by_patient: true, deleted_at: deletedAt } : message)));
  };

  const updatePatientMessage = async () => {
    const next = editingMessageText.trim();
    if (!editingMessage || !next) return;
    const messageId = editingMessage.id;
    setEditingMessage(null);
    setEditingMessageText("");
    setDeleteMenuMessageId(null);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, content: next } : message)));
    const { error } = await supabase
      .from("messages")
      .update({ content: next })
      .eq("id", messageId)
      .eq("room_id", id)
      .eq("sender_type", "patient");
    if (error) {
      setMessages((current) => current.map((message) => (message.id === messageId ? editingMessage : message)));
    }
  };

  const startMessageLongPress = (messageId: string, enabled: boolean) => {
    if (!enabled) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => setDeleteMenuMessageId(messageId), 550);
  };

  const cancelMessageLongPress = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const saveQuickReply = () => {
    const next = replyDraft.trim();
    if (!next) return;
    setQuickReplies((current) => {
      if (editingReplyIndex === null) return [...current, next];
      return current.map((reply, index) => index === editingReplyIndex ? next : reply);
    });
    setReplyDraft("");
    setEditingReplyIndex(null);
  };

  const openPicker = (accept: string) => {
    setFileAccept(accept);
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.click();
    setMenuOpen(false);
  };

  const uploadFile = async (file: File, overrideType?: Message["message_type"]) => {
    if (accessDenied || !accessReady) return null;

    const timestamp = new Date().toISOString();
    const storageTimestamp = Date.now();
    const safeFileName = file.name || `${overrideType || "upload"}-${storageTimestamp}.${overrideType === "video" ? "mp4" : "bin"}`;
    const path = `patients/${id}/${storageTimestamp}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file, {
      contentType: overrideType === "video" && !file.type ? "video/mp4" : file.type || "application/octet-stream",
    });
    if (error) {
      console.error("chat file upload failed", error);
      window.alert(`No pude guardar el archivo: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from("chat-files").getPublicUrl(path);
    const url = data.publicUrl;
    const messageType =
      overrideType ||
      (file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "file");
    const messageHash = await generateMessageHash(url, timestamp, currentUserId);
    const payload = {
      room_id: id,
      sender_id: currentUserId,
      sender_type: "patient",
      type: messageType,
      message_type: messageType,
      content: url,
      file_url: url,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      created_at: timestamp,
      message_hash: messageHash,
    };

    let insert = await supabase
      .from("messages")
      .insert(payload)
      .select("*")
      .single();
    if (insert.error && `${insert.error.message || ""} ${insert.error.details || ""}`.toLowerCase().includes("column")) {
      const { type: _type, file_type: _fileType, file_url: _fileUrl, message_hash: _messageHash, ...compatiblePayload } = payload;
      insert = await supabase.from("messages").insert(compatiblePayload).select("*").single();
    }
    if (insert.error) {
      console.error("chat message insert failed", insert.error);
      window.alert(`El archivo se subió, pero no pude guardar el mensaje: ${insert.error.message}`);
      return null;
    }

    const message = insert.data;
    if (message) {
      await logMessageAudit(timestamp);
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message as Message];
      });
    }

    return url;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  };

  const handleVideoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    setMenuOpen(false);
    await uploadFile(file, "video");
    event.target.value = "";
  };

  const startRecording = async () => {
    if (recording) return;

    try {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl("");
      setAudioPreviewFile(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = ["audio/mp4", "audio/aac"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || preferredMimeType || "audio/mp4";
        const extension = mimeType.includes("aac") ? "aac" : mimeType.includes("mp4") ? "m4a" : "audio";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) {
          stream.getTracks().forEach((track) => track.stop());
          recorderRef.current = null;
          return;
        }
        const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: mimeType });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewFile(file);
        setAudioPreviewUrl(URL.createObjectURL(file));
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      recorderRef.current = null;
      alert("Microphone access required");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") return;
    recorderRef.current.stop();
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recorderRef.current?.state === "recording") {
      stopRecording();
      return;
    }
    startRecording();
  };

  const sendAudioPreview = async () => {
    if (!audioPreviewFile) return;
    await uploadFile(audioPreviewFile, "audio");
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewFile(null);
    setAudioPreviewUrl("");
  };

  const cancelAudioPreview = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewFile(null);
    setAudioPreviewUrl("");
  };

  const renderMessage = (message: Message) => {
    const url = message.file_url || message.content;

    if (message.message_type === "image") {
      return <img src={url} alt={message.file_name || "Image"} style={{ display: "block", maxWidth: "100%", maxHeight: 280, borderRadius: 10, objectFit: "contain" }} />;
    }

    if (message.message_type === "video") {
      return <video src={url} controls style={{ display: "block", width: "100%", maxHeight: 280, borderRadius: 10 }} />;
    }

    if (message.message_type === "audio") {
      return <audio src={url} controls style={{ width: "240px", maxWidth: "100%" }} />;
    }

    if (message.message_type === "file") {
      return (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, color: "#075e54", textDecoration: "none", fontWeight: 700 }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <span style={{ wordBreak: "break-word" }}>{message.file_name || "Download file"}</span>
        </a>
      );
    }

    const translatedContent =
      viewerType === "patient" && message.sender_type === "staff"
        ? translatedMessages[translationKey(message.id, uiLang)]
        : "";
    return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{translatedContent || message.content}</span>;
  };

  const chatFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const appBg = darkMode ? "#0f172a" : "#f7f7f7";
  const textPrimary = darkMode ? "#f8fafc" : "#111";
  const panelBg = darkMode ? "#172033" : "#fff";
  const footerBg = darkMode ? "#111827" : "#ededed";
  const inputPanelBg = darkMode ? "#1f2937" : "#fff";
  const messageFontSize = textSize === "large" ? 22 : 19;
  const translations = {
    en: {
      messagePlaceholder: "Message",
      send: "SEND",
      cancel: "Cancel",
      settings: "Settings",
      quickReplies: "Quick Replies",
      photos: "Photos",
      video: "Video",
      documents: "Prescriptions",
      noPrescriptions: "No prescriptions yet.",
      prescriptionInstructions: "Instructions",
      createReply: "Create quick reply",
      saveReply: "Save Reply",
      saveChanges: "Save Changes",
      edit: "Edit",
      delete: "Delete",
      deletedByUser: "This message was Deleted by user",
      darkMode: "Dark mode",
      textSize: "Text size",
      normal: "Normal",
      large: "Large",
    },
    es: {
      messagePlaceholder: "Mensaje",
      send: "ENVIAR",
      cancel: "Cancelar",
      settings: "Ajustes",
      quickReplies: "Respuestas rápidas",
      photos: "Fotos",
      video: "Video",
      documents: "Recetas",
      noPrescriptions: "Todavía no hay recetas.",
      prescriptionInstructions: "Indicaciones",
      createReply: "Crear respuesta rápida",
      saveReply: "Guardar respuesta",
      saveChanges: "Guardar cambios",
      edit: "Editar",
      delete: "Eliminar",
      deletedByUser: "This message was Deleted by user",
      darkMode: "Modo oscuro",
      textSize: "Tamaño de texto",
      normal: "Normal",
      large: "Grande",
    },
  };
  const labels = translations[uiLang] || translations.en;
  const prescriptionMessages = messages.filter((message) => `${message.file_name || ""}`.startsWith("[MED]"));
  const newPrescriptionCount = prescriptionMessages.filter((message) => !lastPrescriptionSeenAt || `${message.created_at || ""}` > lastPrescriptionSeenAt).length;
  const openPrescriptions = () => {
    const latest = prescriptionMessages[prescriptionMessages.length - 1]?.created_at || new Date().toISOString();
    setPrescriptionsOpen(true);
    setMenuOpen(false);
    setLastPrescriptionSeenAt(latest);
    if (typeof window !== "undefined") window.localStorage.setItem(prescriptionSeenKey, latest);
  };
  const parsePrescriptionText = (value?: string | null) => {
    const clean = `${value || labels.documents}`.replace(/^\[MED\]\s*/i, "").trim();
    const [title, ...rest] = clean.split(/\n+/);
    return {
      title: title?.trim() || labels.documents,
      instructions: rest.join("\n").trim(),
    };
  };
  const visibleChatMessages = messages.filter((message) => {
    const fileName = `${message.file_name || ""}`;
    if (isLegacyRoomCreatedMessage(message)) return false;
    if (fileName.startsWith("[MED]") || fileName.startsWith("[BEFORE]") || fileName.startsWith("[PROFILE]") || fileName.startsWith("profile.") || `${message.content || ""}`.includes("patient-profiles/") || `${message.content || ""}`.includes("patient-photos/")) return false;
    if (viewerType === "patient" && (message.deleted_by_patient || message.deleted_by_staff)) return false;
    return true;
  });
  const roleLabel = (role?: string | null) => {
    const labelsByLang = uiLang === "es"
      ? { doctor: "Doctor", enfermeria: "Enfermería", coordinacion: "Coordinación", post_quirofano: "Post-Q", staff: "Personal" }
      : { doctor: "Doctor", enfermeria: "Nursing", coordinacion: "Coordination", post_quirofano: "Post-Op", staff: "Staff" };
    return (labelsByLang as Record<string, string>)[role || "staff"] || (uiLang === "es" ? "Personal" : "Staff");
  };
  const formatTime = (createdAt?: string) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    return date.toLocaleTimeString(uiLang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };
  const formatDateLabel = (createdAt?: string) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    return date.toLocaleDateString(uiLang === "es" ? "es-MX" : "en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  const senderLabel = (message: Message) => {
    if (message.sender_name?.trim()) return message.sender_name.trim();
    if (message.sender_type === "staff") return roleLabel(message.sender_role);
    return mineLabel(message);
  };
  const mineLabel = (message: Message) => {
    const isMine = message.sender_type !== "staff";
    return isMine ? (uiLang === "es" ? "Tú" : "You") : (uiLang === "es" ? "Paciente" : "Patient");
  };

  if (!accessReady) {
    return (
      <main style={{ height: "100%", minHeight: "-webkit-fill-available", display: "grid", placeItems: "center", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", padding: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(7,94,84,0.18)", borderTopColor: "#075e54", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main style={{ height: "100%", minHeight: "-webkit-fill-available", display: "flex", flexDirection: "column", background: "#fff", color: "#111", fontFamily: chatFontFamily, overflow: "hidden" }}>
        <header style={{ height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
          <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
        </header>
        <section style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 10px 36px rgba(0,0,0,0.14)", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔒</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>No pudimos abrir este chat</h1>
            <p style={{ margin: "0 0 18px", color: "#555", lineHeight: 1.5 }}>Por seguridad, este enlace no es válido o necesita ser actualizado por el equipo del Dr. Fonseca.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={{ height: "100%", minHeight: "-webkit-fill-available", display: "flex", flexDirection: "column", background: appBg, color: textPrimary, fontFamily: chatFontFamily, overflow: "hidden" }}>
      <style>{`
        button { transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease, box-shadow 150ms ease; }
        button:active { transform: scale(0.96); opacity: 0.86; }
        input { transition: box-shadow 170ms ease, background-color 170ms ease; }
        input:focus { box-shadow: 0 0 0 3px rgba(30,136,229,0.18); }
        .chat-composer:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        @keyframes messageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes micPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(153,27,27,0.42); } 50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(153,27,27,0); } }
      `}</style>
      <header style={{ position: "relative", height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
      </header>

      <section style={{ flex: 1, overflowY: "auto", padding: "12px 10px 16px" }} onClick={() => { setMenuOpen(false); setDeleteMenuMessageId(null); }}>
        {(() => {
          let previousMessageDate = "";
          return visibleChatMessages.map((message) => {
          const mine = message.sender_type !== "staff";
          const deletedByPatient = !!message.deleted_by_patient;
          const canDeletePatientMessage = viewerType === "patient" && mine && !deletedByPatient && !message.deleted_by_staff;
          const softBlue = "#d9ecf7";
          const bubbleBg =
            viewerType === "staff"
              ? message.sender_type === "patient" ? softBlue : "#fff"
              : message.sender_type === "staff" ? softBlue : "#fff";
          const messageDate = message.created_at ? new Date(message.created_at).toDateString() : "";
          const showDate = !!messageDate && messageDate !== previousMessageDate;
          previousMessageDate = messageDate || previousMessageDate;
          return (
            <Fragment key={message.id}>
              {showDate && (
                <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 12px" }}>
                  <div style={{ background: darkMode ? "rgba(17,27,33,0.92)" : "rgba(255,255,255,0.96)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, borderRadius: 10, padding: "5px 13px", color: darkMode ? "#F8FAFC" : "#111827", fontSize: 14, fontWeight: 850, boxShadow: "0 1px 4px rgba(15,23,42,0.10)" }}>
                    {formatDateLabel(message.created_at)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 5, animation: "messageIn 180ms ease-out" }}>
                <div onClick={(event) => { event.stopPropagation(); if (canDeletePatientMessage) setDeleteMenuMessageId((current) => current === message.id ? null : message.id); }} onMouseDown={() => startMessageLongPress(message.id, canDeletePatientMessage)} onMouseUp={cancelMessageLongPress} onMouseLeave={cancelMessageLongPress} onTouchStart={() => startMessageLongPress(message.id, canDeletePatientMessage)} onTouchEnd={cancelMessageLongPress} style={{ maxWidth: "min(84%, 680px)", background: bubbleBg, color: "#07111f", borderRadius: mine ? "16px 6px 16px 16px" : "6px 16px 16px 16px", padding: "11px 13px 9px", boxShadow: "0 1px 2px rgba(15,23,42,0.13)", fontSize: messageFontSize, fontWeight: 560, lineHeight: 1.42, letterSpacing: 0, transition: "box-shadow 170ms ease, transform 170ms ease", userSelect: "none" }}>
                <div style={{ marginBottom: 5, lineHeight: 1.15 }}>
                  <span style={{ fontSize: Math.max(messageFontSize - 3, 15), fontWeight: 850, color: "#334155" }}>{senderLabel(message)}</span>
                </div>
                {renderMessage(message)}
                {deletedByPatient && viewerType === "staff" && (
                  <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid rgba(15,23,42,0.14)", fontSize: 12, fontStyle: "italic", opacity: 0.72 }}>{labels.deletedByUser}</div>
                )}
                <div style={{ fontSize: Math.max(messageFontSize - 5, 13), fontWeight: 520, color: "#64748b", whiteSpace: "nowrap", lineHeight: 1.1, marginTop: 4, textAlign: "right" }}>{formatTime(message.created_at)}</div>
                {canDeletePatientMessage && deleteMenuMessageId === message.id && (
                  <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:8}}>
                    {message.message_type === "text" && (
                      <button onClick={(event) => { event.stopPropagation(); setEditingMessage(message); setEditingMessageText(message.content || ""); setDeleteMenuMessageId(null); }} style={{ border: "none", background: "transparent", color: "#075e54", fontSize: 13, fontWeight: 900, padding: 0 }}>
                        {labels.edit}
                      </button>
                    )}
                    <button onClick={(event) => { event.stopPropagation(); deletePatientMessage(message.id); }} style={{ border: "none", background: "transparent", color: "#b91c1c", fontSize: 13, fontWeight: 900, padding: 0 }}>
                      {labels.delete}
                    </button>
                  </div>
                )}
              </div>
              </div>
            </Fragment>
          );
          });
        })()}
        <div ref={bottomRef} />
      </section>

      <footer onClick={() => setDeleteMenuMessageId(null)} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px calc(12px + env(safe-area-inset-bottom))", background: footerBg, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(78px + env(safe-area-inset-bottom))", left: 14, width: 248, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5, animation: "menuIn 160ms ease-out", transformOrigin: "left bottom" }}>
            <button onClick={() => openPicker("image/*")} style={menuButtonStyle}>{labels.photos}</button>
            <button onClick={() => { videoCaptureRef.current?.click(); setMenuOpen(false); }} style={menuButtonStyle}>{labels.video}</button>
            <button onClick={openPrescriptions} style={{ ...menuButtonStyle, position:"relative" }}>
              {labels.documents}
              {newPrescriptionCount > 0 && <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",minWidth:22,height:22,borderRadius:999,background:"#DC2626",color:"white",display:"grid",placeItems:"center",fontSize:12,fontWeight:900}}>{newPrescriptionCount}</span>}
            </button>
            <button onClick={() => { setQuickRepliesManageOpen(true); setMenuOpen(false); }} style={menuButtonStyle}>{labels.quickReplies}</button>
            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} style={{ ...menuButtonStyle, borderBottom: "none" }}>{labels.settings}</button>
          </div>
        )}

        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" style={{ position:"relative", width: 42, height: 42, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#ddd", color: menuOpen ? "#fff" : "#111", fontSize: 28, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
          {newPrescriptionCount > 0 && <span style={{position:"absolute",right:0,top:0,width:12,height:12,borderRadius:"50%",background:"#DC2626",border:"2px solid #ededed"}} />}
        </button>

        <div
          ref={setComposerNode}
          className="chat-composer"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={labels.messagePlaceholder}
          data-placeholder={labels.messagePlaceholder}
          onFocus={() => { setDeleteMenuMessageId(null); scrollToLatest(); }}
          onInput={(event) => {
            const next = event.currentTarget.textContent || "";
            setText(next);
            setQuickRepliesOpen(next.startsWith("/"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendText();
            }
          }}
          style={{ minWidth: 0, flex: 1, minHeight: 58, maxHeight: 104, overflowY: "auto", border: "none", outline: "none", borderRadius: 29, background: inputPanelBg, color: darkMode ? "#f8fafc" : "#1f2937", padding: "16px 20px", fontSize: messageFontSize, fontWeight: 500, lineHeight: 1.42, WebkitUserSelect: "text", userSelect: "text" }}
        />

        <button onClick={sendText} aria-label="Send" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 20 }}>➤</button>

        <button onClick={() => { window.location.href = "tel:+523332314480"; }} aria-label="Call" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 26 }}>
          <Image src="/Phone_icon.png" alt="" width={30} height={30} style={{ width: 30, height: 30, objectFit: "contain" }} />
        </button>

        <button onClick={toggleRecording} aria-label="Record audio" style={{ ...roundButtonStyle, background: recording ? "#eef6ff" : "#eef6ff", color: "#0b4ea2", animation: recording ? "micPulse 1.15s ease-in-out infinite" : "none" }}>
          <Image src="/Microphone_icon.png" alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: "contain" }} />
        </button>

        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
        <input ref={videoCaptureRef} type="file" accept="video/*" capture="environment" onChange={handleVideoCapture} style={{ display: "none" }} />
      </footer>

      {audioPreviewUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", display: "grid", placeItems: "center", padding: 18, zIndex: 25 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
            <audio src={audioPreviewUrl} controls style={{ width: "100%", marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={cancelAudioPreview} style={{ height: 50, border: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, fontSize: 16, fontWeight: 700 }}>{labels.cancel}</button>
              <button onClick={sendAudioPreview} style={{ height: 50, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800 }}>{labels.send}</button>
            </div>
          </div>
        </div>
      )}

      {quickRepliesOpen && (
        <div style={{ position: "fixed", left: 10, right: 10, bottom: "calc(86px + env(safe-area-inset-bottom))", zIndex: 20, pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, maxHeight: "min(42dvh, 260px)", overflowY: "auto", paddingBottom: 6 }}>
              {quickReplies.map((reply, index) => (
                <button key={`${reply}-${index}`} onClick={() => { setComposerText(reply); setQuickRepliesOpen(false); composerRef.current?.focus(); }} style={{ width: "fit-content", maxWidth: "calc(100vw - 20px)", border: "1px solid rgba(0,0,0,0.10)", background: panelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.16)", pointerEvents: "auto" }}>{reply}</button>
              ))}
          </div>
        </div>
      )}

      {quickRepliesManageOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 20 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>{labels.quickReplies}</strong>
              <button onClick={() => setQuickRepliesManageOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {quickReplies.map((reply, index) => (
                <div key={`${reply}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => { setComposerText(reply); setQuickRepliesManageOpen(false); composerRef.current?.focus(); }} style={{ flex: 1, border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16 }}>{reply}</button>
                  <button onClick={() => { setReplyDraft(reply); setEditingReplyIndex(index); }} style={{ border: "none", background: "#e8f4ff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }}>{labels.edit}</button>
                  <button onClick={() => { setQuickReplies((current) => current.filter((_, replyIndex) => replyIndex !== index)); if (editingReplyIndex === index) { setReplyDraft(""); setEditingReplyIndex(null); } }} style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 12, padding: "12px 14px", fontSize: 16 }}>{labels.delete}</button>
                </div>
              ))}
            </div>
            <input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder={labels.createReply} style={{ width: "100%", height: 48, border: "1px solid rgba(0,0,0,0.12)", outline: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, padding: "0 14px", fontSize: 16, marginBottom: 10 }} />
            <button onClick={saveQuickReply} style={{ width: "100%", height: 48, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 700 }}>{editingReplyIndex === null ? labels.saveReply : labels.saveChanges}</button>
          </div>
        </div>
      )}

      {prescriptionsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 20 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>{labels.documents}</strong>
              <button onClick={() => setPrescriptionsOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {prescriptionMessages.length === 0 && (
                <div style={{ border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", fontSize: 16 }}>{labels.noPrescriptions}</div>
              )}
              {prescriptionMessages.map((message) => {
                const url = message.file_url || message.content;
                const prescription = parsePrescriptionText(message.file_name);
                return (
                  <a key={message.id} href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textDecoration: "none", fontSize: 16, fontWeight: 700 }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <span style={{ wordBreak: "break-word", display:"grid", gap:4 }}>
                      <span>{prescription.title}</span>
                      {prescription.instructions && <span style={{fontSize:13,fontWeight:600,color:darkMode?"#CBD5E1":"#64748B",lineHeight:1.35}}>{labels.prescriptionInstructions}: {prescription.instructions}</span>}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editingMessage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 24 }} onClick={() => { setEditingMessage(null); setEditingMessageText(""); }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }} onClick={(event)=>event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>{labels.edit}</strong>
              <button onClick={() => { setEditingMessage(null); setEditingMessageText(""); }} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <textarea
              value={editingMessageText}
              onChange={(event)=>setEditingMessageText(event.target.value)}
              rows={4}
              style={{ width: "100%", border: "1px solid rgba(148,163,184,0.35)", outline: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, padding: "12px 14px", fontSize: 16, resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
            />
            <button onClick={updatePatientMessage} disabled={!editingMessageText.trim()} style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800, opacity: editingMessageText.trim() ? 1 : 0.5 }}>
              {labels.saveChanges}
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 20 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <strong style={{ fontSize: 18 }}>{labels.settings}</strong>
              <button onClick={() => setSettingsOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 16, marginBottom: 18 }}>
              {labels.darkMode}
              <input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} style={{ width: 24, height: 24 }} />
            </label>
            <div style={{ fontSize: 16, marginBottom: 10 }}>{labels.textSize}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setTextSize("normal")} style={{ height: 46, border: "none", borderRadius: 14, background: textSize === "normal" ? "#075e54" : inputPanelBg, color: textSize === "normal" ? "#fff" : textPrimary, fontSize: 16 }}>{labels.normal}</button>
              <button onClick={() => setTextSize("large")} style={{ height: 46, border: "none", borderRadius: 14, background: textSize === "large" ? "#075e54" : inputPanelBg, color: textSize === "large" ? "#fff" : textPrimary, fontSize: 16 }}>{labels.large}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const roundButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  fontSize: 28,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const menuButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px 20px",
  border: "none",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  background: "#fff",
  color: "#111",
  textAlign: "left",
  fontSize: 17,
  fontWeight: 700,
};
