import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendUrgentStaffNotification } from "@/lib/urgentNotifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_STAFF_RECIPIENTS = 100;
const MAX_STAFF_MESSAGE_CHARS = 50000;

let authClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

type StaffRecipient = {
  id: string;
  name?: string | null;
};

const configured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const getAuthClient = () => {
  if (!configured()) return null;
  if (!authClient) authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return authClient;
};

const getAdminClient = () => {
  if (!configured()) return null;
  if (!adminClient) adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
};

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const cleanText = (value: unknown, maxLength: number) => `${value || ""}`.trim().slice(0, maxLength);

const normalizeNotificationUrl = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate.slice(0, 240) : "/inbox";
};

const normalizeNotificationTag = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate ? candidate.slice(0, 80) : undefined;
};

const recipientDisplayName = (profile: any, fallback?: string | null) =>
  `${fallback || profile?.full_name || profile?.display_name || ""}`.trim() || null;

const normalizeRecipients = (value: unknown, senderId: string) => {
  if (!Array.isArray(value)) return [] as StaffRecipient[];
  const seen = new Set<string>();
  const recipients: StaffRecipient[] = [];

  for (const item of value) {
    const rawId = typeof item === "string" ? item : `${item?.id || ""}`;
    const id = rawId.trim().toLowerCase();
    if (!id || id === senderId || !isUuidLike(id) || seen.has(id)) continue;
    seen.add(id);
    recipients.push({
      id,
      name: typeof item === "object" && item ? cleanText(item?.name, 160) || null : null,
    });
    if (recipients.length >= MAX_STAFF_RECIPIENTS) break;
  }

  return recipients;
};

async function getAuthenticatedStaff(request: NextRequest, auth: SupabaseClient, admin: SupabaseClient) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: authData, error: authError } = await auth.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, full_name, display_name")
    .eq("id", userId)
    .maybeSingle();
  const role = `${profile?.role || ""}`.toLowerCase();
  if (!profile?.id || role === "pending_staff") return null;

  return {
    id: `${profile.id}`,
    name: `${profile.full_name || profile.display_name || "Staff"}`.trim() || "Staff",
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthClient();
    const admin = getAdminClient();
    if (!auth || !admin) {
      return NextResponse.json({ error: "Staff messaging is not configured." }, { status: 503 });
    }

    const sender = await getAuthenticatedStaff(request, auth, admin);
    if (!sender) return NextResponse.json({ error: "Missing or invalid staff session." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const content = cleanText(body?.content, MAX_STAFF_MESSAGE_CHARS);
    if (!content) return NextResponse.json({ error: "Message content is required." }, { status: 400 });

    const requestedRecipients = normalizeRecipients(body?.recipients, sender.id);
    if (requestedRecipients.length === 0) {
      return NextResponse.json({ error: "At least one staff recipient is required." }, { status: 400 });
    }

    const requestedNameById = new Map(requestedRecipients.map((recipient) => [recipient.id, recipient.name || null]));
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, role, full_name, display_name")
      .in("id", requestedRecipients.map((recipient) => recipient.id));
    if (profileError) return NextResponse.json({ error: profileError.message || "Could not load staff recipients." }, { status: 500 });

    const approvedRecipients = (profiles || [])
      .filter((profile: any) => profile?.id && `${profile.role || ""}`.toLowerCase() !== "pending_staff")
      .map((profile: any) => ({
        id: `${profile.id}`,
        name: recipientDisplayName(profile, requestedNameById.get(`${profile.id}`)),
      }));

    if (approvedRecipients.length === 0) {
      return NextResponse.json({ error: "No approved staff recipients were found." }, { status: 403 });
    }

    const createdAt = new Date().toISOString();
    const rows = approvedRecipients.map((recipient) => ({
      sender_id: sender.id,
      recipient_id: recipient.id,
      sender_name: sender.name,
      recipient_name: recipient.name,
      content,
      created_at: createdAt,
    }));
    const { data: messages, error: insertError } = await admin
      .from("staff_private_messages")
      .insert(rows as any)
      .select("*");
    if (insertError) return NextResponse.json({ error: insertError.message || "Could not save staff message." }, { status: 500 });

    try {
      await sendUrgentStaffNotification(
        admin,
        approvedRecipients.map((recipient) => recipient.id),
        {
          title: cleanText(body?.title, 120) || "Mensaje del equipo",
          body: cleanText(body?.body, 300) || `${sender.name}: ${content}`.slice(0, 300),
          url: normalizeNotificationUrl(body?.url),
          tag: normalizeNotificationTag(body?.tag),
          urgency: "urgent",
          requireInteraction: body?.requireInteraction !== false,
        },
        { excludeStaffId: sender.id },
      );
    } catch (alertError: any) {
      console.error("staff private message alert failed", alertError?.message || alertError);
    }

    return NextResponse.json({
      ok: true,
      messages: messages || [],
      message: Array.isArray(messages) ? messages[0] || null : null,
    });
  } catch (error) {
    console.error("staff private message send failed", error);
    return NextResponse.json({ error: "Could not send staff message." }, { status: 500 });
  }
}
