import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const parseEmails = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const parsePhones = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.replace(/[^\d+]/g, "").trim())
    .filter(Boolean);
};

const normalizePhone = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
};

const createInviteCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FONSECA-${suffix}`;
};

const roleLabelEs = (role?: string | null) => {
  if (role === "doctor") return "Doctor";
  if (role === "enfermeria") return "Enfermería";
  if (role === "coordinacion") return "Coordinación";
  if (role === "post_quirofano") return "Post-Q";
  return "Personal";
};

const isMissingSchemaError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const isUserNotFoundError = (error: any) => {
  const message = `${error?.message || ""}`.toLowerCase();
  const code = `${error?.code || ""}`.toLowerCase();
  return message.includes("user not found") || code === "user_not_found";
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "Missing admin session." }, { status: 401 });
    }

    const requesterRes = await supabase.auth.getUser(accessToken);
    const requester = requesterRes.data?.user;
    if (requesterRes.error || !requester) {
      return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });
    }

    const requesterEmail = requester.email?.trim().toLowerCase() || "";
    const { data: requesterProfile } = await supabase.from("profiles").select("admin_level").eq("id", requester.id).maybeSingle();
    const requesterAdminLevel = `${(requesterProfile as any)?.admin_level || ""}`.toLowerCase();
    const requesterIsOwner = isOwnerEmail(requesterEmail) || requesterAdminLevel === "owner";
    const requesterCanRevoke = requesterIsOwner || requesterAdminLevel === "super_admin";
    if (!requesterCanRevoke) {
      return NextResponse.json({ error: "Only super admin can delete staff users." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    if (userId === requester.id) {
      return NextResponse.json({ error: "You cannot delete your own account while signed in." }, { status: 403 });
    }

    const authUserRes = await supabase.auth.admin.getUserById(userId);
    if (authUserRes.error && !isUserNotFoundError(authUserRes.error)) {
      return NextResponse.json({ error: authUserRes.error.message || "Could not read auth user." }, { status: 500 });
    }
    const targetEmail = authUserRes.data?.user?.email?.trim().toLowerCase() || "";
    const targetPhoneFromAuth = normalizePhone(authUserRes.data?.user?.phone || "");
    if (isOwnerEmail(targetEmail)) {
      return NextResponse.json({ error: "Owner account is protected and cannot be revoked." }, { status: 403 });
    }

    const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const targetAdminLevel = `${(profileRow as any)?.admin_level || ""}`.toLowerCase();
    if (targetAdminLevel === "owner") {
      return NextResponse.json({ error: "Owner account is protected and cannot be revoked." }, { status: 403 });
    }
    if (targetAdminLevel === "super_admin" && !requesterIsOwner) {
      return NextResponse.json({ error: "Only an owner can delete a super admin user." }, { status: 403 });
    }

    const targetRole = typeof (profileRow as any)?.role === "string" ? (profileRow as any).role : "staff";
    const neutralRoleLabel = roleLabelEs(targetRole);
    const targetPhoneFromProfile = normalizePhone((profileRow as any)?.phone || "");
    const targetPhone = targetPhoneFromAuth || targetPhoneFromProfile;

    if (!targetEmail && !targetPhone) {
      return NextResponse.json({ error: "Could not resolve staff email/phone." }, { status: 404 });
    }

    const { data: blockedEmailSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "blocked_signup_emails")
      .maybeSingle();
    const { data: blockedPhoneSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "blocked_signup_phones")
      .maybeSingle();

    const blockedEmails = new Set(parseEmails(blockedEmailSetting?.value));
    if (targetEmail) blockedEmails.add(targetEmail);
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    if (targetPhone) blockedPhones.add(targetPhone);
    const nextBlockedEmails = Array.from(blockedEmails).sort().join(", ");
    const nextBlockedPhones = Array.from(blockedPhones).sort().join(", ");
    const nextInviteCode = createInviteCode();
    const nowIso = new Date().toISOString();

    const { error: settingsError } = await supabase
      .from("app_settings")
      .upsert(
        [
          { key: "blocked_signup_emails", value: nextBlockedEmails, updated_at: nowIso },
          { key: "blocked_signup_phones", value: nextBlockedPhones, updated_at: nowIso },
          { key: "invite_code", value: nextInviteCode, updated_at: nowIso },
        ],
        { onConflict: "key" },
      );
    if (settingsError) {
      return NextResponse.json({ error: settingsError.message || "Failed to update settings." }, { status: 500 });
    }

    // Detach historical references before removing the profile/auth user.
    // We preserve sender_name/sender_role text in messages, but remove hard FK sender_id.
    const cleanupErrors: string[] = [];

    const { error: clearMessageSenderError } = await supabase
      .from("messages")
      .update({ sender_id: null, sender_name: neutralRoleLabel, sender_role: targetRole })
      .eq("sender_id", userId);
    if (clearMessageSenderError && !isMissingSchemaError(clearMessageSenderError)) {
      cleanupErrors.push(`messages: ${clearMessageSenderError.message || "update failed"}`);
    }

    const { error: clearRoomMembersError } = await supabase.from("room_members").delete().eq("user_id", userId);
    if (clearRoomMembersError && !isMissingSchemaError(clearRoomMembersError)) {
      cleanupErrors.push(`room_members: ${clearRoomMembersError.message || "delete failed"}`);
    }

    const { error: clearPrivateMessagesError } = await supabase
      .from("staff_private_messages")
      .delete()
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    if (clearPrivateMessagesError && !isMissingSchemaError(clearPrivateMessagesError)) {
      cleanupErrors.push(`staff_private_messages: ${clearPrivateMessagesError.message || "delete failed"}`);
    }

    const { error: clearRoomsCreatorError } = await supabase
      .from("rooms")
      .update({ created_by: null })
      .eq("created_by", userId);
    if (clearRoomsCreatorError && !isMissingSchemaError(clearRoomsCreatorError)) {
      cleanupErrors.push(`rooms.created_by: ${clearRoomsCreatorError.message || "update failed"}`);
    }

    const { error: clearPatientStatusActorError } = await supabase
      .from("patients")
      .update({ record_status_changed_by: null })
      .eq("record_status_changed_by", userId);
    if (clearPatientStatusActorError && !isMissingSchemaError(clearPatientStatusActorError)) {
      cleanupErrors.push(`patients.record_status_changed_by: ${clearPatientStatusActorError.message || "update failed"}`);
    }

    const { error: clearAuditActorError } = await supabase
      .from("admin_audit_events")
      .update({ actor_id: null })
      .eq("actor_id", userId);
    if (clearAuditActorError && !isMissingSchemaError(clearAuditActorError)) {
      cleanupErrors.push(`admin_audit_events.actor_id: ${clearAuditActorError.message || "update failed"}`);
    }

    if (cleanupErrors.length) {
      return NextResponse.json(
        { error: `Failed to detach linked records: ${cleanupErrors.join(" | ")}` },
        { status: 500 },
      );
    }

    const { error: deleteProfileError } = await supabase.from("profiles").delete().eq("id", userId);
    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message || "Failed to remove profile row." }, { status: 500 });
    }

    const authDeleteRes = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteRes.error && !isUserNotFoundError(authDeleteRes.error)) {
      return NextResponse.json({ error: authDeleteRes.error.message || "Failed to remove auth user." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      removedEmail: targetEmail,
      removedPhone: targetPhone,
      newInviteCode: nextInviteCode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected revoke error." }, { status: 500 });
  }
}
