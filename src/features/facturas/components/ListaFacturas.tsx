"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import { formatMonto, formatMontoCompacto, MESES_CORTOS, periodoActual } from "@/lib/formato";
import { BUCKET_COMPROBANTES, CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria, EstadoFactura, Factura } from "@/lib/supabase/types";
import {
  diasHasta,
  textoDias,
  urgenciaPorDias,
  vencimientoEfectivo,
} from "@/features/alertas/lib/vencimientos";

const CHIP_ESTADO: Record<EstadoFactura, string> = {
  pagado: "bg-secondary-light text-secondary",
  pendiente: "bg-amber-100 text-amber-700",
  reclamado: "bg-red-50 text-red-600",
};

const ETIQUETA_ESTADO: Record<EstadoFactura, string> = {
  pagado: "Pagada",
  pendiente: "Pendiente",
  reclamado: "Reclamada",
};

function fechaCorta(fecha: Date): string {
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

/**
 * Pantalla de Facturas: pendientes ordenadas por urgencia (1er o 2do
 * vencimiento, el que corresponda) y pagadas del mes. Desde acá se
 * carga una factura nueva, se edita, se elimina o se manda a pagar
 * (lleva al panel de Comprobantes con la factura preseleccionada).
 */
export function ListaFacturas() {
  const router = useRouter();
  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("facturas")
        .select("*")
        .order("periodo_anio", { ascending: false })
        .order("periodo_mes", { ascending: false })
        .limit(500);
      if (cancelado) return;
      setFacturas((data as Factura[]) ?? []);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [version]);

  async function eliminar(f: Factura) {
    if (
      !window.confirm(
        `¿Eliminar la factura de ${f.proveedor}? Si ya tiene un pago registrado, también se borra.`
      )
    )
      return;
    const supabase = createClient();

    // Si ya tiene pago registrado, también hay que borrar la imagen
    // de ESE comprobante (la fila cae sola en cascada al borrar la factura)
    const rutas: string[] = [];
    if (f.imagen_url) rutas.push(f.imagen_url);
    if (f.estado !== "pendiente") {
      const { data: pagos } = await supabase
        .from("comprobantes_pago")
        .select("imagen_url")
        .eq("factura_id", f.id);
      for (const p of pagos ?? []) {
        if (p.imagen_url) rutas.push(p.imagen_url);
      }
    }

    await supabase.from("facturas").delete().eq("id", f.id);
    if (rutas.length > 0) {
      await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas);
    }
    setVersion((v) => v + 1);
  }

  if (facturas === null) {
    return (
      <div className="flex flex-col gap-2 px-5 py-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const hoy = new Date();
  const { mes, anio } = periodoActual();

  const pendientes = facturas
    .filter((f) => f.estado === "pendiente" && f.fecha_vencimiento)
    .map((f) => {
      const fecha = vencimientoEfectivo(
        f.fecha_vencimiento!,
        f.fecha_vencimiento_2,
        hoy
      );
      return { ...f, fecha, dias: diasHasta(fecha, hoy) };
    })
    .sort((a, b) => a.dias - b.dias);

  const sinVencimiento = facturas.filter(
    (f) => f.estado === "pendiente" && !f.fecha_vencimiento
  );

  const pagadasDelMes = facturas.filter(
    (f) =>
      f.estado !== "pendiente" &&
      f.periodo_mes === mes &&
      f.periodo_anio === anio
  );

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <Link
        href="/facturas/nueva"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-colors active:bg-primary-dark"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar factura
      </Link>

      {/* Pendientes, ordenadas por urgencia */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Por pagar
        </h2>
        {pendientes.length === 0 && sinVencimiento.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
            No tenés facturas pendientes. Cargá una con el botón de arriba
            apenas te llegue.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((f) => {
              const urgencia = urgenciaPorDias(f.dias);
              const abierto = expandido === f.id;
              return (
                <li
                  key={f.id}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpandido(abierto ? null : f.id)}
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${urgencia.fondo} ${urgencia.texto}`}
                    >
                      <CategoriaIcon categoria={f.categoria} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {f.proveedor}
                      </p>
                      <p className="text-xs text-gray-500">
                        Vence el {fechaCorta(f.fecha)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${urgencia.texto}`}>
                        {textoDias(f.dias)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatMontoCompacto(Number(f.monto))}
                      </p>
                    </div>
                  </button>

                  {abierto ? (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <dl className="mb-3 flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Categoría</dt>
                          <dd className="font-medium text-gray-800">
                            {CATEGORIAS[f.categoria]}
                          </dd>
                        </div>
                        {f.numero_comprobante ? (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">N° de factura</dt>
                            <dd className="font-medium text-gray-800">
                              {f.numero_comprobante}
                            </dd>
                          </div>
                        ) : null}
                        {f.notas ? (
                          <div>
                            <dt className="text-gray-500">Notas</dt>
                            <dd className="mt-0.5 text-gray-800">{f.notas}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/comprobantes/nuevo?factura=${f.id}`)
                          }
                          className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-white active:bg-secondary-dark"
                        >
                          Registrar pago
                        </button>
                        <Link
                          href={`/facturas/editar/${f.id}`}
                          className="rounded-xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => eliminar(f)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}

            {sinVencimiento.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                  <CategoriaIcon categoria={f.categoria} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {f.proveedor}
                  </p>
                  <p className="text-xs text-amber-600">Sin vencimiento cargado</p>
                </div>
                <Link
                  href={`/facturas/editar/${f.id}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
                  aria-label={`Editar ${f.proveedor}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pagadas / reclamadas este mes */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Resueltas este mes
        </h2>
        {pagadasDelMes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
            Todavía no pagaste facturas de este período.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pagadasDelMes.map((f) => {
              const abierto = expandido === `pagada-${f.id}`;
              return (
                <li
                  key={f.id}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandido(abierto ? null : `pagada-${f.id}`)
                    }
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-light text-secondary">
                      <CategoriaIcon categoria={f.categoria as Categoria} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {f.proveedor}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_ESTADO[f.estado]}`}
                      >
                        {ETIQUETA_ESTADO[f.estado]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatMonto(Number(f.monto))}
                    </p>
                  </button>

                  {abierto ? (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <p className="mb-3 text-xs text-gray-500">
                        El comprobante de pago se ve y se descarga desde la
                        sección Comprobantes.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/facturas/editar/${f.id}`}
                          className="rounded-xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => eliminar(f)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
