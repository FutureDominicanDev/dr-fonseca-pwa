import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

const deletionMailtoEs =
  "mailto:siluetybodyart@gmail.com?subject=Solicitud%20de%20eliminacion%20de%20cuenta%20-%20Portal%20Dr.%20Fonseca&body=Nombre%20completo%3A%0ATelefono%20o%20correo%20asociado%3A%0ARol%20%28paciente%20o%20staff%29%3A%0ADescribe%20tu%20solicitud%3A";

const deletionMailtoEn =
  "mailto:siluetybodyart@gmail.com?subject=Account%20deletion%20request%20-%20Dr.%20Fonseca%20Portal&body=Full%20name%3A%0APhone%20or%20email%20connected%20to%20the%20account%3A%0ARole%20%28patient%20or%20staff%29%3A%0ADescribe%20your%20request%3A";

export const metadata: Metadata = {
  title: "Delete account / Eliminar cuenta | Dr. Fonseca Portal Medico",
  description: "Account and data deletion request for the Dr. Fonseca medical portal.",
};

const content = {
  es: {
    title: "Eliminar cuenta",
    subtitle: "Usa esta pagina para iniciar una solicitud de eliminacion de cuenta o datos asociados al portal.",
    updated: "30 de abril de 2026",
    sections: [
      {
        title: "Como iniciar la solicitud",
        body: [
          "Para solicitar eliminacion, envia tu nombre completo, correo o telefono asociado, tu rol en el portal y una descripcion breve de la solicitud.",
          "El equipo puede pedir verificacion adicional para confirmar tu identidad y proteger datos medicos o administrativos.",
        ],
      },
      {
        title: "Que se elimina",
        body: [
          "Cuando sea permitido, se eliminara o desactivara la cuenta de acceso y los datos personales asociados que no deban conservarse por seguridad, auditoria, obligaciones medicas, legales o regulatorias.",
          "En contextos medicos, algunos registros pueden tener que conservarse por requisitos profesionales o legales. Si eso aplica, se te informara durante el proceso.",
        ],
      },
      {
        title: "Tiempo de respuesta",
        body: [
          "Las solicitudes se revisan lo antes posible. Si el proceso requiere pasos manuales o confirmacion de identidad, el equipo te informara el estado y los siguientes pasos.",
          "Los pacientes tambien pueden solicitar acceso o correccion de informacion usando este mismo canal.",
        ],
      },
    ],
  },
  en: {
    title: "Delete account",
    subtitle: "Use this page to start a request to delete an account or data connected to the portal.",
    updated: "April 30, 2026",
    sections: [
      {
        title: "How to start the request",
        body: [
          "To request deletion, send your full name, connected email or phone, your role in the portal, and a brief description of the request.",
          "The team may ask for additional verification to confirm your identity and protect medical or administrative data.",
        ],
      },
      {
        title: "What is deleted",
        body: [
          "When allowed, the access account and related personal data will be deleted or deactivated if it does not need to be retained for security, audit, medical, legal, or regulatory obligations.",
          "In medical contexts, some records may need to be retained for professional or legal requirements. If that applies, you will be informed during the process.",
        ],
      },
      {
        title: "Response time",
        body: [
          "Requests are reviewed as soon as possible. If the process requires manual steps or identity confirmation, the team will share the status and next steps.",
          "Patients may also request access to or correction of information through this same channel.",
        ],
      },
    ],
  },
};

const action = {
  es: {
    href: deletionMailtoEs,
    label: "Enviar solicitud de eliminacion",
  },
  en: {
    href: deletionMailtoEn,
    label: "Send deletion request",
  },
};

export default function AccountDeletionPage() {
  return <LegalPage content={content} action={action} />;
}
