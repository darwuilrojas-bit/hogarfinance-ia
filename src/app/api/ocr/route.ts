import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_COMPROBANTES } from "@/lib/supabase/types";
import { textoComprobante } from "./campos";

const PROMPT_OCR = `Sos un extractor de datos de facturas y comprobantes de servicios del hogar de Argentina (luz, agua, gas, internet, telefonía, alquiler, expensas).

REGLA CRÍTICA — VALOR, NO RÓTULO: extraé el dato que figura JUNTO a cada etiqueta impresa, nunca la etiqueta misma. Ejemplo real: si la factura muestra «LSP    0111B15587107», el valor correcto es "0111B15587107". Devolver "LSP" es un error.

REGLA CRÍTICA — NO INVENTES: si un dato no está visible o no estás seguro, devolvé null para ese campo. Nunca deduzcas ni completes por contexto.

Devolvé ÚNICAMENTE un objeto JSON, sin texto previo ni posterior y sin bloque de código, con exactamente estas claves:

- "proveedor": nombre de la empresa emisora, como texto.

- "monto": importe a pagar, como número con punto decimal y sin símbolo. Convertí el formato argentino: "$45.123,45" → 45123.45; "$45.123" → 45123. Si hay dos vencimientos con importes distintos, usá el del PRIMER vencimiento.

- "fecha_vencimiento": PRIMER vencimiento, formato "DD/MM/YYYY".

- "fecha_vencimiento_2": SEGUNDO vencimiento (el que tiene recargo) si la factura lo muestra; si no existe, null.

- "fecha_pago": SOLO si el documento es un comprobante, ticket o constancia DE PAGO ya realizado, la fecha en que se pagó, formato "DD/MM/YYYY". Si es una factura sin constancia de pago, null. NUNCA uses un vencimiento como fecha de pago.

- "periodo": período facturado, formato "MM/YYYY".

- "numero_comprobante": identificador de ESTE documento, siempre como cadena de texto entre comillas (aunque sean solo dígitos). Suele figurar junto a rótulos como "N° de comprobante", "N° de factura", "Nro. de liquidación" o, en AySA, "LSP". Puede combinar letras y números. NO devuelvas ninguno de estos: número de cuenta, número de cliente, número de socio, cuenta de servicios, referencia de pago electrónico (Pago Fácil, Rapipago, Link, Banelco), CUIT, ni dígitos leídos de un código de barras.

- "categoria": exactamente uno de estos valores: "electricidad", "agua", "gas", "internet", "alquiler", "expensas", "otro".`;

const CATEGORIAS_VALIDAS = [
  "electricidad",
  "agua",
  "gas",
  "internet",
  "alquiler",
  "expensas",
  "otro",
];

export type ConfianzaOcr = {
  proveedor: number;
  monto: number;
  fecha_pago: number;
  fecha_vencimiento: number;
  periodo: number;
  numero_comprobante: number;
  categoria: number;
};

export type ResultadoOcr = {
  proveedor: string | null;
  monto: number | null;
  fecha_pago: string | null;
  fecha_vencimiento: string | null;
  fecha_vencimiento_2: string | null;
  periodo: string | null;
  numero_comprobante: string | null;
  categoria: string | null;
  /** Ajustes que el agente de aprendizaje aplicó sobre lo extraído. */
  aprendizaje: string[];
  /** Puntaje de confianza 0-100 por campo (especificacion-analitica §2). */
  confianza: ConfianzaOcr;
};

/**
 * Puntaje de confianza de un campo:
 *   0 si es null · 75 si fue extraído y validado en formato ·
 *   100 si además es consistente con el historial · 60 si contradice
 *   el historial (docs/especificacion-analitica.md §2).
 */
function puntuar(extraido: boolean, consistencia: boolean | null): number {
  if (!extraido) return 0;
  if (consistencia === null) return 75;
  return consistencia ? 100 : 60;
}

/** Normaliza para comparar nombres: minúsculas, sin tildes ni símbolos. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Distancia de Levenshtein (cantidad de ediciones entre dos textos). */
function distancia(a: string, b: string): number {
  const filas = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: filas }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < cols; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[filas - 1][cols - 1];
}

/**
 * Busca un proveedor ya registrado "parecido" al nombre extraído:
 * igual normalizado, uno contiene al otro, o a distancia de edición
 * pequeña (tolera errores típicos del OCR).
 */
function proveedorSimilar(
  extraido: string,
  conocidos: string[]
): string | null {
  const objetivo = normalizar(extraido);
  if (objetivo.length === 0) return null;
  let mejor: { nombre: string; distancia: number } | null = null;
  for (const nombre of conocidos) {
    const n = normalizar(nombre);
    if (n === objetivo) return nombre;
    if (n.length >= 4 && (n.includes(objetivo) || objetivo.includes(n))) {
      return nombre;
    }
    const dist = distancia(objetivo, n);
    const tolerancia = objetivo.length >= 6 ? 2 : 1;
    if (dist <= tolerancia && (!mejor || dist < mejor.distancia)) {
      mejor = { nombre, distancia: dist };
    }
  }
  return mejor?.nombre ?? null;
}

/**
 * POST /api/ocr — { path: string } | { imagenBase64: string }
 * Extrae los datos del comprobante con el modelo de visión de OpenAI.
 * - path: imagen ya subida al bucket privado (JPG/PNG)
 * - imagenBase64: data-URL de la primera página de un PDF, renderizada
 *   en el navegador del usuario
 * La clave de OpenAI vive solo acá, en el servidor.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { path, imagenBase64 } = (await request.json()) as {
    path?: string;
    imagenBase64?: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta configurar OPENAI_API_KEY en .env.local. Completá el formulario a mano.",
      },
      { status: 501 }
    );
  }

  let urlImagen: string;
  if (imagenBase64) {
    // Página de PDF renderizada en el cliente
    if (
      !/^data:image\/(jpeg|png);base64,/.test(imagenBase64) ||
      imagenBase64.length > 15_000_000
    ) {
      return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
    }
    urlImagen = imagenBase64;
  } else {
    if (!path || !path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
    }
    // URL firmada temporal para que OpenAI pueda leer la imagen privada
    const { data: firmada, error: errorFirma } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .createSignedUrl(path, 600);
    if (errorFirma || !firmada) {
      return NextResponse.json(
        { error: "No se pudo acceder a la imagen" },
        { status: 500 }
      );
    }
    urlImagen = firmada.signedUrl;
  }

  const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT_OCR },
            { type: "image_url", image_url: { url: urlImagen } },
          ],
        },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error("Error de OpenAI:", respuesta.status, detalle);
    return NextResponse.json(
      { error: "El servicio de extracción no está disponible en este momento." },
      { status: 502 }
    );
  }

  const json = await respuesta.json();
  const contenido: string = json.choices?.[0]?.message?.content ?? "{}";

  let crudo: Record<string, unknown>;
  try {
    crudo = JSON.parse(contenido.replace(/```json|```/g, "").trim());
  } catch {
    return NextResponse.json(
      { error: "No se pudo interpretar la respuesta del OCR." },
      { status: 502 }
    );
  }

  // Normalización defensiva de cada campo.
  // El monto puede llegar como número o como texto en formato argentino
  // ("$ 45.123,45"): se limpia y se convierte preservando los decimales.
  function parsearMonto(v: unknown): number | null {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
    if (typeof v !== "string") return null;
    let s = v.replace(/[^\d.,-]/g, "");
    if (s.includes(",") && s.includes(".")) {
      // "45.123,45": puntos de miles, coma decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      // "45123,45": coma decimal
      s = s.replace(",", ".");
    } else if (/\.\d{3}$/.test(s)) {
      // "45.123": el punto es separador de miles, no decimal
      s = s.replace(/\./g, "");
    }
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const monto = parsearMonto(crudo.monto);
  const categoria = String(crudo.categoria ?? "").toLowerCase();
  const fechaValida = (v: unknown): string | null =>
    typeof v === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) ? v : null;
  const resultado: ResultadoOcr = {
    proveedor: typeof crudo.proveedor === "string" ? crudo.proveedor : null,
    monto,
    fecha_pago: fechaValida(crudo.fecha_pago),
    fecha_vencimiento: fechaValida(crudo.fecha_vencimiento),
    fecha_vencimiento_2: fechaValida(crudo.fecha_vencimiento_2),
    periodo:
      typeof crudo.periodo === "string" &&
      /^\d{1,2}\/\d{4}$/.test(crudo.periodo)
        ? crudo.periodo
        : null,
    numero_comprobante: textoComprobante(crudo.numero_comprobante),
    categoria: CATEGORIAS_VALIDAS.includes(categoria) ? categoria : null,
    aprendizaje: [],
    confianza: {
      proveedor: 0,
      monto: 0,
      fecha_pago: 0,
      fecha_vencimiento: 0,
      periodo: 0,
      numero_comprobante: 0,
      categoria: 0,
    },
  };

  // --------------------------------------------------------------------
  // Agente de aprendizaje: aplica lo aprendido de correcciones previas
  // del usuario antes de devolver el resultado.
  // --------------------------------------------------------------------
  const [corrRes, provConocidosRes] = await Promise.all([
    supabase
      .from("correcciones_ocr")
      .select("campo, texto_original, texto_corregido, tipo, proveedor")
      .order("fecha_correccion", { ascending: false })
      .limit(200),
    supabase.from("proveedores").select("nombre, categoria"),
  ]);
  const correcciones = corrRes.data ?? [];
  const conocidos = (provConocidosRes.data ?? []).map((p) => p.nombre);
  const categoriaDe = new Map(
    (provConocidosRes.data ?? []).map((p) => [p.nombre, p.categoria])
  );

  // 1) Correcciones exactas ya hechas por el usuario (la más reciente gana)
  if (resultado.proveedor) {
    const corr = correcciones.find(
      (c) => c.campo === "proveedor" && c.texto_original === resultado.proveedor
    );
    if (corr && corr.texto_corregido !== resultado.proveedor) {
      resultado.aprendizaje.push(
        `Proveedor: "${resultado.proveedor}" → "${corr.texto_corregido}" (corrección aprendida)`
      );
      resultado.proveedor = corr.texto_corregido;
    }
  }
  if (resultado.monto !== null) {
    const corr = correcciones.find(
      (c) => c.campo === "monto" && c.texto_original === String(resultado.monto)
    );
    const corregido = corr ? Number(corr.texto_corregido) : NaN;
    if (corr && Number.isFinite(corregido) && corregido !== resultado.monto) {
      resultado.aprendizaje.push(
        `Monto: ${resultado.monto} → ${corregido} (corrección aprendida)`
      );
      resultado.monto = corregido;
    }
  }
  if (resultado.fecha_pago) {
    const corr = correcciones.find(
      (c) => c.campo === "fecha" && c.texto_original === resultado.fecha_pago
    );
    if (corr && corr.texto_corregido !== resultado.fecha_pago) {
      resultado.aprendizaje.push(
        `Fecha: ${resultado.fecha_pago} → ${corr.texto_corregido} (corrección aprendida)`
      );
      resultado.fecha_pago = corr.texto_corregido;
    }
  }

  // Señales de campos que este proveedor viene fallando. Dos o más fallas
  // marcan el campo como problemático: una sola puede ser un mal escaneo.
  const UMBRAL_CAMPO_PROBLEMATICO = 2;
  const proveedorLeido = normalizar(resultado.proveedor ?? "");
  const fallasNumero = correcciones.filter(
    (c) =>
      c.tipo === "no_leido" &&
      c.campo === "numero_comprobante" &&
      normalizar(c.proveedor ?? "") === proveedorLeido
  ).length;
  const numeroEsProblematico =
    proveedorLeido !== "" && fallasNumero >= UMBRAL_CAMPO_PROBLEMATICO;

  if (numeroEsProblematico) {
    resultado.aprendizaje.push(
      `En ${resultado.proveedor} el número de factura suele fallar: revisalo.`
    );
  }

  // 2) Coincidencia difusa con proveedores ya registrados
  if (resultado.proveedor && !conocidos.includes(resultado.proveedor)) {
    const similar = proveedorSimilar(resultado.proveedor, conocidos);
    if (similar) {
      resultado.aprendizaje.push(
        `Proveedor: "${resultado.proveedor}" → "${similar}" (ya registrado)`
      );
      resultado.proveedor = similar;
    }
  }

  // --------------------------------------------------------------------
  // Confianza por campo: 75 base (extraído + formato válido) ± consistencia
  // con el historial del usuario (docs/especificacion-analitica.md §2)
  // --------------------------------------------------------------------
  const esConocido =
    resultado.proveedor !== null && conocidos.includes(resultado.proveedor);

  let historialMontos: number[] = [];
  if (resultado.proveedor) {
    const { data: hist } = await supabase
      .from("comprobantes_pago")
      .select("monto, factura:facturas!inner(proveedor)")
      .eq("factura.proveedor", resultado.proveedor)
      .limit(60);
    historialMontos = (hist ?? []).map((h) => Number(h.monto));
  }

  const hoy = new Date();
  let fechaExtraida: Date | null = null;
  if (resultado.fecha_pago) {
    const [d, m, a] = resultado.fecha_pago.split("/").map(Number);
    fechaExtraida = new Date(a, m - 1, d);
  }

  // monto: dentro de 0.5×–1.5× del promedio histórico del proveedor
  let consMonto: boolean | null = null;
  if (resultado.monto !== null && historialMontos.length > 0) {
    const prom =
      historialMontos.reduce((s, m) => s + m, 0) / historialMontos.length;
    consMonto = resultado.monto >= 0.5 * prom && resultado.monto <= 1.5 * prom;
  }

  // fecha de pago: ni futura (>7 días) ni más vieja que 120 días
  let consFecha: boolean | null = null;
  if (fechaExtraida) {
    const dias = (hoy.getTime() - fechaExtraida.getTime()) / 86_400_000;
    consFecha = dias >= -7 && dias <= 120;
  }

  // vencimiento: plausible entre 60 días atrás y 90 días adelante
  let consVencimiento: boolean | null = null;
  if (resultado.fecha_vencimiento) {
    const [dv, mv, av] = resultado.fecha_vencimiento.split("/").map(Number);
    const fv = new Date(av, mv - 1, dv);
    const dias = (fv.getTime() - hoy.getTime()) / 86_400_000;
    consVencimiento = dias >= -60 && dias <= 90;
  }

  // período: a lo sumo un mes de distancia del mes de la fecha de pago
  let consPeriodo: boolean | null = null;
  if (resultado.periodo && fechaExtraida) {
    const [pm, pa] = resultado.periodo.split("/").map(Number);
    const difMeses =
      (fechaExtraida.getFullYear() - pa) * 12 +
      (fechaExtraida.getMonth() + 1 - pm);
    consPeriodo = Math.abs(difMeses) <= 1;
  }

  resultado.confianza = {
    proveedor: puntuar(resultado.proveedor !== null, esConocido ? true : null),
    monto: puntuar(resultado.monto !== null, consMonto),
    fecha_pago: puntuar(resultado.fecha_pago !== null, consFecha),
    fecha_vencimiento: puntuar(
      resultado.fecha_vencimiento !== null,
      consVencimiento
    ),
    periodo: puntuar(resultado.periodo !== null, consPeriodo),
    numero_comprobante: numeroEsProblematico
      ? // Aunque el formato sea válido, este proveedor viene fallando:
        // 60 es el puntaje de "revisalo" y pinta el indicador en ámbar.
        // Math.min preserva el 0 cuando el campo no se leyó.
        Math.min(
          60,
          puntuar(
            resultado.numero_comprobante !== null,
            resultado.numero_comprobante
              ? /^[A-Za-z0-9\-./ ]{6,}$/.test(resultado.numero_comprobante)
              : null
          )
        )
      : puntuar(
          resultado.numero_comprobante !== null,
          resultado.numero_comprobante
            ? // Los identificadores reales combinan letras y números
              // (el LSP de AySA, por ejemplo: 0111B15587107).
              /^[A-Za-z0-9\-./ ]{6,}$/.test(resultado.numero_comprobante)
            : null
        ),
    categoria: puntuar(
      resultado.categoria !== null,
      esConocido && resultado.proveedor
        ? categoriaDe.get(resultado.proveedor) === resultado.categoria
        : null
    ),
  };

  return NextResponse.json(resultado);
}
