"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type Message = {
  id: string;
  content: string;
  sender_type: "patient" | "staff";
  message_type: "text" | "image" | "audio" | "file" | "video";
  file_url?: string;
  file_name?: string;
  created_at: string;
};

type QuickReply = { shortcut: string; message: string };

export default function PatientPage({ params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrShortcut, setQrShortcut] = useState("");
  const [qrMessage, setQrMessage] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isSending = useRef(false);

  const bg = darkMode ? "#111" : "#ECE5DD";
  const headerBg = darkMode ? "#1C1C1E" : "#ffffff";
  const headerBorder = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const inputBarBg = darkMode ? "#1C1C1E" : "#f0f0f0";
  const inputBg = darkMode ? "#2C2C2E" : "#ffffff";
  const textColor = darkMode ? "#fff" : "#111";
  const subText = darkMode ? "#aaa" : "#555";
  const menuBg = darkMode ? "#2C2C2E" : "#ffffff";
  const menuBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const panelBg = darkMode ? "#1C1C1E" : "#ffffff";

  useEffect(() => {
    (async () => {
      try {
        const { data: roomData, error: roomErr } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", roomId)
          .single();
        if (roomErr || !roomData) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRoom(roomData);
        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true });
        setMessages(msgs || []);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setNotFound(true);
        setLoading(false);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    const ch = supabase.channel("patient-" + roomId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: "room_id=eq." + roomId
      }, ({ new: m }: any) => {
        setMessages(prev => {
          if (prev.some((x: any) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem("patient-qr-" + roomId);
    if (saved) setQuickReplies(JSON.parse(saved));
  }, [roomId]);

  const saveQR = (list: QuickReply[]) => {
    setQuickReplies(list);
    localStorage.setItem("patient-qr-" + roomId, JSON.stringify(list));
  };

  const sendText = useCallback(async (content: string) => {
    if (!content.trim() || isSending.current) return;
    isSending.current = true;
    setText("");
    setShowSlash(false);
    await supabase.from("messages").insert({
      room_id: roomId,
      content,
      sender_type: "patient",
      message_type: "text",
    });
    isSending.current = false;
  }, [roomId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(text); }
  };

  const handleInput = (val: string) => {
    setText(val);
    if (val.startsWith("/")) {
      setShowSlash(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlash(false);
    }
  };

  const openPicker = (accept: string) => {
    if (!fileRef.cu
cat > src/app/patient/\[roomId\]/page.tsx << 'EOF'
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type Message = {
  id: string;
  content: string;
  sender_type: "patient" | "staff";
  message_type: "text" | "image" | "audio" | "file" | "video";
  file_url?: string;
  file_name?: string;
  created_at: string;
};

type QuickReply = { shortcut: string; message: string };

export default function PatientPage({ params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrShortcut, setQrShortcut] = useState("");
  const [qrMessage, setQrMessage] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isSending = useRef(false);

  const bg = darkMode ? "#111" : "#ECE5DD";
  const headerBg = darkMode ? "#1C1C1E" : "#ffffff";
  const headerBorder = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const inputBarBg = darkMode ? "#1C1C1E" : "#f0f0f0";
  const inputBg = darkMode ? "#2C2C2E" : "#ffffff";
  const textColor = darkMode ? "#fff" : "#111";
  const subText = darkMode ? "#aaa" : "#555";
  const menuBg = darkMode ? "#2C2C2E" : "#ffffff";
  const menuBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const panelBg = darkMode ? "#1C1C1E" : "#ffffff";

  useEffect(() => {
    (async () => {
      try {
        const { data: roomData, error: roomErr } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", roomId)
          .single();
        if (roomErr || !roomData) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRoom(roomData);
        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true });
        setMessages(msgs || []);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setNotFound(true);
        setLoading(false);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    const ch = supabase.channel("patient-" + roomId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: "room_id=eq." + roomId
      }, ({ new: m }: any) => {
        setMessages(prev => {
          if (prev.some((x: any) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem("patient-qr-" + roomId);
    if (saved) setQuickReplies(JSON.parse(saved));
  }, [roomId]);

  const saveQR = (list: QuickReply[]) => {
    setQuickReplies(list);
    localStorage.setItem("patient-qr-" + roomId, JSON.stringify(list));
  };

  const sendText = useCallback(async (content: string) => {
    if (!content.trim() || isSending.current) return;
    isSending.current = true;
    setText("");
    setShowSlash(false);
    await supabase.from("messages").insert({
      room_id: roomId,
      content,
      sender_type: "patient",
      message_type: "text",
    });
    isSending.current = false;
  }, [roomId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(text); }
  };

  const handleInput = (val: string) => {
    setText(val);
    if (val.startsWith("/")) {
      setShowSlash(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlash(false);
    }
  };

  const openPicker = (accept: string) => {
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.click();
    setMenuOpen(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = "patient/" + roomId + "/" + Date.now() + "-" + file.name;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file);
    if (upErr) { alert("Error subiendo archivo"); return; }
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    const url = urlData.publicUrl;
    const type = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : "file";
    await supabase.from("messages").insert({
      room_id: roomId,
      content: url,
      sender_type: "patient",
      message_type: type,
      file_url: url,
      file_name: file.name,
    });
    e.target.value = "";
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const path = "patient/" + roomId + "/audio-" + Date.now() + ".webm";
        await supabase.storage.from("chat-files").upload(path, blob);
        const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
        await supabase.from("messages").insert({
          room_id: roomId,
          content: urlData.publicUrl,
          sender_type: "patient",
          message_type: "audio",
          file_url: urlData.publicUrl,
        });
        stream.getTracks().forEach((t: any) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err) { alert("No se pudo acceder al microfono"); }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  const filteredQR = quickReplies.filter((q: QuickReply) =>
    q.shortcut.toLowerCase().includes(slashFilter) ||
    q.message.toLowerCase().includes(slashFilter)
  );

  if (notFound) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#f5f5f5", padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>🔗</div>
      <h2 style={{ marginTop: 16, color: "#333" }}>Enlace no valido</h2>
      <p style={{ color: "#666", marginTop: 8 }}>Este enlace no existe o ha expirado.</p>
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#ECE5DD" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #ccc", borderTopColor: "#075E54", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: bg, fontSize, color: textColor, fontFamily: "Segoe UI, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ background: headerBg, borderBottom: "1px solid " + headerBorder, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 16px", flexShrink: 0, zIndex: 10 }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={160} height={44} style={{ objectFit: "contain", maxHeight: 44 }} priority />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px", WebkitOverflowScrolling: "touch" }} onClick={() => { setMenuOpen(false); setShowSlash(false); }}>
        {messages.map((msg: any) => {
          const isPatient = msg.sender_type === "patient";
          const bubbleBg = isPatient ? "#DCF8C6" : "#E3F2FF";
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isPatient ? "flex-end" : "flex-start", marginBottom: 6, padding: "0 6px" }}>
              <div style={{ background: bubbleBg, color: "#111", borderRadius: isPatient ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "8px 12px", maxWidth: "75%", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>
                {msg.message_type === "text" && <p style={{ margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.content}</p>}
                {msg.message_type === "image" && <img src={msg.file_url || msg.content} alt="img" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, display: "block" }} />}
                {msg.message_type === "video" && <video src={msg.file_url || msg.content} controls style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10 }} />}
                {msg.message_type === "audio" && <audio src={msg.file_url || msg.content} controls style={{ maxWidth: "100%" }} />}
                {msg.message_type === "file" && (
                  <a href={msg.file_url || msg.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: "#075E54", textDecoration: "none" }}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <span style={{ fontSize: 13, wordBreak: "break-all" }}>{msg.file_name || "Archivo"}</span>
                  </a>
                )}
                <div style={{ fontSize: 11, color: "#888", textAlign: "right", marginTop: 4 }}>{formatTime(msg.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {showSlash && filteredQR.length > 0 && (
        <div style={{ position: "absolute", bottom: 68, left: 0, right: 0, background: panelBg, borderTop: "1px solid " + menuBorder, zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
          {filteredQR.map((qr: QuickReply, i: number) => (
            <div key={i} onClick={() => { setText(qr.message); setShowSlash(false); }} style={{ padding: "10px 16px", borderBottom: "1px solid " + menuBorder, cursor: "pointer" }}>
              <div style={{ fontSize: 12, color: "#075E54", fontWeight: 600 }}>/{qr.shortcut}</div>
              <div style={{ fontSize: 14, color: textColor, marginTop: 2 }}>{qr.message}</div>
            </div>
          ))}
        </div>
      )}
      {menuOpen && (
        <div style={{ position: "absolute", bottom: 72, left: 8, background: menuBg, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", border: "1px solid " + menuBorder, zIndex: 100, width: 220, overflow: "hidden" }}>
          {[
            { icon: "📷", label: "Camara", action: () => openPicker("image/*;capture=camera") },
            { icon: "🖼️", label: "Fotos", action: () => openPicker("image/*,video/*") },
            { icon: "📄", label: "Documento", action: () => openPicker("*") },
            { icon: "⚡", label: "Respuestas rapidas", action: () => { setShowQR(true); setMenuOpen(false); } },
            { icon: "⚙️", label: "Configuracion", action: () => { setShowSettings(true); setMenuOpen(false); } },
          ].map((item, i) => (
            <button key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: textColor, borderBottom: i < 4 ? "1px solid " + menuBorder : "none" }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ background: inputBarBg, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => setMenuOpen((o: boolean) => !o)} style={{ width: 40, height: 40, borderRadius: "50%", background: menuOpen ? "#075E54" : (darkMode ? "#3a3a3c" : "#ddd"), border: "none", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", color: menuOpen ? "#fff" : textColor, flexShrink: 0 }}>
          {menuOpen ? "✕" : "+"}
        </button>
        <input value={text} onChange={(e: any) => handleInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe un mensaje..." style={{ flex: 1, background: inputBg, border: "none", borderRadius: 22, padding: "10px 16px", fontSize, color: textColor, outline: "none" }} />
        <button onClick={() => openPicker("image/*")} style={{ width: 38, height: 38, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📷</button>
        <button onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={(e: any) => { e.preventDefault(); startRec(); }} onTouchEnd={(e: any) => { e.preventDefault(); stopRec(); }} style={{ width: 38, height: 38, borderRadius: "50%", background: recording ? "#FF3B30" : "none", border: "none", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: recording ? "#fff" : "inherit", flexShrink: 0 }}>🎤</button>
        {text.trim() && (
          <button onClick={() => sendText(text)} style={{ width: 40, height: 40, borderRadius: "50%", background: "#075E54", border: "none", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>➤</button>
        )}
      </div>
      <input type="file" ref={fileRef} style={{ display: "none" }} onChange={handleFile} />
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: panelBg, width: "100%", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", maxHeight: "80dvh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: textColor }}>⚙️ Configuracion</span>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: textColor }}>✕</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ color: textColor }}>🌙 Modo oscuro</span>
              <div onClick={() => setDarkMode((d: boolean) => !d)} style={{ width: 50, height: 28, borderRadius: 14, background: darkMode ? "#075E54" : "#ccc", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: darkMode ? 25 : 3, transition: "left 0.2s" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: textColor, marginBottom: 10 }}>🔤 Tamano de texto: {fontSize}px</div>
              <input type="range" min={13} max={20} value={fontSize} onChange={(e: any) => setFontSize(Number(e.target.value))} style={{ width: "100%", accentColor: "#075E54" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: subText }}>
                <span>Pequeno</span><span>Grande</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {showQR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: panelBg, width: "100%", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", maxHeight: "85dvh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: textColor }}>⚡ Respuestas rapidas</span>
              <button onClick={() => setShowQR(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: textColor }}>✕</button>
            </div>
            <div style={{ background: darkMode ? "#2C2C2E" : "#f5f5f5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <input value={qrShortcut} onChange={(e: any) => setQrShortcut(e.target.value)} placeholder="Atajo (ej: gracias)" style={{ width: "100%", background: inputBg, border: "1px solid " + menuBorder, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: textColor, marginBottom: 8, boxSizing: "border-box" }} />
              <textarea value={qrMessage} onChange={(e: any) => setQrMessage(e.target.value)} placeholder="Mensaje completo..." rows={3} style={{ width: "100%", background: inputBg, border: "1px solid " + menuBorder, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: textColor, resize: "none", boxSizing: "border-box" }} />
              <button onClick={() => {
                if (!qrShortcut.trim() || !qrMessage.trim()) return;
                const updated = [...quickReplies];
                if (editingIdx !== null) { updated[editingIdx] = { shortcut: qrShortcut, message: qrMessage }; setEditingIdx(null); }
                else { updated.push({ shortcut: qrShortcut, message: qrMessage }); }
                saveQR(updated); setQrShortcut(""); setQrMessage("");
              }} style={{ marginTop: 10, width: "100%", background: "#075E54", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                {editingIdx !== null ? "Guardar cambios" : "+ Agregar respuesta"}
              </button>
            </div>
            {quickReplies.map((qr: QuickReply, i: number) => (
              <div key={i} style={{ background: darkMode ? "#2C2C2E" : "#f9f9f9", borderRadius: 10, padding: "12px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#075E54", fontWeight: 700 }}>/{qr.shortcut}</div>
                  <div style={{ fontSize: 14, color: textColor, marginTop: 4 }}>{qr.message}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
                  <button onClick={() => { setQrShortcut(qr.shortcut); setQrMessage(qr.message); setEditingIdx(i); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✏️</button>
                  <button onClick={() => saveQR(quickReplies.filter((_: any, j: number) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
