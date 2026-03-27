"use client";
import { useEffect, useState, useRef, use } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PatientPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [fontSize] = useState(15);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSending = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetchRoom();
    const ch = supabase.channel("patient-rt-" + roomId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, ({ new: m }) => {
        setMessages(prev => {
          const ti = prev.findIndex(x => typeof x.id === "string" && x.id.startsWith("temp-") && x.content === m.content && x.sender_type === m.sender_type);
          if (ti !== -1) { const u = [...prev]; u[ti] = m; return u; }
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, ({ new: m }) => {
        setMessages(p => p.map(x => x.id === m.id ? m : x));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const fetchRoom = async () => {
    const { data: rm, error } = await supabase.from("rooms")
      .select("*, procedures(procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, profile_picture_url))")
      .eq("id", roomId).single();
    if (error || !rm) { setNotFound(true); setLoading(false); return; }
    setRoom(rm);
    setPatientName(rm.procedures?.patients?.full_name || "Paciente");
    const { data: msgs } = await supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
    setMessages(msgs || []);
    setLoading(false);
  };

  const sendMessage = async (content?: string) => {
    const msg = (content || newMessage).trim();
    if (!msg || isSending.current) return;
    isSending.current = true; setSending(true);
    if (!content) setNewMessage("");
    const tempId = "temp-" + Date.now();
    setMessages(p => [...p, { id: tempId, room_id: roomId, content: msg, message_type: "text", sender_type: "patient", sender_name: patientName, created_at: new Date().toISOString() }]);
    const { data: nm, error } = await supabase.from("messages").insert({ room_id: roomId, content: msg, message_type: "text", sender_type: "patient", sender_name: patientName }).select().single();
    if (error) setMessages(p => p.filter(m => m.id !== tempId));
    else if (nm) setMessages(p => p.map(m => m.id === tempId ? nm : m));
    isSending.current = false; setSending(false);
  };

  const uploadFile = async (file: File) => {
    setSending(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const fn = `${roomId}/patient-${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("chat-files").upload(fn, file, { upsert: true });
      if (ue) { setSending(false); return; }
      const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn);
      let mt = "file";
      if (file.type.startsWith("image/")) mt = "image";
      else if (file.type.startsWith("video/")) mt = "video";
      const tempId = "temp-file-" + Date.now();
      setMessages(p => [...p, { id: tempId, room_id: roomId, content: ud.publicUrl, message_type: mt, file_name: file.name, file_size: file.size, sender_type: "patient", sender_name: patientName, created_at: new Date().toISOString() }]);
      const { data: nm } = await supabase.from("messages").insert({ room_id: roomId, content: ud.publicUrl, message_type: mt, file_name: file.name, file_size: file.size, sender_type: "patient", sender_name: patientName }).select().single();
      if (nm) setMessages(p => p.map(m => m.id === tempId ? nm : m));
      else setMessages(p => p.filter(m => m.id !== tempId));
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() : "P";
  const fmtTime = (ts: string) => { if (!ts) return ""; const d = new Date(ts), diff = Date.now() - d.getTime(); return diff < 86400000 ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-MX", { month: "short", day: "numeric" }); };
  const fmtSize = (b: number) => !b ? "" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";

  const renderMsg = (msg: any) => {
    const isOut = msg.sender_type === "patient";
    if (msg.deleted_by_staff || msg.deleted_by_patient) return null;
    const isTemp = typeof msg.id === "string" && msg.id.startsWith("temp-");
    const outB: React.CSSProperties = { background: "#007AFF", color: "white", borderRadius: "20px 20px 4px 20px", opacity: isTemp ? 0.7 : 1 };
    const inB: React.CSSProperties = { background: "white", color: "#1C1C1E", borderRadius: "20px 20px 20px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" };
    const B = isOut ? outB : inB;
    return (
      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start", gap: 2 }}>
        {!isOut && <div style={{ fontSize: 10, fontWeight: 700, color: "#007AFF", paddingLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Equipo Dr. Fonseca</div>}
        {msg.message_type === "image" ? (
          <div style={{ ...B, maxWidth: "78%", padding: 5 }}>
            <img src={msg.content} alt="" style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} />
            <div style={{ fontSize: 11, opacity: 0.7, padding: "4px 6px 2px", textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : msg.message_type === "video" ? (
          <div style={{ ...B, maxWidth: "78%", padding: 5 }}>
            <video src={msg.content} controls style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} />
            <div style={{ fontSize: 11, opacity: 0.7, padding: "4px 6px 2px", textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : msg.message_type === "audio" ? (
          <div style={{ ...B, minWidth: 200, maxWidth: "78%", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 18 }}>🎤</span><span style={{ fontSize: 13, fontWeight: 700 }}>Mensaje de voz</span></div>
            <audio src={msg.content} controls style={{ width: "100%" }} />
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : msg.message_type === "file" ? (
          <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{ ...B, maxWidth: "78%", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>{msg.file_name || "Archivo"}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{fmtSize(msg.file_size)}</div></div>
          </a>
        ) : (
          <div style={{ ...B, maxWidth: "78%", padding: "12px 16px", lineHeight: 1.5, wordBreak: "break-word", fontSize }}>
            {msg.content}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}{isTemp ? " ✓" : ""}</div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F2F2F7", gap: 16 }}>
      <img src="/fonseca_blue.png" style={{ height: 48, opacity: 0.8 }} alt="Dr. Fonseca" />
      <div style={{ width: 28, height: 28, border: "3px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F2F2F7", gap: 16, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 56 }}>🔒</div>
      <p style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E" }}>Enlace no válido</p>
      <p style={{ fontSize: 15, color: "#8E8E93", maxWidth: 280, lineHeight: 1.6 }}>Este enlace no existe o ha expirado. Contacte al consultorio del Dr. Fonseca.</p>
    </div>
  );

  const pt = room?.procedures?.patients;
  const pr = room?.procedures;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #F2F2F7; color: #1C1C1E; -webkit-font-smoothing: antialiased; }
        .patient-shell { display: flex; flex-direction: column; height: 100dvh; max-width: 640px; margin: 0 auto; }
        .p-topbar { flex-shrink: 0; background: rgba(28,28,30,0.97); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
        .p-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; }
        .p-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #F2F2F7; }
        .p-msgs::-webkit-scrollbar { display: none; }
        .p-input-bar { flex-shrink: 0; background: rgba(255,255,255,0.97); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.06); padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
        .p-input { flex: 1; padding: 10px 14px; background: #F2F2F7; border: none; border-radius: 22px; font-size: 15px; font-family: inherit; color: #1C1C1E; outline: none; font-weight: 500; transition: all 0.15s; }
        .p-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.15); }
        .p-input::placeholder { color: #8E8E93; }
        .p-send { width: 38px; height: 38px; border-radius: 50%; background: #007AFF; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,122,255,0.3); transition: all 0.12s; }
        .p-send:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
        .p-send:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.05); }
        .p-icon-btn { width: 38px; height: 38px; border-radius: 50%; background: #F2F2F7; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 18px; transition: background 0.12s; }
        .p-icon-btn:hover { background: #E5E5EA; }
        .p-safe-area { flex-shrink: 0; height: env(safe-area-inset-bottom, 0px); background: rgba(255,255,255,0.97); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />

      <div className="patient-shell">
        <div className="p-topbar">
          <img src="/fonseca_blue.png" style={{ height: 36, width: "auto", objectFit: "contain" }} alt="Dr. Fonseca" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr?.procedure_name || "Portal del Paciente"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>📍 {pr?.office_location || "Dr. Fonseca"} · Dr. Miguel Fonseca</p>
          </div>
          <div className="p-avatar">
            {pt?.profile_picture_url ? <img src={pt.profile_picture_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : ini(patientName)}
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>👋</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "white", margin: "0 0 2px" }}>¡Hola, {patientName.split(" ")[0]}!</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0 }}>Aquí puedes comunicarte directamente con el equipo del Dr. Fonseca.</p>
          </div>
        </div>

        <div className="p-msgs">
          {messages.filter(m => !m.deleted_by_staff && !m.deleted_by_patient).length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "60px 20px", textAlign: "center", color: "#8E8E93" }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>💬</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>Sin mensajes aún</p>
              <p style={{ fontSize: 14, maxWidth: 240, lineHeight: 1.6 }}>Escribe un mensaje para comenzar a comunicarte con el equipo del Dr. Fonseca.</p>
            </div>
          )}
          {messages.map(renderMsg)}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-input-bar">
          <button className="p-icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
          <input
            className="p-input"
            placeholder="Escribe un mensaje…"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button className="p-send" onClick={() => sendMessage()} disabled={sending || !newMessage.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="p-safe-area" />
      </div>
    </>
  );
}