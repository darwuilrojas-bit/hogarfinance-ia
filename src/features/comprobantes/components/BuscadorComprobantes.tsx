"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import {
  formatMonto,
  formatMontoCompacto,
  MESES,
  MESES_CORTOS,
} from "@/lib/formato";
import { BUCKET_COMPROBANTES, CATEGORIAS } from "@/lib/supabase/types";
import type { Categoria, EstadoFactura } from "@/lib/supabase/types";

type FacturaEmbebida = {
  proveedor: string;
  categoria: Categoria;
  periodo_mes: number;
  periodo_anio: number;
  estado: EstadoFactura;
  numero_comprobante: string | null;
  fecha_vencimiento: string | null;
};

type ComprobanteRow = {
  id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string | null;
  numero_operacion: string | null;
  imagen_url: string | null;
  factura: FacturaEmbebida;
};

type Filtros = {
  proveedor: string;
  mes: number; // 0 = todos
  anio: number; // 0 = todos
  categoria: string;
  estado: string;
};

const SIN_FILTROS: Filtros = {
  proveedor: "todos",
  mes: 0,
  anio: 0,
  categoria: "todas",
  estado: "todos",
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

const claseSelect =
  "h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const f = new Date(`${iso}T00:00:00`);
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}`;
}

function esPdf(ruta: string): boolean {
  return ruta.toLowerCase().endsWith(".pdf");
}

/** Miniatura del comprobante (imagen firmada o ícono de PDF/sin imagen). */
function Miniatura({ url, pdf }: { url: string | null; pdf: boolean }) {
  if (url && !pdf) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-xl bg-gray-100 object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    </div>
  );
}

/**
 * Buscador de comprobantes de pago: filtros combinables, búsqueda
 * rápida en tiempo real, resultados con miniatura y vista expandida
 * con imagen, historial del proveedor y acciones (descargar, reclamar).
 */
export function BuscadorComprobantes() {
  const [comprobantes, setComprobantes] = useState<ComprobanteRow[] | null>(null);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const [borrador, setBorrador] = useState<Filtros>(SIN_FILTROS);
  const [aplicados, setAplicados] = useState<Filtros>(SIN_FILTROS);
  const [texto, setTexto] = useState("");

  const [expandido, setExpandido] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const [comprobantesRes, provRes] = await Promise.all([
        supabase
          .from("comprobantes_pago")
          .select(
            "id, monto, fecha_pago, metodo_pago, numero_operacion, imagen_url, factura:facturas(proveedor, categoria, periodo_mes, periodo_anio, estado, numero_comprobante, fecha_vencimiento)"
          )
          .order("fecha_pago", { ascending: false })
          .limit(500),
        supabase.from("proveedores").select("nombre").order("nombre"),
      ]);
      if (cancelado) return;
      const lista = ((comprobantesRes.data ?? []) as unknown as ComprobanteRow[]).filter(
        (c) => c.factura !== null
      );
      setComprobantes(lista);
      setProveedores((provRes.data ?? []).map((p) => p.nombre));

      // URLs firmadas para las miniaturas, en una sola llamada
      const rutas = lista
        .map((c) => c.imagen_url)
        .filter((r): r is string => r !== null);
      if (rutas.length > 0) {
        const { data: firmadas } = await supabase.storage
          .from(BUCKET_COMPROBANTES)
          .createSignedUrls(rutas, 3600);
        if (cancelado) return;
        const mapa: Record<string, string> = {};
        for (const f of firmadas ?? []) {
          if (f.path && f.signedUrl) mapa[f.path] = f.signedUrl;
        }
        setUrls(mapa);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [version]);

  async function marcarReclamado(c: ComprobanteRow) {
    const supabase = createClient();
    const { data } = await supabase
      .from("comprobantes_pago")
      .select("factura_id")
      .eq("id", c.id)
      .single();
    if (data) {
      await supabase
        .from("facturas")
        .update({ estado: "reclamado" })
        .eq("id", data.factura_id);
    }
    setVersion((v) => v + 1);
  }

  async function eliminar(c: ComprobanteRow) {
    if (
      !window.confirm(
        `¿Eliminar este comprobante de pago de ${c.factura.proveedor}?`
      )
    )
      return;
    const supabase = createClient();
    const { data } = await supabase
      .from("comprobantes_pago")
      .select("factura_id")
      .eq("id", c.id)
      .single();
    const rutas = [c.imagen_url].filter((r): r is string => r !== null);

    if (data && c.factura.fecha_vencimiento === null) {
      // Factura creada "sin factura previa" (standalone): se borra
      // entera, el comprobante cae solo en cascada.
      await supabase.from("facturas").delete().eq("id", data.factura_id);
    } else {
      await supabase.from("comprobantes_pago").delete().eq("id", c.id);
      if (data) {
        await supabase
          .from("facturas")
          .update({ estado: "pendiente" })
          .eq("id", data.factura_id);
      }
    }
    if (rutas.length > 0) {
      await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas);
    }
    setVersion((v) => v + 1);
  }

  async function descargar(c: ComprobanteRow) {
    if (!c.imagen_url) return;
    const supabase = createClient();
    const { data } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .createSignedUrl(c.imagen_url, 300, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const anios = [
    ...new Set((comprobantes ?? []).map((c) => c.factura.periodo_anio)),
  ].sort((a, b) => b - a);

  const t = texto.trim().toLowerCase();
  const resultados = (comprobantes ?? []).filter(
    (c) =>
      (aplicados.proveedor === "todos" ||
        c.factura.proveedor === aplicados.proveedor) &&
      (aplicados.mes === 0 || c.factura.periodo_mes === aplicados.mes) &&
      (aplicados.anio === 0 || c.factura.periodo_anio === aplicados.anio) &&
      (aplicados.categoria === "todas" ||
        c.factura.categoria === aplicados.categoria) &&
      (aplicados.estado === "todos" || c.factura.estado === aplicados.estado) &&
      (t === "" ||
        c.factura.proveedor.toLowerCase().includes(t) ||
        (c.numero_operacion ?? "").toLowerCase().includes(t) ||
        (c.factura.numero_comprobante ?? "").toLowerCase().includes(t))
  );

  const hayFiltros =
    JSON.stringify(aplicados) !== JSON.stringify(SIN_FILTROS) || t !== "";

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* Búsqueda rápida en tiempo real */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por proveedor o n° de comprobante…"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Barra de filtros */}
      <details className="rounded-2xl border border-gray-100 bg-white shadow-sm open:pb-4">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
          Filtros
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="flex flex-col gap-3 px-4">
          <select
            aria-label="Proveedor"
            value={borrador.proveedor}
            onChange={(e) =>
              setBorrador({ ...borrador, proveedor: e.target.value })
            }
            className={claseSelect}
          >
            <option value="todos">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              aria-label="Mes del período"
              value={borrador.mes}
              onChange={(e) =>
                setBorrador({ ...borrador, mes: Number(e.target.value) })
              }
              className={claseSelect}
            >
              <option value={0}>Todos los meses</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Año del período"
              value={borrador.anio}
              onChange={(e) =>
                setBorrador({ ...borrador, anio: Number(e.target.value) })
              }
              className={claseSelect}
            >
              <option value={0}>Todos los años</option>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              aria-label="Categoría"
              value={borrador.categoria}
              onChange={(e) =>
                setBorrador({ ...borrador, categoria: e.target.value })
              }
              className={claseSelect}
            >
              <option value="todas">Todas las categorías</option>
              {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <select
              aria-label="Estado"
              value={borrador.estado}
              onChange={(e) =>
                setBorrador({ ...borrador, estado: e.target.value })
              }
              className={claseSelect}
            >
              <option value="todos">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="reclamado">Reclamado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAplicados(borrador)}
              className="h-11 rounded-xl bg-primary text-sm font-semibold text-white active:bg-primary-dark"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setBorrador(SIN_FILTROS);
                setAplicados(SIN_FILTROS);
                setTexto("");
              }}
              className="h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600 active:bg-gray-200"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </details>

      {/* Resultados */}
      {comprobantes === null ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {resultados.length}{" "}
            {resultados.length === 1
              ? "comprobante encontrado"
              : "comprobantes encontrados"}
            {hayFiltros ? " con los filtros aplicados" : ""}
          </p>

          {resultados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
              {comprobantes.length === 0
                ? "Todavía no registraste pagos. Agregá el primero desde Facturas."
                : "Ningún comprobante coincide con la búsqueda. Probá con otros filtros."}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {resultados.map((c) => {
                const abierto = expandido === c.id;
                const url = c.imagen_url ? (urls[c.imagen_url] ?? null) : null;
                const pdf = c.imagen_url ? esPdf(c.imagen_url) : false;
                const historial = (comprobantes ?? []).filter(
                  (x) => x.factura.proveedor === c.factura.proveedor && x.id !== c.id
                );
                return (
                  <li
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandido(abierto ? null : c.id)}
                      aria-expanded={abierto}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <Miniatura url={url} pdf={pdf} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {c.factura.proveedor}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          <CategoriaIcon
                            categoria={c.factura.categoria}
                            className="h-3.5 w-3.5"
                          />
                          {CATEGORIAS[c.factura.categoria]} ·{" "}
                          {MESES_CORTOS[c.factura.periodo_mes - 1]}{" "}
                          {c.factura.periodo_anio}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_ESTADO[c.factura.estado]}`}
                        >
                          {ETIQUETA_ESTADO[c.factura.estado]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-gray-900">
                          {formatMontoCompacto(Number(c.monto))}
                        </p>
                        <svg
                          className={`h-4 w-4 text-gray-400 transition-transform ${abierto ? "rotate-180" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>

                    {abierto ? (
                      <div className="border-t border-gray-100 px-4 py-4">
                        {/* Imagen completa con zoom al tocar */}
                        {url && !pdf ? (
                          <button
                            type="button"
                            onClick={() => setZoom(url)}
                            className="mb-3 w-full"
                            aria-label="Ampliar comprobante"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Comprobante de ${c.factura.proveedor}`}
                              className="max-h-64 w-full rounded-xl bg-gray-50 object-contain"
                            />
                            <span className="mt-1 block text-center text-[10px] text-gray-400">
                              Tocá la imagen para ampliar
                            </span>
                          </button>
                        ) : null}

                        {/* Datos del pago */}
                        <dl className="flex flex-col gap-1.5 text-xs">
                          {[
                            ["Proveedor", c.factura.proveedor],
                            ["Categoría", CATEGORIAS[c.factura.categoria]],
                            [
                              "Período",
                              `${MESES[c.factura.periodo_mes - 1]} ${c.factura.periodo_anio}`,
                            ],
                            ["Fecha de pago", fechaLegible(c.fecha_pago)],
                            ["Monto", formatMonto(Number(c.monto))],
                            ["Método de pago", c.metodo_pago ?? "—"],
                            ["N° de factura", c.factura.numero_comprobante ?? "—"],
                            ["N° de operación", c.numero_operacion ?? "—"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3">
                              <dt className="text-gray-500">{k}</dt>
                              <dd className="text-right font-medium text-gray-800">
                                {v}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        {/* Historial del proveedor */}
                        {historial.length > 0 ? (
                          <div className="mt-3">
                            <p className="mb-1.5 text-xs font-semibold text-gray-900">
                              Historial de {c.factura.proveedor}
                            </p>
                            <div className="overflow-hidden rounded-xl border border-gray-100">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-gray-50 text-left text-gray-500">
                                    <th className="px-2.5 py-1.5 font-medium">
                                      Período
                                    </th>
                                    <th className="px-2.5 py-1.5 font-medium">
                                      Pago
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                      Monto
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                      Estado
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historial.slice(0, 8).map((h) => (
                                    <tr
                                      key={h.id}
                                      className="border-t border-gray-50 text-gray-700"
                                    >
                                      <td className="px-2.5 py-1.5">
                                        {MESES_CORTOS[h.factura.periodo_mes - 1]}{" "}
                                        {h.factura.periodo_anio}
                                      </td>
                                      <td className="px-2.5 py-1.5">
                                        {fechaLegible(h.fecha_pago)}
                                      </td>
                                      <td className="px-2.5 py-1.5 text-right font-medium">
                                        {formatMontoCompacto(Number(h.monto))}
                                      </td>
                                      <td className="px-2.5 py-1.5 text-right">
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CHIP_ESTADO[h.factura.estado]}`}
                                        >
                                          {ETIQUETA_ESTADO[h.factura.estado]}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}

                        {/* Acciones */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {c.imagen_url ? (
                            <button
                              type="button"
                              onClick={() => descargar(c)}
                              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white active:bg-primary-dark"
                            >
                              Descargar comprobante
                            </button>
                          ) : null}
                          <Link
                            href={`/comprobantes/reporte/${c.id}`}
                            className="rounded-xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                          >
                            Generar reporte PDF
                          </Link>
                          {c.factura.estado !== "reclamado" ? (
                            <button
                              type="button"
                              onClick={() => marcarReclamado(c)}
                              className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 active:bg-amber-100"
                            >
                              Marcar como Reclamado
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => eliminar(c)}
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
        </>
      )}

      {/* Lightbox: imagen ampliada */}
      {zoom ? (
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
          aria-label="Cerrar imagen ampliada"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt="Comprobante ampliado"
            className="max-h-full max-w-full object-contain"
          />
        </button>
      ) : null}
    </div>
  );
}
