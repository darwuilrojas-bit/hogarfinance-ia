"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import {
  formatMonto,
  formatMontoCompacto,
  MESES,
  MESES_CORTOS,
  periodoActual,
  sumarMeses,
} from "@/lib/formato";
import type { Periodo } from "@/lib/formato";
import { BUCKET_COMPROBANTES, CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria, EstadoFactura } from "@/lib/supabase/types";
import { AnalisisMes } from "./AnalisisMes";

type FacturaEmbebida = {
  id: string;
  proveedor: string;
  categoria: Categoria;
  estado: EstadoFactura;
  numero_comprobante: string | null;
  fecha_vencimiento: string | null;
};

type FilaLedger = {
  id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string | null;
  numero_operacion: string | null;
  notas: string | null;
  imagen_url: string | null;
  factura: FacturaEmbebida;
};

const CHIP_ESTADO: Record<EstadoFactura, string> = {
  pagado: "bg-secondary-light text-secondary",
  pendiente: "bg-amber-100 text-amber-700",
  reclamado: "bg-red-50 text-red-600",
};

const ETIQUETA_ESTADO: Record<EstadoFactura, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  reclamado: "Reclamado",
};

// Colores distintivos del ícono por categoría
const COLOR_CATEGORIA: Record<Categoria, string> = {
  electricidad: "bg-amber-100 text-amber-600",
  agua: "bg-primary-light text-primary",
  gas: "bg-pink-100 text-pink-600",
  internet: "bg-secondary-light text-secondary",
  alquiler: "bg-violet-100 text-violet-600",
  expensas: "bg-slate-100 text-slate-600",
  otro: "bg-gray-100 text-gray-500",
};

function fechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha de pago";
  const f = new Date(`${iso}T00:00:00`);
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}`;
}

/**
 * Pantalla de Gastos: historial mensual de pagos realizados (facturas
 * ya pagadas), con filtros por categoría, swipe para Editar/Eliminar,
 * detalle expandible con el comprobante, y panel de análisis del mes.
 */
export function ListaGastos() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>(periodoActual);
  const [pagos, setPagos] = useState<FilaLedger[] | null>(null);
  const [filtro, setFiltro] = useState<string>("todas");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [swipeado, setSwipeado] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const toqueInicio = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("comprobantes_pago")
        .select(
          "id, monto, fecha_pago, metodo_pago, numero_operacion, notas, imagen_url, factura:facturas!inner(id, proveedor, categoria, estado, numero_comprobante, fecha_vencimiento)"
        )
        .eq("factura.periodo_mes", periodo.mes)
        .eq("factura.periodo_anio", periodo.anio);
      if (cancelado) return;
      const lista = ((data ?? []) as unknown as FilaLedger[]).map((f) => ({
        ...f,
        factura: Array.isArray(f.factura) ? f.factura[0] : f.factura,
      }));
      // Más reciente primero
      lista.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago));
      setPagos(lista);
      setExpandido(null);
      setSwipeado(null);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [periodo, version]);

  async function alternarDetalle(p: FilaLedger) {
    if (swipeado === p.id) {
      setSwipeado(null);
      return;
    }
    const abrir = expandido !== p.id;
    setExpandido(abrir ? p.id : null);
    if (abrir && p.imagen_url && !urls[p.imagen_url]) {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from(BUCKET_COMPROBANTES)
        .createSignedUrl(p.imagen_url, 3600);
      if (data?.signedUrl) {
        setUrls((u) => ({ ...u, [p.imagen_url!]: data.signedUrl }));
      }
    }
  }

  async function verComprobante(ruta: string) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .createSignedUrl(ruta, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function eliminar(p: FilaLedger) {
    if (!window.confirm(`¿Eliminar el pago a ${p.factura.proveedor}?`)) return;
    const supabase = createClient();
    const rutas = [p.imagen_url].filter((r): r is string => r !== null);

    if (p.factura.fecha_vencimiento === null) {
      // Factura creada sin datos reales (pago "sin factura previa"):
      // se borra entera, el comprobante cae en cascada.
      await supabase.from("facturas").delete().eq("id", p.factura.id);
    } else {
      await supabase.from("comprobantes_pago").delete().eq("id", p.id);
      await supabase
        .from("facturas")
        .update({ estado: "pendiente" })
        .eq("id", p.factura.id);
    }
    if (rutas.length > 0) {
      await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas);
    }
    setVersion((v) => v + 1);
  }

  function alTocar(e: React.TouchEvent) {
    const t = e.touches[0];
    toqueInicio.current = { x: t.clientX, y: t.clientY };
  }

  function alSoltar(e: React.TouchEvent, id: string) {
    if (!toqueInicio.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toqueInicio.current.x;
    const dy = t.clientY - toqueInicio.current.y;
    toqueInicio.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    setSwipeado(dx < 0 ? id : null);
  }

  const filtrados =
    pagos?.filter((p) => filtro === "todas" || p.factura.categoria === filtro) ??
    [];
  const totalGastado = filtrados.reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* Encabezado con resumen del período */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <button
          onClick={() => setPeriodo((p) => sumarMeses(p, -1))}
          aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">
            {MESES[periodo.mes - 1]} {periodo.anio}
          </p>
          <p className="text-xs text-gray-500">
            {formatMontoCompacto(totalGastado)} gastados ·{" "}
            {filtrados.length}{" "}
            {filtrados.length === 1 ? "pago registrado" : "pagos registrados"}
          </p>
        </div>
        <button
          onClick={() => setPeriodo((p) => sumarMeses(p, 1))}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Filtros rápidos por categoría */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {[["todas", "Todos"], ...Object.entries(CATEGORIAS)].map(
          ([valor, etiqueta]) => (
            <button
              key={valor}
              onClick={() => setFiltro(valor)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filtro === valor
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {etiqueta}
            </button>
          )
        )}
      </div>

      {/* Lista de pagos */}
      {pagos === null ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">
            No hay pagos en {MESES[periodo.mes - 1].toLowerCase()}
            {filtro !== "todas"
              ? ` para ${CATEGORIAS[filtro as Categoria].toLowerCase()}`
              : ""}
            .
          </p>
          <Link
            href="/facturas"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
          >
            Ir a Facturas
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtrados.map((p) => {
            const abierto = expandido === p.id;
            const deslizado = swipeado === p.id;
            const url = p.imagen_url ? (urls[p.imagen_url] ?? null) : null;
            const pdf = p.imagen_url?.toLowerCase().endsWith(".pdf") ?? false;
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                {/* Fila con swipe: acciones detrás, contenido delante */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-y-0 right-0 flex">
                    <button
                      type="button"
                      onClick={() => router.push(`/gastos/editar/${p.id}`)}
                      className="flex w-16 flex-col items-center justify-center gap-0.5 bg-primary text-[10px] font-semibold text-white"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                        />
                      </svg>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(p)}
                      className="flex w-16 flex-col items-center justify-center gap-0.5 bg-red-500 text-[10px] font-semibold text-white"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      Eliminar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => alternarDetalle(p)}
                    onTouchStart={alTocar}
                    onTouchEnd={(e) => alSoltar(e, p.id)}
                    aria-expanded={abierto}
                    className={`relative flex w-full items-center gap-3 bg-white p-3 text-left transition-transform duration-200 ${
                      deslizado ? "-translate-x-32" : ""
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${COLOR_CATEGORIA[p.factura.categoria]}`}
                    >
                      <CategoriaIcon categoria={p.factura.categoria} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {p.factura.proveedor}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fechaCorta(p.fecha_pago)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold tracking-tight text-gray-900">
                        {formatMonto(Number(p.monto))}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_ESTADO[p.factura.estado]}`}
                      >
                        {ETIQUETA_ESTADO[p.factura.estado]}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Detalle del comprobante */}
                {abierto ? (
                  <div className="border-t border-gray-100 px-4 py-3">
                    {p.imagen_url ? (
                      url && !pdf ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Comprobante de ${p.factura.proveedor}`}
                          className="mb-3 max-h-56 w-full rounded-xl bg-gray-50 object-contain"
                        />
                      ) : pdf ? (
                        <p className="mb-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                          📄 Comprobante en PDF adjunto
                        </p>
                      ) : (
                        <div className="mb-3 h-32 animate-pulse rounded-xl bg-gray-100" />
                      )
                    ) : null}

                    <dl className="flex flex-col gap-1.5 text-xs">
                      {[
                        ["Categoría", CATEGORIAS[p.factura.categoria]],
                        ["Método de pago", p.metodo_pago ?? "—"],
                        ["N° de factura", p.factura.numero_comprobante ?? "—"],
                        ["N° de operación", p.numero_operacion ?? "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <dt className="text-gray-500">{k}</dt>
                          <dd className="font-medium text-gray-800">{v}</dd>
                        </div>
                      ))}
                      {p.notas ? (
                        <div>
                          <dt className="text-gray-500">Notas</dt>
                          <dd className="mt-0.5 text-gray-800">{p.notas}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.imagen_url ? (
                        <button
                          type="button"
                          onClick={() => verComprobante(p.imagen_url!)}
                          className="rounded-xl bg-secondary-light px-3 py-2 text-xs font-semibold text-secondary active:bg-secondary/20"
                        >
                          Ver comprobante
                        </button>
                      ) : null}
                      <Link
                        href={`/gastos/editar/${p.id}`}
                        className="rounded-xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => eliminar(p)}
                        className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Panel de análisis */}
      <AnalisisMes periodo={periodo} />
    </div>
  );
}
