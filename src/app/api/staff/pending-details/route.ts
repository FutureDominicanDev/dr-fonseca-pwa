import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StaffProfile = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  admin_level?: string | null;
  permissions?: unknown;
};

type PendingSignupDetail = {
  device: string | null;
  location: string | null;
  registeredAt: string | null;
  capturedAt: string | null;
};

const createAdminClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const stringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>).message;
  return typeof value === "string" ? value : "";
};

const inferDevice = (value: string) => {
  const ua = value.toLowerCase();
  if (!ua) return "";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return ua.includes("mobile") ? "Android phone" : "Android tablet";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "Mac computer";
  if (ua.includes("windows")) return "Windows computer";
  if (ua.includes("linux")) return "Linux computer";
  return "";
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Pending staff details are not configured." }, { status: 503 });
    }

    const adminClient = createAdminClient();
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing admin session." }, { status: 401 });

    const { data: requesterAuth, error: requesterAuthError } = await adminClient.auth.getUser(token);
    const requester = requesterAuth?.user;
    if (requesterAuthError || !requester?.id) {
      return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });
    }

    const [{ data: requesterProfile }, { data: permissionSetting }] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const typedRequesterProfile = requesterProfile as StaffProfile | null;
    const permissionProfile = typedRequesterProfile
      ? { ...typedRequesterProfile, permissions: permissionMap[requester.id] ?? typedRequesterProfile.permissions }
      : null;
    const canViewPendingDetails = isOwnerEmail(requesterEmail) || hasPermission(permissionProfile, requesterEmail, "manage_staff");
    if (!canViewPendingDetails) {
      return NextResponse.json({ error: "Not allowed to view pending staff signup details." }, { status: 403 });
    }

    const body = await request.json().catch((): Record<string, unknown> => ({}));
    const rawUserIds = Array.isArray(body.userIds) ? (body.userIds as unknown[]) : [];
    const userIds = Array.from(
      new Set(rawUserIds.map((value) => stringValue(value)).filter((value) => uuidPattern.test(value))),
    ).slice(0, 50);
    if (userIds.length === 0) return NextResponse.json({ details: {} });

    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, role")
      .in("id", userIds);
    if (profilesError) {
      return NextResponse.json({ error: profilesError.message || "Could not read pending staff profiles." }, { status: 500 });
    }

    const pendingIds = new Set(
      ((profiles || []) as StaffProfile[])
        .filter((profile) => `${profile.role || ""}`.toLowerCase() === "pending_staff" && profile.id)
        .map((profile) => `${profile.id}`),
    );

    const details: Record<string, PendingSignupDetail> = {};
    await Promise.all(
      Array.from(pendingIds).map(async (userId) => {
        const authUserRes = await adminClient.auth.admin.getUserById(userId);
        if (authUserRes.error || !authUserRes.data?.user) {
          details[userId] = {
            device: null,
            location: null,
            registeredAt: null,
            capturedAt: null,
          };
          return;
        }

        const user = authUserRes.data.user;
        const metadata = (user.user_metadata || {}) as Record<string, unknown>;
        const locationParts = [
          stringValue(metadata.signup_city),
          stringValue(metadata.signup_region),
          stringValue(metadata.signup_country),
        ].filter(Boolean);
        details[userId] = {
          device: stringValue(metadata.signup_device) || inferDevice(stringValue(metadata.user_agent)),
          location: stringValue(metadata.signup_location) || locationParts.join(", ") || null,
          registeredAt: user.created_at || null,
          capturedAt: stringValue(metadata.signup_captured_at) || null,
        };
      }),
    );

    return NextResponse.json({ details });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) || "Unexpected pending staff details error." }, { status: 500 });
  }
}
