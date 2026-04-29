import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pdebkexayomjaougrlhr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key");
const CLEANUP_KEY = "maintenance_preop_cleanup_v1_ran_at";

export async function POST() {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
    }

    const { data: alreadyRan } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLEANUP_KEY)
      .maybeSingle();

    if (alreadyRan?.value) {
      return NextResponse.json({ ok: true, alreadyRan: true, marker: alreadyRan.value });
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ is_internal: true })
      .eq("is_internal", false)
      .or("file_name.ilike.[BEFORE]%,file_url.ilike.%/before/%,content.ilike.[BEFORE]%")
      .select("id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const runAt = new Date().toISOString();
    await supabase.from("app_settings").upsert(
      [{ key: CLEANUP_KEY, value: runAt, updated_at: runAt }],
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      alreadyRan: false,
      updatedCount: data?.length || 0,
      marker: runAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

