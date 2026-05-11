import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");
const CLEANUP_KEY = "maintenance_preop_cleanup_v1_ran_at";

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Missing admin session." }, { status: 401 });
    }

    const requesterRes = await supabase.auth.getUser(accessToken);
    const requester = requesterRes.data?.user;
    if (requesterRes.error || !requester) {
      return NextResponse.json({ ok: false, error: "Invalid admin session." }, { status: 401 });
    }

    const requesterEmail = requester.email?.trim().toLowerCase() || "";
    const requesterMetadata = (requester.user_metadata || {}) as Record<string, unknown>;
    const { data: requesterProfile } = await supabase.from("profiles").select("*").eq("id", requester.id).maybeSingle();
    const rawRequesterAdminLevel = `${(requesterProfile as any)?.admin_level || ""}`.toLowerCase();
    const requesterAdminLevel = rawRequesterAdminLevel === "owner" ? "super_admin" : rawRequesterAdminLevel;
    const requesterCanRunMaintenance = isOwnerIdentity({
      id: requester.id,
      email: requesterEmail,
      phone: `${(requesterProfile as any)?.phone || requester.phone || requesterMetadata.phone || ""}`,
      fullName: (requesterProfile as any)?.full_name || `${requesterMetadata.full_name || ""}`,
      displayName: (requesterProfile as any)?.display_name || "",
      adminLevel: `${(requesterProfile as any)?.admin_level || ""}`,
    }) || requesterAdminLevel === "super_admin";
    if (!requesterCanRunMaintenance) {
      return NextResponse.json({ ok: false, error: "Only owner or super admin can run maintenance." }, { status: 403 });
    }

    const { data: alreadyRan } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLEANUP_KEY)
      .maybeSingle();

    if (alreadyRan?.value) {
      return NextResponse.json({ ok: true, alreadyRan: true, marker: alreadyRan.value });
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ is_internal: true })
      .eq("is_internal", false)
      .or("file_name.ilike.[BEFORE]%,file_url.ilike.%/before/%,content.ilike.[BEFORE]%")
      .select("id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const runAt = new Date().toISOString();
    await supabase.from("app_settings").upsert(
      [{ key: CLEANUP_KEY, value: runAt, updated_at: runAt }],
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      alreadyRan: false,
      updatedCount: data?.length || 0,
      marker: runAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
