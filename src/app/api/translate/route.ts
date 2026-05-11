import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TranslateBody = {
  text?: string;
  targetLang?: "es" | "en";
  sourceLang?: "es" | "en" | "auto";
  roomId?: string;
  roomToken?: string;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_KEY_FALLBACK = process.env.OPENA1_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";
const MAX_TRANSLATE_CHARS = 1200;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const getApiKey = () => OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;

const authClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const adminClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function hasTranslationAccess(req: NextRequest, body: TranslateBody) {
  if (!authClient || !adminClient) return false;

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const userId = authData?.user?.id || "";
    if (!authError && userId) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.id && `${profile.role || ""}`.toLowerCase() !== "pending_staff") return true;
    }
  }

  const roomId = `${body?.roomId || ""}`.trim();
  const roomToken = `${body?.roomToken || ""}`.trim();
  if (!roomId || !roomToken) return false;

  const { data: room, error } = await adminClient
    .from("rooms")
    .select("id, patient_access_token")
    .eq("id", roomId)
    .maybeSingle();

  return !error && Boolean(room?.id && room.patient_access_token && room.patient_access_token === roomToken);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
    const hasAccess = await hasTranslationAccess(req, body);
    if (!hasAccess) return NextResponse.json({ error: "Translation access denied." }, { status: 401 });

    const text = `${body?.text || ""}`.trim();
    const targetLang = body?.targetLang === "en" ? "en" : "es";
    const sourceLang = body?.sourceLang === "en" || body?.sourceLang === "es" ? body.sourceLang : "auto";

    if (!text) return NextResponse.json({ translatedText: "" });
    if (text.length > MAX_TRANSLATE_CHARS) {
      return NextResponse.json({ translatedText: text.slice(0, MAX_TRANSLATE_CHARS), skipped: true, reason: "text-too-long" });
    }
    if (sourceLang !== "auto" && sourceLang === targetLang) {
      return NextResponse.json({ translatedText: text, skipped: true });
    }

    const languageName = targetLang === "es" ? "standard Mexican Spanish" : "clear professional English";
    const sourceHint = sourceLang === "auto" ? "auto-detect source language" : `source language is ${sourceLang}`;

    // Use only configured provider path for safer handling of medical chat text.
    const apiKey = getApiKey();
    if (!apiKey) return NextResponse.json({ translatedText: text, skipped: true });

    const prompt =
      `You translate short medical chat messages. ${sourceHint}. Translate into ${languageName}. ` +
      "Keep names, numbers, medications, dates, and tone. Use natural, warm, professional phrasing. Return only translated text, no quotes.";

    const responsesRequest = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        input: [
          { role: "system", content: [{ type: "input_text", text: prompt }] },
          { role: "user", content: [{ type: "input_text", text }] },
        ],
      }),
    });

    if (responsesRequest.ok) {
      const json = await responsesRequest.json();
      const translatedText = `${json?.output_text || ""}`.trim();
      if (translatedText) return NextResponse.json({ translatedText });
    }

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!completion.ok) return NextResponse.json({ translatedText: text, skipped: true });
    const completionJson = await completion.json();
    const translatedText = `${completionJson?.choices?.[0]?.message?.content || ""}`.trim() || text;
    return NextResponse.json({ translatedText });
  } catch {
    return NextResponse.json({ translatedText: "", skipped: true });
  }
}
