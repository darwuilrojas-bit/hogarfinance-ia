"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import {
  formatMontoCompacto,
  MESES,
  MESES_CORTOS,
  periodoActual,
  sumarMeses,
  ultimosPeriodos,
} from "@/lib/formato";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";

type GastoRow = {
  monto: number;
  categoria: Categoria;
  proveedor: string;
  periodo_mes: number;
  periodo_anio: number;
};

type FacturaEmbebida = {
  categoria: Categoria;
  proveedor: string;
  periodo_mes: number;
  periodo_anio: number;
};

const RANGOS = [3, 6, 12] as const;
const ALTO_PLOT = 120; // px

/**
 * Pantalla de Reportes: análisis de gastos por período y categoría
 * con evolución mensual, top de proveedores e insights automáticos.
 * Todos los cálculos se hacen sobre los gastos pagados del usuario.
 */
export function ResumenReportes() {
  const [gastos, setGastos] = useState<GastoRow[] | null>(null);
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(6);
  const [selMes, setSelMes] = useState<number | null>(null);

  // Los 12 meses cubren todos los rangos: se consulta una sola vez
  const periodos12 = useMemo(() => ultimosPeriodos(periodoActual(), 12), []);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const anios = [...new Set(periodos12.map((p) => p.anio))];
      const { data } = await supabase
        .from("comprobantes_pago")
        .select(
          "monto, factura:facturas!inner(categoria, proveedor, periodo_mes, periodo_anio)"
        )
        .in("factura.periodo_anio", anios);
      if (cancelado) return;
      const lista = ((data ?? []) as unknown as Array<{
        monto: number;
        factura: FacturaEmbebida | FacturaEmbebida[];
      }>).map((p) => {
        const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
        return { monto: Number(p.monto), ...f };
      });
      setGastos(lista);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [periodos12]);

  const analisis = useMemo(() => {
    if (!gastos) return null;
    const periodos = ultimosPeriodos(periodoActual(), rango);
    const enRango = (g: GastoRow) =>
      periodos.some(
        (p) => p.mes === g.periodo_mes && p.anio === g.periodo_anio
      );
    const delRango = gastos.filter(enRango);

    // Evolución mensual
    const porMes = periodos.map((p) => ({
      periodo: p,
      total: gastos
        .filter((g) => g.periodo_mes === p.mes && g.periodo_anio === p.anio)
        .reduce((s, g) => s + Number(g.monto), 0),
    }));
    const maxMes = Math.max(...porMes.map((m) => m.total));

    // Totales generales
    const total = delRango.reduce((s, g) => s + Number(g.monto), 0);
    const mesesConDatos = porMes.filter((m) => m.total > 0).length;
    const promedio = mesesConDatos > 0 ? total / mesesConDatos : 0;

    // Variación: mes actual vs anterior
    const actual = periodoActual();
    const anterior = sumarMeses(actual, -1);
    const totalDe = (p: { mes: number; anio: number }) =>
      gastos
        .filter((g) => g.periodo_mes === p.mes && g.periodo_anio === p.anio)
        .reduce((s, g) => s + Number(g.monto), 0);
    const totalActual = totalDe(actual);
    const totalAnterior = totalDe(anterior);
    const variacion =
      totalAnterior > 0
        ? Math.round((totalActual / totalAnterior - 1) * 100)
        : null;

    // Por categoría
    const porCategoria = (Object.keys(CATEGORIAS) as Categoria[])
      .map((c) => ({
        categoria: c,
        total: delRango
          .filter((g) => g.categoria === c)
          .reduce((s, g) => s + Number(g.monto), 0),
      }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);

    // Top proveedores
    const acumulado = new Map<string, number>();
    for (const g of delRango) {
      acumulado.set(g.proveedor, (acumulado.get(g.proveedor) ?? 0) + Number(g.monto));
    }
    const topProveedores = [...acumulado.entries()]
      .map(([nombre, t]) => ({ nombre, total: t }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Insights automáticos
    const insights: string[] = [];
    if (porCategoria.length > 0 && total > 0) {
      const mayor = porCategoria[0];
      insights.push(
        `${CATEGORIAS[mayor.categoria]} fue tu mayor gasto: ${formatMontoCompacto(mayor.total)} (${Math.round((mayor.total / total) * 100)}% del período).`
      );
    }
    const pico = porMes.reduce((a, b) => (b.total > a.total ? b : a), porMes[0]);
    if (pico && pico.total > 0) {
      insights.push(
        `Tu mes de mayor gasto fue ${MESES[pico.periodo.mes - 1].toLowerCase()} ${pico.periodo.anio} con ${formatMontoCompacto(pico.total)}.`
      );
    }
    if (variacion !== null && variacion !== 0) {
      insights.push(
        variacion > 0
          ? `Este mes venís gastando un ${variacion}% más que en ${MESES[anterior.mes - 1].toLowerCase()}.`
          : `Este mes venís gastando un ${Math.abs(variacion)}% menos que en ${MESES[anterior.mes - 1].toLowerCase()}. 👏`
      );
    }
    if (topProveedores.length > 0) {
      insights.push(
        `Tu proveedor más costoso del período es ${topProveedores[0].nombre} (${formatMontoCompacto(topProveedores[0].total)}).`
      );
    }

    return {
      periodos,
      porMes,
      maxMes,
      total,
      promedio,
      variacion,
      anterior,
      porCategoria,
      topProveedores,
      insights,
    };
  }, [gastos, rango]);

  if (analisis === null) {
    return (
      <div className="flex flex-col gap-3 px-5 py-5">
        <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const sinDatos = analisis.total === 0;

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* Selector de rango */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {RANGOS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRango(r);
              setSelMes(null);
            }}
            aria-pressed={rango === r}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
              rango === r ? "bg-primary text-white" : "text-gray-500"
            }`}
          >
            {r} meses
          </button>
        ))}
      </div>

      {sinDatos ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          No hay gastos pagados en los últimos {rango} meses. Registrá tus
          comprobantes para ver el análisis.
        </div>
      ) : (
        <>
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-primary p-3 text-white shadow-lg shadow-primary/25">
              <p className="text-[10px] opacity-80">Total período</p>
              <p className="mt-0.5 text-sm font-bold tracking-tight">
                {formatMontoCompacto(analisis.total)}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary p-3 text-white shadow-lg shadow-secondary/25">
              <p className="text-[10px] opacity-80">Promedio mensual</p>
              <p className="mt-0.5 text-sm font-bold tracking-tight">
                {formatMontoCompacto(analisis.promedio)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] text-gray-500">Vs. mes anterior</p>
              {analisis.variacion === null ? (
                <p className="mt-0.5 text-sm font-bold text-gray-400">—</p>
              ) : (
                <p
                  className={`mt-0.5 flex items-center gap-0.5 text-sm font-bold ${
                    analisis.variacion > 0 ? "text-red-600" : "text-secondary"
                  }`}
                >
                  <svg
                    className={`h-3.5 w-3.5 ${analisis.variacion > 0 ? "" : "rotate-180"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                  {Math.abs(analisis.variacion)}%
                </p>
              )}
            </div>
          </div>

          {/* Evolución mensual */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Evolución mensual
            </h2>
            <div className="mb-2 flex h-5 items-center text-xs text-gray-600">
              {selMes !== null && analisis.porMes[selMes] ? (
                <span>
                  {MESES[analisis.porMes[selMes].periodo.mes - 1]}{" "}
                  {analisis.porMes[selMes].periodo.anio}:{" "}
                  <strong className="text-gray-900">
                    {formatMontoCompacto(analisis.porMes[selMes].total)}
                  </strong>
                </span>
              ) : (
                <span className="text-gray-400">
                  Tocá una barra para ver el monto
                </span>
              )}
            </div>
            <div
              className="flex items-end justify-between gap-1 border-b border-gray-200"
              style={{ height: ALTO_PLOT }}
              onMouseLeave={() => setSelMes(null)}
            >
              {analisis.porMes.map((m, i) => {
                const alto =
                  m.total > 0
                    ? Math.max((m.total / analisis.maxMes) * ALTO_PLOT, 3)
                    : 0;
                const activa = selMes === i;
                return (
                  <button
                    key={`${m.periodo.anio}-${m.periodo.mes}`}
                    type="button"
                    aria-label={`${MESES[m.periodo.mes - 1]} ${m.periodo.anio}: ${formatMontoCompacto(m.total)}`}
                    onMouseEnter={() => setSelMes(i)}
                    onFocus={() => setSelMes(i)}
                    onClick={() => setSelMes(i)}
                    className="flex flex-1 items-end justify-center self-end outline-none"
                    style={{ height: ALTO_PLOT }}
                  >
                    <span
                      className="w-full max-w-6 rounded-t bg-primary"
                      style={{
                        height: alto,
                        opacity: selMes === null || activa ? 1 : 0.35,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between gap-1">
              {analisis.porMes.map((m) => (
                <span
                  key={`l-${m.periodo.anio}-${m.periodo.mes}`}
                  className="flex-1 text-center text-[9px] text-gray-500"
                >
                  {rango === 12
                    ? MESES_CORTOS[m.periodo.mes - 1].charAt(0)
                    : MESES_CORTOS[m.periodo.mes - 1]}
                </span>
              ))}
            </div>
          </section>

          {/* Desglose por categoría */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Gasto por categoría
            </h2>
            <ul className="flex flex-col gap-2.5">
              {analisis.porCategoria.map((x) => {
                const pct = Math.round((x.total / analisis.total) * 100);
                return (
                  <li key={x.categoria}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-gray-700">
                        <CategoriaIcon
                          categoria={x.categoria}
                          className="h-3.5 w-3.5"
                        />
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
          </section>

          {/* Top proveedores */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Proveedores con mayor gasto
            </h2>
            <ul className="flex flex-col">
              {analisis.topProveedores.map((p, i) => (
                <li
                  key={p.nombre}
                  className="flex items-center gap-3 border-b border-gray-50 py-2.5 last:border-b-0"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                    {p.nombre}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatMontoCompacto(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Insights automáticos */}
          {analisis.insights.length > 0 ? (
            <section className="rounded-2xl bg-primary-light p-4">
              <h2 className="mb-2 text-sm font-semibold text-primary-dark">
                💡 Resumen inteligente
              </h2>
              <ul className="flex list-inside list-disc flex-col gap-1.5 text-xs leading-relaxed text-primary-dark">
                {analisis.insights.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
