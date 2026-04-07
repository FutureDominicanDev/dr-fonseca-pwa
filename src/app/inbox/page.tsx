"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lang = "es" | "en";
type FileCategory = "general" | "medication" | "before_photo";
type View = "chat" | "settings" | "quickReplies";

const T = {
  es: {
    patients: "Pacientes", search: "Buscar paciente...", noPatients: "Sin pacientes aún",
    noPatientsHint: "Toca + para crear el primero", online: "En línea",
    typeMessage: "Escribe un mensaje o usa / para respuestas rápidas...",
    send: "Enviar", recording: "Grabando...",
    deleteMsg: "¿Eliminar este mensaje?", msgDeleted: "Mensaje eliminado",
    noMessages: "Sin mensajes aún", noMessagesHint: "Envía el primero para comenzar",
    selectPatient: "Selecciona un paciente", selectPatientHint: "para abrir su sala de chat",
    newRoom: "Nueva Sala de Paciente", patientName: "Nombre del Paciente *",
    patientNamePH: "Ej: María González", phone: "Teléfono (WhatsApp)",
    phonePH: "+52 (33) 555-0000", birthdate: "Fecha de Nacimiento",
    procedure: "Procedimiento *", procedurePH: "Ej: Rinoplastia, Lipo 360...",
    surgeryDate: "Fecha de Cirugía", location: "Sede *",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Foto de Perfil", beforePhotos: "Fotos Pre-Op",
    tapProfilePic: "Toca para subir foto de perfil",
    tapBeforePhotos: "Toca para subir fotos pre-op",
    createRoom: "✅ Crear Sala del Paciente", creating: "Creando sala...",
    cancel: "Cancelar", roomCreated: "¡Sala Creada!", shareLink: "Comparte este enlace con",
    copyLink: "📋 Copiar Enlace", copied: "✅ ¡Copiado!", whatsapp: "💬 Enviar por WhatsApp",
    done: "Listo", required: "Nombre y procedimiento son obligatorios.",
    logout: "Cerrar Sesión", settings: "Ajustes", myProfile: "Mi Perfil",
    displayName: "Nombre a Mostrar", uploadPhoto: "Subir Foto de Perfil",
    darkMode: "Modo Oscuro", fontSize: "Tamaño de Texto",
    role: "Rol", fileCategory: "¿Cómo clasificar este archivo?",
    general: "💬 General", medication: "💊 Medicamento", beforePhoto: "📸 Foto Pre-Op",
    generalSub: "Solo aparece en el chat", medicationSub: "Carpeta de medicamentos",
    beforeSub: "Carpeta Pre-Op", back: "← Atrás",
    quickReplies: "Respuestas Rápidas", edit: "Editar",
    shortcut: "Atajo (ej: hola)", message: "Mensaje completo",
    addReply: "Agregar Respuesta", save: "Guardar", delete: "Eliminar",
    noReplies: "Sin respuestas rápidas aún. Toca + para agregar.",
    typeSlash: "Escribe / para ver tus respuestas rápidas",
    saving: "Guardando...", saved: "✅ Guardado",
    changeName: "Cambiar Nombre", changePhoto: "Cambiar Foto",
    small: "Pequeño", medium: "Normal", large: "Grande",
  },
  en: {
    patients: "Patients", search: "Search patient...", noPatients: "No patients yet",
    noPatientsHint: "Tap + to create the first one", online: "Online",
    typeMessage: "Type a message or use / for quick replies...",
    send: "Send", recording: "Recording...",
    deleteMsg: "Delete this message?", msgDeleted: "Message deleted",
    noMessages: "No messages yet", noMessagesHint: "Send the first one to get started",
    selectPatient: "Select a patient", selectPatientHint: "to open their chat room",
    newRoom: "New Patient Room", patientName: "Patient Name *",
    patientNamePH: "e.g. María González", phone: "Phone (WhatsApp)",
    phonePH: "+52 (33) 555-0000", birthdate: "Date of Birth",
    procedure: "Procedure *", procedurePH: "e.g. Rhinoplasty, Lipo 360...",
    surgeryDate: "Surgery Date", location: "Location *",
    gdl: "🏙️ Guadalajara", tjn: "🌊 Tijuana",
    profilePic: "Profile Photo", beforePhotos: "Pre-Op Photos",
    tapProfilePic: "Tap to upload profile photo",
    tapBeforePhotos: "Tap to upload pre-op photos",
    createRoom: "✅ Create Patient Room", creating: "Creating room...",
    cancel: "Cancel", roomCreated: "Room Created!", shareLink: "Share this link with",
    copyLink: "📋 Copy Link", copied: "✅ Copied!", whatsapp: "💬 Send via WhatsApp",
    done: "Done", required: "Name and procedure are required.",
    logout: "Log Out", settings: "Settings", myProfile: "My Profile",
    displayName: "Display Name", uploadPhoto: "Upload Profile Photo",
    darkMode: "Dark Mode", fontSize: "Font Size",
    role: "Role", fileCategory: "How to classify this file?",
    general: "💬 General", medication: "💊 Medication", beforePhoto: "📸 Pre-Op Photo",
    generalSub: "Appears in chat only", medicationSub: "Medication folder",
    beforeSub: "Pre-Op folder", back: "← Back",
    quickReplies: "Quick Replies", edit: "Edit",
    shortcut: "Shortcut (e.g. hello)", message: "Full message",
    addReply: "Add Reply", save: "Save", delete: "Delete",
    noReplies: "No quick replies yet. Tap + to add one.",
    typeSlash: "Type / to see your quick replies",
    saving: "Saving...", saved: "✅ Saved",
    changeName: "Change Name", changePhoto: "Change Photo",
    small: "Small", medium: "Normal", large: "Large",
  }
};

interface QuickReply { shortcut: string; message: string; }

export default function InboxPage() {
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];
  const [darkMode, setDarkMode] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<"small"|"medium"|"large">("medium");
  const fontSize = fontSizeLevel === "small" ? 14 : fontSizeLevel === "large" ? 19 : 16;

  const bg = darkMode ? "#1C1C1E" : "#ECE5DD";
  const headerBg = darkMode ? "#111" : "#1C1C1E";
  const sidebarBg = darkMode ? "#2C2C2E" : "white";
  const inputBg = darkMode ? "#2C2C2E" : "#F0F0F0";
  const textColor = darkMode ? "white" : "#1C1C1E";
  const subTextColor = darkMode ? "rgba(255,255,255,0.5)" : "#8E8E93";
  const borderColor = darkMode ? "rgba(255,255,255,0.08)" : "#F2F2F2";

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list"|"chat">("list");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pressedMsgId, setPressedMsgId] = useState<string|null>(null);
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set());
  const [totalUnread, setTotalUnread] = useState(0);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQREditor, setShowQREditor] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newSurgeryDate, setNewSurgeryDate] = useState("");
  const [newBirthdate, setNewBirthdate] = useState("");
  const [newLocation, setNewLocation] = useState("Guadalajara");
  const [profilePicFile, setProfilePicFile] = useState<File|null>(null);
  const [beforePhotosFiles, setBeforePhotosFiles] = useState<File[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createdRoomLink, setCreatedRoomLink] = useState<string|null>(null);
  const [createdPatientName, setCreatedPatientName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<File|null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    { shortcut: "hola", message: "¡Hola! ¿Cómo se siente hoy?" },
    { shortcut: "cita", message: "Su próxima cita es mañana. Por favor llegue 10 minutos antes." },
    { shortcut: "med", message: "Por favor tome su medicamento a tiempo." },
    { shortcut: "gracias", message: "¡Excelente recuperación! Gracias por su confianza." },
    { shortcut: "duda", message: "Llame al consultorio si tiene alguna duda. Estamos para ayudarle." },
  ]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [editingQR, setEditingQR] = useState<QuickReply[]>([]);
  const [newShortcut, setNewShortcut] = useState("");
  const [newQRMessage, setNewQRMessage] = useState("");
  const [savingQR, setSavingQR] = useState(false);
  const [savedQR, setSavedQR] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedRoomRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicRef = useRef<HTMLInputElement>(null);
  const profilePicSettingsRef = useRef<HTMLInputElement>(null);
  const beforePhotosRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const notifRef = useRef<string>("default");
  const isSending = useRef(false);

  const ini = (n: string) => n ? n.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() : "P";

  const fmtTime = (ts: string) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtDateLabel = (ts: string) => {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const fmtSize = (b: number) => !b ? "" : b < 1048576 ? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(1)+" MB";
  const fmtRec = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  const isImageUrl = (url: string) => {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.includes("supabase") && (u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".gif") || u.endsWith(".webp") || u.includes("before") || u.includes("patient-photo"));
  };

  const senderColor = (type: string, role: string) => type === "patient" ? "#1A6B3C" : ({
    doctor: "#0050A0", post_quirofano: "#6B3A9E", enfermeria: "#007A7A", coordinacion: "#B35A00", staff: "#444"
  } as any)[role] || "#444";

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
    if (data) {
      setUserProfile(data);
      setDisplayNameEdit(data.full_name || data.display_name || "");
      if (data.quick_replies?.length) setQuickReplies(data.quick_replies);
    }
  };

  const saveQuickReplies = async (replies: QuickReply[]) => {
    setQuickReplies(replies);
    if (userProfile?.id) {
      setSavingQR(true);
      await supabase.from("profiles").update({ quick_replies: replies }).eq("id", userProfile.id);
      setSavingQR(false); setSavedQR(true);
      setTimeout(() => setSavedQR(false), 2000);
    }
  };

  const saveDisplayName = async () => {
    if (!userProfile?.id || !displayNameEdit.trim()) return;
    setSavingName(true);
    await supabase.from("profiles").update({ full_name: displayNameEdit.trim(), display_name: displayNameEdit.trim() }).eq("id", userProfile.id);
    setUserProfile((p: any) => ({ ...p, full_name: displayNameEdit.trim(), display_name: displayNameEdit.trim() }));
    setSavingName(false); setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  };

  const uploadProfilePhoto = async (file: File) => {
    if (!userProfile?.id) return;
    const fn = `profile-photos/${userProfile.id}/avatar.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("chat-files").upload(fn, file, { upsert: true });
    if (!error) {
      const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn);
      await supabase.from("profiles").update({ avatar_url: ud.publicUrl }).eq("id", userProfile.id);
      setUserProfile((p: any) => ({ ...p, avatar_url: ud.publicUrl }));
    }
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
          pushNotif("Dr. Fonseca Portal", lang === "es" ? "Nuevo mensaje de un paciente" : "New message from a patient");
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
      fetchMessages(selectedRoom.id); setMobileView("chat");
      setUnreadRooms(p => { const n = new Set(p); const w = n.has(selectedRoom.id); n.delete(selectedRoom.id); if (w) setTotalUnread(t => Math.max(0,t-1)); return n; });
    }
  }, [selectedRoom]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchRooms = async () => {
    const { data, error } = await supabase.from("rooms")
      .select("*, procedures(id, procedure_name, office_location, status, surgery_date, patients(id, full_name, phone, profile_picture_url, birthdate))")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const pm: Record<string,any> = {};
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

  const sendMessage = async (content?: string) => {
    const msg = (content || newMessage).trim();
    if (!msg || !selectedRoom || isSending.current) return;
    isSending.current = true; setSending(true);
    if (!content) setNewMessage("");
    setShowSlashMenu(false);
    const sName = userProfile?.full_name || userProfile?.display_name || "Staff";
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
      const sName = userProfile?.full_name || userProfile?.display_name || "Staff";
      const sRole = userProfile?.role || "staff";
      const tempId = "temp-file-" + Date.now();
      setMessages(p => [...p, { id: tempId, room_id: selectedRoom.id, content: ud.publicUrl, message_type: mt, file_name: prefix+file.name, file_size: file.size, sender_type: "staff", sender_name: sName, sender_role: sRole, created_at: new Date().toISOString() }]);
      const { data: nm } = await supabase.from("messages").insert({ room_id: selectedRoom.id, content: ud.publicUrl, message_type: mt, file_name: prefix+file.name, file_size: file.size, sender_type: "staff", sender_name: sName, sender_role: sRole }).select().single();
      if (nm) setMessages(p => p.map(m => m.id === tempId ? nm : m));
      else setMessages(p => p.filter(m => m.id !== tempId));
    } catch(e) { console.error(e); }
    setSending(false);
  };

  const createRoom = async () => {
    if (!newPatientName.trim() || !newProcedureName.trim()) { alert(t.required); return; }
    setCreatingRoom(true);
    try {
      const { data: pt, error: pe } = await supabase.from("patients").insert({ full_name: newPatientName.trim(), phone: newPatientPhone||null, birthdate: newBirthdate||null }).select().single();
      if (pe) throw pe;
      if (profilePicFile) {
        const fn = `patient-profiles/${pt.id}/profile.${profilePicFile.name.split(".").pop()||"jpg"}`;
        const { error: ue } = await supabase.storage.from("chat-files").upload(fn, profilePicFile, { upsert: true });
        if (!ue) { const { data: ud } = supabase.storage.from("chat-files").getPublicUrl(fn); await supabase.from("patients").update({ profile_picture_url: ud.publicUrl }).eq("id", pt.id); }
      }
      const { data: pr, error: pre } = await supabase.from("procedures").insert({ patient_id: pt.id, procedure_name: newProcedureName.trim(), surgery_date: newSurgeryDate||null, office_location: newLocation, status: "scheduled" }).select().single();
      if (pre) throw pre;
      const { data: rm, error: re } = await supabase.from("rooms").insert({ procedure_id: pr.id }).select().single();
      if (re) throw re;
      for (let i = 0; i < beforePhotosFiles.length; i++) {
        const f = beforePhotosFiles[i];
        const fn2 = `patient-photos/${pt.id}/before/${Date.now()}-${i}.${f.name.split(".").pop()||"jpg"}`;
        const { error: ue2 } = await supabase.storage.from("chat-files").upload(fn2, f, { upsert: true });
        if (!ue2) {
          const { data: ud2 } = supabase.storage.from("chat-files").getPublicUrl(fn2);
          await supabase.from("messages").insert({ room_id: rm.id, content: ud2.publicUrl, message_type: "image", file_name: `[BEFORE] Foto Pre-Op ${i+1}`, sender_type: "staff", sender_name: "Sistema", sender_role: "staff" });
        }
      }
      setCreatedRoomLink(`${window.location.origin}/patient/${rm.id}`);
      setCreatedPatientName(newPatientName);
      setNewPatientName(""); setNewPatientPhone(""); setNewProcedureName(""); setNewSurgeryDate(""); setNewBirthdate(""); setNewLocation("Guadalajara"); setProfilePicFile(null); setBeforePhotosFiles([]); setShowNewRoom(false);
      fetchRooms();
    } catch(err: any) { console.error(err); alert("Error: "+(err?.message||JSON.stringify(err))); }
    setCreatingRoom(false);
  };

  const copyLink = async () => { if (!createdRoomLink) return; await navigator.clipboard.writeText(createdRoomLink); setLinkCopied(true); setTimeout(()=>setLinkCopied(false),2500); };
  const whatsAppLink = () => { if (!createdRoomLink) return; window.open(`https://wa.me/?text=${encodeURIComponent(`Hola ${createdPatientName}! 👋\n\nEnlace para comunicarse con el equipo del Dr. Fonseca:\n\n${createdRoomLink}\n\nGuárdelo — es su acceso a mensajes y actualizaciones médicas. 🏥`)}`, "_blank"); };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr; audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => { const b = new Blob(audioChunksRef.current, { type: "audio/mp4" }); stream.getTracks().forEach(t => t.stop()); await uploadFile(new File([b], `voice-${Date.now()}.mp4`, { type: "audio/mp4" })); };
      mr.start(); setRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s+1), 1000);
    } catch { alert("No se pudo acceder al micrófono."); }
  };
  const stopRec = () => { if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); setRecording(false); clearInterval(recordingTimerRef.current); setRecordingSeconds(0); } };
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const filtPts = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.rooms.some((r: any) => r.procedures?.procedure_name?.toLowerCase().includes(q));
  });

  const slashFiltered = quickReplies.filter(r =>
    slashFilter === "" || r.shortcut.toLowerCase().includes(slashFilter.toLowerCase()) || r.message.toLowerCase().includes(slashFilter.toLowerCase())
  );

  const groupedMessages = () => {
    const groups: { date: string; msgs: any[] }[] = [];
    let currentDate = "";
    messages.forEach(m => {
      if (m.deleted_by_staff) return;
      const d = new Date(m.created_at).toDateString();
      if (d !== currentDate) { currentDate = d; groups.push({ date: m.created_at, msgs: [] }); }
      groups[groups.length-1].msgs.push(m);
    });
    return groups;
  };

  const renderMsg = (msg: any) => {
    const isOut = msg.sender_type === "staff" || !msg.sender_type;
    const isTemp = typeof msg.id === "string" && msg.id.startsWith("temp-");
    const isPressed = pressedMsgId === msg.id;
    const isSystem = msg.sender_name === "Sistema";
    const sc = senderColor(msg.sender_type || "staff", msg.sender_role || "staff");
    const sn = msg.sender_name || (isOut ? "Staff" : "Paciente");
    const effectiveType = msg.message_type === "text" && isImageUrl(msg.content) ? "image" : msg.message_type;

    if (isSystem) return (
      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
        <div style={{ background: "rgba(0,0,0,0.08)", borderRadius: 99, padding: "4px 14px", fontSize: 12, color: "#555", fontWeight: 600 }}>{msg.content}</div>
      </div>
    );

    const tap = (e: any) => { e.stopPropagation(); if (!isTemp) setPressedMsgId(isPressed ? null : msg.id); };

    // Staff = blue bubble, Patient = green bubble
    const bubbleBg = isOut ? "#E3F2FF" : "#DCF8C6";
    const bubbleRadius = isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px";
    const bubbleStyle: React.CSSProperties = {
      background: bubbleBg, color: "#111", borderRadius: bubbleRadius,
      maxWidth: "78%", padding: "10px 14px", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", position: "relative"
    };

    return (
      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start", marginBottom: 4, position: "relative" }}>
        {isPressed && !isTemp && (
          <div style={{ position: "absolute", top: -44, right: isOut ? 0 : "auto", left: isOut ? "auto" : 0, background: "white", borderRadius: 12, padding: 4, zIndex: 99, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <button onPointerDown={e => { e.stopPropagation(); if (confirm(t.deleteMsg)) { supabase.from("messages").update({ deleted_by_staff: true, deleted_at: new Date().toISOString() }).eq("id", msg.id).then(() => { setMessages(p => p.map(m => m.id === msg.id ? { ...m, deleted_by_staff: true } : m)); setPressedMsgId(null); }); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FF3B30", border: "none", color: "white", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>🗑️ {lang === "es" ? "Eliminar" : "Delete"}</button>
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: sc, marginBottom: 3, paddingLeft: isOut ? 0 : 4, paddingRight: isOut ? 4 : 0 }}>{sn}</div>
        {msg.deleted_by_patient ? (
          <div style={{ ...bubbleStyle, fontStyle: "italic", opacity: 0.6, fontSize }}>{t.msgDeleted}<div style={{ fontSize: 11, opacity: 0.6, marginTop: 3, textAlign: "right" }}>{fmtTime(msg.created_at)}</div></div>
        ) : effectiveType === "image" ? (
          <div style={{ ...bubbleStyle, padding: 4, cursor: "pointer" }} onClick={tap} onTouchEnd={tap}>
            <img src={msg.content} alt="" style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
            <div style={{ fontSize: 11, opacity: 0.6, padding: "4px 6px 2px", textAlign: "right" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : effectiveType === "video" ? (
          <div style={{ ...bubbleStyle, padding: 4 }} onClick={tap} onTouchEnd={tap}>
            <video src={msg.content} controls style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} />
            <div style={{ fontSize: 11, opacity: 0.6, padding: "4px 6px 2px", textAlign: "right" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : effectiveType === "audio" ? (
          <div style={{ ...bubbleStyle, minWidth: 220 }} onClick={tap} onTouchEnd={tap}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 20 }}>🎤</span><span style={{ fontSize: 14, fontWeight: 600 }}>Audio</span></div>
            <audio src={msg.content} controls style={{ width: "100%" }} />
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: "right" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : effectiveType === "file" ? (
          <div style={{ ...bubbleStyle, cursor: "pointer" }} onClick={tap} onTouchEnd={tap}>
            <a href={isPressed ? undefined : msg.content} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}>
              <span style={{ fontSize: 28 }}>📄</span>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>{(msg.file_name||"Archivo").replace(/^\[MED\] |\[BEFORE\] /,"")}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{fmtSize(msg.file_size)}</div></div>
            </a>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: "right" }}>{fmtTime(msg.created_at)}</div>
          </div>
        ) : (
          <div style={{ ...bubbleStyle, cursor: "pointer", lineHeight: 1.6, wordBreak: "break-word", fontSize }} onClick={tap} onTouchEnd={tap}>
            {msg.content}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
              {fmtTime(msg.created_at)}
              {isOut && <span style={{ color: isTemp ? "#8E8E93" : "#007AFF" }}>{isTemp ? "✓" : "✓✓"}</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const QREditor = () => (
    <div style={{ position: "absolute", top: 0, right: 0, width: "min(400px, 100%)", height: "100%", background: sidebarBg, zIndex: 60, boxShadow: "-4px 0 20px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", transition: "transform 0.3s ease" }}>
      <div style={{ background: headerBg, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setShowQREditor(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "8px 14px", borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← {t.back}</button>
        <span style={{ color: "white", fontSize: 17, fontWeight: 700, flex: 1 }}>⚡ {t.quickReplies}</span>
        {savingQR && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{t.saving}</span>}
        {savedQR && <span style={{ color: "#25D366", fontSize: 13, fontWeight: 700 }}>{t.saved}</span>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <p style={{ fontSize: 13, color: subTextColor, marginBottom: 16 }}>{t.typeSlash}</p>
        {quickReplies.length === 0 && <p style={{ color: subTextColor, fontSize: 14, textAlign: "center", padding: "30px 0" }}>{t.noReplies}</p>}
        {quickReplies.map((qr, i) => (
          <div key={i} style={{ background: darkMode ? "#3A3A3C" : "#F8F8F8", borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${borderColor}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: "#007AFF", color: "white", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 99 }}>/{qr.shortcut}</span>
              <button onClick={() => { const u = quickReplies.filter((_,j) => j!==i); saveQuickReplies(u); }} style={{ marginLeft: "auto", background: "#FFF0EE", border: "none", color: "#FF3B30", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
            </div>
            <p style={{ fontSize: 14, color: textColor, lineHeight: 1.5 }}>{qr.message}</p>
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: `1px solid ${borderColor}`, background: darkMode ? "#2C2C2E" : "#F6F6F6" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>➕ {t.addReply}</p>
        <input value={newShortcut} onChange={e => setNewShortcut(e.target.value.toLowerCase().replace(/\s/g,""))} placeholder={t.shortcut} style={{ width: "100%", padding: "10px 14px", background: darkMode ? "#3A3A3C" : "white", border: `1px solid ${borderColor}`, borderRadius: 10, fontSize: 15, fontFamily: "inherit", color: textColor, outline: "none", marginBottom: 8 }} />
        <textarea value={newQRMessage} onChange={e => setNewQRMessage(e.target.value)} placeholder={t.message} rows={3} style={{ width: "100%", padding: "10px 14px", background: darkMode ? "#3A3A3C" : "white", border: `1px solid ${borderColor}`, borderRadius: 10, fontSize: 15, fontFamily: "inherit", color: textColor, outline: "none", resize: "none", marginBottom: 8 }} />
        <button onClick={() => { if (!newShortcut.trim() || !newQRMessage.trim()) return; saveQuickReplies([...quickReplies, { shortcut: newShortcut.trim(), message: newQRMessage.trim() }]); setNewShortcut(""); setNewQRMessage(""); }} style={{ width: "100%", padding: 12, background: "#007AFF", border: "none", borderRadius: 12, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ {t.addReply}</button>
      </div>
    </div>
  );

  const SettingsPanel = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowSettings(false)}>
      <div style={{ background: sidebarBg, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: "24px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: textColor }}>⚙️ {t.settings}</p>
          <button onClick={() => setShowSettings(false)} style={{ background: darkMode ? "#3A3A3C" : "#F2F2F7", border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: textColor, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Profile */}
        <div style={{ background: darkMode ? "#3A3A3C" : "#F8F8F8", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>{t.myProfile}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#2C2C2E,#007AFF)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 700, overflow: "hidden", flexShrink: 0 }}>
              {userProfile?.avatar_url ? <img src={userProfile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : ini(userProfile?.full_name || "S")}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: textColor }}>{userProfile?.full_name || userProfile?.display_name || "Staff"}</p>
              <p style={{ fontSize: 13, color: subTextColor, marginTop: 2 }}>{t.role}: {userProfile?.role || "staff"}</p>
              <input ref={profilePicSettingsRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadProfilePhoto(f); }} />
              <button onClick={() => profilePicSettingsRef.current?.click()} style={{ marginTop: 8, background: "#007AFF", border: "none", borderRadius: 8, color: "white", padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📷 {t.changePhoto}</button>
            </div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, marginBottom: 6 }}>{t.displayName}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={displayNameEdit} onChange={e => setDisplayNameEdit(e.target.value)} style={{ flex: 1, padding: "10px 14px", background: darkMode ? "#2C2C2E" : "white", border: `1px solid ${borderColor}`, borderRadius: 10, fontSize: 15, fontFamily: "inherit", color: textColor, outline: "none" }} />
            <button onClick={saveDisplayName} disabled={savingName} style={{ padding: "10px 16px", background: savedName ? "#34C759" : "#007AFF", border: "none", borderRadius: 10, color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14, transition: "background 0.2s" }}>{savedName ? "✅" : savingName ? "..." : t.save}</button>
          </div>
        </div>

        {/* Quick Replies */}
        <div style={{ background: darkMode ? "#3A3A3C" : "#F8F8F8", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, textTransform: "uppercase", letterSpacing: 0.5 }}>⚡ {t.quickReplies} ({quickReplies.length})</p>
            <button onClick={() => { setShowSettings(false); setShowQREditor(true); }} style={{ background: "#007AFF", border: "none", borderRadius: 8, color: "white", padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t.edit}</button>
          </div>
          <p style={{ fontSize: 13, color: subTextColor, marginTop: 8 }}>{t.typeSlash}</p>
        </div>

        {/* Appearance */}
        <div style={{ background: darkMode ? "#3A3A3C" : "#F8F8F8", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>🎨 {lang === "es" ? "Apariencia" : "Appearance"}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 16, color: textColor, fontWeight: 500 }}>🌙 {t.darkMode}</span>
            <button onClick={() => setDarkMode(d => !d)} style={{ width: 52, height: 30, borderRadius: 99, background: darkMode ? "#34C759" : "#E5E5EA", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: darkMode ? 24 : 2, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
          <span style={{ fontSize: 16, color: textColor, fontWeight: 500, display: "block", marginBottom: 10 }}>🔤 {t.fontSize}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {(["small","medium","large"] as const).map(level => (
              <button key={level} onClick={() => setFontSizeLevel(level)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: fontSizeLevel === level ? "2px solid #007AFF" : `2px solid ${borderColor}`, background: fontSizeLevel === level ? "#EBF5FF" : (darkMode ? "#2C2C2E" : "white"), color: fontSizeLevel === level ? "#007AFF" : textColor, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: level === "small" ? 13 : level === "large" ? 18 : 15 }}>
                {t[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div style={{ background: darkMode ? "#3A3A3C" : "#F8F8F8", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: subTextColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>🌐 {lang === "es" ? "Idioma" : "Language"}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setLang("es")} style={{ flex: 1, padding: 12, borderRadius: 10, border: lang === "es" ? "2px solid #007AFF" : `2px solid ${borderColor}`, background: lang === "es" ? "#EBF5FF" : (darkMode ? "#2C2C2E" : "white"), color: lang === "es" ? "#007AFF" : textColor, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>🇲🇽 Español</button>
            <button onClick={() => setLang("en")} style={{ flex: 1, padding: 12, borderRadius: 10, border: lang === "en" ? "2px solid #007AFF" : `2px solid ${borderColor}`, background: lang === "en" ? "#EBF5FF" : (darkMode ? "#2C2C2E" : "white"), color: lang === "en" ? "#007AFF" : textColor, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>🇺🇸 English</button>
          </div>
        </div>

        <button onClick={handleLogout} style={{ width: "100%", padding: 14, background: "#FFF0EE", border: "none", borderRadius: 14, color: "#FF3B30", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🚪 {t.logout}</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; flex-direction: column; height: 100dvh; position: fixed; inset: 0; background: ${bg}; }
        .topbar { flex-shrink: 0; height: 66px; background: ${headerBg}; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 100; }
        .body { display: flex; flex: 1; overflow: hidden; }
        .sidebar { width: 340px; flex-shrink: 0; background: ${sidebarBg}; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid ${borderColor}; }
        .sidebar-head { padding: 14px 16px; background: ${darkMode ? "#2A2A2C" : "#F6F6F6"}; border-bottom: 1px solid ${borderColor}; }
        .sidebar-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .search-bar { display: flex; align-items: center; gap: 8px; background: ${darkMode ? "#3A3A3C" : "#EBEBEB"}; border-radius: 10px; padding: 9px 12px; }
        .search-input { flex: 1; border: none; background: transparent; font-size: 16px; outline: none; color: ${textColor}; font-family: inherit; }
        .patient-list { flex: 1; overflow-y: auto; }
        .patient-list::-webkit-scrollbar { display: none; }
        .patient-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid ${borderColor}; transition: background 0.1s; }
        .patient-row:hover, .patient-row:active { background: ${darkMode ? "#3A3A3C" : "#F0F7FF"}; }
        .patient-row.active { background: ${darkMode ? "#1C3A5E" : "#E3F2FF"}; }
        .av { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; position: relative; }
        .av-badge { position: absolute; top: 1px; right: 1px; width: 15px; height: 15px; background: #25D366; border-radius: 50%; border: 2px solid ${sidebarBg}; }
        .patient-info { flex: 1; min-width: 0; }
        .patient-name { font-size: 17px; font-weight: 600; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .patient-meta { font-size: 14px; color: ${subTextColor}; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .unread-dot { width: 13px; height: 13px; background: #25D366; border-radius: 50%; flex-shrink: 0; }
        .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: ${bg}; position: relative; }
        .chat-bg { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
        .chat-bg::-webkit-scrollbar { display: none; }
        .date-sep { display: flex; justify-content: center; margin: 14px 0; }
        .date-sep-pill { background: ${darkMode ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.92)"}; border-radius: 99px; padding: 5px 16px; font-size: 13px; color: ${darkMode ? "white" : "#555"}; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .chat-head { flex-shrink: 0; background: ${headerBg}; padding: 10px 14px; display: flex; align-items: center; gap: 10px; z-index: 50; }
        .back-btn { width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.15); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: white; font-size: 22px; font-weight: 700; transition: background 0.15s; }
        .back-btn:hover { background: rgba(255,255,255,0.25); }
        .chat-av { width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg,#2C2C2E,#007AFF); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; }
        .chat-head-name { font-size: 17px; font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-head-sub { font-size: 13px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .input-area { flex-shrink: 0; background: ${inputBg}; padding: 10px 12px; display: flex; align-items: flex-end; gap: 8px; border-top: 1px solid ${borderColor}; }
        .msg-input { flex: 1; padding: 11px 16px; background: ${darkMode ? "#3A3A3C" : "white"}; border: none; border-radius: 24px; font-size: ${fontSize}px; font-family: inherit; color: ${textColor}; outline: none; min-width: 0; max-height: 120px; resize: none; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .msg-input::placeholder { color: #AEAEB2; }
        .icon-btn { width: 46px; height: 46px; border-radius: 50%; background: ${darkMode ? "#3A3A3C" : "#1C1C1E"}; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 20px; transition: background 0.15s; }
        .icon-btn:hover { background: #007AFF; }
        .send-btn { width: 46px; height: 46px; border-radius: 50%; background: #25D366; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(37,211,102,0.4); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .slash-popup { background: ${darkMode ? "#2C2C2E" : "white"}; border-top: 1px solid ${borderColor}; max-height: 260px; overflow-y: auto; }
        .slash-header { padding: 10px 16px 6px; font-size: 12px; font-weight: 700; color: ${subTextColor}; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between; }
        .slash-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid ${borderColor}; display: flex; align-items: center; gap: 12px; transition: background 0.1s; }
        .slash-item:hover { background: ${darkMode ? "#3A3A3C" : "#F8F8F8"}; }
        .slash-shortcut { background: #007AFF; color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
        .slash-msg { font-size: 15px; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(4px); }
        .modal { background: ${sidebarBg}; border-radius: 20px 20px 0 0; width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto; padding: 24px 20px 40px; }
        .modal-scroll { background: ${sidebarBg}; border-radius: 20px 20px 0 0; width: 100%; max-width: 540px; position: fixed; top: 8vh; bottom: 0; left: 50%; transform: translateX(-50%); overflow-y: scroll; -webkit-overflow-scrolling: touch; padding: 24px 20px 60px; z-index: 201; }
        .modal-title { font-size: 20px; font-weight: 700; color: ${textColor}; margin-bottom: 20px; }
        .flabel { font-size: 13px; font-weight: 700; color: ${subTextColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
        .finput { width: 100%; padding: 13px 16px; background: ${darkMode ? "#3A3A3C" : "#F2F2F7"}; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; color: ${textColor}; outline: none; margin-bottom: 14px; }
        .finput::placeholder { color: #AEAEB2; }
        .loc-group { display: flex; gap: 10px; margin-bottom: 14px; }
        .loc-opt { flex: 1; padding: 13px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; color: ${subTextColor}; background: ${darkMode ? "#3A3A3C" : "#F2F2F7"}; border: 2px solid transparent; text-align: center; }
        .loc-opt.sel { background: #EBF5FF; color: #007AFF; border-color: #007AFF; }
        .file-box { width: 100%; padding: 16px; border: 2px dashed ${darkMode ? "#555" : "#C7C7CC"}; border-radius: 12px; cursor: pointer; text-align: center; font-size: 14px; font-weight: 600; color: ${subTextColor}; margin-bottom: 14px; }
        .pbtn { width: 100%; padding: 15px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .pbtn:disabled { opacity: 0.45; }
        .sbtn { width: 100%; padding: 13px; background: ${darkMode ? "#3A3A3C" : "#F2F2F7"}; border: none; border-radius: 14px; color: ${textColor}; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px; }
        .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 40px; text-align: center; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 700px) {
          .sidebar { position: absolute; inset: 0; z-index: 10; width: 100%; transition: transform 0.25s ease; }
          .main-area { position: absolute; inset: 0; z-index: 20; transition: transform 0.25s ease; }
          .sidebar.hidden { transform: translateX(-100%); pointer-events: none; }
          .main-area.hidden { transform: translateX(100%); pointer-events: none; }
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setShowUploadMenu(true); } e.target.value = ""; }} />
      <input ref={profilePicRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setProfilePicFile(f); }} />
      <input ref={beforePhotosRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => setBeforePhotosFiles(p => [...p, ...Array.from(e.target.files||[])])} />

      {/* UPLOAD CATEGORY MODAL */}
      {showUploadMenu && pendingFile && (
        <div className="modal-overlay" onClick={() => { setShowUploadMenu(false); setPendingFile(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "50vh" }}>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: textColor }}>{t.fileCategory}</p>
            <p style={{ fontSize: 13, color: subTextColor, marginBottom: 16 }}>{pendingFile.name}</p>
            {([{ c: "general" as FileCategory, icon: "💬", label: t.general, sub: t.generalSub }, { c: "medication" as FileCategory, icon: "💊", label: t.medication, sub: t.medicationSub }, { c: "before_photo" as FileCategory, icon: "📸", label: t.beforePhoto, sub: t.beforeSub }]).map(opt => (
              <button key={opt.c} onClick={() => confirmUpload(opt.c)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", background: darkMode ? "#3A3A3C" : "#FAFAFA", border: `1px solid ${borderColor}`, borderRadius: 14, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>
                <span style={{ fontSize: 28 }}>{opt.icon}</span>
                <div style={{ textAlign: "left" }}><p style={{ fontSize: 15, fontWeight: 700, color: textColor, margin: 0 }}>{opt.label}</p><p style={{ fontSize: 12, color: subTextColor, margin: 0 }}>{opt.sub}</p></div>
              </button>
            ))}
            <button onClick={() => { setShowUploadMenu(false); setPendingFile(null); }} className="sbtn">{t.cancel}</button>
          </div>
        </div>
      )}

      {/* NEW ROOM MODAL */}
      {showNewRoom && (
        <div className="modal-overlay" onClick={() => setShowNewRoom(false)}>
          <div className="modal-scroll" onClick={e => e.stopPropagation()}>
            <p className="modal-title">➕ {t.newRoom}</p>
            <label className="flabel">{t.patientName}</label>
            <input className="finput" placeholder={t.patientNamePH} value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
            <label className="flabel">{t.phone}</label>
            <input className="finput" placeholder={t.phonePH} value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} />
            <label className="flabel">{t.birthdate}</label>
            <input className="finput" type="date" value={newBirthdate} onChange={e => setNewBirthdate(e.target.value)} />
            <label className="flabel">{t.procedure}</label>
            <input className="finput" placeholder={t.procedurePH} value={newProcedureName} onChange={e => setNewProcedureName(e.target.value)} />
            <label className="flabel">{t.surgeryDate}</label>
            <input className="finput" type="date" value={newSurgeryDate} onChange={e => setNewSurgeryDate(e.target.value)} />
            <label className="flabel">{t.location}</label>
            <div className="loc-group">
              <div className={`loc-opt${newLocation==="Guadalajara"?" sel":""}`} onClick={() => setNewLocation("Guadalajara")}>{t.gdl}</div>
              <div className={`loc-opt${newLocation==="Tijuana"?" sel":""}`} onClick={() => setNewLocation("Tijuana")}>{t.tjn}</div>
            </div>
            <label className="flabel">📸 {t.profilePic}</label>
            <div className="file-box" onClick={() => profilePicRef.current?.click()}>
              {profilePicFile ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><img src={URL.createObjectURL(profilePicFile)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} /><span>{profilePicFile.name}</span></div> : t.tapProfilePic}
            </div>
            <label className="flabel">📷 {t.beforePhotos}</label>
            {beforePhotosFiles.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>{beforePhotosFiles.map((f,i) => <img key={i} src={URL.createObjectURL(f)} style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover" }} alt="" />)}</div>}
            <div className="file-box" onClick={() => beforePhotosRef.current?.click()}>
              {beforePhotosFiles.length === 0 ? t.tapBeforePhotos : `📷 ${beforePhotosFiles.length} foto(s)`}
            </div>
            <button className="pbtn" onClick={createRoom} disabled={creatingRoom}>{creatingRoom ? t.creating : t.createRoom}</button>
            <button className="sbtn" onClick={() => setShowNewRoom(false)}>{t.cancel}</button>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {createdRoomLink && (
        <div className="modal-overlay" onClick={() => setCreatedRoomLink(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: textColor }}>{t.roomCreated}</p>
              <p style={{ fontSize: 15, color: subTextColor, marginTop: 4 }}>{t.shareLink} <strong style={{ color: textColor }}>{createdPatientName}</strong></p>
            </div>
            <div style={{ background: darkMode ? "#3A3A3C" : "#F2F2F7", borderRadius: 12, padding: "12px 14px", marginBottom: 16, wordBreak: "break-all", fontSize: 13, color: "#007AFF" }}>{createdRoomLink}</div>
            <button onClick={copyLink} style={{ width: "100%", padding: 14, background: linkCopied ? "#34C759" : "#007AFF", border: "none", borderRadius: 14, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>{linkCopied ? t.copied : t.copyLink}</button>
            <button onClick={whatsAppLink} style={{ width: "100%", padding: 14, background: "#25D366", border: "none", borderRadius: 14, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>{t.whatsapp}</button>
            <button onClick={() => setCreatedRoomLink(null)} className="sbtn">{t.done}</button>
          </div>
        </div>
      )}

      {showSettings && <SettingsPanel />}

      <div className="shell" onClick={() => { setPressedMsgId(null); setShowSlashMenu(false); }}>
        {/* TOPBAR */}
        <div className="topbar">
          <img src="/fonseca_blue.png" style={{ height: 52, width: "auto", objectFit: "contain" }} alt="Dr. Fonseca" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {totalUnread > 0 && <div style={{ background: "#FF3B30", color: "white", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{totalUnread}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#25D366" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{t.online}</span>
            </div>
            <button onClick={() => setShowSettings(true)} style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙️</button>
          </div>
        </div>

        <div className="body">
          {/* SIDEBAR */}
          <div className={`sidebar${mobileView==="chat"?" hidden":""}`}>
            <div className="sidebar-head">
              <div className="sidebar-title-row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>{t.patients}</span>
                  {totalUnread > 0 && <span style={{ background: "#25D366", color: "white", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{totalUnread}</span>}
                </div>
                <button onClick={() => setShowNewRoom(true)} style={{ width: 38, height: 38, borderRadius: "50%", background: "#007AFF", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,122,255,0.3)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              <div className="search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input className="search-input" placeholder={t.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="patient-list">
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div style={{ width: 28, height: 28, border: "2px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /></div>
              ) : filtPts.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                  <p style={{ fontSize: 17, fontWeight: 600, color: textColor }}>{t.noPatients}</p>
                  <p style={{ fontSize: 14, color: subTextColor, marginTop: 6 }}>{t.noPatientsHint}</p>
                </div>
              ) : filtPts.map(pt => {
                const ptUnread = pt.rooms.some((r: any) => unreadRooms.has(r.id));
                const firstRoom = pt.rooms[0];
                const proc = firstRoom?.procedures;
                const surgDate = proc?.surgery_date ? new Date(proc.surgery_date).toLocaleDateString(lang==="es"?"es-MX":"en-US",{ day:"2-digit", month:"2-digit", year:"2-digit" }) : "";
                const isActive = pt.rooms.some((r: any) => r.id === selectedRoom?.id);
                return (
                  <div key={pt.id} className={`patient-row${isActive?" active":""}`} onClick={() => { setSelectedRoom(firstRoom); setMobileView("chat"); }}>
                    <div className="av">
                      {pt.profile_picture_url ? <img src={pt.profile_picture_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : ini(pt.full_name)}
                      {ptUnread && <div className="av-badge" />}
                    </div>
                    <div className="patient-info">
                      <div className="patient-name">{pt.full_name}</div>
                      <div className="patient-meta">
                        {proc?.procedure_name && <span>{proc.procedure_name}</span>}
                        {surgDate && <span> · {surgDate}</span>}
                        {proc?.office_location && <span> · 📍{proc.office_location==="Guadalajara"?"GDL":"TJN"}</span>}
                      </div>
                    </div>
                    {ptUnread && <div className="unread-dot" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAIN CHAT AREA */}
          <div className={`main-area${mobileView==="list"?" hidden":""}`}>
            {!selectedRoom ? (
              <div className="welcome">
                <div style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg,#2C2C2E,#007AFF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <p style={{ fontSize: 24, fontWeight: 700, color: textColor }}>{t.selectPatient}</p>
                <p style={{ fontSize: 16, color: subTextColor, maxWidth: 280, lineHeight: 1.6, textAlign: "center" }}>{t.selectPatientHint}</p>
              </div>
            ) : (
              <>
                <div className="chat-head">
                  <button className="back-btn" onClick={() => { setMobileView("list"); setSelectedRoom(null); setShowQREditor(false); }}>←</button>
                  <div className="chat-av">
                    {selectedRoom.procedures?.patients?.profile_picture_url
                      ? <img src={selectedRoom.procedures.patients.profile_picture_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                      : ini(selectedRoom.procedures?.patients?.full_name||"P")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="chat-head-name">{selectedRoom.procedures?.patients?.full_name||"Paciente"}</div>
                    <div className="chat-head-sub">
                      {selectedRoom.procedures?.procedure_name}
                      {selectedRoom.procedures?.surgery_date && ` · ${new Date(selectedRoom.procedures.surgery_date).toLocaleDateString(lang==="es"?"es-MX":"en-US",{day:"2-digit",month:"2-digit",year:"2-digit"})}`}
                      {selectedRoom.procedures?.office_location && ` · 📍${selectedRoom.procedures.office_location}`}
                    </div>
                  </div>
                </div>

                <div className="chat-bg" onClick={() => setShowSlashMenu(false)}>
                  {messages.filter(m => !m.deleted_by_staff).length === 0 ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40, textAlign: "center" }}>
                      <div style={{ fontSize: 44 }}>💬</div>
                      <p style={{ fontSize: 17, fontWeight: 600, color: textColor }}>{t.noMessages}</p>
                      <p style={{ fontSize: 15, color: subTextColor }}>{t.noMessagesHint}</p>
                    </div>
                  ) : groupedMessages().map((group, gi) => (
                    <div key={gi}>
                      <div className="date-sep"><div className="date-sep-pill">{fmtDateLabel(group.date)}</div></div>
                      {group.msgs.map(renderMsg)}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* SLASH QUICK REPLIES POPUP */}
                {showSlashMenu && slashFiltered.length > 0 && (
                  <div className="slash-popup" onClick={e => e.stopPropagation()}>
                    <div className="slash-header">
                      <span>⚡ {t.quickReplies}</span>
                      <button onClick={() => { setShowSettings(false); setShowQREditor(true); }} style={{ background: "none", border: "none", color: "#007AFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t.edit}</button>
                    </div>
                    {slashFiltered.map((r, i) => (
                      <div key={i} className="slash-item" onClick={() => { sendMessage(r.message); setShowSlashMenu(false); setSlashFilter(""); setNewMessage(""); }}>
                        <span className="slash-shortcut">/{r.shortcut}</span>
                        <span className="slash-msg">{r.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* INPUT BAR */}
                {recording ? (
                  <div style={{ background: inputBg, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${borderColor}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF3B30", flexShrink: 0 }} />
                    <span style={{ fontSize: 17, fontWeight: 700, color: "#FF3B30", fontFamily: "monospace", flex: 1 }}>{fmtRec(recordingSeconds)}</span>
                    <span style={{ fontSize: 14, color: subTextColor, flex: 1 }}>{t.recording}</span>
                    <button onClick={stopRec} style={{ padding: "8px 18px", background: "#FF3B30", color: "white", border: "none", borderRadius: 20, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏹ {t.send}</button>
                  </div>
                ) : (
                  <div className="input-area" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
                    <textarea
                      className="msg-input"
                      placeholder={t.typeMessage}
                      value={newMessage}
                      rows={1}
                      onChange={e => {
                        const v = e.target.value;
                        setNewMessage(v);
                        if (v.startsWith("/")) { setShowSlashMenu(true); setSlashFilter(v.slice(1)); }
                        else { setShowSlashMenu(false); setSlashFilter(""); }
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 120)+"px";
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (showSlashMenu && slashFiltered.length > 0) { sendMessage(slashFiltered[0].message); setShowSlashMenu(false); setSlashFilter(""); setNewMessage(""); }
                          else sendMessage();
                        }
                        if (e.key === "Escape") setShowSlashMenu(false);
                      }}
                    />
                    {newMessage.trim() ? (
                      <button className="send-btn" onClick={() => sendMessage()} disabled={sending}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    ) : (
                      <button className="icon-btn" onPointerDown={e => { e.preventDefault(); startRec(); }}>🎤</button>
                    )}
                  </div>
                )}

                {/* QUICK REPLIES EDITOR — slides in from right */}
                {showQREditor && <QREditor />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}