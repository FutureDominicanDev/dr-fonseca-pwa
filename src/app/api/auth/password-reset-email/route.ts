import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getAppUrl, getSmtpConfig } from "@/lib/emailConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = getAppUrl();
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = getSmtpConfig("Dr. Fonseca | Portal Médico");

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

async function resolveResetIdentity(email: string) {
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, display_name")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) {
    const { data: authUserData } = await supabase.auth.admin.getUserById(profile.id);
    const authEmail = `${authUserData?.user?.email || ""}`.trim().toLowerCase();
    if (validEmail(authEmail)) {
      return {
        profileId: profile.id,
        authEmail,
        destinationEmail: normalized,
        staffName: profile.full_name || profile.display_name || "",
      };
    }
  }

  return {
    profileId: null,
    authEmail: normalized,
    destinationEmail: normalized,
    staffName: "",
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
      return NextResponse.json({ error: "Password reset email is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const email = `${body?.email || ""}`.trim().toLowerCase();
    const lang = body?.lang === "en" ? "en" : "es";
    if (!validEmail(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    const accountNotFoundMessage = lang === "en"
      ? "No active portal account was found for that recovery email."
      : "No encontré una cuenta activa del portal con ese correo de recuperación.";
    const resetLinkFailedMessage = lang === "en"
      ? "I could not create the recovery link. Please ask an administrator to verify the account email."
      : "No pude crear el enlace de recuperación. Pide al administrador verificar el correo de la cuenta.";

    const resetIdentity = await resolveResetIdentity(email);
    const redirectTo = `${APP_URL}/reset-password?lang=${lang}`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: resetIdentity.authEmail,
      options: { redirectTo },
    } as any);

    if (error) {
      console.error("password reset link failed", error.message, { destinationEmail: resetIdentity.destinationEmail, authEmail: isAliasEmail(resetIdentity.authEmail) ? "alias" : resetIdentity.authEmail });
      const notFound = /not\s+found|unable\s+to\s+find|no\s+user/i.test(error.message || "");
      return NextResponse.json({ error: notFound ? accountNotFoundMessage : resetLinkFailedMessage }, { status: notFound ? 404 : 500 });
    }

    const actionLink = `${(data as any)?.properties?.action_link || ""}`.trim();
    if (!actionLink) {
      console.error("password reset link missing action_link", { destinationEmail: resetIdentity.destinationEmail, authEmail: isAliasEmail(resetIdentity.authEmail) ? "alias" : resetIdentity.authEmail });
      return NextResponse.json({ error: resetLinkFailedMessage }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const subject = lang === "en" ? "Reset your Dr. Fonseca Portal password" : "Restablece tu contraseña del Portal Dr. Fonseca";
    const title = lang === "en" ? "Reset your password" : "Restablece tu contraseña";
    const copy = lang === "en"
      ? `We received a request to change${resetIdentity.staffName ? ` ${resetIdentity.staffName}'s` : " your"} portal password. Use the secure button below to continue.`
      : `Recibimos una solicitud para cambiar${resetIdentity.staffName ? ` la contraseña de ${resetIdentity.staffName}` : " tu contraseña"} del portal. Usa el botón seguro para continuar.`;
    const button = lang === "en" ? "Create new password" : "Crear nueva contraseña";
    const note = lang === "en"
      ? "If you did not request this, you can ignore this email."
      : "Si no solicitaste este cambio, puedes ignorar este correo.";
    const safeAppUrl = escapeHtml(APP_URL);
    const safeActionLink = escapeHtml(actionLink);
    const safeTitle = escapeHtml(title);
    const safeCopy = escapeHtml(copy);
    const safeButton = escapeHtml(button);
    const safeNote = escapeHtml(note);

    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: resetIdentity.destinationEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="background:#0b3a5b;padding:20px;text-align:center;">
              <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
              <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MÉDICO</div>
            </div>
            <div style="padding:22px;">
              <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">${safeTitle}</h1>
              <p style="margin:0 0 18px 0;color:#334155;line-height:1.65;">${safeCopy}</p>
              <p style="margin:0 0 20px 0;">
                <a href="${safeActionLink}" style="display:inline-block;background:#0b63ce;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:800;">${safeButton}</a>
              </p>
              <p style="margin:0;color:#64748b;line-height:1.6;">${safeNote}</p>
            </div>
            <div style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;text-align:center;">
              Dr. Miguel Fonseca · Siluety Plastic Surgery
            </div>
          </div>
        </div>
      `,
      text: `${title}\n\n${copy}\n\n${actionLink}\n\n${note}`,
    });

    await supabase.from("admin_audit_events").insert({
      action: "password_reset_email_sent",
      entity_type: "staff_profile",
      entity_id: resetIdentity.profileId,
      entity_name: resetIdentity.staffName || null,
      actor_id: null,
      actor_name: "Password reset request",
      actor_email: resetIdentity.destinationEmail,
      notes: `Password reset email sent to ${resetIdentity.destinationEmail}.`,
      metadata: { destination_email: resetIdentity.destinationEmail, auth_email_is_alias: isAliasEmail(resetIdentity.authEmail) },
    }).then(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("password reset email error", error?.message || error);
    return NextResponse.json({ error: "Could not send reset email." }, { status: 500 });
  }
}
