import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";
import {
  STAFF_INVITE_CODES_SETTING_KEY,
  createStaffInviteCode,
  parseStaffInviteCodes,
  pruneStaffInviteCodes,
  serializeStaffInviteCodes,
  staffInviteExpiry,
} from "@/lib/staffInviteCodes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Invite generation is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing staff session." }, { status: 401 });

    const { data: requesterAuth, error: requesterAuthError } = await adminClient.auth.getUser(token);
    const requester = requesterAuth?.user;
    if (requesterAuthError || !requester?.id) {
      return NextResponse.json({ error: "Invalid staff session." }, { status: 401 });
    }

    const [{ data: requesterProfile }, { data: permissionSetting }, { data: inviteSetting }] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_INVITE_CODES_SETTING_KEY).maybeSingle(),
    ]);

    const permissionMap = parseStaffPermissionMap(permissionSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const requesterMetadata = (requester.user_metadata || {}) as Record<string, unknown>;
    const permissionProfile = requesterProfile
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
    if (!requesterIsOwner && !hasPermission(permissionProfile, requesterEmail, "manage_staff")) {
      return NextResponse.json({ error: "Not allowed to create staff invitation codes." }, { status: 403 });
    }

    const now = new Date();
    const records = pruneStaffInviteCodes(parseStaffInviteCodes(inviteSetting?.value), now);
    const existingCodes = new Set(records.map((record) => record.code));
    let code = createStaffInviteCode();
    for (let index = 0; existingCodes.has(code) && index < 8; index += 1) {
      code = createStaffInviteCode();
    }

    const createdAt = now.toISOString();
    const expiresAt = staffInviteExpiry(now);
    const nextRecords = pruneStaffInviteCodes([
      ...records,
      {
        code,
        createdAt,
        expiresAt,
        createdBy: requester.id,
        createdByEmail: requesterEmail || null,
      },
    ], now);

    const { error: saveError } = await adminClient
      .from("app_settings")
      .upsert(
        { key: STAFF_INVITE_CODES_SETTING_KEY, value: serializeStaffInviteCodes(nextRecords), updated_at: createdAt },
        { onConflict: "key" },
      );
    if (saveError) {
      return NextResponse.json({ error: saveError.message || "Could not create invitation code." }, { status: 500 });
    }

    return NextResponse.json({ code, expiresAt });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected invite generation error." }, { status: 500 });
  }
}
