import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRIMARY_OWNER_EMAIL, isOwnerIdentity } from "@/lib/securityConfig";
import { normalizePhone } from "@/lib/authIdentity";
import nodemailer from "nodemailer";
import { getAppUrl, getSmtpConfig } from "@/lib/emailConfig";
import {
  STAFF_INVITE_CODES_SETTING_KEY,
  findActiveStaffInviteCode,
  markStaffInviteCodeUsed,
  parseStaffInviteCodes,
  serializeStaffInviteCodes,
} from "@/lib/staffInviteCodes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");
const APP_URL = getAppUrl();
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = getSmtpConfig("Dr. Fonseca | Portal Médico");

type SignupContext = {
  device: string;
  location: string;
  city: string;
  region: string;
  country: string;
  capturedAt: string;
};

const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
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

const roleLabelEs = (role: string) => {
  if (role === "doctor") return "Doctor";
  if (role === "pending_staff") return "Pendiente de aprobación";
  if (role === "enfermeria") return "Enfermería";
  if (role === "post_quirofano") return "Post quirófano";
  if (role === "coordinacion") return "Coordinación";
  return "Personal";
};

const decodeHeaderValue = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
};

const escapeHtml = (value: unknown) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const countryName = (countryCode: string) => {
  const normalized = countryCode.trim().toUpperCase();
  const names: Record<string, string> = {
    MX: "Mexico",
    US: "USA",
    JP: "Japan",
    CA: "Canada",
    DO: "Dominican Republic",
  };
  return names[normalized] || normalized;
};

const detectDevice = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (!ua) return "";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return ua.includes("mobile") ? "Android phone" : "Android tablet";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "Mac computer";
  if (ua.includes("windows")) return "Windows computer";
  if (ua.includes("linux")) return "Linux computer";
  return "Computer or tablet";
};

const getSignupContext = (request: NextRequest): SignupContext => {
  const city = decodeHeaderValue(request.headers.get("x-vercel-ip-city") || "").trim();
  const region = decodeHeaderValue(request.headers.get("x-vercel-ip-country-region") || "").trim();
  const country = countryName(request.headers.get("x-vercel-ip-country") || "");
  return {
    device: detectDevice(request.headers.get("user-agent") || ""),
    location: [city, region, country].filter(Boolean).join(", "),
    city,
    region,
    country,
    capturedAt: new Date().toISOString(),
  };
};

const sendPendingApprovalEmail = async (params: { fullName: string; email?: string | null; phone?: string | null; officeLocation: string | null; signupContext?: SignupContext }) => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) return { sent: false, reason: "smtp_not_configured" };

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const adminUrl = `${APP_URL}/admin`;
  const contactText = [params.email, params.phone].filter(Boolean).join(" · ") || "Sin correo/teléfono";
  const officeText = params.officeLocation || "Sin sede";
  const signupDeviceText = params.signupContext?.device || "No registrado";
  const signupLocationText = params.signupContext?.location || "No registrada";
  const safeAppUrl = escapeHtml(APP_URL);
  const safeAdminUrl = escapeHtml(adminUrl);
  const safeFullName = escapeHtml(params.fullName);
  const safeContactText = escapeHtml(contactText);
  const safeOfficeText = escapeHtml(officeText);
  const signupContextHtml = params.signupContext?.device || params.signupContext?.location
    ? `
            <p style="margin:0 0 8px 0;">Dispositivo detectado: <strong>${escapeHtml(signupDeviceText)}</strong></p>
            <p style="margin:0 0 18px 0;">Ubicación aproximada: <strong>${escapeHtml(signupLocationText)}</strong></p>
      `
    : "";
  const signupContextText = params.signupContext?.device || params.signupContext?.location
    ? `\nDispositivo: ${signupDeviceText}\nUbicación aproximada: ${signupLocationText}`
    : "";

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: PRIMARY_OWNER_EMAIL,
    subject: "Nuevo registro pendiente - Portal Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MÉDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:25px;color:#0f172a;">Registro pendiente de aprobación</h1>
            <p style="margin:0 0 10px 0;color:#334155;line-height:1.65;"><strong>${safeFullName}</strong> creó una cuenta de personal y está esperando aprobación.</p>
            <p style="margin:0 0 8px 0;">Contacto: <strong>${safeContactText}</strong></p>
            <p style="margin:0 0 18px 0;">Sede elegida: <strong>${safeOfficeText}</strong></p>
            ${signupContextHtml}
            <p style="margin:0 0 18px 0;color:#334155;line-height:1.65;">La cuenta no puede ver pacientes hasta que se apruebe desde Equipo o Solicitudes.</p>
            <p style="margin:0;">
              <a href="${safeAdminUrl}" style="display:inline-block;background:#0b63ce;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:800;">Abrir centro de control</a>
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Registro pendiente de aprobación\n\n${params.fullName}\n${contactText}\nSede: ${officeText}${signupContextText}\n\nAbrir centro de control: ${adminUrl}`,
  });

  return { sent: true };
};

const sendWelcomeEmail = async (params: { fullName: string; email: string; role: string; officeLocation: string | null }) => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) return { sent: false, reason: "smtp_not_configured" };

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const loginUrl = `${APP_URL}/login`;
  const resetUrl = `${APP_URL}/reset-password`;
  const trainingUrl = `${APP_URL}/training`;
  const roleText = roleLabelEs(params.role);
  const safeAppUrl = escapeHtml(APP_URL);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeTrainingUrl = escapeHtml(trainingUrl);
  const safeFullName = escapeHtml(params.fullName);
  const safeEmail = escapeHtml(params.email);
  const safeRoleText = escapeHtml(roleText);
  const safeOfficeLocation = escapeHtml(params.officeLocation || "");
  const officeText = params.officeLocation ? `<p style="margin:0 0 8px 0;">Sede asignada: <strong>${safeOfficeLocation}</strong></p>` : "";
  const officePlain = params.officeLocation ? `\nSede asignada: ${params.officeLocation}` : "";

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: params.email,
    subject: "Bienvenido(a) al Portal Médico de Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MÉDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">¡Bienvenido(a), ${safeFullName}!</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">Tu registro quedó completado y ya formas parte del equipo de Dr. Fonseca.</p>
            <p style="margin:0 0 8px 0;">Perfil: <strong>${safeRoleText}</strong></p>
            ${officeText}
            <p style="margin:10px 0 0 0;">Usuario de acceso: <strong>${safeEmail}</strong></p>
            <h2 style="margin:18px 0 8px 0;font-size:18px;color:#0f172a;">Guía rápida</h2>
            <ul style="margin:0 0 12px 18px;padding:0;line-height:1.7;color:#334155;">
              <li>Ingresa al sistema desde: <a href="${safeLoginUrl}">${safeLoginUrl}</a></li>
              <li>Si necesitas cambiar contraseña: <a href="${safeResetUrl}">${safeResetUrl}</a></li>
              <li>Leyenda de iconos del portal: <a href="${safeTrainingUrl}">${safeTrainingUrl}</a></li>
              <li>Dentro de Inbox podrás responder pacientes, usar respuestas rápidas con <strong>/</strong> y enviar multimedia.</li>
              <li>Activa las alertas del dispositivo desde Inbox para recibir mensajes urgentes.</li>
            </ul>
            <p style="margin:12px 0 0 0;color:#475569;line-height:1.6;">Este correo es informativo de bienvenida.</p>
          </div>
          <div style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;text-align:center;">
            Dr. Miguel Fonseca · Siluety Plastic Surgery
          </div>
        </div>
      </div>
    `,
    text: `Bienvenido(a) al Portal Medico de Dr. Fonseca\n\nHola ${params.fullName}, tu registro quedo completado.\nPerfil: ${roleText}${officePlain}\nUsuario de acceso: ${params.email}\n\nPortal: ${loginUrl}\nCambiar contraseña: ${resetUrl}\nLeyenda de iconos: ${trainingUrl}\n\nActiva las alertas del dispositivo desde Inbox para recibir mensajes urgentes.`,
  });

  return { sent: true };
};

const sendStaffPendingEmail = async (params: { fullName: string; email: string; officeLocation: string | null }) => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) return { sent: false, reason: "smtp_not_configured" };

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
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
    subject: "Registro recibido - Portal Medico Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${safeAppUrl}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MEDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:25px;color:#0f172a;">Registro recibido</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">Hola ${safeFullName}, recibimos tu registro para el Portal Medico de Dr. Fonseca.</p>
            <p style="margin:0 0 8px 0;">Sede indicada: <strong>${safeOfficeText}</strong></p>
            <p style="margin:12px 0 0 0;color:#334155;line-height:1.65;">Por seguridad, tu cuenta queda en espera hasta que el doctor o un administrador autorizado la apruebe. Mientras tanto no tienes acceso a expedientes de pacientes.</p>
            <h2 style="margin:18px 0 8px 0;font-size:18px;color:#0f172a;">Mientras esperas aprobación</h2>
            <ul style="margin:0 0 12px 18px;padding:0;line-height:1.7;color:#334155;">
              <li>Cuando el acceso sea aprobado, recibirás otro correo de bienvenida.</li>
              <li>Portal: <a href="${safeLoginUrl}">${safeLoginUrl}</a></li>
              <li>Cambio de contraseña: <a href="${safeResetUrl}">${safeResetUrl}</a></li>
              <li>Leyenda de iconos: <a href="${safeTrainingUrl}">${safeTrainingUrl}</a></li>
              <li>Después de entrar, activa alertas en Inbox para recibir mensajes críticos del equipo y pacientes.</li>
            </ul>
            <p style="margin:12px 0 0;color:#64748b;line-height:1.6;">No compartas tus credenciales. Si no solicitaste este acceso, avisa al doctor o administrador.</p>
          </div>
        </div>
      </div>
    `,
    text: `Registro recibido - Portal Medico Dr. Fonseca\n\n${params.fullName}, recibimos tu registro. Sede indicada: ${officeText}. Por seguridad, tu cuenta queda en espera hasta que sea aprobada.\n\nPortal: ${loginUrl}\nCambio de contraseña: ${resetUrl}\nLeyenda de iconos: ${trainingUrl}\n\nDespues de entrar, activa alertas en Inbox para recibir mensajes criticos del equipo y pacientes.`,
  });

  return { sent: true };
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const inviteCode = `${body?.inviteCode || ""}`.trim().toUpperCase();
    const userId = `${body?.userId || ""}`.trim();
    const fullName = `${body?.fullName || ""}`.trim();
    const role = `${body?.role || "staff"}`.trim();
    const officeLocation = body?.officeLocation === null ? null : `${body?.officeLocation || ""}`.trim() || null;
    const phone = normalizePhone(`${body?.phone || ""}`);
    const email = `${body?.email || ""}`.trim().toLowerCase() || null;
    const loginMethod = email ? "email" : phone ? "phone" : "unknown";
    const signupContext = getSignupContext(request);

    if (!inviteCode || !userId || !fullName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "Missing staff session." }, { status: 401 });
    }

    const requesterRes = await supabase.auth.getUser(accessToken);
    const requester = requesterRes.data?.user;
    if (requesterRes.error || !requester) {
      return NextResponse.json({ error: "Invalid staff session." }, { status: 401 });
    }
    if (requester.id !== userId) {
      return NextResponse.json({ error: "Staff profile does not match the signed-in user." }, { status: 403 });
    }

    const [{ data: inviteData, error: inviteError }, { data: oneTimeInviteData, error: oneTimeInviteError }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", STAFF_INVITE_CODES_SETTING_KEY).maybeSingle(),
    ]);
    const currentInvite = `${inviteData?.value || ""}`.trim().toUpperCase();
    const inviteCodeRecords = parseStaffInviteCodes(oneTimeInviteData?.value);
    const oneTimeInvite = findActiveStaffInviteCode(inviteCodeRecords, inviteCode);
    const legacyInviteValid = Boolean(currentInvite && currentInvite === inviteCode);
    if (inviteError || oneTimeInviteError || (!oneTimeInvite && !legacyInviteValid)) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
    }

    const [{ data: blockedPhoneSetting }, { data: blockedEmailSetting }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
    ]);
    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    const blockedEmails = new Set(parseEmails(blockedEmailSetting?.value));
    if (phone && blockedPhones.has(phone)) {
      return NextResponse.json({ error: "This phone number cannot register for staff access." }, { status: 403 });
    }
    if (email && blockedEmails.has(email)) {
      return NextResponse.json({ error: "This email cannot register for staff access." }, { status: 403 });
    }

    const { data: existingProfile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const ownerLookupEmail = email || requesterEmail;
    const ownerIdentity = isOwnerIdentity({
      id: userId,
      email: ownerLookupEmail,
      phone: phone || requester.phone || (requester.user_metadata as any)?.phone,
      fullName: (existingProfile as any)?.full_name || fullName,
      displayName: (existingProfile as any)?.display_name || fullName,
      adminLevel: (existingProfile as any)?.admin_level,
    });
    const adminLevel = ownerIdentity ? "owner" : "none";
    const profileRole = adminLevel === "owner" ? "doctor" : "pending_staff";
    const candidates = [
      {
        id: userId,
        full_name: fullName,
        display_name: fullName,
        role: profileRole,
        office_location: officeLocation,
        phone: phone || null,
        email,
        admin_level: adminLevel,
      },
      {
        id: userId,
        full_name: fullName,
        role: profileRole,
        office_location: officeLocation,
        phone: phone || null,
        email,
        admin_level: adminLevel,
      },
      {
        id: userId,
        full_name: fullName,
        role: profileRole,
        office_location: officeLocation,
        phone: phone || null,
        email,
      },
      {
        id: userId,
        full_name: fullName,
        role: profileRole,
        office_location: officeLocation,
      },
      {
        id: userId,
        full_name: fullName,
      },
    ];

    let saveError: any = null;
    for (const payload of candidates) {
      const { error } = await supabase.from("profiles").upsert(payload);
      if (!error) {
        saveError = null;
        break;
      }
      saveError = error;
      if (!isMissingColumnError(error)) break;
    }
    if (saveError) {
      return NextResponse.json({ error: saveError.message || "Profile bootstrap failed." }, { status: 500 });
    }

    if (phone) {
      await supabase.auth.admin.updateUserById(userId, {
        phone,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: profileRole,
          office_location: officeLocation,
          phone,
          login_method: loginMethod,
          real_email: email,
          signup_device: signupContext.device || null,
          signup_location: signupContext.location || null,
          signup_city: signupContext.city || null,
          signup_region: signupContext.region || null,
          signup_country: signupContext.country || null,
          signup_captured_at: signupContext.capturedAt,
        },
      } as any);
    } else if (email) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: fullName,
          role: profileRole,
          office_location: officeLocation,
          phone: null,
          login_method: "email",
          real_email: email,
          signup_device: signupContext.device || null,
          signup_location: signupContext.location || null,
          signup_city: signupContext.city || null,
          signup_region: signupContext.region || null,
          signup_country: signupContext.country || null,
          signup_captured_at: signupContext.capturedAt,
        },
      } as any);
    }

    if (oneTimeInvite) {
      const usedInvite = markStaffInviteCodeUsed(inviteCodeRecords, inviteCode, userId);
      if (usedInvite.matched) {
        await supabase
          .from("app_settings")
          .upsert(
            { key: STAFF_INVITE_CODES_SETTING_KEY, value: serializeStaffInviteCodes(usedInvite.records), updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
      }
    }

    let welcomeEmail: { sent: boolean; reason?: string; error?: string } = { sent: false };
    let pendingApprovalEmail: { sent: boolean; reason?: string; error?: string } = { sent: false };
    let pendingUserEmail: { sent: boolean; reason?: string; error?: string } = { sent: false };
    if (adminLevel === "owner" && email) {
      try {
        welcomeEmail = await sendWelcomeEmail({ fullName, email, role: profileRole, officeLocation });
      } catch (mailError: any) {
        welcomeEmail = { sent: false, error: mailError?.message || "email_send_failed" };
      }
    } else {
      try {
        pendingApprovalEmail = await sendPendingApprovalEmail({ fullName, email, phone, officeLocation, signupContext });
      } catch (mailError: any) {
        pendingApprovalEmail = { sent: false, error: mailError?.message || "approval_email_failed" };
      }
      if (email) {
        try {
          pendingUserEmail = await sendStaffPendingEmail({ fullName, email, officeLocation });
        } catch (mailError: any) {
          pendingUserEmail = { sent: false, error: mailError?.message || "pending_user_email_failed" };
        }
      } else {
        pendingUserEmail = { sent: false, reason: "no_email" };
      }
      welcomeEmail = { sent: false, reason: "pending_approval" };
    }

    return NextResponse.json({ ok: true, role: profileRole, welcomeEmail, pendingApprovalEmail, pendingUserEmail });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected bootstrap error." }, { status: 500 });
  }
}
