import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Soporte | Dr. Fonseca Portal Medico",
  description: "Soporte del portal medico Dr. Fonseca.",
};

export default function SupportPage() {
  return (
    <LegalPage
      title="Soporte"
      subtitle="Ayuda para pacientes y personal que usan el Portal Medico Dr. Fonseca."
      updated="30 de abril de 2026"
      sections={[
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
      ]}
    />
  );
}
