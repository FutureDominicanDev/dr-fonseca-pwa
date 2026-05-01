import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const parseList = (value: unknown) => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizePhone = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body?.type === "phone" ? "phone" : body?.type === "email" ? "email" : "";
    const rawValue = typeof body?.value === "string" ? body.value.trim() : "";
    if (!type || !rawValue) return NextResponse.json({ error: "Missing unblock type/value." }, { status: 400 });

    const key = type === "email" ? "blocked_signup_emails" : "blocked_signup_phones";
    const normalized =
      type === "email"
        ? rawValue.toLowerCase()
        : normalizePhone(rawValue);

    const { data: settingRow } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
    const values = parseList(settingRow?.value);
    const filtered = values.filter((entry) => {
      if (type === "email") return entry.toLowerCase() !== normalized;
      return normalizePhone(entry) !== normalized;
    });

    const { error: saveError } = await supabase
      .from("app_settings")
      .upsert(
        [{ key, value: filtered.join(", "), updated_at: new Date().toISOString() }],
        { onConflict: "key" },
      );
    if (saveError) return NextResponse.json({ error: saveError.message || "Failed to unblock." }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected unblock error." }, { status: 500 });
  }
}
