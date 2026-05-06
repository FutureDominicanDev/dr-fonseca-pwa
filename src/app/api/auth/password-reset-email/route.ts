import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.drfonsecacirujanoplastico.com").replace(/\/+$/, "");
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Dr. Fonseca | Portal Médico";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

    const redirectTo = `${APP_URL}/reset-password?lang=${lang}`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    } as any);

    if (error) {
      console.error("password reset link failed", error.message);
      return NextResponse.json({ error: "Could not generate reset link." }, { status: 500 });
    }

    const actionLink = `${(data as any)?.properties?.action_link || ""}`.trim();
    if (!actionLink) {
      return NextResponse.json({ error: "Reset link was empty." }, { status: 500 });
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
      ? "We received a request to change your portal password. Use the secure button below to continue."
      : "Recibimos una solicitud para cambiar tu contraseña del portal. Usa el botón seguro para continuar.";
    const button = lang === "en" ? "Create new password" : "Crear nueva contraseña";
    const note = lang === "en"
      ? "If you did not request this, you can ignore this email."
      : "Si no solicitaste este cambio, puedes ignorar este correo.";

    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="background:#0b3a5b;padding:20px;text-align:center;">
              <img src="${APP_URL}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
              <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MÉDICO</div>
            </div>
            <div style="padding:22px;">
              <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">${title}</h1>
              <p style="margin:0 0 18px 0;color:#334155;line-height:1.65;">${copy}</p>
              <p style="margin:0 0 20px 0;">
                <a href="${actionLink}" style="display:inline-block;background:#0b63ce;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:800;">${button}</a>
              </p>
              <p style="margin:0;color:#64748b;line-height:1.6;">${note}</p>
            </div>
            <div style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;text-align:center;">
              Dr. Miguel Fonseca · Siluety Plastic Surgery
            </div>
          </div>
        </div>
      `,
      text: `${title}\n\n${copy}\n\n${actionLink}\n\n${note}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("password reset email error", error?.message || error);
    return NextResponse.json({ error: "Could not send reset email." }, { status: 500 });
  }
}
