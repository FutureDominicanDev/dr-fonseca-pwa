import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone, phoneAliasEmail } from "@/lib/authIdentity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isAliasEmail = (email: string) => email.toLowerCase().endsWith("@portal-staff.local");

export async function PATCH(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Staff account updates are not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
    const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
    const phone = hasPhone ? normalizePhone(`${body?.phone || ""}`) : undefined;
    const email = hasEmail ? `${body?.email || ""}`.trim().toLowerCase() : undefined;

    if (phone !== undefined && phone && phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
    }
    if (email !== undefined && email && !validEmail(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const profilePayload: Record<string, any> = {};
    if (phone !== undefined) profilePayload.phone = phone || null;
    if (email !== undefined) profilePayload.email = email || null;

    if (Object.keys(profilePayload).length > 0) {
      const { error: profileError } = await adminClient.from("profiles").update(profilePayload).eq("id", user.id);
      if (profileError) return NextResponse.json({ error: profileError.message || "Could not update staff profile." }, { status: 500 });
    }

    const currentEmail = `${user.email || ""}`.trim().toLowerCase();
    const metadata = {
      ...(user.user_metadata || {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(email !== undefined ? { real_email: email || null } : {}),
    };
    const authPayload: Record<string, any> = { user_metadata: metadata };

    if (phone !== undefined && phone && isAliasEmail(currentEmail)) {
      authPayload.email = phoneAliasEmail(phone);
      authPayload.email_confirm = true;
      authPayload.phone = phone;
      authPayload.phone_confirm = true;
      authPayload.user_metadata = { ...metadata, login_method: "phone" };
    } else if (email !== undefined && email && !isAliasEmail(currentEmail) && email !== currentEmail) {
      authPayload.email = email;
      authPayload.email_confirm = true;
      authPayload.user_metadata = { ...metadata, login_method: "email" };
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, authPayload as any);
    if (authUpdateError) return NextResponse.json({ error: authUpdateError.message || "Could not update staff auth account." }, { status: 500 });

    return NextResponse.json({
      ok: true,
      phone: phone !== undefined ? phone || null : null,
      email: email !== undefined ? email || null : null,
      loginEmail: authPayload.email || currentEmail,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected account update error." }, { status: 500 });
  }
}
