export type PatientPreferredLanguage = "es" | "en";

export const PATIENT_LANGUAGE_OPTIONS: Array<{ value: PatientPreferredLanguage; labelEs: string; labelEn: string }> = [
  { value: "es", labelEs: "Español", labelEn: "Spanish" },
  { value: "en", labelEs: "Inglés", labelEn: "English" },
];

export const PATIENT_TIMEZONE_OPTIONS = [
  { value: "America/Hermosillo", label: "Arizona / Sonora (UTC-7)" },
  { value: "America/Tijuana", label: "Tijuana / Baja California (UTC-8/UTC-7)" },
  { value: "America/Mexico_City", label: "Ciudad de México / Guadalajara (UTC-6)" },
  { value: "America/Bogota", label: "Bogotá / Lima (UTC-5)" },
  { value: "America/New_York", label: "Nueva York / Miami (UTC-5/UTC-4)" },
  { value: "America/Chicago", label: "Chicago / Dallas (UTC-6/UTC-5)" },
  { value: "America/Denver", label: "Denver (UTC-7/UTC-6)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (UTC-8/UTC-7)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/UTC+2)" },
  { value: "America/Toronto", label: "Toronto (UTC-5/UTC-4)" },
  { value: "America/Guatemala", label: "Guatemala (UTC-6)" },
  { value: "America/Costa_Rica", label: "Costa Rica (UTC-6)" },
] as const;

export const labelPatientLanguage = (value: string | null | undefined, lang: "es" | "en" = "es") => {
  const option = PATIENT_LANGUAGE_OPTIONS.find((entry) => entry.value === value);
  if (!option) return lang === "es" ? "Sin definir" : "Not set";
  return lang === "es" ? option.labelEs : option.labelEn;
};

export const labelTimeZone = (value: string | null | undefined) => {
  const option = PATIENT_TIMEZONE_OPTIONS.find((entry) => entry.value === value);
  return option?.label || value || "Sin definir";
};

export const currentTimeInZone = (timeZone: string | null | undefined, locale = "es-MX") => {
  if (!timeZone) return "";

  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone,
    }).format(new Date());
  } catch {
    return "";
  }
};

export const onboardingMessageForPatient = ({
  patientName,
  roomLink,
  preferredLanguage,
}: {
  patientName: string;
  roomLink: string;
  preferredLanguage: string;
}) => {
  if (preferredLanguage === "en") {
    return `Hello ${patientName}! 👋\n\nThis is your private message link with Dr. Fonseca's team:\n\n${roomLink}\n\nSave this link. It will take you back to your conversation, updates, and post-op messages. 🏥`;
  }

  return `Hola ${patientName}! 👋\n\nEste es tu enlace privado para comunicarte con el equipo del Dr. Fonseca:\n\n${roomLink}\n\nGuárdalo. Te llevará de vuelta a tu conversación, actualizaciones y mensajes postoperatorios. 🏥`;
};
