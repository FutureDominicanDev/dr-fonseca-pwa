import { NextRequest, NextResponse } from "next/server";

type ActorType = "staff" | "patient";

type VideoSessionBody = {
  roomId?: string;
  providerRoomName?: string;
  actorType?: ActorType;
  actorName?: string;
};

type DailyRoomResponse = {
  name: string;
  url: string;
};

const DAILY_API_KEY = process.env.DAILY_API_KEY || "";
const DAILY_API_BASE = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

const normalizeRoomName = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const deriveRoomName = (roomId: string, providerRoomName?: string) => {
  const fromPayload = normalizeRoomName(providerRoomName || "");
  if (fromPayload.length >= 3) return fromPayload;
  const fromRoomId = normalizeRoomName(roomId);
  if (fromRoomId.length >= 3) return `dr-fonseca-${fromRoomId}`.slice(0, 80);
  return "";
};

const dailyFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${DAILY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return response;
};

const getOrCreateRoom = async (roomName: string): Promise<DailyRoomResponse> => {
  const getResponse = await dailyFetch(`/rooms/${encodeURIComponent(roomName)}`);
  if (getResponse.ok) {
    const room = (await getResponse.json()) as DailyRoomResponse;
    return room;
  }

  const createResponse = await dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        enable_chat: false,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  if (!createResponse.ok) {
    const body = await createResponse.text();
    throw new Error(`Daily room create failed (${createResponse.status}): ${body || "unknown error"}`);
  }

  const room = (await createResponse.json()) as DailyRoomResponse;
  return room;
};

const createMeetingToken = async (roomName: string, actorType: ActorType, actorName: string) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
  const tokenResponse = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: actorName || (actorType === "staff" ? "Staff" : "Patient"),
        is_owner: actorType === "staff",
        exp: expiresAt,
      },
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Daily token failed (${tokenResponse.status}): ${body || "unknown error"}`);
  }

  const tokenJson = (await tokenResponse.json()) as { token?: string };
  return `${tokenJson?.token || ""}`.trim();
};

export async function POST(req: NextRequest) {
  try {
    if (!DAILY_API_KEY) {
      return NextResponse.json(
        { error: "Missing DAILY_API_KEY. Add it in Vercel environment variables." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as VideoSessionBody;
    const roomId = `${body?.roomId || ""}`.trim();
    const actorType: ActorType = body?.actorType === "staff" ? "staff" : "patient";
    const actorName = `${body?.actorName || ""}`.trim() || (actorType === "staff" ? "Staff" : "Patient");

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId." }, { status: 400 });
    }

    const roomName = deriveRoomName(roomId, body?.providerRoomName);
    if (!roomName) {
      return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
    }

    const room = await getOrCreateRoom(roomName);
    const token = await createMeetingToken(roomName, actorType, actorName);
    if (!token) {
      return NextResponse.json({ error: "Could not create meeting token." }, { status: 500 });
    }

    const separator = room.url.includes("?") ? "&" : "?";
    const joinUrl = `${room.url}${separator}t=${encodeURIComponent(token)}`;

    return NextResponse.json({
      provider: "daily",
      roomName,
      roomUrl: room.url,
      joinUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create video session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
