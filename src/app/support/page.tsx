import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Support / Soporte | Dr. Fonseca Portal Medico",
  description: "Support for the Dr. Fonseca medical portal.",
};

const content = {
  es: {
    title: "Soporte",
    subtitle: "Ayuda para pacientes y personal que usan el Portal Medico Dr. Fonseca.",
    updated: "30 de abril de 2026",
    sections: [
      {
        title: "Contacto",
        body: [
          "Para ayuda con acceso, mensajes, notificaciones, archivos, videollamadas o problemas del portal, escribe a siluetybodyart@gmail.com.",
          "Tambien puedes llamar a la clinica al +52 333 231 4480 para soporte operativo relacionado con tu atencion.",
        ],
      },
      {
        title: "Pacientes",
        body: [
          "Si eres paciente, incluye tu nombre completo, fecha aproximada de procedimiento si aplica, sede y una descripcion breve del problema. No compartas contrasenas por correo o chat.",
          "El portal no reemplaza servicios de emergencia. Si tienes sintomas graves o una emergencia medica, llama a los servicios de emergencia locales o a la clinica de inmediato.",
        ],
      },
      {
        title: "Personal",
        body: [
          "Si eres parte del equipo, reporta problemas de acceso, permisos, salas de pacientes, notificaciones o archivos con el correo y telefono asociados a tu cuenta.",
          "Las solicitudes administrativas sensibles pueden requerir verificacion adicional antes de realizar cambios.",
        ],
      },
    ],
  },
  en: {
    title: "Support",
    subtitle: "Help for patients and staff using the Dr. Fonseca Medical Portal.",
    updated: "April 30, 2026",
    sections: [
      {
        title: "Contact",
        body: [
          "For help with access, messages, notifications, files, video calls, or portal issues, write to siluetybodyart@gmail.com.",
          "You may also call the clinic at +52 333 231 4480 for operational support related to your care.",
        ],
      },
      {
        title: "Patients",
        body: [
          "If you are a patient, include your full name, approximate procedure date if applicable, office location, and a brief description of the issue. Do not share passwords by email or chat.",
          "The portal does not replace emergency services. If you have severe symptoms or a medical emergency, call local emergency services or the clinic immediately.",
        ],
      },
      {
        title: "Staff",
        body: [
          "If you are part of the team, report access, permission, patient room, notification, or file issues with the email and phone connected to your account.",
          "Sensitive administrative requests may require additional verification before changes are made.",
        ],
      },
    ],
  },
};

export default function SupportPage() {
  return <LegalPage content={content} />;
}
