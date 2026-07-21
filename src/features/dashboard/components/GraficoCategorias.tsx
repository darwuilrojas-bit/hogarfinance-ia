"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMontoCompacto,
  MESES,
  MESES_CORTOS,
  periodoActual,
  ultimosPeriodos,
} from "@/lib/formato";
import type { Periodo } from "@/lib/formato";

// Paleta categórica validada (CVD y contraste) con validate_palette.js
const SERIES = [
  { categoria: "electricidad", etiqueta: "Electricidad", color: "#D97706" },
  { categoria: "agua", etiqueta: "Agua", color: "#1F6FEB" },
  { categoria: "gas", etiqueta: "Gas", color: "#EC4899" },
  { categoria: "internet", etiqueta: "Internet", color: "#0D9276" },
] as const;

type CategoriaSerie = (typeof SERIES)[number]["categoria"];

type MesDatos = {
  periodo: Periodo;
  totales: Record<CategoriaSerie, number>;
};

type Seleccion = {
  mesIdx: number;
  categoria: CategoriaSerie;
};

const ALTO_PLOT = 128; // px

/**
 * Gráfico de barras agrupadas: gastos por categoría de servicio en
 * los últimos 6 meses, con leyenda, tooltip e insight automático.
 */
export function GraficoCategorias() {
  const [datos, setDatos] = useState<MesDatos[] | null>(null);
  const [sel, setSel] = useState<Seleccion | null>(null);

  const periodos = useMemo(() => ultimosPeriodos(periodoActual(), 6), []);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const anios = [...new Set(periodos.map((p) => p.anio))];
      const { data } = await supabase
        .from("comprobantes_pago")
        .select(
          "monto, factura:facturas!inner(categoria, periodo_mes, periodo_anio)"
        )
        .in("factura.categoria", SERIES.map((s) => s.categoria))
        .in("factura.periodo_anio", anios);
      if (cancelado) return;

      const porMes: MesDatos[] = periodos.map((periodo) => ({
        periodo,
        totales: { electricidad: 0, agua: 0, gas: 0, internet: 0 },
      }));
      for (const p of data ?? []) {
        const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
        const idx = periodos.findIndex(
          (per) => per.mes === f.periodo_mes && per.anio === f.periodo_anio
        );
        if (idx >= 0) {
          porMes[idx].totales[f.categoria as CategoriaSerie] += Number(p.monto);
        }
      }
      setDatos(porMes);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [periodos]);

  const maximo = useMemo(
    () =>
      datos
        ? Math.max(
            ...datos.flatMap((m) => SERIES.map((s) => m.totales[s.categoria]))
          )
        : 0,
    [datos]
  );

  const hayDatos = maximo > 0;

  // Insight: mayor categoría del mes más reciente con datos
  const insight = useMemo(() => {
    if (!datos || !hayDatos) return null;
    for (let i = datos.length - 1; i >= 0; i--) {
      const totales = datos[i].totales;
      const totalMes = SERIES.reduce((s, c) => s + totales[c.categoria], 0);
      if (totalMes === 0) continue;
      const mayor = SERIES.reduce((a, b) =>
        totales[a.categoria] >= totales[b.categoria] ? a : b
      );
      const pct = Math.round((totales[mayor.categoria] / totalMes) * 100);
      return `En ${MESES[datos[i].periodo.mes - 1].toLowerCase()}, ${mayor.etiqueta} fue tu mayor gasto de servicios (${pct}% del total).`;
    }
    return null;
  }, [datos, hayDatos]);

  const selDatos =
    sel && datos ? datos[sel.mesIdx] : null;
  const selSerie = sel
    ? SERIES.find((s) => s.categoria === sel.categoria)!
    : null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Gastos por categoría · últimos 6 meses
      </h2>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {datos === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        ) : !hayDatos ? (
          <div className="px-2 py-8 text-center text-sm text-gray-400">
            Registrá tus primeros gastos de servicios para ver el análisis.
          </div>
        ) : (
          <>
            {/* Tooltip / detalle de la barra seleccionada */}
            <div className="mb-2 flex h-6 items-center text-xs text-gray-600">
              {selDatos && selSerie ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: selSerie.color }}
                  />
                  {MESES_CORTOS[selDatos.periodo.mes - 1]}:{" "}
                  <strong className="text-gray-900">
                    {selSerie.etiqueta}{" "}
                    {formatMontoCompacto(selDatos.totales[selSerie.categoria])}
                  </strong>
                </span>
              ) : (
                <span className="text-gray-400">
                  Tocá una barra para ver el detalle
                </span>
              )}
            </div>

            {/* Plot */}
            <div
              className="flex items-end justify-between border-b border-gray-200"
              style={{ height: ALTO_PLOT }}
              onMouseLeave={() => setSel(null)}
            >
              {datos.map((m, mesIdx) => (
                <div
                  key={`${m.periodo.anio}-${m.periodo.mes}`}
                  className="flex items-end gap-0.5"
                  style={{ height: ALTO_PLOT }}
                >
                  {SERIES.map((s) => {
                    const valor = m.totales[s.categoria];
                    const alto =
                      valor > 0
                        ? Math.max((valor / maximo) * ALTO_PLOT, 3)
                        : 0;
                    const activa =
                      sel?.mesIdx === mesIdx && sel.categoria === s.categoria;
                    return (
                      <button
                        key={s.categoria}
                        aria-label={`${s.etiqueta}, ${MESES[m.periodo.mes - 1]}: ${formatMontoCompacto(valor)}`}
                        onMouseEnter={() =>
                          setSel({ mesIdx, categoria: s.categoria })
                        }
                        onFocus={() =>
                          setSel({ mesIdx, categoria: s.categoria })
                        }
                        onClick={() =>
                          setSel({ mesIdx, categoria: s.categoria })
                        }
                        className="flex w-2 items-end self-end outline-none"
                        style={{ height: ALTO_PLOT }}
                      >
                        <span
                          className="w-full rounded-t"
                          style={{
                            height: alto,
                            background: s.color,
                            opacity: sel === null || activa ? 1 : 0.35,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Etiquetas de meses */}
            <div className="mt-1.5 flex justify-between">
              {datos.map((m) => (
                <span
                  key={`l-${m.periodo.anio}-${m.periodo.mes}`}
                  className="w-9 text-center text-[10px] text-gray-500"
                >
                  {MESES_CORTOS[m.periodo.mes - 1]}
                </span>
              ))}
            </div>

            {/* Leyenda */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {SERIES.map((s) => (
                <span
                  key={s.categoria}
                  className="flex items-center gap-1.5 text-xs text-gray-600"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.etiqueta}
                </span>
              ))}
            </div>

            {/* Insight automático */}
            {insight ? (
              <p className="mt-3 rounded-xl bg-primary-light px-3 py-2.5 text-xs leading-relaxed text-primary-dark">
                💡 {insight}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
