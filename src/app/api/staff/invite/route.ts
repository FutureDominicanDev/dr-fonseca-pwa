import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/authIdentity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Invite validation is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const inviteCode = `${body?.inviteCode || ""}`.trim().toUpperCase();
    if (!inviteCode) return NextResponse.json({ valid: false });

    const { data: inviteRes, error: inviteError } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "invite_code")
      .maybeSingle();
    const currentInvite = `${inviteRes?.value || ""}`.trim().toUpperCase();
    if (inviteError || !currentInvite || currentInvite !== inviteCode) {
      return NextResponse.json({ valid: false });
    }

    const phone = normalizePhone(`${body?.phone || ""}`);
    const email = `${body?.email || ""}`.trim().toLowerCase();
    if (!phone && !email) return NextResponse.json({ valid: true });

    const [{ data: blockedPhoneSetting }, { data: blockedEmailSetting }] = await Promise.all([
      adminClient.from("app_settings").select("value").eq("key", "blocked_signup_phones").maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", "blocked_signup_emails").maybeSingle(),
    ]);

    const blockedPhones = new Set(parsePhones(blockedPhoneSetting?.value));
    const blockedEmails = new Set(parseEmails(blockedEmailSetting?.value));
    return NextResponse.json({
      valid: true,
      blockedPhone: Boolean(phone && blockedPhones.has(phone)),
      blockedEmail: Boolean(email && blockedEmails.has(email)),
    });
  } catch {
    return NextResponse.json({ error: "Unexpected invite validation error." }, { status: 500 });
  }
}
