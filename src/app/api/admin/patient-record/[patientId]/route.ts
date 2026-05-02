import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key");
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");

const isAdminLevel = (value?: string | null) => {
  const level = `${value || ""}`.toLowerCase();
  return level === "owner" || level === "super_admin";
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
    if (!isOwnerEmail(viewerEmail) && !isAdminLevel(viewerProfile.admin_level)) {
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
    const { data: messages, error: messagesError } = roomIds.length
      ? await adminClient.from("messages").select("*").in("room_id", roomIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

    const senderIds = [...new Set((messages || []).map((message: any) => message.sender_id).filter(Boolean))];
    const { data: staffProfiles, error: staffError } = senderIds.length
      ? await adminClient.from("profiles").select("*").in("id", senderIds)
      : { data: [], error: null };
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

    return NextResponse.json({
      patient,
      procedures: procedures || [],
      rooms: rooms || [],
      messages: messages || [],
      staffProfiles: staffProfiles || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected admin record error." }, { status: 500 });
  }
}
