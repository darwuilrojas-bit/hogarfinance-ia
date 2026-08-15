"use client";

import { useState } from "react";

/**
 * Indicador de confianza de un campo extraído por el OCR, según el
 * puntaje 0-100 calculado en el servidor (especificacion-analitica §2):
 * ≥75 alta (verde) · 50-74 media (ámbar ~) · <50 baja o no leído (ámbar ⚠).
 *
 * El indicador es un botón: al tocarlo explica qué significa. Antes la
 * explicación vivía en el atributo `title`, que en un celular no aparece
 * nunca porque no hay puntero — una prueba con un usuario real mostró que
 * el símbolo no se entendía.
 */

type Nivel = {
  etiqueta: string;
  explicacion: string;
  clases: string;
  icono: React.ReactNode;
};

function nivelDe(score: number): Nivel {
  if (score >= 75) {
    return {
      etiqueta: `Confianza alta (${score}%)`,
      explicacion:
        "La IA leyó este dato con confianza alta. Igual conviene darle una mirada.",
      clases: "bg-secondary-light text-secondary",
      icono: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      ),
    };
  }
  if (score >= 50) {
    return {
      etiqueta: `Confianza media (${score}%)`,
      explicacion:
        "La IA no está segura de este dato. Comparalo con la factura antes de guardar.",
      clases: "bg-amber-100 text-[11px] font-bold text-amber-600",
      icono: <>~</>,
    };
  }
  return {
    etiqueta:
      score > 0 ? `Confianza baja (${score}%)` : "No se pudo leer este dato",
    explicacion:
      score > 0
        ? "La IA leyó algo pero puede estar equivocado. Revisalo contra la factura."
        : "La IA no pudo leer este dato de la imagen. Completalo vos mirando la factura.",
    clases: "bg-amber-100 text-amber-600",
    icono: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008Z" />
      </svg>
    ),
  };
}

export function Confianza({ score }: { score: number }) {
  const [abierto, setAbierto] = useState(false);
  const nivel = nivelDe(score);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        // Dentro de un <label>: sin esto, tocar el ícono enfoca el input.
        onClick={(e) => {
          e.preventDefault();
          setAbierto((v) => !v);
        }}
        onBlur={() => setAbierto(false)}
        aria-label={`${nivel.etiqueta}. Tocá para saber qué significa.`}
        aria-expanded={abierto}
        className={`flex h-5 w-5 items-center justify-center rounded-full ${nivel.clases}`}
      >
        {nivel.icono}
      </button>
      {abierto ? (
        <span
          role="tooltip"
          className="absolute left-1/2 top-7 z-20 w-56 -translate-x-1/2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          <span className="block font-semibold">{nivel.etiqueta}</span>
          {nivel.explicacion}
        </span>
      ) : null}
    </span>
  );
}

/** Etiqueta de campo con su indicador de confianza al lado. */
export function EtiquetaConfianza({
  texto,
  ocrListo,
  score,
}: {
  texto: string;
  ocrListo: boolean;
  score: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {texto}
      {ocrListo ? <Confianza score={score} /> : null}
    </span>
  );
}
