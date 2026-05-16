import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { isOwnerEmail } from "@/lib/securityConfig";
import { STAFF_PERMISSIONS_SETTING_KEY, hasPermission, parseStaffPermissionMap } from "@/lib/permissions";
import { getAppUrl, getSmtpConfig } from "@/lib/emailConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = getAppUrl();
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = getSmtpConfig("Dr. Fonseca | Portal Medico");

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isAliasEmail = (email: string) => email.toLowerCase().endsWith("@portal-staff.local");
const escapeHtml = (value: unknown) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
      return NextResponse.json({ error: "Staff password reset is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: requesterAuth, error: requesterAuthError } = await authClient.auth.getUser(token);
    const requester = requesterAuth?.user;
    if (requesterAuthError || !requester?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const targetUserId = `${body?.targetUserId || requester.id}`.trim();
    const lang = body?.lang === "en" ? "en" : "es";
    if (!targetUserId) return NextResponse.json({ error: "Missing staff user." }, { status: 400 });

    const [{ data: requesterProfile }, permissionsRes] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionsRes.data?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const requesterPermissionProfile = requesterProfile ? { ...(requesterProfile as any), permissions: permissionMap[requester.id] ?? (requesterProfile as any).permissions } : null;
    const canSendForOthers = isOwnerEmail(requesterEmail) || hasPermission(requesterPermissionProfile, requesterEmail, "manage_staff");
    if (targetUserId !== requester.id && !canSendForOthers) {
      return NextResponse.json({ error: "Not allowed to send reset links for this staff member." }, { status: 403 });
    }

    const [{ data: targetProfile }, targetAuthRes] = await Promise.all([
      adminClient.from("profiles").select("id, full_name, display_name, email").eq("id", targetUserId).maybeSingle(),
      adminClient.auth.admin.getUserById(targetUserId),
    ]);
    const targetAuthUser = targetAuthRes.data?.user;
    if (targetAuthRes.error || !targetAuthUser?.id) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    }

    const authEmail = `${targetAuthUser.email || ""}`.trim().toLowerCase();
    const destinationEmail = `${(targetProfile as any)?.email || (!isAliasEmail(authEmail) ? authEmail : "")}`.trim().toLowerCase();
    if (!validEmail(authEmail) || !validEmail(destinationEmail)) {
      return NextResponse.json({ error: "This staff member needs a recovery email saved before an email reset link can be sent." }, { status: 400 });
    }

    const redirectTo = `${APP_URL}/reset-password?lang=${lang}`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: authEmail,
      options: { redirectTo },
    } as any);
    if (linkError) return NextResponse.json({ error: "Could not generate reset link." }, { status: 500 });

    const actionLink = `${(linkData as any)?.properties?.action_link || ""}`.trim();
    if (!actionLink) return NextResponse.json({ error: "Reset link was empty." }, { status: 500 });

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const staffName = `${(targetProfile as any)?.full_name || (targetProfile as any)?.display_name || (lang === "en" ? "team member" : "integrante del equipo")}`;
    const subject = lang === "en" ? "Reset your Dr. Fonseca Portal password" : "Restablece tu contraseña del Portal Dr. Fonseca";
    const title = lang === "en" ? "Reset your password" : "Restablece tu contraseña";
    const copy = lang === "en"
      ? `A password reset was requested for ${staffName}. Use the secure button below to continue.`
      : `Se solicitó restablecer la contraseña de ${staffName}. Usa el botón seguro para continuar.`;
    const button = lang === "en" ? "Create new password" : "Crear nueva contraseña";
    const note = lang === "en"
      ? "If you did not request this, contact the doctor or administrator."
      : "Si no solicitaste este cambio, contacta al doctor o administrador.";
    const safeAppUrl = escapeHtml(APP_URL);
    const safeActionLink = escapeHtml(actionLink);
    const safeTitle = escapeHtml(title);
    const safeCopy = escapeHtml(copy);
    const safeButton = escapeHtml(button);
    const safeNote = escapeHtml(note);

    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: destinationEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="background:#0b3a5b;padding:20px;text-align:center;">
              <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
              <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MEDICO</div>
            </div>
            <div style="padding:22px;">
              <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">${safeTitle}</h1>
              <p style="margin:0 0 18px 0;color:#334155;line-height:1.65;">${safeCopy}</p>
              <p style="margin:0 0 20px 0;">
                <a href="${safeActionLink}" style="display:inline-block;background:#0b63ce;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:800;">${safeButton}</a>
              </p>
              <p style="margin:0;color:#64748b;line-height:1.6;">${safeNote}</p>
            </div>
          </div>
        </div>
      `,
      text: `${title}\n\n${copy}\n\n${actionLink}\n\n${note}`,
    });

    try {
      await adminClient.from("admin_audit_events").insert({
        action: targetUserId === requester.id ? "staff_password_reset_self_sent" : "staff_password_reset_sent",
        entity_type: "staff_profile",
        entity_id: targetUserId,
        entity_name: staffName,
        actor_id: requester.id,
        actor_name: (requesterProfile as any)?.full_name || (requesterProfile as any)?.display_name || requesterEmail,
        actor_email: requesterEmail,
        notes: `Password reset link sent to ${destinationEmail}.`,
        metadata: { destination_email: destinationEmail, auth_email: authEmail },
      });
    } catch {
      // Best-effort audit trail; the reset link should still be delivered.
    }

    return NextResponse.json({ ok: true, destinationEmail });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not send staff password reset." }, { status: 500 });
  }
}
