export function LandingPage() {
  return (
    <>
      <header className="top">
        <a className="brand" href="/">
          RENT
        </a>
        <a className="enter" href="/app/">
          Entrar
        </a>
      </header>
      <main>
        <section className="hero" id="que-es">
          <p className="eyebrow">Sulbase</p>
          <h1>Gestión de arrendamientos para quien administra propiedades.</h1>
          <p className="lead">
            RENT es el software privado de Sulbase para llevar propiedades, unidades, inquilinos,
            contratos, cobros y mantenimiento en un solo lugar. La aplicación está cerrada: hace
            falta una cuenta para entrar.
          </p>
          <p>
            <a className="enter solid" href="/app/">
              Entrar a RENT
            </a>
          </p>
        </section>

        <section id="para-quien">
          <h2>Para quién es</h2>
          <p>
            Para arrendadores y equipos pequeños que administran un portafolio propio o de
            terceros: una persona que cobra rentas, una administración con varios inmuebles, o un
            equipo que reparte el trabajo entre quien opera y quien solo consulta.
          </p>
          <p>
            Cada organización ve solo sus datos. Los roles separan al propietario, quien gestiona,
            el personal operativo y quien consulta sin modificar.
          </p>
        </section>

        <section id="funciones">
          <h2>Qué puedes hacer</h2>
          <ul>
            <li>Registrar propiedades y unidades, con superficies en metros cuadrados.</li>
            <li>Llevar el directorio de inquilinos y los contratos de arrendamiento.</li>
            <li>Enviar un contrato a firma electrónica y archivar el PDF firmado.</li>
            <li>Generar cargos de renta, registrar pagos y ver lo vencido.</li>
            <li>Abrir órdenes de trabajo y darles seguimiento.</li>
            <li>Guardar escrituras, fotos, certificados y facturas de cada inmueble.</li>
            <li>Recibir alertas de renta, contratos por vencer y órdenes sin asignar.</li>
            <li>Escribir a inquilinos y compañeros de equipo dentro de la aplicación.</li>
          </ul>
        </section>

        <section id="acceso">
          <h2>Acceso</h2>
          <p>
            RENT no publica precios, disponibilidad ni un directorio de inmuebles. El panel, el
            inicio de sesión y la API son privados. Si ya tienes cuenta, entra con tu correo. Si
            perteneces a una organización, un administrador puede invitarte.
          </p>
        </section>

        <section id="contacto">
          <h2>Contacto</h2>
          <p>
            RENT es un producto de{" "}
            <a href="https://sulbase.com">Sulbase</a>. Para usar la aplicación, entra en{" "}
            <a href="/app/">rent.sulbase.com/app</a>.
          </p>
        </section>
      </main>
      <footer>
        <p>RENT · Sulbase</p>
        <a href="/app/">Entrar</a>
      </footer>
    </>
  );
}
