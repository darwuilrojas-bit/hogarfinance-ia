"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";
import { EtiquetaConfianza } from "./ConfianzaOcr";

type ProveedorFrecuente = {
  nombre: string;
  categoria: Categoria;
  veces_registrado: number;
};

type ProveedorInputProps = {
  value: string;
  onChange: (nombre: string) => void;
  /** Se dispara al elegir una sugerencia, con su categoría conocida. */
  onSeleccionar: (p: { nombre: string; categoria: Categoria }) => void;
  ocrListo?: boolean;
  score?: number;
};

/**
 * Campo de proveedor con autocompletado: sugiere los proveedores
 * frecuentes del usuario ordenados por uso, y al elegir uno entrega
 * también su categoría conocida para pre-completar el resto.
 */
export function ProveedorInput({
  value,
  onChange,
  onSeleccionar,
  ocrListo = false,
  score = 0,
}: ProveedorInputProps) {
  const [frecuentes, setFrecuentes] = useState<ProveedorFrecuente[]>([]);
  const [visibles, setVisibles] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("proveedores")
      .select("nombre, categoria, veces_registrado")
      .order("veces_registrado", { ascending: false })
      .limit(20)
      .then(({ data }) => setFrecuentes(data ?? []));
  }, []);

  const texto = value.trim().toLowerCase();
  const sugerencias = frecuentes
    .filter(
      (p) =>
        p.nombre !== value &&
        (texto === "" || p.nombre.toLowerCase().includes(texto))
    )
    .slice(0, 5);

  return (
    <div className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        <EtiquetaConfianza texto="Proveedor *" ocrListo={ocrListo} score={score} />
      </label>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setVisibles(true);
        }}
        onFocus={() => setVisibles(true)}
        onBlur={() => setVisibles(false)}
        placeholder="Ej.: Edesur, Metrogas…"
        className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {visibles && sugerencias.length > 0 ? (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
          {sugerencias.map((p) => (
            <li key={p.nombre}>
              <button
                type="button"
                // onMouseDown para que se ejecute antes del blur del input
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSeleccionar(p);
                  setVisibles(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-800 active:bg-primary-light"
              >
                <span className="font-medium">{p.nombre}</span>
                <span className="text-[10px] text-gray-400">
                  {CATEGORIAS[p.categoria]} · {p.veces_registrado}{" "}
                  {p.veces_registrado === 1 ? "registro" : "registros"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
