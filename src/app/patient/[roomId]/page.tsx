import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isSchemaError = (error: unknown) => {
  const value = error as { message?: string; details?: string; hint?: string };
  const text = `${value?.message || ""} ${value?.details || ""} ${value?.hint || ""}`.toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("column");
};

async function currentPatientToken(roomId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return "";

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = await adminClient
    .from("rooms")
    .select("patient_access_token")
    .eq("id", roomId)
    .maybeSingle();

  if (query.error && isSchemaError(query.error)) return "";
  return `${query.data?.patient_access_token || ""}`.trim();
}

export default async function PatientRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { roomId } = await params;
  const { token } = await searchParams;
  const resolvedToken = `${token || ""}`.trim() || await currentPatientToken(roomId);
  const target = resolvedToken ? `/chat/${roomId}?token=${encodeURIComponent(resolvedToken)}` : `/chat/${roomId}`;

  redirect(target);
}
