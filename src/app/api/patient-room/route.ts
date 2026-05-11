import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAT_FILES_BUCKET, patientMediaUrl } from "@/lib/chatFileUrls";

export const dynamic = "force-dynamic";

type PatientRoomBody = {
  action?: string;
  roomId?: string;
  roomToken?: string;
  content?: string;
  phone?: string;
  messageId?: string;
  existingMessageId?: string;
  fileName?: string;
  fileType?: string;
  messageType?: "text" | "image" | "video" | "audio" | "file";
  path?: string;
  values?: unknown;
};

type RoomAccess = {
  id: string;
  patient_access_token?: string | null;
  procedures?: {
    office_location?: string | null;
    status?: string | null;
    patients?: {
      id?: string | null;
      full_name?: string | null;
      phone?: string | null;
      preferred_language?: string | null;
      record_status?: string | null;
    } | null;
  } | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_TEXT_CHARS = 12000;
const MAX_FORM_CHARS = 50000;
const MAX_VALUES_CHARS = 50000;

let adminClient: SupabaseClient | null = null;

const getAdminClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
};

const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });

const safeTokenEquals = (expected?: string | null, provided?: string | null) => {
  const left = `${expected || ""}`.trim();
  const right = `${provided || ""}`.trim();
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const isSchemaColumnError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const message = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache") || message.includes("relation");
};

const normalizeProcedure = (room: RoomAccess | null) => {
  const procedure = room?.procedures;
  return Array.isArray(procedure) ? procedure[0] : procedure;
};

const normalizePatient = (room: RoomAccess | null) => {
  const procedure = normalizeProcedure(room);
  const patient = procedure?.patients;
  return Array.isArray(patient) ? patient[0] : patient;
};

const isRoomClosed = (room: RoomAccess | null) => {
  const procedure = normalizeProcedure(room);
  const patient = normalizePatient(room);
  const patientStatus = `${patient?.record_status || "active"}`.toLowerCase();
  const procedureStatus = `${procedure?.status || ""}`.toLowerCase();
  return patientStatus !== "active" || procedureStatus === "cancelled";
};

const publicRoom = (room: RoomAccess) => ({
  id: room.id,
  procedures: room.procedures,
});

const normalizePatientPhone = (value?: string | null) => {
  const raw = `${value || ""}`.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const leadingPlus = raw.trim().startsWith("+") ? "+" : "";
  return `${leadingPlus}${digits}`.slice(0, 24);
};

const hashMessage = (content: string, createdAt: string, senderId: string | null) =>
  createHash("sha256").update(`${content}${createdAt}${senderId || ""}`).digest("hex");

const safeStorageSegment = (value: string) => {
  const clean = value.trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140);
  return clean || "upload.bin";
};

const normalizeMessageType = (fileType?: string, requested?: PatientRoomBody["messageType"]) => {
  if (requested === "image" || requested === "video" || requested === "audio" || requested === "file") return requested;
  const type = `${fileType || ""}`.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
};

const assertPatientPath = (roomId: string, path?: string) => {
  const cleanPath = `${path || ""}`.trim();
  const expectedPrefix = `patients/${roomId}/`;
  if (!cleanPath || cleanPath.includes("..") || !cleanPath.startsWith(expectedPrefix)) return "";
  return cleanPath;
};

async function getPatientRoom(client: SupabaseClient, roomId: string, roomToken: string) {
  if (!roomId || !roomToken) return null;

  let roomQuery = await client
    .from("rooms")
    .select("id, patient_access_token, procedures(office_location, status, patients(id, full_name, phone, preferred_language, record_status))")
    .eq("id", roomId)
    .maybeSingle();

  if (roomQuery.error && isSchemaColumnError(roomQuery.error)) {
    roomQuery = await client
      .from("rooms")
      .select("id, patient_access_token, procedures(office_location)")
      .eq("id", roomId)
      .maybeSingle();
  }

  const room = roomQuery.data as RoomAccess | null;
  if (roomQuery.error || !room?.id || !safeTokenEquals(room.patient_access_token, roomToken)) return null;
  return room;
}

async function getMessages(client: SupabaseClient, roomId: string) {
  const { data, error } = await client
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .or("is_internal.is.false,is_internal.is.null")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

const rewritePatientMessageMedia = (message: any, roomId: string, roomToken: string) => {
  const messageType = `${message?.message_type || ""}`;
  if (!["image", "video", "audio", "file"].includes(messageType)) return message;
  const content = typeof message.content === "string" ? patientMediaUrl(message.content, roomId, roomToken) : message.content;
  const fileUrl = typeof message.file_url === "string" ? patientMediaUrl(message.file_url, roomId, roomToken) : message.file_url;
  return { ...message, content, file_url: fileUrl };
};

const rewritePatientMessages = (messages: any[], roomId: string, roomToken: string) =>
  messages.map((message) => rewritePatientMessageMedia(message, roomId, roomToken));

async function insertMessage(client: SupabaseClient, payload: Record<string, unknown>) {
  let insert = await client.from("messages").insert(payload).select("*").single();
  if (insert.error && isSchemaColumnError(insert.error)) {
    const {
      type: _type,
      file_type: _fileType,
      file_url: _fileUrl,
      message_hash: _messageHash,
      ...compatiblePayload
    } = payload;
    insert = await client.from("messages").insert(compatiblePayload).select("*").single();
  }
  if (insert.error) throw insert.error;
  return insert.data;
}

async function updateMessage(client: SupabaseClient, messageId: string, roomId: string, payload: Record<string, unknown>) {
  let update = await client
    .from("messages")
    .update(payload)
    .eq("id", messageId)
    .eq("room_id", roomId)
    .eq("sender_type", "patient")
    .select("*")
    .single();

  if (update.error && isSchemaColumnError(update.error)) {
    const {
      type: _type,
      file_type: _fileType,
      file_url: _fileUrl,
      message_hash: _messageHash,
      ...compatiblePayload
    } = payload;
    update = await client
      .from("messages")
      .update(compatiblePayload)
      .eq("id", messageId)
      .eq("room_id", roomId)
      .eq("sender_type", "patient")
      .select("*")
      .single();
  }

  if (update.error) throw update.error;
  return update.data;
}

async function logMessageAudit(client: SupabaseClient, roomId: string, timestamp: string) {
  const { error } = await client.from("audit_logs").insert({
    user_id: null,
    action: "message_sent",
    timestamp,
    room_id: roomId,
  });
  if (error) console.warn("patient-room audit log failed", error.message);
}

async function logAdminAuditBestEffort(client: SupabaseClient, payload: Record<string, unknown>) {
  const { error } = await client.from("admin_audit_events").insert(payload);
  if (error && !isSchemaColumnError(error)) console.warn("patient-room admin audit failed", error.message);
}

async function loadClinicalPdfValues(client: SupabaseClient, roomId: string) {
  const path = `patients/${roomId}/historia-clinica-values.json`;
  const { data } = await client.storage.from(CHAT_FILES_BUCKET).download(path);
  if (!data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const client = getAdminClient();
    if (!client) return jsonError("Patient room service is not configured.", 503);

    const { searchParams } = new URL(req.url);
    const roomId = `${searchParams.get("roomId") || ""}`.trim();
    const roomToken = `${searchParams.get("roomToken") || ""}`.trim();
    const resource = `${searchParams.get("resource") || ""}`.trim();
    const room = await getPatientRoom(client, roomId, roomToken);
    if (!room) return jsonError("Patient room access denied.", 403);

    if (resource === "clinicalPdfValues") {
      return NextResponse.json({ values: await loadClinicalPdfValues(client, room.id) });
    }

    return NextResponse.json({
      room: publicRoom(room),
      roomClosed: isRoomClosed(room),
      messages: rewritePatientMessages(await getMessages(client, room.id), room.id, roomToken),
    });
  } catch (error) {
    console.error("patient-room GET failed", error);
    return jsonError("Could not load patient room.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getAdminClient();
    if (!client) return jsonError("Patient room service is not configured.", 503);

    const body = (await req.json()) as PatientRoomBody;
    const roomId = `${body?.roomId || ""}`.trim();
    const roomToken = `${body?.roomToken || ""}`.trim();
    const room = await getPatientRoom(client, roomId, roomToken);
    if (!room) return jsonError("Patient room access denied.", 403);

    const action = `${body?.action || ""}`.trim();
    const closed = isRoomClosed(room);
    const writeAction = action !== "";
    if (closed && writeAction) return jsonError("This patient room is closed.", 423);

    if (action === "updatePatientPhone") {
      const patient = normalizePatient(room);
      const patientId = `${patient?.id || ""}`.trim();
      const phone = normalizePatientPhone(body?.phone);
      if (!patientId) return jsonError("Patient record not found.", 404);
      if (phone.replace(/\D/g, "").length < 7) return jsonError("Enter a valid phone number.", 400);

      const previousPhone = normalizePatientPhone(patient?.phone);
      if (previousPhone === phone) {
        return NextResponse.json({ ok: true, phone, unchanged: true });
      }

      const { data: updatedPatient, error: updateError } = await client
        .from("patients")
        .update({ phone })
        .eq("id", patientId)
        .select("id, full_name, phone")
        .maybeSingle();
      if (updateError) throw updateError;

      const patientLang = `${patient?.preferred_language || ""}`.toLowerCase().startsWith("en") ? "en" : "es";
      const createdAt = new Date().toISOString();
      const content = patientLang === "en"
        ? `Patient updated contact phone: ${phone}`
        : `Paciente actualizó su teléfono de contacto: ${phone}`;
      const message = await insertMessage(client, {
        room_id: room.id,
        content,
        sender_id: null,
        sender_type: "patient",
        message_type: "text",
        created_at: createdAt,
        message_hash: hashMessage(content, createdAt, null),
      });
      await logMessageAudit(client, room.id, createdAt);
      await logAdminAuditBestEffort(client, {
        action: "patient_phone_self_updated",
        entity_type: "patient",
        entity_id: patientId,
        entity_name: updatedPatient?.full_name || patient?.full_name || "Patient",
        patient_id: patientId,
        actor_id: null,
        actor_name: "Patient",
        actor_email: null,
        notes: `Patient self-updated contact phone to ${phone}.`,
        metadata: { room_id: room.id, previous_phone: previousPhone || null, next_phone: phone, updated_at: createdAt },
      });

      return NextResponse.json({
        ok: true,
        phone: updatedPatient?.phone || phone,
        message: rewritePatientMessageMedia(message, room.id, roomToken),
      });
    }

    if (action === "sendText") {
      const content = `${body?.content || ""}`.trim().slice(0, MAX_TEXT_CHARS);
      if (!content) return jsonError("Message is required.", 400);
      const createdAt = new Date().toISOString();
      const message = await insertMessage(client, {
        room_id: room.id,
        content,
        sender_id: null,
        sender_type: "patient",
        message_type: "text",
        created_at: createdAt,
        message_hash: hashMessage(content, createdAt, null),
      });
      await logMessageAudit(client, room.id, createdAt);
      return NextResponse.json({ message });
    }

    if (action === "saveClinicalForm") {
      const content = `${body?.content || ""}`.slice(0, MAX_FORM_CHARS);
      if (!content.trim()) return jsonError("Form content is required.", 400);
      const existingMessageId = `${body?.existingMessageId || ""}`.trim();

      if (existingMessageId) {
        const message = await updateMessage(client, existingMessageId, room.id, { content });
        return NextResponse.json({ message });
      }

      const createdAt = new Date().toISOString();
      const message = await insertMessage(client, {
        room_id: room.id,
        content,
        sender_id: null,
        sender_type: "patient",
        message_type: "text",
        created_at: createdAt,
      });
      return NextResponse.json({ message });
    }

    if (action === "deleteMessage") {
      const messageId = `${body?.messageId || ""}`.trim();
      if (!messageId) return jsonError("Message is required.", 400);
      const deletedAt = new Date().toISOString();
      const { error } = await client
        .from("messages")
        .update({ deleted_by_patient: true, deleted_at: deletedAt })
        .eq("id", messageId)
        .eq("room_id", room.id)
        .eq("sender_type", "patient");
      if (error) throw error;
      return NextResponse.json({ ok: true, deletedAt });
    }

    if (action === "updateMessage") {
      const messageId = `${body?.messageId || ""}`.trim();
      const content = `${body?.content || ""}`.trim().slice(0, MAX_TEXT_CHARS);
      if (!messageId || !content) return jsonError("Message is required.", 400);
      const message = await updateMessage(client, messageId, room.id, { content });
      return NextResponse.json({ message });
    }

    if (action === "createUpload") {
      const fileName = safeStorageSegment(`${body?.fileName || "upload.bin"}`);
      const path = `patients/${room.id}/${Date.now()}-${fileName}`;
      const { data, error } = await client.storage.from(CHAT_FILES_BUCKET).createSignedUploadUrl(path);
      if (error || !data?.token) throw error || new Error("Missing signed upload token");
      return NextResponse.json({ path: data.path || path, token: data.token });
    }

    if (action === "attachUpload") {
      const path = assertPatientPath(room.id, body?.path);
      if (!path) return jsonError("Invalid file path.", 400);
      const fileType = `${body?.fileType || "application/octet-stream"}`.trim() || "application/octet-stream";
      const messageType = normalizeMessageType(fileType, body?.messageType);
      const fileName = `${body?.fileName || ""}`.trim() || path.split("/").pop() || "Download file";
      const timestamp = new Date().toISOString();
      const { data: publicUrlData } = client.storage.from(CHAT_FILES_BUCKET).getPublicUrl(path);
      const url = publicUrlData.publicUrl;
      const payload = {
        room_id: room.id,
        sender_id: null,
        sender_type: "patient",
        type: messageType,
        message_type: messageType,
        content: url,
        file_url: url,
        file_name: fileName,
        file_type: fileType,
        created_at: timestamp,
        message_hash: hashMessage(url, timestamp, null),
      };
      const existingMessageId = `${body?.existingMessageId || ""}`.trim();
      const message = existingMessageId
        ? await updateMessage(client, existingMessageId, room.id, payload)
        : await insertMessage(client, payload);
      await logMessageAudit(client, room.id, timestamp);
      const rewrittenMessage = rewritePatientMessageMedia(message, room.id, roomToken);
      return NextResponse.json({ message: rewrittenMessage, url: rewrittenMessage.file_url || rewrittenMessage.content || url });
    }

    if (action === "saveClinicalPdfValues") {
      const bodyText = JSON.stringify(body?.values || {});
      if (bodyText.length > MAX_VALUES_CHARS) return jsonError("Saved form values are too large.", 400);
      const path = `patients/${room.id}/historia-clinica-values.json`;
      const { error } = await client.storage.from(CHAT_FILES_BUCKET).upload(path, new Blob([bodyText], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return jsonError("Unknown patient room action.", 400);
  } catch (error) {
    console.error("patient-room POST failed", error);
    return jsonError("Could not update patient room.", 500);
  }
}
