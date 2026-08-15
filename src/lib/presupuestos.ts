import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Presupuesto de un mes concreto.
 *
 * Cada mes puede tener el suyo (tabla `presupuestos`). Los meses que no
 * tengan uno propio usan el número global de `usuarios.presupuesto_mensual`
 * como valor por defecto, para que lo ya configurado siga funcionando.
 */
export type PresupuestoMes = {
  /** El importe a usar, venga del mes o del valor por defecto. */
  monto: number | null;
  /** true si ese mes tiene un presupuesto propio cargado. */
  propio: boolean;
};

/** Lee el presupuesto de un mes, con el global como valor por defecto. */
export async function presupuestoDelMes(
  supabase: SupabaseClient,
  mes: number,
  anio: number
): Promise<PresupuestoMes> {
  const [delMes, perfil] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("monto")
      .eq("mes", mes)
      .eq("anio", anio)
      .maybeSingle(),
    supabase.from("usuarios").select("presupuesto_mensual").single(),
  ]);

  if (delMes.data?.monto != null) {
    return { monto: Number(delMes.data.monto), propio: true };
  }
  const global = perfil.data?.presupuesto_mensual;
  return { monto: global != null ? Number(global) : null, propio: false };
}

/**
 * Guarda el presupuesto de un mes. Con `monto` en null se borra el del mes
 * y vuelve a regir el valor por defecto.
 */
export async function guardarPresupuestoDelMes(
  supabase: SupabaseClient,
  usuarioId: string,
  mes: number,
  anio: number,
  monto: number | null
): Promise<{ error: string | null }> {
  if (monto === null) {
    const { error } = await supabase
      .from("presupuestos")
      .delete()
      .eq("mes", mes)
      .eq("anio", anio);
    if (error) console.error("Error al borrar el presupuesto del mes:", error);
    return { error: error ? "No pudimos borrar el presupuesto." : null };
  }

  const { error } = await supabase
    .from("presupuestos")
    .upsert(
      { usuario_id: usuarioId, mes, anio, monto, fecha_actualizacion: new Date().toISOString() },
      { onConflict: "usuario_id,mes,anio" }
    );
  if (error) console.error("Error al guardar el presupuesto del mes:", error);
  return { error: error ? "No pudimos guardar el presupuesto." : null };
}
