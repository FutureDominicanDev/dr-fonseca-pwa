"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type FormLang = "es" | "en";

export type ClinicalHistoryFormData = {
  fullName: string;
  birthdate: string;
  phone: string;
  email: string;
  allergies: string;
  medications: string;
  conditions: string;
  surgeries: string;
  notes: string;
};

export type FormMessagePayload = {
  kind: "clinical_history";
  version: 1;
  submittedAt?: string;
  values: ClinicalHistoryFormData;
};

export const FORM_MESSAGE_PREFIX = "__DRF_FORM_MESSAGE__:";

export const emptyClinicalHistoryForm = (): ClinicalHistoryFormData => ({
  fullName: "",
  birthdate: "",
  phone: "",
  email: "",
  allergies: "",
  medications: "",
  conditions: "",
  surgeries: "",
  notes: "",
});

export const createClinicalHistoryPayload = (values?: Partial<ClinicalHistoryFormData>): FormMessagePayload => ({
  kind: "clinical_history",
  version: 1,
  submittedAt: new Date().toISOString(),
  values: { ...emptyClinicalHistoryForm(), ...(values || {}) },
});

export const serializeFormMessage = (payload: FormMessagePayload) =>
  `${FORM_MESSAGE_PREFIX}${JSON.stringify(payload)}`;

export const parseFormMessage = (content?: string | null): FormMessagePayload | null => {
  if (!content?.startsWith(FORM_MESSAGE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(FORM_MESSAGE_PREFIX.length));
    if (parsed?.kind !== "clinical_history" || !parsed?.values) return null;
    return {
      kind: "clinical_history",
      version: 1,
      submittedAt: parsed.submittedAt || "",
      values: { ...emptyClinicalHistoryForm(), ...parsed.values },
    };
  } catch {
    return null;
  }
};

const COPY = {
  es: {
    title: "Historia clínica",
    subtitle: "Formulario enviado por el paciente",
    edit: "Editar formulario",
    submit: "Enviar formulario",
    update: "Actualizar formulario",
    cancel: "Cancelar",
    submitted: "Enviado",
    empty: "Sin respuesta",
    fields: {
      fullName: "Nombre completo",
      birthdate: "Fecha de nacimiento",
      phone: "Teléfono",
      email: "Correo",
      allergies: "Alergias",
      medications: "Medicamentos actuales",
      conditions: "Enfermedades o condiciones",
      surgeries: "Cirugías previas",
      notes: "Notas importantes",
    },
    placeholders: {
      fullName: "Nombre y apellidos",
      birthdate: "dd/mm/aaaa",
      phone: "+52 ...",
      email: "correo@ejemplo.com",
      allergies: "Ej: Penicilina, látex...",
      medications: "Medicamentos, dosis y frecuencia",
      conditions: "Diabetes, hipertensión, etc.",
      surgeries: "Cirugía, año y detalles",
      notes: "Algo más que el equipo deba saber",
    },
  },
  en: {
    title: "Medical history",
    subtitle: "Form submitted by the patient",
    edit: "Edit form",
    submit: "Send form",
    update: "Update form",
    cancel: "Cancel",
    submitted: "Submitted",
    empty: "No answer",
    fields: {
      fullName: "Full name",
      birthdate: "Date of birth",
      phone: "Phone",
      email: "Email",
      allergies: "Allergies",
      medications: "Current medications",
      conditions: "Medical conditions",
      surgeries: "Previous surgeries",
      notes: "Important notes",
    },
    placeholders: {
      fullName: "First and last name",
      birthdate: "mm/dd/yyyy",
      phone: "+1 ...",
      email: "email@example.com",
      allergies: "Example: Penicillin, latex...",
      medications: "Medication, dose, and frequency",
      conditions: "Diabetes, high blood pressure, etc.",
      surgeries: "Surgery, year, and details",
      notes: "Anything else the care team should know",
    },
  },
} as const;

const FIELD_ORDER: (keyof ClinicalHistoryFormData)[] = [
  "fullName",
  "birthdate",
  "phone",
  "email",
  "allergies",
  "medications",
  "conditions",
  "surgeries",
  "notes",
];

type FormMessageProps = {
  payload: FormMessagePayload;
  lang?: FormLang;
  editable?: boolean;
  onSubmit?: (payload: FormMessagePayload) => Promise<void> | void;
};

export function FormMessage({ payload, lang = "es", editable = false, onSubmit }: FormMessageProps) {
  const t = COPY[lang] || COPY.es;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ClinicalHistoryFormData>(payload.values);
  const [saving, setSaving] = useState(false);

  const submittedText = useMemo(() => {
    if (!payload.submittedAt) return "";
    try {
      return new Date(payload.submittedAt).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "";
    }
  }, [lang, payload.submittedAt]);

  const save = async () => {
    if (!onSubmit) return;
    setSaving(true);
    await onSubmit(createClinicalHistoryPayload(values));
    setSaving(false);
    setEditing(false);
  };

  const cardStyle: CSSProperties = {
    border: "1px solid rgba(37,99,235,0.18)",
    borderRadius: 16,
    background: "#F8FBFF",
    overflow: "hidden",
    minWidth: 260,
    maxWidth: "100%",
    color: "#0F172A",
  };

  if (editing || (editable && !payload.submittedAt)) {
    return (
      <div style={{ ...cardStyle, padding: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{t.title}</div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 700, marginBottom: 12 }}>{t.subtitle}</div>
        <div style={{ display: "grid", gap: 10 }}>
          {FIELD_ORDER.map((field) => {
            const isLong = field === "allergies" || field === "medications" || field === "conditions" || field === "surgeries" || field === "notes";
            return (
              <label key={field} style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 850, color: "#334155" }}>
                {t.fields[field]}
                {isLong ? (
                  <textarea
                    value={values[field]}
                    onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={t.placeholders[field]}
                    rows={2}
                    style={{ width: "100%", border: "1px solid #D8E5F1", borderRadius: 12, padding: "10px 11px", font: "inherit", fontSize: 16, resize: "vertical", lineHeight: 1.4 }}
                  />
                ) : (
                  <input
                    value={values[field]}
                    onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={t.placeholders[field]}
                    style={{ width: "100%", minHeight: 44, border: "1px solid #D8E5F1", borderRadius: 12, padding: "0 11px", font: "inherit", fontSize: 16 }}
                  />
                )}
              </label>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: editable && payload.submittedAt ? "1fr 1fr" : "1fr", gap: 8, marginTop: 12 }}>
          {editable && payload.submittedAt && (
            <button type="button" onClick={() => { setValues(payload.values); setEditing(false); }} style={{ minHeight: 44, border: "1px solid #D8E5F1", borderRadius: 12, background: "#fff", color: "#0F172A", font: "inherit", fontWeight: 850 }}>
              {t.cancel}
            </button>
          )}
          <button type="button" disabled={saving} onClick={save} style={{ minHeight: 44, border: "none", borderRadius: 12, background: "#2563EB", color: "#fff", font: "inherit", fontWeight: 900, opacity: saving ? 0.55 : 1 }}>
            {payload.submittedAt ? t.update : t.submit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ padding: 13, background: "#EAF3FF", borderBottom: "1px solid rgba(37,99,235,0.14)" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{t.title}</div>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 750, marginTop: 3 }}>
          {t.submitted}{submittedText ? ` · ${submittedText}` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gap: 9, padding: 13 }}>
        {FIELD_ORDER.map((field) => (
          <div key={field}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>{t.fields[field]}</div>
            <div style={{ fontSize: 15, fontWeight: 720, lineHeight: 1.42, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {payload.values[field]?.trim() || t.empty}
            </div>
          </div>
        ))}
      </div>
      {editable && (
        <div style={{ padding: "0 13px 13px" }}>
          <button type="button" onClick={() => { setValues(payload.values); setEditing(true); }} style={{ width: "100%", minHeight: 44, border: "1px solid #BFDBFE", borderRadius: 12, background: "#fff", color: "#1D4ED8", font: "inherit", fontWeight: 900 }}>
            {t.edit}
          </button>
        </div>
      )}
    </div>
  );
}
