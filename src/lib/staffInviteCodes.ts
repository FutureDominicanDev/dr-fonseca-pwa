export type StaffInviteCodeRecord = {
  code: string;
  createdAt: string;
  expiresAt: string;
  createdBy?: string | null;
  createdByEmail?: string | null;
  usedAt?: string | null;
  usedBy?: string | null;
  revokedAt?: string | null;
};

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const activeDays = 7;
const historyDays = 30;

export const STAFF_INVITE_CODES_SETTING_KEY = "staff_invite_codes";

export const normalizeStaffInviteCode = (value?: string | null) =>
  `${value || ""}`.trim().toUpperCase();

export const createStaffInviteCode = () => {
  const values = new Uint32Array(6);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  }

  let suffix = "";
  for (let index = 0; index < values.length; index += 1) {
    suffix += alphabet[values[index] % alphabet.length];
  }
  return `FONSECA-${suffix}`;
};

export const staffInviteExpiry = (createdAt = new Date()) =>
  new Date(createdAt.getTime() + activeDays * 24 * 60 * 60 * 1000).toISOString();

export const parseStaffInviteCodes = (value: unknown): StaffInviteCodeRecord[] => {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        code: normalizeStaffInviteCode(item?.code),
        createdAt: typeof item?.createdAt === "string" ? item.createdAt : "",
        expiresAt: typeof item?.expiresAt === "string" ? item.expiresAt : "",
        createdBy: typeof item?.createdBy === "string" ? item.createdBy : null,
        createdByEmail: typeof item?.createdByEmail === "string" ? item.createdByEmail : null,
        usedAt: typeof item?.usedAt === "string" ? item.usedAt : null,
        usedBy: typeof item?.usedBy === "string" ? item.usedBy : null,
        revokedAt: typeof item?.revokedAt === "string" ? item.revokedAt : null,
      }))
      .filter((item) => item.code && item.createdAt && item.expiresAt);
  } catch {
    return [];
  }
};

export const serializeStaffInviteCodes = (records: StaffInviteCodeRecord[]) =>
  JSON.stringify(records);

export const isActiveStaffInviteCode = (record: StaffInviteCodeRecord, now = new Date()) => {
  if (!record.code || record.usedAt || record.revokedAt) return false;
  const expiresAt = new Date(record.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
};

export const findActiveStaffInviteCode = (
  records: StaffInviteCodeRecord[],
  code: string,
  now = new Date(),
) => {
  const normalizedCode = normalizeStaffInviteCode(code);
  return records.find((record) => record.code === normalizedCode && isActiveStaffInviteCode(record, now));
};

export const pruneStaffInviteCodes = (records: StaffInviteCodeRecord[], now = new Date()) => {
  const historyCutoff = now.getTime() - historyDays * 24 * 60 * 60 * 1000;
  return records
    .filter((record) => {
      if (isActiveStaffInviteCode(record, now)) return true;
      const createdAt = new Date(record.createdAt).getTime();
      const usedAt = record.usedAt ? new Date(record.usedAt).getTime() : 0;
      const revokedAt = record.revokedAt ? new Date(record.revokedAt).getTime() : 0;
      return Math.max(createdAt, usedAt, revokedAt) > historyCutoff;
    })
    .slice(-100);
};

export const markStaffInviteCodeUsed = (
  records: StaffInviteCodeRecord[],
  code: string,
  userId: string,
  now = new Date(),
) => {
  const normalizedCode = normalizeStaffInviteCode(code);
  let matched = false;
  const nextRecords = records.map((record) => {
    if (record.code !== normalizedCode || !isActiveStaffInviteCode(record, now)) return record;
    matched = true;
    return { ...record, usedAt: now.toISOString(), usedBy: userId };
  });
  return { matched, records: pruneStaffInviteCodes(nextRecords, now) };
};
