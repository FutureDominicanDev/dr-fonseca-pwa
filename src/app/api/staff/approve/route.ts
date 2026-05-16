import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { isOwnerIdentity } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";
import { getAppUrl, getSmtpConfig } from "@/lib/emailConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = getAppUrl();
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = getSmtpConfig("Dr. Fonseca | Portal Medico");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isAliasEmail = (email: string) => email.toLowerCase().endsWith("@portal-staff.local");

const escapeHtml = (value: unknown) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  return `${(error as Record<string, unknown>).message || ""}`;
};

const sendApprovedEmail = async (params: { email: string; fullName: string; officeLocation?: string | null }) => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) return { sent: false, reason: "smtp_not_configured" };

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const loginUrl = `${APP_URL}/login`;
  const trainingUrl = `${APP_URL}/training`;
  const resetUrl = `${APP_URL}/reset-password`;
  const officeText = params.officeLocation || "Ambas sedes";
  const safeAppUrl = escapeHtml(APP_URL);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeTrainingUrl = escapeHtml(trainingUrl);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeFullName = escapeHtml(params.fullName);
  const safeOfficeText = escapeHtml(officeText);

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: params.email,
    subject: "Bienvenido(a) - Acceso aprobado - Portal Medico Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MEDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:25px;color:#0f172a;">Bienvenido(a), acceso aprobado</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">Hola ${safeFullName}, tu acceso al Portal Medico de Dr. Fonseca fue aprobado.</p>
            <p style="margin:0 0 8px 0;">Sede asignada: <strong>${safeOfficeText}</strong></p>
            <p style="margin:12px 0 0 0;color:#334155;line-height:1.65;">Por seguridad, solo veras pacientes y salas asignadas, salvo que el doctor te otorgue permisos adicionales.</p>
            <h2 style="margin:18px 0 8px 0;font-size:18px;color:#0f172a;">Guia rápida</h2>
            <ul style="margin:0 0 12px 18px;padding:0;line-height:1.7;color:#334155;">
              <li>Portal: <a href="${safeLoginUrl}">${safeLoginUrl}</a></li>
              <li>Cambiar contraseña: <a href="${safeResetUrl}">${safeResetUrl}</a></li>
              <li>Leyenda de iconos: <a href="${safeTrainingUrl}">${safeTrainingUrl}</a></li>
              <li>Activa alertas desde Inbox para recibir mensajes de pacientes y del equipo cuando la app esté cerrada.</li>
            </ul>
          </div>
        </div>
      </div>
    `,
    text: `Bienvenido(a) - Acceso aprobado - Portal Medico Dr. Fonseca\n\n${params.fullName}, tu acceso fue aprobado. Sede: ${officeText}.\n\nPortal: ${loginUrl}\nCambiar contraseña: ${resetUrl}\nLeyenda de iconos: ${trainingUrl}\n\nActiva alertas desde Inbox para recibir mensajes de pacientes y del equipo cuando la app este cerrada.`,
  });

  return { sent: true };
};

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

    const body = await request.json().catch((): Record<string, unknown> => ({}));
    const userId = `${body?.userId || ""}`.trim();
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

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
    if (!requesterIsOwner && !hasPermission(requesterPermissionProfile, requesterEmail, "manage_staff")) {
      return NextResponse.json({ error: "Not allowed to approve staff accounts." }, { status: 403 });
    }

    const { data: targetProfile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (profileError) return NextResponse.json({ error: profileError.message || "Could not read staff profile." }, { status: 500 });
    if (!targetProfile) return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
    if (`${(targetProfile as any).role || ""}`.toLowerCase() !== "pending_staff") {
      return NextResponse.json({ error: "This account is not pending approval." }, { status: 409 });
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const metadata = (authUser?.user?.user_metadata || {}) as Record<string, unknown>;
    const profileEmail = `${(targetProfile as any).email || ""}`.trim().toLowerCase();
    const realEmail = `${metadata.real_email || ""}`.trim().toLowerCase();
    const authEmail = `${authUser?.user?.email || ""}`.trim().toLowerCase();
    const email = [profileEmail, realEmail, !isAliasEmail(authEmail) ? authEmail : ""].find((entry) => validEmail(entry) && !isAliasEmail(entry)) || "";
    const fullName = `${(targetProfile as any).full_name || (targetProfile as any).display_name || metadata.full_name || "Staff"}`;
    const officeLocation = (targetProfile as any).office_location || null;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: "staff", admin_level: (targetProfile as any).admin_level || "none" })
      .eq("id", userId);
    if (updateError) return NextResponse.json({ error: updateError.message || "Could not approve staff account." }, { status: 500 });

    let notification: { sent: boolean; reason?: string; error?: string } = { sent: false, reason: "no_email" };
    if (email) {
      try {
        notification = await sendApprovedEmail({ email, fullName, officeLocation });
      } catch (mailError) {
        notification = { sent: false, error: errorMessage(mailError) || "email_send_failed" };
      }
    }

    return NextResponse.json({ ok: true, userId, notification });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not approve staff account." }, { status: 500 });
  }
}
