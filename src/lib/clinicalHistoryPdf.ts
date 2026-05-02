import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormLang, FormMessagePayload } from "@/components/FormMessage";

type ClinicalPdfOptions = {
  templateUrl?: string;
  uiLang?: FormLang;
};

const clean = (value?: string | null) => `${value || ""}`.trim() || "-";

const clamp = (value: string, max = 120) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const linesFor = (value: string, maxChars = 78, maxLines = 2) => {
  const words = clean(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = next;
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
};

export async function buildClinicalHistoryPdf(payload: FormMessagePayload, options: ClinicalPdfOptions = {}) {
  const templateUrl = options.templateUrl || "/forms/historia-clinica.pdf";
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error("clinical_history_template_unavailable");

  const bytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];
  const values = payload.values;
  const ink = rgb(0.02, 0.05, 0.12);
  const white = rgb(1, 1, 1);
  const blue = rgb(0.05, 0.22, 0.48);

  const write = (text: string, x: number, y: number, width: number, height = 15, size = 9) => {
    page.drawRectangle({ x, y: y - 2, width, height, color: white, opacity: 0.94 });
    linesFor(text, Math.max(18, Math.floor(width / (size * 0.53))), Math.max(1, Math.floor(height / (size + 2)))).forEach((line, index) => {
      page.drawText(line, { x: x + 3, y: y + height - 11 - index * (size + 2), size, font, color: ink });
    });
  };

  write(values.fullName, 109, 654, 265);
  write(values.birthdate, 109, 633, 170);
  write(values.phone, 109, 572, 170);
  write(values.email ? `Email: ${values.email}` : "-", 109, 548, 265, 15, 8);
  write(values.medications, 260, 360, 305, 20, 8);
  write(values.allergies, 160, 264, 405, 18, 8);
  write(values.conditions, 155, 127, 410, 20, 8);
  write(values.surgeries, 155, 177, 410, 20, 8);
  write(values.notes, 155, 108, 410, 20, 8);

  const submittedLabel = options.uiLang === "en" ? "Submitted through Dr. Fonseca Portal" : "Enviado desde el portal Dr. Fonseca";
  const submittedAt = payload.submittedAt
    ? new Date(payload.submittedAt).toLocaleString(options.uiLang === "en" ? "en-US" : "es-MX")
    : new Date().toLocaleString(options.uiLang === "en" ? "en-US" : "es-MX");
  page.drawRectangle({ x: 26, y: 22, width: 560, height: 18, color: white, opacity: 0.86 });
  page.drawText(`${submittedLabel}: ${submittedAt}`, { x: 32, y: 28, size: 7.5, font: bold, color: blue });

  const pdfBytes = await pdfDoc.save();
  const patientName = clean(values.fullName).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "paciente";
  const fileName = `[FORM PDF] Historia clinica - ${clamp(patientName, 48)}.pdf`;
  const pdfArrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new File([pdfArrayBuffer], fileName, { type: "application/pdf" });
}
