const DEFAULT_APP_URL = "https://portal.drfonsecacirujanoplastico.com";

const cleanEnv = (value?: string | null) => `${value || ""}`.trim().replace(/^["']|["']$/g, "").trim();

export const getAppUrl = () => (cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || DEFAULT_APP_URL).replace(/\/+$/, "");

type RecoveryLinkData = {
  properties?: {
    action_link?: unknown;
    hashed_token?: unknown;
  } | null;
} | null | undefined;

export const getRecoveryActionLink = (linkData: RecoveryLinkData, lang: "es" | "en", appUrl = getAppUrl()) => {
  const properties = linkData?.properties || {};
  const actionLink = `${properties.action_link || ""}`.trim();
  if (actionLink) return actionLink;

  const hashedToken = `${properties.hashed_token || ""}`.trim();
  if (!hashedToken) return actionLink;

  const params = new URLSearchParams({
    lang,
    token_hash: hashedToken,
    type: "recovery",
  });
  return `${appUrl}/reset-password?${params.toString()}`;
};

export const getSmtpConfig = (defaultFromName: string) => {
  const SMTP_HOST = cleanEnv(process.env.SMTP_HOST);
  const smtpPortValue = cleanEnv(process.env.SMTP_PORT);
  const parsedSmtpPort = Number(smtpPortValue || "465");
  const SMTP_PORT = Number.isFinite(parsedSmtpPort) ? parsedSmtpPort : 465;
  const SMTP_USER = cleanEnv(process.env.SMTP_USER);
  const SMTP_PASS = cleanEnv(process.env.SMTP_PASS);
  const SMTP_FROM_NAME = cleanEnv(process.env.SMTP_FROM_NAME) || defaultFromName;
  const SMTP_FROM_EMAIL = cleanEnv(process.env.SMTP_FROM_EMAIL) || SMTP_USER;

  return {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM_NAME,
    SMTP_FROM_EMAIL,
    configured: Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM_EMAIL),
  };
};
