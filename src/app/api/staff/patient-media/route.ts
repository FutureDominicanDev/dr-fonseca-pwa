import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CHAT_FILES_BUCKET } from "@/lib/chatFileUrls";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";
import { isOwnerIdentity } from "@/lib/securityConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedFolders = new Set(["chat-media", "pre-op-photos", "prescriptions", "staff-record"]);

const safeStorageSegment = (value: string) =>
  `${value || "file"}`
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "file";

const extensionFor = (fileName: string, mimeType: string) => {
  const fromName = /\.([a-z0-9]{2,8})$/i.exec(fileName)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const type = mimeType.toLowerCase();
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("mp4")) return type.startsWith("audio/") ? "m4a" : "mp4";
  if (type.includes("webm")) return "webm";
  if (type.includes("pdf")) return "pdf";
  return "bin";
};

const normalizeProcedure = (room: any) => {
  const procedure = room?.procedures;
  return Array.isArray(procedure) ? procedure[0] : procedure;
};

const normalizePatientId = (room: any) => {
  const patient = normalizeProcedure(room)?.patients;
  const normalized = Array.isArray(patient) ? patient[0] : patient;
  return `${normalized?.id || ""}`.trim();
};

const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });

const validateStaffForRoom = async (request: NextRequest, roomId: string) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return { error: jsonError("Staff media upload is not configured.", 503) };
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: jsonError("Missing session.", 401) };

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id) return { error: jsonError("Invalid session.", 401) };

  const [{ data: profile, error: profileError }, { data: permissionsSetting }, { data: room, error: roomError }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, email, phone, full_name, display_name, role, admin_level, permissions")
      .eq("id", user.id)
      .maybeSingle(),
    adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    adminClient
      .from("rooms")
      .select("id, created_by, procedures(patients(id))")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  if (profileError || !profile?.id || `${profile.role || ""}`.toLowerCase() === "pending_staff") {
    return { error: jsonError("Staff approval is required before uploading media.", 403) };
  }
  if (roomError || !room?.id) return { error: jsonError("Patient room not found.", 404) };

  const email = `${user.email || profile.email || ""}`.trim().toLowerCase();
  const permissionMap = parseStaffPermissionMap(permissionsSetting?.value);
  const permissionProfile = { ...(profile as any), permissions: permissionMap[user.id] ?? (profile as any).permissions };
  if (!hasPermission(permissionProfile, email, "view_patients") || !hasPermission(permissionProfile, email, "view_upload_files")) {
    return { error: jsonError("You do not have permission to upload patient media.", 403) };
  }

  const role = `${(profile as any).role || ""}`.toLowerCase();
  const adminLevel = `${(profile as any).admin_level || ""}`.toLowerCase();
  const canAccessAllRooms =
    role === "doctor" ||
    adminLevel === "super_admin" ||
    isOwnerIdentity({
      id: user.id,
      email,
      phone: (profile as any).phone,
      fullName: (profile as any).full_name,
      displayName: (profile as any).display_name,
      adminLevel,
    });

  if (!canAccessAllRooms) {
    const { data: membership, error: membershipError } = await adminClient
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership?.id) return { error: jsonError("You are not assigned to this patient room.", 403) };
  }

  return { user, profile, room };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = `${body?.action || ""}`.trim();
    const roomId = `${body?.roomId || ""}`.trim();
    if (!roomId) return jsonError("Missing patient room.", 400);

    const staff = await validateStaffForRoom(request, roomId);
    if (staff.error) return staff.error;

    const patientId = normalizePatientId(staff.room);
    if (!patientId) return jsonError("Patient record not found.", 404);

    if (action === "createUpload") {
      const folder = allowedFolders.has(`${body?.folder || ""}`) ? `${body.folder}` : "chat-media";
      const fileType = `${body?.fileType || "application/octet-stream"}`.trim() || "application/octet-stream";
      const originalName = safeStorageSegment(`${body?.fileName || "upload.bin"}`);
      const ext = extensionFor(originalName, fileType);
      const fileBase = originalName.toLowerCase().endsWith(`.${ext}`) ? originalName : `${originalName}.${ext}`;
      const staffName = safeStorageSegment(`${(staff.profile as any)?.full_name || (staff.profile as any)?.display_name || staff.user?.id || "staff"}`);
      const path = `patients/${patientId}/${folder}/uploaded-by-${staffName}/${Date.now()}-${fileBase}`;
      const { data, error } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUploadUrl(path);
      if (error || !data?.token) throw error || new Error("Missing signed upload token.");
      return NextResponse.json({ path: data.path || path, token: data.token });
    }

    if (action === "completeUpload") {
      const path = `${body?.path || ""}`.trim();
      if (!path || path.includes("..") || !path.startsWith(`patients/${patientId}/`)) {
        return jsonError("Invalid media path.", 400);
      }
      const { data: publicData } = adminClient.storage.from(CHAT_FILES_BUCKET).getPublicUrl(path);
      const { data: signedData } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, 3600);
      return NextResponse.json({
        path,
        publicUrl: publicData.publicUrl,
        signedUrl: signedData?.signedUrl || null,
      });
    }

    return jsonError("Unknown staff media action.", 400);
  } catch (error) {
    console.error("staff patient media upload failed", error);
    return jsonError("Staff patient media upload failed.", 500);
  }
}
