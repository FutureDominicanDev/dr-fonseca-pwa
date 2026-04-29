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
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [officePhones, setOfficePhones] = useState({ Guadalajara: "", Tijuana: "" });
  const [fileAccept, setFileAccept] = useState("*");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadFile(file, "audio");
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

  if (!accessReady) {
    return (
      <main style={{ height: "100dvh", display: "grid", placeItems: "center", background: "#ece5dd", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", padding: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(7,94,84,0.18)", borderTopColor: "#075e54", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#ece5dd", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden" }}>
        <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={160} height={44} priority style={{ width: 160, height: 44, objectFit: "contain" }} />
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
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#ece5dd", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden" }}>
      <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={160} height={44} priority style={{ width: 160, height: 44, objectFit: "contain" }} />
      </header>

      <section style={{ flex: 1, overflowY: "auto", padding: "14px 10px 18px" }} onClick={() => setMenuOpen(false)}>
        {messages.map((message) => {
          const mine = message.sender_type !== "staff";
          return (
            <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{ maxWidth: "78%", background: mine ? "#dcf8c6" : "#fff", borderRadius: mine ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.12)", fontSize: 15, lineHeight: 1.45 }}>
                {renderMessage(message)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </section>

      <footer style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px calc(8px + env(safe-area-inset-bottom))", background: "#f0f0f0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(58px + env(safe-area-inset-bottom))", left: 10, width: 220, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5 }}>
            <button onClick={() => openPicker("image/*")} style={menuButtonStyle}>Photos</button>
            <button onClick={() => openPicker("video/*")} style={menuButtonStyle}>Video</button>
            <button onClick={() => openPicker("*")} style={menuButtonStyle}>Documents</button>
            <button onClick={() => setMenuOpen(false)} style={menuButtonStyle}>Quick Replies</button>
            <button onClick={() => setMenuOpen(false)} style={{ ...menuButtonStyle, borderBottom: "none" }}>Settings</button>
          </div>
        )}

        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#ddd", color: menuOpen ? "#fff" : "#111", fontSize: 26, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
        </button>

        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) sendText(); }} placeholder="Message" style={{ minWidth: 0, flex: 1, height: 40, border: "none", outline: "none", borderRadius: 22, background: "#fff", padding: "0 14px", fontSize: 15 }} />

        <button onClick={() => openPicker("image/*")} aria-label="Camera" style={roundButtonStyle}>📷</button>

        <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={(event) => { event.preventDefault(); startRecording(); }} onTouchEnd={(event) => { event.preventDefault(); stopRecording(); }} aria-label="Hold to record audio" style={{ ...roundButtonStyle, background: recording ? "#ff3b30" : "transparent", color: recording ? "#fff" : "#111" }}>🎤</button>

        <button onClick={sendText} aria-label="Send" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#075e54", color: "#fff", fontSize: 18, display: "grid", placeItems: "center", flexShrink: 0 }}>➤</button>

        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
      </footer>
    </main>
  );
}

const roundButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  fontSize: 20,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const menuButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  border: "none",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  background: "#fff",
  color: "#111",
  textAlign: "left",
  fontSize: 15,
  fontWeight: 700,
};
