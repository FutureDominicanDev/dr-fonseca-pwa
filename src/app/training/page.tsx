"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Lang = "es" | "en";
type TrainingStep = {
  title: Record<Lang, string>;
  copy: Record<Lang, string>;
  screen: Record<Lang, string>;
  tap: Record<Lang, string>;
};
type TrainingModule = {
  id: string;
  icon: string;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  steps: TrainingStep[];
};

const modules: TrainingModule[] = [
  {
    id: "start",
    icon: "01",
    title: { es: "Primer ingreso", en: "First sign in" },
    summary: {
      es: "Registro, espera de aprobacion y entrada segura.",
      en: "Signup, approval wait, and secure entry.",
    },
    steps: [
      {
        title: { es: "Abre el portal", en: "Open the portal" },
        copy: {
          es: "Usa el enlace enviado por la clinica o abre el portal desde el icono de la app.",
          en: "Use the clinic link or open the portal from the app icon.",
        },
        screen: { es: "Bienvenido al portal medico", en: "Welcome to the medical portal" },
        tap: { es: "Entrar", en: "Sign in" },
      },
      {
        title: { es: "Elige celular o correo", en: "Choose phone or email" },
        copy: {
          es: "El personal puede registrarse con celular o correo. La cuenta queda pendiente hasta que la aprueben.",
          en: "Staff can register with phone or email. The account stays pending until approved.",
        },
        screen: { es: "Crear cuenta staff", en: "Create staff account" },
        tap: { es: "Continuar", en: "Continue" },
      },
      {
        title: { es: "Espera aprobacion", en: "Wait for approval" },
        copy: {
          es: "Mientras la cuenta esta pendiente, no se muestra informacion de pacientes.",
          en: "While the account is pending, no patient information is shown.",
        },
        screen: { es: "Cuenta en revision", en: "Account under review" },
        tap: { es: "Revisar estado", en: "Check status" },
      },
    ],
  },
  {
    id: "recovery",
    icon: "02",
    title: { es: "Recuperar acceso", en: "Recover access" },
    summary: {
      es: "Como recuperar contrasena por correo o celular.",
      en: "How to recover a password by email or phone.",
    },
    steps: [
      {
        title: { es: "Toca Olvide mi acceso", en: "Tap forgot access" },
        copy: {
          es: "Desde login, pide un enlace seguro de recuperacion.",
          en: "From login, request a secure recovery link.",
        },
        screen: { es: "Recuperar acceso", en: "Recover access" },
        tap: { es: "Enviar enlace", en: "Send link" },
      },
      {
        title: { es: "Revisa el destino correcto", en: "Check the right destination" },
        copy: {
          es: "Usa el correo o celular guardado en tu perfil. Si no llega, avisa al administrador.",
          en: "Use the email or phone saved on your profile. If it does not arrive, tell an administrator.",
        },
        screen: { es: "Correo o celular", en: "Email or phone" },
        tap: { es: "Confirmar", en: "Confirm" },
      },
    ],
  },
  {
    id: "patients",
    icon: "03",
    title: { es: "Pacientes y salas", en: "Patients and rooms" },
    summary: {
      es: "Buscar, abrir y trabajar solo salas asignadas.",
      en: "Find, open, and work only assigned rooms.",
    },
    steps: [
      {
        title: { es: "Busca paciente", en: "Find a patient" },
        copy: {
          es: "Busca por nombre, telefono, correo, procedimiento o sede.",
          en: "Search by name, phone, email, procedure, or office.",
        },
        screen: { es: "Buscar paciente", en: "Find patient" },
        tap: { es: "Buscar", en: "Search" },
      },
      {
        title: { es: "Abre la sala correcta", en: "Open the right room" },
        copy: {
          es: "El personal regular solo ve salas asignadas. El doctor conserva acceso total.",
          en: "Regular staff only see assigned rooms. The doctor keeps full access.",
        },
        screen: { es: "Salas asignadas", en: "Assigned rooms" },
        tap: { es: "Abrir", en: "Open" },
      },
      {
        title: { es: "Revisa antes de compartir", en: "Review before sharing" },
        copy: {
          es: "Antes de enviar informacion fuera del portal, verifica que sea el expediente correcto.",
          en: "Before sending information outside the portal, confirm it is the correct record.",
        },
        screen: { es: "Expediente seguro", en: "Secure record" },
        tap: { es: "Revisar", en: "Review" },
      },
    ],
  },
  {
    id: "messages",
    icon: "04",
    title: { es: "Mensajes y llamadas", en: "Messages and calls" },
    summary: {
      es: "Responder pacientes, llamar y usar audio.",
      en: "Reply to patients, call, and use audio.",
    },
    steps: [
      {
        title: { es: "Lee el contexto", en: "Read the context" },
        copy: {
          es: "Abre el chat y revisa los mensajes previos antes de responder.",
          en: "Open the chat and review earlier messages before replying.",
        },
        screen: { es: "Chat del paciente", en: "Patient chat" },
        tap: { es: "Responder", en: "Reply" },
      },
      {
        title: { es: "Usa telefono o audio", en: "Use phone or audio" },
        copy: {
          es: "Cuando sea necesario, llama o graba una nota de voz dentro del flujo.",
          en: "When needed, call or record a voice note inside the workflow.",
        },
        screen: { es: "Llamada y audio", en: "Call and audio" },
        tap: { es: "Grabar", en: "Record" },
      },
    ],
  },
  {
    id: "media",
    icon: "05",
    title: { es: "Fotos, video y archivos", en: "Photos, video, and files" },
    summary: {
      es: "Subir medios del paciente con cuidado.",
      en: "Upload patient media carefully.",
    },
    steps: [
      {
        title: { es: "Elige el tipo correcto", en: "Choose the right type" },
        copy: {
          es: "Selecciona foto, video, audio, documento o medicamento antes de enviar.",
          en: "Choose photo, video, audio, document, or medication before sending.",
        },
        screen: { es: "Subir archivo", en: "Upload file" },
        tap: { es: "Elegir", en: "Choose" },
      },
      {
        title: { es: "Confirma el paciente", en: "Confirm the patient" },
        copy: {
          es: "Nunca subas fotos o videos si no estas seguro de que pertenecen a esa sala.",
          en: "Never upload photos or videos unless you are sure they belong to that room.",
        },
        screen: { es: "Confirmar sala", en: "Confirm room" },
        tap: { es: "Enviar", en: "Send" },
      },
    ],
  },
  {
    id: "internal",
    icon: "06",
    title: { es: "Notas internas", en: "Internal notes" },
    summary: {
      es: "Notas y fotos privadas del equipo clinico.",
      en: "Private notes and photos for the clinical team.",
    },
    steps: [
      {
        title: { es: "Abre notas internas", en: "Open internal notes" },
        copy: {
          es: "Estas notas son para el equipo autorizado, no para pacientes.",
          en: "These notes are for authorized staff, not patients.",
        },
        screen: { es: "Notas internas", en: "Internal notes" },
        tap: { es: "Nueva nota", en: "New note" },
      },
      {
        title: { es: "Escribe solo lo necesario", en: "Write only what is needed" },
        copy: {
          es: "Incluye informacion util, profesional y relacionada con el expediente.",
          en: "Include useful, professional information related to the record.",
        },
        screen: { es: "Nota del equipo", en: "Team note" },
        tap: { es: "Guardar", en: "Save" },
      },
    ],
  },
  {
    id: "labels",
    icon: "07",
    title: { es: "Etiquetas", en: "Labels" },
    summary: {
      es: "Organizar pacientes con etiquetas visibles al equipo.",
      en: "Organize patients with labels visible to the team.",
    },
    steps: [
      {
        title: { es: "Crea una etiqueta", en: "Create a label" },
        copy: {
          es: "Usa etiquetas para seguimiento, prioridades o recordatorios de flujo.",
          en: "Use labels for follow-up, priority, or workflow reminders.",
        },
        screen: { es: "Gestionar etiquetas", en: "Manage labels" },
        tap: { es: "Crear", en: "Create" },
      },
      {
        title: { es: "Asignala al paciente", en: "Assign it to a patient" },
        copy: {
          es: "Elige la etiqueta correcta para evitar confusion entre sedes o procedimientos.",
          en: "Pick the correct label to avoid confusion between offices or procedures.",
        },
        screen: { es: "Etiqueta del paciente", en: "Patient label" },
        tap: { es: "Asignar", en: "Assign" },
      },
    ],
  },
  {
    id: "team-chat",
    icon: "08",
    title: { es: "Chat staff", en: "Staff chat" },
    summary: {
      es: "Conversaciones privadas entre miembros del equipo.",
      en: "Private conversations between team members.",
    },
    steps: [
      {
        title: { es: "Abre chat staff", en: "Open staff chat" },
        copy: {
          es: "Usalo para coordinar trabajo interno sin ponerlo en el chat del paciente.",
          en: "Use it to coordinate internal work without adding it to the patient chat.",
        },
        screen: { es: "Chat staff", en: "Staff chat" },
        tap: { es: "Abrir", en: "Open" },
      },
      {
        title: { es: "Mantiene contexto profesional", en: "Keep professional context" },
        copy: {
          es: "Las conversaciones internas tambien pueden ser revisadas por administracion autorizada.",
          en: "Internal conversations can also be reviewed by authorized administration.",
        },
        screen: { es: "Comunicacion interna", en: "Internal communication" },
        tap: { es: "Enviar", en: "Send" },
      },
    ],
  },
  {
    id: "admin",
    icon: "09",
    title: { es: "Admin y permisos", en: "Admin and permissions" },
    summary: {
      es: "Aprobar staff, permisos, auditoria y limpieza segura.",
      en: "Approve staff, permissions, audit, and safe cleanup.",
    },
    steps: [
      {
        title: { es: "Revisa solicitudes", en: "Review requests" },
        copy: {
          es: "Antes de aprobar, revisa nombre, correo, telefono, sede, dispositivo y ubicacion.",
          en: "Before approving, review name, email, phone, office, device, and location.",
        },
        screen: { es: "Solicitudes pendientes", en: "Pending requests" },
        tap: { es: "Ver detalles", en: "View details" },
      },
      {
        title: { es: "Da permisos claros", en: "Grant clear permissions" },
        copy: {
          es: "Toca el boton de informacion para entender cada derecho antes de otorgarlo.",
          en: "Tap the information button to understand each right before granting it.",
        },
        screen: { es: "Permisos del portal", en: "Portal permissions" },
        tap: { es: "Guardar", en: "Save" },
      },
      {
        title: { es: "Usa auditoria y archivo", en: "Use audit and archive" },
        copy: {
          es: "La limpieza real de datos debe hacerse con cuidado y solo por cuentas autorizadas.",
          en: "Real data cleanup must be done carefully and only by authorized accounts.",
        },
        screen: { es: "Auditoria y papelera", en: "Audit and trash" },
        tap: { es: "Revisar", en: "Review" },
      },
    ],
  },
];

const copy = {
  es: {
    kicker: "Centro de entrenamiento",
    title: "Guias visuales para usar el portal",
    intro: "Entrenamiento bilingue con pasos tipo video, simulacion de iPhone y narracion opcional. No contiene datos reales de pacientes.",
    play: "Reproducir",
    pause: "Pausar",
    listen: "Escuchar",
    stopAudio: "Detener audio",
    previous: "Anterior",
    next: "Siguiente",
    replay: "Reiniciar",
    openPortal: "Portal",
    openAdmin: "Admin",
    openHelp: "Ayuda",
    progress: "Progreso",
    moduleList: "Temas",
    privacy: "Este entrenamiento es seguro para nuevos ingresos porque no abre expedientes reales.",
    adminNote: "Para administradores: comparte este enlace con personal nuevo antes o despues de aprobar su cuenta.",
  },
  en: {
    kicker: "Training center",
    title: "Visual guides for using the portal",
    intro: "Bilingual training with video-style steps, an iPhone simulation, and optional narration. It contains no real patient data.",
    play: "Play",
    pause: "Pause",
    listen: "Listen",
    stopAudio: "Stop audio",
    previous: "Previous",
    next: "Next",
    replay: "Restart",
    openPortal: "Portal",
    openAdmin: "Admin",
    openHelp: "Help",
    progress: "Progress",
    moduleList: "Topics",
    privacy: "This training is safe for new staff because it does not open real records.",
    adminNote: "For admins: share this link with new staff before or after their account is approved.",
  },
};

export default function TrainingPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [activeId, setActiveId] = useState(modules[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const activeModule = useMemo(
    () => modules.find((module) => module.id === activeId) || modules[0],
    [activeId],
  );
  const activeStep = activeModule.steps[stepIndex] || activeModule.steps[0];
  const totalSteps = activeModule.steps.length;
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);
  const t = copy[lang];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= totalSteps - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [playing, totalSteps]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  const chooseModule = (id: string) => {
    setActiveId(id);
    setStepIndex(0);
    setPlaying(false);
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    window.setTimeout(() => document.getElementById("training-guide")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const previousStep = () => setStepIndex((current) => Math.max(0, current - 1));
  const nextStep = () => setStepIndex((current) => Math.min(totalSteps - 1, current + 1));
  const restart = () => {
    setStepIndex(0);
    setPlaying(true);
  };

  const speakStep = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${activeStep.title[lang]}. ${activeStep.copy[lang]}`);
    utterance.lang = lang === "es" ? "es-MX" : "en-US";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const goTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #eef4fb; }
        .training-shell { height: 100dvh; min-height: -webkit-fill-available; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: #eef4fb; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .training-topbar { position: sticky; top: 0; z-index: 20; min-height: calc(82px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) max(18px, env(safe-area-inset-right)) 14px max(18px, env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(7, 56, 93, 0.94); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,0.12); }
        .training-logo { width: 224px; max-width: 42vw; height: auto; display: block; object-fit: contain; }
        .training-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .top-btn, .lang-btn, .control-btn, .module-btn { min-height: 44px; border: none; cursor: pointer; font-family: inherit; font-weight: 900; }
        .top-btn, .lang-btn { border-radius: 14px; background: #eff6ff; color: #0f172a; padding: 10px 14px; }
        .lang-btn { min-width: 92px; }
        .training-body { width: 100%; margin: 0; padding: 0 0 calc(44px + env(safe-area-inset-bottom)); }
        .training-hero { color: white; padding: 28px max(16px, env(safe-area-inset-right)) 42px max(16px, env(safe-area-inset-left)); background: linear-gradient(180deg, #0b63ce 0%, #0759b8 100%); box-shadow: inset 0 -1px 0 rgba(255,255,255,.16); }
        .training-hero > * { width: min(1180px, 100%); margin-left: auto; margin-right: auto; }
        .kicker { font-size: 12px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; opacity: .78; margin: 0 0 8px; }
        .training-hero h1 { font-size: clamp(34px, 6vw, 68px); line-height: .98; letter-spacing: 0; margin: 0 0 12px; max-width: 920px; }
        .training-hero p { font-size: clamp(16px, 2.3vw, 21px); line-height: 1.5; margin: 0; max-width: 900px; color: rgba(255,255,255,.88); }
        .training-layout { width: min(1180px, calc(100% - 32px)); margin: 24px auto 0; display: grid; grid-template-columns: minmax(250px, 330px) 1fr; gap: 18px; align-items: start; }
        .module-panel, .guide-panel, .note-band { background: rgba(255,255,255,.96); border: 1px solid #dbe7f7; border-radius: 8px; box-shadow: 0 14px 42px rgba(15,23,42,.08); }
        .module-panel { padding: 14px; display: grid; gap: 8px; }
        .panel-title { margin: 0 0 4px; font-size: 12px; font-weight: 950; color: #64748b; text-transform: uppercase; letter-spacing: .12em; }
        .module-btn { width: 100%; display: grid; grid-template-columns: 42px 1fr; gap: 10px; align-items: center; text-align: left; border-radius: 8px; padding: 10px; background: #f3f7fc; color: #0f172a; }
        .module-btn.active { background: #dbeafe; outline: 2px solid #93c5fd; }
        .module-index { width: 42px; height: 42px; border-radius: 8px; background: #0b63ce; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 950; }
        .module-name { font-size: 15px; font-weight: 950; display: block; }
        .module-summary { font-size: 12px; color: #64748b; line-height: 1.35; display: block; margin-top: 2px; }
        .guide-panel { padding: clamp(16px, 2.4vw, 24px); display: grid; grid-template-columns: minmax(250px, 340px) 1fr; gap: 22px; }
        .phone-frame { width: min(100%, 318px); aspect-ratio: 9 / 19.5; border-radius: 36px; padding: 12px; background: #0b172a; border: 7px solid #111827; box-shadow: 0 20px 50px rgba(15,23,42,.24); position: relative; margin: 0 auto; }
        .phone-screen { height: 100%; border-radius: 26px; background: linear-gradient(180deg, #eef6ff, #ffffff); overflow: hidden; position: relative; }
        .phone-status { height: 34px; display: flex; justify-content: space-between; align-items: center; padding: 0 18px; color: #0f172a; font-size: 12px; font-weight: 900; }
        .phone-header { background: #07385d; color: white; padding: 18px 14px; text-align: center; }
        .phone-header img { width: 178px; max-width: 82%; height: auto; display: block; margin: 0 auto; object-fit: contain; }
        .phone-content { padding: 18px 16px; display: grid; gap: 12px; }
        .mock-card { border: 1px solid #dbeafe; background: white; border-radius: 8px; padding: 14px; box-shadow: 0 8px 20px rgba(15,23,42,.05); }
        .mock-title { margin: 0 0 8px; font-size: 20px; line-height: 1.1; font-weight: 950; }
        .mock-copy { margin: 0; color: #64748b; font-size: 13px; line-height: 1.45; }
        .mock-input { height: 44px; border-radius: 8px; background: #eef2f7; display: flex; align-items: center; padding: 0 12px; color: #64748b; font-size: 13px; font-weight: 800; }
        .mock-action { height: 48px; border-radius: 999px; background: #0b63ce; color: white; display: flex; align-items: center; justify-content: center; font-weight: 950; margin-top: 4px; }
        .finger { width: 54px; height: 54px; border-radius: 999px; background: rgba(11,99,206,.18); border: 2px solid rgba(11,99,206,.9); position: absolute; right: 28px; bottom: 72px; display: flex; align-items: center; justify-content: center; animation: tapPulse 1.4s ease-in-out infinite; }
        .finger::after { content: ""; width: 17px; height: 17px; border-radius: 999px; background: #0b63ce; display: block; }
        @keyframes tapPulse { 0%, 100% { transform: scale(.92); opacity: .78; } 50% { transform: scale(1.06); opacity: 1; } }
        .guide-copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .progress-row { display: flex; align-items: center; gap: 12px; color: #64748b; font-size: 13px; font-weight: 900; margin-bottom: 16px; }
        .progress-track { flex: 1; height: 10px; border-radius: 999px; background: #e5edf7; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #14a4ff, #0b63ce); transition: width .25s ease; }
        .guide-copy h2 { font-size: clamp(28px, 4vw, 46px); line-height: 1.05; margin: 0 0 12px; }
        .guide-copy p { font-size: 17px; color: #475569; line-height: 1.65; margin: 0 0 18px; }
        .control-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .control-btn { border-radius: 999px; padding: 12px 16px; background: #eaf2ff; color: #0b3a5b; }
        .control-btn.primary { background: #0b63ce; color: white; }
        .control-btn.danger { background: #fee2e2; color: #991b1b; }
        .note-band { margin-top: 18px; padding: 16px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .note-band p { margin: 0; color: #334155; line-height: 1.55; font-size: 14px; font-weight: 750; }
        @media (max-width: 900px) {
          .training-layout, .guide-panel { grid-template-columns: 1fr; }
          .module-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .panel-title { grid-column: 1 / -1; }
          .training-topbar { position: sticky; align-items: flex-start; flex-direction: column; }
          .training-actions { width: 100%; justify-content: flex-start; }
        }
        @media (max-width: 560px) {
          .training-logo { max-width: 74vw; }
          .module-panel { grid-template-columns: 1fr; }
          .guide-panel { padding: 14px; }
          .phone-frame { max-width: 286px; }
          .note-band { grid-template-columns: 1fr; }
          .top-btn, .lang-btn, .control-btn { padding-left: 12px; padding-right: 12px; }
        }
      `}</style>

      <main className="training-shell">
        <header className="training-topbar">
          <Image className="training-logo" src="/fonseca_blue.png" alt="Dr. Miguel Fonseca" width={2120} height={606} priority />
          <div className="training-actions">
            <button className="lang-btn" type="button" onClick={() => setLang((current) => (current === "es" ? "en" : "es"))}>
              {lang === "es" ? "🇲🇽 ES" : "🇺🇸 EN"}
            </button>
            <button className="top-btn" type="button" onClick={() => goTo("/inbox")}>{t.openPortal}</button>
            <button className="top-btn" type="button" onClick={() => goTo("/admin")}>{t.openAdmin}</button>
            <button className="top-btn" type="button" onClick={() => goTo("/admin/ayuda")}>{t.openHelp}</button>
          </div>
        </header>

        <div className="training-body">
          <section className="training-hero">
            <p className="kicker">{t.kicker}</p>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </section>

          <section className="training-layout" aria-label={t.moduleList}>
            <aside className="module-panel">
              <p className="panel-title">{t.moduleList}</p>
              {modules.map((module) => (
                <button
                  key={module.id}
                  className={`module-btn${module.id === activeModule.id ? " active" : ""}`}
                  type="button"
                  onClick={() => chooseModule(module.id)}
                >
                  <span className="module-index">{module.icon}</span>
                  <span>
                    <span className="module-name">{module.title[lang]}</span>
                    <span className="module-summary">{module.summary[lang]}</span>
                  </span>
                </button>
              ))}
            </aside>

            <div>
              <section id="training-guide" className="guide-panel">
                <div className="phone-frame" aria-hidden="true">
                  <div className="phone-screen">
                    <div className="phone-status"><span>9:41</span><span>5G 100%</span></div>
                    <div className="phone-header">
                      <Image src="/fonseca_blue.png" alt="" width={2120} height={606} />
                    </div>
                    <div className="phone-content">
                      <div className="mock-card">
                        <p className="mock-title">{activeStep.screen[lang]}</p>
                        <p className="mock-copy">{activeStep.copy[lang]}</p>
                      </div>
                      <div className="mock-input">{activeModule.title[lang]}</div>
                      <div className="mock-action">{activeStep.tap[lang]}</div>
                    </div>
                    <div className="finger" />
                  </div>
                </div>

                <div className="guide-copy">
                  <div className="progress-row">
                    <span>{t.progress}</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                    <span>{stepIndex + 1}/{totalSteps}</span>
                  </div>
                  <p className="kicker">{activeModule.title[lang]}</p>
                  <h2>{activeStep.title[lang]}</h2>
                  <p>{activeStep.copy[lang]}</p>
                  <div className="control-row">
                    <button className="control-btn primary" type="button" onClick={() => setPlaying((current) => !current)}>
                      {playing ? t.pause : t.play}
                    </button>
                    <button className="control-btn" type="button" onClick={previousStep} disabled={stepIndex === 0}>{t.previous}</button>
                    <button className="control-btn" type="button" onClick={nextStep} disabled={stepIndex === totalSteps - 1}>{t.next}</button>
                    <button className="control-btn" type="button" onClick={restart}>{t.replay}</button>
                    <button className={`control-btn${speaking ? " danger" : ""}`} type="button" onClick={speakStep}>
                      {speaking ? t.stopAudio : t.listen}
                    </button>
                  </div>
                </div>
              </section>

              <section className="note-band">
                <p>{t.privacy}</p>
                <p>{t.adminNote}</p>
              </section>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
