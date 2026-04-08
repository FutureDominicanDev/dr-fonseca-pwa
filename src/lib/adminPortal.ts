import { supabase } from "@/lib/supabaseClient";

export type AdminLevel = "owner" | "super_admin" | "admin" | "none";
export type Office = "Guadalajara" | "Tijuana" | "";
export type PatientRecordStatus = "active" | "archived" | "trash";

export type StaffProfile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  office_location?: string | null;
  admin_level?: string | null;
};

export type PatientRecord = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  birthdate?: string | null;
  profile_picture_url?: string | null;
  record_status?: string | null;
  record_status_changed_at?: string | null;
  record_status_changed_by?: string | null;
};

export type PatientRecordEvent = {
  id: string;
  patient_id?: string | null;
  action?: string | null;
  previous_status?: string | null;
  next_status?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type AdminAuditEvent = {
  id: string;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_name?: string | null;
  patient_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
};

export type ProcedureRecord = {
  id: string;
  patient_id?: string | null;
  procedure_name?: string | null;
  office_location?: string | null;
  status?: string | null;
  surgery_date?: string | null;
};

export type RoomRecord = {
  id: string;
  procedure_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

export type MessageRecord = {
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

export type PatientBundle = {
  patient: PatientRecord;
  procedures: Array<{
    procedure: ProcedureRecord;
    rooms: Array<{
      room: RoomRecord;
      messages: MessageRecord[];
    }>;
  }>;
};

export type TimelineEntry = {
  message: MessageRecord;
  procedure: ProcedureRecord;
  room: RoomRecord;
};

export const OWNER_EMAIL = "mrdiazsr@icloud.com";

export const adminLabel = (level: AdminLevel) =>
  (
    {
      owner: "👑 Acceso total",
      super_admin: "⭐ Admin avanzado",
      admin: "🛡️ Admin",
      none: "Sin admin",
    } as const
  )[level];

export const adminColor = (level: AdminLevel) =>
  (
    {
      owner: "#7C3AED",
      super_admin: "#007AFF",
      admin: "#34C759",
      none: "#8E8E93",
    } as const
  )[level];

export const roleLabel = (role: string | null | undefined) =>
  (
    {
      doctor: "👨‍⚕️ Doctor",
      enfermeria: "💉 Enfermería",
      coordinacion: "📋 Coordinación",
      post_quirofano: "🏥 Post-Q",
      staff: "👤 Personal",
      patient: "🧑 Paciente",
      system: "⚙️ Sistema",
    } as Record<string, string>
  )[role || ""] || "👤 Personal";

export const roleColor = (role: string | null | undefined) =>
  (
    {
      doctor: "#007AFF",
      enfermeria: "#00C7BE",
      coordinacion: "#FF9500",
      post_quirofano: "#AF52DE",
      staff: "#636366",
    } as Record<string, string>
  )[role || ""] || "#636366";

export const officeLabel = (office: string | null | undefined) => {
  if (office === "Guadalajara") return "📍 Guadalajara";
  if (office === "Tijuana") return "📍 Tijuana";
  return "📍 Sin sede";
};

export const normalizeAdminLevel = (value: unknown, email = ""): AdminLevel => {
  if (email.toLowerCase() === OWNER_EMAIL) return "owner";
  if (value === "owner" || value === "super_admin" || value === "admin" || value === "none") return value;
  return "none";
};

export const normalizeOffice = (value: unknown): Office => {
  if (value === "Guadalajara" || value === "Tijuana") return value;
  return "";
};

export const normalizeRecordStatus = (value: unknown): PatientRecordStatus => {
  if (value === "archived" || value === "trash" || value === "active") return value;
  return "active";
};

export const recordStatusLabel = (value: unknown) =>
  (
    {
      active: "🟢 Activo",
      archived: "🗂️ Archivado",
      trash: "🗑️ Papelera",
    } as const
  )[normalizeRecordStatus(value)];

export const recordStatusColor = (value: unknown) =>
  (
    {
      active: "#15803D",
      archived: "#B45309",
      trash: "#DC2626",
    } as const
  )[normalizeRecordStatus(value)];

export const initials = (name?: string | null) =>
  name ? name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase() : "??";

export const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export const escapeHtml = (value?: string | null) =>
  (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache") || message.includes("relation");
};

export const downloadFile = (filename: string, content: string, type: string) => {
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

export const messageTypeLabel = (message: MessageRecord) => {
  if (message.is_internal) return "Nota interna";
  if (message.message_type === "image") return "Imagen";
  if (message.message_type === "video") return "Video";
  if (message.message_type === "audio") return "Audio";
  if (message.message_type === "file") return "Archivo";
  return "Mensaje";
};

export const messageReason = (message: MessageRecord, procedure: ProcedureRecord) => {
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

export const messageDetailsHtml = (message: MessageRecord) => {
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

export const buildPatientBundles = ({
  patientIds,
  patients,
  procedures,
  rooms,
  messages,
}: {
  patientIds: string[];
  patients: PatientRecord[];
  procedures: ProcedureRecord[];
  rooms: RoomRecord[];
  messages: MessageRecord[];
}): PatientBundle[] => {
  const selectedPatients = patients.filter((patient) => patientIds.includes(patient.id));
  const selectedProcedures = procedures.filter((procedure) => patientIds.includes(procedure.patient_id || ""));
  const selectedProcedureIds = new Set(selectedProcedures.map((procedure) => procedure.id));
  const selectedRooms = rooms.filter((room) => selectedProcedureIds.has(room.procedure_id || ""));

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

export const getTimelineEntries = (bundle: PatientBundle): TimelineEntry[] =>
  bundle.procedures
    .flatMap(({ procedure, rooms }) =>
      rooms.flatMap(({ room, messages }) =>
        messages.map((message) => ({
          message,
          procedure,
          room,
        }))
      )
    )
    .sort((a, b) => (a.message.created_at || "").localeCompare(b.message.created_at || ""));

export const getMediaEntries = (bundle: PatientBundle) => {
  const timeline = getTimelineEntries(bundle);
  return {
    images: timeline.filter((entry) => entry.message.message_type === "image"),
    videos: timeline.filter((entry) => entry.message.message_type === "video"),
    audios: timeline.filter((entry) => entry.message.message_type === "audio"),
    files: timeline.filter((entry) => entry.message.message_type === "file"),
  };
};

export const buildExportHtml = ({
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
  const sections = bundles
    .map((bundle) => {
      const patient = bundle.patient;
      const procedureSections = bundle.procedures
        .map(({ procedure, rooms }) => {
          const roomSections = rooms
            .map(({ room, messages }) => {
              const rows = messages
                .map((message) => {
                  const senderProfile = message.sender_id ? staffById.get(message.sender_id) : null;
                  const senderOffice =
                    normalizeOffice(message.sender_office) ||
                    normalizeOffice(senderProfile?.office_location) ||
                    normalizeOffice(procedure.office_location) ||
                    "";

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
            })
            .join("");

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
        })
        .join("");

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
    })
    .join("");

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

export const openPrintPreview = ({ title, html }: { title: string; html: string }) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html.replace("</head>", `<style>@page { margin: 14mm; }</style></head>`));
  printWindow.document.close();
  printWindow.document.title = title;
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 450);
  return true;
};

export const logAdminEvent = async ({
  action,
  entityType,
  entityId,
  entityName,
  patientId,
  actorId,
  actorName,
  actorEmail,
  notes,
  metadata,
}: {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  patientId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}) => {
  const { error } = await supabase.from("admin_audit_events").insert({
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    entity_name: entityName || null,
    patient_id: patientId || null,
    actor_id: actorId || null,
    actor_name: actorName || null,
    actor_email: actorEmail || null,
    notes: notes || null,
    metadata: metadata || null,
  });

  if (error && !isMissingColumnError(error)) {
    throw error;
  }
};
