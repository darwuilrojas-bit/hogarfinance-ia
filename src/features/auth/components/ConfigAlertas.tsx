"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Prefs = {
  alertas_vencimiento: boolean;
  alertas_dias_anticipacion: number;
  alertas_anomalia: boolean;
  alertas_presupuesto: boolean;
};

const PREFS_DEFECTO: Prefs = {
  alertas_vencimiento: true,
  alertas_dias_anticipacion: 7,
  alertas_anomalia: true,
  alertas_presupuesto: true,
};

/** Interruptor estilo app móvil. */
function Toggle({
  activo,
  onCambio,
  etiqueta,
}: {
  activo: boolean;
  onCambio: (valor: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambio(!activo)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        activo ? "bg-secondary" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
          activo ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/**
 * Configuración de alertas: qué avisos genera el motor y con cuánta
 * anticipación. Cada cambio se guarda automáticamente.
 */
export function ConfigAlertas() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase.from("usuarios").select("*").single();
      if (cancelado) return;
      setPrefs({
        alertas_vencimiento:
          data?.alertas_vencimiento ?? PREFS_DEFECTO.alertas_vencimiento,
        alertas_dias_anticipacion:
          data?.alertas_dias_anticipacion ??
          PREFS_DEFECTO.alertas_dias_anticipacion,
        alertas_anomalia:
          data?.alertas_anomalia ?? PREFS_DEFECTO.alertas_anomalia,
        alertas_presupuesto:
          data?.alertas_presupuesto ?? PREFS_DEFECTO.alertas_presupuesto,
      });
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function cambiar(cambio: Partial<Prefs>) {
    if (!prefs) return;
    const nuevas = { ...prefs, ...cambio };
    setPrefs(nuevas);
    setGuardado(false);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: errorDb } = await supabase
      .from("usuarios")
      .update(cambio)
      .eq("id", user.id);
    if (errorDb) {
      setError(
        "No se pudo guardar. Si es la primera vez, ejecutá la migración supabase/migracion-perfil.sql en el SQL Editor."
      );
      return;
    }
    setGuardado(true);
  }

  if (prefs === null) {
    return <div className="h-56 animate-pulse rounded-2xl bg-gray-100" />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Configuración de alertas
        </h2>
        {guardado ? (
          <span className="text-xs font-medium text-secondary">✓ Guardado</span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Alertas de vencimiento
          </p>
          <p className="text-xs text-gray-500">
            Avisos cuando un servicio está por vencer
          </p>
        </div>
        <Toggle
          activo={prefs.alertas_vencimiento}
          onCambio={(v) => cambiar({ alertas_vencimiento: v })}
          etiqueta="Activar alertas de vencimiento"
        />
      </div>

      {prefs.alertas_vencimiento ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-800">
            Avisar con anticipación de
          </p>
          <select
            aria-label="Días de anticipación"
            value={prefs.alertas_dias_anticipacion}
            onChange={(e) =>
              cambiar({ alertas_dias_anticipacion: Number(e.target.value) })
            }
            className="h-10 appearance-none rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {[3, 5, 7, 10].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Montos inusuales</p>
          <p className="text-xs text-gray-500">
            Cuando un gasto supere en 20% tu promedio histórico
          </p>
        </div>
        <Toggle
          activo={prefs.alertas_anomalia}
          onCambio={(v) => cambiar({ alertas_anomalia: v })}
          etiqueta="Alertar montos inusuales"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Límite de presupuesto
          </p>
          <p className="text-xs text-gray-500">
            Cuando el gasto del mes supere el 90% del presupuesto
          </p>
        </div>
        <Toggle
          activo={prefs.alertas_presupuesto}
          onCambio={(v) => cambiar({ alertas_presupuesto: v })}
          etiqueta="Alertar límite de presupuesto"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
