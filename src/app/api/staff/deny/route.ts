import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { normalizePhone } from "@/lib/authIdentity";
import { isOwnerEmail } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.drfonsecacirujanoplastico.com").replace(/\/+$/, "");
const SMTP_HOST = process.env.SMTP_HOST || "";
const smtpPortValue = `${process.env.SMTP_PORT || ""}`.trim().replace(/^["']|["']$/g, "");
const parsedSmtpPort = Number(smtpPortValue || "465");
const SMTP_PORT = Number.isFinite(parsedSmtpPort) ? parsedSmtpPort : 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Dr. Fonseca | Portal Medico";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isAliasEmail = (email: string) => email.toLowerCase().endsWith("@portal-staff.local");

type PendingStaffProfile = {
  id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  office_location?: string | null;
  admin_level?: string | null;
  permissions?: unknown;
};

type DenialNotification = {
  sent: boolean;
  method?: "email" | "phone" | "none";
  reason?: string;
  error?: string;
};

const createAdminClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const stringValue = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : `${value}`);

const errorField = (error: unknown, field: "message" | "details" | "hint" | "code") => {
  if (!error || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>)[field];
  return stringValue(value);
};

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
    .map((entry) => normalizePhone(entry))
    .filter(Boolean);
};

const createInviteCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FONSECA-${suffix}`;
};

const isMissingSchemaError = (error: unknown) => {
  const message = `${errorField(error, "message")} ${errorField(error, "details")} ${errorField(error, "hint")}`.toLowerCase();
  return (
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const isUserNotFoundError = (error: unknown) => {
  const message = errorField(error, "message").toLowerCase();
  const code = errorField(error, "code").toLowerCase();
  return message.includes("user not found") || code === "user_not_found";
};

const escapeHtml = (value: unknown) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendDenialEmail = async (params: { email: string; fullName: string; officeLocation?: string | null }): Promise<DenialNotification> => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
    return { sent: false, method: "email", reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const safeName = escapeHtml(params.fullName || "integrante del equipo");
  const safeOffice = escapeHtml(params.officeLocation || "No registrada");
  const supportLine = "Si crees que esto fue un error, contacta directamente a la clinica o al administrador del portal.";

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: params.email,
    subject: "Solicitud no aprobada - Portal Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${APP_URL}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MEDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:25px;color:#0f172a;">Solicitud no aprobada</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">Hola ${safeName}, tu solicitud de acceso como personal del Portal Medico de Dr. Fonseca no fue aprobada.</p>
            <p style="margin:0 0 8px 0;">Sede indicada: <strong>${safeOffice}</strong></p>
            <p style="margin:12px 0 0 0;color:#334155;line-height:1.65;">Por seguridad, la cuenta pendiente fue cerrada y ya no tiene acceso al portal.</p>
            <p style="margin:12px 0 0 0;color:#64748b;line-height:1.6;">${supportLine}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
            <p style="margin:0;color:#334155;line-height:1.65;">Your staff access request for Dr. Fonseca's Medical Portal was not approved. For security, the pending account was closed.</p>
          </div>
        </div>
      </div>
    `,
    text: `Solicitud no aprobada - Portal Dr. Fonseca\n\n${params.fullName || "Integrante del equipo"}, tu solicitud de acceso no fue aprobada. Sede indicada: ${params.officeLocation || "No registrada"}. Por seguridad, la cuenta pendiente fue cerrada.\n\n${supportLine}\n\nYour staff access request was not approved. For security, the pending account was closed.`,
  });

  return { sent: true, method: "email" };
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const supabase = createAdminClient();
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing admin session." }, { status: 401 });

    const { data: requesterAuth, error: requesterAuthError } = await supabase.auth.getUser(token);
    const requester = requesterAuth?.user;
    if (requesterAuthError || !requester?.id) {
      return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });
    }

    const body = await request.json().catch((): Record<string, unknown> => ({}));
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!uuidPattern.test(userId)) return NextResponse.json({ error: "Invalid userId." }, { status: 400 });
    if (userId === requester.id) {
      return NextResponse.json({ error: "You cannot deny your own signed-in account." }, { status: 403 });
    }

    const [{ data: requesterProfile }, { data: permissionSetting }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const typedRequesterProfile = requesterProfile as PendingStaffProfile | null;
    const requesterPermissionProfile = typedRequesterProfile
      ? { ...typedRequesterProfile, permissions: permissionMap[requester.id] ?? typedRequesterProfile.permissions }
      : null;
    const requesterCanDeny = isOwnerEmail(requesterEmail) || hasPermission(requesterPermissionProfile, requesterEmail, "delete_staff_accounts");
    if (!requesterCanDeny) {
      return NextResponse.json({ error: "Not allowed to deny and delete pending staff accounts." }, { status: 403 });
    }

    const { data: profileRow, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message || "Could not read pending staff profile." }, { status: 500 });
    }
    if (!profileRow) return NextResponse.json({ error: "Pending staff profile not found." }, { status: 404 });

    const targetProfile = profileRow as PendingStaffProfile;
    const targetRole = `${targetProfile.role || ""}`.toLowerCase();
    const targetAdminLevel = `${targetProfile.admin_level || ""}`.toLowerCase();
    if (targetRole !== "pending_staff") {
      return NextResponse.json({ error: "This denial route only removes pending staff accounts." }, { status: 409 });
    }
    if (targetAdminLevel === "owner") {
      return NextResponse.json({ error: "Owner account is protected and cannot be denied." }, { status: 403 });
    }

    const authUserRes = await supabase.auth.admin.getUserById(userId);
    if (authUserRes.error && !isUserNotFoundError(authUserRes.error)) {
      return NextResponse.json({ error: authUserRes.error.message || "Could not read auth user." }, { status: 500 });
    }
    const targetAuthUser = authUserRes.data?.user;
    const targetMetadata = (targetAuthUser?.user_metadata || {}) as Record<string, unknown>;
    const authEmail = `${targetAuthUser?.email || ""}`.trim().toLowerCase();
    const profileEmail = `${targetProfile.email || ""}`.trim().toLowerCase();
    const realMetadataEmail = stringValue(targetMetadata.real_email).trim().toLowerCase();
    const notificationEmail = [profileEmail, realMetadataEmail, !isAliasEmail(authEmail) ? authEmail : ""]
      .find((email) => validEmail(email) && !isAliasEmail(email)) || "";
    const targetPhone = normalizePhone(`${targetProfile.phone || stringValue(targetMetadata.phone) || targetAuthUser?.phone || ""}`);

    if ([profileEmail, realMetadataEmail, authEmail].some((email) => email && isOwnerEmail(email))) {
      return NextResponse.json({ error: "Owner account is protected and cannot be denied." }, { status: 403 });
    }

    const targetName = `${targetProfile.full_name || targetProfile.display_name || notificationEmail || targetPhone || "Pending staff"}`;
    let notification: DenialNotification =
      targetPhone && !notificationEmail
        ? { sent: false, method: "phone", reason: "sms_not_configured" }
        : { sent: false, method: notificationEmail ? "email" : "none", reason: "no_destination" };

    if (notificationEmail) {
      try {
        notification = await sendDenialEmail({
          email: notificationEmail,
          fullName: targetName,
          officeLocation: targetProfile.office_location || null,
        });
      } catch (mailError: unknown) {
        notification = { sent: false, method: "email", error: errorField(mailError, "message") || "email_send_failed" };
      }
    }

    const [{ data: blockedEmailSetting }, { data: blockedPhoneSetting }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
    ]);
    const blockedEmails = new Set(parseEmails(blockedEmailSetting?.value));
    [notificationEmail, profileEmail, realMetadataEmail, !isAliasEmail(authEmail) ? authEmail : ""]
      .filter((email) => validEmail(email) && !isAliasEmail(email))
      .forEach((email) => blockedEmails.add(email));
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    if (targetPhone) blockedPhones.add(targetPhone);

    const nextInviteCode = createInviteCode();
    const nowIso = new Date().toISOString();
    const { error: settingsError } = await supabase
      .from("app_settings")
      .upsert(
        [
          { key: "blocked_signup_emails", value: Array.from(blockedEmails).sort().join(", "), updated_at: nowIso },
          { key: "blocked_signup_phones", value: Array.from(blockedPhones).sort().join(", "), updated_at: nowIso },
          { key: "invite_code", value: nextInviteCode, updated_at: nowIso },
        ],
        { onConflict: "key" },
      );
    if (settingsError) {
      return NextResponse.json({ error: settingsError.message || "Failed to update security settings." }, { status: 500 });
    }

    if (permissionMap[userId]) {
      const nextPermissionMap = { ...permissionMap };
      delete nextPermissionMap[userId];
      const { error: permissionCleanupError } = await supabase
        .from("app_settings")
        .upsert(
          { key: STAFF_PERMISSIONS_SETTING_KEY, value: JSON.stringify(nextPermissionMap), updated_at: nowIso },
          { onConflict: "key" },
        );
      if (permissionCleanupError && !isMissingSchemaError(permissionCleanupError)) {
        return NextResponse.json({ error: permissionCleanupError.message || "Failed to clear pending permissions." }, { status: 500 });
      }
    }

    const cleanupErrors: string[] = [];
    const neutralRoleLabel = "Personal pendiente";

    const { error: clearMessageSenderError } = await supabase
      .from("messages")
      .update({ sender_id: null, sender_name: neutralRoleLabel, sender_role: "pending_staff" })
      .eq("sender_id", userId);
    if (clearMessageSenderError && !isMissingSchemaError(clearMessageSenderError)) {
      cleanupErrors.push(`messages: ${clearMessageSenderError.message || "update failed"}`);
    }

    const { error: clearRoomMembersError } = await supabase.from("room_members").delete().eq("user_id", userId);
    if (clearRoomMembersError && !isMissingSchemaError(clearRoomMembersError)) {
      cleanupErrors.push(`room_members: ${clearRoomMembersError.message || "delete failed"}`);
    }

    for (const column of ["target_staff_id", "requested_staff_id", "requested_by"]) {
      const { error: clearAccessRequestsError } = await supabase
        .from("staff_access_requests")
        .delete()
        .eq(column, userId);
      if (clearAccessRequestsError && !isMissingSchemaError(clearAccessRequestsError)) {
        cleanupErrors.push(`staff_access_requests.${column}: ${clearAccessRequestsError.message || "delete failed"}`);
      }
    }

    const { error: clearPrivateMessagesError } = await supabase
      .from("staff_private_messages")
      .delete()
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    if (clearPrivateMessagesError && !isMissingSchemaError(clearPrivateMessagesError)) {
      cleanupErrors.push(`staff_private_messages: ${clearPrivateMessagesError.message || "delete failed"}`);
    }

    const { error: clearMediaNotificationsError } = await supabase
      .from("media_notifications")
      .delete()
      .eq("staff_id", userId);
    if (clearMediaNotificationsError && !isMissingSchemaError(clearMediaNotificationsError)) {
      cleanupErrors.push(`media_notifications: ${clearMediaNotificationsError.message || "delete failed"}`);
    }

    const { error: clearPushSubscriptionsError } = await supabase
      .from("push_subscriptions")
      .delete()
      .filter("subscription->>portalUserId", "eq", userId);
    if (clearPushSubscriptionsError && !isMissingSchemaError(clearPushSubscriptionsError)) {
      cleanupErrors.push(`push_subscriptions: ${clearPushSubscriptionsError.message || "delete failed"}`);
    }

    const { error: clearRoomsCreatorError } = await supabase.from("rooms").update({ created_by: null }).eq("created_by", userId);
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
      return NextResponse.json({ error: deleteProfileError.message || "Failed to remove pending profile." }, { status: 500 });
    }

    const authDeleteRes = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteRes.error && !isUserNotFoundError(authDeleteRes.error)) {
      return NextResponse.json({ error: authDeleteRes.error.message || "Failed to remove auth user." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      removedEmail: notificationEmail || null,
      removedPhone: targetPhone || null,
      newInviteCode: nextInviteCode,
      notification,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorField(error, "message") || "Unexpected pending staff denial error." }, { status: 500 });
  }
}
