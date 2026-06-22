import { createSign } from "node:crypto";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DEVICE_ALERT_CHANNEL_ID = "portal_urgent_alerts_v3";
const ANDROID_ALERT_SOUND = "critical_repeat";
const IOS_ALERT_SOUND = "critical_repeat.wav";
const IOS_CRITICAL_ALERTS_ENABLED = /^true|1|yes$/i.test(`${process.env.IOS_CRITICAL_ALERTS_ENABLED || ""}`);

type FirebaseCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type NativeTokenEntry = {
  token?: string;
  platform?: string;
  updatedAt?: string;
};

export type NativePushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  urgency?: "normal" | "urgent" | "critical";
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

const normalizePrivateKey = (value: string) => value.replace(/\\n/g, "\n").trim();

const parseServiceAccount = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: `${parsed.project_id || ""}`.trim(),
      clientEmail: `${parsed.client_email || ""}`.trim(),
      privateKey: normalizePrivateKey(`${parsed.private_key || ""}`),
    };
  } catch {
    return null;
  }
};

function firebaseCredentials(): FirebaseCredentials | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
  const parsed = serviceAccountJson
    ? parseServiceAccount(serviceAccountJson)
    : serviceAccountBase64
      ? parseServiceAccount(Buffer.from(serviceAccountBase64, "base64").toString("utf8"))
      : null;
  const credentials = parsed || {
    projectId: `${process.env.FIREBASE_PROJECT_ID || ""}`.trim(),
    clientEmail: `${process.env.FIREBASE_CLIENT_EMAIL || ""}`.trim(),
    privateKey: normalizePrivateKey(`${process.env.FIREBASE_PRIVATE_KEY || ""}`),
  };

  return credentials.projectId && credentials.clientEmail && credentials.privateKey ? credentials : null;
}

export function isNativePushConfigured() {
  return Boolean(firebaseCredentials());
}

const base64urlJson = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function getFcmAccessToken(credentials: FirebaseCredentials) {
  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > nowMs) return cachedAccessToken.token;

  const now = Math.floor(nowMs / 1000);
  const unsignedToken = [
    base64urlJson({ alg: "RS256", typ: "JWT" }),
    base64urlJson({
      iss: credentials.clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ].join(".");
  const signature = createSign("RSA-SHA256").update(unsignedToken).end().sign(credentials.privateKey).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Could not authorize Firebase Cloud Messaging (${response.status}).`);
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: nowMs + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000,
  };
  return cachedAccessToken.token;
}

const cleanTag = (tag?: string) =>
  `${tag || "portal-alert"}`
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 64) || "portal-alert";

function buildFcmMessage(token: string, payload: NativePushPayload) {
  const tag = cleanTag(payload.tag);
  const critical = payload.urgency === "critical" && IOS_CRITICAL_ALERTS_ENABLED;
  const apsSound = critical
    ? { critical: 1, name: IOS_ALERT_SOUND, volume: 1.0 }
    : IOS_ALERT_SOUND;
  return {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag,
        source: "dr-fonseca-portal",
        urgency: payload.urgency || "urgent",
      },
      android: {
        priority: "HIGH",
        ttl: "3600s",
        notification: {
          channel_id: DEVICE_ALERT_CHANNEL_ID,
          notification_priority: "PRIORITY_MAX",
          visibility: "PUBLIC",
          sound: ANDROID_ALERT_SOUND,
          default_vibrate_timings: true,
          tag,
        },
      },
      apns: {
        headers: {
          "apns-push-type": "alert",
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: apsSound,
            "interruption-level": critical ? "critical" : "time-sensitive",
            "thread-id": tag,
          },
        },
      },
    },
  };
}

export async function sendNativePush(tokens: NativeTokenEntry[], payload: NativePushPayload) {
  const credentials = firebaseCredentials();
  if (!credentials) return { configured: false, attempted: 0, sent: 0 };

  const uniqueTokens = Array.from(
    new Set(tokens.map((entry) => `${entry.token || ""}`.trim()).filter(Boolean)),
  );
  if (uniqueTokens.length === 0) return { configured: true, attempted: 0, sent: 0 };

  const accessToken = await getFcmAccessToken(credentials);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.projectId)}/messages:send`;
  let sent = 0;

  for (const token of uniqueTokens) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildFcmMessage(token, payload)),
    });
    if (response.ok) {
      sent += 1;
      continue;
    }

    const errorText = await response.text().catch(() => "");
    console.warn("Native push send failed", { status: response.status, error: errorText.slice(0, 300) });
  }

  return { configured: true, attempted: uniqueTokens.length, sent };
}
