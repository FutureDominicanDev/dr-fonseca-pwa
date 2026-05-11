import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { STAFF_PERMISSIONS_SETTING_KEY, hasPermission, parseStaffPermissionMap } from "@/lib/permissions";
import { isOwnerIdentity } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_PATIENT_LABELS = 20;
const LABEL_COLUMNS = "id,created_by,patient_id,room_id,scope,name,color,description,created_at,updated_at";

type PatientLabelRow = {
  id: string;
  created_by?: string | null;
  patient_id?: string | null;
  room_id?: string | null;
  scope?: string | null;
  name?: string | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key");
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const cleanName = (value: unknown) => `${value || ""}`.trim().slice(0, 80);
const cleanColor = (value: unknown) => {
  const color = `${value || ""}`.trim();
  return /^#[0-9A-F]{6}$/i.test(color) ? color.toUpperCase() : "#64748B";
};
const labelKey = (label: PatientLabelRow) => `${cleanName(label.name).toLowerCase()}|${label.color || "#64748B"}`;

const notConfigured = () => !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY;

async function requireUser(request: NextRequest) {
  if (notConfigured()) {
    return { response: NextResponse.json({ error: "Patient labels are not configured." }, { status: 503 }) };
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { response: NextResponse.json({ error: "Missing session." }, { status: 401 }) };

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return { response: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };

  const [{ data: profile, error: profileError }, permissionsRes] = await Promise.all([
    adminClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle(),
    adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
  ]);
  if (profileError || !profile?.id) {
    return { response: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  const permissionMap = parseStaffPermissionMap(permissionsRes.data?.value);
  const profileWithPermissions = { ...(profile as any), permissions: permissionMap[userId] ?? (profile as any).permissions };
  const userEmail = authData.user?.email?.trim().toLowerCase() || "";

  return { userId, userEmail, profile: profileWithPermissions };
}

function requireManageLabels(auth: Awaited<ReturnType<typeof requireUser>>) {
  if (auth.response) return auth.response;
  if (!hasPermission(auth.profile as any, auth.userEmail || "", "manage_labels")) {
    return NextResponse.json({ error: "You do not have permission to manage labels." }, { status: 403 });
  }
  return null;
}

function canAccessAllPatientRooms(profile: any, email: string) {
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
}

async function verifyPatientAccess(auth: Awaited<ReturnType<typeof requireUser>>, patientId: string) {
  if (auth.response) return { response: auth.response };
  if (canAccessAllPatientRooms(auth.profile, auth.userEmail || "")) return { ok: true };

  const { data: procedures, error: procedureError } = await adminClient
    .from("procedures")
    .select("id")
    .eq("patient_id", patientId);
  if (procedureError) return { response: NextResponse.json({ error: procedureError.message || "Could not verify patient access." }, { status: 500 }) };

  const procedureIds = (procedures || []).map((procedure: any) => procedure.id).filter(Boolean);
  if (procedureIds.length === 0) return { response: NextResponse.json({ error: "No access to this patient." }, { status: 403 }) };

  const { data: rooms, error: roomError } = await adminClient
    .from("rooms")
    .select("id")
    .in("procedure_id", procedureIds);
  if (roomError) return { response: NextResponse.json({ error: roomError.message || "Could not verify room access." }, { status: 500 }) };

  const roomIds = (rooms || []).map((room: any) => room.id).filter(Boolean);
  if (roomIds.length === 0) return { response: NextResponse.json({ error: "No access to this patient." }, { status: 403 }) };

  const { data: membership, error: membershipError } = await adminClient
    .from("room_members")
    .select("id")
    .eq("user_id", auth.userId)
    .in("room_id", roomIds)
    .limit(1);
  if (membershipError) return { response: NextResponse.json({ error: membershipError.message || "Could not verify membership." }, { status: 500 }) };
  if (!membership?.length) return { response: NextResponse.json({ error: "No access to this patient." }, { status: 403 }) };

  return { ok: true };
}

async function visibleLabelsForAuth(auth: Awaited<ReturnType<typeof requireUser>>, labels: PatientLabelRow[]) {
  if (auth.response || canAccessAllPatientRooms(auth.profile, auth.userEmail || "")) return labels;

  const assignmentPatientIds = [...new Set(labels.map((label) => label.patient_id).filter(Boolean))] as string[];
  if (assignmentPatientIds.length === 0) return labels;

  const { data: procedures, error: procedureError } = await adminClient
    .from("procedures")
    .select("id, patient_id")
    .in("patient_id", assignmentPatientIds);
  if (procedureError) throw procedureError;

  const procedurePatientById = new Map((procedures || []).map((procedure: any) => [procedure.id, procedure.patient_id]));
  const procedureIds = [...procedurePatientById.keys()];
  if (procedureIds.length === 0) return labels.filter((label) => !label.patient_id);

  const { data: rooms, error: roomError } = await adminClient
    .from("rooms")
    .select("id, procedure_id")
    .in("procedure_id", procedureIds);
  if (roomError) throw roomError;

  const patientByRoomId = new Map(
    (rooms || []).map((room: any) => [room.id, procedurePatientById.get(room.procedure_id)]),
  );
  const roomIds = [...patientByRoomId.keys()];
  if (roomIds.length === 0) return labels.filter((label) => !label.patient_id);

  const { data: memberships, error: membershipError } = await adminClient
    .from("room_members")
    .select("room_id")
    .eq("user_id", auth.userId)
    .in("room_id", roomIds);
  if (membershipError) throw membershipError;

  const allowedPatientIds = new Set(
    (memberships || []).map((membership: any) => patientByRoomId.get(membership.room_id)).filter(Boolean),
  );
  return labels.filter((label) => !label.patient_id || allowedPatientIds.has(label.patient_id));
}

async function loadLabels(userId: string) {
  return adminClient
    .from("labels")
    .select(LABEL_COLUMNS)
    .eq("created_by", userId)
    .eq("scope", "patient")
    .order("created_at", { ascending: true });
}

async function findOwnedDefinition(userId: string, labelId: string) {
  const { data, error } = await adminClient
    .from("labels")
    .select(LABEL_COLUMNS)
    .eq("id", labelId)
    .eq("created_by", userId)
    .eq("scope", "patient")
    .is("patient_id", null)
    .maybeSingle();
  if (error) return { error };
  if (!data?.id) return { error: new Error("Label not found.") };
  return { data: data as PatientLabelRow };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { data, error } = await loadLabels(auth.userId);
    if (error) return NextResponse.json({ error: error.message || "Could not load labels." }, { status: 500 });
    const labels = await visibleLabelsForAuth(auth, (data || []) as PatientLabelRow[]);
    return NextResponse.json({ labels });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected label error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const permissionError = requireManageLabels(auth);
    if (permissionError) return permissionError;

    const body = await request.json().catch(() => ({}));
    const action = `${body?.action || ""}`;

    if (action === "create") {
      const name = cleanName(body?.name);
      if (!name) return NextResponse.json({ error: "Missing label name." }, { status: 400 });

      const { count, error: countError } = await adminClient
        .from("labels")
        .select("id", { count: "exact", head: true })
        .eq("created_by", auth.userId)
        .eq("scope", "patient")
        .is("patient_id", null);
      if (countError) return NextResponse.json({ error: countError.message || "Could not count labels." }, { status: 500 });
      if ((count || 0) >= MAX_PATIENT_LABELS) {
        return NextResponse.json({ error: "WhatsApp Business allows up to 20 labels." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { data: label, error } = await adminClient
        .from("labels")
        .insert({
          name,
          color: cleanColor(body?.color),
          scope: "patient",
          created_by: auth.userId,
          created_at: now,
          updated_at: now,
        })
        .select(LABEL_COLUMNS)
        .single();
      if (error) return NextResponse.json({ error: error.message || "Could not create label." }, { status: 500 });

      const { data: labels, error: labelsError } = await loadLabels(auth.userId);
      if (labelsError) return NextResponse.json({ error: labelsError.message || "Could not load labels." }, { status: 500 });
      return NextResponse.json({ label, labels: await visibleLabelsForAuth(auth, (labels || []) as PatientLabelRow[]) });
    }

    if (action === "assign") {
      const patientId = `${body?.patientId || ""}`.trim();
      const nextLabelIds: string[] = Array.isArray(body?.labelIds) ? body.labelIds.map((id: unknown) => `${id}`).filter(Boolean) : [];
      if (!patientId) return NextResponse.json({ error: "Missing patient id." }, { status: 400 });

      const { data: patient, error: patientError } = await adminClient
        .from("patients")
        .select("id")
        .eq("id", patientId)
        .maybeSingle();
      if (patientError) return NextResponse.json({ error: patientError.message || "Could not verify patient." }, { status: 500 });
      if (!patient?.id) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
      const access = await verifyPatientAccess(auth, patientId);
      if (access.response) return access.response;

      const { data: rows, error: rowsError } = await loadLabels(auth.userId);
      if (rowsError) return NextResponse.json({ error: rowsError.message || "Could not load labels." }, { status: 500 });

      const allRows = (rows || []) as PatientLabelRow[];
      const definitions = allRows.filter((label) => !label.patient_id);
      const assignments = allRows.filter((label) => label.patient_id === patientId);
      const allowedIds = new Set(definitions.map((label) => label.id));
      const desiredIds = [...new Set(nextLabelIds.filter((id: string) => allowedIds.has(id)))];
      const currentIds = assignments
        .map((assignment) => definitions.find((label) => labelKey(label) === labelKey(assignment))?.id || assignment.id)
        .filter(Boolean);
      const addedIds = desiredIds.filter((id) => !currentIds.includes(id));
      const removedIds = currentIds.filter((id) => !desiredIds.includes(id));
      const now = new Date().toISOString();

      const addedRows = addedIds
        .map((id) => definitions.find((label) => label.id === id))
        .filter(Boolean)
        .map((label) => ({
          name: cleanName(label?.name),
          color: label?.color || "#64748B",
          scope: "patient",
          patient_id: patientId,
          created_by: auth.userId,
          created_at: now,
          updated_at: now,
        }));

      const assignmentIdsToRemove = assignments
        .filter((assignment) => removedIds.some((id) => {
          const label = definitions.find((item) => item.id === id);
          return label && labelKey(label) === labelKey(assignment);
        }))
        .map((assignment) => assignment.id);

      if (addedRows.length) {
        const { error } = await adminClient.from("labels").insert(addedRows);
        if (error) return NextResponse.json({ error: error.message || "Could not assign labels." }, { status: 500 });
      }

      if (assignmentIdsToRemove.length) {
        const { error } = await adminClient
          .from("labels")
          .delete()
          .eq("created_by", auth.userId)
          .in("id", assignmentIdsToRemove);
        if (error) return NextResponse.json({ error: error.message || "Could not remove labels." }, { status: 500 });
      }

      const { data: labels, error: labelsError } = await loadLabels(auth.userId);
      if (labelsError) return NextResponse.json({ error: labelsError.message || "Could not load labels." }, { status: 500 });
      return NextResponse.json({ labels: await visibleLabelsForAuth(auth, (labels || []) as PatientLabelRow[]) });
    }

    return NextResponse.json({ error: "Unknown label action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected label error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const permissionError = requireManageLabels(auth);
    if (permissionError) return permissionError;

    const body = await request.json().catch(() => ({}));
    const labelId = `${body?.labelId || ""}`.trim();
    const name = cleanName(body?.name);
    if (!labelId || !name) return NextResponse.json({ error: "Missing label details." }, { status: 400 });

    const owned = await findOwnedDefinition(auth.userId, labelId);
    if (owned.error) return NextResponse.json({ error: owned.error.message || "Label not found." }, { status: 404 });

    const previousKey = labelKey(owned.data);
    const now = new Date().toISOString();
    const updatePayload = { name, color: cleanColor(body?.color), updated_at: now };
    const { error: updateError } = await adminClient
      .from("labels")
      .update(updatePayload)
      .eq("id", labelId)
      .eq("created_by", auth.userId);
    if (updateError) return NextResponse.json({ error: updateError.message || "Could not update label." }, { status: 500 });

    const { data: labelsBeforeUpdate, error: labelsError } = await loadLabels(auth.userId);
    if (labelsError) return NextResponse.json({ error: labelsError.message || "Could not load labels." }, { status: 500 });
    const assignmentIds = ((labelsBeforeUpdate || []) as PatientLabelRow[])
      .filter((label) => !!label.patient_id && labelKey(label) === previousKey)
      .map((label) => label.id);
    if (assignmentIds.length) {
      const { error } = await adminClient
        .from("labels")
        .update(updatePayload)
        .eq("created_by", auth.userId)
        .in("id", assignmentIds);
      if (error) return NextResponse.json({ error: error.message || "Could not update assigned labels." }, { status: 500 });
    }

    const { data: labels, error } = await loadLabels(auth.userId);
    if (error) return NextResponse.json({ error: error.message || "Could not load labels." }, { status: 500 });
    return NextResponse.json({ labels: await visibleLabelsForAuth(auth, (labels || []) as PatientLabelRow[]) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected label error." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const permissionError = requireManageLabels(auth);
    if (permissionError) return permissionError;

    const body = await request.json().catch(() => ({}));
    const labelId = `${body?.labelId || ""}`.trim();
    if (!labelId) return NextResponse.json({ error: "Missing label id." }, { status: 400 });

    const owned = await findOwnedDefinition(auth.userId, labelId);
    if (owned.error) return NextResponse.json({ error: owned.error.message || "Label not found." }, { status: 404 });

    const targetKey = labelKey(owned.data);
    const { data: labelsBeforeDelete, error: labelsError } = await loadLabels(auth.userId);
    if (labelsError) return NextResponse.json({ error: labelsError.message || "Could not load labels." }, { status: 500 });

    const idsToDelete = ((labelsBeforeDelete || []) as PatientLabelRow[])
      .filter((label) => label.id === labelId || (!!label.patient_id && labelKey(label) === targetKey))
      .map((label) => label.id);

    if (idsToDelete.length) {
      const { error } = await adminClient
        .from("labels")
        .delete()
        .eq("created_by", auth.userId)
        .in("id", idsToDelete);
      if (error) return NextResponse.json({ error: error.message || "Could not delete label." }, { status: 500 });
    }

    const { data: labels, error } = await loadLabels(auth.userId);
    if (error) return NextResponse.json({ error: error.message || "Could not load labels." }, { status: 500 });
    return NextResponse.json({ labels: await visibleLabelsForAuth(auth, (labels || []) as PatientLabelRow[]) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected label error." }, { status: 500 });
  }
}
