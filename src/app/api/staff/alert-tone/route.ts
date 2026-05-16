import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  STAFF_ALERT_TONES_SETTING_KEY,
  normalizeAlertTone,
  parseStaffAlertToneMap,
  serializeStaffAlertToneMap,
  type AlertTone,
} from "@/lib/alertToneSettings";
import { isOwnerIdentity } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const authClient = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const adminClient = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const loadRequester = async (request: NextRequest) => {
  if (!configured || !authClient || !adminClient) return { error: "Staff alert tones are not configured.", status: 503 as const };
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing session.", status: 401 as const };

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id) return { error: "Invalid session.", status: 401 as const };

  const { data: profile } = await adminClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile: profile as Record<string, any> | null };
};

const canManageStaffAlertTone = (requester: { id: string; email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> }, profile: Record<string, any> | null) => {
  const metadata = requester.user_metadata || {};
  const requesterIsOwner = isOwnerIdentity({
    id: requester.id,
    email: requester.email,
    phone: profile?.phone || requester.phone || `${metadata.phone || ""}`,
    fullName: profile?.full_name || `${metadata.full_name || ""}`,
    displayName: profile?.display_name || "",
    adminLevel: profile?.admin_level || "",
  });
  return requesterIsOwner || `${profile?.admin_level || ""}`.toLowerCase() === "super_admin";
};

export async function GET(request: NextRequest) {
  try {
    const loaded = await loadRequester(request);
    if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    if (!adminClient) return NextResponse.json({ error: "Staff alert tones are not configured." }, { status: 503 });

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", STAFF_ALERT_TONES_SETTING_KEY)
      .maybeSingle();
    const toneMap = parseStaffAlertToneMap(setting?.value);
    const tone = toneMap[loaded.user.id] || null;
    return NextResponse.json({ managed: Boolean(tone), tone });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not load alert tone." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const loaded = await loadRequester(request);
    if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    if (!adminClient) return NextResponse.json({ error: "Staff alert tones are not configured." }, { status: 503 });
    if (!canManageStaffAlertTone(loaded.user, loaded.profile)) {
      return NextResponse.json({ error: "Only the owner or a super admin can manage staff alert tones." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const staffId = `${body?.staffId || ""}`.trim();
    const tone = body?.tone === null || body?.tone === "" ? null : normalizeAlertTone(body?.tone, "classic");
    if (!staffId) return NextResponse.json({ error: "Missing staff member." }, { status: 400 });

    const { data: targetProfile } = await adminClient.from("profiles").select("*").eq("id", staffId).maybeSingle();
    if (!targetProfile) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    const targetIsOwner = isOwnerIdentity({
      id: staffId,
      email: (targetProfile as any).email,
      phone: (targetProfile as any).phone,
      fullName: (targetProfile as any).full_name,
      displayName: (targetProfile as any).display_name,
      adminLevel: (targetProfile as any).admin_level,
    });
    const requesterIsOwner = canManageStaffAlertTone(loaded.user, loaded.profile) && isOwnerIdentity({
      id: loaded.user.id,
      email: loaded.user.email,
      phone: loaded.profile?.phone || loaded.user.phone,
      fullName: loaded.profile?.full_name,
      displayName: loaded.profile?.display_name,
      adminLevel: loaded.profile?.admin_level,
    });
    if (targetIsOwner && !requesterIsOwner) {
      return NextResponse.json({ error: "Only the owner can manage the owner alert tone." }, { status: 403 });
    }

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", STAFF_ALERT_TONES_SETTING_KEY)
      .maybeSingle();
    const toneMap = parseStaffAlertToneMap(setting?.value);
    if (tone) {
      toneMap[staffId] = tone as AlertTone;
    } else {
      delete toneMap[staffId];
    }

    const { error: saveError } = await adminClient
      .from("app_settings")
      .upsert(
        { key: STAFF_ALERT_TONES_SETTING_KEY, value: serializeStaffAlertToneMap(toneMap), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (saveError) return NextResponse.json({ error: saveError.message || "Could not save alert tone." }, { status: 500 });

    return NextResponse.json({ ok: true, staffId, tone });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not save alert tone." }, { status: 500 });
  }
}
