import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

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

const subscriptionEndpoint = (subscription: webpush.PushSubscription | Record<string, any> | null | undefined) =>
  typeof subscription?.endpoint === "string" ? subscription.endpoint : "";

async function getAuthenticatedStaff(req: NextRequest) {
  if (!authClient || !supabase) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, admin_level")
    .eq("id", userId)
    .maybeSingle();

  return profile?.id ? { id: profile.id, adminLevel: `${profile.admin_level || ""}`.toLowerCase() } : null;
}

async function canNotifyPatientRoom(userId: string, adminLevel: string, roomId: string) {
  if (!supabase) return false;
  if (adminLevel === "owner" || adminLevel === "super_admin") return true;

  const { data: membership } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(membership?.id);
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

  if (userType === "staff") {
    const staff = await getAuthenticatedStaff(req);
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
    subscription,
  };

  if (userType === "patient" && roomId) nextRow.room_id = roomId;

  const { error: insertError } = await supabase.from("push_subscriptions").insert(nextRow);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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

    if (!vapidConfigured) {
      return NextResponse.json({ error: "Push VAPID credentials are not configured." }, { status: 503 });
    }

    const staff = await getAuthenticatedStaff(req);
    if (!staff) return NextResponse.json({ error: "Missing or invalid staff session." }, { status: 401 });

    const { roomId, title, body: messageBody, url, userType } = body;
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
    if (userType === "patient") {
      const allowed = await canNotifyPatientRoom(staff.id, staff.adminLevel, roomId);
      if (!allowed) return NextResponse.json({ error: "You do not have access to this patient room." }, { status: 403 });
    }

    // Fetch matching push subscriptions
    let query = supabase.from("push_subscriptions").select("id, subscription");
    if (userType === "patient") {
      query = query.eq("user_type", "patient").eq("room_id", roomId);
    } else {
      // Notify ALL staff — small team, every staff member should know
      query = query.eq("user_type", "staff");
    }

    const { data: subs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({ title, body: messageBody, url: url || "/inbox" });
    let sent = 0;
    const toDelete: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload);
        sent++;
      } catch (err: any) {
        // Subscription expired or invalid — clean it up
        if (err.statusCode === 410 || err.statusCode === 404) toDelete.push(sub.id);
      }
    }

    if (toDelete.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", toDelete);
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  }
}
