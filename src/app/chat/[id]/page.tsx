"use client";

// ALL chat UI MUST be handled inside ChatShell.tsx.
// DO NOT duplicate UI here.

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ChatShell from "@/components/chat/ChatShell";

type Message = {
  id: string;
  content: string;
  sender_id?: string | null;
  sender_type?: string;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(["Gracias", "Tengo una pregunta", "Voy en camino"]);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingReplyIndex, setEditingReplyIndex] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [recording, setRecording] = useState(false);
  const [uiLang, setUiLang] = useState<"es" | "en">("en");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [officePhones, setOfficePhones] = useState({ Guadalajara: "", Tijuana: "" });
  const [fileAccept, setFileAccept] = useState("*");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const lang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    setUiLang(lang.startsWith("es") ? "es" : "en");
  }, []);

  useEffect(() => {
    let mounted = true;

    const isSchemaColumnError = (error: unknown) => {
      const value = error as { message?: string; details?: string; hint?: string };
      const message = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
      return message.includes("column") || message.includes("schema cache") || message.includes("relation");
    };

    const loadOfficePhones = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["office_phone_guadalajara", "office_phone_tijuana"]);

      if (!mounted || !data) return;
      setOfficePhones({
        Guadalajara: data.find((entry) => entry.key === "office_phone_guadalajara")?.value || "",
        Tijuana: data.find((entry) => entry.key === "office_phone_tijuana")?.value || "",
      });
    };

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUserId(data.user?.id || null);
    });

    const validateRoom = async () => {
      setAccessReady(false);
      setAccessDenied(false);

      let roomQuery = await supabase
        .from("rooms")
        .select("id, patient_access_token, procedures(office_location)")
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

    loadOfficePhones();
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    setText("");
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

  const emergencyPhone = room?.procedures?.office_location === "Tijuana" ? officePhones.Tijuana : officePhones.Guadalajara || officePhones.Tijuana;
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

  if (!accessReady) {
    return (
      <main style={{ height: "100dvh", display: "grid", placeItems: "center", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", padding: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(7,94,84,0.18)", borderTopColor: "#075e54", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden" }}>
        <header style={{ height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
          <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
        </header>
        <section style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 10px 36px rgba(0,0,0,0.14)", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔒</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>No pudimos abrir este chat</h1>
            <p style={{ margin: "0 0 18px", color: "#555", lineHeight: 1.5 }}>Por seguridad, este enlace no es válido o necesita ser actualizado por el equipo del Dr. Fonseca.</p>
            {emergencyPhone && (
              <a href={`tel:${emergencyPhone.replace(/[^\d+]/g, "")}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", borderRadius: 999, background: "#075e54", color: "#fff", textDecoration: "none", fontWeight: 800 }}>
                Llamar a la oficina
              </a>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <ChatShell
        messages={messages.filter((message) => {
          const fileName = `${message.file_name || ""}`;
          if (fileName.startsWith("[MED]") || fileName.startsWith("[BEFORE]") || fileName.startsWith("[PROFILE]") || fileName.startsWith("profile.") || message.content.includes("patient-profiles/") || message.content.includes("patient-photos/")) return false;
          if (message.deleted_by_patient) return false;
          return true;
        })}
        message={text}
        onChange={(next) => {
          setText(next);
          setQuickRepliesOpen(next.startsWith("/"));
        }}
        onSend={sendText}
        onMic={toggleRecording}
        onCamera={() => openPicker("image/*")}
        onPlusClick={() => setMenuOpen((open) => !open)}
        onQuickReply={(reply) => {
          setText(reply);
          setQuickRepliesOpen(false);
        }}
        mode="patient"
        menuOpen={menuOpen}
        quickRepliesOpen={quickRepliesOpen}
        quickReplies={quickReplies}
        labels={labels}
        onPhotos={() => openPicker("image/*")}
        onVideo={() => {
          videoCaptureRef.current?.click();
          setMenuOpen(false);
        }}
        onDocuments={() => {
          setPrescriptionsOpen(true);
          setMenuOpen(false);
        }}
        onQuickRepliesOpen={() => {
          setQuickRepliesManageOpen(true);
          setMenuOpen(false);
        }}
        onSettings={() => {
          setSettingsOpen(true);
          setMenuOpen(false);
        }}
      />
      <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
      <input ref={videoCaptureRef} type="file" accept="video/*" capture="environment" onChange={handleVideoCapture} style={{ display: "none" }} />
    </>
  );
}
