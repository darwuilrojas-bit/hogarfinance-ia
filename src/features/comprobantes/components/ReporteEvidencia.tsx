"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { imagenParaReporte, vistaPrevia } from "@/lib/vistaPrevia";
import { Button } from "@/components/ui/Button";
import { formatMonto, formatMontoCompacto, MESES, MESES_CORTOS } from "@/lib/formato";
import { CATEGORIAS } from "@/lib/supabase/types";
import { generarReportePdf } from "../lib/generarReportePdf";
import type { ComprobanteReporte } from "../lib/generarReportePdf";

type FilaComprobante = ComprobanteReporte & {
  id: string;
  imagen_url: string | null;
};

type Datos = {
  titular: string;
  comprobante: FilaComprobante;
  historial: FilaComprobante[];
  /** Vista previa del comprobante de pago (los PDFs ya vienen convertidos). */
  urlImagen: string | null;
  /** Vista previa de la factura reclamada. */
  urlFactura: string | null;
  /** Ruta de la factura en Storage, para volver a convertirla al exportar. */
  rutaFactura: string | null;
};

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const f = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return `${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()} de ${f.getFullYear()}`;
}

/**
 * Vista previa del Reporte de Evidencia de Pago: muestra cómo va a
 * quedar el PDF, permite elegir si incluir el historial completo y
 * lo genera con jsPDF directamente en el navegador.
 */
export function ReporteEvidencia({ comprobanteId }: { comprobanteId: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incluirHistorial, setIncluirHistorial] = useState(true);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const [comprobanteRes, perfilRes] = await Promise.all([
        supabase
          .from("comprobantes_pago")
          .select(
            "id, monto, fecha_pago, metodo_pago, numero_operacion, imagen_url, fecha_creacion, factura:facturas(proveedor, categoria, periodo_mes, periodo_anio, estado, numero_comprobante, imagen_url)"
          )
          .eq("id", comprobanteId)
          .maybeSingle(),
        supabase.from("usuarios").select("nombre, email").single(),
      ]);
      if (cancelado) return;
      const fila = comprobanteRes.data;
      if (!fila || !fila.factura) {
        setError("No se encontró el comprobante.");
        return;
      }
      const f = Array.isArray(fila.factura) ? fila.factura[0] : fila.factura;
      const comprobante: FilaComprobante = {
        id: fila.id,
        proveedor: f.proveedor,
        categoria: f.categoria,
        periodo_mes: f.periodo_mes,
        periodo_anio: f.periodo_anio,
        estado: f.estado,
        numero_factura: f.numero_comprobante,
        monto: Number(fila.monto),
        fecha_pago: fila.fecha_pago,
        metodo_pago: fila.metodo_pago,
        numero_operacion: fila.numero_operacion,
        imagen_url: fila.imagen_url,
        fecha_creacion: fila.fecha_creacion,
      };

      const { data: historialData } = await supabase
        .from("comprobantes_pago")
        .select(
          "id, monto, fecha_pago, metodo_pago, numero_operacion, imagen_url, fecha_creacion, factura:facturas!inner(proveedor, categoria, periodo_mes, periodo_anio, estado, numero_comprobante)"
        )
        .eq("factura.proveedor", comprobante.proveedor)
        .order("fecha_pago", { ascending: false });
      if (cancelado) return;

      const historial: FilaComprobante[] = ((historialData ?? []) as Array<
        Record<string, unknown>
      >)
        .filter((h) => h.id !== comprobante.id)
        .map((h) => {
          const hf = Array.isArray(h.factura) ? h.factura[0] : h.factura;
          const hfObj = hf as {
            proveedor: string;
            categoria: FilaComprobante["categoria"];
            periodo_mes: number;
            periodo_anio: number;
            estado: FilaComprobante["estado"];
            numero_comprobante: string | null;
          };
          return {
            id: h.id as string,
            proveedor: hfObj.proveedor,
            categoria: hfObj.categoria,
            periodo_mes: hfObj.periodo_mes,
            periodo_anio: hfObj.periodo_anio,
            estado: hfObj.estado,
            numero_factura: hfObj.numero_comprobante,
            monto: Number(h.monto),
            fecha_pago: h.fecha_pago as string,
            metodo_pago: h.metodo_pago as string | null,
            numero_operacion: h.numero_operacion as string | null,
            imagen_url: h.imagen_url as string | null,
            fecha_creacion: h.fecha_creacion as string,
          };
        });

      // Los PDFs se convierten a imagen al vuelo, así el reporte puede
      // mostrarlos igual que una foto y sin guardar una copia aparte.
      const rutaFactura =
        (Array.isArray(fila.factura) ? fila.factura[0] : fila.factura)
          ?.imagen_url ?? null;
      const [urlImagen, urlFactura] = await Promise.all([
        vistaPrevia(supabase, comprobante.imagen_url),
        vistaPrevia(supabase, rutaFactura),
      ]);
      if (cancelado) return;

      setDatos({
        titular:
          perfilRes.data?.nombre?.trim() ||
          perfilRes.data?.email ||
          "Titular de la cuenta",
        comprobante,
        historial,
        urlImagen,
        urlFactura,
        rutaFactura,
      });
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [comprobanteId]);

  async function descargar() {
    if (!datos) return;
    setGenerando(true);
    setError(null);
    try {
      // Las dos imágenes, medidas y en dataURL, listas para jsPDF.
      const supabase = createClient();
      const [imagen, imagenFactura] = await Promise.all([
        imagenParaReporte(supabase, datos.comprobante.imagen_url),
        imagenParaReporte(supabase, datos.rutaFactura),
      ]);

      generarReportePdf({
        titular: datos.titular,
        comprobante: datos.comprobante,
        historial: datos.historial,
        imagen,
        imagenFactura,
        incluirHistorial,
      });
    } catch {
      setError("No se pudo generar el PDF. Intentá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  if (error && !datos) {
    return (
      <p className="mx-5 my-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (!datos) {
    return (
      <div className="flex flex-col gap-3 px-5 py-5">
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const c = datos.comprobante;

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* Alcance del reporte */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">
          Contenido del reporte
        </span>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setIncluirHistorial(false)}
            aria-pressed={!incluirHistorial}
            className={`h-10 rounded-lg text-xs font-semibold transition-colors ${
              !incluirHistorial ? "bg-primary text-white" : "text-gray-500"
            }`}
          >
            Solo este pago
          </button>
          <button
            type="button"
            onClick={() => setIncluirHistorial(true)}
            aria-pressed={incluirHistorial}
            className={`h-10 rounded-lg text-xs font-semibold transition-colors ${
              incluirHistorial ? "bg-primary text-white" : "text-gray-500"
            }`}
          >
            Con historial completo
          </button>
        </div>
      </div>

      {/* Vista previa del reporte */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Encabezado del reporte */}
        <div className="border-b-2 border-secondary px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12 11.2 3.05a1.125 1.125 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">HogarFinance IA</p>
              <p className="text-[10px] text-gray-500">
                Gestión inteligente de finanzas del hogar
              </p>
            </div>
          </div>
          <h2 className="mt-3 text-lg font-bold text-primary">
            Reporte de Evidencia de Pago
          </h2>
          <p className="text-[10px] text-gray-500">
            Se genera con la fecha y hora del momento de la descarga
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Titular */}
          <section>
            <h3 className="mb-1.5 border-l-2 border-secondary pl-2 text-[11px] font-bold uppercase tracking-wide text-gray-900">
              Datos del titular
            </h3>
            <p className="pl-2 text-sm text-gray-800">{datos.titular}</p>
          </section>

          {/* Pago reclamado */}
          <section>
            <h3 className="mb-1.5 border-l-2 border-secondary pl-2 text-[11px] font-bold uppercase tracking-wide text-gray-900">
              Datos del pago reclamado
            </h3>
            <dl className="flex flex-col gap-1 pl-2 text-xs">
              {[
                ["Proveedor", c.proveedor],
                ["Categoría", CATEGORIAS[c.categoria]],
                ["Período", `${MESES[c.periodo_mes - 1]} ${c.periodo_anio}`],
                ["Fecha de pago", fechaLegible(c.fecha_pago)],
                ["Monto pagado", formatMonto(Number(c.monto))],
                ["Método de pago", c.metodo_pago ?? "—"],
                ["N° de factura", c.numero_factura ?? "—"],
                ["N° de operación", c.numero_operacion ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-right font-semibold text-gray-900">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Comprobante */}
          <section>
            <h3 className="mb-1.5 border-l-2 border-secondary pl-2 text-[11px] font-bold uppercase tracking-wide text-gray-900">
              Factura reclamada
            </h3>
            {datos.urlFactura ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={datos.urlFactura}
                alt={`Factura de ${c.proveedor}`}
                className="max-h-64 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain"
              />
            ) : (
              <p className="pl-2 text-xs italic text-gray-500">
                Esta factura no tiene archivo adjunto; el reporte lo indica.
              </p>
            )}

            <h3 className="mb-1.5 mt-4 border-l-2 border-secondary pl-2 text-[11px] font-bold uppercase tracking-wide text-gray-900">
              Comprobante de pago
            </h3>
            {datos.urlImagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={datos.urlImagen}
                alt={`Comprobante de ${c.proveedor}`}
                className="max-h-64 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain"
              />
            ) : (
              <p className="pl-2 text-xs italic text-gray-500">
                Este pago no tiene comprobante adjunto; el reporte lo indica.
              </p>
            )}
            <p className="mt-1.5 text-center text-[10px] italic text-secondary">
              Comprobante registrado en HogarFinance IA el{" "}
              {fechaLegible(c.fecha_creacion)}
            </p>
          </section>

          {/* Historial */}
          {incluirHistorial ? (
            <section>
              <h3 className="mb-1.5 border-l-2 border-secondary pl-2 text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Historial de pagos al mismo proveedor
              </h3>
              {datos.historial.length === 0 ? (
                <p className="pl-2 text-xs italic text-gray-500">
                  No hay otros pagos registrados de {c.proveedor}.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-primary text-left text-white">
                        <th className="px-2.5 py-1.5 font-semibold">Período</th>
                        <th className="px-2.5 py-1.5 font-semibold">Pago</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.historial.map((h) => (
                        <tr
                          key={h.id}
                          className="border-t border-gray-50 text-gray-700 odd:bg-white even:bg-primary-light/40"
                        >
                          <td className="px-2.5 py-1.5">
                            {MESES_CORTOS[h.periodo_mes - 1]} {h.periodo_anio}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {fechaLegible(h.fecha_pago)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-medium">
                            {formatMontoCompacto(Number(h.monto))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          <p className="border-t border-gray-100 pt-3 text-center text-[10px] italic text-gray-400">
            Este reporte fue generado por HogarFinance IA como evidencia de
            pago registrada digitalmente.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button onClick={descargar} loading={generando}>
        Descargar reporte PDF
      </Button>
      <p className="-mt-2 text-center text-[11px] text-gray-400">
        Se descarga como Evidencia_
        {c.proveedor.replace(/[^a-zA-Z0-9]+/g, "_")}_
        {String(c.periodo_mes).padStart(2, "0")}-{c.periodo_anio}.pdf
      </p>
    </div>
  );
}
