export const STAFF_AVATAR_VISIBILITY_SETTING_KEY = "staff_avatar_visibility";

export type StaffAvatarVisibilityMap = Record<string, boolean>;

export const parseStaffAvatarVisibilityMap = (value: unknown): StaffAvatarVisibilityMap => {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([id]) => Boolean(id))
        .map(([id, visible]) => [id, visible !== false]),
    );
  } catch {
    return {};
  }
};

export const serializeStaffAvatarVisibilityMap = (map: StaffAvatarVisibilityMap) =>
  JSON.stringify(map);

export const staffAvatarVisibleToStaff = (
  map: StaffAvatarVisibilityMap,
  userId?: string | null,
) => {
  if (!userId) return true;
  return map[userId] !== false;
};
