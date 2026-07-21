"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MENSAJES: Record<string, string> = {
  comprobante: "¡Comprobante guardado con éxito!",
};

/**
 * Toast de éxito en el dashboard: se muestra cuando la URL llega
 * con ?exito=... (p. ej. al volver de guardar un comprobante).
 */
export function MensajeExito() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mensaje, setMensaje] = useState<string | null>(() => {
    const clave = searchParams.get("exito");
    return clave ? (MENSAJES[clave] ?? null) : null;
  });

  useEffect(() => {
    if (!mensaje) return;
    // Limpia la URL para que el toast no reaparezca al recargar
    router.replace("/", { scroll: false });
    const timer = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(timer);
  }, [mensaje, router]);

  if (!mensaje) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-5">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-secondary/30">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        {mensaje}
      </div>
    </div>
  );
}
