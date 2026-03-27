"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavTab = "chats" | "calls" | "tools" | "settings";
type FileCategory = "general" | "medication" | "before_photo";
type InfoTab = "info" | "meds" | "before" | "uploads";

export default function InboxPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pressedMsgId, setPressedMsgId] = useState<string | null>(null);
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>("chats");
  const [fontSize, setFontSize] = useState(15);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newSurgeryDate, setNewSurgeryDate] = useState("");
  const [newBirthdate, setNewBirthdate] = useState("");
  const [newLocation, setNewLocation] = useState("Guadalajara");
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [beforePhotosFiles, setBeforePhotosFiles] = useState<File[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createdRoomLink, setCreatedRoomLink] = useState<string | null>(null);
  const [createdPatientName, setCreatedPatientName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(["¿Cómo se siente hoy?","Por favor tome su medicamento a tiempo.","Su próxima cita es mañana.","Llame al consultorio si tiene alguna duda.","¡Excelente recuperación!"]);
  const [editingReplyIndex, setEditingReplyIndex] = useState<number | null>(null);
  const [editingReplyText, setEditingReplyText] = useState("");
  const [newReplyText, setNewReplyText] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<InfoTab>("info");
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRoomRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);
  const beforePhotosRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const notifRef = useRef<string>("default");
  const isSending = useRef(false);

  const STATUS_OPTIONS = [
    { key: "scheduled", label: "📅 Programado", color: "#007AFF", bg: "#EBF5FF" },
    { key: "post_op", label: "🏥 Post-Op", color: "#AF52DE", bg: "#F4EBFF" },
    { key: "completed", label: "✅ Completado", color: "#34C759", bg: "#EDFAF1" },
    { key: "cancelled", label: "❌ Cancelado", color: "#FF3B30", bg: "#FFF0EE" },
  ];

  useEffect(() => {
    let el = document.getElementById("dfs") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "dfs"; document.head.appendChild(el); }
    el.textContent = `.fz { font-size: ${fontSize}px !important; } .msg-input { font-size: ${fontSize}px !important; }`;
  }, [fontSize]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { window.location.href = "/login"; return; }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        fetchRooms(); fetchProfile(session.user.id);
      }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("Notification" in window) Notification.requestPermission().then(p => { notifRef.current = p; });
    return () => { subscription.unsubscribe(); };
  }, []);

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (data) { setUserProfile(data); if (data.quick_replies?.length) setQuickReplies(data.quick_replies); }
  };

  const saveQR = async (replies: string[]) => {
    setQuickReplies(replies);
    if (userProfile?.id) await supabase.from("profiles").update({ quick_replies: replies }).eq("id", userProfile.id);
  };

  const pushNotif = (title: string, body: string) => {
    if (notifRef.current === "granted" && "serviceWorker" in navigator)
      navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: "/apple-touch-icon.png", vibrate: [200,100,200] } as any));
  };

  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);

  useEffect(() => {
    const ch = supabase.channel("rt-msgs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: m }) => {
        if (selectedRoomRef.current?.id === m.room_id) {
          setMessages(prev => {
            const ti = prev.findIndex(x => typeof x.id === "string" && x.id.startsWith("temp-") && x.content === m.content && x.sender_type === m.sender_type);
            if (ti !== -1) { const u = [...prev]; u[ti] = m; return u; }
            if (prev.some(x => x.id === m.id)) return prev;
            return [...prev, m];
          });
        } else if (m.sender_type === "patient") {
          setUnreadRooms(p => { const n = new Set(p); n.add(m.room_id); return n; });
          setTotalUnread(p => p + 1);
          pushNotif("Dr. Fonseca Portal", "Nuevo mensaje de un paciente");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, ({ new: m }) => {
        if (selectedRoomRef.current?.id === m.room_id) setMessages(p => p.map(x => x.id === m.id ? m : x));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { document.title = totalUnread > 0 ? `(${totalUnread}) Dr. Fonseca Portal` : "Dr. Fonseca Portal"; }, [totalUnread]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id); setMobileView("chat"); setShowPatientInfo(false);
      setUnreadRooms(p => { const n = new Set(p); const w = n.has(selectedRoom.id); n.delete(selectedRoom.id); if (w) setTotalUnread(t => Math.max(0, t - 1)); return n; });
    }
  }, [selectedRoom]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchRooms = async () => {
    const { data, error } = await supabase.from("rooms")
      .select("*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, profile_picture_url, birthdate))")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const pm: Record<string, any> = {};
      data.forEach(r => {
        const p = r.procedures?.patients;
        if (!p) return;
        if (!pm[p.id]) pm[p.id] = { ...p, rooms: [] };
        pm[p.id].rooms.push(r);
      });
      setPatients(Object.values(pm));
    }
    setLoading(false);
  };

  const fetchMessages = async (roomId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedRoom?.procedures?.id) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from("procedures").update({ status: newStatus }).eq("id", selectedRoom.procedures.id);
    if (!error) {
      const updatedRoom = { ...selectedRoom, procedures: { ...selectedRoom.procedures, status: newStatus } };
      setSelectedRoom(updatedRoom);
      setPatients(prev => prev.map(p => ({ ...p, rooms: p.rooms.map((r: any) => r.id === selectedRoom.id ? { ...r, procedures: { ...r.procedures, status: newStatus } } : r) })));
      fetchMessages(selectedRoom.id);
    }
    setUpdatingStatus(false);
    setShowStatusMenu(false);
  };

  const sendMessage = async (content?: string) => {
    const msg = (content || newMessage).trim();
    if (!msg || !selectedRoom || isSending.current) return;
    isSending.current = true; setSending(true);
    if (!content) setNewMessage("");
    setShowQuickReplies(false); setShowSlashMenu(false);
    const sName = userProfile?.display_name || userProfile?.full_name || "Staff";
    const sRole = userProfile?.role || "staff";
    const tempId = "temp-" + Date.now();
    setMessages(p => [...p, { id: tempId, room_id: selectedRoom.id, content: msg, message_type: "text", sender_type: "staff", sender_name: sName, sender_role: sRole, created_at: new Date().toISOString() }]);
    const { data: nm, error } = await supabase.from("messages").insert({ room_id: selectedRoom.id, content: msg, message_type: "text", sender_type: "staff", sender_name: sName, sender_role: sRole }).select().single();
    if (error) setMessages(p => p.filter(m => m.id !== tempId));
    else if (nm) setMessages(p => p.map(m => m.id === tempId ? nm : m));
    isSending.current = false; setSending(false);
  };

  const confirmUpload = async (cat: FileCategory) => {
    if (!pendingFile) return;
    setShowUploadMenu(false);
    await uploadFile(pendingFile, cat);
    setPendingFile(null);
  };

  const uploadFile = async (file: File, cat: FileCategory = "general") => {
    if (!selectedRoom) return; setSending(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const fn = `${selectedRoom.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("chat-files").upload(fn, file, { upsert: true });
      if (ue) { setSending(false); return; }
      const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn);
      let mt = "file";
      if (file.type.startsWith("image/")) mt = "image";
      else if (file.type.startsWith("video/")) mt = "video";
      else if (file.type.startsWith("audio/")) mt = "audio";
      const prefix = cat === "medication" ? "[MED] " : cat === "before_photo" ? "[BEFORE] " : "";
      const sName = userProfile?.display_name || userProfile?.full_name || "Staff";
      const sRole = userProfile?.role || "staff";
      const tempId = "temp-file-" + Date.now();
      setMessages(p => [...p, { id: tempId, room_id: selectedRoom.id, content: ud.publicUrl, message_type: mt, file_name: prefix + file.name, file_size: file.size, sender_type: "staff", sender_name: sName, sender_role: sRole, created_at: new Date().toISOString() }]);
      const { data: nm } = await supabase.from("messages").insert({ room_id: selectedRoom.id, content: ud.publicUrl, message_type: mt, file_name: prefix + file.name, file_size: file.size, sender_type: "staff", sender_name: sName, sender_role: sRole }).select().single();
      if (nm) setMessages(p => p.map(m => m.id === tempId ? nm : m));
      else setMessages(p => p.filter(m => m.id !== tempId));
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const createRoom = async () => {
    if (!newPatientName.trim() || !newProcedureName.trim()) { alert("Nombre del paciente y procedimiento son obligatorios."); return; }
    setCreatingRoom(true);
    try {
      const { data: pt, error: pe } = await supabase.from("patients").insert({ full_name: newPatientName.trim(), phone: newPatientPhone || null, birthdate: newBirthdate || null }).select().single();
      if (pe) throw pe;
      if (profilePicFile) {
        const fn = `patient-profiles/${pt.id}/profile.${profilePicFile.name.split(".").pop() || "jpg"}`;
        const { error: ue } = await supabase.storage.from("chat-files").upload(fn, profilePicFile, { upsert: true });
        if (!ue) { const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn); await supabase.from("patients").update({ profile_picture_url: ud.publicUrl }).eq("id", pt.id); }
      }
      const { data: pr, error: pre } = await supabase.from("procedures").insert({ patient_id: pt.id, procedure_name: newProcedureName.trim(), surgery_date: newSurgeryDate || null, office_location: newLocation, status: "scheduled" }).select().single();
      if (pre) throw pre;
      const { data: rm, error: re } = await supabase.from("rooms").insert({ procedure_id: pr.id }).select().single();
      if (re) throw re;
      for (let i = 0; i < beforePhotosFiles.length; i++) {
        const f = beforePhotosFiles[i];
        const fn = `patient-photos/${pt.id}/before/${Date.now()}-${i}.${f.name.split(".").pop() || "jpg"}`;
        const { error: ue } = await supabase.storage.from("chat-files").upload(fn, f, { upsert: true });
        if (!ue) { const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn); await supabase.from("messages").insert({ room_id: rm.id, content: ud.publicUrl, message_type: "image", file_name: `[BEFORE] Foto Pre-Op ${i + 1}`, sender_type: "staff", sender_name: "Sistema", sender_role: "staff" }); }
      }
      setCreatedRoomLink(`${window.location.origin}/patient/${rm.id}`);
      setCreatedPatientName(newPatientName);
      setNewPatientName(""); setNewPatientPhone(""); setNewProcedureName(""); setNewSurgeryDate(""); setNewBirthdate(""); setNewLocation("Guadalajara"); setProfilePicFile(null); setBeforePhotosFiles([]); setShowNewRoom(false);
      fetchRooms();
    } catch (err: any) { console.error(err); alert("Error: " + (err?.message || JSON.stringify(err))); }
    setCreatingRoom(false);
  };

  const copyLink = async () => { if (!createdRoomLink) return; await navigator.clipboard.writeText(createdRoomLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); };
  const whatsApp = () => { if (!createdRoomLink) return; window.open(`https://wa.me/?text=${encodeURIComponent(`Hola ${createdPatientName}! 👋\n\nEnlace para comunicarse con el equipo del Dr. Fonseca:\n\n${createdRoomLink}\n\nGuárdelo — es su acceso a mensajes y actualizaciones médicas. 🏥`)}`, "_blank"); };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr; audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => { const b = new Blob(audioChunksRef.current, { type: "audio/mp4" }); stream.getTracks().forEach(t => t.stop()); await uploadFile(new File([b], `voice-${Date.now()}.mp4`, { type: "audio/mp4" })); };
      mr.start(); setRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch { alert("No se pudo acceder al micrófono."); }
  };
  const stopRec = () => { if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); setRecording(false); clearInterval(recordingTimerRef.current); setRecordingSeconds(0); } };
  const fmtRec = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() : "P";
  const fmtTime = (ts: string) => { if (!ts) return ""; const d = new Date(ts), diff = Date.now() - d.getTime(); return diff < 86400000 ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-MX", { month: "short", day: "numeric" }); };
  const fmtSize = (b: number) => !b ? "" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const statusI = (s: string) => ({ scheduled: { l: "Programado", c: "#007AFF", bg: "#EBF5FF" }, completed: { l: "Completado", c: "#34C759", bg: "#EDFAF1" }, cancelled: { l: "Cancelado", c: "#FF3B30", bg: "#FFF0EE" }, post_op: { l: "Post-Op", c: "#AF52DE", bg: "#F4EBFF" } } as any)[s] || { l: "Activo", c: "#007AFF", bg: "#EBF5FF" };
  const sColor = (type: string, role: string) => type === "patient" ? "#34C759" : ({ doctor: "#007AFF", post_quirofano: "#AF52DE", enfermeria: "#00C7BE", coordinacion: "#FF9500", staff: "#636366" } as any)[role] || "#636366";

  const filtPts = patients.filter(p => { const q = searchQuery.toLowerCase(); return p.full_name?.toLowerCase().includes(q) || p.rooms.some((r: any) => r.procedures?.procedure_name?.toLowerCase().includes(q) || r.procedures?.office_location?.toLowerCase().includes(q)); });
  const slashFiltered = quickReplies.filter(r => slashFilter === "" || r.toLowerCase().includes(slashFilter.toLowerCase()));
  const medMsgs = messages.filter(m => m.file_name?.startsWith("[MED]") && !m.deleted_by_staff);
  const beforeMsgs = messages.filter(m => m.file_name?.startsWith("[BEFORE]") && !m.deleted_by_staff);
  const patientUploads = messages.filter(m => m.sender_type === "patient" && (m.message_type === "image" || m.message_type === "file") && !m.deleted_by_patient);

  const handleBack = () => { setSelectedRoom(null); setMobileView("list"); setShowPatientInfo(false); };
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const renderMsg = (msg: any) => {
    const isOut = msg.sender_type === "staff" || !msg.sender_type;
    const isTemp = typeof msg.id === "string" && msg.id.startsWith("temp-");
    const isPressed = pressedMsgId === msg.id;
    if (msg.deleted_by_staff) return null;
    const isSystem = msg.sender_name === "Sistema";
    if (isSystem) return (
      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
        <div style={{ background: "#F2F2F7", borderRadius: 99, padding: "5px 14px", fontSize: 12, color: "#8E8E93", fontWeight: 600 }}>{msg.content}</div>
      </div>
    );
    const sc = sColor(msg.sender_type || "staff", msg.sender_role || "staff");
    const sn = msg.sender_name || (isOut ? "Staff" : "Paciente");
    const outB: React.CSSProperties = { background: isTemp ? "#5A9FD4" : "#007AFF", color: "white", borderRadius: "20px 20px 4px 20px", opacity: isTemp ? 0.8 : 1 };
    const inB: React.CSSProperties = { background: "white", color: "#1C1C1E", borderRadius: "20px 20px 20px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
    const B = isOut ? outB : inB;
    const tap = (e: any) => { e.stopPropagation(); if (!isTemp) setPressedMsgId(isPressed ? null : msg.id); };
    return (
      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start", position: "relative" }}>
        {isPressed && !isTemp && (
          <div style={{ position: "absolute", top: -44, right: isOut ? 0 : "auto", left: isOut ? "auto" : 0, background: "white", borderRadius: 12, padding: "4px", zIndex: 99, boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}>
            <button onPointerDown={e => { e.stopPropagation(); if (confirm("¿Eliminar este mensaje?")) { supabase.from("messages").update({ deleted_by_staff: true, deleted_at: new Date().toISOString() }).eq("id", msg.id).then(() => { setMessages(p => p.map(m => m.id === msg.id ? { ...m, deleted_by_staff: true } : m)); setPressedMsgId(null); }); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FF3B30", border: "none", color: "white", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>🗑️ Eliminar</button>
          </div>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, color: sc, marginBottom: 3, paddingLeft: isOut ? 0 : 4, paddingRight: isOut ? 4 : 0, letterSpacing: 0.5, textTransform: "uppercase" }}>{sn}{isTemp ? " ✓" : ""}</div>
        {msg.deleted_by_patient ? (
          <div style={{ ...B, maxWidth: "70%", padding: "10px 14px", fontStyle: "italic", opacity: 0.6, fontSize: 14 }}>Mensaje eliminado<div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{fmtTime(msg.created_at)}</div></div>
        ) : msg.message_type === "image" ? (
          <div style={{ ...B, maxWidth: "72%", padding: 5, cursor: "pointer" }} onClick={tap} onTouchEnd={tap}><img src={msg.content} alt="" style={{ width: "100%", maxWidth: 260, borderRadius: 14, display: "block" }} /><div style={{ fontSize: 11, opacity: 0.7, padding: "4px 6px 2px", textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div></div>
        ) : msg.message_type === "video" ? (
          <div style={{ ...B, maxWidth: "72%", padding: 5, cursor: "pointer" }} onClick={tap} onTouchEnd={tap}><video src={msg.content} controls style={{ width: "100%", maxWidth: 260, borderRadius: 14, display: "block" }} /><div style={{ fontSize: 11, opacity: 0.7, padding: "4px 6px 2px", textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div></div>
        ) : msg.message_type === "audio" ? (
          <div style={{ ...B, minWidth: 220, maxWidth: "72%", padding: "12px 14px", cursor: "pointer" }} onClick={tap} onTouchEnd={tap}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 20 }}>🎤</span><span style={{ fontSize: 13, fontWeight: 700 }} className="fz">Voz</span></div><audio src={msg.content} controls style={{ width: "100%" }} /><div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div></div>
        ) : msg.message_type === "file" ? (
          <div style={{ ...B, maxWidth: "72%", padding: "12px 14px", cursor: "pointer" }} onClick={tap} onTouchEnd={tap}><a href={isPressed ? undefined : msg.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}><span style={{ fontSize: 26 }}>📄</span><div><div style={{ fontSize: 14, fontWeight: 700 }}>{(msg.file_name || "Archivo").replace(/^\[MED\] |\[BEFORE\] /, "")}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{fmtSize(msg.file_size)}</div></div></a><div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div></div>
        ) : (
          <div style={{ ...B, maxWidth: "72%", padding: "12px 16px", cursor: "pointer", lineHeight: 1.5, wordBreak: "break-word" }} className="fz" onClick={tap} onTouchEnd={tap}>{msg.content}<div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: isOut ? "right" : "left" }}>{fmtTime(msg.created_at)}</div></div>
        )}
      </div>
    );
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F2F2F7" }}>
      <span style={{ fontSize: 14, color: "#8E8E93", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#1C1C1E", fontWeight: 600 }}>{value || "—"}</span>
    </div>
  );

  const FileCard = ({ msg }: { msg: any }) => (
    <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, background: "white", borderRadius: 12, padding: "12px 14px", marginBottom: 8, textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <span style={{ fontSize: 28 }}>📄</span>
      <div><p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>{(msg.file_name || "Archivo").replace(/^\[MED\] |\[BEFORE\] /, "")}</p><p style={{ fontSize: 12, color: "#8E8E93", margin: "2px 0 0" }}>{fmtTime(msg.created_at)}</p></div>
    </a>
  );

  const renderPatientPanel = () => {
    const pt = selectedRoom?.procedures?.patients;
    const pr = selectedRoom?.procedures;
    if (!pt) return null;
    const currentStatus = statusI(pr?.status || "scheduled");
    return (
      <div style={{ position: "absolute", inset: 0, background: "#F2F2F7", zIndex: 25, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ background: "white", padding: "16px 20px", borderBottom: "1px solid #E5E5EA", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setShowPatientInfo(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "#F2F2F7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>{pt.full_name}</p>
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>{pr?.procedure_name} · {pr?.office_location}</p>
          </div>
        </div>
        <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E5E5EA" }}>
          {([{ id: "info", l: "ℹ️ Info" }, { id: "meds", l: `💊 Meds${medMsgs.length ? ` (${medMsgs.length})` : ""}` }, { id: "before", l: `📸 Pre-Op${beforeMsgs.length ? ` (${beforeMsgs.length})` : ""}` }, { id: "uploads", l: `🤳 Paciente${patientUploads.length ? ` (${patientUploads.length})` : ""}` }] as { id: InfoTab; l: string }[]).map(t => (
            <button key={t.id} onClick={() => setInfoTab(t.id)} style={{ flex: 1, padding: "12px 4px", border: "none", background: "transparent", fontSize: 11, fontWeight: infoTab === t.id ? 700 : 500, color: infoTab === t.id ? "#007AFF" : "#8E8E93", cursor: "pointer", borderBottom: infoTab === t.id ? "2px solid #007AFF" : "2px solid transparent" }}>
              {t.l}
            </button>
          ))}
        </div>
        <div style={{ padding: 16, flex: 1 }}>
          {infoTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "white", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#1C1C1E,#007AFF)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                  {pt.profile_picture_url ? <img src={pt.profile_picture_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : ini(pt.full_name)}
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", margin: "0 0 4px" }}>{pt.full_name}</p>
                  {pt.birthdate && <p style={{ fontSize: 13, color: "#8E8E93", margin: "0 0 2px" }}>🎂 {new Date(pt.birthdate).toLocaleDateString("es-MX")}</p>}
                  {pt.phone && <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>📱 {pt.phone}</p>}
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 16, padding: "4px 16px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 8px" }}>Procedimiento</p>
                <InfoRow label="Nombre" value={pr?.procedure_name || ""} />
                <InfoRow label="Sede" value={pr?.office_location || ""} />
                {pr?.surgery_date && <InfoRow label="Cirugía" value={new Date(pr.surgery_date).toLocaleDateString("es-MX")} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                  <span style={{ fontSize: 14, color: "#8E8E93", fontWeight: 500 }}>Estado</span>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setShowStatusMenu(p => !p)} style={{ background: currentStatus.bg, color: currentStatus.c, border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {currentStatus.l} ▾
                    </button>
                    {showStatusMenu && (
                      <div style={{ position: "absolute", right: 0, top: "110%", background: "white", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.2)", zIndex: 999, minWidth: 190, overflow: "hidden" }}>
                        {STATUS_OPTIONS.map(s => (
                          <button key={s.key} onClick={() => updateStatus(s.key)} disabled={updatingStatus} style={{ width: "100%", padding: "12px 16px", border: "none", background: selectedRoom?.procedures?.status === s.key ? s.bg : "white", color: s.color, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>{s.label}</span>
                            {selectedRoom?.procedures?.status === s.key && <span>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {infoTab === "meds" && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Medicamentos Prescritos</p>
              {medMsgs.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: "#8E8E93" }}><div style={{ fontSize: 44, marginBottom: 10 }}>💊</div><p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>Sin medicamentos aún</p><p style={{ fontSize: 13 }}>Cuando envíes un archivo marcado como "Medicamento", aparecerá aquí.</p></div>
                : medMsgs.map(m => <FileCard key={m.id} msg={m} />)}
            </div>
          )}
          {infoTab === "before" && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Fotos Pre-Operatorias</p>
              {beforeMsgs.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: "#8E8E93" }}><div style={{ fontSize: 44, marginBottom: 10 }}>📸</div><p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>Sin fotos pre-op aún</p></div>
                : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{beforeMsgs.map(m => m.message_type === "image" ? <a key={m.id} href={m.content} target="_blank" rel="noopener noreferrer"><img src={m.content} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, display: "block" }} alt="" /></a> : <FileCard key={m.id} msg={m} />)}</div>}
            </div>
          )}
          {infoTab === "uploads" && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Fotos del Paciente</p>
              {patientUploads.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: "#8E8E93" }}><div style={{ fontSize: 44, marginBottom: 10 }}>🤳</div><p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>Sin fotos del paciente aún</p></div>
                : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{patientUploads.map(m => m.message_type === "image" ? <a key={m.id} href={m.content} target="_blank" rel="noopener noreferrer"><img src={m.content} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, display: "block" }} alt="" /></a> : <FileCard key={m.id} msg={m} />)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTab = () => {
    if (activeTab === "calls") return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40 }}>
        <div style={{ fontSize: 56 }}>📞</div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E" }}>Directorio de Llamadas</p>
        <a href="tel:+16023334444" style={{ display: "flex", alignItems: "center", gap: 10, background: "#007AFF", color: "white", padding: "14px 28px", borderRadius: 14, textDecoration: "none", fontSize: 16, fontWeight: 700 }}>📱 Llamar al Consultorio</a>
      </div>
    );
    if (activeTab === "tools") return (
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", marginBottom: 4 }}>Herramientas</p>
        <p style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #E5E5EA" }}>Tus respuestas son <strong>solo tuyas</strong>. Escribe <strong style={{ color: "#007AFF" }}>/</strong> en el chat.</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>⚡ Respuestas Rápidas ({quickReplies.length})</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {quickReplies.length === 0 && <div style={{ textAlign: "center", padding: 30, background: "white", borderRadius: 12, color: "#8E8E93", fontSize: 14 }}>No tienes respuestas rápidas aún.</div>}
          {quickReplies.map((r, i) => editingReplyIndex === i ? (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input value={editingReplyText} onChange={e => setEditingReplyText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && editingReplyText.trim()) { const u = [...quickReplies]; u[i] = editingReplyText.trim(); saveQR(u); setEditingReplyIndex(null); } if (e.key === "Escape") setEditingReplyIndex(null); }} autoFocus style={{ flex: 1, padding: "12px 14px", border: "1.5px solid #007AFF", borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", color: "#1C1C1E" }} />
              <button onClick={() => { if (editingReplyText.trim()) { const u = [...quickReplies]; u[i] = editingReplyText.trim(); saveQR(u); setEditingReplyIndex(null); } }} style={{ padding: "0 16px", background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 16 }}>✓</button>
              <button onClick={() => setEditingReplyIndex(null)} style={{ padding: "0 14px", background: "#F2F2F7", color: "#1C1C1E", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          ) : (
            <div key={i} style={{ background: "white", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1C1C1E" }} className="fz">{r}</span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { if (selectedRoom) { sendMessage(r); setActiveTab("chats"); } else alert("Abre un chat primero."); }} style={{ padding: "6px 11px", background: "#007AFF", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📤</button>
                <button onClick={() => { setEditingReplyIndex(i); setEditingReplyText(r); }} style={{ padding: "6px 11px", background: "#F2F2F7", color: "#1C1C1E", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✏️</button>
                <button onClick={() => { if (confirm(`¿Eliminar?\n"${r}"`)) saveQR(quickReplies.filter((_, j) => j !== i)); }} style={{ padding: "6px 11px", background: "#FFF0EE", color: "#FF3B30", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>➕ Nueva Respuesta Rápida</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newReplyText} onChange={e => setNewReplyText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newReplyText.trim()) { saveQR([...quickReplies, newReplyText.trim()]); setNewReplyText(""); } }} placeholder="Escribe una respuesta…" style={{ flex: 1, padding: "12px 14px", border: "1.5px solid #E5E5EA", borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", color: "#1C1C1E" }} />
            <button onClick={() => { if (newReplyText.trim()) { saveQR([...quickReplies, newReplyText.trim()]); setNewReplyText(""); } }} style={{ width: 48, height: 48, background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 24, flexShrink: 0 }}>+</button>
          </div>
        </div>
      </div>
    );
    if (activeTab === "settings") return (
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", marginBottom: 20 }}>Ajustes</p>
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Tamaño de Texto</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setFontSize(f => Math.max(13, f - 1))} style={{ width: 48, height: 48, borderRadius: 12, border: "none", background: "#F2F2F7", fontSize: 18, cursor: "pointer", fontWeight: 700, color: "#1C1C1E" }}>A−</button>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E", flex: 1, textAlign: "center" }}>{fontSize}px</span>
            <button onClick={() => setFontSize(f => Math.min(24, f + 1))} style={{ width: 48, height: 48, borderRadius: 12, border: "none", background: "#F2F2F7", fontSize: 18, cursor: "pointer", fontWeight: 700, color: "#1C1C1E" }}>A+</button>
          </div>
          <p style={{ fontSize: 13, color: "#8E8E93", marginTop: 10, textAlign: "center" }}>Ejemplo: <span style={{ fontSize, color: "#1C1C1E", fontWeight: 600 }}>Texto de muestra</span></p>
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Mi Perfil</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>👤 {userProfile?.display_name || userProfile?.full_name || "Staff"}</p>
          <p style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>Rol: {userProfile?.role || "staff"}</p>
        </div>
        <button onClick={handleLogout} style={{ width: "100%", padding: "14px", background: "#FFF0EE", border: "none", borderRadius: 14, color: "#FF3B30", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🚪 Cerrar Sesión</button>
      </div>
    );
    return null;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #F2F2F7; color: #1C1C1E; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; flex-direction: column; height: 100dvh; }
        .topbar { flex-shrink: 0; height: 64px; background: rgba(28,28,30,0.97); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 100; }
        .topbar-logo { height: 48px; width: auto; display: block; object-fit: contain; }
        .status-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(255,255,255,0.08); border-radius: 99px; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #34C759; animation: pulse 2s ease infinite; }
        .status-text { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); }
        @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.4;} }
        .body { display: flex; flex: 1; overflow: hidden; }
        .sidebar { width: 320px; flex-shrink: 0; background: #FAFAFA; border-right: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; overflow: hidden; }
        .sidebar-head { padding: 16px; }
        .sidebar-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .sidebar-title { font-size: 20px; font-weight: 700; color: #1C1C1E; }
        .add-btn { width: 30px; height: 30px; border-radius: 50%; background: #007AFF; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,122,255,0.3); }
        .count-pill { background: #007AFF; color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
        .search-wrap { position: relative; }
        .search-input { width: 100%; padding: 9px 12px 9px 32px; background: rgba(116,116,128,0.12); border: none; border-radius: 10px; font-size: 15px; font-family: inherit; color: #1C1C1E; outline: none; }
        .search-input::placeholder { color: #8E8E93; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #8E8E93; font-size: 14px; pointer-events: none; }
        .room-list { flex: 1; overflow-y: auto; }
        .room-list::-webkit-scrollbar { display: none; }
        .patient-item { border-bottom: 1px solid rgba(0,0,0,0.04); }
        .patient-row { padding: 10px 14px; display: flex; gap: 11px; cursor: pointer; align-items: center; transition: background 0.1s; }
        .patient-row:hover { background: rgba(0,0,0,0.03); }
        .avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; position: relative; overflow: hidden; }
        .avatar-badge { position: absolute; top: 0; right: 0; width: 12px; height: 12px; background: #FF3B30; border-radius: 50%; border: 2px solid white; }
        .patient-name { font-size: 15px; font-weight: 700; color: #1C1C1E; }
        .patient-meta { font-size: 12px; color: #8E8E93; font-weight: 500; margin-top: 1px; }
        .chevron { font-size: 9px; color: #C7C7CC; transition: transform 0.2s; flex-shrink: 0; }
        .chevron.open { transform: rotate(90deg); }
        .procedures-list { background: #F2F2F7; }
        .proc-item { padding: 10px 14px 10px 68px; cursor: pointer; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid rgba(0,0,0,0.04); transition: background 0.1s; }
        .proc-item:hover { background: rgba(0,122,255,0.05); }
        .proc-item.active { background: rgba(0,122,255,0.08); }
        .proc-dot { width: 6px; height: 6px; border-radius: 50%; background: #C7C7CC; flex-shrink: 0; }
        .proc-dot.unread { background: #FF3B30; }
        .proc-name { font-size: 13px; font-weight: 700; color: #1C1C1E; }
        .proc-loc { font-size: 11px; color: #8E8E93; font-weight: 500; margin-top: 1px; }
        .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
        .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #F2F2F7; position: relative; }
        .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; }
        .welcome-icon { width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,122,255,0.25); animation: floatIcon 4s ease-in-out infinite; }
        @keyframes floatIcon { 0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);} }
        .chat-head { flex-shrink: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(0,0,0,0.06); padding: 10px 16px; display: flex; align-items: center; gap: 10px; position: relative; z-index: 50; overflow: visible; }
        .back-btn { display: none; width: 32px; height: 32px; border-radius: 50%; background: #F2F2F7; border: none; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .chat-av { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; cursor: pointer; transition: opacity 0.15s; }
        .chat-av:hover { opacity: 0.8; }
        .chat-head-name { font-size: 16px; font-weight: 700; color: #1C1C1E; }
        .chat-head-meta { font-size: 12px; color: #8E8E93; font-weight: 500; }
        .info-btn { padding: 6px 12px; background: #F2F2F7; border: none; border-radius: 20px; font-size: 12px; font-weight: 600; color: #007AFF; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }
        .info-btn:hover { background: #E5E5EA; }
        .status-badge-btn { padding: 5px 10px; border: none; border-radius: 99px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; transition: all 0.15s; }
        .status-badge-btn:hover { opacity: 0.85; transform: scale(1.03); }
        .msgs { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .msgs::-webkit-scrollbar { display: none; }
        .chat-bottom { flex-shrink: 0; display: flex; flex-direction: column; }
        .popup-tray { background: rgba(255,255,255,0.97); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.06); border-radius: 16px 16px 0 0; padding: 8px; max-height: 220px; overflow-y: auto; box-shadow: 0 -8px 30px rgba(0,0,0,0.08); }
        .popup-header { font-size: 11px; font-weight: 700; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 10px 8px; }
        .popup-item { padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; color: #1C1C1E; transition: background 0.1s; }
        .popup-item:hover { background: #F2F2F7; }
        .input-bar { background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.06); padding: 10px 12px; display: flex; align-items: center; gap: 7px; }
        .recording-bar { background: white; border-top: 1px solid rgba(0,0,0,0.06); padding: 10px 12px; display: flex; align-items: center; gap: 12px; }
        .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF3B30; animation: recP 1s ease infinite; flex-shrink: 0; }
        @keyframes recP { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(1.3);} }
        .rec-timer { font-size: 17px; font-weight: 700; color: #FF3B30; font-family: monospace; flex: 1; }
        .icon-btn { width: 36px; height: 36px; border-radius: 50%; background: #F2F2F7; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.12s; font-size: 16px; }
        .icon-btn:hover { background: #E5E5EA; }
        .icon-btn.active { background: #007AFF; }
        .msg-input { flex: 1; padding: 9px 14px; background: #F2F2F7; border: none; border-radius: 20px; font-size: 15px; font-family: inherit; color: #1C1C1E; outline: none; min-width: 0; font-weight: 500; transition: all 0.15s; }
        .msg-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.15); }
        .msg-input::placeholder { color: #8E8E93; }
        .send-btn { width: 36px; height: 36px; border-radius: 50%; background: #007AFF; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,122,255,0.3); transition: all 0.12s; }
        .send-btn:hover { filter: brightness(1.1); transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }
        .bottom-nav { flex-shrink: 0; height: 58px; background: rgba(28,28,30,0.97); backdrop-filter: blur(20px); display: flex; border-top: 1px solid rgba(255,255,255,0.06); }
        .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.35); transition: color 0.15s; position: relative; }
        .nav-btn.active { color: white; }
        .nav-btn svg { width: 22px; height: 22px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.2px; }
        .nav-unread { position: absolute; top: 6px; right: calc(50% - 18px); background: #FF3B30; color: white; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 99px; min-width: 16px; text-align: center; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(6px); }
        .modal { background: white; border-radius: 20px 20px 0 0; padding: 24px 20px 32px; width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto; }
        .modal-title { font-size: 20px; font-weight: 700; color: #1C1C1E; margin-bottom: 20px; }
        .form-label { font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
        .form-input { width: 100%; padding: 12px 14px; background: #F2F2F7; border: none; border-radius: 12px; font-size: 15px; font-family: inherit; color: #1C1C1E; outline: none; margin-bottom: 14px; font-weight: 500; transition: all 0.15s; }
        .form-input:focus { background: white; box-shadow: 0 0 0 2px rgba(0,122,255,0.2); }
        .form-input::placeholder { color: #8E8E93; }
        .btn-primary { width: 100%; padding: 15px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-secondary { width: 100%; padding: 13px; background: #F2F2F7; border: none; border-radius: 14px; color: #1C1C1E; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .radio-group { display: flex; gap: 10px; margin-bottom: 14px; }
        .radio-option { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; color: #8E8E93; background: #F2F2F7; transition: all 0.15s; border: 2px solid transparent; }
        .radio-option.selected { background: #EBF5FF; color: #007AFF; border-color: #007AFF; }
        .file-box { width: 100%; padding: 18px; border: 1.5px dashed #C7C7CC; border-radius: 12px; cursor: pointer; text-align: center; font-size: 14px; font-weight: 600; color: #8E8E93; margin-bottom: 14px; transition: all 0.15s; }
        .file-box:hover { border-color: #007AFF; color: #007AFF; background: #F0F7FF; }
        .file-thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; }
        .file-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .spinner { width: 20px; height: 20px; border: 2px solid #E5E5EA; border-top-color: #007AFF; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .body { position: relative; }
          .sidebar { position: absolute; inset: 0; z-index: 10; width: 100%; border-right: none; transition: transform 0.25s ease; }
          .main-area { position: absolute; inset: 0; z-index: 20; width: 100%; transition: transform 0.25s ease; }
          .sidebar.hidden-mobile { transform: translateX(-100%); pointer-events: none; }
          .main-area.hidden-mobile { transform: translateX(100%); pointer-events: none; }
          .back-btn { display: flex !important; }
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setShowUploadMenu(true); } e.target.value = ""; }} />

      {showUploadMenu && pendingFile && (
        <div className="modal-overlay" onClick={() => { setShowUploadMenu(false); setPendingFile(null); }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", marginBottom: 6 }}>¿Cómo clasificar este archivo?</p>
            <p style={{ fontSize: 13, color: "#8E8E93", marginBottom: 18 }}>{pendingFile.name}</p>
            {([{ c: "general" as FileCategory, icon: "💬", label: "General", sub: "Solo aparece en el chat" }, { c: "medication" as FileCategory, icon: "💊", label: "Medicamento", sub: "Se guarda en carpeta de Meds del paciente" }, { c: "before_photo" as FileCategory, icon: "📸", label: "Foto Pre-Op", sub: "Se guarda en carpeta Pre-Op del paciente" }]).map(opt => (
              <button key={opt.c} onClick={() => confirmUpload(opt.c)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#FAFAFA", border: "1px solid #E5E5EA", borderRadius: 14, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 30 }}>{opt.icon}</span>
                <div><p style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>{opt.label}</p><p style={{ fontSize: 12, color: "#8E8E93", margin: 0 }}>{opt.sub}</p></div>
              </button>
            ))}
            <button onClick={() => { setShowUploadMenu(false); setPendingFile(null); }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {showNewRoom && (
        <div className="modal-overlay" onClick={() => setShowNewRoom(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">➕ Nuevo Cuarto de Paciente</p>
            <label className="form-label">Nombre del Paciente *</label>
            <input className="form-input" placeholder="Ej: María González" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
            <label className="form-label">Teléfono (WhatsApp)</label>
            <input className="form-input" placeholder="+52 (33) 555-0000" value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} />
            <label className="form-label">Fecha de Nacimiento</label>
            <input className="form-input" type="date" value={newBirthdate} onChange={e => setNewBirthdate(e.target.value)} />
            <label className="form-label">Procedimiento *</label>
            <input className="form-input" placeholder="Ej: Rinoplastia, Lipo 360…" value={newProcedureName} onChange={e => setNewProcedureName(e.target.value)} />
            <label className="form-label">Fecha de Cirugía</label>
            <input className="form-input" type="date" value={newSurgeryDate} onChange={e => setNewSurgeryDate(e.target.value)} />
            <label className="form-label">Sede *</label>
            <div className="radio-group">
              <div className={`radio-option${newLocation === "Guadalajara" ? " selected" : ""}`} onClick={() => setNewLocation("Guadalajara")}>🏙️ Guadalajara</div>
              <div className={`radio-option${newLocation === "Tijuana" ? " selected" : ""}`} onClick={() => setNewLocation("Tijuana")}>🌊 Tijuana</div>
            </div>
            <label className="form-label">📸 Foto de Perfil del Paciente</label>
            <input ref={profilePicRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setProfilePicFile(f); }} />
            <div className="file-box" onClick={() => profilePicRef.current?.click()}>
              {profilePicFile ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><img src={URL.createObjectURL(profilePicFile)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} /><span style={{ fontSize: 13 }}>{profilePicFile.name}</span></div> : <>👤 Toca para subir foto de perfil</>}
            </div>
            <label className="form-label">📷 Fotos Pre-Op</label>
            <input ref={beforePhotosRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => setBeforePhotosFiles(p => [...p, ...Array.from(e.target.files || [])])} />
            {beforePhotosFiles.length > 0 && <div className="file-preview">{beforePhotosFiles.map((f, i) => <img key={i} src={URL.createObjectURL(f)} className="file-thumb" alt="" />)}</div>}
            <div className="file-box" onClick={() => beforePhotosRef.current?.click()}>
              {beforePhotosFiles.length === 0 ? <>📷 Toca para subir fotos pre-op</> : <>📷 {beforePhotosFiles.length} foto(s) — toca para agregar más</>}
            </div>
            <button className="btn-primary" onClick={createRoom} disabled={creatingRoom}>{creatingRoom ? "Creando cuarto…" : "✅ Crear Cuarto del Paciente"}</button>
            <button className="btn-secondary" onClick={() => setShowNewRoom(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {createdRoomLink && (
        <div className="modal-overlay" onClick={() => setCreatedRoomLink(null)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "28px 20px 36px", width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E", marginBottom: 6 }}>¡Cuarto creado!</p>
              <p style={{ fontSize: 15, color: "#8E8E93" }}>Comparte este enlace con <strong style={{ color: "#1C1C1E" }}>{createdPatientName}</strong></p>
            </div>
            <div style={{ background: "#F2F2F7", borderRadius: 12, padding: "12px 14px", marginBottom: 16, wordBreak: "break-all", fontSize: 13, color: "#007AFF", fontWeight: 500 }}>{createdRoomLink}</div>
            <button onClick={copyLink} style={{ width: "100%", padding: 14, background: linkCopied ? "#34C759" : "#007AFF", border: "none", borderRadius: 14, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, transition: "background 0.2s" }}>{linkCopied ? "✅ ¡Copiado!" : "📋 Copiar Enlace"}</button>
            <button onClick={whatsApp} style={{ width: "100%", padding: 14, background: "#25D366", border: "none", borderRadius: 14, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>💬 Enviar por WhatsApp</button>
            <button onClick={() => setCreatedRoomLink(null)} className="btn-secondary">Listo</button>
          </div>
        </div>
      )}

      <div className="shell" onClick={() => { setPressedMsgId(null); setShowQuickReplies(false); setShowSlashMenu(false); setSlashFilter(""); setShowStatusMenu(false); }}>
        <div className="topbar">
          <img src="/fonseca_blue.png" className="topbar-logo" alt="Dr. Fonseca" />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {totalUnread > 0 && <div style={{ background: "#FF3B30", color: "white", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{totalUnread}</div>}
            <div className="status-pill"><div className="status-dot" /><span className="status-text">En línea</span></div>
          </div>
        </div>

        <div className="body">
          <div className={`sidebar${mobileView === "chat" ? " hidden-mobile" : ""}`}>
            <div className="sidebar-head">
              <div className="sidebar-title-row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="sidebar-title">Pacientes</span>
                  {patients.length > 0 && <span className="count-pill">{patients.length}</span>}
                </div>
                <button className="add-btn" onClick={() => setShowNewRoom(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
              </div>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder="Buscar paciente o procedimiento…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="room-list">
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><div className="spinner" /></div>
              ) : filtPts.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#8E8E93" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🏥</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>Sin pacientes aún</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Toca + para crear el primer cuarto</p>
                </div>
              ) : filtPts.map(pt => {
                const isExp = expandedPatient === pt.id;
                const ptUnread = pt.rooms.some((r: any) => unreadRooms.has(r.id));
                return (
                  <div className="patient-item" key={pt.id}>
                    <div className="patient-row" onClick={() => { setExpandedPatient(isExp ? null : pt.id); if (pt.rooms.length === 1) setSelectedRoom(pt.rooms[0]); }}>
                      <div className="avatar">
                        {pt.profile_picture_url ? <img src={pt.profile_picture_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : ini(pt.full_name)}
                        {ptUnread && <div className="avatar-badge" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="patient-name">{pt.full_name}</div>
                        <div className="patient-meta">{pt.rooms.length} procedimiento{pt.rooms.length !== 1 ? "s" : ""}</div>
                      </div>
                      <span className={`chevron${isExp ? " open" : ""}`}>▶</span>
                    </div>
                    {isExp && (
                      <div className="procedures-list">
                        {pt.rooms.map((r: any) => {
                          const st = statusI(r.procedures?.status || "scheduled");
                          const isAct = selectedRoom?.id === r.id;
                          const hasUnread = unreadRooms.has(r.id);
                          return (
                            <div key={r.id} className={`proc-item${isAct ? " active" : ""}`} onClick={() => setSelectedRoom(r)}>
                              <div className={`proc-dot${hasUnread ? " unread" : ""}`} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="proc-name">{r.procedures?.procedure_name || "Procedimiento"}</div>
                                <div className="proc-loc">📍 {r.procedures?.office_location || "—"}</div>
                              </div>
                              <span className="badge" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`main-area${mobileView === "list" ? " hidden-mobile" : ""}`}>
            {activeTab !== "chats" ? (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>{renderTab()}</div>
            ) : !selectedRoom ? (
              <div className="welcome">
                <div className="welcome-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E" }}>Portal Dr. Fonseca</p>
                <p style={{ fontSize: 15, color: "#8E8E93", fontWeight: 500, maxWidth: 260, lineHeight: 1.6, textAlign: "center" }}>Selecciona un paciente para abrir su cuarto de comunicación</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative" }}>
                {showPatientInfo && renderPatientPanel()}
                <div className="chat-head">
                  <button className="back-btn" onClick={handleBack}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="chat-av" onClick={() => setShowPatientInfo(true)}>
                    {selectedRoom.procedures?.patients?.profile_picture_url ? <img src={selectedRoom.procedures.patients.profile_picture_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : ini(selectedRoom.procedures?.patients?.full_name || "P")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setShowPatientInfo(true)}>
                    <div className="chat-head-name">{selectedRoom.procedures?.patients?.full_name || "Paciente"}</div>
                    <div className="chat-head-meta">🏥 {selectedRoom.procedures?.procedure_name} · 📍 {selectedRoom.procedures?.office_location}</div>
                  </div>
                  {/* STATUS DROPDOWN — fixed z-index */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      className="status-badge-btn"
                      style={{ background: statusI(selectedRoom.procedures?.status || "scheduled").bg, color: statusI(selectedRoom.procedures?.status || "scheduled").c }}
                      onClick={e => { e.stopPropagation(); setShowStatusMenu(p => !p); }}
                    >
                      {statusI(selectedRoom.procedures?.status || "scheduled").l} ▾
                    </button>
                    {showStatusMenu && (
                      <div style={{ position: "fixed", top: "auto", right: 16, marginTop: 4, background: "white", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", zIndex: 9999, minWidth: 200, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Cambiar Estado</div>
                        {STATUS_OPTIONS.map(s => (
                          <button key={s.key} onClick={() => updateStatus(s.key)} disabled={updatingStatus} style={{ width: "100%", padding: "13px 16px", border: "none", background: selectedRoom?.procedures?.status === s.key ? s.bg : "white", color: s.color, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.1s" }}>
                            <span>{s.label}</span>
                            {selectedRoom?.procedures?.status === s.key && <span style={{ fontSize: 16 }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="msgs" onClick={() => { setShowQuickReplies(false); setShowSlashMenu(false); setShowStatusMenu(false); }}>
                  {messages.filter(m => !m.deleted_by_staff).length === 0 && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#8E8E93", padding: 40, textAlign: "center" }}>
                      <div style={{ fontSize: 36 }}>💬</div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>Sin mensajes aún</p>
                      <p style={{ fontSize: 13 }}>Envía el primero para comenzar</p>
                    </div>
                  )}
                  {messages.map(renderMsg)}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-bottom">
                  {showQuickReplies && (
                    <div className="popup-tray" onClick={e => e.stopPropagation()}>
                      <div className="popup-header">⚡ Respuestas Rápidas</div>
                      {quickReplies.map((r, i) => (
                        <div key={i} className="popup-item" onClick={() => { sendMessage(r); setShowQuickReplies(false); }}>{r}</div>
                      ))}
                    </div>
                  )}
                  {showSlashMenu && slashFiltered.length > 0 && (
                    <div className="popup-tray" onClick={e => e.stopPropagation()}>
                      <div className="popup-header">⚡ {slashFilter ? `Buscando: "${slashFilter}"` : "Respuestas Rápidas"}</div>
                      {slashFiltered.map((r, i) => (
                        <div key={i} className="popup-item" onClick={() => { sendMessage(r); setShowSlashMenu(false); setSlashFilter(""); setNewMessage(""); }}>{r}</div>
                      ))}
                    </div>
                  )}
                  {recording ? (
                    <div className="recording-bar">
                      <div className="rec-dot" />
                      <span className="rec-timer">{fmtRec(recordingSeconds)}</span>
                      <span style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500, flex: 1 }}>Grabando voz…</span>
                      <button onClick={stopRec} style={{ padding: "8px 18px", background: "#FF3B30", color: "white", border: "none", borderRadius: 20, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>⏹ Enviar</button>
                      <button onClick={() => { if (mediaRecorderRef.current) { mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); } setRecording(false); clearInterval(recordingTimerRef.current); setRecordingSeconds(0); }} style={{ padding: "8px 14px", background: "#F2F2F7", color: "#8E8E93", border: "none", borderRadius: 20, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>✕</button>
                    </div>
                  ) : (
                    <div className="input-bar" onClick={e => e.stopPropagation()}>
                      <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
                      <button className={`icon-btn${showQuickReplies ? " active" : ""}`} onClick={e => { e.stopPropagation(); setShowQuickReplies(p => !p); setShowSlashMenu(false); }}>⚡</button>
                      <button className="icon-btn" onPointerDown={e => { e.preventDefault(); startRec(); }}>🎤</button>
                      <input
                        className="msg-input"
                        placeholder="Escribe o usa / para respuestas rápidas…"
                        value={newMessage}
                        onChange={e => {
                          const v = e.target.value;
                          setNewMessage(v);
                          if (v.startsWith("/")) { setShowSlashMenu(true); setShowQuickReplies(false); setSlashFilter(v.slice(1)); }
                          else { setShowSlashMenu(false); setSlashFilter(""); }
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (showSlashMenu && slashFiltered.length > 0) { sendMessage(slashFiltered[0]); setShowSlashMenu(false); setSlashFilter(""); setNewMessage(""); }
                            else { sendMessage(); }
                          }
                          if (e.key === "Escape") { setShowSlashMenu(false); setShowQuickReplies(false); }
                        }}
                      />
                      <button className="send-btn" onClick={() => sendMessage()} disabled={sending || !newMessage.trim()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bottom-nav">
          {([
            { id: "chats" as NavTab, label: "Chats", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> },
            { id: "calls" as NavTab, label: "Llamadas", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.12 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012.19 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.16a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg> },
            { id: "tools" as NavTab, label: "Herramientas", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg> },
            { id: "settings" as NavTab, label: "Ajustes", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg> }
          ]).map(t => (
            <button key={t.id} className={`nav-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
              {t.id === "chats" && totalUnread > 0 && <span className="nav-unread">{totalUnread}</span>}
              {t.icon}
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}