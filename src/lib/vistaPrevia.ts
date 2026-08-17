import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_COMPROBANTES } from "@/lib/supabase/types";
import { esPdf, pdfBlobAImagen } from "@/lib/pdfAImagen";

/**
 * Devuelve algo que se pueda dibujar en un <img> para un archivo guardado,
 * sea imagen o PDF.
 *
 * - Imagen: se devuelve una URL firmada, sin descargar el archivo.
 * - PDF: se descarga y se renderiza la primera página al vuelo. No se guarda
 *   ninguna copia, así un PDF no ocupa el doble de espacio en Storage.
 *
 * Devuelve null si no hay archivo o si la conversión falla; quien llama
 * decide qué mostrar en ese caso.
 */
export async function vistaPrevia(
  supabase: SupabaseClient,
  ruta: string | null,
  escala = 1.5
): Promise<string | null> {
  if (!ruta) return null;

  if (!esPdf(ruta)) {
    const { data } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .createSignedUrl(ruta, 3600);
    return data?.signedUrl ?? null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .download(ruta);
  if (error || !data) {
    console.error("No se pudo descargar el PDF para previsualizarlo:", error);
    return null;
  }
  try {
    return await pdfBlobAImagen(data, escala);
  } catch (e) {
    console.error("No se pudo renderizar el PDF:", e);
    return null;
  }
}

/** Una imagen lista para incrustar en el reporte, con sus dimensiones. */
export type ImagenIncrustable = {
  dataUrl: string;
  ancho: number;
  alto: number;
};

/** Convierte cualquier archivo guardado en un dataURL medido, para el PDF. */
export async function imagenParaReporte(
  supabase: SupabaseClient,
  ruta: string | null
): Promise<ImagenIncrustable | null> {
  const url = await vistaPrevia(supabase, ruta, 2);
  if (!url) return null;

  // Un PDF ya vino convertido a dataURL; una imagen viene como URL firmada y
  // hay que pasarla a dataURL para que jsPDF pueda incrustarla.
  const dataUrl = url.startsWith("data:") ? url : await aDataUrl(url);
  if (!dataUrl) return null;

  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () =>
      resolver({ dataUrl, ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => resolver(null);
    img.src = dataUrl;
  });
}

async function aDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolver) => {
      const lector = new FileReader();
      lector.onloadend = () => resolver(lector.result as string);
      lector.onerror = () => resolver(null);
      lector.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("No se pudo convertir la imagen a dataURL:", e);
    return null;
  }
}
