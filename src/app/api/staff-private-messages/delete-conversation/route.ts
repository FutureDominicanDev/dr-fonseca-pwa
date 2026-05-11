import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing admin session." }, { status: 401 });

    const { data: requesterAuth, error: requesterAuthError } = await supabase.auth.getUser(token);
    const requester = requesterAuth?.user;
    if (requesterAuthError || !requester?.id) {
      return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });
    }

    const [{ data: requesterProfile }, { data: permissionSetting }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const requesterMetadata = (requester.user_metadata || {}) as Record<string, unknown>;
    const requesterPermissionProfile = requesterProfile
      ? { ...(requesterProfile as any), permissions: permissionMap[requester.id] ?? (requesterProfile as any).permissions }
      : null;
    const requesterIsOwner = isOwnerIdentity({
      id: requester.id,
      email: requesterEmail,
      phone: `${(requesterProfile as any)?.phone || requester.phone || requesterMetadata.phone || ""}`,
      fullName: (requesterProfile as any)?.full_name || `${requesterMetadata.full_name || ""}`,
      displayName: (requesterProfile as any)?.display_name || "",
      adminLevel: `${(requesterProfile as any)?.admin_level || ""}`,
    });
    if (!requesterIsOwner && !hasPermission(requesterPermissionProfile, requesterEmail, "delete_staff_chat")) {
      return NextResponse.json({ error: "Not allowed to delete staff chats." }, { status: 403 });
    }

    const body = await request.json().catch((): Record<string, unknown> => ({}));
    const rawParticipantIds = Array.isArray(body?.participantIds) ? (body.participantIds as unknown[]) : [];
    const participantIds = rawParticipantIds.map((entry: unknown) => `${entry || ""}`.trim()).filter(Boolean);
    const uniqueIds = [...new Set(participantIds)].filter(isUuidLike);
    if (uniqueIds.length !== 2) {
      return NextResponse.json({ error: "A staff chat conversation must have exactly two participants." }, { status: 400 });
    }

    const [firstId, secondId] = uniqueIds;
    const { error } = await supabase
      .from("staff_private_messages")
      .delete()
      .or(`and(sender_id.eq.${firstId},recipient_id.eq.${secondId}),and(sender_id.eq.${secondId},recipient_id.eq.${firstId})`);
    if (error) return NextResponse.json({ error: error.message || "Could not delete staff chat." }, { status: 500 });

    await supabase.from("admin_audit_events").insert({
      action: "staff_chat_deleted",
      entity_type: "staff_private_messages",
      entity_id: uniqueIds.sort().join(":"),
      entity_name: "Staff chat conversation",
      actor_id: requester.id,
      actor_name: (requesterProfile as any)?.full_name || (requesterProfile as any)?.display_name || requesterEmail,
      actor_email: requesterEmail,
      notes: "Deleted an internal staff-to-staff conversation.",
      metadata: { participant_ids: uniqueIds },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not delete staff chat." }, { status: 500 });
  }
}
