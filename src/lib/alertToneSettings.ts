export type AlertTone = "classic" | "soft" | "urgent" | "critical" | "off";

export const STAFF_ALERT_TONES_SETTING_KEY = "staff_alert_tones";
export const ALERT_TONE_OPTIONS: AlertTone[] = ["classic", "soft", "urgent", "critical", "off"];

export const normalizeAlertTone = (value: unknown, fallback: AlertTone = "classic"): AlertTone => {
  return value === "classic" || value === "soft" || value === "urgent" || value === "critical" || value === "off"
    ? value
    : fallback;
};

export const parseStaffAlertToneMap = (value: unknown): Record<string, AlertTone> => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([staffId, tone]) => [staffId, normalizeAlertTone(tone, "classic")] as const)
        .filter(([staffId]) => Boolean(staffId)),
    );
  } catch {
    return {};
  }
};

export const serializeStaffAlertToneMap = (map: Record<string, AlertTone>) => JSON.stringify(map);

export const alertToneText = (tone: AlertTone, isSpanish: boolean) => ({
  classic: isSpanish ? "Portal" : "Portal",
  soft: isSpanish ? "Suave" : "Soft",
  urgent: isSpanish ? "Urgente" : "Urgent",
  critical: isSpanish ? "Crítico repetido" : "Critical repeat",
  off: isSpanish ? "Silencio" : "Silent",
}[tone]);
