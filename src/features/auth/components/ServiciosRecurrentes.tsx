"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import { formatMontoCompacto } from "@/lib/formato";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";
import { FormVencimiento } from "@/features/alertas/components/FormVencimiento";
import type { VencimientoEditable } from "@/features/alertas/components/FormVencimiento";

type ProveedorRow = {
  id: string;
  nombre: string;
  categoria: Categoria;
  fecha_vencimiento_habitual: number | null;
  monto_promedio: number | null;
  veces_registrado: number;
};

/**
 * Servicios recurrentes del usuario: lista de proveedores con su día
 * habitual de vencimiento y monto promedio, con alta, edición y baja.
 */
export function ServiciosRecurrentes() {
  const [proveedores, setProveedores] = useState<ProveedorRow[] | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<VencimientoEditable | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("proveedores")
        .select(
          "id, nombre, categoria, fecha_vencimiento_habitual, monto_promedio, veces_registrado"
        )
        .order("nombre");
      if (cancelado) return;
      setProveedores((data as ProveedorRow[]) ?? []);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [version]);

  async function eliminar(p: ProveedorRow) {
    if (
      !window.confirm(
        `¿Eliminar ${p.nombre} de tus servicios recurrentes? Los gastos ya registrados no se borran.`
      )
    )
      return;
    const supabase = createClient();
    await supabase.from("proveedores").delete().eq("id", p.id);
    setVersion((v) => v + 1);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Servicios recurrentes
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setFormAbierto(true);
          }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white active:bg-primary-dark"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar
        </button>
      </div>

      {proveedores === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      ) : proveedores.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Todavía no tenés servicios registrados. Se crean solos al cargar
          gastos, o agregalos con el botón.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {proveedores.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <CategoriaIcon categoria={p.categoria} className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {p.nombre}
                </p>
                <p className="text-[11px] text-gray-500">
                  {CATEGORIAS[p.categoria]}
                  {p.fecha_vencimiento_habitual
                    ? ` · vence el ${p.fecha_vencimiento_habitual}`
                    : " · sin día configurado"}
                  {p.monto_promedio !== null
                    ? ` · prom. ${formatMontoCompacto(Number(p.monto_promedio))}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditando({
                    id: p.id,
                    nombre: p.nombre,
                    categoria: p.categoria,
                    dia: p.fecha_vencimiento_habitual,
                    monto: p.monto_promedio,
                  });
                  setFormAbierto(true);
                }}
                aria-label={`Editar ${p.nombre}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => eliminar(p)}
                aria-label={`Eliminar ${p.nombre}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 active:bg-red-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {formAbierto ? (
        <FormVencimiento
          inicial={editando}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </section>
  );
}
