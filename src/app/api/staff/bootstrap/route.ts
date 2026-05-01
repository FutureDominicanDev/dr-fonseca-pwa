import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/securityConfig";
import { normalizePhone } from "@/lib/authIdentity";
import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.drfonsecacirujanoplastico.com").replace(/\/+$/, "");
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Dr. Fonseca | Portal Médico";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
};

const roleLabelEs = (role: string) => {
  if (role === "doctor") return "Doctor";
  if (role === "enfermeria") return "Enfermería";
  if (role === "post_quirofano") return "Post quirófano";
  if (role === "coordinacion") return "Coordinación";
  return "Personal";
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
  const roleText = roleLabelEs(params.role);
  const officeText = params.officeLocation ? `<p style="margin:0 0 8px 0;">Sede asignada: <strong>${params.officeLocation}</strong></p>` : "";

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: params.email,
    subject: "Bienvenido(a) al Portal Médico de Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${APP_URL}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MÉDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">¡Bienvenido(a), ${params.fullName}!</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">Tu registro quedó completado y ya formas parte del equipo de Dr. Fonseca.</p>
            <p style="margin:0 0 8px 0;">Perfil: <strong>${roleText}</strong></p>
            ${officeText}
            <p style="margin:10px 0 0 0;">Usuario de acceso: <strong>${params.email}</strong></p>
            <h2 style="margin:18px 0 8px 0;font-size:18px;color:#0f172a;">Guía rápida</h2>
            <ul style="margin:0 0 12px 18px;padding:0;line-height:1.7;color:#334155;">
              <li>Ingresa al sistema desde: <a href="${loginUrl}">${loginUrl}</a></li>
              <li>Si necesitas cambiar contraseña: <a href="${resetUrl}">${resetUrl}</a></li>
              <li>Dentro de Inbox podrás responder pacientes, usar respuestas rápidas con <strong>/</strong> y enviar multimedia.</li>
            </ul>
            <p style="margin:12px 0 0 0;color:#475569;line-height:1.6;">Este correo es informativo de bienvenida.</p>
          </div>
          <div style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;text-align:center;">
            Dr. Miguel Fonseca · Siluety Plastic Surgery
          </div>
        </div>
      </div>
    `,
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

    if (!inviteCode || !userId || !fullName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const inviteRes = await supabase.from("app_settings").select("value").eq("key", "invite_code").single();
    const currentInvite = `${inviteRes.data?.value || ""}`.trim().toUpperCase();
    if (inviteRes.error || !currentInvite || currentInvite !== inviteCode) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
    }

    const adminLevel = isOwnerEmail(email) ? "owner" : "none";
    const candidates = [
      {
        id: userId,
        full_name: fullName,
        display_name: fullName,
        role,
        office_location: officeLocation,
        phone: phone || null,
        admin_level: adminLevel,
      },
      {
        id: userId,
        full_name: fullName,
        role,
        office_location: officeLocation,
        phone: phone || null,
        admin_level: adminLevel,
      },
      {
        id: userId,
        full_name: fullName,
        role,
        office_location: officeLocation,
        phone: phone || null,
      },
      {
        id: userId,
        full_name: fullName,
        role,
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

    let welcomeEmail: { sent: boolean; reason?: string; error?: string } = { sent: false };
    if (email) {
      try {
        welcomeEmail = await sendWelcomeEmail({ fullName, email, role, officeLocation });
      } catch (mailError: any) {
        welcomeEmail = { sent: false, error: mailError?.message || "email_send_failed" };
      }
    } else {
      welcomeEmail = { sent: false, reason: "missing_email" };
    }

    return NextResponse.json({ ok: true, welcomeEmail });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected bootstrap error." }, { status: 500 });
  }
}
