import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key");
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

function isSchemaColumnError(error: unknown) {
  const value = error as { message?: string; details?: string; hint?: string };
  return `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase().includes("column");
}

async function getViewer(request: NextRequest) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, admin_level")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.id) return null;
  return { id: userId, adminLevel: `${profile.admin_level || ""}`.toLowerCase() };
}

async function canAccessPatient(viewer: { id: string; adminLevel: string }, patientId: string, roomId?: string) {
  if (viewer.adminLevel === "owner" || viewer.adminLevel === "super_admin") return true;

  if (roomId) {
    const { data: membership } = await adminClient
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (membership?.id) return true;
  }

  const { data: rooms } = await adminClient
    .from("rooms")
    .select("id, procedures!inner(patient_id)")
    .eq("procedures.patient_id", patientId);
  const roomIds = (rooms || []).map((room: any) => room.id).filter(Boolean);
  if (roomIds.length === 0) return false;

  const { data: membership } = await adminClient
    .from("room_members")
    .select("id")
    .in("room_id", roomIds)
    .eq("user_id", viewer.id)
    .limit(1);

  return Boolean(membership?.length);
}

export async function GET(request: NextRequest) {
  try {
    if (!configured) return NextResponse.json({ error: "Labels are not configured." }, { status: 503 });
    const viewer = await getViewer(request);
    if (!viewer) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    let query = await adminClient
      .from("labels")
      .select("*")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: true });
    if (query.error && isSchemaColumnError(query.error)) {
      query = await adminClient
        .from("labels")
        .select("*")
        .eq("created_by", viewer.id)
        .order("created_at", { ascending: true });
    }

    if (query.error) return NextResponse.json({ error: query.error.message }, { status: 500 });
    return NextResponse.json({ labels: query.data || [] });
  } catch {
    return NextResponse.json({ error: "Unexpected labels error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!configured) return NextResponse.json({ error: "Labels are not configured." }, { status: 503 });
    const viewer = await getViewer(request);
    if (!viewer) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const body = await request.json();
    const name = `${body?.name || ""}`.trim();
    const color = `${body?.color || "#2563EB"}`.trim() || "#2563EB";
    if (!name) return NextResponse.json({ error: "Label name is required." }, { status: 400 });

    let countQuery = await adminClient
      .from("labels")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id);
    if (countQuery.error && isSchemaColumnError(countQuery.error)) {
      countQuery = await adminClient
        .from("labels")
        .select("id", { count: "exact", head: true })
        .eq("created_by", viewer.id);
    }
    const count = countQuery.count;
    if ((count || 0) >= 20) return NextResponse.json({ error: "Label limit reached." }, { status: 400 });

    const now = new Date().toISOString();
    const fullPayload = {
      user_id: viewer.id,
      name,
      name_es: `${body?.name_es || name}`.trim(),
      name_en: `${body?.name_en || name}`.trim(),
      color,
      scope: "patient",
      created_by: viewer.id,
      created_at: now,
      updated_at: now,
    };
    let insert = await adminClient
      .from("labels")
      .insert(fullPayload)
      .select("*")
      .single();

    if (insert.error && isSchemaColumnError(insert.error)) {
      const { name_es: _nameEs, name_en: _nameEn, ...compatiblePayload } = fullPayload;
      insert = await adminClient.from("labels").insert(compatiblePayload).select("*").single();
    }
    if (insert.error && isSchemaColumnError(insert.error)) {
      const { user_id: _userId, name_es: _nameEs, name_en: _nameEn, ...legacyPayload } = fullPayload;
      insert = await adminClient.from("labels").insert(legacyPayload).select("*").single();
    }

    if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });
    return NextResponse.json({ label: insert.data });
  } catch {
    return NextResponse.json({ error: "Unexpected label create error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!configured) return NextResponse.json({ error: "Labels are not configured." }, { status: 503 });
    const viewer = await getViewer(request);
    if (!viewer) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const body = await request.json();
    const patientId = `${body?.patientId || ""}`.trim();
    const roomId = `${body?.roomId || ""}`.trim();
    const labelIds = Array.isArray(body?.labelIds) ? body.labelIds.map((id: unknown) => `${id}`).filter(Boolean) : [];
    if (!patientId) return NextResponse.json({ error: "Patient is required." }, { status: 400 });
    const allowed = await canAccessPatient(viewer, patientId, roomId || undefined);
    if (!allowed) return NextResponse.json({ error: "Not allowed for this patient." }, { status: 403 });

    let labelQuery = await adminClient
      .from("labels")
      .select("id")
      .eq("user_id", viewer.id)
      .in("id", labelIds.length ? labelIds : ["00000000-0000-0000-0000-000000000000"]);
    if (labelQuery.error && isSchemaColumnError(labelQuery.error)) {
      labelQuery = await adminClient
        .from("labels")
        .select("id")
        .eq("created_by", viewer.id)
        .in("id", labelIds.length ? labelIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const ownedLabels = labelQuery.data;
    const labelError = labelQuery.error;
    if (labelError) return NextResponse.json({ error: labelError.message }, { status: 500 });

    const allowedLabelIds = new Set((ownedLabels || []).map((label: any) => label.id));
    const cleanLabelIds = labelIds.filter((id: string) => allowedLabelIds.has(id));

    const { data: patient, error: patientError } = await adminClient
      .from("patients")
      .select("labels")
      .eq("id", patientId)
      .maybeSingle();
    if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 });

    const currentLabels = patient?.labels && typeof patient.labels === "object" && !Array.isArray(patient.labels)
      ? patient.labels
      : {};
    const nextLabels = { ...currentLabels, [viewer.id]: cleanLabelIds };

    const { error: updateError } = await adminClient
      .from("patients")
      .update({ labels: nextLabels })
      .eq("id", patientId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ labels: nextLabels });
  } catch {
    return NextResponse.json({ error: "Unexpected label assignment error." }, { status: 500 });
  }
}
