/**
 * Renderiza la primera página de un PDF a una imagen JPEG (data-URL)
 * en el navegador, para poder pasarla por el OCR de visión.
 */
export async function pdfAImagen(archivo: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() })
    .promise;
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext("2d")!;
  await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}
