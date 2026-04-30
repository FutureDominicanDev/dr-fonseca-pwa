export const normalizePhone = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  return `+${cleaned.replace(/\D/g, "")}`;
};

export const normalizeStaffPhone = (value: string, countryCode = "+52") => {
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return normalizePhone(cleaned);

  const digits = cleaned.replace(/\D/g, "");
  const countryDigits = normalizePhone(countryCode).replace(/\D/g, "");
  if (countryDigits && digits.startsWith(countryDigits) && digits.length > countryDigits.length + 5) {
    return normalizePhone(`+${digits}`);
  }
  return normalizePhone(`${countryCode}${digits}`);
};

export const phoneAliasEmail = (phone: string) => {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return "";
  return `staff+${digits}@portal-staff.local`;
};
