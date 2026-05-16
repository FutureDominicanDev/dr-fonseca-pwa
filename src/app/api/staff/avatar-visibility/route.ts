import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  STAFF_AVATAR_VISIBILITY_SETTING_KEY,
  parseStaffAvatarVisibilityMap,
  serializeStaffAvatarVisibilityMap,
} from "@/lib/staffAvatarVisibility";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function PATCH(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Staff avatar visibility is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (typeof body?.visible !== "boolean") {
      return NextResponse.json({ error: "Missing visibility value." }, { status: 400 });
    }

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", STAFF_AVATAR_VISIBILITY_SETTING_KEY)
      .maybeSingle();

    const map = parseStaffAvatarVisibilityMap(setting?.value);
    map[user.id] = body.visible;

    const { error: saveError } = await adminClient
      .from("app_settings")
      .upsert(
        { key: STAFF_AVATAR_VISIBILITY_SETTING_KEY, value: serializeStaffAvatarVisibilityMap(map), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (saveError) {
      return NextResponse.json({ error: saveError.message || "Could not save avatar visibility." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, visible: body.visible });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected avatar visibility error." }, { status: 500 });
  }
}
