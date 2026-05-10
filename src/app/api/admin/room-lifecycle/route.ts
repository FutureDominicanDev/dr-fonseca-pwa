import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasPermission, normalizePermissionList } from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STAFF_PERMISSIONS_SETTING_KEY = "staff_permissions";

const getAdminClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const isSchemaError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const text = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return text.includes("column") || text.includes("relation") || text.includes("schema cache") || text.includes("does not exist");
};

const parseStaffPermissionMap = (value: unknown) => {
  if (typeof value !== "string") return {} as Record<string, ReturnType<typeof normalizePermissionList>>;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([id, permissions]) => [id, normalizePermissionList(permissions)]));
  } catch {
    return {};
  }
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server configuration." }, { status: 503 });
    }
    const adminClient = getAdminClient();

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) return NextResponse.json({ error: "Missing staff session." }, { status: 401 });

    const requesterRes = await adminClient.auth.getUser(accessToken);
    const requester = requesterRes.data?.user;
    if (requesterRes.error || !requester) return NextResponse.json({ error: "Invalid staff session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    const action = body?.action === "restore" ? "restore" : body?.action === "cancel" ? "cancel" : "";
    if (!roomId || !action) return NextResponse.json({ error: "Missing room action." }, { status: 400 });

    const requesterEmail = requester.email?.trim().toLowerCase() || "";
    const [{ data: profile }, permissionsRes] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionsRes.data?.value);
    const profileWithPermissions = profile ? { ...(profile as any), permissions: permissionMap[requester.id] ?? (profile as any).permissions } : profile;
    const allowed = action === "restore"
      ? hasPermission(profileWithPermissions as any, requesterEmail, "restore_rooms")
      : hasPermission(profileWithPermissions as any, requesterEmail, "archive_rooms");
    if (!allowed) return NextResponse.json({ error: "You do not have permission to change room status." }, { status: 403 });

    const roomQuery = await adminClient
      .from("rooms")
      .select("id, procedure_id, procedures(id, patient_id, procedure_name, status, patients(id, full_name, record_status))")
      .eq("id", roomId)
      .maybeSingle();

    if (roomQuery.error || !roomQuery.data) {
      return NextResponse.json({ error: roomQuery.error?.message || "Room not found." }, { status: 404 });
    }

    const room = roomQuery.data as any;
    const procedure = Array.isArray(room.procedures) ? room.procedures[0] : room.procedures;
    const patient = Array.isArray(procedure?.patients) ? procedure.patients[0] : procedure?.patients;
    const patientId = procedure?.patient_id || patient?.id || "";
    const nextPatientStatus = action === "restore" ? "active" : "archived";
    const nextProcedureStatus = action === "restore" ? "scheduled" : "cancelled";

    if (procedure?.id) {
      const { error } = await adminClient
        .from("procedures")
        .update({ status: nextProcedureStatus })
        .eq("id", procedure.id);
      if (error) return NextResponse.json({ error: error.message || "Could not update procedure." }, { status: 500 });
    }

    if (patientId) {
      const { error } = await adminClient
        .from("patients")
        .update({
          record_status: nextPatientStatus,
          record_status_changed_at: new Date().toISOString(),
          record_status_changed_by: requester.id,
        })
        .eq("id", patientId);
      if (error) return NextResponse.json({ error: error.message || "Could not update patient record." }, { status: 500 });
    }

    const auditPayload = {
      action: action === "restore" ? "room_restored" : "room_cancelled",
      entity_type: "room",
      entity_id: roomId,
      entity_name: procedure?.procedure_name || patient?.full_name || "Patient room",
      patient_id: patientId || null,
      actor_id: requester.id,
      actor_name: (profileWithPermissions as any)?.full_name || (profileWithPermissions as any)?.display_name || requesterEmail,
      actor_email: requesterEmail,
      notes: action === "restore" ? "Room restored to active workflow." : "Room cancelled and patient record archived.",
      metadata: { room_id: roomId, procedure_id: procedure?.id || null, next_patient_status: nextPatientStatus, next_procedure_status: nextProcedureStatus },
    };
    const { error: auditError } = await adminClient.from("admin_audit_events").insert(auditPayload);
    if (auditError && !isSchemaError(auditError)) {
      return NextResponse.json({ error: auditError.message || "Room changed, but audit logging failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action, roomId, patientId, procedureId: procedure?.id || null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected room lifecycle error." }, { status: 500 });
  }
}
