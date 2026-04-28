import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "mrdiazsr@icloud.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pdebkexayomjaougrlhr.supabase.co";
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

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

    const authUserRes = await supabase.auth.admin.getUserById(userId);
    const targetEmail = authUserRes.data?.user?.email?.trim().toLowerCase() || "";
    const targetPhoneFromAuth = normalizePhone(authUserRes.data?.user?.phone || "");
    if (targetEmail === OWNER_EMAIL) {
      return NextResponse.json({ error: "Owner account is protected and cannot be revoked." }, { status: 403 });
    }

    const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
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

    await supabase.from("profiles").delete().eq("id", userId);
    const authDeleteRes = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteRes.error) {
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
