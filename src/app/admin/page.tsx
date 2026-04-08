"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AdminLevel = "owner" | "super_admin" | "admin" | "none";
type Office = "Guadalajara" | "Tijuana" | "";
type OfficeFilter = "Todas" | "Guadalajara" | "Tijuana";

type StaffProfile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  office_location?: string | null;
  admin_level?: string | null;
};

type PatientRecord = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  birthdate?: string | null;
  profile_picture_url?: string | null;
};

type ProcedureRecord = {
  id: string;
  patient_id?: string | null;
  procedure_name?: string | null;
  office_location?: string | null;
  status?: string | null;
  surgery_date?: string | null;
};

type RoomRecord = {
  id: string;
  procedure_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

type MessageRecord = {
  id: string;
  room_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
  sender_office?: string | null;
  sender_type?: string | null;
  message_type?: string | null;
  content?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at?: string | null;
  deleted_by_staff?: boolean | null;
  deleted_by_patient?: boolean | null;
  deleted_at?: string | null;
  is_internal?: boolean | null;
};

type PatientBundle = {
  patient: PatientRecord;
  procedures: Array<{
    procedure: ProcedureRecord;
    rooms: Array<{
      room: RoomRecord;
      messages: MessageRecord[];
    }>;
  }>;
};

const OWNER_EMAIL = "mrdiazsr@icloud.com";

const adminLabel = (level: AdminLevel) => (
  {
    owner: "👑 Acceso total",
    super_admin: "⭐ Admin avanzado",
    admin: "🛡️ Admin",
    none: "Sin admin",
  } as const
)[level];

const adminColor = (level: AdminLevel) => (
  {
    owner: "#7C3AED",
    super_admin: "#007AFF",
    admin: "#34C759",
    none: "#8E8E93",
  } as const
)[level];

const roleLabel = (role: string | null | undefined) =>
  (
    {
      doctor: "👨‍⚕️ Doctor",
      enfermeria: "💉 Enfermería",
      coordinacion: "📋 Coordinación",
      post_quirofano: "🏥 Post-Q",
      staff: "👤 Staff",
      patient: "🧑 Paciente",
      system: "⚙️ Sistema",
    } as Record<string, string>
  )[role || ""] || "👤 Staff";

const roleColor = (role: string | null | undefined) =>
  (
    {
      doctor: "#007AFF",
      enfermeria: "#00C7BE",
      coordinacion: "#FF9500",
      post_quirofano: "#AF52DE",
      staff: "#636366",
    } as Record<string, string>
  )[role || ""] || "#636366";

const officeLabel = (office: string | null | undefined) => {
  if (office === "Guadalajara") return "📍 Guadalajara";
  if (office === "Tijuana") return "📍 Tijuana";
  return "📍 Sin sede";
};

const normalizeAdminLevel = (value: unknown, email = ""): AdminLevel => {
  if (email.toLowerCase() === OWNER_EMAIL) return "owner";
  if (value === "owner" || value === "super_admin" || value === "admin" || value === "none") return value;
  return "none";
};

const normalizeOffice = (value: unknown): Office => {
  if (value === "Guadalajara" || value === "Tijuana") return value;
  return "";
};

const initials = (name?: string | null) =>
  name ? name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase() : "??";

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const escapeHtml = (value?: string | null) =>
  (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
};

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const messageTypeLabel = (message: MessageRecord) => {
  if (message.is_internal) return "Nota interna";
  if (message.message_type === "image") return "Imagen";
  if (message.message_type === "video") return "Video";
  if (message.message_type === "audio") return "Audio";
  if (message.message_type === "file") return "Archivo";
  return "Mensaje";
};

const messageReason = (message: MessageRecord, procedure: ProcedureRecord) => {
  const rawName = message.file_name || "";
  if (message.is_internal) return "Seguimiento interno del equipo";
  if (rawName.startsWith("[MED]")) return "Seguimiento de medicamento";
  if (rawName.startsWith("[BEFORE]")) return "Material preoperatorio";
  if (message.message_type === "image") return "Imagen compartida en el chat";
  if (message.message_type === "video") return "Video compartido en el chat";
  if (message.message_type === "audio") return "Audio compartido en el chat";
  if (message.message_type === "file") return "Archivo compartido en el chat";
  return procedure.procedure_name || "Seguimiento general del paciente";
};

const messageDetailsHtml = (message: MessageRecord) => {
  const fileName = escapeHtml((message.file_name || "").replace(/^\[(MED|BEFORE)\]\s*/i, "")) || "Archivo";
  const url = escapeHtml(message.content);

  if (message.message_type === "image" || message.message_type === "video" || message.message_type === "audio" || message.message_type === "file") {
    return `
      <div>${fileName}</div>
      ${url ? `<div><a href="${url}" target="_blank" rel="noopener noreferrer">Abrir archivo</a></div>` : ""}
    `;
  }

  return escapeHtml(message.content) || "Sin contenido";
};

const buildExportHtml = ({
  title,
  subtitle,
  bundles,
  staffById,
  generatedBy,
}: {
  title: string;
  subtitle: string;
  bundles: PatientBundle[];
  staffById: Map<string, StaffProfile>;
  generatedBy: string;
}) => {
  const sections = bundles.map((bundle) => {
    const patient = bundle.patient;
    const procedureSections = bundle.procedures.map(({ procedure, rooms }) => {
      const roomSections = rooms.map(({ room, messages }) => {
        const rows = messages
          .map((message) => {
            const senderProfile = message.sender_id ? staffById.get(message.sender_id) : null;
            const senderOffice = normalizeOffice(message.sender_office) || normalizeOffice(senderProfile?.office_location) || normalizeOffice(procedure.office_location) || "";

            return `
              <tr>
                <td>${escapeHtml(formatDateTime(message.created_at))}</td>
                <td>${escapeHtml(message.sender_name || (message.sender_type === "patient" ? patient.full_name || "Paciente" : "Staff"))}</td>
                <td>${escapeHtml(roleLabel(message.sender_role || message.sender_type || "staff"))}</td>
                <td>${escapeHtml(senderOffice || procedure.office_location || "Sin sede")}</td>
                <td>${escapeHtml(messageTypeLabel(message))}</td>
                <td>${messageDetailsHtml(message)}</td>
                <td>${escapeHtml(messageReason(message, procedure))}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="room-card">
            <div class="room-head">
              <div>
                <h4>Sala ${escapeHtml(room.id)}</h4>
                <p>Creada: ${escapeHtml(formatDateTime(room.created_at))}</p>
              </div>
              <span>${messages.length} evento(s)</span>
            </div>
            ${
              messages.length === 0
                ? `<p class="empty">Sin mensajes registrados en esta sala.</p>`
                : `
                  <table>
                    <thead>
                      <tr>
                        <th>Cuándo</th>
                        <th>Quién</th>
                        <th>Rol</th>
                        <th>Sede</th>
                        <th>Qué</th>
                        <th>Detalle</th>
                        <th>Motivo / contexto</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                `
            }
          </div>
        `;
      }).join("");

      return `
        <section class="procedure-card">
          <div class="procedure-head">
            <div>
              <h3>${escapeHtml(procedure.procedure_name || "Procedimiento sin nombre")}</h3>
              <p>${escapeHtml(procedure.office_location || "Sin sede")} · Cirugía: ${escapeHtml(formatDate(procedure.surgery_date))}</p>
            </div>
            <span>${escapeHtml(procedure.status || "Sin estatus")}</span>
          </div>
          ${roomSections || `<p class="empty">Sin salas relacionadas.</p>`}
        </section>
      `;
    }).join("");

    return `
      <section class="patient-card">
        <div class="patient-head">
          <div>
            <h2>${escapeHtml(patient.full_name || "Paciente sin nombre")}</h2>
            <p>Tel: ${escapeHtml(patient.phone || "Sin teléfono")} · Correo: ${escapeHtml(patient.email || "Sin correo")} · Nacimiento: ${escapeHtml(formatDate(patient.birthdate))}</p>
          </div>
          <span>${bundle.procedures.length} procedimiento(s)</span>
        </div>
        ${procedureSections || `<p class="empty">Sin procedimientos registrados.</p>`}
      </section>
    `;
  }).join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; margin: 0; background: #F3F4F6; color: #111827; }
          .wrap { max-width: 1200px; margin: 0 auto; padding: 28px 18px 60px; }
          .hero { background: linear-gradient(135deg, #111827, #2563EB); color: white; border-radius: 24px; padding: 28px; margin-bottom: 22px; }
          .hero h1 { margin: 0 0 10px; font-size: 34px; }
          .hero p { margin: 4px 0; opacity: 0.9; }
          .patient-card, .procedure-card, .room-card { background: white; border-radius: 18px; padding: 18px; box-shadow: 0 4px 18px rgba(15,23,42,0.08); margin-bottom: 16px; }
          .patient-head, .procedure-head, .room-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
          .patient-head h2, .procedure-head h3, .room-head h4 { margin: 0 0 6px; }
          .patient-head p, .procedure-head p, .room-head p { margin: 0; color: #6B7280; }
          .patient-head span, .procedure-head span, .room-head span { background: #EFF6FF; color: #1D4ED8; border-radius: 999px; padding: 8px 12px; font-weight: 700; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; overflow: hidden; }
          th, td { padding: 12px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; font-size: 13px; line-height: 1.5; text-align: left; }
          th { background: #F9FAFB; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
          .empty { color: #6B7280; font-style: italic; }
          a { color: #2563EB; text-decoration: none; }
          @media print {
            body { background: white; }
            .wrap { max-width: 100%; padding: 0; }
            .hero { break-after: avoid; }
            .patient-card, .procedure-card, .room-card { box-shadow: none; border: 1px solid #E5E7EB; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <section class="hero">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
            <p>Generado por: ${escapeHtml(generatedBy || OWNER_EMAIL)}</p>
            <p>Fecha de exportación: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
          </section>
          ${sections || `<p>No se encontraron datos para exportar.</p>`}
        </div>
      </body>
    </html>
  `;
};

export default function AdminPage() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState<OfficeFilter>("Todas");
  const [successMsg, setSuccessMsg] = useState("");
  const [pageError, setPageError] = useState("");

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = viewerEmail.toLowerCase() === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(viewerAdminLevel);
  const canManageAdmins = viewerAdminLevel === "owner" || viewerAdminLevel === "super_admin";
  const canManageOwner = viewerEmail.toLowerCase() === OWNER_EMAIL || viewerAdminLevel === "owner";

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);

  const patientCards = useMemo(() => {
    const normalizedSearch = patientSearch.trim().toLowerCase();

    return patients
      .map((patient) => {
        const patientProcedures = procedures.filter((procedure) => procedure.patient_id === patient.id);
        const patientProcedureIds = new Set(patientProcedures.map((procedure) => procedure.id));
        const patientRooms = rooms.filter((room) => patientProcedureIds.has(room.procedure_id || ""));
        const offices = [...new Set(patientProcedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))] as Office[];

        const haystack = [
          patient.full_name,
          patient.phone,
          patient.email,
          ...patientProcedures.map((procedure) => procedure.procedure_name || ""),
          ...offices,
        ]
          .join(" ")
          .toLowerCase();

        return {
          patient,
          procedures: patientProcedures,
          rooms: patientRooms,
          offices,
          latestSurgery: patientProcedures
            .map((procedure) => procedure.surgery_date)
            .filter(Boolean)
            .sort()
            .reverse()[0] || "",
          matchesSearch: !normalizedSearch || haystack.includes(normalizedSearch),
        };
      })
      .filter((card) => (officeFilter === "Todas" ? true : card.offices.includes(officeFilter)))
      .filter((card) => card.matchesSearch)
      .sort((a, b) => (a.patient.full_name || "").localeCompare(b.patient.full_name || "", "es"));
  }, [officeFilter, patientSearch, patients, procedures, rooms]);

  const officeCounts = useMemo(() => {
    return procedures.reduce(
      (counts, procedure) => {
        const office = normalizeOffice(procedure.office_location);
        if (office) counts[office] += 1;
        return counts;
      },
      { Guadalajara: 0, Tijuana: 0 }
    );
  }, [procedures]);

  const bootstrap = async () => {
    setLoading(true);
    setPageError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const email = user.email?.toLowerCase() || "";
    setViewerEmail(email);
    setViewerId(user.id);

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setViewerProfile(profile || null);

    if (email === OWNER_EMAIL) {
      const { error } = await supabase.from("profiles").update({ admin_level: "owner" }).eq("id", user.id);
      if (!error) {
        setViewerProfile((prev) => ({ ...(prev || { id: user.id }), admin_level: "owner" }));
      }
    }

    const computedAccess = email === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(profile?.admin_level, email));
    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    await fetchData();
    setSessionChecked(true);
    setLoading(false);
  };

  const fetchData = async () => {
    setPageError("");

    const [staffRes, patientsRes, proceduresRes, roomsRes, inviteRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("procedures").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle(),
    ]);

    const issues = [
      staffRes.error ? "No pude cargar el staff." : "",
      patientsRes.error ? "No pude cargar los pacientes." : "",
      proceduresRes.error ? "No pude cargar los procedimientos." : "",
      roomsRes.error ? "No pude cargar las salas." : "",
      inviteRes.error ? "No pude cargar el código de invitación." : "",
    ].filter(Boolean);

    setStaff((staffRes.data || []) as StaffProfile[]);
    setPatients((patientsRes.data || []) as PatientRecord[]);
    setProcedures((proceduresRes.data || []) as ProcedureRecord[]);
    setRooms((roomsRes.data || []) as RoomRecord[]);
    setInviteCode((inviteRes.data?.value as string) || "");

    if (issues.length > 0) setPageError(issues.join(" "));
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const updateSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 3200);
  };

  const updateStaffField = async (member: StaffProfile, payload: Partial<StaffProfile>, success: string) => {
    setSavingKey(`${member.id}-${Object.keys(payload).join("-")}`);
    const { error } = await supabase.from("profiles").update(payload).eq("id", member.id);
    setSavingKey("");

    if (error) {
      if (isMissingColumnError(error)) {
        setPageError("Falta completar la configuración inicial del portal para guardar sedes y permisos avanzados.");
        return;
      }
      setPageError(error.message || "No pude guardar el cambio.");
      return;
    }

    setStaff((previous) => previous.map((item) => (item.id === member.id ? { ...item, ...payload } : item)));
    updateSuccess(success);
  };

  const saveInviteCode = async () => {
    if (!newInviteCode.trim()) return;
    setSavingCode(true);
    const nextCode = newInviteCode.trim().toUpperCase();
    const { error } = await supabase
      .from("app_settings")
      .update({ value: nextCode, updated_at: new Date().toISOString() })
      .eq("key", "invite_code");
    setSavingCode(false);

    if (error) {
      setPageError(error.message || "No pude cambiar el código.");
      return;
    }

    setInviteCode(nextCode);
    setNewInviteCode("");
    updateSuccess("Código de invitación actualizado.");
  };

  const deleteStaff = async (member: StaffProfile) => {
    const name = member.full_name || "este usuario";
    if (!confirm(`¿Eliminar la cuenta de ${name}?\n\nEsta acción solo borra el perfil visible en el portal.`)) return;
    setDeletingId(member.id);
    const { error } = await supabase.from("profiles").delete().eq("id", member.id);
    setDeletingId(null);

    if (error) {
      setPageError(error.message || "No pude eliminar la cuenta.");
      return;
    }

    setStaff((previous) => previous.filter((item) => item.id !== member.id));
    updateSuccess(`Cuenta de ${name} eliminada.`);
  };

  const buildBundles = async (patientIds: string[]) => {
    const selectedPatients = patients.filter((patient) => patientIds.includes(patient.id));
    const selectedProcedures = procedures.filter((procedure) => patientIds.includes(procedure.patient_id || ""));
    const selectedProcedureIds = new Set(selectedProcedures.map((procedure) => procedure.id));
    const selectedRooms = rooms.filter((room) => selectedProcedureIds.has(room.procedure_id || ""));
    const roomIds = selectedRooms.map((room) => room.id);

    let messages: MessageRecord[] = [];
    if (roomIds.length > 0) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("room_id", roomIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      messages = (data || []) as MessageRecord[];
    }

    const messagesByRoom = new Map<string, MessageRecord[]>();
    messages.forEach((message) => {
      const key = message.room_id || "";
      if (!messagesByRoom.has(key)) messagesByRoom.set(key, []);
      messagesByRoom.get(key)?.push(message);
    });

    return selectedPatients.map((patient) => {
      const patientProcedures = selectedProcedures.filter((procedure) => procedure.patient_id === patient.id);
      return {
        patient,
        procedures: patientProcedures.map((procedure) => {
          const procedureRooms = selectedRooms.filter((room) => room.procedure_id === procedure.id);
          return {
            procedure,
            rooms: procedureRooms.map((room) => ({
              room,
              messages: (messagesByRoom.get(room.id) || []).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
            })),
          };
        }),
      };
    });
  };

  const exportPatients = async (mode: "single" | "filtered", patientId?: string) => {
    const selectedPatientIds =
      mode === "single" && patientId
        ? [patientId]
        : patientCards.map((card) => card.patient.id);

    if (selectedPatientIds.length === 0) {
      setPageError("No hay pacientes para exportar con ese filtro.");
      return;
    }

    const exportKey = mode === "single" && patientId ? `patient-${patientId}` : "all-patients";
    setExportingKey(exportKey);

    try {
      const bundles = await buildBundles(selectedPatientIds);
      const firstPatient = bundles[0]?.patient.full_name || "paciente";
      const title =
        mode === "single" && patientId
          ? `Expediente exportado · ${firstPatient}`
          : `Exportación general de pacientes (${bundles.length})`;
      const subtitle =
        mode === "single" && patientId
          ? "Incluye procedimiento, sede, salas, mensajes y archivos relacionados."
          : `Filtro aplicado: ${officeFilter}${patientSearch.trim() ? ` · Búsqueda: ${patientSearch.trim()}` : ""}`;
      const html = buildExportHtml({
        title,
        subtitle,
        bundles,
        staffById,
        generatedBy: viewerProfile?.full_name || viewerEmail,
      });
      const filename =
        mode === "single" && patientId
          ? `expediente-${sanitizeFileName(firstPatient || "paciente")}.html`
          : `pacientes-${sanitizeFileName(officeFilter === "Todas" ? "todas-las-sedes" : officeFilter)}-${new Date().toISOString().slice(0, 10)}.html`;
      downloadFile(filename, html, "text/html;charset=utf-8");
      updateSuccess(mode === "single" ? `Expediente de ${firstPatient} descargado.` : "Exportación general descargada.");
    } catch (error: any) {
      setPageError(error?.message || "No pude exportar los pacientes.");
    } finally {
      setExportingKey("");
    }
  };

  if (!sessionChecked || loading) {
    return (
      <>
        <style>{`
          .admin-loading-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #0F172A 0%, #111827 45%, #1D4ED8 100%); padding: 24px; }
          .admin-loading-card { width: 100%; max-width: 420px; background: white; border-radius: 26px; padding: 32px 28px; text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.35); }
          .spinner { width: 38px; height: 38px; border: 3px solid rgba(0,122,255,0.18); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 18px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="admin-loading-page">
          <div className="admin-loading-card">
            <div className="spinner" />
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Preparando panel</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6 }}>Estoy cargando pacientes, staff y configuración del portal.</p>
          </div>
        </div>
      </>
    );
  }

  if (!viewerId) {
    return (
      <>
        <style>{`
          .blocked-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #111827 0%, #1F2937 50%, #111827 100%); padding: 24px; }
          .blocked-card { width: 100%; max-width: 460px; background: white; border-radius: 26px; padding: 34px 28px; text-align: center; box-shadow: 0 28px 80px rgba(0,0,0,0.4); }
          .main-btn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 14px; }
          .ghost-btn { width: 100%; padding: 15px; background: #F3F4F6; border: none; border-radius: 14px; color: #111827; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 10px; }
        `}</style>
        <div className="blocked-page">
          <div className="blocked-card">
            <div style={{ fontSize: 56, marginBottom: 10 }}>🔐</div>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Inicia sesión primero</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7 }}>El panel administrativo ahora usa tu sesión real del portal. Entra con tu cuenta y vuelve a abrir esta pantalla.</p>
            <button className="main-btn" onClick={() => (window.location.href = "/login")}>Ir a login</button>
            <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Abrir inbox</button>
          </div>
        </div>
      </>
    );
  }

  if (!hasAdminAccess) {
    return (
      <>
        <style>{`
          .blocked-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #111827 0%, #1F2937 50%, #111827 100%); padding: 24px; }
          .blocked-card { width: 100%; max-width: 480px; background: white; border-radius: 26px; padding: 34px 28px; text-align: center; box-shadow: 0 28px 80px rgba(0,0,0,0.4); }
          .main-btn { width: 100%; padding: 16px; background: #007AFF; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 14px; }
        `}</style>
        <div className="blocked-page">
          <div className="blocked-card">
            <div style={{ fontSize: 56, marginBottom: 10 }}>⛔</div>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Tu cuenta no tiene acceso</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7 }}>Esta cuenta puede usar el portal, pero todavía no tiene permisos para entrar a esta sección administrativa.</p>
            <button className="main-btn" onClick={() => (window.location.href = "/inbox")}>Volver al inbox</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .admin-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: radial-gradient(circle at top, rgba(59,130,246,0.10), transparent 26%), #F5F7FB; }
        .admin-topbar { background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); padding: 0 max(18px, env(safe-area-inset-right)) 0 max(18px, env(safe-area-inset-left)); display: flex; align-items: center; gap: 14px; min-height: calc(74px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); position: sticky; top: 0; z-index: 100; }
        .admin-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .hero { background: linear-gradient(135deg, #111827 0%, #1D4ED8 100%); color: white; border-radius: 28px; padding: 24px; margin-bottom: 18px; box-shadow: 0 18px 45px rgba(29,78,216,0.18); }
        .hero-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 18px; align-items: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin: 18px 0; }
        .stat-card, .card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .section-title { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .subtle { color: rgba(255,255,255,0.8); line-height: 1.6; font-size: 15px; }
        .pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill-btn { padding: 10px 14px; border-radius: 999px; border: 1px solid #D1D5DB; background: white; color: #111827; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .pill-btn.active { background: #111827; color: white; border-color: #111827; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .line-input { width: 100%; padding: 14px 16px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 15px; font-family: inherit; color: #111827; outline: none; font-weight: 600; }
        .line-input:focus { border-color: rgba(0,122,255,0.5); background: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        .staff-row, .patient-row { display: flex; gap: 14px; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #EEF2F7; }
        .staff-row:last-child, .patient-row:last-child { border-bottom: none; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg,#111827,#1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-right: 6px; margin-top: 8px; }
        .mini-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        .mini-btn { padding: 9px 12px; border-radius: 12px; border: none; cursor: pointer; font-size: 12px; font-weight: 800; font-family: inherit; }
        .export-card { background: linear-gradient(135deg, #F8FBFF, #EFF6FF); border: 1px solid #DBEAFE; border-radius: 18px; padding: 16px; }
        .notice { border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; font-size: 14px; font-weight: 700; }
        .notice.error { background: #FFF1F2; color: #E11D48; }
        .notice.success { background: #EDFAF1; color: #15803D; }
        .empty-state { text-align: center; padding: 32px 16px; color: #6B7280; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #6B7280; font-size: 14px; line-height: 1.6; }
        .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .card-title { font-size: 22px; font-weight: 900; color: #111827; margin: 0 0 6px; }
        @media (max-width: 920px) {
          .hero-grid, .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 560px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .admin-topbar { align-items: flex-start; padding-bottom: 14px; }
          .patient-row, .staff-row { flex-direction: column; }
        }
      `}</style>

      <div className="admin-shell">
        <div className="admin-topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Centro de control</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>Expedientes, equipo y accesos del portal</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="ghost-btn" onClick={() => (window.location.href = "/admin/ayuda")}>Ayuda</button>
            <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Volver al portal</button>
            <button className="ghost-btn" onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/login"))}>Salir</button>
          </div>
        </div>

        <div className="admin-body">
          {pageError && <div className="notice error">⚠️ {pageError}</div>}
          {successMsg && <div className="notice success">✅ {successMsg}</div>}

          <section className="hero">
            <div className="hero-grid">
              <div>
                <h1 className="big-title">Todo en una sola pantalla</h1>
                <p className="subtle">
                  Desde aquí puedes exportar expedientes, filtrar por sede, revisar tu equipo y mantener el portal organizado sin pasos complicados.
                </p>
                <div className="pill-row" style={{ marginTop: 18 }}>
                  <span className="pill-btn" style={{ cursor: "default", background: "rgba(255,255,255,0.12)", color: "white", borderColor: "rgba(255,255,255,0.18)" }}>📦 Exportar</span>
                  <span className="pill-btn" style={{ cursor: "default", background: "rgba(255,255,255,0.12)", color: "white", borderColor: "rgba(255,255,255,0.18)" }}>🏥 Filtrar por sede</span>
                  <span className="pill-btn" style={{ cursor: "default", background: "rgba(255,255,255,0.12)", color: "white", borderColor: "rgba(255,255,255,0.18)" }}>👥 Equipo y permisos</span>
                </div>
              </div>

              <div className="card" style={{ background: "rgba(255,255,255,0.12)", color: "white", boxShadow: "none" }}>
                <p className="section-title" style={{ color: "rgba(255,255,255,0.7)" }}>Acciones rápidas</p>
                <div style={{ display: "grid", gap: 10 }}>
                  <button className="main-btn" onClick={() => exportPatients("filtered")} disabled={exportingKey === "all-patients"}>
                    {exportingKey === "all-patients" ? "Exportando…" : "📦 Exportar pacientes filtrados"}
                  </button>
                  <button className="ghost-btn" style={{ background: "rgba(255,255,255,0.14)", color: "white" }} onClick={() => (window.location.href = "/admin/ayuda")}>
                    ❓ Abrir ayuda
                  </button>
                  <button className="ghost-btn" style={{ background: "rgba(255,255,255,0.14)", color: "white" }} onClick={fetchData}>
                    🔄 Actualizar datos
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <p className="section-title">Staff total</p>
              <div className="value-display">{staff.length}</div>
              <p className="muted">Usuarios visibles en el portal</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Pacientes</p>
              <div className="value-display">{patients.length}</div>
              <p className="muted">Registros disponibles para exportar</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Guadalajara</p>
              <div className="value-display">{officeCounts.Guadalajara}</div>
              <p className="muted">Procedimientos en GDL</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Tijuana</p>
              <div className="value-display">{officeCounts.Tijuana}</div>
              <p className="muted">Procedimientos en TJN</p>
            </div>
          </section>

          <div className="grid-2">
            <section className="card">
              <div className="header-row">
                <div>
                  <p className="card-title">Centro de exportación</p>
                  <p className="muted">Busca al paciente, filtra por sede y descarga el expediente completo en un formato legible.</p>
                </div>
                <button className="main-btn" onClick={() => exportPatients("filtered")} disabled={exportingKey === "all-patients"}>
                  {exportingKey === "all-patients" ? "Exportando…" : "Exportar lista"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <input
                  className="line-input"
                  placeholder="Buscar por paciente, procedimiento, teléfono o sede…"
                  value={patientSearch}
                  onChange={(event) => setPatientSearch(event.target.value)}
                />
                <div className="pill-row">
                  {(["Todas", "Guadalajara", "Tijuana"] as OfficeFilter[]).map((option) => (
                    <button
                      key={option}
                      className={`pill-btn${officeFilter === option ? " active" : ""}`}
                      onClick={() => setOfficeFilter(option)}
                    >
                      {option === "Todas" ? "🏥 Todas las sedes" : officeLabel(option)}
                    </button>
                  ))}
                </div>
              </div>

              {patientCards.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>No encontré pacientes con ese filtro</p>
                  <p className="muted">Prueba cambiando la sede o la búsqueda.</p>
                </div>
              ) : (
                patientCards.map((card) => (
                  <div key={card.patient.id} className="patient-row">
                    <div className="avatar">
                      {card.patient.profile_picture_url ? <img src={card.patient.profile_picture_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(card.patient.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{card.patient.full_name || "Paciente sin nombre"}</p>
                      <p className="muted">
                        {card.procedures.length} procedimiento(s) · {card.rooms.length} sala(s) · Última cirugía: {formatDate(card.latestSurgery)}
                      </p>
                      <div>
                        {card.offices.length === 0 ? (
                          <span className="meta-badge" style={{ color: "#6B7280", background: "#F3F4F6" }}>📍 Sin sede registrada</span>
                        ) : (
                          card.offices.map((office) => (
                            <span key={`${card.patient.id}-${office}`} className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                              {officeLabel(office)}
                            </span>
                          ))
                        )}
                        {card.procedures.slice(0, 2).map((procedure) => (
                          <span key={procedure.id} className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                            🩺 {procedure.procedure_name || "Procedimiento"}
                          </span>
                        ))}
                      </div>
                      <div className="mini-actions">
                        <button className="main-btn" onClick={() => exportPatients("single", card.patient.id)} disabled={exportingKey === `patient-${card.patient.id}`}>
                          {exportingKey === `patient-${card.patient.id}` ? "Exportando…" : "📄 Exportar expediente"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            <div style={{ display: "grid", gap: 16 }}>
              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">Código de invitación</p>
                    <p className="muted">Cámbialo si necesitas revocar nuevos registros del equipo.</p>
                  </div>
                </div>

                <div className="export-card" style={{ marginBottom: 14 }}>
                  <p className="section-title">Código actual</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: "#1D4ED8", letterSpacing: "0.12em", margin: 0, wordBreak: "break-word" }}>{inviteCode || "SIN CÓDIGO"}</p>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input className="line-input" value={newInviteCode} onChange={(event) => setNewInviteCode(event.target.value.toUpperCase())} placeholder="Nuevo código…" />
                  <button className="main-btn" onClick={saveInviteCode} disabled={savingCode || !newInviteCode.trim()}>
                    {savingCode ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="header-row">
                  <div>
                    <p className="card-title">Guía rápida</p>
                    <p className="muted">Un recordatorio corto para usar esta pantalla sin complicaciones.</p>
                  </div>
                </div>
                <div className="export-card">
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Lo más usado</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ background: "white", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>1. Filtra por sede</p>
                      <p className="muted">Usa Guadalajara, Tijuana o Todas para ver solo los pacientes que necesitas.</p>
                    </div>
                    <div style={{ background: "white", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>2. Exporta el expediente</p>
                      <p className="muted">Puedes sacar un expediente individual o una lista completa con el filtro actual.</p>
                    </div>
                    <div style={{ background: "white", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>3. Revisa el equipo</p>
                      <p className="muted">Asigna la sede correcta y define quién necesita acceso administrativo.</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <button className="main-btn" onClick={() => (window.location.href = "/admin/ayuda")}>Abrir ayuda</button>
                    <button className="ghost-btn" onClick={() => (window.location.href = "/inbox")}>Ir al portal</button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="header-row">
              <div>
                <p className="card-title">Equipo y permisos</p>
                <p className="muted">Aquí decides quién solo trabaja en el portal y quién además puede entrar al panel administrativo.</p>
              </div>
            </div>

            {staff.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Todavía no hay staff</p>
                <p className="muted">Cuando se registren aparecerán aquí.</p>
              </div>
            ) : (
              staff.map((member) => {
                const memberEmail = member.id === viewerId ? viewerEmail : "";
                const level = normalizeAdminLevel(member.admin_level, memberEmail);
                const memberOffice = normalizeOffice(member.office_location);
                const canEditThisMember = canManageAdmins && !(level === "owner" && !canManageOwner);
                const accessKey = `${member.id}-admin_level`;
                const officeKey = `${member.id}-office_location`;

                return (
                  <div key={member.id} className="staff-row">
                    <div className="avatar">
                      {member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(member.full_name || member.display_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{member.full_name || member.display_name || "Sin nombre"}</p>
                      <div>
                        <span className="meta-badge" style={{ color: roleColor(member.role), background: `${roleColor(member.role)}18` }}>{roleLabel(member.role)}</span>
                        <span className="meta-badge" style={{ color: adminColor(level), background: `${adminColor(level)}18` }}>{adminLabel(level)}</span>
                        <span className="meta-badge" style={{ color: memberOffice ? "#1D4ED8" : "#6B7280", background: memberOffice ? "#EFF6FF" : "#F3F4F6" }}>{officeLabel(memberOffice)}</span>
                      </div>

                      <div className="mini-actions">
                        {(["Guadalajara", "Tijuana"] as Office[]).map((office) => (
                          <button
                            key={`${member.id}-${office}`}
                            className="mini-btn"
                            style={{
                              background: memberOffice === office ? "#DBEAFE" : "#EFF3F8",
                              color: memberOffice === office ? "#1D4ED8" : "#374151",
                              opacity: savingKey === officeKey ? 0.6 : 1,
                            }}
                            disabled={savingKey === officeKey}
                            onClick={() => updateStaffField(member, { office_location: office }, `Sede de ${member.full_name || "staff"} actualizada.`)}
                          >
                            {office === "Guadalajara" ? "🏙️ Guadalajara" : "🌊 Tijuana"}
                          </button>
                        ))}
                      </div>

                      <div className="mini-actions">
                        {(["none", "admin", "super_admin"] as AdminLevel[]).map((option) => (
                          <button
                            key={`${member.id}-${option}`}
                            className="mini-btn"
                            style={{
                              background: level === option ? `${adminColor(option)}18` : "#EFF3F8",
                              color: level === option ? adminColor(option) : "#374151",
                              opacity: !canEditThisMember || savingKey === accessKey ? 0.55 : 1,
                            }}
                            disabled={!canEditThisMember || savingKey === accessKey}
                            onClick={() => updateStaffField(member, { admin_level: option }, `Permiso de ${member.full_name || "staff"} actualizado.`)}
                          >
                            {adminLabel(option)}
                          </button>
                        ))}
                        {level === "owner" && (
                          <span className="meta-badge" style={{ color: adminColor("owner"), background: `${adminColor("owner")}18` }}>
                            Acceso protegido
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 8, minWidth: 132 }}>
                      <button
                        className="mini-btn"
                        style={{ background: "#FFF1F2", color: "#E11D48", opacity: level === "owner" && !canManageOwner ? 0.45 : 1 }}
                        disabled={deletingId === member.id || (level === "owner" && !canManageOwner)}
                        onClick={() => deleteStaff(member)}
                      >
                        {deletingId === member.id ? "Eliminando…" : "🗑️ Eliminar"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </>
  );
}
