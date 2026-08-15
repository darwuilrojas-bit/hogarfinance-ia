"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mesDeIso } from "@/lib/fechas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  formatMontoCompacto,
  periodoActual,
  sumarMeses,
} from "@/lib/formato";

/**
 * Secciones "Datos del usuario" y "Configuración de presupuesto":
 * nombre editable, email de solo lectura y presupuesto mensual,
 * cada una con su propio botón de guardado.
 */
export function PerfilForm() {
  const [email, setEmail] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [cargando, setCargando] = useState(true);

  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [mensajeDatos, setMensajeDatos] = useState<string | null>(null);
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);
  const [mensajePresupuesto, setMensajePresupuesto] = useState<string | null>(
    null
  );
  const [sugerencia, setSugerencia] = useState<{
    promedio: number;
    sugerido: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const [perfilRes, gastosRes] = await Promise.all([
        supabase
          .from("usuarios")
          .select("email, nombre, presupuesto_mensual")
          .single(),
        // Por fecha de pago, igual que el resumen del dashboard: la
        // sugerencia tiene que medir lo mismo que después se compara.
        supabase.from("comprobantes_pago").select("monto, fecha_pago"),
      ]);
      if (cancelado) return;
      const data = perfilRes.data;
      setEmail(data?.email ?? null);
      setNombre(data?.nombre ?? "");
      setPresupuesto(
        data?.presupuesto_mensual ? String(data.presupuesto_mensual) : ""
      );

      const pagos = ((gastosRes.data ?? []) as unknown as Array<{
        monto: number;
        fecha_pago: string;
      }>).map((p) => ({
        monto: Number(p.monto),
        ...mesDeIso(p.fecha_pago),
      }));

      // Sugerencia inteligente: promedio de gasto de los últimos 3 meses
      const actual = periodoActual();
      const ventana = [1, 2, 3].map((n) => sumarMeses(actual, -n));
      const totalesMes = ventana
        .map((p) =>
          pagos
            .filter((g) => g.mes === p.mes && g.anio === p.anio)
            .reduce((s, g) => s + g.monto, 0)
        )
        .filter((t) => t > 0);
      if (totalesMes.length > 0) {
        const promedio =
          totalesMes.reduce((s, t) => s + t, 0) / totalesMes.length;
        setSugerencia({
          promedio,
          sugerido: Math.round(promedio * 1.1),
        });
      }
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function actualizar(valores: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión expiró. Volvé a iniciar sesión.");
      return false;
    }
    const { error: errorDb } = await supabase
      .from("usuarios")
      .update(valores)
      .eq("id", user.id);
    if (errorDb) {
      setError("No se pudo guardar. Intentá de nuevo.");
      return false;
    }
    return true;
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setMensajeDatos(null);
    setGuardandoDatos(true);
    const ok = await actualizar({ nombre: nombre.trim() || null });
    setGuardandoDatos(false);
    if (ok) setMensajeDatos("Datos guardados.");
  }

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault();
    setMensajePresupuesto(null);
    const valor = presupuesto === "" ? null : Number(presupuesto);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      return setError("El presupuesto no es válido.");
    }
    setGuardandoPresupuesto(true);
    const ok = await actualizar({ presupuesto_mensual: valor });
    setGuardandoPresupuesto(false);
    if (ok) {
      setMensajePresupuesto(
        valor
          ? `Presupuesto guardado: ${formatMontoCompacto(valor)} por mes.`
          : "Presupuesto eliminado."
      );
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Datos del usuario */}
      <form
        onSubmit={guardarDatos}
        className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-lg font-bold text-primary">
            {(nombre || email || "U").charAt(0).toUpperCase()}
          </div>
          <h2 className="text-sm font-semibold text-gray-900">
            Datos del usuario
          </h2>
        </div>
        <Input
          label="Nombre"
          type="text"
          placeholder="¿Cómo te llamamos?"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={email ?? ""}
          readOnly
          disabled
          className="bg-gray-50 text-gray-500"
        />
        {mensajeDatos ? (
          <p className="rounded-xl bg-secondary-light px-4 py-3 text-sm text-secondary-dark">
            ✓ {mensajeDatos}
          </p>
        ) : null}
        <Button type="submit" loading={guardandoDatos}>
          Guardar cambios
        </Button>
      </form>

      {/* 2. Configuración de presupuesto */}
      <form
        onSubmit={guardarPresupuesto}
        className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">
          Presupuesto mensual
        </h2>
        <Input
          label="Presupuesto del hogar (en pesos)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="Ej.: 500000"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
        />
        <p className="-mt-2 text-xs text-gray-500">
          Te avisaremos cuando estés cerca de alcanzarlo.
        </p>

        {sugerencia ? (
          <div className="rounded-xl bg-primary-light px-4 py-3">
            <p className="text-xs leading-relaxed text-primary-dark">
              💡 Basado en tus últimos 3 meses, tu gasto promedio fue{" "}
              <strong>{formatMontoCompacto(sugerencia.promedio)}</strong>. Te
              sugerimos un presupuesto de{" "}
              <strong>{formatMontoCompacto(sugerencia.sugerido)}</strong> (10%
              de margen).
            </p>
            <button
              type="button"
              onClick={() => setPresupuesto(String(sugerencia.sugerido))}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white active:bg-primary-dark"
            >
              Usar sugerencia
            </button>
          </div>
        ) : null}
        {mensajePresupuesto ? (
          <p className="rounded-xl bg-secondary-light px-4 py-3 text-sm text-secondary-dark">
            ✓ {mensajePresupuesto}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" loading={guardandoPresupuesto}>
          Guardar presupuesto
        </Button>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
