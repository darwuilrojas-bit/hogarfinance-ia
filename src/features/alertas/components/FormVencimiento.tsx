"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";

export type VencimientoEditable = {
  id: string;
  nombre: string;
  categoria: Categoria;
  dia: number | null;
  monto: number | null;
};

type FormVencimientoProps = {
  /** Proveedor a editar, o null para crear uno nuevo. */
  inicial: VencimientoEditable | null;
  onCerrar: () => void;
  onGuardado: () => void;
};

/**
 * Hoja modal para registrar o editar un vencimiento recurrente:
 * proveedor, día del mes en que vence y monto estimado.
 * Montarla solo cuando está abierta (el estado inicial se toma
 * de `inicial` al montar).
 */
export function FormVencimiento({
  inicial,
  onCerrar,
  onGuardado,
}: FormVencimientoProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [categoria, setCategoria] = useState<string>(
    inicial?.categoria ?? "otro"
  );
  const [dia, setDia] = useState(inicial?.dia ? String(inicial.dia) : "");
  const [monto, setMonto] = useState(
    inicial?.monto ? String(inicial.monto) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const diaNum = Number(dia);
    const montoNum = monto === "" ? null : Number(monto);
    if (!nombre.trim()) return setError("Ingresá el nombre del proveedor.");
    if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31)
      return setError("El día debe estar entre 1 y 31.");
    if (montoNum !== null && (!Number.isFinite(montoNum) || montoNum < 0))
      return setError("El monto estimado no es válido.");

    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGuardando(false);
      return setError("Tu sesión expiró. Volvé a iniciar sesión.");
    }

    const valores = {
      nombre: nombre.trim(),
      categoria,
      fecha_vencimiento_habitual: diaNum,
      monto_promedio: montoNum,
    };

    let errorDb;
    if (inicial) {
      ({ error: errorDb } = await supabase
        .from("proveedores")
        .update(valores)
        .eq("id", inicial.id));
    } else {
      // Si el proveedor ya existe (creado al registrar un gasto), lo actualiza
      const { data: existente } = await supabase
        .from("proveedores")
        .select("id")
        .eq("nombre", valores.nombre)
        .maybeSingle();
      if (existente) {
        ({ error: errorDb } = await supabase
          .from("proveedores")
          .update(valores)
          .eq("id", existente.id));
      } else {
        ({ error: errorDb } = await supabase
          .from("proveedores")
          .insert({ ...valores, usuario_id: user.id, veces_registrado: 0 }));
      }
    }

    setGuardando(false);
    if (errorDb) {
      return setError("No se pudo guardar. Intentá de nuevo.");
    }
    onGuardado();
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 safe-bottom"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={inicial ? "Editar vencimiento" : "Agregar vencimiento"}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {inicial ? "Editar vencimiento" : "Agregar vencimiento"}
        </h2>

        <form onSubmit={guardar} className="flex flex-col gap-4">
          <Input
            label="Proveedor"
            type="text"
            placeholder="Ej.: Edesur, Metrogas…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Select
            label="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Día que vence"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              placeholder="Ej.: 10"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
            <Input
              label="Monto estimado"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Opcional"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={guardando}>
            Guardar
          </Button>
          <button
            type="button"
            onClick={onCerrar}
            className="text-center text-sm font-semibold text-gray-500"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
