import { NextRequest, NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  targetLang?: "es" | "en";
  sourceLang?: "es" | "en" | "auto";
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
    const text = `${body?.text || ""}`.trim();
    const targetLang = body?.targetLang === "en" ? "en" : "es";
    const sourceLang = body?.sourceLang === "en" || body?.sourceLang === "es" ? body.sourceLang : "auto";

    if (!text) return NextResponse.json({ translatedText: "" });
    if (sourceLang !== "auto" && sourceLang === targetLang) {
      return NextResponse.json({ translatedText: text, skipped: true });
    }

    if (!OPENAI_API_KEY) {
      // Keep UX safe: no key should never break chat rendering.
      return NextResponse.json({ translatedText: text, skipped: true });
    }

    const languageName = targetLang === "es" ? "Spanish" : "English";
    const sourceHint = sourceLang === "auto" ? "auto-detect source language" : `source language is ${sourceLang}`;

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              `You translate short medical chat messages. ${sourceHint}. Translate into ${languageName}. ` +
              "Keep names, numbers, medications, dates, and tone. Return only translated text, no quotes.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!completion.ok) {
      return NextResponse.json({ translatedText: text, skipped: true });
    }

    const json = await completion.json();
    const translatedText = `${json?.choices?.[0]?.message?.content || ""}`.trim() || text;
    return NextResponse.json({ translatedText });
  } catch {
    return NextResponse.json({ translatedText: "", skipped: true });
  }
}

