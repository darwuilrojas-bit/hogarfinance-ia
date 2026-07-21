import { createClient } from "@/lib/supabase/client";
import { MESES, periodoActual, ultimosPeriodos } from "@/lib/formato";
import type { Periodo } from "@/lib/formato";
import { mensajeAnomalia } from "@/features/alertas/lib/anomalias";
import type { Categoria } from "@/lib/supabase/types";

/** Marca que llevan todos los registros generados, para poder borrarlos. */
export const MARCA_DEMO = "[demo]";

const PROVEEDORES_DEMO: {
  nombre: string;
  categoria: Categoria;
  dia: number;
}[] = [
  { nombre: "Edesur", categoria: "electricidad", dia: 15 },
  { nombre: "AySA", categoria: "agua", dia: 20 },
  { nombre: "Metrogas", categoria: "gas", dia: 10 },
  { nombre: "Telecom", categoria: "internet", dia: 5 },
  { nombre: "Inmobiliaria San Martín", categoria: "alquiler", dia: 1 },
];

const METODOS = [
  "Transferencia",
  "Débito automático",
  "Tarjeta crédito",
  "Billetera digital",
  "Efectivo",
  "Tarjeta débito",
];

function entre(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

/** Monto realista por proveedor; el gas varía por estación (invierno caro). */
function montoPara(nombre: string, mes: number): number {
  switch (nombre) {
    case "Edesur":
      return entre(12000, 18000);
    case "AySA":
      return entre(1500, 2500);
    case "Metrogas": {
      const invierno = mes >= 6 && mes <= 9; // hemisferio sur
      return invierno ? entre(3300, 4500) : entre(2000, 2800);
    }
    case "Telecom":
      return entre(4000, 4500);
    default:
      return 85000; // alquiler fijo
  }
}

function fechaIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Genera el set completo de datos de prueba para el usuario logueado:
 * 5 proveedores, 6 meses de facturas con sus pagos (el mes actual
 * queda pendiente, sin pago), 3 alertas de ejemplo y un presupuesto
 * si no había.
 */
export async function generarDatosPrueba(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");

  // Evita duplicar si ya se generaron
  const { data: existentes } = await supabase
    .from("facturas")
    .select("id")
    .like("notas", `${MARCA_DEMO}%`)
    .limit(1);
  if (existentes && existentes.length > 0) {
    return "Ya existen datos de prueba. Eliminálos primero si querés regenerarlos.";
  }

  const periodos = ultimosPeriodos(periodoActual(), 6);
  const periodoHoy = periodos[periodos.length - 1];

  type FilaFactura = {
    usuario_id: string;
    proveedor: string;
    monto: number;
    categoria: Categoria;
    periodo_mes: number;
    periodo_anio: number;
    estado: "pagado" | "pendiente";
    fecha_vencimiento: string | null;
    numero_comprobante: string;
    notas: string;
  };

  const filasFacturas: FilaFactura[] = [];
  const montosPorProveedor = new Map<string, number[]>();

  PROVEEDORES_DEMO.forEach((p) => {
    const montos: number[] = [];
    periodos.forEach((per: Periodo, j) => {
      const esMesActual = j === periodos.length - 1;
      const esMesAnterior = j === periodos.length - 2;

      let monto = montoPara(p.nombre, per.mes);
      // Anomalía pedida: el gas del mes anterior, 30 % sobre su promedio
      if (p.nombre === "Metrogas" && esMesAnterior && montos.length >= 3) {
        const prom3 = montos.slice(-3).reduce((s, m) => s + m, 0) / 3;
        monto = Math.round(prom3 * 1.3);
      }
      montos.push(monto);

      filasFacturas.push({
        usuario_id: user.id,
        proveedor: p.nombre,
        monto,
        categoria: p.categoria,
        periodo_mes: per.mes,
        periodo_anio: per.anio,
        estado: esMesActual ? "pendiente" : "pagado",
        fecha_vencimiento: fechaIso(per.anio, per.mes, p.dia),
        numero_comprobante: `0001-${String(entre(10000, 99999)).padStart(8, "0")}`,
        notas: `${MARCA_DEMO} Generado automáticamente para pruebas`,
      });
    });
    montosPorProveedor.set(p.nombre, montos);
  });

  const { data: facturasInsertadas, error: errorFacturas } = await supabase
    .from("facturas")
    .insert(filasFacturas)
    .select("id, proveedor, monto, periodo_mes, periodo_anio, estado, fecha_vencimiento");
  if (errorFacturas) throw new Error("No se pudieron crear las facturas.");

  // ---------- Comprobantes de pago (todo lo pagado, no el mes actual) ----------
  type FilaComprobante = {
    usuario_id: string;
    factura_id: string;
    monto: number;
    fecha_pago: string;
    metodo_pago: string;
    notas: string;
  };
  const filasComprobantes: FilaComprobante[] = [];
  (facturasInsertadas ?? []).forEach((f, i) => {
    if (f.estado !== "pagado") return;
    const p = PROVEEDORES_DEMO.find((x) => x.nombre === f.proveedor)!;
    const diaPago = Math.max(1, p.dia - entre(1, 5));
    filasComprobantes.push({
      usuario_id: user.id,
      factura_id: f.id,
      monto: Number(f.monto),
      fecha_pago: fechaIso(f.periodo_anio, f.periodo_mes, diaPago),
      metodo_pago: METODOS[i % METODOS.length],
      notas: `${MARCA_DEMO} Generado automáticamente para pruebas`,
    });
  });
  const { data: comprobantesInsertados, error: errorComprobantes } =
    await supabase
      .from("comprobantes_pago")
      .insert(filasComprobantes)
      .select("id, factura_id");
  if (errorComprobantes) throw new Error("No se pudieron crear los comprobantes.");

  // ---------- Proveedores ----------
  for (const p of PROVEEDORES_DEMO) {
    const montos = montosPorProveedor.get(p.nombre)!;
    const pagados = montos.slice(0, -1); // el actual está pendiente
    const promedio =
      Math.round((pagados.reduce((s, m) => s + m, 0) / pagados.length) * 100) /
      100;
    const valores = {
      categoria: p.categoria,
      fecha_vencimiento_habitual: p.dia,
      monto_promedio: promedio,
      veces_registrado: pagados.length,
    };
    const { data: existente } = await supabase
      .from("proveedores")
      .select("id")
      .eq("nombre", p.nombre)
      .maybeSingle();
    if (existente) {
      await supabase.from("proveedores").update(valores).eq("id", existente.id);
    } else {
      await supabase
        .from("proveedores")
        .insert({ ...valores, usuario_id: user.id, nombre: p.nombre });
    }
  }

  // ---------- Presupuesto (si no había) ----------
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("presupuesto_mensual")
    .single();
  let presupuestoCreado = false;
  if (!perfil?.presupuesto_mensual) {
    await supabase
      .from("usuarios")
      .update({ presupuesto_mensual: 130000 })
      .eq("id", user.id);
    presupuestoCreado = true;
  }

  // ---------- Alertas de ejemplo ----------
  const hoy = new Date();
  const en3dias = new Date(hoy.getTime() + 3 * 86_400_000);
  const perAnterior = periodos[periodos.length - 2];
  const facturaGasAnterior = (facturasInsertadas ?? []).find(
    (f) =>
      f.proveedor === "Metrogas" &&
      f.periodo_mes === perAnterior.mes &&
      f.periodo_anio === perAnterior.anio
  );
  const comprobanteGasAnterior = (comprobantesInsertados ?? []).find(
    (c) => c.factura_id === facturaGasAnterior?.id
  );
  const montosGas = montosPorProveedor.get("Metrogas")!;
  const montoGasAnterior = montosGas[montosGas.length - 2];
  const promGas = montosGas.slice(-5, -2).reduce((s, m) => s + m, 0) / 3;

  await supabase.from("alertas").insert([
    {
      usuario_id: user.id,
      tipo: "vencimiento",
      mensaje: `⏰ Edesur vence el ${en3dias.getDate()} de ${MESES[en3dias.getMonth()].toLowerCase()} y todavía no registraste el pago. ${MARCA_DEMO}`,
    },
    {
      usuario_id: user.id,
      tipo: "anomalia",
      gasto_id: comprobanteGasAnterior?.id ?? null,
      mensaje: `${mensajeAnomalia("Metrogas", montoGasAnterior, promGas)} ${MARCA_DEMO}`,
    },
    {
      usuario_id: user.id,
      tipo: "presupuesto",
      mensaje: `🚨 Ya usaste el 85% de tu presupuesto de ${MESES[periodoHoy.mes - 1].toLowerCase()} ${periodoHoy.anio}. ${MARCA_DEMO}`,
    },
  ]);

  return `Listo: ${filasFacturas.length} facturas y ${filasComprobantes.length} pagos en 6 meses, 5 proveedores, 3 alertas${presupuestoCreado ? " y presupuesto de $130.000" : ""}.`;
}

/** Elimina todo lo generado por generarDatosPrueba (y nada más). */
export async function eliminarDatosPrueba(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");

  // Los comprobantes de facturas demo caen en cascada al borrar la
  // factura, pero por si alguno quedó suelto, se borra explícitamente.
  await supabase.from("comprobantes_pago").delete().like("notas", `${MARCA_DEMO}%`);
  await supabase.from("facturas").delete().like("notas", `${MARCA_DEMO}%`);
  await supabase
    .from("proveedores")
    .delete()
    .in(
      "nombre",
      PROVEEDORES_DEMO.map((p) => p.nombre)
    );
  await supabase.from("alertas").delete().like("mensaje", `%${MARCA_DEMO}`);

  return "Datos de prueba eliminados. Tus datos reales quedaron intactos.";
}
