export const OWNER_EMAILS = [
  "siluetybodyart@gmail.com",
  "miguelafr31@gmail.com",
] as const;

export const PRIMARY_OWNER_EMAIL = OWNER_EMAILS[0];

export const DEVELOPER_ACCESS_EMAILS = [
  "mrdiazsr@icloud.com",
] as const;

const OWNER_NAME_MARKERS = [
  ["miguel", "fonseca"],
] as const;

const ownerUserIds = () =>
  `${process.env.NEXT_PUBLIC_OWNER_USER_IDS || process.env.OWNER_USER_IDS || ""}`
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizePhoneForOwner = (value?: string | null) => {
  const cleaned = `${value || ""}`.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
};

const ownerPhones = () =>
  `${process.env.NEXT_PUBLIC_OWNER_PHONES || process.env.OWNER_PHONES || ""}`
    .split(/[,\n;]/g)
    .map((entry) => normalizePhoneForOwner(entry))
    .filter(Boolean);

export const isOwnerEmail = (value?: string | null) => {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return OWNER_EMAILS.includes(normalized as (typeof OWNER_EMAILS)[number]);
};

export const isDeveloperAccessEmail = (value?: string | null) => {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return DEVELOPER_ACCESS_EMAILS.includes(normalized as (typeof DEVELOPER_ACCESS_EMAILS)[number]);
};

export const isOwnerIdentity = (identity?: {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  adminLevel?: string | null;
}) => {
  if (!identity) return false;
  if (isOwnerEmail(identity.email)) return true;

  const normalizedId = `${identity.id || ""}`.trim();
  if (normalizedId && ownerUserIds().includes(normalizedId)) return true;

  const normalizedPhone = normalizePhoneForOwner(identity.phone);
  if (normalizedPhone && ownerPhones().includes(normalizedPhone)) return true;

  const adminLevel = `${identity.adminLevel || ""}`.trim().toLowerCase();
  const name = `${identity.fullName || ""} ${identity.displayName || ""}`.trim().toLowerCase();
  return adminLevel === "owner" && OWNER_NAME_MARKERS.some((tokens) => tokens.every((token) => name.includes(token)));
};
