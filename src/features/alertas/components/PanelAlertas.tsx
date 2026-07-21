"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MESES_CORTOS } from "@/lib/formato";
import type { Alerta, TipoAlerta } from "@/lib/supabase/types";
import { ordenarPorUrgencia } from "../lib/prioridad";

const ESTILO_TIPO: Record<TipoAlerta, { fondo: string; texto: string; etiqueta: string }> = {
  presupuesto: { fondo: "bg-red-50", texto: "text-red-600", etiqueta: "Presupuesto" },
  vencimiento: { fondo: "bg-orange-50", texto: "text-orange-600", etiqueta: "Vencimiento" },
  anomalia: { fondo: "bg-amber-100", texto: "text-amber-700", etiqueta: "Anomalía" },
  resumen: { fondo: "bg-primary-light", texto: "text-primary", etiqueta: "Resumen mensual" },
};

function IconoTipo({ tipo }: { tipo: TipoAlerta }) {
  const d =
    tipo === "vencimiento"
      ? "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      : tipo === "presupuesto"
        ? "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
        : tipo === "resumen"
          ? "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          : "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z";
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function fechaCorta(iso: string): string {
  const f = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (f.toDateString() === hoy.toDateString()) return "Hoy";
  if (f.toDateString() === ayer.toDateString()) return "Ayer";
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
}

/**
 * Panel de notificaciones: alertas activas primero (ordenadas por
 * urgencia), luego las ya leídas. Permite marcar de a una o todas.
 */
export function PanelAlertas() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [marcando, setMarcando] = useState(false);
  // Incrementar `version` fuerza una recarga de la lista
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("alertas")
        .select("*")
        .order("fecha_alerta", { ascending: false })
        .limit(50);
      if (cancelado) return;
      // Puntaje formal de urgencia: peso por tipo con decaimiento
      // temporal (docs/especificacion-analitica.md §3)
      setAlertas(ordenarPorUrgencia((data as Alerta[]) ?? []));
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [version]);

  async function marcarLeida(id: string) {
    const supabase = createClient();
    await supabase.from("alertas").update({ leida: true }).eq("id", id);
    window.dispatchEvent(new Event("alertas-actualizadas"));
    setVersion((v) => v + 1);
  }

  async function marcarTodas() {
    setMarcando(true);
    const supabase = createClient();
    await supabase.from("alertas").update({ leida: true }).eq("leida", false);
    window.dispatchEvent(new Event("alertas-actualizadas"));
    setVersion((v) => v + 1);
    setMarcando(false);
  }

  if (alertas === null) {
    return (
      <div className="flex flex-col gap-2 px-5 py-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const sinLeer = alertas.filter((a) => !a.leida);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {sinLeer.length > 0 ? (
        <button
          type="button"
          onClick={marcarTodas}
          disabled={marcando}
          className="self-end text-xs font-semibold text-primary disabled:opacity-50"
        >
          Marcar todas como leídas
        </button>
      ) : null}

      {alertas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          No tenés notificaciones. Acá van a aparecer los avisos de
          vencimientos, montos inusuales y presupuesto.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {alertas.map((a) => {
            const estilo = ESTILO_TIPO[a.tipo];
            return (
              <li
                key={a.id}
                className={`flex items-start gap-3 rounded-2xl border p-3 ${
                  a.leida
                    ? "border-gray-100 bg-white opacity-60"
                    : "border-gray-100 bg-white shadow-sm"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${estilo.fondo} ${estilo.texto}`}
                >
                  <IconoTipo tipo={a.tipo} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${estilo.fondo} ${estilo.texto}`}
                    >
                      {estilo.etiqueta}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {fechaCorta(a.fecha_alerta)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-gray-800">
                    {a.mensaje}
                  </p>
                </div>
                {!a.leida ? (
                  <button
                    type="button"
                    onClick={() => marcarLeida(a.id)}
                    aria-label="Marcar como leída"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
                  >
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
