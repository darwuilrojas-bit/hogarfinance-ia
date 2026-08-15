"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mesDeIso } from "@/lib/fechas";
import { formatMontoCompacto, MESES } from "@/lib/formato";

type Stats = {
  totalComprobantes: number;
  mesMayorGasto: { mes: number; total: number } | null;
  proveedorMayor: { nombre: string; total: number } | null;
  inicioUso: string | null;
};

function fechaLarga(iso: string): string {
  const f = new Date(iso);
  return `${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()} de ${f.getFullYear()}`;
}

/** Estadísticas personales de uso de la app. */
export function EstadisticasPersonales() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const [pagosRes, perfilRes] = await Promise.all([
        supabase
          .from("comprobantes_pago")
          .select(
            "monto, imagen_url, fecha_pago, factura:facturas!inner(proveedor)"
          ),
        supabase.from("usuarios").select("fecha_creacion").single(),
      ]);
      if (cancelado) return;
      const pagos = ((pagosRes.data ?? []) as unknown as Array<{
        monto: number;
        imagen_url: string | null;
        fecha_pago: string;
        factura: { proveedor: string } | { proveedor: string }[];
      }>).map((p) => {
        const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
        // Cada pago cuenta en el mes en que se hizo, no en el que factura.
        const { mes, anio } = mesDeIso(p.fecha_pago);
        return {
          monto: Number(p.monto),
          imagen_url: p.imagen_url,
          mes,
          anio,
          ...f,
        };
      });
      const anioActual = new Date().getFullYear();

      // Mes con mayor gasto del año en curso
      const porMes = new Map<number, number>();
      for (const p of pagos) {
        if (p.anio === anioActual) {
          porMes.set(p.mes, (porMes.get(p.mes) ?? 0) + p.monto);
        }
      }
      let mesMayor: Stats["mesMayorGasto"] = null;
      for (const [mes, total] of porMes) {
        if (!mesMayor || total > mesMayor.total) mesMayor = { mes, total };
      }

      // Proveedor con mayor gasto acumulado (histórico)
      const porProveedor = new Map<string, number>();
      for (const p of pagos) {
        porProveedor.set(
          p.proveedor,
          (porProveedor.get(p.proveedor) ?? 0) + p.monto
        );
      }
      let provMayor: Stats["proveedorMayor"] = null;
      for (const [nombre, total] of porProveedor) {
        if (!provMayor || total > provMayor.total) provMayor = { nombre, total };
      }

      setStats({
        totalComprobantes: pagos.filter((p) => p.imagen_url !== null).length,
        mesMayorGasto: mesMayor,
        proveedorMayor: provMayor,
        inicioUso: perfilRes.data?.fecha_creacion ?? null,
      });
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (stats === null) {
    return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Tus estadísticas
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary-light p-3">
          <p className="text-[11px] text-primary-dark/70">
            Comprobantes almacenados
          </p>
          <p className="mt-0.5 text-xl font-bold text-primary-dark">
            {stats.totalComprobantes}
          </p>
        </div>
        <div className="rounded-xl bg-secondary-light p-3">
          <p className="text-[11px] text-secondary-dark/70">
            Mes con mayor gasto
          </p>
          <p className="mt-0.5 text-sm font-bold text-secondary-dark">
            {stats.mesMayorGasto
              ? `${MESES[stats.mesMayorGasto.mes - 1]}`
              : "Sin datos"}
          </p>
          {stats.mesMayorGasto ? (
            <p className="text-[11px] text-secondary-dark/70">
              {formatMontoCompacto(stats.mesMayorGasto.total)}
            </p>
          ) : null}
        </div>
        <div className="col-span-2 rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] text-gray-500">
            Proveedor con mayor gasto acumulado
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-gray-900">
            {stats.proveedorMayor
              ? `${stats.proveedorMayor.nombre} · ${formatMontoCompacto(stats.proveedorMayor.total)}`
              : "Sin datos"}
          </p>
        </div>
      </div>
      {stats.inicioUso ? (
        <p className="mt-3 text-center text-[11px] text-gray-400">
          Usás HogarFinance IA desde el {fechaLarga(stats.inicioUso)}
        </p>
      ) : null}
    </section>
  );
}
