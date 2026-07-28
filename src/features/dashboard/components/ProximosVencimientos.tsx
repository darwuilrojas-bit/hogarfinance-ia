"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import { formatMontoCompacto, MESES_CORTOS } from "@/lib/formato";
import type { Categoria } from "@/lib/supabase/types";
import {
  diasHasta,
  textoDias,
  urgenciaPorDias,
  vencimientoEfectivo,
} from "@/features/alertas/lib/vencimientos";

type Vencimiento = {
  id: string;
  nombre: string;
  categoria: Categoria;
  fecha: Date;
  dias: number;
  monto: number;
};

/**
 * Próximas facturas por vencer: hasta 4, ordenadas por urgencia,
 * según los vencimientos reales de las facturas pendientes cargadas.
 */
export function ProximosVencimientos() {
  const [items, setItems] = useState<Vencimiento[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("facturas")
        .select("id, proveedor, categoria, monto, fecha_vencimiento, fecha_vencimiento_2")
        .eq("estado", "pendiente")
        .not("fecha_vencimiento", "is", null);
      if (cancelado) return;

      const hoy = new Date();
      const lista = (data ?? [])
        .map((f) => {
          const fecha = vencimientoEfectivo(
            f.fecha_vencimiento!,
            f.fecha_vencimiento_2,
            hoy
          );
          return {
            id: f.id,
            nombre: f.proveedor,
            categoria: f.categoria as Categoria,
            fecha,
            dias: diasHasta(fecha, hoy),
            monto: Number(f.monto),
          };
        })
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 4);

      setItems(lista);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Próximos vencimientos
        </h2>
        <Link
          href="/facturas"
          className="text-xs font-semibold text-primary"
        >
          Ver todos
        </Link>
      </div>

      {items === null ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          No tenés facturas pendientes. Cargalas en la sección Facturas apenas
          te lleguen.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((v) => {
            const urgencia = urgenciaPorDias(v.dias);
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${urgencia.fondo} ${urgencia.texto}`}
                >
                  <CategoriaIcon categoria={v.categoria} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {v.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    Vence el {v.fecha.getDate()}{" "}
                    {MESES_CORTOS[v.fecha.getMonth()]}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${urgencia.texto}`}>
                    {textoDias(v.dias)}
                  </p>
                  <p className="text-xs text-gray-500">
                    ≈ {formatMontoCompacto(v.monto)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
