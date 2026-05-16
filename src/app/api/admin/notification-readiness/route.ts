import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";
import {
  STAFF_PERMISSIONS_SETTING_KEY,
  hasPermission,
  parseStaffPermissionMap,
} from "@/lib/permissions";
import {
  STAFF_ALERT_TONES_SETTING_KEY,
  parseStaffAlertToneMap,
} from "@/lib/alertToneSettings";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const authClient = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const adminClient = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const subscriptionStaffId = (subscription: unknown) => {
  const value = subscription as Record<string, unknown> | null | undefined;
  return `${value?.portalUserId || ""}`.trim();
};

const newestIso = (rows: Array<Record<string, unknown>>) =>
  rows
    .map((row) => `${row.updated_at || row.created_at || ""}`)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;

export async function GET(request: NextRequest) {
  try {
    if (!configured || !authClient || !adminClient) {
      return NextResponse.json({ error: "Notification readiness is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing admin session." }, { status: 401 });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const requester = authData?.user;
    if (authError || !requester?.id) return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });

    const [{ data: requesterProfile }, { data: permissionSetting }] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", requester.id).maybeSingle(),
      adminClient.from("app_settings").select("value").eq("key", STAFF_PERMISSIONS_SETTING_KEY).maybeSingle(),
    ]);
    const permissionMap = parseStaffPermissionMap(permissionSetting?.value);
    const requesterEmail = `${requester.email || ""}`.trim().toLowerCase();
    const requesterMetadata = (requester.user_metadata || {}) as Record<string, unknown>;
    const permissionProfile = requesterProfile
      ? { ...(requesterProfile as any), permissions: permissionMap[requester.id] ?? (requesterProfile as any).permissions }
      : null;
    const requesterIsOwner = isOwnerIdentity({
      id: requester.id,
      email: requesterEmail,
      phone: `${(requesterProfile as any)?.phone || requester.phone || requesterMetadata.phone || ""}`,
      fullName: (requesterProfile as any)?.full_name || `${requesterMetadata.full_name || ""}`,
      displayName: (requesterProfile as any)?.display_name || "",
      adminLevel: `${(requesterProfile as any)?.admin_level || ""}`,
    });
    if (!requesterIsOwner && !hasPermission(permissionProfile, requesterEmail, "access_settings_security")) {
      return NextResponse.json({ error: "Not allowed to review alert readiness." }, { status: 403 });
    }

    const [{ data: staffRows, error: staffError }, { data: roomRows, error: roomError }, { data: subscriptionRows, error: subscriptionError }, { data: alertToneSetting }] = await Promise.all([
      adminClient.from("profiles").select("id, full_name, display_name, email, role, admin_level").order("full_name"),
      adminClient
        .from("rooms")
        .select("id, procedure_id, procedures(id, procedure_name, patients(id, full_name, record_status))")
        .order("created_at", { ascending: false })
        .limit(1000),
      adminClient.from("push_subscriptions").select("*").limit(3000),
      adminClient.from("app_settings").select("value").eq("key", STAFF_ALERT_TONES_SETTING_KEY).maybeSingle(),
    ]);

    if (staffError) return NextResponse.json({ error: staffError.message || "Could not load staff." }, { status: 500 });
    if (roomError) return NextResponse.json({ error: roomError.message || "Could not load patient rooms." }, { status: 500 });
    if (subscriptionError) return NextResponse.json({ error: subscriptionError.message || "Could not load push subscriptions." }, { status: 500 });

    const subscriptions = (subscriptionRows || []) as Array<Record<string, unknown>>;
    const alertToneMap = parseStaffAlertToneMap(alertToneSetting?.value);
    const staffSubscriptions = subscriptions.filter((row) => row.user_type === "staff");
    const patientSubscriptions = subscriptions.filter((row) => row.user_type === "patient");
    const staffSubMap = new Map<string, Array<Record<string, unknown>>>();
    staffSubscriptions.forEach((row) => {
      const staffId = subscriptionStaffId(row.subscription);
      if (!staffId) return;
      staffSubMap.set(staffId, [...(staffSubMap.get(staffId) || []), row]);
    });
    const patientSubMap = new Map<string, Array<Record<string, unknown>>>();
    patientSubscriptions.forEach((row) => {
      const roomId = `${row.room_id || ""}`.trim();
      if (!roomId) return;
      patientSubMap.set(roomId, [...(patientSubMap.get(roomId) || []), row]);
    });

    const staff = ((staffRows || []) as Array<Record<string, unknown>>)
      .filter((member) => `${member.role || ""}`.toLowerCase() !== "pending_staff")
      .map((member) => {
        const memberSubscriptions = staffSubMap.get(`${member.id || ""}`) || [];
        return {
          id: member.id,
          name: member.full_name || member.display_name || member.email || "Staff",
          role: member.role || null,
          adminLevel: member.admin_level || null,
          pushDevices: memberSubscriptions.length,
          latestSubscriptionAt: newestIso(memberSubscriptions),
          alertTone: alertToneMap[`${member.id || ""}`] || null,
        };
      });

    const patientRooms = ((roomRows || []) as Array<Record<string, unknown>>).map((room) => {
      const procedure = Array.isArray((room as any).procedures) ? (room as any).procedures[0] : (room as any).procedures;
      const patient = Array.isArray(procedure?.patients) ? procedure.patients[0] : procedure?.patients;
      const roomSubscriptions = patientSubMap.get(`${room.id || ""}`) || [];
      return {
        roomId: room.id,
        patientId: patient?.id || null,
        patientName: patient?.full_name || "Patient",
        procedureName: procedure?.procedure_name || null,
        recordStatus: patient?.record_status || null,
        pushDevices: roomSubscriptions.length,
        latestSubscriptionAt: newestIso(roomSubscriptions),
      };
    });

    const staffReady = staff.filter((member) => member.pushDevices > 0).length;
    const activePatientRooms = patientRooms.filter((room) => `${room.recordStatus || "active"}`.toLowerCase() === "active");
    const patientReady = activePatientRooms.filter((room) => room.pushDevices > 0).length;

    return NextResponse.json({
      staff,
      patientRooms: activePatientRooms,
      totals: {
        staffReady,
        staffTotal: staff.length,
        patientRoomsReady: patientReady,
        patientRoomsTotal: activePatientRooms.length,
        staffPushDevices: staffSubscriptions.length,
        patientPushDevices: patientSubscriptions.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not load alert readiness." }, { status: 500 });
  }
}
