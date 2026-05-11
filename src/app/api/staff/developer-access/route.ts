import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { isOwnerEmail, isOwnerIdentity } from "@/lib/securityConfig";
import { STAFF_PERMISSION_KEYS, STAFF_PERMISSIONS_SETTING_KEY, parseStaffPermissionMap } from "@/lib/permissions";

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

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const adminClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const escapeHtml = (value: unknown) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseEmails = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const isUserNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const message = `${(error as any).message || ""}`.toLowerCase();
  const code = `${(error as any).code || ""}`.toLowerCase();
  return message.includes("user not found") || code === "user_not_found";
};

const isMissingColumnError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const message = `${(error as any).message || ""} ${(error as any).details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
};

const findUserByEmail = async (supabase: ReturnType<typeof adminClient>, email: string) => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find((user) => `${user.email || ""}`.trim().toLowerCase() === email) || null;
};

const createDeveloperLink = async (supabase: ReturnType<typeof adminClient>, email: string, fullName: string) => {
  const redirectTo = `${APP_URL}/login?developer=1`;
  const existingUser = await findUserByEmail(supabase, email);
  if (existingUser?.id) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    } as any);
    if (error) throw error;
    return { user: existingUser, actionLink: `${(data as any)?.properties?.action_link || ""}`.trim(), created: false };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: {
        full_name: fullName,
        role: "developer",
        portal_access: "developer",
      },
    },
  } as any);
  if (error && !isUserNotFoundError(error)) throw error;
  const user = (data as any)?.user || (await findUserByEmail(supabase, email));
  return { user, actionLink: `${(data as any)?.properties?.action_link || ""}`.trim(), created: true };
};

const upsertDeveloperProfile = async (supabase: ReturnType<typeof adminClient>, params: { userId: string; email: string; fullName: string }) => {
  const candidates = [
    {
      id: params.userId,
      full_name: params.fullName,
      display_name: params.fullName,
      role: "developer",
      admin_level: "super_admin",
      email: params.email,
      phone: null,
      office_location: null,
    },
    {
      id: params.userId,
      full_name: params.fullName,
      role: "developer",
      admin_level: "super_admin",
      email: params.email,
      phone: null,
      office_location: null,
    },
    {
      id: params.userId,
      full_name: params.fullName,
      role: "developer",
      admin_level: "super_admin",
      email: params.email,
    },
  ];

  let saveError: unknown = null;
  for (const payload of candidates) {
    const { error } = await supabase.from("profiles").upsert(payload);
    if (!error) return;
    saveError = error;
    if (!isMissingColumnError(error)) break;
  }
  throw saveError || new Error("Could not save developer profile.");
};

const sendDeveloperEmail = async (params: { email: string; fullName: string; actionLink: string; lang: "es" | "en" }) => {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const title = params.lang === "en" ? "Developer access restored" : "Acceso de desarrollador restaurado";
  const copy = params.lang === "en"
    ? "Dr. Fonseca enabled temporary developer access for the medical portal. Use the secure button below to sign in."
    : "Dr. Fonseca habilito acceso temporal de desarrollador para el portal medico. Usa el boton seguro para entrar.";
  const button = params.lang === "en" ? "Open developer access" : "Abrir acceso de desarrollador";
  const safeName = escapeHtml(params.fullName || "Developer");

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: params.email,
    subject: params.lang === "en" ? "Developer access - Dr. Fonseca Portal" : "Acceso desarrollador - Portal Dr. Fonseca",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f6fb;padding:20px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#0b3a5b;padding:20px;text-align:center;">
            <img src="${APP_URL}/fonseca_white.png" alt="Dr. Miguel Fonseca" style="max-width:240px;width:100%;height:auto;display:block;margin:0 auto 8px;" />
            <div style="color:#dbeafe;letter-spacing:.08em;font-size:13px;font-weight:700;">PORTAL MEDICO</div>
          </div>
          <div style="padding:22px;">
            <h1 style="margin:0 0 12px 0;font-size:27px;color:#0f172a;">${title}</h1>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.65;">${safeName}, ${copy}</p>
            <p style="margin:0 0 20px 0;">
              <a href="${params.actionLink}" style="display:inline-block;background:#0b63ce;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:800;">${button}</a>
            </p>
            <p style="margin:0;color:#64748b;line-height:1.6;">This access is owner-approved and can be removed from Team without blocking future developer support.</p>
          </div>
        </div>
      </div>
    `,
    text: `${title}\n\n${params.fullName}, ${copy}\n\n${params.actionLink}\n\nThis access can be removed without blocking future developer support.`,
  });
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
      return NextResponse.json({ error: "Developer access email is not configured." }, { status: 503 });
    }

    const supabase = adminClient();
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing owner session." }, { status: 401 });

    const { data: requesterAuth, error: requesterAuthError } = await supabase.auth.getUser(token);
    const requester = requesterAuth?.user;
    const requesterEmail = `${requester?.email || ""}`.trim().toLowerCase();
    const { data: requesterProfile } = requester?.id
      ? await supabase.from("profiles").select("*").eq("id", requester.id).maybeSingle()
      : { data: null as any };
    const requesterMetadata = (requester?.user_metadata || {}) as Record<string, unknown>;
    const requesterIsOwner = isOwnerIdentity({
      id: requester?.id,
      email: requesterEmail,
      phone: `${(requesterProfile as any)?.phone || requester?.phone || requesterMetadata.phone || ""}`,
      fullName: (requesterProfile as any)?.full_name || `${requesterMetadata.full_name || ""}`,
      displayName: (requesterProfile as any)?.display_name || "",
      adminLevel: `${(requesterProfile as any)?.admin_level || ""}`,
    });
    if (requesterAuthError || !requester?.id || !requesterIsOwner) {
      return NextResponse.json({ error: "Only Dr. Fonseca's owner account can create developer access." }, { status: 403 });
    }

    const body = await request.json().catch((): Record<string, unknown> => ({}));
    const email = `${body?.email || ""}`.trim().toLowerCase();
    const fullName = `${body?.fullName || "Developer"}`.trim() || "Developer";
    const lang = body?.lang === "en" ? "en" : "es";
    if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid developer email." }, { status: 400 });
    if (isOwnerEmail(email)) return NextResponse.json({ error: "Owner accounts do not use developer access." }, { status: 400 });

    const { user, actionLink, created } = await createDeveloperLink(supabase, email, fullName);
    if (!user?.id || !actionLink) return NextResponse.json({ error: "Could not create developer login link." }, { status: 500 });

    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...((user as any).user_metadata || {}),
        full_name: fullName,
        role: "developer",
        portal_access: "developer",
      },
    } as any);
    await upsertDeveloperProfile(supabase, { userId: user.id, email, fullName });

    const { data: permissionsRes } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", STAFF_PERMISSIONS_SETTING_KEY)
      .maybeSingle();
    const permissionMap = parseStaffPermissionMap(permissionsRes?.value);
    const nextPermissionMap = { ...permissionMap, [user.id]: [...STAFF_PERMISSION_KEYS] };
    await supabase
      .from("app_settings")
      .upsert(
        { key: STAFF_PERMISSIONS_SETTING_KEY, value: JSON.stringify(nextPermissionMap), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );

    const { data: blockedEmailSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "blocked_signup_emails")
      .maybeSingle();
    const nextBlockedEmails = parseEmails(blockedEmailSetting?.value).filter((entry) => entry !== email);
    await supabase
      .from("app_settings")
      .upsert(
        { key: "blocked_signup_emails", value: nextBlockedEmails.join(", "), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );

    await sendDeveloperEmail({ email, fullName, actionLink, lang });

    await supabase.from("admin_audit_events").insert({
      action: "developer_access_created",
      entity_type: "staff_profile",
      entity_id: user.id,
      entity_name: fullName,
      actor_id: requester.id,
      actor_name: requester.user_metadata?.full_name || requesterEmail,
      actor_email: requesterEmail,
      notes: `Developer access link sent to ${email}.`,
      metadata: { developer_email: email, created },
    });

    return NextResponse.json({ ok: true, userId: user.id, email, created });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not create developer access." }, { status: 500 });
  }
}
