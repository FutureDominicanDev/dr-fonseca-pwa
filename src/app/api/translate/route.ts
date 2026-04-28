import { NextRequest, NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  targetLang?: "es" | "en";
  sourceLang?: "es" | "en" | "auto";
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_KEY_FALLBACK = process.env.OPENA1_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";
const MAX_TRANSLATE_CHARS = 1200;

const getApiKey = () => OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
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

    const languageName = targetLang === "es" ? "Spanish" : "English";
    const sourceHint = sourceLang === "auto" ? "auto-detect source language" : `source language is ${sourceLang}`;

    // Use only configured provider path for safer handling of medical chat text.
    const apiKey = getApiKey();
    if (!apiKey) return NextResponse.json({ translatedText: text, skipped: true });

    const prompt =
      `You translate short medical chat messages. ${sourceHint}. Translate into ${languageName}. ` +
      "Keep names, numbers, medications, dates, and tone. Return only translated text, no quotes.";

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
