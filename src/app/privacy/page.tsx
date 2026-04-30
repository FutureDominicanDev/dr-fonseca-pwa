import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy / Politica de privacidad | Dr. Fonseca Portal Medico",
  description: "Privacy policy for the Dr. Fonseca medical portal.",
};

const content = {
  es: {
    title: "Politica de privacidad",
    subtitle: "Esta pagina explica como el Portal Medico Dr. Fonseca usa y protege la informacion de pacientes y personal.",
    updated: "30 de abril de 2026",
    sections: [
      {
        title: "Informacion que usa el portal",
        body: [
          "El portal puede procesar nombres, datos de contacto, sede, procedimiento, fecha de cirugia, idioma preferido, zona horaria, alergias, medicamentos, notas internas autorizadas, mensajes de chat, fotos, videos, audio, documentos, datos de acceso de personal y datos tecnicos necesarios para notificaciones.",
          "La informacion medica o relacionada con el tratamiento se usa para apoyar la comunicacion entre el paciente y el equipo autorizado de Siluety Plastic Surgery.",
        ],
      },
      {
        title: "Uso de la informacion",
        body: [
          "Usamos la informacion para operar el portal, autenticar usuarios, administrar salas de pacientes, enviar y recibir mensajes, manejar archivos clinicos, entregar notificaciones, brindar soporte, mantener seguridad y cumplir obligaciones legales o regulatorias.",
          "El portal no vende datos personales y no usa datos de pacientes para publicidad dirigida.",
        ],
      },
      {
        title: "Proveedores y acceso",
        body: [
          "La informacion puede ser procesada por proveedores tecnicos necesarios para operar el servicio, como alojamiento seguro, base de datos, autenticacion, almacenamiento de archivos, correo electronico, notificaciones, traduccion o videollamadas cuando esas funciones esten activas.",
          "Dentro de la clinica, el acceso se limita al personal autorizado y al equipo asignado al caso segun los permisos del portal.",
        ],
      },
      {
        title: "Seguridad y retencion",
        body: [
          "El portal usa transmision segura, autenticacion, permisos por rol y controles administrativos para reducir el acceso no autorizado.",
          "Los datos se conservan mientras sean necesarios para la atencion del paciente, soporte, seguridad, auditoria y requisitos legales. Algunos registros medicos, administrativos o de seguridad pueden conservarse cuando la ley o las obligaciones profesionales lo requieran.",
        ],
      },
      {
        title: "Derechos y contacto",
        body: [
          "Puedes solicitar acceso, correccion o eliminacion de datos usando la pagina de eliminacion de cuenta o contactando a soporte.",
          "Contacto de privacidad: siluetybodyart@gmail.com. Portal: portal.drfonsecacirujanoplastico.com.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    subtitle: "This page explains how the Dr. Fonseca Medical Portal uses and protects patient and staff information.",
    updated: "April 30, 2026",
    sections: [
      {
        title: "Information the portal uses",
        body: [
          "The portal may process names, contact details, office location, procedure, surgery date, preferred language, time zone, allergies, medications, authorized internal notes, chat messages, photos, videos, audio, documents, staff access data, and technical data needed for notifications.",
          "Medical or treatment-related information is used to support communication between the patient and the authorized Siluety Plastic Surgery care team.",
        ],
      },
      {
        title: "How information is used",
        body: [
          "We use information to operate the portal, authenticate users, manage patient rooms, send and receive messages, handle clinical files, deliver notifications, provide support, maintain security, and meet legal or regulatory obligations.",
          "The portal does not sell personal data and does not use patient data for targeted advertising.",
        ],
      },
      {
        title: "Providers and access",
        body: [
          "Information may be processed by technical providers needed to operate the service, such as secure hosting, database, authentication, file storage, email, notifications, translation, or video calls when those features are active.",
          "Inside the clinic, access is limited to authorized staff and the team assigned to the case according to portal permissions.",
        ],
      },
      {
        title: "Security and retention",
        body: [
          "The portal uses secure transmission, authentication, role-based permissions, and administrative controls to reduce unauthorized access.",
          "Data is kept as long as needed for patient care, support, security, audit, and legal requirements. Some medical, administrative, or security records may be retained when law or professional obligations require it.",
        ],
      },
      {
        title: "Rights and contact",
        body: [
          "You may request access, correction, or deletion of data using the account deletion page or by contacting support.",
          "Privacy contact: siluetybodyart@gmail.com. Portal: portal.drfonsecacirujanoplastico.com.",
        ],
      },
    ],
  },
};

export default function PrivacyPage() {
  return <LegalPage content={content} />;
}
