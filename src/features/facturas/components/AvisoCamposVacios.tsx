"use client";

import {
  ETIQUETAS_CAMPO,
  type CampoSenal,
  type RespuestaUsuario,
} from "@/features/facturas/lib/senalesOcr";

/**
 * Aviso de los campos que el OCR no completó y quedaron vacíos.
 * No bloquea el guardado: responder es opcional.
 */
export function AvisoCamposVacios({
  campos,
  respondidos,
  onResponder,
}: {
  campos: CampoSenal[];
  respondidos: Partial<Record<CampoSenal, RespuestaUsuario>>;
  onResponder: (campo: CampoSenal, respuesta: RespuestaUsuario) => void;
}) {
  if (campos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3">
      {campos.map((campo) => {
        const respuesta = respondidos[campo];
        return (
          <div key={campo} className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-amber-800">
              El <strong>{ETIQUETAS_CAMPO[campo]}</strong> quedó vacío. ¿La
              factura no lo trae, o no se pudo leer?
            </p>
            {respuesta ? (
              <p className="text-xs font-semibold text-amber-700">
                {respuesta === "ausente"
                  ? "✓ Anotado: esta factura no lo trae. No te lo volvemos a preguntar."
                  : "✓ Gracias, lo registramos para mejorar la lectura."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResponder(campo, "ausente")}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 active:bg-amber-100"
                >
                  La factura no lo trae
                </button>
                <button
                  type="button"
                  onClick={() => onResponder(campo, "no_leido")}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 active:bg-amber-100"
                >
                  No se pudo leer
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
