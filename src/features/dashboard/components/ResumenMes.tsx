"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMonto, MESES, periodoActual, sumarMeses } from "@/lib/formato";
import { rangoMes } from "@/lib/fechas";
import {
  guardarPresupuestoDelMes,
  presupuestoDelMes,
} from "@/lib/presupuestos";
import type { Periodo } from "@/lib/formato";

type Resumen = {
  total: number;
  presupuesto: number | null;
  /** true si el mes tiene un presupuesto propio, no el valor por defecto. */
  propio: boolean;
};

/**
 * Tarjeta de resumen del mes: total gastado (pagos hechos durante el mes
 * calendario, por fecha de pago), presupuesto del usuario, barra de
 * progreso y mensaje según el porcentaje usado.
 */
export function ResumenMes() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoActual);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault();
    const limpio = valor.trim().replace(/\./g, "").replace(",", ".");
    const monto = limpio === "" ? null : Number(limpio);
    if (monto !== null && (!Number.isFinite(monto) || monto < 0)) return;

    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await guardarPresupuestoDelMes(
        supabase,
        user.id,
        periodo.mes,
        periodo.anio,
        monto
      );
    }
    setGuardando(false);
    setEditando(false);
    setVersion((v) => v + 1);
  }

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      const supabase = createClient();
      const rango = rangoMes(periodo.mes, periodo.anio);
      const [presu, pagosRes] = await Promise.all([
        presupuestoDelMes(supabase, periodo.mes, periodo.anio),
        // Por fecha de pago: la plata sale del presupuesto del mes en que
        // se pagó, sin importar qué período facture la factura.
        supabase
          .from("comprobantes_pago")
          .select("monto")
          .gte("fecha_pago", rango.desde)
          .lt("fecha_pago", rango.hasta),
      ]);
      if (cancelado) return;
      const total = (pagosRes.data ?? []).reduce(
        (suma, p) => suma + Number(p.monto),
        0
      );
      setResumen({ total, presupuesto: presu.monto, propio: presu.propio });
      setValor(presu.propio && presu.monto !== null ? String(presu.monto) : "");
      setEditando(false);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [periodo, version]);

  const presupuesto = resumen?.presupuesto ?? null;
  const total = resumen?.total ?? 0;
  const pct =
    presupuesto && presupuesto > 0 ? (total / presupuesto) * 100 : null;

  // Barra: verde hasta 70 %, amarillo hasta 90 %, rojo si supera 90 %
  const colorBarra =
    pct === null
      ? ""
      : pct <= 70
        ? "bg-secondary"
        : pct <= 90
          ? "bg-amber-500"
          : "bg-red-500";

  const mensaje =
    pct === null
      ? null
      : pct <= 70
        ? "¡Vas bien encaminado con tus gastos! 💪"
        : pct <= 100
          ? "Cuidado: te estás acercando a tu presupuesto."
          : "Superaste tu presupuesto de este mes.";

  return (
    <section className="rounded-2xl bg-primary p-5 text-white shadow-lg shadow-primary/25">
      {/* Selector de mes */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setPeriodo((p) => sumarMeses(p, -1))}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 active:bg-white/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-semibold">
          {MESES[periodo.mes - 1]} {periodo.anio}
        </span>
        <button
          onClick={() => setPeriodo((p) => sumarMeses(p, 1))}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 active:bg-white/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Total del mes */}
      <p className="text-sm/5 opacity-80">Total gastado</p>
      {cargando ? (
        <div className="mt-1 h-9 w-40 animate-pulse rounded-lg bg-white/20" />
      ) : (
        <p className="mt-0.5 text-3xl font-bold tracking-tight">
          {formatMonto(total)}
        </p>
      )}

      {/* Editor del presupuesto de ESTE mes */}
      {!cargando && editando ? (
        <form onSubmit={guardarPresupuesto} className="mt-4">
          <label
            htmlFor="presupuesto-mes"
            className="text-xs opacity-80"
          >
            Presupuesto de {MESES[periodo.mes - 1].toLowerCase()} {periodo.anio}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="presupuesto-mes"
              type="text"
              inputMode="decimal"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ej.: 250000"
              className="h-10 min-w-0 flex-1 rounded-xl bg-white/20 px-3 text-sm text-white outline-none placeholder:text-white/60 focus:bg-white/25"
            />
            <button
              type="submit"
              disabled={guardando}
              className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-primary disabled:opacity-60"
            >
              {guardando ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="h-10 rounded-xl px-2 text-sm font-medium text-white/80"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-1.5 text-[11px] opacity-70">
            Dejalo vacío para que este mes vuelva a usar tu presupuesto por
            defecto.
          </p>
        </form>
      ) : null}

      {/* Presupuesto y barra de progreso */}
      {!cargando && !editando && presupuesto !== null && presupuesto > 0 ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 opacity-80">
              Presupuesto: {formatMonto(presupuesto)}
              {!resumen?.propio ? (
                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                  por defecto
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setEditando(true)}
                aria-label={`Editar el presupuesto de ${MESES[periodo.mes - 1]} ${periodo.anio}`}
                className="rounded px-1 underline decoration-white/40 underline-offset-2 active:opacity-70"
              >
                Editar
              </button>
            </span>
            <span className="font-semibold">{Math.round(pct!)}%</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={Math.round(pct!)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje del presupuesto utilizado"
          >
            <div
              className={`h-full rounded-full transition-all ${colorBarra}`}
              style={{ width: `${Math.min(pct!, 100)}%` }}
            />
          </div>
          {mensaje ? <p className="mt-2 text-xs opacity-90">{mensaje}</p> : null}
        </div>
      ) : null}

      {!cargando && !editando && (presupuesto === null || presupuesto === 0) ? (
        <p className="mt-3 text-xs opacity-90">
          No definiste el presupuesto de{" "}
          {MESES[periodo.mes - 1].toLowerCase()} {periodo.anio}.{" "}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="font-semibold underline"
          >
            Cargalo ahora
          </button>{" "}
          o fijá uno por defecto en{" "}
          <Link href="/perfil" className="font-semibold underline">
            Perfil
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
