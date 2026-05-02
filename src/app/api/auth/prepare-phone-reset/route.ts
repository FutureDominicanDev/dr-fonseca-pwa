import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone, phoneAliasEmail } from "@/lib/authIdentity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const findAuthUserByPhone = async (phone: string) => {
  const aliasEmail = phoneAliasEmail(phone).toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const match = users.find((user) => {
      const authPhone = normalizePhone(user.phone || "");
      const metadataPhone = normalizePhone(`${user.user_metadata?.phone || ""}`);
      return (
        user.email?.toLowerCase() === aliasEmail ||
        authPhone === phone ||
        metadataPhone === phone
      );
    });
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Phone reset is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(`${body?.phone || ""}`);
    if (phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();

    let userId = profile?.id || "";
    const authUser = await findAuthUserByPhone(phone);
    if (!userId && authUser?.id) userId = authUser.id;

    if (!userId) {
      return NextResponse.json({ error: "Phone not found." }, { status: 404 });
    }

    const userMetadata = {
      ...(authUser?.user_metadata || {}),
      phone,
      login_method: "phone",
    };

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      phone,
      phone_confirm: true,
      user_metadata: userMetadata,
    } as any);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Could not prepare phone reset." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected phone reset error." }, { status: 500 });
  }
}
