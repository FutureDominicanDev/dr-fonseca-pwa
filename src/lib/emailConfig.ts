const DEFAULT_APP_URL = "https://portal.drfonsecacirujanoplastico.com";

const cleanEnv = (value?: string | null) => `${value || ""}`.trim().replace(/^["']|["']$/g, "").trim();

export const getAppUrl = () => (cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || DEFAULT_APP_URL).replace(/\/+$/, "");

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
