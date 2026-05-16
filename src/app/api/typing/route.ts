import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const authClient = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const cleanName = (value: unknown, fallback: string) => {
  const next = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (next || fallback).slice(0, 90);
};

async function validatePatientRoom(roomId: string, roomToken: string) {
  if (!supabase || !roomId || !roomToken) return false;
  const { data } = await supabase
    .from("rooms")
    .select("id, patient_access_token")
    .eq("id", roomId)
    .maybeSingle();
  return Boolean(data?.id && data.patient_access_token === roomToken);
}

async function validateStaffRoom(req: NextRequest, roomId: string) {
  if (!authClient || !supabase || !roomId) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, admin_level, role, email, phone, full_name, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = `${profile?.role || ""}`.toLowerCase();
  if (!profile?.id || role === "pending_staff") return null;

  const adminLevel = `${profile.admin_level || ""}`.toLowerCase();
  const canAccessAllRooms = isOwnerIdentity({
    id: profile.id,
    email: user.email || profile.email,
    phone: profile.phone || user.phone || `${(user.user_metadata as any)?.phone || ""}`,
    fullName: profile.full_name || `${(user.user_metadata as any)?.full_name || ""}`,
    displayName: profile.display_name,
    adminLevel: profile.admin_level,
  }) || adminLevel === "super_admin" || role === "doctor";

  if (!canAccessAllRooms) {
    const { data: membership } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership?.id) return null;
  }

  return cleanName(profile.full_name || profile.display_name, "Staff");
}

const waitForSubscribed = (channel: ReturnType<NonNullable<typeof supabase>["channel"]>) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("typing channel subscribe timeout")), 4000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
        reject(new Error(`typing channel ${status.toLowerCase()}`));
      }
    });
  });

export async function POST(req: NextRequest) {
  try {
    if (!configured || !supabase) {
      return NextResponse.json({ error: "Typing signals are not configured." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    const senderType = body?.senderType === "staff" ? "staff" : body?.senderType === "patient" ? "patient" : "";
    const isTyping = Boolean(body?.isTyping);
    if (!isUuidLike(roomId) || !senderType) {
      return NextResponse.json({ error: "Invalid typing payload." }, { status: 400 });
    }

    let name = senderType === "staff" ? "Staff" : "Patient";
    if (senderType === "patient") {
      const roomToken = typeof body?.roomToken === "string" ? body.roomToken.trim() : "";
      if (!(await validatePatientRoom(roomId, roomToken))) {
        return NextResponse.json({ error: "Invalid patient room access." }, { status: 403 });
      }
      name = cleanName(body?.name, "Patient");
    } else {
      const staffName = await validateStaffRoom(req, roomId);
      if (!staffName) return NextResponse.json({ error: "Invalid staff room access." }, { status: 403 });
      name = staffName;
    }

    const channel = supabase.channel(`chat-signals:${roomId}`, { config: { broadcast: { self: false } } });
    try {
      await waitForSubscribed(channel);
      const result = await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          roomId,
          senderType,
          name,
          isTyping,
          sentAt: new Date().toISOString(),
        },
      });
      if (result !== "ok") {
        return NextResponse.json({ error: "Typing signal was not delivered." }, { status: 502 });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      return NextResponse.json({ ok: true });
    } finally {
      await supabase.removeChannel(channel).catch(() => {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Typing signal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
