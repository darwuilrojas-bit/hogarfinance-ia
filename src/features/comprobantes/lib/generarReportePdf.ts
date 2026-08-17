import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMonto, MESES, MESES_CORTOS } from "@/lib/formato";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria, EstadoFactura } from "@/lib/supabase/types";

// Paleta del proyecto
const AZUL: [number, number, number] = [31, 111, 235]; // #1F6FEB
const VERDE: [number, number, number] = [13, 146, 118]; // #0D9276
const TINTA: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [107, 114, 128];

const MARGEN = 15;
const ANCHO = 210; // A4 en mm
const ALTO = 297;

export type ComprobanteReporte = {
  proveedor: string;
  categoria: Categoria;
  periodo_mes: number;
  periodo_anio: number;
  monto: number;
  fecha_pago: string;
  metodo_pago: string | null;
  numero_factura: string | null;
  numero_operacion: string | null;
  estado: EstadoFactura;
  fecha_creacion: string;
};

export type DatosReporte = {
  titular: string;
  comprobante: ComprobanteReporte;
  historial: ComprobanteReporte[];
  /** Imagen del comprobante de pago, o null si no hay. */
  imagen: { dataUrl: string; ancho: number; alto: number } | null;
  /**
   * Imagen de la factura reclamada, o null si no hay. El reporte muestra las
   * dos: el documento que se reclama y el que prueba que se pagó. Con una
   * sola, quien recibe el reporte tiene que confiar en que corresponden.
   */
  imagenFactura: { dataUrl: string; ancho: number; alto: number } | null;
  incluirHistorial: boolean;
};

const ETIQUETA_ESTADO: Record<EstadoFactura, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  reclamado: "Reclamado",
};

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const f = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return `${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()} de ${f.getFullYear()}`;
}

/** Genera y descarga el PDF de evidencia de pago. */
export function generarReportePdf(d: DatosReporte) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  // ---------- Encabezado: logo y marca ----------
  doc.setFillColor(...AZUL);
  doc.roundedRect(MARGEN, y - 2, 13, 13, 2.5, 2.5, "F");
  // Casita blanca simple dentro del logo
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.9);
  const cx = MARGEN + 6.5;
  doc.triangle(cx - 3.6, y + 3.6, cx, y + 0.6, cx + 3.6, y + 3.6, "S");
  doc.rect(cx - 2.6, y + 3.6, 5.2, 4.2, "S");

  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("HogarFinance IA", MARGEN + 17, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(
    "Gestión inteligente de finanzas y comprobantes del hogar",
    MARGEN + 17,
    y + 9
  );
  y += 20;

  // ---------- Título y fecha de generación ----------
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Reporte de Evidencia de Pago", MARGEN, y);
  y += 6;

  const ahora = new Date();
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generado el ${fechaLegible(ahora.toISOString())} a las ${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")} hs`,
    MARGEN,
    y
  );
  y += 4;
  doc.setDrawColor(...VERDE);
  doc.setLineWidth(0.7);
  doc.line(MARGEN, y, ANCHO - MARGEN, y);
  y += 9;

  // ---------- Helper de títulos de sección ----------
  function seccion(titulo: string) {
    doc.setFillColor(...VERDE);
    doc.rect(MARGEN, y - 3.2, 1.6, 4.4, "F");
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo.toUpperCase(), MARGEN + 4, y);
    y += 7;
  }

  function filaDato(clave: string, valor: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    doc.text(clave, MARGEN + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TINTA);
    doc.text(valor, MARGEN + 62, y);
    y += 6;
  }

  // ---------- Datos del titular ----------
  seccion("Datos del titular");
  filaDato("Nombre", d.titular);
  y += 4;

  // ---------- Datos del pago reclamado ----------
  const c = d.comprobante;
  seccion("Datos del pago reclamado");
  filaDato("Proveedor", c.proveedor);
  filaDato("Categoría", CATEGORIAS[c.categoria]);
  filaDato(
    "Período de la factura",
    `${MESES[c.periodo_mes - 1]} ${c.periodo_anio}`
  );
  filaDato("Fecha de pago", fechaLegible(c.fecha_pago));
  filaDato("Monto pagado", formatMonto(Number(c.monto)));
  filaDato("Método de pago", c.metodo_pago ?? "—");
  filaDato("Número de factura", c.numero_factura ?? "—");
  filaDato("Número de operación", c.numero_operacion ?? "—");
  filaDato("Estado", ETIQUETA_ESTADO[c.estado]);
  y += 4;

  // ---------- Los dos documentos ----------
  // Primero la factura reclamada y después el comprobante que la salda: el
  // reporte se lee como el argumento que sostiene ("esto es lo que me
  // reclaman" / "esto prueba que lo pagué").
  const incrustar = (
    img: { dataUrl: string; ancho: number; alto: number } | null,
    ausente: string
  ) => {
    if (!img) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(...GRIS);
      doc.text(ausente, MARGEN + 4, y);
      y += 6;
      return;
    }
    // Escala legible: hasta el ancho útil y máx. ~110 mm de alto, para que
    // las dos imágenes puedan convivir en el documento.
    const maxAncho = ANCHO - MARGEN * 2 - 8;
    const maxAlto = 110;
    const escala = Math.min(maxAncho / img.ancho, maxAlto / img.alto);
    const w = img.ancho * escala;
    const h = img.alto * escala;

    if (y + h + 14 > ALTO - 20) {
      doc.addPage();
      y = 20;
    }
    const x = (ANCHO - w) / 2;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.rect(x - 1.5, y - 1.5, w + 3, h + 3, "S");
    const formato = img.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(img.dataUrl, formato, x, y, w, h);
    y += h + 6;
  };

  seccion("Factura reclamada");
  incrustar(
    d.imagenFactura,
    "Esta factura no tiene archivo adjunto en HogarFinance IA."
  );

  seccion("Comprobante de pago");
  incrustar(
    d.imagen,
    "Este pago no tiene comprobante adjunto en HogarFinance IA."
  );

  // Sello de registro
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE);
  doc.text(
    `Comprobante registrado en HogarFinance IA el ${fechaLegible(c.fecha_creacion)}`,
    ANCHO / 2,
    y,
    { align: "center" }
  );
  y += 10;

  // ---------- Historial de pagos ----------
  if (d.incluirHistorial && d.historial.length > 0) {
    if (y + 30 > ALTO - 20) {
      doc.addPage();
      y = 20;
    }
    seccion("Historial de pagos al mismo proveedor");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, bottom: 22 },
      head: [["Período", "Fecha de pago", "Monto", "Método", "Estado"]],
      body: d.historial.map((h) => [
        `${MESES_CORTOS[h.periodo_mes - 1]} ${h.periodo_anio}`,
        fechaLegible(h.fecha_pago),
        formatMonto(Number(h.monto)),
        h.metodo_pago ?? "—",
        ETIQUETA_ESTADO[h.estado],
      ]),
      styles: { font: "helvetica", fontSize: 9, textColor: TINTA },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [243, 246, 251] },
    });
  }

  // ---------- Pie de página en todas las hojas ----------
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, ALTO - 16, ANCHO - MARGEN, ALTO - 16);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(
      "Este reporte fue generado por HogarFinance IA como evidencia de pago registrada digitalmente.",
      ANCHO / 2,
      ALTO - 11,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${paginas}`, ANCHO - MARGEN, ALTO - 6, {
      align: "right",
    });
  }

  // ---------- Descarga ----------
  const proveedorLimpio = c.proveedor.replace(/[^a-zA-Z0-9]+/g, "_");
  const periodo = `${String(c.periodo_mes).padStart(2, "0")}-${c.periodo_anio}`;
  doc.save(`Evidencia_${proveedorLimpio}_${periodo}.pdf`);
}
