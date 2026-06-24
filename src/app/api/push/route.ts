import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { isOwnerIdentity } from "@/lib/securityConfig";
import { isNativePushConfigured, sendNativePush, type NativeTokenEntry } from "@/lib/nativePushSender";

const VAPID_EMAIL = process.env.VAPID_EMAIL || "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const vapidConfigured = Boolean(VAPID_EMAIL && VAPID_PUBLIC && VAPID_PRIVATE);

if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const authClient = supabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const supabase = supabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
const NATIVE_PUSH_TOKENS_SETTING_KEY = "native_push_tokens";

const subscriptionEndpoint = (subscription: webpush.PushSubscription | Record<string, any> | null | undefined) =>
  typeof subscription?.endpoint === "string" ? subscription.endpoint : "";

const MAX_TARGET_STAFF_IDS = 100;
const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeUuidList = (value: unknown, excludeId = "") => {
  if (!Array.isArray(value)) return [] as string[];
  const exclude = `${excludeId || ""}`.trim().toLowerCase();
  return Array.from(new Set(
    value
      .map((entry) => `${entry || ""}`.trim().toLowerCase())
      .filter((entry) => entry && entry !== exclude && isUuidLike(entry))
  )).slice(0, MAX_TARGET_STAFF_IDS);
};

const normalizeTargetStaffIds = (value: unknown, excludeId = "") => normalizeUuidList(value, excludeId);
const normalizeStaffMessageIds = (value: unknown) => normalizeUuidList(value);

type NativePushTokenMap = {
  staff?: Record<string, NativeTokenEntry[]>;
  patientRooms?: Record<string, NativeTokenEntry[]>;
};

const parseNativePushTokenMap = (value: unknown): NativePushTokenMap => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as NativePushTokenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeNotificationUrl = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate.slice(0, 240) : "/inbox";
};

const normalizeNotificationTag = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate ? candidate.slice(0, 80) : undefined;
};

const webPushTopic = (value?: string) =>
  value
    ?.replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 32) || undefined;

async function resolveApprovedStaffIds(targetStaffIds: string[]) {
  if (!supabase || targetStaffIds.length === 0) return [] as string[];
  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", targetStaffIds);

  const approved = new Set(
    (data || [])
      .filter((profile: any) => `${profile.role || ""}`.toLowerCase() !== "pending_staff")
      .map((profile: any) => `${profile.id || ""}`.toLowerCase())
  );
  return targetStaffIds.filter((id) => approved.has(id));
}

async function resolveStaffMessageTargetIds(senderId: string, targetStaffIds: string[], staffMessageIds: string[]) {
  if (!supabase || !senderId || targetStaffIds.length === 0 || staffMessageIds.length === 0) return [] as string[];
  const { data, error } = await supabase
    .from("staff_private_messages")
    .select("id, recipient_id")
    .eq("sender_id", senderId)
    .in("id", staffMessageIds);

  if (error) return [] as string[];
  const requestedTargets = new Set(targetStaffIds);
  const messageTargets = Array.from(new Set(
    (data || [])
      .map((message: any) => `${message.recipient_id || ""}`.toLowerCase())
      .filter((recipientId) => requestedTargets.has(recipientId))
  ));
  return resolveApprovedStaffIds(messageTargets);
}

async function getAuthenticatedStaff(req: NextRequest) {
  if (!authClient || !supabase) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, admin_level, role, email, phone, full_name, display_name")
    .eq("id", userId)
    .maybeSingle();

  const role = `${profile?.role || ""}`.toLowerCase();
  if (!profile?.id || role === "pending_staff") return null;
  const rawAdminLevel = `${profile.admin_level || ""}`.toLowerCase();
  const adminLevel = isOwnerIdentity({
    id: profile.id,
    email: authData.user?.email || profile.email,
    phone: profile.phone,
    fullName: profile.full_name,
    displayName: profile.display_name,
    adminLevel: profile.admin_level,
  })
    ? "owner"
    : rawAdminLevel === "owner"
      ? "super_admin"
      : rawAdminLevel;
  return profile.id ? { id: profile.id, adminLevel, role } : null;
}

async function canNotifyPatientRoom(userId: string, adminLevel: string, role: string, roomId: string) {
  if (!supabase) return false;
  if (adminLevel === "owner" || adminLevel === "super_admin" || role === "doctor") return true;

  const { data: membership } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(membership?.id);
}

async function getPatientRoomAccess(body: any) {
  if (!supabase) return null;
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  const roomToken = typeof body?.roomToken === "string" ? body.roomToken.trim() : "";
  if (!roomId || !roomToken) return null;

  const { data: room } = await supabase
    .from("rooms")
    .select("id, patient_access_token")
    .eq("id", roomId)
    .maybeSingle();

  return room?.id && room.patient_access_token === roomToken ? { roomId: room.id } : null;
}

async function storeSubscription(req: NextRequest, body: any) {
  if (!supabase) return NextResponse.json({ error: "Push is not configured on server." }, { status: 503 });
  const userType = body?.userType === "staff" ? "staff" : body?.userType === "patient" ? "patient" : null;
  const roomId = typeof body?.roomId === "string" ? body.roomId : undefined;
  const roomToken = typeof body?.roomToken === "string" ? body.roomToken : "";
  const subscription = body?.subscription;
  const endpoint = subscriptionEndpoint(subscription);

  if (!userType || !endpoint) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  let staff: { id: string; adminLevel: string; role: string } | null = null;
  if (userType === "staff") {
    staff = await getAuthenticatedStaff(req);
    if (!staff) return NextResponse.json({ error: "Missing or invalid staff session." }, { status: 401 });
  }

  if (userType === "patient") {
    if (!roomId || !roomToken) return NextResponse.json({ error: "Missing patient room access." }, { status: 401 });
    const { data: room } = await supabase
      .from("rooms")
      .select("id, patient_access_token")
      .eq("id", roomId)
      .maybeSingle();
    if (!room?.id || room.patient_access_token !== roomToken) {
      return NextResponse.json({ error: "Invalid patient room access." }, { status: 403 });
    }
  }

  let existingQuery = supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_type", userType);

  if (userType === "patient" && roomId) {
    existingQuery = existingQuery.eq("room_id", roomId);
  }

  const { data: existingRows, error: fetchError } = await existingQuery;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const duplicateIds = (existingRows || [])
    .filter((row: any) => subscriptionEndpoint(row.subscription) === endpoint)
    .map((row: any) => row.id)
    .filter(Boolean);

  if (duplicateIds.length > 0) {
    const { error: deleteError } = await supabase.from("push_subscriptions").delete().in("id", duplicateIds);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const nextRow: { user_type: "patient" | "staff"; room_id?: string; subscription: any } = {
    user_type: userType,
    subscription: userType === "staff" && staff?.id ? { ...subscription, portalUserId: staff.id } : subscription,
  };

  if (userType === "patient" && roomId) nextRow.room_id = roomId;

  const { error: insertError } = await supabase.from("push_subscriptions").insert(nextRow);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function removeSubscription(req: NextRequest, body: any) {
  if (!supabase) return NextResponse.json({ error: "Push is not configured on server." }, { status: 503 });
  const userType = body?.userType === "staff" ? "staff" : body?.userType === "patient" ? "patient" : null;
  const subscription = body?.subscription;
  const endpoint = subscriptionEndpoint(subscription);
  if (!userType || !endpoint) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  let roomId = "";
  let staffId = "";
  if (userType === "staff") {
    const staff = await getAuthenticatedStaff(req);
    if (!staff) return NextResponse.json({ error: "Missing or invalid staff session." }, { status: 401 });
    staffId = staff.id;
  } else {
    const patientRoomAccess = await getPatientRoomAccess(body);
    if (!patientRoomAccess) return NextResponse.json({ error: "Invalid patient room access." }, { status: 403 });
    roomId = patientRoomAccess.roomId;
  }

  let query = supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_type", userType);
  if (userType === "patient") query = query.eq("room_id", roomId);

  const { data: existingRows, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const deleteIds = (existingRows || [])
    .filter((row: any) => {
      if (subscriptionEndpoint(row.subscription) !== endpoint) return false;
      if (userType === "staff") return `${row?.subscription?.portalUserId || ""}` === staffId;
      return true;
    })
    .map((row: any) => row.id)
    .filter(Boolean);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase.from("push_subscriptions").delete().in("id", deleteIds);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: deleteIds.length });
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseConfigured || !supabase) {
      return NextResponse.json({ error: "Push is not configured on server." }, { status: 503 });
    }
    const body = await req.json();

    if (body?.action === "subscribe") {
      return await storeSubscription(req, body);
    }

    if (body?.action === "unsubscribe") {
      return await removeSubscription(req, body);
    }

    if (!vapidConfigured) {
      return NextResponse.json({ error: "Push VAPID credentials are not configured." }, { status: 503 });
    }

    const { roomId, title, body: messageBody, url, userType, tag } = body;
    if (userType !== "patient" && userType !== "staff") {
      return NextResponse.json({ error: "Invalid userType." }, { status: 400 });
    }
    if (typeof title !== "string" || typeof messageBody !== "string" || !title.trim() || !messageBody.trim()) {
      return NextResponse.json({ error: "Invalid push message payload." }, { status: 400 });
    }
    if (title.length > 120 || messageBody.length > 300) {
      return NextResponse.json({ error: "Push message is too long." }, { status: 400 });
    }
    if (userType === "patient" && (typeof roomId !== "string" || !roomId.trim())) {
      return NextResponse.json({ error: "roomId is required for patient notifications." }, { status: 400 });
    }

    const staff = await getAuthenticatedStaff(req);
    const patientRoomAccess = !staff && userType === "staff" ? await getPatientRoomAccess(body) : null;
    const requestedTargetStaffIds = staff ? normalizeTargetStaffIds(body?.targetStaffIds, staff.id) : [];
    const requestedStaffMessageIds = staff ? normalizeStaffMessageIds(body?.staffMessageIds) : [];
    let nativeTargetStaffIds: string[] = [];
    const nativeTargetPatientRoomIds = userType === "patient" && typeof roomId === "string" && roomId.trim() ? [roomId.trim()] : [];
    if (!staff && !patientRoomAccess) {
      return NextResponse.json({ error: "Missing or invalid notification sender." }, { status: 401 });
    }

    if (userType === "patient") {
      if (!staff) return NextResponse.json({ error: "Missing or invalid staff session." }, { status: 401 });
      const allowed = await canNotifyPatientRoom(staff.id, staff.adminLevel, staff.role, roomId);
      if (!allowed) return NextResponse.json({ error: "You do not have access to this patient room." }, { status: 403 });
    }
    if (userType === "staff" && staff) {
      if (requestedTargetStaffIds.length === 0 && (typeof roomId !== "string" || !roomId.trim())) {
        return NextResponse.json({ error: "roomId is required for staff room notifications." }, { status: 400 });
      }
      if (requestedTargetStaffIds.length > 0 && requestedStaffMessageIds.length === 0) {
        return NextResponse.json({ error: "staffMessageIds are required for direct staff notifications." }, { status: 400 });
      }
      if (typeof roomId === "string" && roomId.trim()) {
        const allowed = await canNotifyPatientRoom(staff.id, staff.adminLevel, staff.role, roomId.trim());
        if (!allowed) return NextResponse.json({ error: "You do not have access to this patient room." }, { status: 403 });
      }
    }

    // Fetch matching push subscriptions
    let query = supabase.from("push_subscriptions").select("id, subscription");
    if (userType === "patient") {
      query = query.eq("user_type", "patient").eq("room_id", roomId);
    } else {
      query = query.eq("user_type", "staff");
    }

    const { data: rawSubs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let subs = rawSubs || [];
    if (userType === "staff" && requestedTargetStaffIds.length > 0) {
      nativeTargetStaffIds = await resolveStaffMessageTargetIds(staff?.id || "", requestedTargetStaffIds, requestedStaffMessageIds);
      const targetSet = new Set(nativeTargetStaffIds);
      subs = subs.filter((sub: any) => {
        const staffId = `${sub?.subscription?.portalUserId || ""}`.toLowerCase();
        return staffId && targetSet.has(staffId);
      });
    } else if (userType === "staff" && typeof roomId === "string" && roomId.trim()) {
      const { data: members } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId.trim());
      let targetStaffIds = Array.from(new Set((members || []).map((member: any) => `${member.user_id || ""}`).filter(Boolean)));
      if (staff?.id) targetStaffIds = targetStaffIds.filter((id) => id !== staff.id);

      if (body?.audience === "advanced_assigned" && targetStaffIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, admin_level")
          .in("id", targetStaffIds);
        const advancedIds = new Set(
          (profiles || [])
            .filter((profile: any) => ["owner", "super_admin"].includes(`${profile.admin_level || ""}`.toLowerCase()))
            .map((profile: any) => profile.id)
        );
        targetStaffIds = targetStaffIds.filter((id) => advancedIds.has(id));
      }

      const targetSet = new Set(targetStaffIds);
      nativeTargetStaffIds = targetStaffIds;
      subs = subs.filter((sub: any) => {
        const staffId = `${sub?.subscription?.portalUserId || ""}`;
        return staffId && targetSet.has(staffId);
      });
    }
    let nativeTokens: NativeTokenEntry[] = [];
    const nativeConfigured = isNativePushConfigured();
    if (nativeConfigured && (nativeTargetStaffIds.length > 0 || nativeTargetPatientRoomIds.length > 0)) {
      const { data: nativeSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", NATIVE_PUSH_TOKENS_SETTING_KEY)
        .maybeSingle();
      const nativeTokenMap = parseNativePushTokenMap(nativeSetting?.value);
      nativeTokens = [
        ...nativeTargetStaffIds.flatMap((staffId) => nativeTokenMap.staff?.[staffId] || []),
        ...nativeTargetPatientRoomIds.flatMap((targetRoomId) => nativeTokenMap.patientRooms?.[targetRoomId] || []),
      ];
    }

    if ((!subs || subs.length === 0) && nativeTokens.length === 0) {
      return NextResponse.json({ sent: 0, nativeSent: 0, nativeConfigured });
    }

    const notificationUrl = normalizeNotificationUrl(url);
    const notificationTag = normalizeNotificationTag(tag);
    const payload = JSON.stringify({
      title,
      body: messageBody,
      url: notificationUrl,
      tag: notificationTag,
      requireInteraction: body?.requireInteraction !== false,
      renotify: true,
      silent: false,
      urgent: true,
      vibrate: [450, 120, 450, 120, 450],
      timestamp: Date.now(),
    });
    const pushOptions: webpush.RequestOptions = {
      TTL: 60 * 60,
      urgency: "high",
      topic: webPushTopic(notificationTag),
    };
    let sent = 0;
    const toDelete: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload, pushOptions);
        sent++;
      } catch (err: any) {
        // Subscription expired or invalid — clean it up
        if (err.statusCode === 410 || err.statusCode === 404) toDelete.push(sub.id);
      }
    }

    if (toDelete.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", toDelete);
    }

    let nativeResult = { configured: nativeConfigured, attempted: 0, sent: 0 };
    if (nativeTokens.length > 0) {
      try {
        nativeResult = await sendNativePush(nativeTokens, {
          title,
          body: messageBody,
          url: notificationUrl,
          tag: notificationTag,
        });
      } catch (nativeError) {
        console.error("Native push send error:", nativeError);
        nativeResult = { configured: nativeConfigured, attempted: nativeTokens.length, sent: 0 };
      }
    }

    return NextResponse.json({
      sent,
      nativeSent: nativeResult.sent,
      nativeAttempted: nativeResult.attempted,
      nativeConfigured: nativeResult.configured,
    });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  }
}
