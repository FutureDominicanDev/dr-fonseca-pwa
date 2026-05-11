import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";
import { hasPermission, normalizePermissionList } from "@/lib/permissions";
import { CHAT_FILES_BUCKET, extractChatFilePath } from "@/lib/chatFileUrls";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STAFF_PERMISSIONS_SETTING_KEY = "staff_permissions";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key");
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const isTrueOwnerProfile = (profile: any, email: string) =>
  isOwnerIdentity({
    id: profile?.id,
    email,
    phone: profile?.phone,
    fullName: profile?.full_name,
    displayName: profile?.display_name,
    adminLevel: profile?.admin_level,
  });

const canEditClinicalRecord = (profile: any, email: string) =>
  isTrueOwnerProfile(profile, email) || (`${profile?.role || ""}`.toLowerCase() === "doctor" && hasPermission(profile, email, "edit_patient_info"));

const canAccessAllPatientRooms = (profile: any, email: string) => {
  const rawLevel = `${profile?.admin_level || ""}`.toLowerCase();
  const level = rawLevel === "owner" ? "super_admin" : rawLevel;
  const role = `${profile?.role || ""}`.toLowerCase();
  return isTrueOwnerProfile(profile, email) || level === "super_admin" || role === "doctor";
};

const visibleMessagesForProfile = (messages: any[], profile: any, email: string) => {
  const canViewFiles = hasPermission(profile, email, "view_upload_files");
  const canViewInternal = hasPermission(profile, email, "view_internal_notes");
  const canViewClinicalHistory = hasPermission(profile, email, "view_clinical_history");

  return messages.filter((message) => {
    const fileName = `${message?.file_name || ""}`;
    const messageType = `${message?.message_type || ""}`;
    if (message?.is_internal) return canViewInternal;
    if (fileName.startsWith("[FORM]")) return canViewClinicalHistory;
    if (fileName.startsWith("[MED]")) return canViewFiles;
    if (messageType === "image" || messageType === "video" || messageType === "file") return canViewFiles;
    return true;
  });
};

const cleanOffice = (value: unknown) => (value === "Guadalajara" || value === "Tijuana" ? value : null);

const parseStaffPermissionMap = (value: unknown) => {
  if (typeof value !== "string") return {} as Record<string, ReturnType<typeof normalizePermissionList>>;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([id, permissions]) => [id, normalizePermissionList(permissions)]));
  } catch {
    return {};
  }
};

async function signedChatFileUrl(value?: string | null) {
  const path = extractChatFilePath(value);
  if (!path) return value || "";
  const { data, error } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return value || "";
  return data.signedUrl;
}

async function signMessageMedia(message: any) {
  const messageType = `${message?.message_type || ""}`;
  if (!["image", "video", "audio", "file"].includes(messageType)) return message;
  return {
    ...message,
    content: await signedChatFileUrl(message.content || message.file_url),
    file_url: await signedChatFileUrl(message.file_url || message.content),
  };
}

const profileWithStoredPermissions = async (profile: any, userId: string) => {
  const { data } = await adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle();
  const permissionMap = parseStaffPermissionMap(data?.value);
  return profile ? { ...profile, permissions: permissionMap[userId] ?? profile.permissions } : profile;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ patientId: string }> },
) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Admin record access is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const { patientId } = await context.params;
    if (!patientId) return NextResponse.json({ error: "Missing patient id." }, { status: 400 });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const { data: viewerProfile, error: viewerError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (viewerError || !viewerProfile?.id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    const viewerEmail = user.email?.toLowerCase() || "";
    const permissionProfile = await profileWithStoredPermissions(viewerProfile, user.id);
    if (!hasPermission(permissionProfile, viewerEmail, "view_patients")) {
      return NextResponse.json({ error: "No admin record access." }, { status: 403 });
    }

    const { data: patient, error: patientError } = await adminClient
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .maybeSingle();
    if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 });
    if (!patient?.id) return NextResponse.json({ error: "Patient record not found." }, { status: 404 });

    const { data: procedures, error: proceduresError } = await adminClient
      .from("procedures")
      .select("*")
      .eq("patient_id", patientId);
    if (proceduresError) return NextResponse.json({ error: proceduresError.message }, { status: 500 });

    const procedureIds = (procedures || []).map((procedure: any) => procedure.id).filter(Boolean);
    const { data: rooms, error: roomsError } = procedureIds.length
      ? await adminClient.from("rooms").select("*").in("procedure_id", procedureIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (roomsError) return NextResponse.json({ error: roomsError.message }, { status: 500 });

    const roomIds = (rooms || []).map((room: any) => room.id).filter(Boolean);
    let visibleRooms = rooms || [];
    if (!canAccessAllPatientRooms(permissionProfile, viewerEmail)) {
      const { data: memberships, error: membershipsError } = roomIds.length
        ? await adminClient
            .from("room_members")
            .select("room_id")
            .eq("user_id", user.id)
            .in("room_id", roomIds)
        : { data: [], error: null };
      if (membershipsError) return NextResponse.json({ error: membershipsError.message }, { status: 500 });

      const allowedRoomIds = new Set((memberships || []).map((membership: any) => membership.room_id).filter(Boolean));
      if (allowedRoomIds.size === 0) {
        return NextResponse.json({ error: "No access to this patient record." }, { status: 403 });
      }
      visibleRooms = (rooms || []).filter((room: any) => allowedRoomIds.has(room.id));
    }

    const visibleRoomIds = visibleRooms.map((room: any) => room.id).filter(Boolean);
    const { data: messages, error: messagesError } = roomIds.length
      ? await adminClient.from("messages").select("*").in("room_id", visibleRoomIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });
    const visibleMessages = visibleMessagesForProfile(messages || [], permissionProfile, viewerEmail);

    const senderIds = [...new Set(visibleMessages.map((message: any) => message.sender_id).filter(Boolean))];
    const { data: staffProfiles, error: staffError } = senderIds.length
      ? await adminClient.from("profiles").select("*").in("id", senderIds)
      : { data: [], error: null };
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

    return NextResponse.json({
      patient: {
        ...patient,
        profile_picture_url: await signedChatFileUrl(patient.profile_picture_url),
      },
      procedures: procedures || [],
      rooms: visibleRooms || [],
      messages: await Promise.all(visibleMessages.map(signMessageMedia)),
      staffProfiles: await Promise.all((staffProfiles || []).map(async (profile: any) => ({
        ...profile,
        avatar_url: await signedChatFileUrl(profile.avatar_url),
      }))),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected admin record error." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ patientId: string }> },
) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Admin record access is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const { patientId } = await context.params;
    if (!patientId) return NextResponse.json({ error: "Missing patient id." }, { status: 400 });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const { data: viewerProfile, error: viewerError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (viewerError || !viewerProfile?.id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    const viewerEmail = user.email?.toLowerCase() || "";
    const permissionProfile = await profileWithStoredPermissions(viewerProfile, user.id);
    if (!canEditClinicalRecord(permissionProfile, viewerEmail)) {
      return NextResponse.json({ error: "Only the doctor with full control can modify this record." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action === "updatePatient") {
      const payload = body?.payload || {};
      const updatePayload = {
        full_name: `${payload.full_name || ""}`.trim() || null,
        phone: `${payload.phone || ""}`.trim() || null,
        email: `${payload.email || ""}`.trim() || null,
        birthdate: payload.birthdate ? `${payload.birthdate}` : null,
        preferred_language: payload.preferred_language ? `${payload.preferred_language}` : null,
        timezone: payload.timezone ? `${payload.timezone}` : null,
        allergies: `${payload.allergies || ""}`.trim() || null,
        current_medications: `${payload.current_medications || ""}`.trim() || null,
      };

      const { data: patient, error: updateError } = await adminClient
        .from("patients")
        .update(updatePayload)
        .eq("id", patientId)
        .select("*")
        .maybeSingle();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      if (!patient?.id) return NextResponse.json({ error: "The patient record could not be updated." }, { status: 500 });

      return NextResponse.json({ patient });
    }

    if (body?.action !== "updateProcedure") {
      return NextResponse.json({ error: "Unsupported record action." }, { status: 400 });
    }

    const procedureId = `${body?.procedureId || ""}`.trim();
    if (!procedureId) return NextResponse.json({ error: "Missing procedure id." }, { status: 400 });

    const { data: existingProcedure, error: existingError } = await adminClient
      .from("procedures")
      .select("id, patient_id")
      .eq("id", procedureId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existingProcedure?.id) return NextResponse.json({ error: "Procedure not found for this patient." }, { status: 404 });

    const payload = body?.payload || {};
    const updatePayload = {
      procedure_name: `${payload.procedure_name || ""}`.trim() || null,
      office_location: cleanOffice(payload.office_location),
      surgery_date: payload.surgery_date ? `${payload.surgery_date}` : null,
    };

    const { data: procedure, error: updateError } = await adminClient
      .from("procedures")
      .update(updatePayload)
      .eq("id", procedureId)
      .eq("patient_id", patientId)
      .select("*")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!procedure?.id) return NextResponse.json({ error: "The procedure could not be updated." }, { status: 500 });

    return NextResponse.json({ procedure });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected admin record update error." }, { status: 500 });
  }
}
