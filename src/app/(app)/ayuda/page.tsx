import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ayuda | HogarFinance IA",
};

/** Una pregunta desplegable. Usa <details> nativo: accesible y sin JS. */
function Tema({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-gray-100 bg-white px-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
        {titulo}
        <svg
          className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <div className="flex flex-col gap-2 pb-4 text-sm leading-relaxed text-gray-600">
        {children}
      </div>
    </details>
  );
}

/** Un paso numerado dentro de un instructivo. */
function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-bold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </p>
  );
}

export default function AyudaPage() {
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-5 backdrop-blur">
        <Link
          href="/perfil"
          aria-label="Volver a Perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Ayuda
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Cómo usar HogarFinance IA
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 py-5">
        <section className="rounded-2xl bg-primary-light px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            La idea en una línea
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Cargás la factura cuando te llega, la app te avisa antes de que
            venza, y cuando la pagás guardás el comprobante junto a ella. Si
            algún día te reclaman esa deuda, tenés la prueba en dos toques.
          </p>
        </section>

        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-gray-900">
            Primeros pasos
          </h2>

          <Tema titulo="¿Cómo cargo una factura?">
            <Paso n={1}>
              Entrá a <strong>Facturas</strong> y tocá{" "}
              <strong>Nueva factura</strong>.
            </Paso>
            <Paso n={2}>
              Sacale una foto a la factura o elegí el PDF. También podés cargarla
              a mano si preferís.
            </Paso>
            <Paso n={3}>
              Esperá unos segundos: la app lee la factura sola y completa
              proveedor, monto, período y vencimientos.
            </Paso>
            <Paso n={4}>
              <strong>Revisá lo que completó</strong> y corregí lo que haga
              falta. Nada se guarda hasta que vos lo confirmás.
            </Paso>
            <Paso n={5}>
              Tocá guardar. La factura queda en <strong>Por pagar</strong> con su
              vencimiento.
            </Paso>
          </Tema>

          <Tema titulo="¿Qué significan los símbolos de colores al lado de cada campo?">
            <p>
              Cuando la app lee una factura sola, te muestra qué tan segura está
              de cada dato. Sirve para que sepas dónde mirar:
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              <span>
                <strong>Tilde verde:</strong> el dato se leyó con confianza alta.
                Igual conviene darle una mirada rápida.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-600">
                ~
              </span>
              <span>
                <strong>Virgulilla ámbar:</strong> confianza media.{" "}
                <strong>Revisalo</strong> antes de guardar.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008Z" />
                </svg>
              </span>
              <span>
                <strong>Signo de exclamación:</strong> no se pudo leer bien o no
                se leyó. Completalo vos.
              </span>
            </p>
            <p className="pt-1">
              La app aprende de tus correcciones: si arreglás el nombre de un
              proveedor, la próxima vez ya lo va a escribir bien.
            </p>
          </Tema>

          <Tema titulo="¿Cómo registro que pagué una factura?">
            <Paso n={1}>
              Entrá a <strong>Comprobantes</strong> y tocá{" "}
              <strong>Registrar pago</strong>.
            </Paso>
            <Paso n={2}>
              Elegí de la lista cuál de tus facturas pendientes estás pagando.
            </Paso>
            <Paso n={3}>
              Subí el comprobante (la captura de la transferencia o el ticket).
            </Paso>
            <Paso n={4}>
              Guardá. La factura pasa a <strong>pagada</strong> y queda unida a su
              comprobante.
            </Paso>
            <p className="pt-1">
              ¿Pagaste algo que nunca cargaste como factura? Usá la opción{" "}
              <strong>sin factura previa</strong>: se registra el pago igual.
            </p>
          </Tema>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-gray-900">
            Funciones
          </h2>

          <Tema titulo="¿Cuándo me avisa la app?">
            <p>Las notificaciones (la campanita) aparecen en cuatro casos:</p>
            <p>
              <strong>Vencimiento cerca:</strong> según los días de anticipación
              que hayas configurado en Perfil.
            </p>
            <p>
              <strong>Monto raro:</strong> si una factura viene bastante más cara
              que lo habitual de ese proveedor. La app compara con tus últimos
              meses y también con el mismo mes del año pasado, así no te avisa de
              más cuando el gas sube en invierno porque sí.
            </p>
            <p>
              <strong>Presupuesto:</strong> cuando llegás al 90 % del límite
              mensual que cargaste.
            </p>
            <p>
              <strong>Resumen del mes:</strong> un repaso de cómo cerró el mes.
            </p>
          </Tema>

          <Tema titulo="Me reclaman una deuda que ya pagué. ¿Qué hago?">
            <Paso n={1}>
              Entrá a <strong>Comprobantes</strong> y buscá el pago (podés filtrar
              por proveedor, categoría o mes).
            </Paso>
            <Paso n={2}>
              Abrilo y tocá <strong>Reporte de evidencia</strong>.
            </Paso>
            <Paso n={3}>
              Se genera un PDF con los datos del pago, la imagen del comprobante
              y tu historial con ese proveedor. Ese archivo es el que presentás.
            </Paso>
          </Tema>

          <Tema titulo="¿Puedo corregir o borrar algo que cargué mal?">
            <p>
              Sí. Tanto las facturas como los comprobantes se pueden editar o
              eliminar desde su listado. Antes de borrar algo siempre te
              preguntamos para confirmar, y te avisamos si al borrar una factura
              también se va a borrar el pago asociado.
            </p>
          </Tema>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-gray-900">
            Privacidad
          </h2>

          <Tema titulo="¿Quién puede ver mis facturas?">
            <p>
              Solo vos. Tus facturas, comprobantes e imágenes están asociados a
              tu cuenta y nadie más puede acceder a ellos, ni siquiera conociendo
              su dirección.
            </p>
            <p>
              Para leer una factura automáticamente, la imagen se envía a un
              servicio de inteligencia artificial que la interpreta. No se manda
              junto con ella ningún dato tuyo: ni tu nombre, ni tu correo, ni el
              resto de tu información.
            </p>
            <p>
              Si querés, podés no usar la lectura automática y cargar las
              facturas a mano: la app funciona igual.
            </p>
          </Tema>

          <Tema titulo="¿Cómo elimino mi cuenta?">
            <p>
              Desde <strong>Perfil</strong>, al final de la página. Se borran tus
              facturas, comprobantes e imágenes junto con la cuenta. Es
              irreversible, así que descargá antes lo que quieras conservar.
            </p>
          </Tema>
        </div>

        <p className="px-1 pb-2 text-center text-xs leading-relaxed text-gray-400">
          ¿Te quedó una duda que no está acá? Escribinos y la sumamos a esta
          página.
        </p>
      </div>
    </>
  );
}
