import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/securityConfig";
import { normalizePhone } from "@/lib/authIdentity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pdebkexayomjaougrlhr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const isMissingColumnError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected bootstrap error." }, { status: 500 });
  }
}
