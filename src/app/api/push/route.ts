import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pdebkexayomjaougrlhr.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZWJrZXhheW9tamFvdWdybGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTU0MTMsImV4cCI6MjA4NDAzMTQxM30.eCJ98ZX1pnl8fOyZk6IrviaKXHt4ZJXK2mXOtN__ITs"
);

const subscriptionEndpoint = (subscription: webpush.PushSubscription | Record<string, any> | null | undefined) =>
  typeof subscription?.endpoint === "string" ? subscription.endpoint : "";

async function storeSubscription(body: any) {
  const userType = body?.userType === "staff" ? "staff" : body?.userType === "patient" ? "patient" : null;
  const roomId = typeof body?.roomId === "string" ? body.roomId : undefined;
  const subscription = body?.subscription;
  const endpoint = subscriptionEndpoint(subscription);

  if (!userType || !endpoint) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
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
    const body = await req.json();

    if (body?.action === "subscribe") {
      return await storeSubscription(body);
    }

    const { roomId, title, body: messageBody, url, userType } = body;

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
