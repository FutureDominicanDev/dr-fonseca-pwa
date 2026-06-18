export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const details = error as { message?: unknown; error_description?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const parts = [details?.message, details?.error_description, details?.code, details?.details, details?.hint]
    .map((part) => `${part || ""}`.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  try {
    return JSON.stringify(error);
  } catch {
    return `${error || ""}`;
  }
};

export const getSupabaseHost = (supabaseUrl: string) => {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "";
  }
};

export const isSupabaseConnectivityError = (message: string) =>
  /fetch failed|getaddrinfo|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network/i.test(message);

export const isSupabaseRateLimitError = (message: string) =>
  /rate.?limit|too many|security purposes/i.test(message);

export const isSupabaseUserNotFoundError = (message: string) =>
  /user.*not.*found|not\s+found|unable\s+to\s+find|no\s+user/i.test(message);
