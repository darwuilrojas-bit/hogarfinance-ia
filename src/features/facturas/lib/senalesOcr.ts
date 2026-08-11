/**
 * Señales del agente de aprendizaje sobre los campos que el OCR no completó.
 *
 * Funciones puras: no tocan la base ni React. El formulario las usa para
 * decidir qué registrar en silencio y qué preguntarle al usuario.
 *
 * Spec: docs/superpowers/specs/2026-08-11-senales-ocr-design.md
 */

/** Campos opcionales que el OCR completa y que vale la pena rastrear. */
export type CampoSenal = "numero_comprobante" | "fecha_vencimiento_2";

/** Lo que el usuario responde cuando un campo quedó vacío. */
export type RespuestaUsuario = "ausente" | "no_leido";

/** Lo que devolvió el OCR para los campos rastreados. */
export type LecturaOcr = {
  numero_comprobante: string | null;
  fecha_vencimiento_2: string | null;
};

/** Lo que quedó cargado en el formulario al momento de guardar. */
export type ValoresFormulario = {
  numero_comprobante: string;
  fecha_vencimiento_2: string;
};

/** Una señal ya registrada, como viene de la base. */
export type SenalPrevia = {
  campo: string;
  proveedor: string | null;
  tipo: string;
};

/** Fila lista para insertar en correcciones_ocr. */
export type FilaSenal = {
  usuario_id: string;
  campo: CampoSenal;
  tipo: "no_leido" | "ausente";
  proveedor: string | null;
  texto_original: null;
  texto_corregido: string | null;
};

export const CAMPOS_RASTREADOS: CampoSenal[] = [
  "numero_comprobante",
  "fecha_vencimiento_2",
];

/** Cómo se nombra cada campo en el aviso al usuario. */
export const ETIQUETAS_CAMPO: Record<CampoSenal, string> = {
  numero_comprobante: "número de factura",
  fecha_vencimiento_2: "segundo vencimiento",
};

/** Normaliza un nombre de proveedor para compararlo. */
function normalizarProveedor(nombre: string | null): string {
  return (nombre ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Señales que se registran sin preguntar: el OCR no leyó el campo y el
 * usuario lo completó a mano. Que haya tenido que escribirlo es la
 * evidencia de que el agente falló.
 */
export function senalesAutomaticas(
  ocr: LecturaOcr | null,
  valores: ValoresFormulario,
  proveedor: string,
  usuarioId: string
): FilaSenal[] {
  if (!ocr) return [];
  return CAMPOS_RASTREADOS.filter(
    (campo) => ocr[campo] === null && valores[campo].trim() !== ""
  ).map((campo) => ({
    usuario_id: usuarioId,
    campo,
    tipo: "no_leido" as const,
    proveedor: proveedor.trim() || null,
    texto_original: null,
    texto_corregido: valores[campo].trim(),
  }));
}

/**
 * Campos por los que hay que preguntar: el OCR no los leyó, quedaron vacíos
 * y el usuario no marcó antes que ese proveedor no los trae.
 */
export function camposAPreguntar(
  ocr: LecturaOcr | null,
  valores: ValoresFormulario,
  previas: SenalPrevia[],
  proveedor: string
): CampoSenal[] {
  if (!ocr) return [];
  const actual = normalizarProveedor(proveedor);
  const yaMarcados = new Set(
    previas
      .filter(
        (s) =>
          s.tipo === "ausente" && normalizarProveedor(s.proveedor) === actual
      )
      .map((s) => s.campo)
  );
  return CAMPOS_RASTREADOS.filter(
    (campo) =>
      ocr[campo] === null &&
      valores[campo].trim() === "" &&
      !yaMarcados.has(campo)
  );
}

/** La fila que produce cada botón del aviso. */
export function registroDeRespuesta(
  campo: CampoSenal,
  respuesta: RespuestaUsuario,
  proveedor: string,
  usuarioId: string
): FilaSenal {
  return {
    usuario_id: usuarioId,
    campo,
    tipo: respuesta,
    proveedor: proveedor.trim() || null,
    texto_original: null,
    texto_corregido: null,
  };
}
