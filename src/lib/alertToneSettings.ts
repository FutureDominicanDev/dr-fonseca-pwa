export type AlertTone = "classic" | "soft" | "urgent" | "critical" | "off";
export type AlertToneCategory = "portal" | "staffChat";
export type StaffAlertTonePreference = Record<AlertToneCategory, AlertTone | null>;

export const STAFF_ALERT_TONES_SETTING_KEY = "staff_alert_tones";
export const ALERT_TONE_OPTIONS: AlertTone[] = ["classic", "soft", "urgent", "critical", "off"];
export const STAFF_ALERT_TONE_CATEGORIES: AlertToneCategory[] = ["portal", "staffChat"];

export const normalizeAlertTone = (value: unknown, fallback: AlertTone = "classic"): AlertTone => {
  return value === "classic" || value === "soft" || value === "urgent" || value === "critical" || value === "off"
    ? value
    : fallback;
};

export const emptyStaffAlertTonePreference = (): StaffAlertTonePreference => ({ portal: null, staffChat: null });

export const normalizeStaffAlertTonePreference = (value: unknown): StaffAlertTonePreference => {
  if (typeof value === "string") {
    const tone = normalizeAlertTone(value, "classic");
    return { portal: tone, staffChat: tone };
  }

  if (value && typeof value === "object") {
    const entry = value as Record<string, unknown>;
    return {
      portal: entry.portal === null || entry.portal === "" ? null : normalizeAlertTone(entry.portal, "classic"),
      staffChat: entry.staffChat === null || entry.staffChat === "" ? null : normalizeAlertTone(entry.staffChat, "classic"),
    };
  }

  return emptyStaffAlertTonePreference();
};

export const parseStaffAlertToneMap = (value: unknown): Record<string, StaffAlertTonePreference> => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([staffId, preference]) => [staffId, normalizeStaffAlertTonePreference(preference)] as const)
        .filter(([staffId]) => Boolean(staffId)),
    );
  } catch {
    return {};
  }
};

export const serializeStaffAlertToneMap = (map: Record<string, StaffAlertTonePreference>) => JSON.stringify(map);

export const alertToneText = (tone: AlertTone, isSpanish: boolean) => ({
  classic: isSpanish ? "Portal" : "Portal",
  soft: isSpanish ? "Suave" : "Soft",
  urgent: isSpanish ? "Urgente" : "Urgent",
  critical: isSpanish ? "Crítico repetido" : "Critical repeat",
  off: isSpanish ? "Silencio" : "Silent",
}[tone]);

export const alertToneTextForCategory = (tone: AlertTone, category: AlertToneCategory, isSpanish: boolean) => {
  if (category === "staffChat") {
    return {
      classic: isSpanish ? "Chat" : "Chat",
      soft: isSpanish ? "Chat suave" : "Soft chat",
      urgent: isSpanish ? "Chat urgente" : "Urgent chat",
      critical: isSpanish ? "Chat crítico" : "Critical chat",
      off: isSpanish ? "Silencio" : "Silent",
    }[tone];
  }

  return alertToneText(tone, isSpanish);
};
