import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const adminClient = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

const isSchemaError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const text = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("relation") || text.includes("column");
};

async function fallbackStaffIds(roomId: string) {
  if (!adminClient) return [];

  const { data: members } = await adminClient
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const roomStaffIds = (members || []).map((member: any) => `${member.user_id || ""}`).filter(Boolean);
  if (roomStaffIds.length) return Array.from(new Set(roomStaffIds));

  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, role, admin_level");
  return Array.from(new Set((profiles || [])
    .filter((profile: any) => {
      const role = `${profile.role || ""}`.toLowerCase();
      const adminLevel = `${profile.admin_level || ""}`.toLowerCase();
      return role === "doctor" || ["owner", "super_admin", "admin"].includes(adminLevel);
    })
    .map((profile: any) => `${profile.id || ""}`)
    .filter(Boolean)));
}

async function insertNotifications(params: { roomId: string; patientId: string; patientName: string; createdAt: string }) {
  if (!adminClient) return false;
  const staffIds = await fallbackStaffIds(params.roomId);
  if (!staffIds.length) return false;

  const message = `🚨 ${params.patientName || "Paciente"} necesita ayuda`;
  const rows = staffIds.map((staffId) => ({
    type: "alert",
    media_type: "alert",
    chat_id: params.roomId,
    room_id: params.roomId,
    patient_id: params.patientId,
    staff_id: staffId,
    recipient_id: staffId,
    message,
    seen: false,
    status: "unread",
    created_at: params.createdAt,
  }));

  let insert = await adminClient.from("media_notifications").insert(rows);
  if (insert.error && isSchemaError(insert.error)) {
    const compatibleRows = rows.map(({ type: _type, chat_id: _chatId, recipient_id: _recipientId, ...row }) => row);
    insert = await adminClient.from("media_notifications").insert(compatibleRows);
  }

  return !insert.error;
}

export async function POST(request: NextRequest) {
  try {
    if (!configured || !adminClient) {
      return NextResponse.json({ error: "Alerts are not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const roomId = `${body?.roomId || ""}`.trim();
    const token = `${body?.token || ""}`.trim();
    if (!roomId) return NextResponse.json({ error: "Room is required." }, { status: 400 });

    let roomQuery = await adminClient
      .from("rooms")
      .select("id, patient_access_token, procedures(patients(id, full_name))")
      .eq("id", roomId)
      .maybeSingle();
    if (roomQuery.error && isSchemaError(roomQuery.error)) {
      roomQuery = await adminClient
        .from("rooms")
        .select("id, procedures(patients(id, full_name))")
        .eq("id", roomId)
        .maybeSingle();
    }
    const { data: room, error: roomError } = roomQuery;
    if (roomError || !room?.id) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    if ((room as any).patient_access_token && (room as any).patient_access_token !== token) {
      return NextResponse.json({ error: "Invalid room access." }, { status: 403 });
    }

    const patient = Array.isArray((room as any).procedures?.patients)
      ? (room as any).procedures.patients[0]
      : (room as any).procedures?.patients;
    const patientId = `${patient?.id || ""}`;
    if (!patientId) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

    const createdAt = new Date().toISOString();
    const alertInsert = await adminClient.from("patient_alerts").insert({
      patient_id: patientId,
      chat_id: roomId,
      status: "pending",
      escalation_level: 1,
      created_at: createdAt,
    });
    const alertStored = !alertInsert.error;
    if (alertInsert.error && !isSchemaError(alertInsert.error)) {
      return NextResponse.json({ error: alertInsert.error.message }, { status: 500 });
    }

    const notificationStored = await insertNotifications({
      roomId,
      patientId,
      patientName: patient?.full_name || "Paciente",
      createdAt,
    });

    if (!alertStored && !notificationStored) {
      return NextResponse.json({ error: "Alert could not be sent." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, alertStored, notificationStored });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected alert error." }, { status: 500 });
  }
}
