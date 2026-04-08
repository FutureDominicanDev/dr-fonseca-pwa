"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAdminLang } from "@/lib/useAdminLang";
import {
  OWNER_EMAIL,
  buildExportHtml,
  buildPatientBundles,
  downloadFile,
  getMediaEntries,
  getTimelineEntries,
  initials,
  isMissingColumnError,
  normalizeAdminLevel,
  normalizeOffice,
  normalizeRecordStatus,
  officeLabel,
  recordStatusColor,
  recordStatusLabel,
  roleColor,
  roleLabel,
  sanitizeFileName,
  type MessageRecord,
  type Office,
  type PatientRecord,
  type PatientRecordStatus,
  type ProcedureRecord,
  type RoomRecord,
  type StaffProfile,
} from "@/lib/adminPortal";

type PatientDraft = {
  full_name: string;
  phone: string;
  email: string;
  birthdate: string;
};

type ProcedureDraft = {
  procedure_name: string;
  office_location: Office;
  status: string;
  surgery_date: string;
};

export default function AdminPatientRecordPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = Array.isArray(params?.patientId) ? params.patientId[0] : params?.patientId || "";
  const { lang, setLang, isSpanish } = useAdminLang();

  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerProfile, setViewerProfile] = useState<StaffProfile | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [patientDraft, setPatientDraft] = useState<PatientDraft>({
    full_name: "",
    phone: "",
    email: "",
    birthdate: "",
  });
  const [procedureDrafts, setProcedureDrafts] = useState<Record<string, ProcedureDraft>>({});
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingProcedureId, setSavingProcedureId] = useState("");
  const [statusSaving, setStatusSaving] = useState<PatientRecordStatus | "">("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const photoInputRef = useRef<HTMLInputElement>(null);

  const viewerAdminLevel = normalizeAdminLevel(viewerProfile?.admin_level, viewerEmail);
  const hasAdminAccess = viewerEmail.toLowerCase() === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(viewerAdminLevel);
  const staffById = useMemo(() => new Map(staffProfiles.map((member) => [member.id, member])), [staffProfiles]);
  const patientStatus = normalizeRecordStatus(patient?.record_status);

  const t = {
    loadingTitle: isSpanish ? "Abriendo expediente" : "Opening record",
    loadingCopy: isSpanish
      ? "Estoy reuniendo procedimientos, salas, medios e historial completo del paciente."
      : "I am gathering procedures, rooms, media, and the full patient history.",
    signInTitle: isSpanish ? "Inicia sesión primero" : "Sign in first",
    signInCopy: isSpanish
      ? "Este expediente solo se puede abrir desde una sesión administrativa activa."
      : "This record can only be opened from an active admin session.",
    signInButton: isSpanish ? "Ir a login" : "Go to login",
    noAccessTitle: isSpanish ? "Sin acceso" : "No access",
    noAccessCopy: isSpanish
      ? "Tu cuenta puede usar el portal, pero no tiene permisos para revisar expedientes administrativos."
      : "Your account can use the portal, but it does not have permission to review admin records.",
    backToPortal: isSpanish ? "Volver al portal" : "Back to portal",
    recordTitle: isSpanish ? "Expediente del paciente" : "Patient record",
    recordSubtitle: isSpanish ? "Revisión completa antes de exportar" : "Full review before export",
    backToCenter: isSpanish ? "← Volver al centro" : "← Back to control center",
    goToPortal: isSpanish ? "Ir al portal" : "Go to portal",
    exporting: isSpanish ? "Preparando..." : "Preparing...",
    exportRecord: isSpanish ? "📤 Compartir expediente" : "📤 Share record",
    unavailableTitle: isSpanish ? "Expediente no disponible" : "Record unavailable",
    unavailableCopy: isSpanish
      ? "Vuelve al centro de control para buscarlo de nuevo o intenta recargar la página."
      : "Go back to the control center to search again or reload the page.",
    reload: isSpanish ? "Recargar" : "Reload",
    unnamedPatient: isSpanish ? "Paciente sin nombre" : "Unnamed patient",
    noPhone: isSpanish ? "Sin teléfono" : "No phone",
    noEmail: isSpanish ? "Sin correo" : "No email",
    noBirthdate: isSpanish ? "Sin fecha" : "No date",
    relatedOffices: isSpanish ? "Sedes relacionadas" : "Related offices",
    noOffice: isSpanish ? "📍 Sin sede" : "📍 No office",
    heroCopy: isSpanish
      ? "Aquí puedes revisar datos del paciente, procedimientos, medios y toda la cronología del chat antes de decidir si quieres exportar este expediente."
      : "Here you can review patient details, procedures, media, and the full chat timeline before deciding whether to export this record.",
    heroHelper: isSpanish
      ? "Puedes corregir datos del paciente y del procedimiento aquí mismo. La cronología del chat se conserva sin edición."
      : "You can correct patient and procedure details here. The chat timeline stays read-only.",
    patientPhoto: isSpanish ? "Foto del paciente" : "Patient photo",
    addPhoto: isSpanish ? "Agregar foto" : "Add photo",
    changePhoto: isSpanish ? "Cambiar foto" : "Change photo",
    uploadPhotoHelp: isSpanish
      ? "Úsalo si el paciente nunca subió foto o si quieres corregirla."
      : "Use this if the patient never uploaded a photo or if you need to correct it.",
    basicInfo: isSpanish ? "Datos del paciente" : "Patient details",
    basicInfoCopy: isSpanish
      ? "Puedes corregir nombre, teléfono, correo y fecha de nacimiento."
      : "You can correct the patient's name, phone, email, and birth date.",
    savePatient: isSpanish ? "Guardar datos del paciente" : "Save patient details",
    savingPatient: isSpanish ? "Guardando..." : "Saving...",
    quickSummary: isSpanish ? "Resumen rápido" : "Quick summary",
    lastEvent: isSpanish ? "Último evento registrado" : "Latest recorded event",
    firstRoom: isSpanish ? "Primera sala creada" : "First room created",
    noActivity: isSpanish ? "Sin actividad" : "No activity",
    noRooms: isSpanish ? "Sin salas" : "No rooms",
    recordStatus: isSpanish ? "Estado del expediente" : "Record status",
    recordStatusCopy: isSpanish
      ? "Usa activo, archivado o papelera. El chat no se borra."
      : "Use active, archived, or trash. The chat is not deleted.",
    active: isSpanish ? "🟢 Activo" : "🟢 Active",
    archived: isSpanish ? "🗂️ Archivado" : "🗂️ Archived",
    trash: isSpanish ? "🗑️ Papelera" : "🗑️ Trash",
    proceduresTitle: isSpanish ? "Procedimientos y sedes" : "Procedures and offices",
    proceduresCopy: isSpanish
      ? "Aquí puedes corregir procedimiento, sede, fecha de cirugía y estatus."
      : "Here you can correct procedure, office, surgery date, and status.",
    saveProcedure: isSpanish ? "Guardar procedimiento" : "Save procedure",
    savingProcedure: isSpanish ? "Guardando..." : "Saving...",
    noProcedures: isSpanish ? "No hay procedimientos registrados para este paciente." : "There are no procedures registered for this patient.",
    roomsRelated: isSpanish ? "Salas relacionadas" : "Related rooms",
    mediaTitle: isSpanish ? "Media y archivos" : "Media and files",
    mediaCopy: isSpanish ? "Aquí está todo el material enviado y recibido dentro del chat del paciente." : "This is all the material sent and received inside the patient chat.",
    images: isSpanish ? "Imágenes" : "Images",
    videos: isSpanish ? "Videos" : "Videos",
    audios: isSpanish ? "Audios" : "Audio files",
    files: isSpanish ? "Archivos" : "Files",
    noImages: isSpanish ? "No hay imágenes en el historial." : "There are no images in the history.",
    noVideos: isSpanish ? "No hay videos en el historial." : "There are no videos in the history.",
    noAudios: isSpanish ? "No hay audios en el historial." : "There are no audio files in the history.",
    noFiles: isSpanish ? "No hay archivos en el historial." : "There are no files in the history.",
    open: isSpanish ? "Abrir" : "Open",
    timelineTitle: isSpanish ? "Cronología completa" : "Full timeline",
    timelineCopy: isSpanish
      ? "Qué pasó, quién escribió, cuándo ocurrió, desde qué sede y con qué procedimiento estaba relacionado."
      : "What happened, who wrote it, when it happened, from which office, and which procedure it was tied to.",
    noTimeline: isSpanish ? "No hay historial registrado todavía." : "There is no recorded history yet.",
    roomLabel: isSpanish ? "Sala" : "Room",
    procedureLabel: isSpanish ? "Procedimiento" : "Procedure",
    reasonLabel: isSpanish ? "Motivo / contexto" : "Reason / context",
    deletedMessage: isSpanish
      ? "Este mensaje fue marcado como eliminado, pero se mantiene en el historial."
      : "This message was marked as deleted, but it remains in the history.",
    patientSaved: isSpanish ? "Datos del paciente guardados." : "Patient details saved.",
    photoSaved: isSpanish ? "Foto del paciente actualizada." : "Patient photo updated.",
    uploadError: isSpanish ? "No pude subir la foto del paciente." : "I could not upload the patient photo.",
    fieldSetupError: isSpanish
      ? "Falta correr la configuración de Supabase para guardar esta información nueva."
      : "The Supabase setup still needs to be run before this new information can be saved.",
    shareOpened: isSpanish ? "Se abrió el menú para compartir el expediente." : "The share menu opened for this record.",
    sharePreview: isSpanish ? "Abrí una vista previa del expediente para que puedas compartirlo desde el navegador." : "I opened a record preview so you can share it from the browser.",
    recordDownloaded: isSpanish ? "El expediente se descargó en este dispositivo." : "The record was downloaded to this device.",
  };

  const formatDateLocal = (value?: string | null) => {
    if (!value) return t.noBirthdate;
    return new Date(value).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTimeLocal = (value?: string | null) => {
    if (!value) return t.noBirthdate;
    return new Date(value).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const roleText = (role: string | null | undefined) =>
    isSpanish
      ? roleLabel(role)
      : (
          {
            doctor: "👨‍⚕️ Doctor",
            enfermeria: "💉 Nursing",
            coordinacion: "📋 Coordination",
            post_quirofano: "🏥 Post-Op",
            staff: "👤 Staff",
            patient: "🧑 Patient",
            system: "⚙️ System",
          } as Record<string, string>
        )[role || ""] || "👤 Staff";

  const officeText = (office: string | null | undefined) => {
    if (office === "Guadalajara") return "📍 Guadalajara";
    if (office === "Tijuana") return "📍 Tijuana";
    return t.noOffice;
  };

  const recordStatusText = (status: PatientRecordStatus) =>
    isSpanish
      ? recordStatusLabel(status)
      : (
          {
            active: "🟢 Active",
            archived: "🗂️ Archived",
            trash: "🗑️ Trash",
          } as const
        )[status];

  const messageTypeText = (message: MessageRecord) => {
    if (message.is_internal) return isSpanish ? "Nota interna" : "Internal note";
    if (message.message_type === "image") return isSpanish ? "Imagen" : "Image";
    if (message.message_type === "video") return isSpanish ? "Video" : "Video";
    if (message.message_type === "audio") return isSpanish ? "Audio" : "Audio";
    if (message.message_type === "file") return isSpanish ? "Archivo" : "File";
    return isSpanish ? "Mensaje" : "Message";
  };

  const messageReasonText = (message: MessageRecord, procedure: ProcedureRecord) => {
    const rawName = message.file_name || "";
    if (message.is_internal) return isSpanish ? "Seguimiento interno del equipo" : "Internal team follow-up";
    if (rawName.startsWith("[MED]")) return isSpanish ? "Seguimiento de medicamento" : "Medication follow-up";
    if (rawName.startsWith("[BEFORE]")) return isSpanish ? "Material preoperatorio" : "Pre-op material";
    if (message.message_type === "image") return isSpanish ? "Imagen compartida en el chat" : "Image shared in chat";
    if (message.message_type === "video") return isSpanish ? "Video compartido en el chat" : "Video shared in chat";
    if (message.message_type === "audio") return isSpanish ? "Audio compartido en el chat" : "Audio shared in chat";
    if (message.message_type === "file") return isSpanish ? "Archivo compartido en el chat" : "File shared in chat";
    return procedure.procedure_name || (isSpanish ? "Seguimiento general del paciente" : "General patient follow-up");
  };

  const bundle = useMemo(() => {
    if (!patient) return null;
    const bundles = buildPatientBundles({
      patientIds: [patient.id],
      patients: [patient],
      procedures,
      rooms,
      messages,
    });
    return bundles[0] || null;
  }, [messages, patient, procedures, rooms]);

  const timeline = useMemo(() => (bundle ? getTimelineEntries(bundle) : []), [bundle]);
  const media = useMemo(() => (bundle ? getMediaEntries(bundle) : { images: [], videos: [], audios: [], files: [] }), [bundle]);
  const offices = useMemo(() => {
    return [...new Set(procedures.map((procedure) => normalizeOffice(procedure.office_location)).filter(Boolean))];
  }, [procedures]);

  useEffect(() => {
    if (!patient) return;
    setPatientDraft({
      full_name: patient.full_name || "",
      phone: patient.phone || "",
      email: patient.email || "",
      birthdate: patient.birthdate || "",
    });
  }, [patient]);

  useEffect(() => {
    const nextDrafts: Record<string, ProcedureDraft> = {};
    procedures.forEach((procedure) => {
      nextDrafts[procedure.id] = {
        procedure_name: procedure.procedure_name || "",
        office_location: normalizeOffice(procedure.office_location),
        status: procedure.status || "",
        surgery_date: procedure.surgery_date || "",
      };
    });
    setProcedureDrafts(nextDrafts);
  }, [procedures]);

  const updateSuccess = (message: string) => {
    setPageError("");
    setSuccessMsg(message);
    window.clearTimeout((window as any).__adminPatientToastTimer);
    (window as any).__adminPatientToastTimer = window.setTimeout(() => setSuccessMsg(""), 3200);
  };

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    window.location.href = path;
  };

  const fetchRecord = async () => {
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

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setViewerProfile(profile || null);

    const computedAccess = email === OWNER_EMAIL || ["owner", "super_admin", "admin"].includes(normalizeAdminLevel(profile?.admin_level, email));
    if (!computedAccess) {
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data: patientData, error: patientError } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
    if (patientError || !patientData) {
      setPageError(patientError?.message || (isSpanish ? "No pude cargar este expediente." : "I could not load this record."));
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const { data: procedureData, error: procedureError } = await supabase.from("procedures").select("*").eq("patient_id", patientId);
    if (procedureError) {
      setPageError(procedureError.message || (isSpanish ? "No pude cargar los procedimientos." : "I could not load the procedures."));
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    const nextProcedures = (procedureData || []) as ProcedureRecord[];
    const procedureIds = nextProcedures.map((procedure) => procedure.id);

    let nextRooms: RoomRecord[] = [];
    if (procedureIds.length > 0) {
      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").in("procedure_id", procedureIds).order("created_at", { ascending: true });
      if (roomError) {
        setPageError(roomError.message || (isSpanish ? "No pude cargar las salas." : "I could not load the rooms."));
        setSessionChecked(true);
        setLoading(false);
        return;
      }
      nextRooms = (roomData || []) as RoomRecord[];
    }

    const roomIds = nextRooms.map((room) => room.id);
    let nextMessages: MessageRecord[] = [];
    if (roomIds.length > 0) {
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .in("room_id", roomIds)
        .order("created_at", { ascending: true });

      if (messageError) {
        setPageError(messageError.message || (isSpanish ? "No pude cargar el historial." : "I could not load the history."));
        setSessionChecked(true);
        setLoading(false);
        return;
      }
      nextMessages = (messageData || []) as MessageRecord[];
    }

    const senderIds = [...new Set(nextMessages.map((message) => message.sender_id).filter(Boolean))] as string[];
    let nextStaff: StaffProfile[] = [];
    if (senderIds.length > 0) {
      const { data: staffData } = await supabase.from("profiles").select("*").in("id", senderIds);
      nextStaff = (staffData || []) as StaffProfile[];
    }

    setPatient(patientData as PatientRecord);
    setProcedures(nextProcedures);
    setRooms(nextRooms);
    setMessages(nextMessages);
    setStaffProfiles(nextStaff);
    setSessionChecked(true);
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) fetchRecord();
  }, [patientId]);

  const savePatientInfo = async () => {
    if (!patient) return;
    setSavingPatient(true);

    const payload = {
      full_name: patientDraft.full_name.trim() || null,
      phone: patientDraft.phone.trim() || null,
      email: patientDraft.email.trim() || null,
      birthdate: patientDraft.birthdate || null,
    };

    const { data, error } = await supabase.from("patients").update(payload).eq("id", patient.id).select().single();
    setSavingPatient(false);

    if (error) {
      setPageError(error.message || (isSpanish ? "No pude guardar los datos del paciente." : "I could not save the patient details."));
      return;
    }

    setPatient(data as PatientRecord);
    updateSuccess(t.patientSaved);
  };

  const saveProcedure = async (procedureId: string) => {
    const draft = procedureDrafts[procedureId];
    if (!draft) return;

    setSavingProcedureId(procedureId);
    const payload = {
      procedure_name: draft.procedure_name.trim() || null,
      office_location: draft.office_location || null,
      status: draft.status.trim() || null,
      surgery_date: draft.surgery_date || null,
    };

    const { data, error } = await supabase.from("procedures").update(payload).eq("id", procedureId).select().single();
    setSavingProcedureId("");

    if (error) {
      setPageError(error.message || (isSpanish ? "No pude guardar el procedimiento." : "I could not save the procedure."));
      return;
    }

    setProcedures((previous) => previous.map((procedure) => (procedure.id === procedureId ? (data as ProcedureRecord) : procedure)));
    updateSuccess(isSpanish ? "Procedimiento guardado." : "Procedure saved.");
  };

  const changeRecordStatus = async (nextStatus: PatientRecordStatus) => {
    if (!patient || patientStatus === nextStatus) return;
    setStatusSaving(nextStatus);

    const payload = {
      record_status: nextStatus,
      record_status_changed_at: new Date().toISOString(),
      record_status_changed_by: viewerProfile?.id || null,
    };

    const { data, error } = await supabase.from("patients").update(payload).eq("id", patient.id).select().single();
    setStatusSaving("");

    if (error) {
      if (isMissingColumnError(error)) {
        setPageError(t.fieldSetupError);
        return;
      }
      setPageError(error.message || (isSpanish ? "No pude cambiar el estado del expediente." : "I could not change the record status."));
      return;
    }

    setPatient(data as PatientRecord);
    updateSuccess(
      nextStatus === "active"
        ? isSpanish
          ? "Expediente restaurado como activo."
          : "Record restored as active."
        : nextStatus === "archived"
          ? isSpanish
            ? "Expediente archivado."
            : "Record archived."
          : isSpanish
            ? "Expediente enviado a papelera."
            : "Record moved to trash."
    );
  };

  const uploadPatientPhoto = async (file: File) => {
    if (!patient) return;
    setPhotoUploading(true);

    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `patient-profiles/${patient.id}/profile.${extension}`;
    const { error: uploadError } = await supabase.storage.from("chat-files").upload(storagePath, file, { upsert: true });

    if (uploadError) {
      setPhotoUploading(false);
      setPageError(uploadError.message || t.uploadError);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("patients")
      .update({ profile_picture_url: publicUrl.publicUrl })
      .eq("id", patient.id)
      .select()
      .single();

    setPhotoUploading(false);

    if (error) {
      setPageError(error.message || t.uploadError);
      return;
    }

    setPatient(data as PatientRecord);
    updateSuccess(t.photoSaved);
  };

  const exportRecord = async () => {
    if (!bundle || !patient) return;
    setExporting(true);

    try {
      const html = buildExportHtml({
        title: `${isSpanish ? "Expediente exportado" : "Exported record"} · ${patient.full_name || t.unnamedPatient}`,
        subtitle: isSpanish
          ? "Incluye procedimientos, sedes, historial completo y medios relacionados."
          : "Includes procedures, offices, full history, and related media.",
        bundles: [bundle],
        staffById,
        generatedBy: viewerProfile?.full_name || viewerEmail,
      });

      const fileName = `expediente-${sanitizeFileName(patient.full_name || "patient")}.html`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const exportFile = new File([blob], fileName, { type: "text/html" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      const isTouchDevice =
        /iPhone|iPad|Android/i.test(window.navigator.userAgent) ||
        window.matchMedia("(max-width: 900px)").matches;

      if (typeof nav.share === "function") {
        const shareData: ShareData = {
          title: patient.full_name || t.unnamedPatient,
          text: isSpanish
            ? `Expediente de ${patient.full_name || t.unnamedPatient}`
            : `${patient.full_name || t.unnamedPatient} record`,
        };

        if (typeof nav.canShare === "function" && nav.canShare({ files: [exportFile] })) {
          shareData.files = [exportFile];
        }

        try {
          await nav.share(shareData);
          updateSuccess(t.shareOpened);
          return;
        } catch (shareError: any) {
          if (shareError?.name === "AbortError") {
            setExporting(false);
            return;
          }
        }
      }

      if (isTouchDevice) {
        const previewUrl = URL.createObjectURL(blob);
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
        updateSuccess(t.sharePreview);
        return;
      }

      downloadFile(fileName, html, "text/html;charset=utf-8");
      updateSuccess(t.recordDownloaded);
    } catch (error: any) {
      setPageError(error?.message || (isSpanish ? "No pude exportar este expediente." : "I could not export this record."));
    } finally {
      setExporting(false);
    }
  };

  const renderTimelineBody = (entry: (typeof timeline)[number]) => {
    const { message } = entry;
    const cleanFileName = (message.file_name || "").replace(/^\[(MED|BEFORE)\]\s*/i, "");

    if (message.deleted_by_staff || message.deleted_by_patient) {
      return <p className="body-muted">{t.deletedMessage}</p>;
    }

    if (message.message_type === "image" && message.content) {
      return (
        <div className="preview-wrap">
          <img src={message.content} alt="" className="media-preview image" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir imagen" : "Open image"}</a>
        </div>
      );
    }

    if (message.message_type === "video" && message.content) {
      return (
        <div className="preview-wrap">
          <video src={message.content} controls className="media-preview video" />
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir video" : "Open video"}</a>
        </div>
      );
    }

    if (message.message_type === "audio" && message.content) {
      return (
        <div className="preview-wrap">
          <audio src={message.content} controls style={{ width: "100%" }} />
          <p className="body-muted">{cleanFileName || (isSpanish ? "Audio del chat" : "Chat audio")}</p>
        </div>
      );
    }

    if (message.message_type === "file" && message.content) {
      return (
        <div className="preview-wrap">
          <p style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>{cleanFileName || (isSpanish ? "Archivo" : "File")}</p>
          <a href={message.content} target="_blank" rel="noopener noreferrer" className="open-link">{isSpanish ? "Abrir archivo" : "Open file"}</a>
        </div>
      );
    }

    return <p className="body-copy">{message.content || (isSpanish ? "Sin contenido" : "No content")}</p>;
  };

  const renderMediaGroup = (
    title: string,
    entries: typeof media.images,
    emptyLabel: string
  ) => (
    <section className="media-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">{title}</p>
          <p className="section-sub">{entries.length} {isSpanish ? "elemento(s)" : "item(s)"}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-mini">{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => {
            const senderProfile = entry.message.sender_id ? staffById.get(entry.message.sender_id) : null;
            const senderOffice =
              normalizeOffice(entry.message.sender_office) ||
              normalizeOffice(senderProfile?.office_location) ||
              normalizeOffice(entry.procedure.office_location) ||
              "";
            const cleanFileName = (entry.message.file_name || "").replace(/^\[(MED|BEFORE)\]\s*/i, "");

            return (
              <div key={entry.message.id} className="media-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{cleanFileName || messageTypeText(entry.message)}</p>
                  <p className="body-muted">
                    {entry.message.sender_name || (isSpanish ? "Sin nombre" : "No name")} · {roleText(entry.message.sender_role || entry.message.sender_type || "staff")} · {senderOffice ? officeText(senderOffice) : t.noOffice}
                  </p>
                  <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                </div>
                {entry.message.content && (
                  <a href={entry.message.content} target="_blank" rel="noopener noreferrer" className="open-link">
                    {t.open}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  if (!sessionChecked || loading) {
    return (
      <>
        <style>{`
          .record-loading-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #0F172A 0%, #111827 45%, #1D4ED8 100%); padding: 24px; }
          .record-loading-card { width: 100%; max-width: 420px; background: white; border-radius: 26px; padding: 32px 28px; text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.35); }
          .spinner { width: 38px; height: 38px; border: 3px solid rgba(0,122,255,0.18); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 18px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="record-loading-page">
          <div className="record-loading-card">
            <div className="spinner" />
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{t.loadingTitle}</p>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6 }}>{t.loadingCopy}</p>
          </div>
        </div>
      </>
    );
  }

  if (!viewerEmail) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F5F7FB" }}>
        <div style={{ maxWidth: 460, background: "white", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>🔐</div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.signInTitle}</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>{t.signInCopy}</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/login")}>{t.signInButton}</button>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F5F7FB" }}>
        <div style={{ maxWidth: 460, background: "white", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>⛔</div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.noAccessTitle}</p>
          <p style={{ color: "#6B7280", lineHeight: 1.7 }}>{t.noAccessCopy}</p>
          <button style={{ marginTop: 14, padding: "14px 16px", border: "none", borderRadius: 14, background: "#007AFF", color: "white", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }} onClick={() => (window.location.href = "/inbox")}>{t.backToPortal}</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #F5F7FB; }
        .record-shell { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; background: linear-gradient(180deg, #EEF4FF 0%, #F8FAFC 28%, #F5F7FB 100%); }
        .record-topbar { position: sticky; top: 0; z-index: 50; min-height: calc(88px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(15,23,42,0.96); backdrop-filter: blur(18px); }
        .record-body { width: 100%; max-width: 1180px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) calc(50px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
        .topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .topbar-btn { height: 42px; padding: 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }
        .topbar-select { appearance: none; -webkit-appearance: none; width: 152px; height: 42px; padding: 0 36px 0 13px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; background-image: linear-gradient(45deg, transparent 50%, #374151 50%), linear-gradient(135deg, #374151 50%, transparent 50%); background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px); background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; }
        .menu-btn { display: none; width: 42px; height: 42px; border-radius: 12px; border: none; background: #EFF3F8; color: #111827; cursor: pointer; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .menu-panel { display: none; }
        .hero { background: linear-gradient(135deg, #111827, #1D4ED8); color: white; border-radius: 28px; padding: 24px; box-shadow: 0 18px 45px rgba(29,78,216,0.16); margin-bottom: 18px; }
        .hero-grid, .grid-2, .grid-4 { display: grid; gap: 16px; }
        .hero-grid { grid-template-columns: 1.1fr 0.9fr; align-items: center; }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; }
        .card, .stat-card, .timeline-card, .media-card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 8px 28px rgba(15,23,42,0.06); }
        .stat-card { padding: 18px 16px; }
        .big-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .hero-copy { color: rgba(255,255,255,0.86); font-size: 15px; line-height: 1.6; }
        .section-kicker { font-size: 13px; font-weight: 900; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; }
        .section-sub { font-size: 14px; color: #64748B; margin: 0; line-height: 1.6; }
        .main-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #007AFF; color: white; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .main-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ghost-btn { padding: 14px 16px; border-radius: 14px; border: none; background: #EFF3F8; color: #111827; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit; }
        .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .meta-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
        .value-display { font-size: 30px; font-weight: 900; color: #111827; margin-top: 4px; }
        .muted { color: #6B7280; font-size: 14px; line-height: 1.65; }
        .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .procedure-list { display: grid; gap: 12px; }
        .procedure-item { border: 1px solid #E5EDF6; border-radius: 16px; padding: 14px 16px; background: #FCFDFF; }
        .media-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #EEF2F7; }
        .media-item:last-child { border-bottom: none; padding-bottom: 0; }
        .empty-mini { border: 1px dashed #D6E0EB; border-radius: 16px; padding: 16px; text-align: center; color: #6B7280; background: #FAFCFF; }
        .open-link { display: inline-flex; align-items: center; justify-content: center; padding: 10px 12px; border-radius: 12px; background: #EFF6FF; color: #1D4ED8; font-weight: 800; text-decoration: none; white-space: nowrap; }
        .timeline-list { display: grid; gap: 14px; }
        .timeline-item { border: 1px solid #E5EDF6; border-radius: 18px; padding: 16px; background: #FCFDFF; }
        .timeline-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .body-copy { color: #111827; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word; }
        .body-muted { color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0; }
        .preview-wrap { display: grid; gap: 10px; }
        .media-preview { width: 100%; border-radius: 16px; background: #E5E7EB; }
        .media-preview.image { max-width: 340px; object-fit: cover; }
        .media-preview.video { max-width: 420px; }
        .toast-stack { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 160; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
        .toast { border-radius: 16px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(15,23,42,0.16); font-size: 14px; font-weight: 800; line-height: 1.5; }
        .toast.error { background: #FFF1F2; color: #E11D48; }
        .toast.success { background: #EDFAF1; color: #15803D; }
        .line-input { width: 100%; padding: 13px 14px; background: #F3F4F6; border: 1px solid transparent; border-radius: 14px; font-size: 15px; color: #111827; font-family: inherit; outline: none; }
        .line-input:focus { background: white; border-color: rgba(0,122,255,0.4); }
        .field-label { font-size: 12px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .photo-card { display: grid; gap: 14px; align-content: start; }
        .patient-photo { width: 124px; height: 124px; border-radius: 22px; object-fit: cover; background: #E5E7EB; box-shadow: 0 10px 24px rgba(15,23,42,0.12); }
        .photo-fallback { width: 124px; height: 124px; border-radius: 22px; background: linear-gradient(135deg,#111827,#1D4ED8); display: flex; align-items: center; justify-content: center; color: white; font-size: 34px; font-weight: 900; }
        .photo-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        @media (max-width: 980px) {
          .hero-grid, .grid-2, .grid-4 { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .record-topbar { position: static; min-height: calc(84px + env(safe-area-inset-top)); padding-bottom: 14px; }
          .topbar-right { display: none; }
          .menu-btn { display: inline-flex; }
          .menu-panel { display: grid; gap: 10px; background: rgba(15,23,42,0.98); border-top: 1px solid rgba(255,255,255,0.08); padding: 0 max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); }
          .menu-panel .topbar-select,
          .menu-panel .topbar-btn { width: 100%; }
          .topbar-btn { text-align: center; padding: 12px 12px; font-size: 13px; }
          .toast-stack { right: 12px; left: 12px; width: auto; }
          .timeline-top, .section-head, .media-item { flex-direction: column; }
        }
      `}</style>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadPatientPhoto(file);
          event.target.value = "";
        }}
      />

      <div className="record-shell">
        <div className="record-topbar">
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>{t.recordTitle}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: 0 }}>{t.recordSubtitle}</p>
          </div>
          <div className="topbar-right">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <div className="topbar-actions">
              <button className="topbar-btn" onClick={() => goTo("/admin")}>{t.backToCenter}</button>
              <button className="topbar-btn" onClick={() => goTo("/inbox")}>{t.goToPortal}</button>
              <button className="topbar-btn" style={{ background: "#007AFF", color: "white" }} onClick={exportRecord} disabled={!bundle || exporting}>
                {exporting ? t.exporting : t.exportRecord}
              </button>
            </div>
          </div>
          <button
            className="menu-btn"
            aria-label={mobileMenuOpen ? (isSpanish ? "Cerrar menú" : "Close menu") : (isSpanish ? "Abrir menú" : "Open menu")}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="menu-panel">
            <select className="topbar-select" value={lang} onChange={(event) => setLang(event.target.value as "es" | "en")}>
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="topbar-btn" onClick={() => goTo("/admin")}>{t.backToCenter}</button>
            <button className="topbar-btn" onClick={() => goTo("/inbox")}>{t.goToPortal}</button>
            <button className="topbar-btn" style={{ background: "#007AFF", color: "white" }} onClick={exportRecord} disabled={!bundle || exporting}>
              {exporting ? t.exporting : t.exportRecord}
            </button>
          </div>
        )}

        <div className="record-body">
          {!patient ? (
            <div className="card">
              <p className="section-kicker">{t.unavailableTitle}</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 8 }}>{t.unavailableTitle}</p>
              <p className="muted">{t.unavailableCopy}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button className="main-btn" onClick={() => (window.location.href = "/admin")}>{t.backToCenter}</button>
                <button className="ghost-btn" onClick={fetchRecord}>{t.reload}</button>
              </div>
            </div>
          ) : (
            <>
              <section className="hero">
                <div className="hero-grid">
                  <div>
                    <h1 className="big-title">{patient.full_name || t.unnamedPatient}</h1>
                    <p className="hero-copy">{t.heroCopy}</p>
                    <div className="pill-row">
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ☎️ {patient.phone || t.noPhone}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        ✉️ {patient.email || t.noEmail}
                      </span>
                      <span className="meta-badge" style={{ color: "#1D4ED8", background: "rgba(255,255,255,0.92)" }}>
                        🎂 {formatDateLocal(patient.birthdate)}
                      </span>
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(255,255,255,0.12)", color: "white", boxShadow: "none" }}>
                    <p className="section-kicker" style={{ color: "rgba(255,255,255,0.72)" }}>{t.relatedOffices}</p>
                    <div className="pill-row">
                      {offices.length > 0 ? (
                        offices.map((office) => (
                          <span key={office} className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>
                            {officeText(office)}
                          </span>
                        ))
                      ) : (
                        <span className="meta-badge" style={{ color: "#111827", background: "rgba(255,255,255,0.92)" }}>{t.noOffice}</span>
                      )}
                    </div>
                    <p className="hero-copy" style={{ marginTop: 12 }}>{t.heroHelper}</p>
                  </div>
                </div>
              </section>

              <section className="grid-4">
                <div className="stat-card">
                  <p className="section-kicker">{isSpanish ? "Procedimientos" : "Procedures"}</p>
                  <div className="value-display">{procedures.length}</div>
                  <p className="muted">{isSpanish ? "Relacionados al paciente" : "Linked to the patient"}</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">{isSpanish ? "Salas" : "Rooms"}</p>
                  <div className="value-display">{rooms.length}</div>
                  <p className="muted">{isSpanish ? "Chats o salas del expediente" : "Chats or record rooms"}</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">{isSpanish ? "Eventos" : "Events"}</p>
                  <div className="value-display">{timeline.length}</div>
                  <p className="muted">{isSpanish ? "Mensajes y archivos en historial" : "Messages and files in history"}</p>
                </div>
                <div className="stat-card">
                  <p className="section-kicker">{isSpanish ? "Medios" : "Media"}</p>
                  <div className="value-display">{media.images.length + media.videos.length + media.audios.length + media.files.length}</div>
                  <p className="muted">{isSpanish ? "Imágenes, videos, audios y archivos" : "Images, videos, audio files, and files"}</p>
                </div>
              </section>

              <div className="grid-2">
                <section className="card">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.basicInfo}</p>
                      <p className="section-sub">{t.basicInfoCopy}</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="field-label">{isSpanish ? "Nombre completo" : "Full name"}</label>
                      <input className="line-input" value={patientDraft.full_name} onChange={(event) => setPatientDraft((prev) => ({ ...prev, full_name: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Teléfono" : "Phone"}</label>
                      <input className="line-input" value={patientDraft.phone} onChange={(event) => setPatientDraft((prev) => ({ ...prev, phone: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Correo" : "Email"}</label>
                      <input className="line-input" type="email" value={patientDraft.email} onChange={(event) => setPatientDraft((prev) => ({ ...prev, email: event.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">{isSpanish ? "Fecha de nacimiento" : "Birth date"}</label>
                      <input className="line-input" type="date" value={patientDraft.birthdate} onChange={(event) => setPatientDraft((prev) => ({ ...prev, birthdate: event.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    <button className="main-btn" onClick={savePatientInfo} disabled={savingPatient}>
                      {savingPatient ? t.savingPatient : t.savePatient}
                    </button>
                  </div>

                  <div className="procedure-list" style={{ marginTop: 16 }}>
                    <div className="procedure-item">
                      <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>{t.quickSummary}</p>
                      <p className="muted">{t.lastEvent}: {timeline.length ? formatDateTimeLocal(timeline[timeline.length - 1]?.message.created_at) : t.noActivity}</p>
                      <p className="muted">{t.firstRoom}: {rooms.length ? formatDateTimeLocal(rooms[0]?.created_at) : t.noRooms}</p>
                    </div>
                  </div>
                </section>

                <section className="card photo-card">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">{t.patientPhoto}</p>
                      <p className="section-sub">{t.uploadPhotoHelp}</p>
                    </div>
                  </div>

                  {patient.profile_picture_url ? (
                    <img src={patient.profile_picture_url} alt="" className="patient-photo" />
                  ) : (
                    <div className="photo-fallback">{initials(patient.full_name)}</div>
                  )}

                  <div className="photo-actions">
                    <button className="main-btn" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                      {photoUploading ? (isSpanish ? "Subiendo..." : "Uploading...") : patient.profile_picture_url ? t.changePhoto : t.addPhoto}
                    </button>
                  </div>

                  <div className="procedure-item">
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>{t.recordStatus}</p>
                    <p className="muted" style={{ marginBottom: 10 }}>{t.recordStatusCopy}</p>
                    <div className="pill-row">
                      {([
                        ["active", t.active],
                        ["archived", t.archived],
                        ["trash", t.trash],
                      ] as Array<[PatientRecordStatus, string]>).map(([status, label]) => (
                        <button
                          key={status}
                          className="ghost-btn"
                          style={{
                            background: patientStatus === status ? `${recordStatusColor(status)}18` : "#EFF3F8",
                            color: patientStatus === status ? recordStatusColor(status) : "#111827",
                            opacity: statusSaving && statusSaving !== status ? 0.7 : 1,
                          }}
                          disabled={Boolean(statusSaving)}
                          onClick={() => changeRecordStatus(status)}
                        >
                          {statusSaving === status ? (isSpanish ? "Guardando..." : "Saving...") : label}
                        </button>
                      ))}
                    </div>
                    <p className="muted" style={{ marginTop: 10 }}>
                      {isSpanish ? "Estado actual" : "Current status"}: {recordStatusText(patientStatus)}
                    </p>
                  </div>
                </section>
              </div>

              <section className="card" style={{ marginTop: 16 }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.proceduresTitle}</p>
                    <p className="section-sub">{t.proceduresCopy}</p>
                  </div>
                </div>
                <div className="procedure-list">
                  {procedures.length === 0 ? (
                    <div className="empty-mini">{t.noProcedures}</div>
                  ) : (
                    procedures.map((procedure) => {
                      const relatedRooms = rooms.filter((room) => room.procedure_id === procedure.id);
                      const draft = procedureDrafts[procedure.id] || {
                        procedure_name: procedure.procedure_name || "",
                        office_location: normalizeOffice(procedure.office_location),
                        status: procedure.status || "",
                        surgery_date: procedure.surgery_date || "",
                      };

                      return (
                        <div key={procedure.id} className="procedure-item">
                          <div className="form-grid">
                            <div>
                              <label className="field-label">{isSpanish ? "Procedimiento" : "Procedure"}</label>
                              <input
                                className="line-input"
                                value={draft.procedure_name}
                                onChange={(event) =>
                                  setProcedureDrafts((prev) => ({
                                    ...prev,
                                    [procedure.id]: { ...draft, procedure_name: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="field-label">{isSpanish ? "Estatus" : "Status"}</label>
                              <input
                                className="line-input"
                                value={draft.status}
                                onChange={(event) =>
                                  setProcedureDrafts((prev) => ({
                                    ...prev,
                                    [procedure.id]: { ...draft, status: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="field-label">{isSpanish ? "Fecha de cirugía" : "Surgery date"}</label>
                              <input
                                className="line-input"
                                type="date"
                                value={draft.surgery_date}
                                onChange={(event) =>
                                  setProcedureDrafts((prev) => ({
                                    ...prev,
                                    [procedure.id]: { ...draft, surgery_date: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="field-label">{isSpanish ? "Sede" : "Office"}</label>
                              <div className="pill-row" style={{ marginTop: 0 }}>
                                {(["Guadalajara", "Tijuana"] as Office[]).map((office) => (
                                  <button
                                    key={`${procedure.id}-${office}`}
                                    className="ghost-btn"
                                    style={{
                                      background: draft.office_location === office ? "#DBEAFE" : "#EFF3F8",
                                      color: draft.office_location === office ? "#1D4ED8" : "#111827",
                                    }}
                                    onClick={() =>
                                      setProcedureDrafts((prev) => ({
                                        ...prev,
                                        [procedure.id]: { ...draft, office_location: office },
                                      }))
                                    }
                                  >
                                    {office === "Guadalajara" ? "🏙️ Guadalajara" : "🌊 Tijuana"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                            <button className="main-btn" onClick={() => saveProcedure(procedure.id)} disabled={savingProcedureId === procedure.id}>
                              {savingProcedureId === procedure.id ? t.savingProcedure : t.saveProcedure}
                            </button>
                            <span className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                              {t.roomsRelated}: {relatedRooms.length}
                            </span>
                            <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                              {draft.office_location ? officeText(draft.office_location) : t.noOffice}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="card" style={{ marginTop: 16 }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.mediaTitle}</p>
                    <p className="section-sub">{t.mediaCopy}</p>
                  </div>
                </div>
                <div className="grid-2">
                  {renderMediaGroup(t.images, media.images, t.noImages)}
                  {renderMediaGroup(t.videos, media.videos, t.noVideos)}
                  {renderMediaGroup(t.audios, media.audios, t.noAudios)}
                  {renderMediaGroup(t.files, media.files, t.noFiles)}
                </div>
              </section>

              <section className="card" style={{ marginTop: 16 }}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">{t.timelineTitle}</p>
                    <p className="section-sub">{t.timelineCopy}</p>
                  </div>
                </div>

                {timeline.length === 0 ? (
                  <div className="empty-mini">{t.noTimeline}</div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((entry) => {
                      const senderProfile = entry.message.sender_id ? staffById.get(entry.message.sender_id) : null;
                      const senderOffice =
                        normalizeOffice(entry.message.sender_office) ||
                        normalizeOffice(senderProfile?.office_location) ||
                        normalizeOffice(entry.procedure.office_location) ||
                        "";

                      return (
                        <div key={entry.message.id} className="timeline-item">
                          <div className="timeline-top">
                            <div>
                              <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
                                {entry.message.sender_name || (entry.message.sender_type === "patient" ? patient.full_name || t.unnamedPatient : isSpanish ? "Staff" : "Staff")}
                              </p>
                              <div className="pill-row">
                                <span className="meta-badge" style={{ color: roleColor(entry.message.sender_role || entry.message.sender_type), background: `${roleColor(entry.message.sender_role || entry.message.sender_type)}18` }}>
                                  {roleText(entry.message.sender_role || entry.message.sender_type || "staff")}
                                </span>
                                <span className="meta-badge" style={{ color: "#1D4ED8", background: "#EFF6FF" }}>
                                  {officeText(senderOffice)}
                                </span>
                                <span className="meta-badge" style={{ color: "#166534", background: "#ECFDF5" }}>
                                  {messageTypeText(entry.message)}
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p className="body-muted">{formatDateTimeLocal(entry.message.created_at)}</p>
                              <p className="body-muted">{t.roomLabel}: {entry.room.id.slice(0, 8)}</p>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 10 }}>
                            {renderTimelineBody(entry)}
                            <div style={{ borderTop: "1px solid #EEF2F7", paddingTop: 10 }}>
                              <p className="body-muted">{t.procedureLabel}: {entry.procedure.procedure_name || (isSpanish ? "Sin procedimiento" : "No procedure")}</p>
                              <p className="body-muted">{t.reasonLabel}: {messageReasonText(entry.message, entry.procedure)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="toast-stack" aria-live="polite">
          {pageError && <div className="toast error">⚠️ {pageError}</div>}
          {successMsg && <div className="toast success">✅ {successMsg}</div>}
        </div>
      </div>
    </>
  );
}
