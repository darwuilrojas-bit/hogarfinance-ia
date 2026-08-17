/**
 * Render de la primera página de un PDF a imagen JPEG en el navegador.
 *
 * Se usa en dos momentos: al subir un archivo, para poder pasarlo por el OCR
 * de visión, y al mostrar o exportar un documento ya guardado, porque los
 * PDFs no se pueden dibujar en un <img>. La conversión es siempre al vuelo:
 * no se guarda ninguna copia, así un PDF no ocupa el doble de espacio.
 */

/** Núcleo del render. `escala` 1.5 alcanza para pantalla; 2 para el PDF. */
async function renderizar(datos: ArrayBuffer, escala: number): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const doc = await pdfjs.getDocument({ data: datos }).promise;
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext("2d")!;
  await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Primera página de un archivo recién elegido por el usuario. */
export async function pdfAImagen(archivo: File): Promise<string> {
  return renderizar(await archivo.arrayBuffer(), 2);
}

/** Primera página de un PDF ya descargado de Storage. */
export async function pdfBlobAImagen(blob: Blob, escala = 1.5): Promise<string> {
  return renderizar(await blob.arrayBuffer(), escala);
}

/** ¿La ruta apunta a un PDF? */
export function esPdf(ruta: string | null | undefined): boolean {
  return (ruta ?? "").toLowerCase().endsWith(".pdf");
}
