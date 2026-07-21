"use client";

import { useRef } from "react";

export const MAX_TAMANO_MB = 10;
const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "application/pdf"];

type ZonaCargaProps = {
  archivo: File | null;
  previewUrl: string | null;
  /** Nombre del comprobante ya guardado (modo edición), si existe. */
  existenteNombre?: string | null;
  /** Etapa en curso, o null si no hay nada procesándose. */
  procesando: "subiendo" | "analizando" | null;
  onSeleccionar: (archivo: File) => void;
  onError: (mensaje: string) => void;
};

/**
 * Zona de carga del comprobante: borde punteado, selector de archivos
 * (JPG/PNG/PDF, máx. 10 MB), vista previa e indicador de progreso.
 */
export function ZonaCarga({
  archivo,
  previewUrl,
  existenteNombre = null,
  procesando,
  onSeleccionar,
  onError,
}: ZonaCargaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function manejarArchivo(f: File | undefined) {
    if (!f) return;
    if (!TIPOS_ACEPTADOS.includes(f.type)) {
      onError("Formato no soportado. Usá JPG, PNG o PDF.");
      return;
    }
    if (f.size > MAX_TAMANO_MB * 1024 * 1024) {
      onError(`El archivo supera los ${MAX_TAMANO_MB} MB.`);
      return;
    }
    onSeleccionar(f);
  }

  const hayContenido =
    archivo !== null || previewUrl !== null || existenteNombre !== null;

  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary-light/40 p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => manejarArchivo(e.target.files?.[0])}
      />

      {!hayContenido ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Subí una foto de tu factura o comprobante
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              JPG, PNG o PDF · máximo {MAX_TAMANO_MB} MB
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
          >
            Elegir imagen
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Vista previa (para PDF, la primera página renderizada) */}
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa del comprobante"
              className="max-h-56 w-full rounded-xl object-contain bg-white"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-white p-3">
              <svg className="h-8 w-8 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <span className="truncate text-sm text-gray-700">
                {archivo?.name ?? existenteNombre ?? "Comprobante"}
              </span>
            </div>
          )}

          {/* Indicador de progreso */}
          {procesando !== null ? (
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-gray-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              {procesando === "subiendo"
                ? "Subiendo el comprobante…"
                : "Leyendo los datos con IA…"}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-center text-xs font-semibold text-primary"
            >
              Cambiar archivo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
