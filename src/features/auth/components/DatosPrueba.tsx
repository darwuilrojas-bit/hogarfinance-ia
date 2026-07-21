"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EMAIL_USUARIO_PRUEBA,
  eliminarDatosPrueba,
  generarDatosPrueba,
} from "@/lib/datosPrueba";

/**
 * Herramienta de testeo: genera o elimina un set completo de datos
 * de prueba (proveedores, 6 meses de gastos y alertas de ejemplo).
 * Solo visible para la cuenta de pruebas (EMAIL_USUARIO_PRUEBA) —
 * para cualquier otro usuario, actual o nuevo, esta tarjeta no
 * aparece. Todo lo generado queda marcado con [demo].
 */
export function DatosPrueba() {
  const [esCuentaDePrueba, setEsCuentaDePrueba] = useState(false);
  const [ocupado, setOcupado] = useState<"generar" | "eliminar" | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelado) {
        setEsCuentaDePrueba(user?.email === EMAIL_USUARIO_PRUEBA);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  async function ejecutar(accion: "generar" | "eliminar") {
    setOcupado(accion);
    setMensaje(null);
    setError(null);
    try {
      const resultado =
        accion === "generar"
          ? await generarDatosPrueba()
          : await eliminarDatosPrueba();
      setMensaje(resultado);
      // La campana y el resto de la app deben refrescar sus datos
      window.dispatchEvent(new Event("alertas-actualizadas"));
    } catch {
      setError("Algo falló. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setOcupado(null);
    }
  }

  if (!esCuentaDePrueba) return null;

  return (
    <section className="rounded-2xl border border-dashed border-primary/40 bg-primary-light/30 p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        🧪 Datos de prueba
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        Genera 5 proveedores (Edesur, AySA, Metrogas, Telecom e Inmobiliaria
        San Martín), 6 meses de gastos con montos realistas y 3 alertas de
        ejemplo, para recorrer todas las pantallas con datos. Todo queda
        marcado con {"“[demo]”"} y se puede eliminar sin tocar tus datos
        reales.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => ejecutar("generar")}
          disabled={ocupado !== null}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-50"
        >
          {ocupado === "generar" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : null}
          Generar datos
        </button>
        <button
          type="button"
          onClick={() => ejecutar("eliminar")}
          disabled={ocupado !== null}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 active:bg-gray-50 disabled:opacity-50"
        >
          {ocupado === "eliminar" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
          ) : null}
          Eliminar datos
        </button>
      </div>
      {mensaje ? (
        <p className="mt-3 rounded-xl bg-secondary-light px-4 py-3 text-xs text-secondary-dark">
          ✓ {mensaje} Recorré Inicio, Gastos, Vencimientos, Comprobantes y
          Reportes para verlos.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
