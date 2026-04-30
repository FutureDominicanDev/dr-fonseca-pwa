import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

const deletionMailto =
  "mailto:siluetybodyart@gmail.com?subject=Solicitud%20de%20eliminacion%20de%20cuenta%20-%20Portal%20Dr.%20Fonseca&body=Nombre%20completo%3A%0ATelefono%20o%20correo%20asociado%3A%0ARol%20%28paciente%20o%20staff%29%3A%0ADescribe%20tu%20solicitud%3A";

export const metadata: Metadata = {
  title: "Eliminar cuenta | Dr. Fonseca Portal Medico",
  description: "Solicitud de eliminacion de cuenta y datos del Portal Medico Dr. Fonseca.",
};

export default function AccountDeletionPage() {
  return (
    <LegalPage
      title="Eliminar cuenta"
      subtitle="Usa esta pagina para iniciar una solicitud de eliminacion de cuenta o datos asociados al portal."
      updated="30 de abril de 2026"
      sections={[
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
      ]}
    >
      <a
        href={deletionMailto}
        style={{
          display: "inline-flex",
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: "#0b66c3",
          color: "#fff",
          padding: "0 18px",
          textDecoration: "none",
          fontSize: 16,
          fontWeight: 800,
        }}
      >
        Enviar solicitud de eliminacion
      </a>
    </LegalPage>
  );
}
