export const CHAT_FILES_BUCKET = "chat-files";
export type SignedChatFileUrlCache = Map<string, { url: string; expiresAt: number }>;

const STORAGE_PATH_MARKERS = [
  `/storage/v1/object/public/${CHAT_FILES_BUCKET}/`,
  `/storage/v1/object/sign/${CHAT_FILES_BUCKET}/`,
  `/storage/v1/object/authenticated/${CHAT_FILES_BUCKET}/`,
];

export const extractChatFilePath = (value?: string | null) => {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  if (raw.startsWith("patients/") || raw.startsWith("profile-photos/")) return raw;

  try {
    const url = new URL(raw);
    for (const marker of STORAGE_PATH_MARKERS) {
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      }
    }
  } catch {}

  return "";
};

export const isChatFileReference = (value?: string | null) => Boolean(extractChatFilePath(value));

export const patientMediaUrl = (value: string, roomId: string, roomToken: string) => {
  const path = extractChatFilePath(value);
  if (!path) return value;
  const params = new URLSearchParams({ roomId, roomToken, path });
  return `/api/patient-room/media?${params.toString()}`;
};

export async function createSignedChatFileUrl(
  supabase: any,
  value?: string | null,
  expiresIn = 3600,
  cache?: SignedChatFileUrlCache,
) {
  const path = extractChatFilePath(value);
  if (!path) return value || "";
  const now = Date.now();
  const cached = cache?.get(path);
  if (cached && cached.expiresAt > now) return cached.url;
  const { data, error } = await supabase.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return value || "";
  const signedUrl = data.signedUrl as string;
  cache?.set(path, {
    url: signedUrl,
    expiresAt: now + Math.max(30, expiresIn - 60) * 1000,
  });
  return signedUrl;
}

export async function signMessageMediaUrls<T extends { content?: string | null; file_url?: string | null; message_type?: string | null }>(
  supabase: any,
  messages: T[],
  expiresIn = 3600,
  cache?: SignedChatFileUrlCache,
) {
  return Promise.all(messages.map(async (message) => {
    const messageType = `${message.message_type || ""}`;
    if (!["image", "video", "audio", "file"].includes(messageType)) return message;
    const signedContent = await createSignedChatFileUrl(supabase, message.content || message.file_url || "", expiresIn, cache);
    const signedFileUrl = await createSignedChatFileUrl(supabase, message.file_url || message.content || "", expiresIn, cache);
    return {
      ...message,
      content: signedContent || message.content,
      file_url: signedFileUrl || message.file_url,
    };
  }));
}
