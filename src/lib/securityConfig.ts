export const OWNER_EMAILS = [
  "siluetybodyart@gmail.com",
  "miguelafr31@gmail.com",
] as const;

export const PRIMARY_OWNER_EMAIL = OWNER_EMAILS[0];

export const isOwnerEmail = (value?: string | null) => {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return OWNER_EMAILS.includes(normalized as (typeof OWNER_EMAILS)[number]);
};
