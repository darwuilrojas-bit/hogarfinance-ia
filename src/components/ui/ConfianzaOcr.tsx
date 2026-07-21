/**
 * Indicador de confianza de un campo extraído por el OCR, según el
 * puntaje 0-100 calculado en el servidor (especificacion-analitica §2):
 * ≥75 alta (verde) · 50-74 media (ámbar ~) · <50 baja o no leído (ámbar ⚠).
 */
export function Confianza({ score }: { score: number }) {
  if (score >= 75) {
    return (
      <span
        title={`Confianza alta (${score}%)`}
        aria-label={`Campo extraído con confianza alta, ${score}%`}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-light text-secondary"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  if (score >= 50) {
    return (
      <span
        title={`Confianza media (${score}%): conviene revisarlo`}
        aria-label={`Campo con confianza media, ${score}%`}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-600"
      >
        ~
      </span>
    );
  }
  return (
    <span
      title={
        score > 0
          ? `Confianza baja (${score}%): revisalo`
          : "No se pudo leer: completalo vos"
      }
      aria-label="Campo que requiere tu atención"
      className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008Z" />
      </svg>
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
