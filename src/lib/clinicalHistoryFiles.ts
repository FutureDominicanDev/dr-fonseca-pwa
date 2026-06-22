export const isClinicalHistoryFileName = (value?: string | null) => {
  const normalized = `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\[form\]\s*/i, "")
    .replace(/^form[-_\s]+/i, "")
    .replace(/[^a-z0-9]+/g, "");

  return normalized === "historiaclinica" || normalized === "historiaclinicapdf";
};
