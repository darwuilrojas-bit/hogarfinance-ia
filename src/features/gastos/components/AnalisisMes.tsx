"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMontoCompacto, MESES, sumarMeses } from "@/lib/formato";
import type { Periodo } from "@/lib/formato";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";

type PagoLiviano = {
  monto: number;
  periodo_mes: number;
  periodo_anio: number;
  categoria: Categoria;
};

/**
 * Panel de análisis del mes: desglose por categoría, variación
 * contra el mes anterior y promedio mensual del año en curso.
 * Sobre los pagos efectivamente registrados (comprobantes_pago).
 */
export function AnalisisMes({ periodo }: { periodo: Periodo }) {
  const [pagos, setPagos] = useState<PagoLiviano[] | null>(null);

  const anterior = sumarMeses(periodo, -1);
  const anioActual = new Date().getFullYear();

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const anios = [
        ...new Set([periodo.anio, sumarMeses(periodo, -1).anio, anioActual]),
      ];
      const { data } = await supabase
        .from("comprobantes_pago")
        .select(
          "monto, factura:facturas!inner(categoria, periodo_mes, periodo_anio)"
        )
        .in("factura.periodo_anio", anios);
      if (cancelado) return;
      const lista = ((data ?? []) as unknown as Array<{
        monto: number;
        factura: PagoLiviano | PagoLiviano[];
      }>).map((p) => {
        const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
        return {
          monto: Number(p.monto),
          periodo_mes: f.periodo_mes,
          periodo_anio: f.periodo_anio,
          categoria: f.categoria,
        };
      });
      setPagos(lista);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [periodo, anioActual]);

  if (pagos === null) {
    return <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />;
  }

  const de = (p: Periodo) =>
    pagos.filter((g) => g.periodo_mes === p.mes && g.periodo_anio === p.anio);

  // Desglose por categoría del mes seleccionado
  const delMes = de(periodo);
  const totalMes = delMes.reduce((s, g) => s + Number(g.monto), 0);
  const porCategoria = (Object.keys(CATEGORIAS) as Categoria[])
    .map((c) => ({
      categoria: c,
      total: delMes
        .filter((g) => g.categoria === c)
        .reduce((s, g) => s + Number(g.monto), 0),
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  // Variación contra el mes anterior
  const totalAnterior = de(anterior).reduce((s, g) => s + Number(g.monto), 0);
  const variacion =
    totalAnterior > 0 ? ((totalMes - totalAnterior) / totalAnterior) * 100 : null;

  // Promedio mensual del año en curso (meses con pagos)
  const pagosAnio = pagos.filter((g) => g.periodo_anio === anioActual);
  const mesesConDatos = new Set(pagosAnio.map((g) => g.periodo_mes));
  const promedioMensual =
    mesesConDatos.size > 0
      ? pagosAnio.reduce((s, g) => s + Number(g.monto), 0) / mesesConDatos.size
      : null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Análisis de {MESES[periodo.mes - 1].toLowerCase()}
      </h2>

      {/* Desglose por categoría */}
      {porCategoria.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Sin pagos este mes para analizar.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {porCategoria.map((x) => {
            const pct = Math.round((x.total / totalMes) * 100);
            return (
              <li key={x.categoria}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">
                    {CATEGORIAS[x.categoria]}
                  </span>
                  <span className="text-gray-500">
                    {formatMontoCompacto(x.total)} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Variación y promedio */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] text-gray-500">Vs. mes anterior</p>
          {variacion === null ? (
            <p className="mt-0.5 text-sm font-semibold text-gray-400">
              Sin datos
            </p>
          ) : (
            <p
              className={`mt-0.5 flex items-center gap-1 text-lg font-bold ${
                variacion > 0 ? "text-red-600" : "text-secondary"
              }`}
            >
              <svg
                className={`h-4 w-4 ${variacion > 0 ? "" : "rotate-180"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
              </svg>
              {Math.abs(Math.round(variacion))}%
            </p>
          )}
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] text-gray-500">
            Promedio mensual {anioActual}
          </p>
          <p className="mt-0.5 text-lg font-bold text-gray-900">
            {promedioMensual === null
              ? "—"
              : formatMontoCompacto(promedioMensual)}
          </p>
        </div>
      </div>
    </section>
  );
}
