import webpush from "web-push";
import { type SupabaseClient } from "@supabase/supabase-js";
import { isNativePushConfigured, sendNativePush, type NativePushPayload, type NativeTokenEntry } from "@/lib/nativePushSender";

const VAPID_EMAIL = process.env.VAPID_EMAIL || "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const NATIVE_PUSH_TOKENS_SETTING_KEY = "native_push_tokens";

const vapidConfigured = Boolean(VAPID_EMAIL && VAPID_PUBLIC && VAPID_PRIVATE);
if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

type NativePushTokenMap = {
  staff?: Record<string, NativeTokenEntry[]>;
  patientRooms?: Record<string, NativeTokenEntry[]>;
};

type UrgentPayload = NativePushPayload & {
  requireInteraction?: boolean;
};

const subscriptionEndpoint = (subscription: webpush.PushSubscription | Record<string, any> | null | undefined) =>
  typeof subscription?.endpoint === "string" ? subscription.endpoint : "";

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

const cleanText = (value: unknown, fallback: string, maxLength: number) => {
  const clean = `${value || ""}`.trim();
  return (clean || fallback).slice(0, maxLength);
};

async function loadNativeTokenMap(supabase: SupabaseClient) {
  if (!isNativePushConfigured()) return {};
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", NATIVE_PUSH_TOKENS_SETTING_KEY)
    .maybeSingle();
  return parseNativePushTokenMap(data?.value);
}

async function sendWebPushToSubscriptions(supabase: SupabaseClient, subscriptions: any[], payload: UrgentPayload) {
  if (!vapidConfigured || subscriptions.length === 0) return { sent: 0, attempted: 0 };

  const notificationUrl = normalizeNotificationUrl(payload.url);
  const notificationTag = normalizeNotificationTag(payload.tag);
  const body = JSON.stringify({
    title: cleanText(payload.title, "Dr. Fonseca Portal", 120),
    body: cleanText(payload.body, "Nuevo mensaje del portal", 300),
    url: notificationUrl,
    tag: notificationTag,
    requireInteraction: payload.requireInteraction !== false,
    renotify: true,
    silent: false,
    urgent: true,
    vibrate: [650, 160, 650, 160, 650, 160, 650],
    timestamp: Date.now(),
  });
  const pushOptions: webpush.RequestOptions = {
    TTL: 60 * 60,
    urgency: "high",
    topic: webPushTopic(notificationTag),
  };
  const toDelete: string[] = [];
  let sent = 0;

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, body, pushOptions);
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 410 || error?.statusCode === 404) toDelete.push(row.id);
    }
  }

  if (toDelete.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", toDelete);
  }

  return { sent, attempted: subscriptions.length };
}

async function approvedStaffIds(supabase: SupabaseClient, staffIds: string[], excludeStaffId = "") {
  const uniqueIds = Array.from(new Set(staffIds.map((id) => `${id || ""}`.trim()).filter(Boolean)));
  const exclude = `${excludeStaffId || ""}`.trim();
  const targetIds = exclude ? uniqueIds.filter((id) => id !== exclude) : uniqueIds;
  if (targetIds.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", targetIds);

  return (data || [])
    .filter((profile: any) => `${profile.role || ""}`.toLowerCase() !== "pending_staff")
    .map((profile: any) => `${profile.id || ""}`)
    .filter(Boolean);
}

export async function sendUrgentStaffNotification(
  supabase: SupabaseClient,
  staffIds: string[],
  payload: UrgentPayload,
  options: { excludeStaffId?: string } = {},
) {
  const targetStaffIds = await approvedStaffIds(supabase, staffIds, options.excludeStaffId);
  if (targetStaffIds.length === 0) return { webSent: 0, nativeSent: 0, nativeAttempted: 0 };

  const { data: webRows } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_type", "staff");
  const targetSet = new Set(targetStaffIds);
  const webSubscriptions = (webRows || []).filter((row: any) => {
    const staffId = `${row?.subscription?.portalUserId || ""}`;
    return staffId && targetSet.has(staffId) && subscriptionEndpoint(row.subscription);
  });

  const nativeTokenMap = await loadNativeTokenMap(supabase);
  const nativeTokens = targetStaffIds.flatMap((staffId) => nativeTokenMap.staff?.[staffId] || []);
  const [webResult, nativeResult] = await Promise.all([
    sendWebPushToSubscriptions(supabase, webSubscriptions, payload),
    nativeTokens.length > 0
      ? sendNativePush(nativeTokens, { ...payload, url: normalizeNotificationUrl(payload.url), urgency: payload.urgency || "urgent" })
      : Promise.resolve({ configured: isNativePushConfigured(), attempted: 0, sent: 0 }),
  ]);

  return {
    webSent: webResult.sent,
    webAttempted: webResult.attempted,
    nativeSent: nativeResult.sent,
    nativeAttempted: nativeResult.attempted,
    nativeConfigured: nativeResult.configured,
  };
}

export async function sendPatientRoomNotification(
  supabase: SupabaseClient,
  roomIds: string[],
  payload: UrgentPayload,
) {
  const targetRoomIds = Array.from(new Set(roomIds.map((id) => `${id || ""}`.trim()).filter(Boolean)));
  if (targetRoomIds.length === 0) return { webSent: 0, nativeSent: 0, nativeAttempted: 0 };

  const { data: webRows } = await supabase
    .from("push_subscriptions")
    .select("id, room_id, subscription")
    .eq("user_type", "patient")
    .in("room_id", targetRoomIds);
  const webSubscriptions = (webRows || []).filter((row: any) => subscriptionEndpoint(row.subscription));

  const nativeTokenMap = await loadNativeTokenMap(supabase);
  const nativeTokens = targetRoomIds.flatMap((roomId) => nativeTokenMap.patientRooms?.[roomId] || []);
  const [webResult, nativeResult] = await Promise.all([
    sendWebPushToSubscriptions(supabase, webSubscriptions, payload),
    nativeTokens.length > 0
      ? sendNativePush(nativeTokens, { ...payload, url: normalizeNotificationUrl(payload.url), urgency: payload.urgency || "urgent" })
      : Promise.resolve({ configured: isNativePushConfigured(), attempted: 0, sent: 0 }),
  ]);

  return {
    webSent: webResult.sent,
    webAttempted: webResult.attempted,
    nativeSent: nativeResult.sent,
    nativeAttempted: nativeResult.attempted,
    nativeConfigured: nativeResult.configured,
  };
}

export async function sendPatientMessageStaffAlert(
  supabase: SupabaseClient,
  params: {
    roomId: string;
    title: string;
    body: string;
    tag?: string;
    audience?: "advanced_assigned";
  },
) {
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", params.roomId);
  let staffIds = Array.from(new Set((members || []).map((member: any) => `${member.user_id || ""}`).filter(Boolean)));

  if (params.audience === "advanced_assigned" && staffIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, admin_level")
      .in("id", staffIds);
    const advancedIds = new Set(
      (profiles || [])
        .filter((profile: any) => ["owner", "super_admin"].includes(`${profile.admin_level || ""}`.toLowerCase()))
        .map((profile: any) => `${profile.id || ""}`)
    );
    staffIds = staffIds.filter((id) => advancedIds.has(id));
  }

  return sendUrgentStaffNotification(supabase, staffIds, {
    title: cleanText(params.title, "Paciente", 120),
    body: cleanText(params.body, "Nuevo mensaje de paciente", 300),
    url: "/inbox",
    tag: params.tag || params.roomId,
    urgency: "urgent",
  });
}
