import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  STAFF_AVATAR_VISIBILITY_SETTING_KEY,
  parseStaffAvatarVisibilityMap,
  staffAvatarVisibleToStaff,
} from "@/lib/staffAvatarVisibility";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key");
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Staff directory is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const userId = authData?.user?.id || "";
    if (authError || !userId) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const { data: viewerProfile, error: viewerError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (viewerError || !viewerProfile?.id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }
    if (`${viewerProfile.role || ""}`.toLowerCase() === "pending_staff") {
      return NextResponse.json({ error: "Staff approval is required before loading the directory." }, { status: 403 });
    }

    const [{ data, error }, { data: avatarVisibilitySetting }] = await Promise.all([
      adminClient
      .from("profiles")
      .select("id, full_name, display_name, role, office_location, avatar_url, phone")
      .neq("role", "pending_staff")
      .order("full_name", { ascending: true }),
      adminClient.from("app_settings").select("value").eq("key", STAFF_AVATAR_VISIBILITY_SETTING_KEY).maybeSingle(),
    ]);

    if (error) return NextResponse.json({ error: error.message || "Could not load staff." }, { status: 500 });
    const avatarVisibility = parseStaffAvatarVisibilityMap(avatarVisibilitySetting?.value);

    const { data: authUsersData } = await adminClient.auth.admin.listUsers();
    const emailById = new Map(
      (authUsersData?.users || []).map((user) => [user.id, user.email || null]),
    );

    return NextResponse.json({
      staff: (data || []).map((member) => ({
        id: member.id,
        full_name: member.full_name || member.display_name || "",
        role: member.role || "staff",
        office_location: member.office_location || null,
        avatar_url: staffAvatarVisibleToStaff(avatarVisibility, member.id) ? member.avatar_url || null : null,
        show_avatar_to_staff: staffAvatarVisibleToStaff(avatarVisibility, member.id),
        phone: member.phone || null,
        email: emailById.get(member.id) || null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unexpected staff directory error." }, { status: 500 });
  }
}
