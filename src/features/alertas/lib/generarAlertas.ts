import { createClient } from "@/lib/supabase/client";
import {
  MESES,
  formatMontoCompacto,
  periodoActual,
  sumarMeses,
} from "@/lib/formato";
import { rangoMes } from "@/lib/fechas";
import { presupuestoDelMes } from "@/lib/presupuestos";
import { CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria } from "@/lib/supabase/types";
import { diasHasta, vencimientoEfectivo } from "./vencimientos";
import { evaluarAnomalia, mensajeAnomalia } from "./anomalias";

type FacturaLigera = {
  id: string;
  proveedor: string;
  categoria: Categoria;
  estado: "pagado" | "pendiente" | "reclamado";
  periodo_mes: number;
  periodo_anio: number;
  fecha_vencimiento: string | null;
  fecha_vencimiento_2: string | null;
};

type PagoLigero = {
  id: string;
  monto: number;
  fecha_pago: string;
  factura: FacturaLigera | FacturaLigera[];
};

function facturaDe(p: PagoLigero): FacturaLigera {
  return Array.isArray(p.factura) ? p.factura[0] : p.factura;
}

/**
 * Motor de alertas automáticas. Se ejecuta al abrir la app: revisa
 * vencimientos de facturas reales, anomalías de monto y presupuesto,
 * y crea las alertas que falten en la tabla `alertas` (sin duplicar:
 * compara contra los mensajes ya generados en los últimos 60 días).
 *
 * Reglas:
 *  1. Factura pendiente que vence en ≤3 días.
 *  2. Factura pendiente que vence dentro de la anticipación configurada.
 *  3. Un pago del mes supera en más de 20 % (con estacionalidad) el
 *     promedio histórico del mismo proveedor.
 *  4. El total pagado del mes supera el 90 % del presupuesto.
 *  5. Resumen mensual automático del mes anterior.
 */
export async function generarAlertas(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const hoy = new Date();
  const { mes, anio } = periodoActual();
  const nombreMes = MESES[mes - 1].toLowerCase();

  const hace60Dias = new Date(hoy.getTime() - 60 * 86_400_000).toISOString();
  const [facturasRes, pagosRes, perfilRes, alertasRes] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        "id, proveedor, categoria, estado, periodo_mes, periodo_anio, fecha_vencimiento, fecha_vencimiento_2"
      ),
    supabase
      .from("comprobantes_pago")
      .select(
        "id, monto, fecha_pago, factura:facturas!inner(id, proveedor, categoria, estado, periodo_mes, periodo_anio, fecha_vencimiento, fecha_vencimiento_2)"
      ),
    supabase.from("usuarios").select("*").single(),
    supabase.from("alertas").select("mensaje").gte("fecha_alerta", hace60Dias),
  ]);

  const facturas = (facturasRes.data ?? []) as FacturaLigera[];
  const pagos = ((pagosRes.data ?? []) as unknown as PagoLigero[]).map((p) => ({
    id: p.id,
    monto: Number(p.monto),
    fecha_pago: p.fecha_pago,
    factura: facturaDe(p),
  }));
  const existentes = new Set((alertasRes.data ?? []).map((a) => a.mensaje));

  // Preferencias del usuario (con valores por defecto si la migración
  // de perfil todavía no agregó las columnas)
  const perfil = perfilRes.data;
  const prefs = {
    vencimiento: perfil?.alertas_vencimiento ?? true,
    diasAnticipacion: perfil?.alertas_dias_anticipacion ?? 7,
    anomalia: perfil?.alertas_anomalia ?? true,
    presupuesto: perfil?.alertas_presupuesto ?? true,
  };
  const nuevas: {
    usuario_id: string;
    gasto_id?: string;
    tipo: "vencimiento" | "anomalia" | "presupuesto";
    mensaje: string;
  }[] = [];

  function agregar(
    tipo: "vencimiento" | "anomalia" | "presupuesto",
    mensaje: string,
    gasto_id?: string
  ) {
    if (existentes.has(mensaje)) return;
    existentes.add(mensaje);
    nuevas.push({ usuario_id: user!.id, tipo, mensaje, gasto_id });
  }

  // --- 1 y 2: vencimientos de facturas pendientes reales ---
  if (prefs.vencimiento) {
    for (const f of facturas) {
      if (f.estado !== "pendiente" || !f.fecha_vencimiento) continue;
      const fecha = vencimientoEfectivo(
        f.fecha_vencimiento,
        f.fecha_vencimiento_2,
        hoy
      );
      const dias = diasHasta(fecha, hoy);
      const fechaTexto = `${fecha.getDate()} de ${MESES[fecha.getMonth()].toLowerCase()}`;
      if (dias <= 3) {
        agregar(
          "vencimiento",
          `⏰ ${f.proveedor} vence el ${fechaTexto} y todavía no registraste el pago.`
        );
      } else if (dias <= prefs.diasAnticipacion) {
        agregar("vencimiento", `📅 ${f.proveedor} vence pronto: el ${fechaTexto}.`);
      }
    }
  }

  // --- 3: anomalías sobre los pagos del mes (línea base estacional +
  //         umbral por variabilidad; ver docs/especificacion-analitica.md).
  //         Mismo mensaje que al registrar un pago, así el deduplicado
  //         evita avisos dobles. ---
  const pagosDelMes = pagos.filter(
    (p) => p.factura.periodo_mes === mes && p.factura.periodo_anio === anio
  );
  const historicosPlano = pagos.map((p) => ({
    proveedor: p.factura.proveedor,
    monto: p.monto,
    periodo_mes: p.factura.periodo_mes,
    periodo_anio: p.factura.periodo_anio,
  }));

  if (prefs.anomalia) {
    for (const p of pagosDelMes) {
      const ev = evaluarAnomalia(historicosPlano, p.factura.proveedor, p.monto, {
        mes,
        anio,
      });
      if (ev?.esAnomalia) {
        agregar(
          "anomalia",
          mensajeAnomalia(p.factura.proveedor, p.monto, ev.baseline),
          p.id
        );
      }
    }
  }

  // --- 4: presupuesto al 90 % ---
  //     Se mide por FECHA DE PAGO, no por período facturado: el presupuesto
  //     es la plata que sale del bolsillo este mes. Tiene que dar lo mismo
  //     que la tarjeta de resumen del dashboard.
  // El presupuesto del mes en curso: el propio si lo tiene, si no el global.
  const presupuesto = (await presupuestoDelMes(supabase, mes, anio)).monto;
  if (prefs.presupuesto && presupuesto && presupuesto > 0) {
    const rangoActual = rangoMes(mes, anio);
    const totalPagado = pagos
      .filter(
        (p) =>
          p.fecha_pago >= rangoActual.desde && p.fecha_pago < rangoActual.hasta
      )
      .reduce((s, p) => s + p.monto, 0);
    if (totalPagado >= presupuesto * 0.9) {
      agregar(
        "presupuesto",
        `🚨 Ya usaste más del 90% de tu presupuesto de ${nombreMes} ${anio}.`
      );
    }
  }

  if (nuevas.length > 0) {
    await supabase.from("alertas").insert(nuevas);
  }

  // --- 5: resumen mensual automático (una vez por mes, sobre el
  //         mes anterior; requiere la migración migracion-resumen.sql) ---
  const prev = sumarMeses({ mes, anio }, -1);
  const prev2 = sumarMeses({ mes, anio }, -2);
  const prefijo = `📊 Resumen de ${MESES[prev.mes - 1].toLowerCase()} ${prev.anio}:`;
  const yaGenerado = [...existentes].some((m) => m.startsWith(prefijo));
  const facturasPrev = facturas.filter(
    (f) => f.periodo_mes === prev.mes && f.periodo_anio === prev.anio
  );

  if (!yaGenerado && facturasPrev.length > 0) {
    // También por fecha de pago: el resumen del mes es lo que se pagó.
    const pagadoDe = (p: { mes: number; anio: number }) => {
      const r = rangoMes(p.mes, p.anio);
      return pagos
        .filter((x) => x.fecha_pago >= r.desde && x.fecha_pago < r.hasta)
        .reduce((s, x) => s + x.monto, 0);
    };

    const totalPrev = pagadoDe(prev);
    const partes: string[] = [];

    // Total vs presupuesto
    let parteTotal = `gastaste ${formatMontoCompacto(totalPrev)}`;
    if (presupuesto && presupuesto > 0) {
      parteTotal += ` (${Math.round((totalPrev / presupuesto) * 100)}% de tu presupuesto)`;
    }
    partes.push(parteTotal);

    // Categoría con mayor gasto
    const porCategoria = new Map<string, number>();
    const rangoPrev = rangoMes(prev.mes, prev.anio);
    for (const p of pagos) {
      if (p.fecha_pago < rangoPrev.desde || p.fecha_pago >= rangoPrev.hasta)
        continue;
      porCategoria.set(
        p.factura.categoria,
        (porCategoria.get(p.factura.categoria) ?? 0) + p.monto
      );
    }
    let mayor: { cat: string; total: number } | null = null;
    for (const [cat, total] of porCategoria) {
      if (!mayor || total > mayor.total) mayor = { cat, total };
    }
    if (mayor) {
      partes.push(
        `tu mayor gasto fue ${CATEGORIAS[mayor.cat as Categoria]} (${formatMontoCompacto(mayor.total)})`
      );
    }

    // Comparación con el mes anterior a ese
    const totalPrev2 = pagadoDe(prev2);
    if (totalPrev2 > 0 && totalPrev > 0) {
      const dif = Math.round((totalPrev / totalPrev2 - 1) * 100);
      if (dif !== 0) {
        partes.push(
          dif > 0
            ? `un ${dif}% más que en ${MESES[prev2.mes - 1].toLowerCase()}`
            : `un ${Math.abs(dif)}% menos que en ${MESES[prev2.mes - 1].toLowerCase()}`
        );
      }
    }

    // Facturas de ese período que quedaron sin pagar
    const sinPagar = facturasPrev.filter((f) => f.estado === "pendiente").length;
    if (sinPagar > 0) {
      partes.push(
        `${sinPagar} ${sinPagar === 1 ? "factura quedó" : "facturas quedaron"} sin pagar`
      );
    }

    // Insert aparte: si la migración del tipo "resumen" no se ejecutó
    // todavía, falla silenciosamente sin afectar las demás alertas.
    const { error: errorResumen } = await supabase.from("alertas").insert({
      usuario_id: user.id,
      tipo: "resumen",
      mensaje: `${prefijo} ${partes.join(", ")}.`,
    });
    if (!errorResumen) return nuevas.length + 1;
  }

  return nuevas.length;
}
