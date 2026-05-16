import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const authClient = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const adminClient = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const NATIVE_PUSH_TOKENS_SETTING_KEY = "native_push_tokens";
const MAX_TOKENS_PER_TARGET = 6;

type NativeTokenEntry = {
  token: string;
  platform: string;
  updatedAt: string;
};

type NativePushTokenMap = {
  staff?: Record<string, NativeTokenEntry[]>;
  patientRooms?: Record<string, NativeTokenEntry[]>;
};

const parseNativePushTokenMap = (value: unknown): NativePushTokenMap => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as NativePushTokenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const upsertEntry = (entries: NativeTokenEntry[] | undefined, entry: NativeTokenEntry) => {
  const next = [entry, ...(entries || []).filter((item) => item.token !== entry.token)];
  return next.slice(0, MAX_TOKENS_PER_TARGET);
};

export async function POST(request: NextRequest) {
  try {
    if (!configured || !authClient || !adminClient) {
      return NextResponse.json({ error: "Native push is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const token = `${body?.token || ""}`.trim();
    const platform = `${body?.platform || "native"}`.trim().slice(0, 32) || "native";
    const userType = body?.userType === "patient" ? "patient" : body?.userType === "staff" ? "staff" : "";
    if (!token || token.length > 512 || !userType) {
      return NextResponse.json({ error: "Invalid native push token." }, { status: 400 });
    }

    let targetKind: "staff" | "patientRooms" = "staff";
    let targetId = "";

    if (userType === "staff") {
      const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) return NextResponse.json({ error: "Missing staff session." }, { status: 401 });
      const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
      const userId = authData?.user?.id || "";
      if (authError || !userId) return NextResponse.json({ error: "Invalid staff session." }, { status: 401 });
      const { data: profile } = await adminClient.from("profiles").select("id, role").eq("id", userId).maybeSingle();
      if (!profile?.id || `${profile.role || ""}`.toLowerCase() === "pending_staff") {
        return NextResponse.json({ error: "Staff account is not approved." }, { status: 403 });
      }
      targetId = profile.id;
    } else {
      const roomId = `${body?.roomId || ""}`.trim();
      const roomToken = `${body?.roomToken || ""}`.trim();
      if (!roomId || !roomToken) return NextResponse.json({ error: "Missing patient room access." }, { status: 401 });
      const { data: room } = await adminClient.from("rooms").select("id, patient_access_token").eq("id", roomId).maybeSingle();
      if (!room?.id || room.patient_access_token !== roomToken) {
        return NextResponse.json({ error: "Invalid patient room access." }, { status: 403 });
      }
      targetKind = "patientRooms";
      targetId = room.id;
    }

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", NATIVE_PUSH_TOKENS_SETTING_KEY)
      .maybeSingle();
    const map = parseNativePushTokenMap(setting?.value);
    const now = new Date().toISOString();
    const entry = { token, platform, updatedAt: now };
    const bucket = targetKind === "staff" ? { ...(map.staff || {}) } : { ...(map.patientRooms || {}) };
    bucket[targetId] = upsertEntry(bucket[targetId], entry);
    const nextMap: NativePushTokenMap = {
      staff: targetKind === "staff" ? bucket : map.staff || {},
      patientRooms: targetKind === "patientRooms" ? bucket : map.patientRooms || {},
    };

    const { error: saveError } = await adminClient
      .from("app_settings")
      .upsert(
        { key: NATIVE_PUSH_TOKENS_SETTING_KEY, value: JSON.stringify(nextMap), updated_at: now },
        { onConflict: "key" },
      );
    if (saveError) return NextResponse.json({ error: saveError.message || "Could not save native push token." }, { status: 500 });

    return NextResponse.json({ ok: true, userType, targetId, platform });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not save native push token." }, { status: 500 });
  }
}
