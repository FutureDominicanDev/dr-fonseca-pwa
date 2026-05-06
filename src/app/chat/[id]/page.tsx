"use client";

import { Fragment, use, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabase } from "@/lib/supabaseClient";
import { syncPushSubscription } from "@/lib/pushSubscriptions";
import {
  FormMessage,
  createClinicalHistoryPayload,
  parseFormMessage,
  serializeFormMessage,
  type FormMessagePayload,
} from "@/components/FormMessage";

type Message = {
  id: string;
  content: string;
  sender_id?: string | null;
  sender_type?: string;
  sender_name?: string | null;
  sender_role?: string | null;
  type?: "text" | "image" | "video" | "audio" | "file";
  message_type: "text" | "image" | "video" | "audio" | "file";
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  message_hash?: string | null;
  deleted_by_patient?: boolean | null;
  deleted_by_staff?: boolean | null;
  deleted_at?: string | null;
  created_at?: string;
};

type RoomAccess = {
  id: string;
  patient_access_token?: string | null;
  procedures?: {
    office_location?: string | null;
    patients?: {
      full_name?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
};

const normalizeUiLang = (value?: string | null): "es" | "en" | null => {
  const normalized = `${value || ""}`.toLowerCase();
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("en")) return "en";
  return null;
};

const HISTORIA_CLINICA_TEMPLATE_URL = "/documents/historia-clinica.pdf";
const HISTORIA_CLINICA_FILE_NAME = "[FORM] Historia Clinica.pdf";
const CLINICAL_PDF_HEIGHT = 792;

type ClinicalPdfFieldKey =
  | "nombre"
  | "fechaHora"
  | "fechaNacimiento"
  | "ocupacion"
  | "escolaridad"
  | "edad"
  | "religion"
  | "estadoCivil"
  | "telefono"
  | "peso"
  | "direccion"
  | "talla"
  | "imc"
  | "diabetes"
  | "nefropatias"
  | "hipertension"
  | "malformaciones"
  | "cancer"
  | "otrosFamiliares"
  | "cardiopatias"
  | "tabaquismo"
  | "alcoholismo"
  | "medicamentos"
  | "vitaminas"
  | "otrasSustancias"
  | "tipoSanguineo"
  | "alimentosNoConsume"
  | "infancia"
  | "hospitalizaciones"
  | "quirurgicos"
  | "transfusiones"
  | "traumatismos"
  | "otrasEnfermedades"
  | "psicologico"
  | "embarazos"
  | "cesareas"
  | "abortos";

type ClinicalPdfField = {
  key: ClinicalPdfFieldKey;
  labelEs: string;
  labelEn: string;
  left: number;
  top: number;
  width: number;
  height: number;
  pdfSize?: number;
  maxLines?: number;
};

type ClinicalPdfSection = {
  titleEs: string;
  titleEn: string;
  keys: ClinicalPdfFieldKey[];
};

const clinicalPdfFields: ClinicalPdfField[] = [
  { key: "nombre", labelEs: "NOMBRE:", labelEn: "Name", left: 113, top: 121, width: 263, height: 17 },
  { key: "fechaHora", labelEs: "FECHA Y HORA:", labelEn: "Date and time", left: 459, top: 121, width: 122, height: 17 },
  { key: "fechaNacimiento", labelEs: "F. DE NACIMIENTO:", labelEn: "Date of birth", left: 113, top: 142, width: 263, height: 17 },
  { key: "ocupacion", labelEs: "OCUPACION:", labelEn: "Occupation", left: 459, top: 142, width: 122, height: 17 },
  { key: "escolaridad", labelEs: "ESCOLARIDAD:", labelEn: "Education", left: 113, top: 163, width: 263, height: 17 },
  { key: "edad", labelEs: "EDAD:", labelEn: "Age", left: 459, top: 163, width: 122, height: 17 },
  { key: "religion", labelEs: "RELIGION:", labelEn: "Religion", left: 113, top: 184, width: 263, height: 17 },
  { key: "estadoCivil", labelEs: "ESTADO CIVIL:", labelEn: "Marital status", left: 459, top: 184, width: 122, height: 17 },
  { key: "telefono", labelEs: "TELEFONO:", labelEn: "Phone", left: 113, top: 205, width: 263, height: 17 },
  { key: "peso", labelEs: "PESO:", labelEn: "Weight", left: 459, top: 205, width: 122, height: 17 },
  { key: "direccion", labelEs: "DIRECCION:", labelEn: "Address", left: 113, top: 226, width: 263, height: 17 },
  { key: "talla", labelEs: "TALLA:", labelEn: "Height", left: 459, top: 226, width: 53, height: 17 },
  { key: "imc", labelEs: "IMC", labelEn: "BMI", left: 545, top: 226, width: 36, height: 17, pdfSize: 6.5 },
  { key: "diabetes", labelEs: "DIABETES:", labelEn: "Diabetes", left: 144, top: 273, width: 159, height: 17 },
  { key: "nefropatias", labelEs: "NEFROPATIAS:", labelEn: "Kidney disease", left: 414, top: 273, width: 167, height: 17 },
  { key: "hipertension", labelEs: "HIPERTENSION:", labelEn: "High blood pressure", left: 144, top: 294, width: 159, height: 17 },
  { key: "malformaciones", labelEs: "MALFORMACIONES:", labelEn: "Malformations", left: 414, top: 294, width: 167, height: 17 },
  { key: "cancer", labelEs: "CANCER:", labelEn: "Cancer", left: 144, top: 315, width: 159, height: 17 },
  { key: "otrosFamiliares", labelEs: "OTROS:", labelEn: "Other", left: 414, top: 315, width: 167, height: 37, maxLines: 2 },
  { key: "cardiopatias", labelEs: "CARDIOPATIAS:", labelEn: "Heart disease", left: 144, top: 336, width: 159, height: 17 },
  { key: "tabaquismo", labelEs: "TABAQUISMO: FRECUENCIA Y DURACION?", labelEn: "Smoking: frequency and duration?", left: 281, top: 380, width: 300, height: 17 },
  { key: "alcoholismo", labelEs: "ALCOHOLISMO: FRECUENCIA Y DURACION?", labelEn: "Alcohol use: frequency and duration?", left: 281, top: 401, width: 300, height: 17 },
  { key: "medicamentos", labelEs: "MEDICAMENTOS: FRECUENCIA Y DURACION?", labelEn: "Medications: frequency and duration?", left: 281, top: 422, width: 300, height: 17 },
  { key: "vitaminas", labelEs: "VITAMINAS O SUPLEMENTOS: FRECUENCIA Y DURACION?", labelEn: "Vitamins or supplements: frequency and duration?", left: 281, top: 443, width: 300, height: 17 },
  { key: "otrasSustancias", labelEs: "OTRAS SUSTANCIAS: FRECUENCIA Y DURACION?", labelEn: "Other substances: frequency and duration?", left: 281, top: 464, width: 300, height: 17 },
  { key: "tipoSanguineo", labelEs: "TIPO SANGUINEO:", labelEn: "Blood type", left: 160, top: 485, width: 421, height: 17 },
  { key: "alimentosNoConsume", labelEs: "ALIMENTOS QUE NO CONSUME:", labelEn: "Foods you do not eat", left: 160, top: 506, width: 421, height: 17 },
  { key: "infancia", labelEs: "ENF. DE LA INFANCIA:", labelEn: "Childhood illnesses", left: 160, top: 550, width: 421, height: 17 },
  { key: "hospitalizaciones", labelEs: "HOSPITALIZACIONES PREVIAS:", labelEn: "Previous hospitalizations", left: 160, top: 571, width: 421, height: 17 },
  { key: "quirurgicos", labelEs: "ANTECEDENTES QUIRURGICOS:", labelEn: "Surgical history", left: 160, top: 592, width: 421, height: 17 },
  { key: "transfusiones", labelEs: "TRANSFUSIONES PREVIAS:", labelEn: "Previous transfusions", left: 160, top: 613, width: 421, height: 17 },
  { key: "traumatismos", labelEs: "TRAUMATISMOS / FRACTURAS:", labelEn: "Trauma / fractures", left: 160, top: 634, width: 421, height: 17 },
  { key: "otrasEnfermedades", labelEs: "OTRAS ENFERMEDADES:", labelEn: "Other illnesses", left: 160, top: 655, width: 421, height: 17 },
  { key: "psicologico", labelEs: "PSICOLOGICO/PSIQUIATRICO", labelEn: "Psychological / psychiatric", left: 160, top: 676, width: 421, height: 17 },
  { key: "embarazos", labelEs: "EMBARAZOS (CUANTOS Y FECHAS)", labelEn: "Pregnancies (how many and dates)", left: 134, top: 726, width: 75, height: 17, pdfSize: 6.5 },
  { key: "cesareas", labelEs: "CESAREAS (CUANTAS Y FECHAS)", labelEn: "C-sections (how many and dates)", left: 315, top: 726, width: 88, height: 17, pdfSize: 6.5 },
  { key: "abortos", labelEs: "ABORTOS (CUANTOS Y FECHAS)", labelEn: "Miscarriages/abortions (how many and dates)", left: 508, top: 726, width: 74, height: 17, pdfSize: 6.5 },
];

const clinicalPdfSections: ClinicalPdfSection[] = [
  {
    titleEs: "FICHA DE PRESENTACION",
    titleEn: "Patient information",
    keys: ["nombre", "fechaHora", "fechaNacimiento", "ocupacion", "escolaridad", "edad", "religion", "estadoCivil", "telefono", "peso", "direccion", "talla", "imc"],
  },
  {
    titleEs: "ANTECEDENTES HEREDOFAMILIARES (MAMA, PAPA, ABUELOS O TIOS)",
    titleEn: "Family history (mother, father, grandparents, uncles/aunts)",
    keys: ["diabetes", "nefropatias", "hipertension", "malformaciones", "cancer", "otrosFamiliares", "cardiopatias"],
  },
  {
    titleEs: "ANTECEDENTES PERSONALES NO PATOLOGICOS",
    titleEn: "Non-pathological personal history",
    keys: ["tabaquismo", "alcoholismo", "medicamentos", "vitaminas", "otrasSustancias", "tipoSanguineo", "alimentosNoConsume"],
  },
  {
    titleEs: "ANTECEDENTES PERSONALES PATOLOGICOS",
    titleEn: "Pathological personal history",
    keys: ["infancia", "hospitalizaciones", "quirurgicos", "transfusiones", "traumatismos", "otrasEnfermedades", "psicologico"],
  },
  {
    titleEs: "ANTECEDENTES GINECO-OBSTETRICOS",
    titleEn: "Gynecologic-obstetric history",
    keys: ["embarazos", "cesareas", "abortos"],
  },
];

const clinicalPdfFieldByKey = clinicalPdfFields.reduce((fields, field) => {
  fields[field.key] = field;
  return fields;
}, {} as Record<ClinicalPdfFieldKey, ClinicalPdfField>);

const clinicalPdfTextAreaFields = new Set<ClinicalPdfFieldKey>([
  "direccion",
  "otrosFamiliares",
  "medicamentos",
  "vitaminas",
  "otrasSustancias",
  "alimentosNoConsume",
  "infancia",
  "hospitalizaciones",
  "quirurgicos",
  "transfusiones",
  "traumatismos",
  "otrasEnfermedades",
  "psicologico",
]);

const createEmptyClinicalPdfValues = (): Record<ClinicalPdfFieldKey, string> =>
  clinicalPdfFields.reduce((values, field) => {
    values[field.key] = "";
    return values;
  }, {} as Record<ClinicalPdfFieldKey, string>);

const normalizeClinicalPdfValues = (input: unknown): Record<ClinicalPdfFieldKey, string> | null => {
  if (!input || typeof input !== "object") return null;
  const source = input as Partial<Record<ClinicalPdfFieldKey, unknown>>;
  const values = createEmptyClinicalPdfValues();
  let hasValue = false;
  clinicalPdfFields.forEach((field) => {
    const value = source[field.key];
    if (typeof value !== "string") return;
    values[field.key] = value;
    if (value.trim()) hasValue = true;
  });
  return hasValue ? values : null;
};

const splitPdfText = (text: string, font: PDFFont, fontSize: number, maxWidth: number) => {
  const lines: string[] = [];
  text.replace(/\r/g, "").split("\n").forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        line = next;
        return;
      }
      if (line) lines.push(line);
      line = word;
    });
    if (line) lines.push(line);
  });
  return lines;
};

const drawWrappedPdfText = (page: PDFPage, font: PDFFont, field: ClinicalPdfField, value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return;
  const fontSize = field.pdfSize || 7.2;
  const lineHeight = fontSize + 2;
  const x = field.left + 4;
  const y = CLINICAL_PDF_HEIGHT - field.top - 12;
  const lines = splitPdfText(cleaned, font, fontSize, field.width - 8).slice(0, field.maxLines || 1);

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - (index * lineHeight),
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: field.width - 8,
    });
  });
};

const deviceUiLang = (): "es" | "en" => {
  if (typeof navigator === "undefined") return "es";
  const options = [navigator.language, ...(navigator.languages || [])];
  return options.map((entry) => normalizeUiLang(entry)).find(Boolean) || "es";
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
  const [quickRepliesManageOpen, setQuickRepliesManageOpen] = useState(false);
  const [clinicalFormOpen, setClinicalFormOpen] = useState(false);
  const [documentFolderOpen, setDocumentFolderOpen] = useState(false);
  const [clinicalPdfEditorOpen, setClinicalPdfEditorOpen] = useState(false);
  const [clinicalPdfLanguage, setClinicalPdfLanguage] = useState<"es" | "en">(() => deviceUiLang());
  const [clinicalPdfValues, setClinicalPdfValues] = useState<Record<ClinicalPdfFieldKey, string>>(() => createEmptyClinicalPdfValues());
  const [clinicalPdfSaving, setClinicalPdfSaving] = useState(false);
  const [prescriptionsOpen, setPrescriptionsOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Message | null>(null);
  const [lastPrescriptionSeenAt, setLastPrescriptionSeenAt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(["Gracias", "Tengo una pregunta", "Voy en camino"]);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingReplyIndex, setEditingReplyIndex] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [recording, setRecording] = useState(false);
  const [uiLang, setUiLang] = useState<"es" | "en">(() => deviceUiLang());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState("");
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [room, setRoom] = useState<RoomAccess | null>(null);
  const [fileAccept, setFileAccept] = useState("*");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior, block: "end" }));
  };
  const setComposerText = (value: string) => {
    setText(value);
    if (composerRef.current && composerRef.current.textContent !== value) {
      composerRef.current.textContent = value;
    }
    setQuickRepliesOpen(value.startsWith("/"));
  };
  const applyComposerInputHints = (node: HTMLDivElement | null) => {
    if (!node) return;
    node.setAttribute("autocomplete", "off");
    node.setAttribute("autocorrect", "off");
    node.setAttribute("autocapitalize", "sentences");
    node.setAttribute("enterkeyhint", "send");
    node.setAttribute("inputmode", "text");
    node.spellcheck = false;
  };
  const setComposerNode = (node: HTMLDivElement | null) => {
    composerRef.current = node;
    applyComposerInputHints(node);
  };
  const prescriptionSeenKey = `patient_seen_recetas_${id}`;
  const clinicalPdfValuesStorageKey = `historia_clinica_values_${id}`;
  const clinicalPdfValuesStoragePath = `patients/${id}/historia-clinica-values.json`;

  const urlBase64ToUint8Array = (b64: string) => {
    const padding = "=".repeat((4 - (b64.length % 4)) % 4);
    const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  };

  const subscribePatientToPush = useCallback(async () => {
    if (typeof window === "undefined" || !accessReady || accessDenied || !token) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await syncPushSubscription({
      subscription: subscription.toJSON(),
      userType: "patient",
      roomId: id,
      roomToken: token,
    });
  }, [accessDenied, accessReady, id, token]);

  const requestPatientNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotificationFeedback(uiLang === "es" ? "Este dispositivo no soporta alertas." : "This device does not support alerts.");
      return;
    }

    setNotificationBusy(true);
    setNotificationFeedback("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        await subscribePatientToPush();
        setNotificationFeedback(uiLang === "es" ? "Alertas activadas en este dispositivo." : "Alerts are enabled on this device.");
      } else if (permission === "denied") {
        setNotificationFeedback(uiLang === "es" ? "Las alertas están bloqueadas en este dispositivo." : "Alerts are blocked on this device.");
      } else {
        setNotificationFeedback(uiLang === "es" ? "Permiso pendiente." : "Permission is still pending.");
      }
    } catch {
      setNotificationFeedback(uiLang === "es" ? "No pude activar alertas." : "I could not enable alerts.");
    } finally {
      setNotificationBusy(false);
    }
  }, [subscribePatientToPush, uiLang]);

  const patientDisplayName = useCallback(() => {
    const patient = room?.procedures?.patients as any;
    const name = Array.isArray(patient) ? patient[0]?.full_name : patient?.full_name;
    return name || (uiLang === "es" ? "Paciente" : "Patient");
  }, [room, uiLang]);

  const sendStaffPushNotification = useCallback((body: string, audience?: "advanced_assigned") => {
    if (!token || !body.trim()) return;
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: id,
        roomToken: token,
        userType: "staff",
        title: patientDisplayName(),
        body: body.trim().slice(0, 300),
        url: "/inbox",
        tag: id,
        audience,
      }),
    }).catch(() => {});
  }, [id, patientDisplayName, token]);

  useEffect(() => {
    setUiLang(deviceUiLang());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    if (notificationPermission === "granted") subscribePatientToPush().catch(() => {});
  }, [notificationPermission, subscribePatientToPush]);

  useEffect(() => {
    const patient = room?.procedures?.patients;
    const patientLang = normalizeUiLang(Array.isArray(patient) ? patient[0]?.preferred_language : patient?.preferred_language);
    if (patientLang) setUiLang(patientLang);
  }, [room]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLastPrescriptionSeenAt(window.localStorage.getItem(prescriptionSeenKey) || "");
  }, [prescriptionSeenKey]);

  useEffect(() => {
    let mounted = true;

    const isSchemaColumnError = (error: unknown) => {
      const value = error as { message?: string; details?: string; hint?: string };
      const message = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
      return message.includes("column") || message.includes("schema cache") || message.includes("relation");
    };

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUserId(data.user?.id || null);
    });

    const validateRoom = async () => {
      setAccessReady(false);
      setAccessDenied(false);

      let roomQuery = await supabase
        .from("rooms")
        .select("id, patient_access_token, procedures(office_location, patients(full_name, preferred_language))")
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${id}`,
        },
        ({ new: message }: { new: Message }) => {
          setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id, token]);

  useEffect(() => {
    scrollToLatest();
  }, [messages]);

  const isLegacyRoomCreatedMessage = (message: Message) => {
    const normalized = `${message.content || ""}`.toLowerCase();
    return (
      normalized.includes("sala creada y equipo asignado") ||
      normalized.includes("room created and care team assigned")
    );
  };

  const translationKey = (messageId: string, targetLang: "es" | "en") => `${messageId}:${targetLang}`;

  useEffect(() => {
    if (!accessReady || viewerType !== "patient") return;
    const candidates = messages.filter((message) => (
      message.id &&
      message.message_type === "text" &&
      message.sender_type === "staff" &&
      !message.deleted_by_patient &&
      !message.deleted_by_staff &&
      !isLegacyRoomCreatedMessage(message) &&
      `${message.content || ""}`.trim()
    ));
    const missing = candidates.filter((message) => !translatedMessages[translationKey(message.id, uiLang)]).slice(-30);
    if (!missing.length) return;

    const controller = new AbortController();
    let cancelled = false;
    missing.forEach((message) => {
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content, targetLang: uiLang, sourceLang: "auto" }),
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (cancelled) return;
          const translatedText = `${data?.translatedText || message.content || ""}`.trim();
          setTranslatedMessages((current) => {
            const key = translationKey(message.id, uiLang);
            if (current[key]) return current;
            return { ...current, [key]: translatedText || message.content };
          });
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accessReady, messages, translatedMessages, uiLang, viewerType]);

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

    setComposerText("");
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
      sendStaffPushNotification(content);
    }
  };

  const latestClinicalFormMessage = [...messages]
    .reverse()
    .find((message) => message.sender_type === "patient" && parseFormMessage(message.content));
  const latestClinicalPdfMessage = [...messages]
    .reverse()
    .find((message) => (
      message.sender_type === "patient" &&
      message.message_type === "file" &&
      `${message.file_name || ""}` === HISTORIA_CLINICA_FILE_NAME &&
      !message.deleted_by_patient &&
      !message.deleted_by_staff
    ));

  const saveClinicalForm = async (payload: FormMessagePayload) => {
    if (accessDenied || !accessReady) return;
    const content = serializeFormMessage(payload);
    const existing = latestClinicalFormMessage;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("messages")
        .update({ content })
        .eq("id", existing.id)
        .eq("room_id", id)
        .select("*")
        .single();
      if (!error && data) {
        setMessages((current) => current.map((message) => (message.id === existing.id ? (data as Message) : message)));
        sendStaffPushNotification(uiLang === "es" ? "Historia clínica actualizada" : "Medical history updated", "advanced_assigned");
      }
      return;
    }

    const createdAt = new Date().toISOString();
    const { data } = await supabase
      .from("messages")
      .insert({
        room_id: id,
        content,
        sender_id: currentUserId,
        sender_type: "patient",
        message_type: "text",
        created_at: createdAt,
      })
      .select("*")
      .single();
    if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Message]);
      sendStaffPushNotification(uiLang === "es" ? "Historia clínica enviada" : "Medical history submitted", "advanced_assigned");
    }
  };

  const deletePatientMessage = async (messageId: string) => {
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("messages")
      .update({ deleted_by_patient: true, deleted_at: deletedAt })
      .eq("id", messageId)
      .eq("room_id", id)
      .eq("sender_type", "patient");

    if (error) return;
    setDeleteMenuMessageId(null);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, deleted_by_patient: true, deleted_at: deletedAt } : message)));
  };

  const updatePatientMessage = async () => {
    const next = editingMessageText.trim();
    if (!editingMessage || !next) return;
    const messageId = editingMessage.id;
    setEditingMessage(null);
    setEditingMessageText("");
    setDeleteMenuMessageId(null);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, content: next } : message)));
    const { error } = await supabase
      .from("messages")
      .update({ content: next })
      .eq("id", messageId)
      .eq("room_id", id)
      .eq("sender_type", "patient");
    if (error) {
      setMessages((current) => current.map((message) => (message.id === messageId ? editingMessage : message)));
    }
  };

  const startMessageLongPress = (messageId: string, enabled: boolean) => {
    if (!enabled) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => setDeleteMenuMessageId(messageId), 550);
  };

  const cancelMessageLongPress = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

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

  const openPicker = (accept: string) => {
    setFileAccept(accept);
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.click();
    setMenuOpen(false);
  };

  const uploadFile = async (file: File, overrideType?: Message["message_type"], overrideFileName?: string) => {
    if (accessDenied || !accessReady) return null;

    const timestamp = new Date().toISOString();
    const storageTimestamp = Date.now();
    const safeFileName = file.name || `${overrideType || "upload"}-${storageTimestamp}.${overrideType === "video" ? "mp4" : "bin"}`;
    const path = `patients/${id}/${storageTimestamp}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file, {
      contentType: overrideType === "video" && !file.type ? "video/mp4" : file.type || "application/octet-stream",
    });
    if (error) {
      console.error("chat file upload failed", error);
      window.alert(`No pude guardar el archivo: ${error.message}`);
      return null;
    }

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
    const messageHash = await generateMessageHash(url, timestamp, currentUserId);
    const payload = {
      room_id: id,
      sender_id: currentUserId,
      sender_type: "patient",
      type: messageType,
      message_type: messageType,
      content: url,
      file_url: url,
      file_name: overrideFileName || file.name,
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
      const { type: _type, file_type: _fileType, file_url: _fileUrl, message_hash: _messageHash, ...compatiblePayload } = payload;
      insert = await supabase.from("messages").insert(compatiblePayload).select("*").single();
    }
    if (insert.error) {
      console.error("chat message insert failed", insert.error);
      window.alert(`El archivo se subió, pero no pude guardar el mensaje: ${insert.error.message}`);
      return null;
    }

    const message = insert.data;
    if (message) {
      await logMessageAudit(timestamp);
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message as Message];
      });
      sendStaffPushNotification(message.message_type === "file" && overrideFileName === HISTORIA_CLINICA_FILE_NAME
        ? (uiLang === "es" ? "Historia Clinica enviada" : "Historia Clinica submitted")
        : file.name || (uiLang === "es" ? "Nuevo archivo" : "New file"),
        message.message_type === "file" && overrideFileName === HISTORIA_CLINICA_FILE_NAME ? "advanced_assigned" : undefined);
    }

    return url;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  };

  const loadStoredClinicalPdfValues = async () => {
    const { data } = await supabase.storage.from("chat-files").download(clinicalPdfValuesStoragePath);
    if (data) {
      try {
        const saved = normalizeClinicalPdfValues(JSON.parse(await data.text()));
        if (saved) return saved;
      } catch {}
    }

    if (typeof window !== "undefined") {
      try {
        const saved = normalizeClinicalPdfValues(JSON.parse(window.localStorage.getItem(clinicalPdfValuesStorageKey) || "null"));
        if (saved) return saved;
      } catch {}
    }
    return null;
  };

  const persistClinicalPdfValues = async (values: Record<ClinicalPdfFieldKey, string>) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(clinicalPdfValuesStorageKey, JSON.stringify(values));
    }
    const body = JSON.stringify(values);
    const blob = new Blob([body], { type: "application/json" });
    const { error } = await supabase.storage.from("chat-files").upload(clinicalPdfValuesStoragePath, blob, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) console.warn("clinical history values backup failed", error.message);
  };

  const uploadClinicalHistoryPdf = async (file: File) => {
    if (accessDenied || !accessReady) return null;

    const timestamp = new Date().toISOString();
    const storageTimestamp = Date.now();
    const safeFileName = file.name || `historia-clinica-${storageTimestamp}.pdf`;
    const path = `patients/${id}/${storageTimestamp}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file, {
      contentType: file.type || "application/pdf",
    });
    if (error) {
      console.error("clinical history upload failed", error);
      window.alert(`No pude guardar el formulario: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from("chat-files").getPublicUrl(path);
    const url = data.publicUrl;
    const messageHash = await generateMessageHash(url, timestamp, currentUserId);
    const payload = {
      room_id: id,
      sender_id: currentUserId,
      sender_type: "patient",
      type: "file" as const,
      message_type: "file" as const,
      content: url,
      file_url: url,
      file_name: HISTORIA_CLINICA_FILE_NAME,
      file_type: file.type || "application/pdf",
      created_at: timestamp,
      message_hash: messageHash,
    };
    const existing = latestClinicalPdfMessage;
    const notificationText = existing?.id
      ? (uiLang === "es" ? "Historia Clinica actualizada" : "Historia Clinica updated")
      : (uiLang === "es" ? "Historia Clinica enviada" : "Historia Clinica submitted");

    if (existing?.id) {
      let update = await supabase
        .from("messages")
        .update(payload)
        .eq("id", existing.id)
        .eq("room_id", id)
        .eq("sender_type", "patient")
        .select("*")
        .single();
      if (update.error && `${update.error.message || ""} ${update.error.details || ""}`.toLowerCase().includes("column")) {
        const { type: _type, file_type: _fileType, file_url: _fileUrl, message_hash: _messageHash, ...compatiblePayload } = payload;
        update = await supabase
          .from("messages")
          .update(compatiblePayload)
          .eq("id", existing.id)
          .eq("room_id", id)
          .eq("sender_type", "patient")
          .select("*")
          .single();
      }
      if (update.error) {
        console.error("clinical history message update failed", update.error);
        window.alert(`El formulario se subió, pero no pude actualizar el mensaje: ${update.error.message}`);
        return null;
      }
      if (update.data) {
        await logMessageAudit(timestamp);
        setMessages((current) => current.map((message) => (message.id === existing.id ? (update.data as Message) : message)));
      }
      return url;
    }

    let insert = await supabase
      .from("messages")
      .insert(payload)
      .select("*")
      .single();
    if (insert.error && `${insert.error.message || ""} ${insert.error.details || ""}`.toLowerCase().includes("column")) {
      const { type: _type, file_type: _fileType, file_url: _fileUrl, message_hash: _messageHash, ...compatiblePayload } = payload;
      insert = await supabase.from("messages").insert(compatiblePayload).select("*").single();
    }
    if (insert.error) {
      console.error("clinical history message insert failed", insert.error);
      window.alert(`El formulario se subió, pero no pude guardar el mensaje: ${insert.error.message}`);
      return null;
    }
    if (insert.data) {
      await logMessageAudit(timestamp);
      setMessages((current) => current.some((item) => item.id === insert.data.id) ? current : [...current, insert.data as Message]);
      sendStaffPushNotification(notificationText, "advanced_assigned");
    }
    return url;
  };

  const openClinicalPdfEditor = async (language: "es" | "en" = uiLang) => {
    setClinicalPdfLanguage(language);
    const patientName = room?.procedures?.patients?.full_name?.trim();
    const saved = await loadStoredClinicalPdfValues();
    if (saved) setClinicalPdfValues(saved);
    else if (patientName) setClinicalPdfValues((current) => current.nombre.trim() ? current : { ...current, nombre: patientName });
    setClinicalPdfEditorOpen(true);
  };

  const saveClinicalPdfForm = async () => {
    if (clinicalPdfSaving || accessDenied || !accessReady) return;
    setClinicalPdfSaving(true);

    try {
      const response = await fetch(HISTORIA_CLINICA_TEMPLATE_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(uiLang === "es" ? "No pude abrir la plantilla del formulario." : "Could not open the form template.");

      const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
      const page = pdfDoc.getPages()[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      clinicalPdfFields.forEach((field) => drawWrappedPdfText(page, font, field, clinicalPdfValues[field.key]));

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      const file = new File([pdfBuffer], "Historia Clinica.pdf", { type: "application/pdf" });
      const savedUrl = await uploadClinicalHistoryPdf(file);
      if (!savedUrl) return;
      await persistClinicalPdfValues(clinicalPdfValues);
      setClinicalPdfEditorOpen(false);
      setDocumentFolderOpen(false);
      setMenuOpen(false);
      window.setTimeout(() => scrollToLatest("smooth"), 80);
    } catch (error) {
      const message = error instanceof Error ? error.message : (uiLang === "es" ? "No pude guardar el formulario." : "Could not save the form.");
      window.alert(message);
    } finally {
      setClinicalPdfSaving(false);
    }
  };

  const handleVideoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    setMenuOpen(false);
    await uploadFile(file, "video");
    event.target.value = "";
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
    const formPayload = parseFormMessage(message.content);
    if (formPayload) {
      return (
        <FormMessage
          payload={formPayload}
          lang={uiLang}
          editable={viewerType === "patient" && message.sender_type === "patient"}
          onSubmit={saveClinicalForm}
        />
      );
    }

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

    const translatedContent =
      viewerType === "patient" && message.sender_type === "staff"
        ? translatedMessages[translationKey(message.id, uiLang)]
        : "";
    return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{translatedContent || message.content}</span>;
  };

  const chatFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const appBg = darkMode ? "#0f172a" : "#f7f7f7";
  const textPrimary = darkMode ? "#f8fafc" : "#111";
  const panelBg = darkMode ? "#172033" : "#fff";
  const footerBg = darkMode ? "#111827" : "#ededed";
  const inputPanelBg = darkMode ? "#1f2937" : "#fff";
  const messageFontSize = textSize === "large" ? 22 : 19;
  const patientTextBase = textSize === "large" ? 18 : 17;
  const patientTextSmall = textSize === "large" ? 16 : 15;
  const translations = {
    en: {
      messagePlaceholder: "Message",
      send: "SEND",
      cancel: "Cancel",
      settings: "Settings",
      quickReplies: "Quick Replies",
      photos: "Photos",
      video: "Video",
      documents: "Prescriptions",
      documentFolder: "Documento",
      clinicalHistoryFile: "Historia Clinica",
      openClinicalHistory: "Open form",
      openClinicalHistorySpanish: "Version español",
      openClinicalHistoryEnglish: "English version",
      clinicalHistoryLanguage: "Form language",
      saveClinicalHistory: "Save and send",
      savingClinicalHistory: "Saving...",
      clinicalHistoryInstructions: "Choose Spanish or English, fill it in on this screen, and save it. The completed PDF is sent automatically.",
      clinicalHistoryEditInstructions: "Your submitted form is saved. Reopen it to edit the same document.",
      clinicalHistorySubmitted: "Form submitted",
      downloadClinicalHistory: "Save PDF to device",
      clinicalForm: "Medical history form",
      noPrescriptions: "No prescriptions yet.",
      prescriptionInstructions: "Instructions",
      close: "Close",
      share: "Share",
      print: "Print",
      email: "Email",
      messages: "Messages",
      createReply: "Create quick reply",
      saveReply: "Save Reply",
      saveChanges: "Save Changes",
      edit: "Edit",
      delete: "Delete",
      deletedByUser: "This message was Deleted by user",
      darkMode: "Dark mode",
      alerts: "Alerts",
      enableAlerts: "Enable alerts",
      enablingAlerts: "Enabling...",
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
      documents: "Recetas",
      documentFolder: "Documento",
      clinicalHistoryFile: "Historia Clinica",
      openClinicalHistory: "Abrir formulario",
      openClinicalHistorySpanish: "Version español",
      openClinicalHistoryEnglish: "English version",
      clinicalHistoryLanguage: "Idioma del formulario",
      saveClinicalHistory: "Guardar y enviar",
      savingClinicalHistory: "Guardando...",
      clinicalHistoryInstructions: "Elige Version español o English version, llenalo en esta pantalla y guardalo. El PDF completo se envia automaticamente.",
      clinicalHistoryEditInstructions: "Tu formulario enviado esta guardado. Abrelo de nuevo para editar el mismo documento.",
      clinicalHistorySubmitted: "Formulario enviado",
      downloadClinicalHistory: "Guardar PDF en dispositivo",
      clinicalForm: "Historia clínica",
      noPrescriptions: "Todavía no hay recetas.",
      prescriptionInstructions: "Indicaciones",
      close: "Cerrar",
      share: "Compartir",
      print: "Imprimir",
      email: "Correo",
      messages: "Mensajes",
      createReply: "Crear respuesta rápida",
      saveReply: "Guardar respuesta",
      saveChanges: "Guardar cambios",
      edit: "Editar",
      delete: "Eliminar",
      deletedByUser: "Este mensaje fue eliminado por el usuario",
      darkMode: "Modo oscuro",
      alerts: "Alertas",
      enableAlerts: "Activar alertas",
      enablingAlerts: "Activando...",
      textSize: "Tamaño de texto",
      normal: "Normal",
      large: "Grande",
    },
  };
  const labels = translations[uiLang] || translations.en;
  const prescriptionMessages = messages.filter((message) => `${message.file_name || ""}`.startsWith("[MED]"));
  const newPrescriptionCount = prescriptionMessages.filter((message) => !lastPrescriptionSeenAt || `${message.created_at || ""}` > lastPrescriptionSeenAt).length;
  const openPrescriptions = () => {
    const latest = prescriptionMessages[prescriptionMessages.length - 1]?.created_at || new Date().toISOString();
    setPrescriptionsOpen(true);
    setMenuOpen(false);
    setLastPrescriptionSeenAt(latest);
    if (typeof window !== "undefined") window.localStorage.setItem(prescriptionSeenKey, latest);
  };
  const parsePrescriptionText = (value?: string | null) => {
    const clean = `${value || labels.documents}`.replace(/^\[MED\]\s*/i, "").trim();
    const [title, ...rest] = clean.split(/\n+/);
    return {
      title: title?.trim() || labels.documents,
      instructions: rest.join("\n").trim(),
    };
  };
  const prescriptionUrl = (message?: Message | null) => message?.file_url || message?.content || "";
  const selectedPrescriptionInfo = selectedPrescription ? parsePrescriptionText(selectedPrescription.file_name) : null;
  const selectedPrescriptionUrl = prescriptionUrl(selectedPrescription);
  const latestClinicalPdfUrl = latestClinicalPdfMessage?.file_url || latestClinicalPdfMessage?.content || "";
  const selectedPrescriptionIsImage = /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(selectedPrescriptionUrl) || `${selectedPrescription?.file_type || ""}`.startsWith("image/");
  const selectedPrescriptionShareText = selectedPrescriptionInfo
    ? `${selectedPrescriptionInfo.title}${selectedPrescriptionInfo.instructions ? `\n${labels.prescriptionInstructions}: ${selectedPrescriptionInfo.instructions}` : ""}\n${selectedPrescriptionUrl}`
    : selectedPrescriptionUrl;
  const sharePrescription = async () => {
    if (!selectedPrescriptionUrl || !selectedPrescriptionInfo) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedPrescriptionInfo.title, text: selectedPrescriptionShareText, url: selectedPrescriptionUrl });
        return;
      } catch {}
    }
    await navigator.clipboard?.writeText(selectedPrescriptionShareText).catch(() => {});
    alert(uiLang === "es" ? "Enlace de receta copiado." : "Prescription link copied.");
  };
  const printPrescription = () => {
    if (!selectedPrescriptionUrl || !selectedPrescriptionInfo) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) {
      window.open(selectedPrescriptionUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const escapedTitle = selectedPrescriptionInfo.title.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[char] || char));
    const escapedInstructions = selectedPrescriptionInfo.instructions.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[char] || char));
    const viewer = selectedPrescriptionIsImage
      ? `<img src="${selectedPrescriptionUrl}" alt="${escapedTitle}" style="max-width:100%;height:auto;display:block;margin:18px auto 0;" />`
      : `<iframe src="${selectedPrescriptionUrl}" title="${escapedTitle}" style="width:100%;height:78vh;border:0;margin-top:18px;"></iframe>`;
    printWindow.document.write(`<!doctype html><html><head><title>${escapedTitle}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin:24px;color:#111}h1{font-size:22px;margin:0 0 6px}.instructions{font-size:15px;color:#475569;white-space:pre-wrap}@media print{body{margin:12mm}}</style></head><body><h1>${escapedTitle}</h1>${escapedInstructions ? `<div class="instructions">${escapedInstructions}</div>` : ""}${viewer}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),450));</script></body></html>`);
    printWindow.document.close();
  };
  const emailPrescription = () => {
    if (!selectedPrescriptionInfo) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(selectedPrescriptionInfo.title)}&body=${encodeURIComponent(selectedPrescriptionShareText)}`;
  };
  const messagePrescription = () => {
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${separator}body=${encodeURIComponent(selectedPrescriptionShareText)}`;
  };
  const visibleChatMessages = messages.filter((message) => {
    const fileName = `${message.file_name || ""}`;
    if (isLegacyRoomCreatedMessage(message)) return false;
    if (fileName === HISTORIA_CLINICA_FILE_NAME || fileName.startsWith("[FORM]") || parseFormMessage(message.content)) return false;
    if (fileName.startsWith("[MED]") || fileName.startsWith("[BEFORE]") || fileName.startsWith("[PROFILE]") || fileName.startsWith("profile.") || `${message.content || ""}`.includes("patient-profiles/") || `${message.content || ""}`.includes("patient-photos/")) return false;
    if (viewerType === "patient" && (message.deleted_by_patient || message.deleted_by_staff)) return false;
    return true;
  });
  const roleLabel = (role?: string | null) => {
    const labelsByLang = uiLang === "es"
      ? { doctor: "Doctor", enfermeria: "Enfermería", coordinacion: "Coordinación", post_quirofano: "Post-Q", staff: "Personal" }
      : { doctor: "Doctor", enfermeria: "Nursing", coordinacion: "Coordination", post_quirofano: "Post-Op", staff: "Staff" };
    return (labelsByLang as Record<string, string>)[role || "staff"] || (uiLang === "es" ? "Personal" : "Staff");
  };
  const formatTime = (createdAt?: string) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    return date.toLocaleTimeString(uiLang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };
  const formatDateLabel = (createdAt?: string) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const today = startOf(new Date());
    const messageDay = startOf(date);
    if (messageDay === today) return uiLang === "es" ? "Hoy" : "Today";
    if (messageDay === today - 86400000) return uiLang === "es" ? "Ayer" : "Yesterday";
    return date.toLocaleDateString(uiLang === "es" ? "es-MX" : "en-US", { month: "long", day: "numeric" });
  };
  const senderLabel = (message: Message) => {
    if (message.sender_name?.trim()) return message.sender_name.trim();
    if (message.sender_type === "staff") return roleLabel(message.sender_role);
    return mineLabel(message);
  };
  const mineLabel = (message: Message) => {
    const isMine = message.sender_type !== "staff";
    return isMine ? (uiLang === "es" ? "Tú" : "You") : (uiLang === "es" ? "Paciente" : "Patient");
  };

  if (!accessReady) {
    return (
      <main style={{ height: "100%", minHeight: "-webkit-fill-available", display: "grid", placeItems: "center", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", padding: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(7,94,84,0.18)", borderTopColor: "#075e54", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main style={{ height: "100%", minHeight: "-webkit-fill-available", display: "flex", flexDirection: "column", background: "#fff", color: "#111", fontFamily: chatFontFamily, overflow: "hidden" }}>
        <header style={{ height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
          <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
        </header>
        <section style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 10px 36px rgba(0,0,0,0.14)", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔒</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>No pudimos abrir este chat</h1>
            <p style={{ margin: "0 0 18px", color: "#555", lineHeight: 1.5 }}>Por seguridad, este enlace no es válido o necesita ser actualizado por el equipo del Dr. Fonseca.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
      <main className="patient-chat-app" data-text-size={textSize} style={{ height: "100%", minHeight: "-webkit-fill-available", display: "flex", flexDirection: "column", background: appBg, color: textPrimary, fontFamily: chatFontFamily, overflow: "hidden", maxWidth: "100vw" }}>
        <style>{`
        .patient-chat-app { --patient-ui-font-size: ${patientTextBase}px; --patient-ui-small-size: ${patientTextSmall}px; }
        .patient-chat-app * { box-sizing: border-box; }
        .patient-chat-app p, .patient-chat-app label, .patient-chat-app button, .patient-chat-app input, .patient-chat-app textarea, .patient-chat-app a { overflow-wrap: anywhere; }
        .patient-chat-app button, .patient-chat-app [role="button"], .patient-chat-app input, .patient-chat-app textarea { min-height: 44px; }
        button { transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease, box-shadow 150ms ease; }
        button:active { transform: scale(0.96); opacity: 0.86; }
        input { transition: box-shadow 170ms ease, background-color 170ms ease; }
        input:focus { box-shadow: 0 0 0 3px rgba(30,136,229,0.18); }
        .chat-composer:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .staff-exit-link { position: absolute; right: max(12px, env(safe-area-inset-right)); top: 50%; transform: translateY(-50%); min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.20); background: rgba(255,255,255,0.12); color: #fff; text-decoration: none; font-size: 14px; font-weight: 850; font-family: inherit; }
        @media (max-width: 520px) { .staff-exit-link { right: max(8px, env(safe-area-inset-right)); padding: 0 11px; font-size: 13px; } }
        @keyframes messageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes micPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(153,27,27,0.42); } 50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(153,27,27,0); } }
      `}</style>
      <header style={{ position: "relative", height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B3C5D", borderBottom: "1px solid rgba(229,231,235,0.65)", padding: "5px 8px", overflow: "hidden" }}>
        <Image src="/fonseca_blue.png" alt="Dr. Fonseca" width={430} height={78} priority style={{ width: "95%", maxWidth: 520, height: "auto", maxHeight: 78, objectFit: "contain", objectPosition: "center" }} />
        {viewerType === "staff" && (
          <a className="staff-exit-link" href="/inbox">
            Salir
          </a>
        )}
      </header>

      <section style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px max(10px, env(safe-area-inset-right)) 16px max(10px, env(safe-area-inset-left))" }} onClick={() => { setMenuOpen(false); setDeleteMenuMessageId(null); }}>
        {(() => {
          let previousMessageDate = "";
          return visibleChatMessages.map((message) => {
          const mine = message.sender_type !== "staff";
          const deletedByPatient = !!message.deleted_by_patient;
          const canDeletePatientMessage = viewerType === "patient" && mine && !deletedByPatient && !message.deleted_by_staff;
          const softBlue = "#d9ecf7";
          const bubbleBg =
            viewerType === "staff"
              ? message.sender_type === "patient" ? softBlue : "#fff"
              : message.sender_type === "staff" ? softBlue : "#fff";
          const messageDate = message.created_at ? new Date(message.created_at).toDateString() : "";
          const showDate = !!messageDate && messageDate !== previousMessageDate;
          previousMessageDate = messageDate || previousMessageDate;
          return (
            <Fragment key={message.id}>
              {showDate && (
                <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 12px" }}>
	                  <div style={{ background: darkMode ? "rgba(17,27,33,0.92)" : "rgba(255,255,255,0.96)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, borderRadius: 10, padding: "6px 13px", color: darkMode ? "#F8FAFC" : "#111827", fontSize: patientTextSmall, fontWeight: 850, boxShadow: "0 1px 4px rgba(15,23,42,0.10)" }}>
                    {formatDateLabel(message.created_at)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 5, animation: "messageIn 180ms ease-out" }}>
                <div onClick={(event) => { event.stopPropagation(); if (canDeletePatientMessage) setDeleteMenuMessageId((current) => current === message.id ? null : message.id); }} onMouseDown={() => startMessageLongPress(message.id, canDeletePatientMessage)} onMouseUp={cancelMessageLongPress} onMouseLeave={cancelMessageLongPress} onTouchStart={() => startMessageLongPress(message.id, canDeletePatientMessage)} onTouchEnd={cancelMessageLongPress} style={{ maxWidth: "min(84%, 680px)", background: bubbleBg, color: "#07111f", borderRadius: mine ? "16px 6px 16px 16px" : "6px 16px 16px 16px", padding: "11px 13px 9px", boxShadow: "0 1px 2px rgba(15,23,42,0.13)", fontSize: messageFontSize, fontWeight: 560, lineHeight: 1.42, letterSpacing: 0, transition: "box-shadow 170ms ease, transform 170ms ease", userSelect: "none" }}>
                <div style={{ marginBottom: 5, lineHeight: 1.15 }}>
                  <span style={{ fontSize: Math.max(messageFontSize - 3, 15), fontWeight: 850, color: "#334155" }}>{senderLabel(message)}</span>
                </div>
                {renderMessage(message)}
                {deletedByPatient && viewerType === "staff" && (
	                  <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid rgba(15,23,42,0.14)", fontSize: patientTextSmall, fontStyle: "italic", opacity: 0.72, lineHeight: 1.4 }}>{labels.deletedByUser}</div>
                )}
                <div style={{ fontSize: Math.max(messageFontSize - 5, 13), fontWeight: 520, color: "#64748b", whiteSpace: "nowrap", lineHeight: 1.1, marginTop: 4, textAlign: "right" }}>{formatTime(message.created_at)}</div>
                {canDeletePatientMessage && deleteMenuMessageId === message.id && (
                  <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:8}}>
                    {message.message_type === "text" && (
	                      <button onClick={(event) => { event.stopPropagation(); setEditingMessage(message); setEditingMessageText(message.content || ""); setDeleteMenuMessageId(null); }} style={{ border: "none", background: "transparent", color: "#075e54", fontSize: patientTextSmall, fontWeight: 900, padding: "6px 0" }}>
                        {labels.edit}
                      </button>
                    )}
	                    <button onClick={(event) => { event.stopPropagation(); deletePatientMessage(message.id); }} style={{ border: "none", background: "transparent", color: "#b91c1c", fontSize: patientTextSmall, fontWeight: 900, padding: "6px 0" }}>
                      {labels.delete}
                    </button>
                  </div>
                )}
              </div>
              </div>
            </Fragment>
          );
          });
        })()}
        <div ref={bottomRef} />
      </section>

      <footer onClick={() => setDeleteMenuMessageId(null)} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px max(12px, env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))", background: footerBg, borderTop: "1px solid rgba(0,0,0,0.08)", maxWidth: "100vw" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(78px + env(safe-area-inset-bottom))", left: 14, width: 248, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5, animation: "menuIn 160ms ease-out", transformOrigin: "left bottom" }}>
            <button onClick={() => openPicker("image/*")} style={menuButtonStyle}>{labels.photos}</button>
            <button onClick={() => { videoCaptureRef.current?.click(); setMenuOpen(false); }} style={menuButtonStyle}>{labels.video}</button>
            <button onClick={openPrescriptions} style={{ ...menuButtonStyle, position:"relative" }}>
              {labels.documents}
              {newPrescriptionCount > 0 && <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",minWidth:22,height:22,borderRadius:999,background:"#DC2626",color:"white",display:"grid",placeItems:"center",fontSize:12,fontWeight:900}}>{newPrescriptionCount}</span>}
            </button>
            <button onClick={() => { setDocumentFolderOpen(true); setMenuOpen(false); }} style={menuButtonStyle}>{labels.documentFolder}</button>
            <button onClick={() => { setQuickRepliesManageOpen(true); setMenuOpen(false); }} style={menuButtonStyle}>{labels.quickReplies}</button>
            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} style={{ ...menuButtonStyle, borderBottom: "none" }}>{labels.settings}</button>
          </div>
        )}

        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" style={{ position:"relative", width: 42, height: 42, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#ddd", color: menuOpen ? "#fff" : "#111", fontSize: 28, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
          {newPrescriptionCount > 0 && <span style={{position:"absolute",right:0,top:0,width:12,height:12,borderRadius:"50%",background:"#DC2626",border:"2px solid #ededed"}} />}
        </button>

        <div
          ref={setComposerNode}
          className="chat-composer"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={labels.messagePlaceholder}
          data-placeholder={labels.messagePlaceholder}
          onFocus={() => { setDeleteMenuMessageId(null); scrollToLatest(); }}
          onInput={(event) => {
            const next = event.currentTarget.textContent || "";
            setText(next);
            setQuickRepliesOpen(next.startsWith("/"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendText();
            }
          }}
          style={{ minWidth: 0, flex: 1, minHeight: 58, maxHeight: 104, overflowY: "auto", border: "none", outline: "none", borderRadius: 29, background: inputPanelBg, color: darkMode ? "#f8fafc" : "#1f2937", padding: "16px 20px", fontSize: messageFontSize, fontWeight: 500, lineHeight: 1.42, WebkitUserSelect: "text", userSelect: "text" }}
        />

        <button onClick={sendText} aria-label="Send" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 20 }}>➤</button>

        <button onClick={() => { window.location.href = "tel:+523332314480"; }} aria-label="Call" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 26 }}>
          <Image src="/Phone_icon.png" alt="" width={30} height={30} style={{ width: 30, height: 30, objectFit: "contain" }} />
        </button>

        <button onClick={toggleRecording} aria-label="Record audio" style={{ ...roundButtonStyle, background: recording ? "#eef6ff" : "#eef6ff", color: "#0b4ea2", animation: recording ? "micPulse 1.15s ease-in-out infinite" : "none" }}>
          <Image src="/Microphone_icon.png" alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: "contain" }} />
        </button>

        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileChange} style={{ display: "none" }} />
        <input ref={videoCaptureRef} type="file" accept="video/*" capture="environment" onChange={handleVideoCapture} style={{ display: "none" }} />
      </footer>

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
        <div style={{ position: "fixed", left: 10, right: 10, bottom: "calc(86px + env(safe-area-inset-bottom))", zIndex: 20, pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, maxHeight: "min(42dvh, 260px)", overflowY: "auto", paddingBottom: 6 }}>
              {quickReplies.map((reply, index) => (
                <button key={`${reply}-${index}`} onClick={() => { setComposerText(reply); setQuickRepliesOpen(false); composerRef.current?.focus(); }} style={{ width: "fit-content", maxWidth: "calc(100vw - 20px)", border: "1px solid rgba(0,0,0,0.10)", background: panelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.16)", pointerEvents: "auto" }}>{reply}</button>
              ))}
          </div>
        </div>
      )}

      {clinicalFormOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: "max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))", zIndex: 26, overflow: "hidden" }} onClick={() => setClinicalFormOpen(false)}>
          <div style={{ width: "100%", maxWidth: 460, maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overflowX: "hidden" }} onClick={(event) => event.stopPropagation()}>
            <FormMessage
              payload={parseFormMessage(latestClinicalFormMessage?.content) || createClinicalHistoryPayload()}
              lang={uiLang}
              editable
              onSubmit={async (payload) => {
                await saveClinicalForm(payload);
                setClinicalFormOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {documentFolderOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: "max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))", zIndex: 26, overflow: "hidden" }} onClick={() => setDocumentFolderOpen(false)}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overflowX: "hidden", background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: patientTextBase, lineHeight: 1.35 }}>{labels.documentFolder}</strong>
              <button onClick={() => setDocumentFolderOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 14, padding: "14px 15px", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 25 }}>📄</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: patientTextBase, fontWeight: 900, lineHeight: 1.25 }}>{labels.clinicalHistoryFile}</div>
                    <div style={{ fontSize: patientTextSmall, color: darkMode ? "#CBD5E1" : "#64748B", fontWeight: 650, lineHeight: 1.45 }}>
                      {latestClinicalPdfMessage ? labels.clinicalHistoryEditInstructions : labels.clinicalHistoryInstructions}
                    </div>
                  </div>
                </div>
                {latestClinicalPdfMessage && (
                  <div style={{ border: "1px solid rgba(34,197,94,0.28)", background: darkMode ? "rgba(22,101,52,0.24)" : "#F0FDF4", color: darkMode ? "#BBF7D0" : "#166534", borderRadius: 12, padding: "10px 12px", fontSize: patientTextSmall, fontWeight: 900, lineHeight: 1.35 }}>
                    {labels.clinicalHistorySubmitted}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" onClick={() => void openClinicalPdfEditor("es")} style={{ minHeight: 46, border: "none", borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", display: "grid", placeItems: "center", textDecoration: "none", fontSize: patientTextSmall, fontWeight: 900, fontFamily: "inherit", lineHeight: 1.2 }}>
                    {labels.openClinicalHistorySpanish}
                  </button>
                  <button type="button" onClick={() => void openClinicalPdfEditor("en")} style={{ minHeight: 46, border: "none", borderRadius: 12, background: "#E0F2FE", color: "#0369A1", display: "grid", placeItems: "center", textDecoration: "none", fontSize: patientTextSmall, fontWeight: 900, fontFamily: "inherit", lineHeight: 1.2 }}>
                    {labels.openClinicalHistoryEnglish}
                  </button>
                </div>
                {latestClinicalPdfUrl && (
                  <a href={latestClinicalPdfUrl} download="Historia Clinica.pdf" style={{ minHeight: 46, borderRadius: 12, background: darkMode ? "#1F2937" : "#F1F5F9", color: textPrimary, display: "grid", placeItems: "center", textDecoration: "none", fontSize: patientTextBase, fontWeight: 900 }}>
                    {labels.downloadClinicalHistory}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {clinicalPdfEditorOpen && (
        <div style={{ position: "fixed", inset: 0, background: darkMode ? "#0f172a" : "#f8fafc", zIndex: 30, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px max(12px, env(safe-area-inset-right)) 12px max(12px, env(safe-area-inset-left))", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}`, background: darkMode ? "#111827" : "#ffffff" }}>
            <button type="button" disabled={clinicalPdfSaving} onClick={() => setClinicalPdfEditorOpen(false)} style={{ minWidth: 46, height: 42, border: "none", borderRadius: 12, background: darkMode ? "#1f2937" : "#f1f5f9", color: textPrimary, fontSize: 26, lineHeight: 1, fontFamily: "inherit" }}>
              ×
            </button>
            <strong style={{ minWidth: 0, flex: 1, color: textPrimary, fontSize: patientTextBase, lineHeight: 1.2, textAlign: "center" }}>{labels.clinicalHistoryFile}</strong>
            <button type="button" disabled={clinicalPdfSaving} onClick={saveClinicalPdfForm} style={{ minHeight: 42, border: "none", borderRadius: 12, background: clinicalPdfSaving ? "#93c5fd" : "#1D4ED8", color: "#fff", padding: "0 14px", fontSize: patientTextSmall, fontWeight: 900, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {clinicalPdfSaving
                ? (clinicalPdfLanguage === "es" ? translations.es.savingClinicalHistory : translations.en.savingClinicalHistory)
                : (clinicalPdfLanguage === "es" ? translations.es.saveClinicalHistory : translations.en.saveClinicalHistory)}
            </button>
          </div>
          <div style={{ flex: "1 1 auto", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px max(12px, env(safe-area-inset-right)) 22px max(12px, env(safe-area-inset-left))" }}>
            <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", display: "grid", gap: 12 }}>
              <div style={{ background: panelBg, color: textPrimary, border: `1px solid ${darkMode ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`, borderRadius: 14, padding: 10, display: "grid", gap: 8 }}>
                <span style={{ fontSize: patientTextSmall, color: darkMode ? "#CBD5E1" : "#475569", fontWeight: 850 }}>
                  {clinicalPdfLanguage === "es" ? translations.es.clinicalHistoryLanguage : translations.en.clinicalHistoryLanguage}
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["es", "en"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      disabled={clinicalPdfSaving}
                      onClick={() => setClinicalPdfLanguage(language)}
                      style={{
                        minHeight: 40,
                        border: "none",
                        borderRadius: 10,
                        background: clinicalPdfLanguage === language ? "#1D4ED8" : (darkMode ? "#1f2937" : "#E2E8F0"),
                        color: clinicalPdfLanguage === language ? "#fff" : textPrimary,
                        fontSize: patientTextSmall,
                        fontWeight: 900,
                        fontFamily: "inherit",
                      }}
                    >
                      {language === "es" ? "Español" : "English"}
                    </button>
                  ))}
                </div>
              </div>
              {clinicalPdfSections.map((section) => (
                <section key={section.titleEs} style={{ background: panelBg, color: textPrimary, border: `1px solid ${darkMode ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"}`, borderRadius: 14, padding: 14, boxShadow: darkMode ? "none" : "0 8px 22px rgba(15,23,42,0.06)", display: "grid", gap: 12 }}>
                  <strong style={{ fontSize: patientTextBase, lineHeight: 1.25 }}>{clinicalPdfLanguage === "es" ? section.titleEs : section.titleEn}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                    {section.keys.map((key) => {
                      const field = clinicalPdfFieldByKey[key];
                      const isTextArea = clinicalPdfTextAreaFields.has(key);
                      const commonStyle = {
                        width: "100%",
                        boxSizing: "border-box" as const,
                        border: `1px solid ${darkMode ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.16)"}`,
                        outline: "none",
                        borderRadius: 10,
                        background: inputPanelBg,
                        color: textPrimary,
                        padding: "11px 12px",
                        fontSize: 16,
                        fontWeight: 650,
                        fontFamily: chatFontFamily,
                        lineHeight: 1.3,
                      };

                      return (
                        <label key={field.key} style={{ display: "grid", gap: 6, minWidth: 0, gridColumn: isTextArea ? "1 / -1" : "auto" }}>
                          <span style={{ fontSize: patientTextSmall, color: darkMode ? "#CBD5E1" : "#475569", fontWeight: 850, lineHeight: 1.2 }}>{clinicalPdfLanguage === "es" ? field.labelEs : field.labelEn}</span>
                          {isTextArea ? (
                            <textarea
                              value={clinicalPdfValues[field.key]}
                              onChange={(event) => setClinicalPdfValues((current) => ({ ...current, [field.key]: event.target.value }))}
                              disabled={clinicalPdfSaving}
                              rows={3}
                              style={{ ...commonStyle, minHeight: 82, resize: "vertical" }}
                            />
                          ) : (
                            <input
                              value={clinicalPdfValues[field.key]}
                              onChange={(event) => setClinicalPdfValues((current) => ({ ...current, [field.key]: event.target.value }))}
                              disabled={clinicalPdfSaving}
                              style={{ ...commonStyle, minHeight: 46 }}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {quickRepliesManageOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: "max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))", zIndex: 20, overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overflowX: "hidden", background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: patientTextBase, lineHeight: 1.35 }}>{labels.quickReplies}</strong>
              <button onClick={() => setQuickRepliesManageOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {quickReplies.map((reply, index) => (
                <div key={`${reply}-${index}`} style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
                  <button onClick={() => { setComposerText(reply); setQuickRepliesManageOpen(false); composerRef.current?.focus(); }} style={{ flex: "1 1 160px", border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: patientTextBase, lineHeight: 1.45 }}>{reply}</button>
                  <button onClick={() => { setReplyDraft(reply); setEditingReplyIndex(index); }} style={{ border: "none", background: "#e8f4ff", borderRadius: 12, padding: "12px 14px", fontSize: patientTextBase, fontWeight: 800 }}>{labels.edit}</button>
                  <button onClick={() => { setQuickReplies((current) => current.filter((_, replyIndex) => replyIndex !== index)); if (editingReplyIndex === index) { setReplyDraft(""); setEditingReplyIndex(null); } }} style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 12, padding: "12px 14px", fontSize: patientTextBase, fontWeight: 800 }}>{labels.delete}</button>
                </div>
              ))}
            </div>
            <input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder={labels.createReply} style={{ width: "100%", height: 48, border: "1px solid rgba(0,0,0,0.12)", outline: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, padding: "0 14px", fontSize: 16, marginBottom: 10 }} />
            <button onClick={saveQuickReply} style={{ width: "100%", height: 48, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 700 }}>{editingReplyIndex === null ? labels.saveReply : labels.saveChanges}</button>
          </div>
        </div>
      )}

      {prescriptionsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: "max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))", zIndex: 20, overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overflowX: "hidden", background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: patientTextBase, lineHeight: 1.35 }}>{labels.documents}</strong>
              <button onClick={() => setPrescriptionsOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {prescriptionMessages.length === 0 && (
                <div style={{ border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "12px 14px", fontSize: patientTextBase, lineHeight: 1.45 }}>{labels.noPrescriptions}</div>
              )}
              {prescriptionMessages.map((message) => {
                const prescription = parsePrescriptionText(message.file_name);
                return (
                  <button key={message.id} type="button" onClick={() => setSelectedPrescription(message)} style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid rgba(0,0,0,0.10)", background: inputPanelBg, color: textPrimary, borderRadius: 12, padding: "13px 14px", textDecoration: "none", fontSize: patientTextBase, fontWeight: 800, textAlign:"left", fontFamily:"inherit", width:"100%", lineHeight:1.4 }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <span style={{ wordBreak: "break-word", display:"grid", gap:4 }}>
                      <span>{prescription.title}</span>
	                      {prescription.instructions && <span style={{fontSize:patientTextSmall,fontWeight:650,color:darkMode?"#CBD5E1":"#64748B",lineHeight:1.45}}>{labels.prescriptionInstructions}: {prescription.instructions}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedPrescription && (
        <div style={{ position: "fixed", inset: 0, background: darkMode ? "#0f172a" : "#f8fafc", color: textPrimary, zIndex: 30, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, padding: "calc(14px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 12px max(14px, env(safe-area-inset-left))", background: panelBg, borderBottom: "1px solid rgba(148,163,184,0.25)", boxShadow: "0 6px 18px rgba(15,23,42,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: patientTextBase, fontWeight: 900, lineHeight:1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedPrescriptionInfo?.title || labels.documents}</div>
                {selectedPrescriptionInfo?.instructions && <div style={{ fontSize: patientTextSmall, color: darkMode ? "#CBD5E1" : "#64748B", marginTop: 3, lineHeight:1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labels.prescriptionInstructions}: {selectedPrescriptionInfo.instructions}</div>}
              </div>
              <button onClick={() => setSelectedPrescription(null)} style={{ border: "none", borderRadius: 999, background: inputPanelBg, color: textPrimary, minWidth: 86, height: 44, padding: "0 14px", fontSize: patientTextSmall, fontWeight: 850, fontFamily: "inherit" }}>{labels.close}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <button onClick={sharePrescription} style={{ border: "none", borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", minHeight: 46, fontSize: patientTextBase, fontWeight: 850, fontFamily: "inherit" }}>{labels.share}</button>
              <button onClick={messagePrescription} style={{ border: "none", borderRadius: 12, background: "#DCFCE7", color: "#166534", minHeight: 46, fontSize: patientTextBase, fontWeight: 850, fontFamily: "inherit" }}>{labels.messages}</button>
              <button onClick={emailPrescription} style={{ border: "none", borderRadius: 12, background: "#FDE68A", color: "#854D0E", minHeight: 46, fontSize: patientTextBase, fontWeight: 850, fontFamily: "inherit" }}>{labels.email}</button>
              <button onClick={printPrescription} style={{ border: "none", borderRadius: 12, background: "#E0E7FF", color: "#3730A3", minHeight: 46, fontSize: patientTextBase, fontWeight: 850, fontFamily: "inherit" }}>{labels.print}</button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
            {selectedPrescriptionIsImage ? (
              <img src={selectedPrescriptionUrl} alt={selectedPrescriptionInfo?.title || labels.documents} style={{ display: "block", width: "100%", maxWidth: 900, height: "auto", margin: "0 auto", borderRadius: 14, background: "#fff", boxShadow: "0 8px 28px rgba(15,23,42,0.14)" }} />
            ) : (
              <iframe src={selectedPrescriptionUrl} title={selectedPrescriptionInfo?.title || labels.documents} style={{ width: "100%", height: "100%", minHeight: "70dvh", border: "none", borderRadius: 14, background: "#fff", boxShadow: "0 8px 28px rgba(15,23,42,0.14)" }} />
            )}
          </div>
        </div>
      )}

      {editingMessage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 24 }} onClick={() => { setEditingMessage(null); setEditingMessageText(""); }}>
          <div style={{ width: "100%", maxWidth: 420, background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }} onClick={(event)=>event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <strong style={{ fontSize: 18 }}>{labels.edit}</strong>
              <button onClick={() => { setEditingMessage(null); setEditingMessageText(""); }} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <textarea
              value={editingMessageText}
              onChange={(event)=>setEditingMessageText(event.target.value)}
              rows={4}
              style={{ width: "100%", border: "1px solid rgba(148,163,184,0.35)", outline: "none", borderRadius: 14, background: inputPanelBg, color: textPrimary, padding: "12px 14px", fontSize: 16, resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
            />
            <button onClick={updatePatientMessage} disabled={!editingMessageText.trim()} style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: "#075e54", color: "#fff", fontSize: 16, fontWeight: 800, opacity: editingMessageText.trim() ? 1 : 0.5 }}>
              {labels.saveChanges}
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: "max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))", zIndex: 20, overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overflowX: "hidden", background: panelBg, color: textPrimary, borderRadius: 18, padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <strong style={{ fontSize: patientTextBase, lineHeight: 1.35 }}>{labels.settings}</strong>
              <button onClick={() => setSettingsOpen(false)} style={{ border: "none", background: "transparent", color: textPrimary, fontSize: 28, lineHeight: 1 }}>×</button>
            </div>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: patientTextBase, lineHeight: 1.45, marginBottom: 18 }}>
              {labels.darkMode}
              <input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} style={{ width: 24, height: 24 }} />
            </label>
            <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
              <div style={{ fontSize: patientTextBase, lineHeight: 1.45 }}>{labels.alerts}</div>
              {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                <button onClick={()=>void requestPatientNotifications()} disabled={notificationBusy} style={{ minHeight: 48, border: "none", borderRadius: 14, background: "#DBEAFE", color: "#1D4ED8", fontSize: patientTextBase, fontWeight: 900, fontFamily: "inherit", opacity: notificationBusy ? 0.6 : 1 }}>
                  {notificationBusy ? labels.enablingAlerts : labels.enableAlerts}
                </button>
              )}
              {notificationFeedback && (
                <div style={{ fontSize: patientTextSmall, color: darkMode ? "#CBD5E1" : "#64748B", fontWeight: 700, lineHeight: 1.45 }}>
                  {notificationFeedback}
                </div>
              )}
            </div>
            <div style={{ fontSize: patientTextBase, lineHeight: 1.45, marginBottom: 10 }}>{labels.textSize}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setTextSize("normal")} style={{ height: 48, border: "none", borderRadius: 14, background: textSize === "normal" ? "#075e54" : inputPanelBg, color: textSize === "normal" ? "#fff" : textPrimary, fontSize: patientTextBase, fontWeight: 800 }}>{labels.normal}</button>
              <button onClick={() => setTextSize("large")} style={{ height: 48, border: "none", borderRadius: 14, background: textSize === "large" ? "#075e54" : inputPanelBg, color: textSize === "large" ? "#fff" : textPrimary, fontSize: patientTextBase, fontWeight: 800 }}>{labels.large}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const roundButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
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
