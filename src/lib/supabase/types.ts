/**
 * Tipos de la base de datos de HogarFinance IA.
 * Reflejan el esquema definido en supabase/schema.sql y
 * supabase/migracion-facturas-comprobantes.sql.
 */

export type Categoria =
  | "electricidad"
  | "agua"
  | "gas"
  | "internet"
  | "alquiler"
  | "expensas"
  | "otro";

export type EstadoFactura = "pagado" | "pendiente" | "reclamado";

export type TipoAlerta = "vencimiento" | "anomalia" | "presupuesto" | "resumen";

export type CampoOcr = "proveedor" | "monto" | "fecha";

export type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  presupuesto_mensual: number | null;
  fecha_creacion: string;
};

/** Una factura: lo que llega para pagar, con su vencimiento. */
export type Factura = {
  id: string;
  usuario_id: string;
  proveedor: string;
  categoria: Categoria;
  monto: number;
  periodo_mes: number;
  periodo_anio: number;
  /** Primer vencimiento. */
  fecha_vencimiento: string | null;
  /** Segundo vencimiento (con recargo), si la factura lo tiene. */
  fecha_vencimiento_2: string | null;
  numero_comprobante: string | null;
  imagen_url: string | null;
  estado: EstadoFactura;
  notas: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
};

/** El pago de una factura, macheado con ella por factura_id. */
export type ComprobantePago = {
  id: string;
  usuario_id: string;
  factura_id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string | null;
  numero_operacion: string | null;
  imagen_url: string | null;
  notas: string | null;
  fecha_creacion: string;
};

export type Proveedor = {
  id: string;
  usuario_id: string;
  nombre: string;
  categoria: Categoria;
  /** Día del mes (1-31) en que habitualmente vence la factura. */
  fecha_vencimiento_habitual: number | null;
  monto_promedio: number | null;
  veces_registrado: number;
};

export type Alerta = {
  id: string;
  usuario_id: string;
  /** Referencia informal: id de una factura o de un comprobante_pago. */
  gasto_id: string | null;
  tipo: TipoAlerta;
  mensaje: string;
  leida: boolean;
  fecha_alerta: string;
};

export type CorreccionOcr = {
  id: string;
  usuario_id: string;
  texto_original: string;
  texto_corregido: string;
  campo: CampoOcr;
  fecha_correccion: string;
};

/** Nombre del bucket privado de Storage para imágenes de comprobantes. */
export const BUCKET_COMPROBANTES = "comprobantes";

/** Etiquetas en español para mostrar en la interfaz. */
export const CATEGORIAS: Record<Categoria, string> = {
  electricidad: "Electricidad",
  agua: "Agua",
  gas: "Gas",
  internet: "Internet",
  alquiler: "Alquiler",
  expensas: "Expensas",
  otro: "Otro",
};

export const ESTADOS_FACTURA: Record<EstadoFactura, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  reclamado: "Reclamado",
};

export const TIPOS_ALERTA: Record<TipoAlerta, string> = {
  vencimiento: "Vencimiento",
  anomalia: "Anomalía",
  presupuesto: "Presupuesto",
  resumen: "Resumen",
};

export const METODOS_PAGO = [
  "Transferencia",
  "Efectivo",
  "Tarjeta débito",
  "Tarjeta crédito",
  "Débito automático",
  "Billetera digital",
] as const;
