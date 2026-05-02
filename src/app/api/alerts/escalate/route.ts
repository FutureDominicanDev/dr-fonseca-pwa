import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ALERTS_INTERNAL_SECRET = process.env.ALERTS_INTERNAL_SECRET || "";

const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const authClient = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const adminClient = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

type EscalatedAlert = {
  id: string;
  chat_id: string;
  patient_id: string;
  previous_escalation_level: number;
  escalation_level: number;
};

const isSchemaMissingError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const text = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("function") || text.includes("relation");
};

async function authorize(request: NextRequest) {
  if (!authClient || !adminClient) return { ok: false, status: 503, error: "Alerts are not configured." };

  const internalSecret = request.headers.get("x-alerts-internal-secret") || "";
  if (ALERTS_INTERNAL_SECRET && internalSecret && internalSecret === ALERTS_INTERNAL_SECRET) {
    return { ok: true, actorId: "internal" };
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing session." };

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData?.user?.id || "";
  if (authError || !userId) return { ok: false, status: 401, error: "Invalid session." };

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, admin_level")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.id) return { ok: false, status: 403, error: "Not allowed." };

  const role = `${profile.role || ""}`.toLowerCase();
  const adminLevel = `${profile.admin_level || ""}`.toLowerCase();
  const allowed = ["owner", "super_admin", "admin"].includes(adminLevel) || ["doctor", "coordinacion"].includes(role);
  if (!allowed) return { ok: false, status: 403, error: "Not allowed." };

  return { ok: true, actorId: userId };
}

async function targetStaffIdsFor(alert: EscalatedAlert) {
  if (!adminClient) return [];

  if (alert.escalation_level === 2) {
    const { data, error } = await adminClient
      .from("room_members")
      .select("user_id")
      .eq("room_id", alert.chat_id);
    if (error) {
      console.error("Alert escalation room member lookup failed", error.message);
      return [];
    }
    return Array.from(new Set((data || []).map((row: any) => `${row.user_id || ""}`).filter(Boolean)));
  }

  if (alert.escalation_level >= 3) {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, role, admin_level");
    if (error) {
      console.error("Alert escalation admin lookup failed", error.message);
      return [];
    }
    return Array.from(new Set((data || [])
      .filter((profile: any) => {
        const role = `${profile.role || ""}`.toLowerCase();
        const adminLevel = `${profile.admin_level || ""}`.toLowerCase();
        return role === "doctor" || ["owner", "super_admin", "admin"].includes(adminLevel);
      })
      .map((profile: any) => `${profile.id || ""}`)
      .filter(Boolean)));
  }

  return [];
}

async function insertEscalationNotifications(alerts: EscalatedAlert[]) {
  if (!adminClient) return { inserted: 0 };

  let inserted = 0;
  for (const alert of alerts) {
    const targetIds = await targetStaffIdsFor(alert);
    if (targetIds.length === 0) continue;

    const marker = `[alert:${alert.id}:level:${alert.escalation_level}]`;
    const { data: existing, error: existingError } = await adminClient
      .from("media_notifications")
      .select("id")
      .eq("room_id", alert.chat_id)
      .eq("patient_id", alert.patient_id)
      .eq("media_type", "alert_escalation")
      .ilike("message", `%${marker}%`)
      .limit(1);
    if (existingError) {
      console.error("Alert escalation duplicate check failed", existingError.message);
      continue;
    }
    if (existing?.length) continue;

    const createdAt = new Date().toISOString();
    const rows = targetIds.map((staffId) => ({
      room_id: alert.chat_id,
      patient_id: alert.patient_id,
      staff_id: staffId,
      recipient_id: staffId,
      media_type: "alert_escalation",
      message: `Alerta escalada a nivel ${alert.escalation_level}. ${marker}`,
      seen: false,
      status: "unread",
      created_at: createdAt,
    }));

    const { error } = await adminClient.from("media_notifications").insert(rows);
    if (error) {
      console.error("Alert escalation notification insert failed", error.message);
      continue;
    }

    inserted += rows.length;
    console.log(`Alert escalated to level ${alert.escalation_level} for chat_id ${alert.chat_id}`);
  }

  return { inserted };
}

export async function POST(request: NextRequest) {
  try {
    if (!configured || !adminClient) {
      return NextResponse.json({ error: "Alerts are not configured." }, { status: 503 });
    }

    const auth = await authorize(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await adminClient.rpc("escalate_pending_alerts");
    if (error) {
      console.error("Alert escalation RPC failed", error.message);
      const status = isSchemaMissingError(error) ? 503 : 500;
      return NextResponse.json({ ok: false, escalated: 0, notifications: 0, error: error.message }, { status });
    }

    const alerts = Array.isArray(data) ? data as EscalatedAlert[] : [];
    const changedAlerts = alerts.filter((alert) => Number(alert.escalation_level) > Number(alert.previous_escalation_level));
    const notificationResult = await insertEscalationNotifications(changedAlerts);

    return NextResponse.json({
      ok: true,
      escalated: changedAlerts.length,
      notifications: notificationResult.inserted,
    });
  } catch (error: any) {
    console.error("Unexpected alert escalation error", error?.message || error);
    return NextResponse.json({ ok: false, error: "Unexpected alert escalation error." }, { status: 500 });
  }
}
