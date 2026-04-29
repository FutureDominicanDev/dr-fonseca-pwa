"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickReplies] = useState<string[]>(["Gracias", "Tengo una pregunta", "Voy en camino"]);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [recording, setRecording] = useState(false);
  const [uiLang, setUiLang] = useState<"es" | "en">("en");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoPreviewFile, setVideoPreviewFile] = useState<File | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [officePhones, setOfficePhones] = useState({ Guadalajara: "", Tijuana: "" });
  const [fileAccept, setFileAccept] = useState("*");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoCaptureRef = useRef<HTMLInputElement>(null);

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
    const path = `patients/${id}/${storageTimestamp}-${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) return null;

    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
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
      const { type: _type, file_type: _fileType, message_hash: _messageHash, ...compatiblePayload } = payload;
      insert = await supabase.from("messages").insert(compatiblePayload).select("*").single();
    }
    if (insert.error) return null;

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

  const handleVideoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setMenuOpen(false);
    event.target.value = "";
  };

  const sendVideoPreview = async () => {
    if (!videoPreviewFile) return;
    await uploadFile(videoPreviewFile, "video");
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewFile(null);
    setVideoPreviewUrl("");
  };

  const cancelVideoPreview = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewFile(null);
    setVideoPreviewUrl("");
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

    return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</span>;
  };

  const emergencyPhone = room?.procedures?.office_location === "Tijuana" ? officePhones.Tijuana : officePhones.Guadalajara || officePhones.Tijuana;
  const appBg = darkMode ? "#0f172a" : "#f7f7f7";
  const textPrimary = darkMode ? "#f8fafc" : "#111";
  const panelBg = darkMode ? "#172033" : "#fff";
  const footerBg = darkMode ? "#111827" : "#ededed";
  const inputPanelBg = darkMode ? "#1f2937" : "#fff";
  const messageFontSize = textSize === "large" ? 18 : 16;
  const translations = {
    en: {
      messagePlaceholder: "Message",
      send: "SEND",
      cancel: "Cancel",
      settings: "Settings",
      quickReplies: "Quick Replies",
      photos: "Photos",
      video: "Video",
      documents: "Documents",
      createReply: "Create quick reply",
      saveReply: "Save Reply",
      saveChanges: "Save Changes",
      edit: "Edit",
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
      documents: "Documentos",
      createReply: "Crear respuesta rápida",
      saveReply: "Guardar respuesta",
      saveChanges: "Guardar cambios",
      edit: "Editar",
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
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: appBg, color: textPrimary, fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden" }}>
      <style>{`
        button { transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease, box-shadow 150ms ease; }
        button:active { transform: scale(0.96); opacity: 0.86; }
        input { transition: box-shadow 170ms ease, background-color 170ms ease; }
        input:focus { box-shadow: 0 0 0 3px rgba(30,136,229,0.18); }
        @keyframes messageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes micPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(153,27,27,0.42); } 50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(153,27,27,0); } }
      `}</style>
      <header style={{ height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
      </header>

      <section style={{ flex: 1, overflowY: "auto", padding: "14px 10px 18px" }} onClick={() => setMenuOpen(false)}>
        {messages.map((message) => {
          const fileName = `${message.file_name || ""}`;
          if (fileName.startsWith("[BEFORE]") || fileName.startsWith("[PROFILE]") || fileName.startsWith("profile.") || message.content.includes("patient-profiles/") || message.content.includes("patient-photos/")) return null;
          const mine = message.sender_type !== "staff";
          const softBlue = "#d9ecf7";
          const bubbleBg =
            viewerType === "staff"
              ? message.sender_type === "patient" ? softBlue : "#fff"
              : message.sender_type === "staff" ? softBlue : "#fff";
          return (
            <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8, animation: "messageIn 180ms ease-out" }}>
              <div style={{ maxWidth: "70%", background: bubbleBg, color: "#0f172a", borderRadius: mine ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "11px 13px", boxShadow: "0 5px 16px rgba(15,23,42,0.16), 0 1px 4px rgba(15,23,42,0.13)", fontSize: messageFontSize, fontWeight: 600, lineHeight: 1.45, transition: "box-shadow 170ms ease, transform 170ms ease" }}>
                {renderMessage(message)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </section>

      <footer style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px calc(12px + env(safe-area-inset-bottom))", background: footerBg, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(78px + env(safe-area-inset-bottom))", left: 14, width: 248, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5, animation: "menuIn 160ms ease-out", transformOrigin: "left bottom" }}>
            <button onClick={() => openPicker("image/*")} style={menuButtonStyle}>{labels.photos}</button>
            <button onClick={() => { videoCaptureRef.current?.click(); setMenuOpen(false); }} style={menuButtonStyle}>{labels.video}</button>
            <button onClick={() => openPicker("*")} style={menuButtonStyle}>{labels.documents}</button>
            <button onClick={() => { setQuickRepliesOpen(true); setMenuOpen(false); }} style={menuButtonStyle}>{labels.quickReplies}</button>
            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} style={{ ...menuButtonStyle, borderBottom: "none" }}>{labels.settings}</button>
          </div>
        )}

        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" style={{ width: 58, height: 58, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#ddd", color: menuOpen ? "#fff" : "#111", fontSize: 34, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
        </button>

        <input value={text} onChange={(event) => { const next = event.target.value; setText(next); setQuickRepliesOpen(next.startsWith("/")); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) sendText(); }} placeholder={labels.messagePlaceholder} style={{ minWidth: 0, flex: 1, height: 58, border: "none", outline: "none", borderRadius: 29, background: inputPanelBg, color: textPrimary, padding: "0 20px", fontSize: messageFontSize }} />

        <button onClick={sendText} aria-label="Send" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 22 }}>➤</button>

        <button onClick={toggleRecording} aria-label="Record audio" style={{ ...roundButtonStyle, background: recording ? "#eef6ff" : "#eef6ff", color: "#0b4ea2", animation: recording ? "micPulse 1.15s ease-in-out infinite" : "none" }}>
          <Image src="/Microphone_icon.png" alt="" width={42} height={42} style={{ width: 42, height: 42, objectFit: "contain" }} />
        </button>

        <button onClick={() => { window.location.href = "tel:+523332314480"; }} aria-label="Call" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 26 }}>
          <Image src="/Phone_icon.png" alt="" width={34} height={34} style={{ width: 34, height: 34, objectFit: "contain" }} />
        </button>

        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
        <input ref={videoCaptureRef} type="file" accept="video/*" capture="environment" onChange={handleVideoCapture} style={{ display: "none" }} />
      </footer>

      {videoPreviewUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "grid", placeItems: "center", padding: 18, zIndex: 25 }}>
          <div style={{ width: "100%", maxWidth: 460, background: panelBg, color: textPrimary, borderRadius: 18, padding: 16, boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
            <video src={videoPreviewUrl} controls playsInline style={{ width: "100%", maxHeight: "58dvh", borderRadius: 14, background: "#000", display: "block", marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={cancelVideoPreview} style={{ height: 50, border: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, fontSize: 16, fontWeight: 700 }}>{labels.cancel}</button>
              <button onClick={sendVideoPreview} style={{ height: 50, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800 }}>{labels.send}</button>
            </div>
          </div>
        </div>
      )}

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
        <div style={{ position: "fixed", left: 10, right: 10, bottom: 92, zIndex: 20, pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              {quickReplies.map((reply, index) => (
                <button key={`${reply}-${index}`} onClick={() => { setText(reply); setQuickRepliesOpen(false); }} style={{ width: "fit-content", maxWidth: "calc(100vw - 20px)", border: "1px solid rgba(0,0,0,0.10)", background: panelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.16)", pointerEvents: "auto" }}>{reply}</button>
              ))}
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
  width: 58,
  height: 58,
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
