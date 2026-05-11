import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAT_FILES_BUCKET, extractChatFilePath } from "@/lib/chatFileUrls";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let adminClient: SupabaseClient | null = null;

const getAdminClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
};

const safeTokenEquals = (expected?: string | null, provided?: string | null) => {
  const left = `${expected || ""}`.trim();
  const right = `${provided || ""}`.trim();
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

async function hasPatientRoomAccess(client: SupabaseClient, roomId: string, roomToken: string) {
  const { data: room, error } = await client
    .from("rooms")
    .select("id, patient_access_token")
    .eq("id", roomId)
    .maybeSingle();
  return !error && Boolean(room?.id && safeTokenEquals(room.patient_access_token, roomToken));
}

async function roomMessageReferencesPath(client: SupabaseClient, roomId: string, path: string) {
  const { data, error } = await client
    .from("messages")
    .select("content, file_url, message_type")
    .eq("room_id", roomId)
    .or("is_internal.is.false,is_internal.is.null")
    .in("message_type", ["image", "video", "audio", "file"]);

  if (error) return false;
  return (data || []).some((message: any) => (
    extractChatFilePath(message.content) === path ||
    extractChatFilePath(message.file_url) === path
  ));
}

export async function GET(req: NextRequest) {
  try {
    const client = getAdminClient();
    if (!client) return NextResponse.json({ error: "Media service is not configured." }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const roomId = `${searchParams.get("roomId") || ""}`.trim();
    const roomToken = `${searchParams.get("roomToken") || ""}`.trim();
    const path = extractChatFilePath(searchParams.get("path"));
    if (!roomId || !roomToken || !path || path.includes("..")) {
      return NextResponse.json({ error: "Media access denied." }, { status: 403 });
    }

    const hasRoomAccess = await hasPatientRoomAccess(client, roomId, roomToken);
    if (!hasRoomAccess) return NextResponse.json({ error: "Media access denied." }, { status: 403 });

    const isReferencedByRoom = await roomMessageReferencesPath(client, roomId, path);
    if (!isReferencedByRoom) return NextResponse.json({ error: "Media access denied." }, { status: 403 });

    const { data, error } = await client.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: "Media not available." }, { status: 404 });

    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch (error) {
    console.error("patient media access failed", error);
    return NextResponse.json({ error: "Media access failed." }, { status: 500 });
  }
}
