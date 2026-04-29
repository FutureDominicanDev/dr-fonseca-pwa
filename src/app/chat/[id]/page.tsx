"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Message = {
  id: string;
  content: string;
  sender_type?: string;
  message_type: "text" | "image" | "video" | "audio" | "file";
  file_url?: string | null;
  file_name?: string | null;
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
  const [quickReplies, setQuickReplies] = useState<string[]>(["Gracias", "Tengo una pregunta", "Voy en camino"]);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingReplyIndex, setEditingReplyIndex] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [recording, setRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoPreviewFile, setVideoPreviewFile] = useState<File | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [officePhones, setOfficePhones] = useState({ Guadalajara: "", Tijuana: "" });
  const [fileAccept, setFileAccept] = useState("*");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const isSpanish = typeof navigator !== "undefined" ? navigator.language.toLowerCase().startsWith("es") : true;
  const labels = {
    message: isSpanish ? "Mensaje" : "Message",
    photos: isSpanish ? "Fotos" : "Photos",
    video: isSpanish ? "Video" : "Video",
    documents: isSpanish ? "Documentos" : "Documents",
    quickReplies: isSpanish ? "Respuestas rapidas" : "Quick Replies",
    settings: isSpanish ? "Ajustes" : "Settings",
    cancel: isSpanish ? "Cancelar" : "Cancel",
    send: isSpanish ? "ENVIAR" : "SEND",
    edit: isSpanish ? "Editar" : "Edit",
    createQuickReply: isSpanish ? "Crear respuesta rapida" : "Create quick reply",
    saveReply: isSpanish ? "Guardar respuesta" : "Save Reply",
    saveChanges: isSpanish ? "Guardar cambios" : "Save Changes",
    darkMode: isSpanish ? "Modo oscuro" : "Dark mode",
    textSize: isSpanish ? "Tamano de texto" : "Text size",
    normal: isSpanish ? "Normal" : "Normal",
    large: isSpanish ? "Grande" : "Large",
    openMenu: isSpanish ? "Abrir menu" : "Open menu",
    camera: isSpanish ? "Camara" : "Camera",
    micStart: isSpanish ? "Iniciar grabacion de audio" : "Start audio recording",
    micStop: isSpanish ? "Detener grabacion de audio" : "Stop audio recording",
  };

  const isSetupMediaMessage = (message: Message) => {
    const marker = `${message.file_name || ""} ${message.content || ""} ${message.file_url || ""}`.toLowerCase();
    return (
      message.message_type === "image" &&
      message.sender_type === "staff" &&
      (marker.includes("[profile]") ||
        marker.includes("[before]") ||
        marker.includes("profile") ||
        marker.includes("avatar") ||
        marker.includes("setup") ||
        marker.includes("before"))
    );
  };

  const visibleMessages = messages.filter((message) => !isSetupMediaMessage(message));

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

      if (mounted) setMessages(((data || []) as Message[]).filter((message) => !isSetupMediaMessage(message)));
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
            if (isSetupMediaMessage(message)) return current;
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

  const sendText = async () => {
    const content = text.trim();
    if (!content || accessDenied || !accessReady) return;

    setText("");
    const { data } = await supabase
      .from("messages")
      .insert({
        room_id: id,
        content,
        sender_type: "patient",
        message_type: "text",
      })
      .select("*")
      .single();

    if (data) {
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
    if (accessDenied || !accessReady) return;

    const path = `chat/${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file);
    if (error) return;

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

    const { data: message } = await supabase
      .from("messages")
      .insert({
        room_id: id,
        content: url,
        sender_type: "patient",
        message_type: messageType,
        file_url: url,
        file_name: file.name,
      })
      .select("*")
      .single();

    if (message) {
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message as Message];
      });
    }
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        if (!chunksRef.current.length) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!blob.size) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewFile(file);
        setAudioPreviewUrl(URL.createObjectURL(file));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
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
  const appBg = darkMode ? "#0f172a" : "#fff";
  const textPrimary = darkMode ? "#f8fafc" : "#111";
  const panelBg = darkMode ? "#172033" : "#fff";
  const footerBg = darkMode ? "#111827" : "#f0f0f0";
  const inputPanelBg = darkMode ? "#1f2937" : "#fff";
  const messageFontSize = textSize === "large" ? 18 : 16;

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
        <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#120024", borderBottom: "1px solid rgba(17,24,39,0.10)", padding: "4px 16px" }}>
          <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={360} height={60} priority style={{ width: "min(360px, 86vw)", height: 60, objectFit: "contain", objectPosition: "center" }} />
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
      <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#120024", borderBottom: "1px solid rgba(17,24,39,0.10)", padding: "4px 16px" }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={360} height={60} priority style={{ width: "min(360px, 86vw)", height: 60, objectFit: "contain", objectPosition: "center" }} />
      </header>

      <section style={{ flex: 1, overflowY: "auto", padding: "14px 10px 18px" }} onClick={() => setMenuOpen(false)}>
        {visibleMessages.map((message) => {
          const mine = message.sender_type !== "staff";
          const softBlue = "#d4eaff";
          const bubbleBg =
            viewerType === "staff"
              ? message.sender_type === "patient" ? softBlue : "#fff"
              : message.sender_type === "staff" ? softBlue : "#fff";
          return (
            <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{ maxWidth: "78%", background: bubbleBg, color: "#111", borderRadius: mine ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "10px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.12)", fontSize: messageFontSize, lineHeight: 1.45 }}>
                {renderMessage(message)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </section>

      <footer style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px calc(14px + env(safe-area-inset-bottom))", background: darkMode ? "#0b1220" : "#d7dee8", borderTop: "1px solid rgba(0,0,0,0.14)", boxShadow: "0 -6px 18px rgba(15,23,42,0.10)" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(78px + env(safe-area-inset-bottom))", left: 14, width: 248, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5 }}>
            <button onClick={() => openPicker("image/*")} style={menuButtonStyle}>{labels.photos}</button>
            <button onClick={() => { videoCaptureRef.current?.click(); setMenuOpen(false); }} style={menuButtonStyle}>{labels.video}</button>
            <button onClick={() => openPicker("*")} style={menuButtonStyle}>{labels.documents}</button>
            <button onClick={() => { setQuickRepliesOpen(true); setMenuOpen(false); }} style={menuButtonStyle}>{labels.quickReplies}</button>
            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} style={{ ...menuButtonStyle, borderBottom: "none" }}>{labels.settings}</button>
          </div>
        )}

        <button onClick={() => setMenuOpen((open) => !open)} aria-label={labels.openMenu} style={{ width: 62, height: 62, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#eef2f7", color: menuOpen ? "#fff" : "#111", fontSize: 34, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
        </button>

        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) sendText(); }} placeholder={labels.message} style={{ minWidth: 0, flex: 1, height: 62, border: "none", outline: "none", borderRadius: 31, background: inputPanelBg, color: textPrimary, padding: "0 20px", fontSize: messageFontSize, boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)" }} />

        <button onClick={() => openPicker("image/*")} aria-label={labels.camera} style={roundButtonStyle}>📷</button>

        <button onClick={toggleRecording} aria-label={recording ? labels.micStop : labels.micStart} style={{ ...roundButtonStyle, background: recording ? "#bfdbfe" : "#eaf2ff", color: "#143b70", fontWeight: 900, boxShadow: recording ? "0 0 0 4px rgba(20,59,112,0.18)" : "none" }}>
          <svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" fill="currentColor" />
            <path d="M5.5 10.5a1 1 0 0 1 2 0A4.5 4.5 0 0 0 12 15a4.5 4.5 0 0 0 4.5-4.5 1 1 0 1 1 2 0A6.51 6.51 0 0 1 13 16.92V20h2.25a1 1 0 1 1 0 2h-6.5a1 1 0 1 1 0-2H11v-3.08a6.51 6.51 0 0 1-5.5-6.42Z" fill="currentColor" />
          </svg>
        </button>

        <button onClick={sendText} aria-label={labels.send} style={{ width: 62, height: 62, borderRadius: "50%", border: "none", background: "#075e54", color: "#fff", fontSize: 26, display: "grid", placeItems: "center", flexShrink: 0 }}>➤</button>

        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
        <input ref={videoCaptureRef} type="file" accept="video/*" capture="environment" onChange={handleVideoCapture} style={{ display: "none" }} />
      </footer>

      {videoPreviewUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "grid", placeItems: "center", padding: 18, zIndex: 25 }}>
          <div style={{ width: "100%", maxWidth: 460, background: panelBg, color: textPrimary, borderRadius: 18, padding: 16, boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
            <video src={videoPreviewUrl} controls playsInline style={{ width: "100%", maxHeight: "58dvh", borderRadius: 14, background: "#000", display: "block", marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={cancelVideoPreview} style={{ height: 52, border: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, fontSize: 16, fontWeight: 700 }}>{labels.cancel}</button>
              <button onClick={sendVideoPreview} style={{ height: 52, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800 }}>{labels.send}</button>
            </div>
          </div>
        </div>
      )}

      {audioPreviewUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", display: "grid", placeItems: "center", padding: 18, zIndex: 25 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
            <audio src={audioPreviewUrl} controls style={{ width: "100%", marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={cancelAudioPreview} style={{ height: 52, border: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, fontSize: 16, fontWeight: 700 }}>{labels.cancel}</button>
              <button onClick={sendAudioPreview} style={{ height: 52, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800 }}>{labels.send}</button>
            </div>
          </div>
        </div>
      )}

      {quickRepliesOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 20 }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>{labels.quickReplies}</strong>
              <button onClick={() => setQuickRepliesOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {quickReplies.map((reply, index) => (
                <div key={`${reply}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => { setText(reply); setQuickRepliesOpen(false); }} style={{ flex: 1, border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16 }}>{reply}</button>
                  <button onClick={() => { setReplyDraft(reply); setEditingReplyIndex(index); }} style={{ border: "none", background: "#d4eaff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }}>{labels.edit}</button>
                </div>
              ))}
            </div>
            <input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder={labels.createQuickReply} style={{ width: "100%", height: 48, border: "1px solid rgba(0,0,0,0.12)", outline: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, padding: "0 14px", fontSize: 16, marginBottom: 10 }} />
            <button onClick={saveQuickReply} style={{ width: "100%", height: 48, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 700 }}>{editingReplyIndex === null ? labels.saveReply : labels.saveChanges}</button>
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
