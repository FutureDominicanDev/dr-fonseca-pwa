import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Politica de privacidad | Dr. Fonseca Portal Medico",
  description: "Politica de privacidad del portal medico Dr. Fonseca.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politica de privacidad"
      subtitle="Esta pagina explica como el Portal Medico Dr. Fonseca usa y protege la informacion de pacientes y personal."
      updated="30 de abril de 2026"
      sections={[
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
      ]}
    />
  );
}
