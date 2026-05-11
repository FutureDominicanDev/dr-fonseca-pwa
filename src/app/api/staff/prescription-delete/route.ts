import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasPermission, parseStaffPermissionMap, STAFF_PERMISSIONS_SETTING_KEY } from "@/lib/permissions";
import { isOwnerIdentity } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isSchemaError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const text = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return text.includes("column") || text.includes("relation") || text.includes("schema cache") || text.includes("does not exist");
};

const canAccessAllRooms = (profile: any, email: string) => {
  const rawLevel = `${profile?.admin_level || ""}`.toLowerCase();
  const level = rawLevel === "owner" ? "super_admin" : rawLevel;
  const role = `${profile?.role || ""}`.toLowerCase();
  return isOwnerIdentity({
    id: profile?.id,
    email,
    phone: profile?.phone,
    fullName: profile?.full_name,
    displayName: profile?.display_name,
    adminLevel: profile?.admin_level,
  }) || level === "super_admin" || role === "doctor";
};

const prescriptionTitle = (fileName?: string | null) => {
  const clean = `${fileName || ""}`.replace(/^\[MED\]\s*/i, "").trim();
  const [title] = clean.split(/\n+/);
  return title?.trim() || "Prescription";
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Prescription service is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing staff session." }, { status: 401 });

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    const requester = authData?.user;
    if (authError || !requester?.id) return NextResponse.json({ error: "Invalid staff session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const messageId = `${body?.messageId || ""}`.trim();
    const roomId = `${body?.roomId || ""}`.trim();
    if (!messageId || !roomId) return NextResponse.json({ error: "Missing prescription." }, { status: 400 });

    const [{ data: requesterProfile }, { data: permissionsSetting }] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    if (!requesterProfile?.id || `${requesterProfile.role || ""}`.toLowerCase() === "pending_staff") {
      return NextResponse.json({ error: "Staff approval is required." }, { status: 403 });
    }

    const permissionMap = parseStaffPermissionMap(permissionsSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const requesterMetadata = (requester.user_metadata || {}) as Record<string, unknown>;
    const permissionProfile = {
      ...(requesterProfile as any),
      permissions: permissionMap[requester.id] ?? (requesterProfile as any).permissions,
    };
    const requesterIsOwner = isOwnerIdentity({
      id: requester.id,
      email: requesterEmail,
      phone: `${(requesterProfile as any)?.phone || requester.phone || requesterMetadata.phone || ""}`,
      fullName: (requesterProfile as any)?.full_name || `${requesterMetadata.full_name || ""}`,
      displayName: (requesterProfile as any)?.display_name || "",
      adminLevel: `${(requesterProfile as any)?.admin_level || ""}`,
    });

    if (!requesterIsOwner && !hasPermission(permissionProfile, requesterEmail, "view_upload_files")) {
      return NextResponse.json({ error: "You do not have permission to delete prescriptions." }, { status: 403 });
    }

    if (!canAccessAllRooms(permissionProfile, requesterEmail)) {
      const { data: membership, error: membershipError } = await adminClient
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", requester.id)
        .maybeSingle();
      if (membershipError) return NextResponse.json({ error: membershipError.message || "Could not verify room access." }, { status: 500 });
      if (!membership?.id) return NextResponse.json({ error: "You do not have access to this patient room." }, { status: 403 });
    }

    const { data: message, error: messageError } = await adminClient
      .from("messages")
      .select("id, room_id, file_name, sender_id, sender_name, created_at, deleted_by_staff")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (messageError) return NextResponse.json({ error: messageError.message || "Could not load prescription." }, { status: 500 });
    if (!message?.id) return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
    if (!`${message.file_name || ""}`.startsWith("[MED]")) {
      return NextResponse.json({ error: "This file is not a prescription." }, { status: 400 });
    }

    const [{ data: room }, { data: uploaderProfile }] = await Promise.all([
      adminClient
        .from("rooms")
        .select("id, procedure_id, procedures(id, patient_id, procedure_name, patients(id, full_name))")
        .eq("id", roomId)
        .maybeSingle(),
      message.sender_id
        ? adminClient.from("profiles").select("id, full_name, display_name, email").eq("id", message.sender_id).maybeSingle().then((result) => result)
        : Promise.resolve({ data: null }),
    ]);

    const procedure = Array.isArray((room as any)?.procedures) ? (room as any).procedures[0] : (room as any)?.procedures;
    const patient = Array.isArray(procedure?.patients) ? procedure.patients[0] : procedure?.patients;
    const title = prescriptionTitle(message.file_name);
    const originalUploaderName =
      (uploaderProfile as any)?.full_name ||
      (uploaderProfile as any)?.display_name ||
      message.sender_name ||
      "Unknown staff";
    const deletedAt = new Date().toISOString();

    const { error: updateError } = await adminClient
      .from("messages")
      .update({ deleted_by_staff: true, deleted_at: deletedAt })
      .eq("id", message.id)
      .eq("room_id", roomId);
    if (updateError) return NextResponse.json({ error: updateError.message || "Could not delete prescription." }, { status: 500 });

    const { error: auditError } = await adminClient.from("admin_audit_events").insert({
      action: "prescription_deleted",
      entity_type: "prescription",
      entity_id: message.id,
      entity_name: title,
      patient_id: procedure?.patient_id || patient?.id || null,
      actor_id: requester.id,
      actor_name: (requesterProfile as any)?.full_name || (requesterProfile as any)?.display_name || requesterEmail,
      actor_email: requesterEmail,
      notes: `Prescription "${title}" deleted. Original uploader: ${originalUploaderName}.`,
      metadata: {
        room_id: roomId,
        procedure_id: procedure?.id || null,
        patient_name: patient?.full_name || null,
        prescription_name: title,
        original_uploader_id: message.sender_id || null,
        original_uploader_name: originalUploaderName,
        original_uploaded_at: message.created_at || null,
        deleted_at: deletedAt,
      },
    });
    if (auditError && !isSchemaError(auditError)) {
      return NextResponse.json({ error: auditError.message || "Prescription deleted, but audit logging failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedAt, prescriptionName: title, originalUploaderName });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not delete prescription." }, { status: 500 });
  }
}
