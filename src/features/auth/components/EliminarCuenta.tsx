"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_COMPROBANTES } from "@/lib/supabase/types";

/**
 * Eliminación definitiva de la cuenta: borra los archivos del bucket
 * y llama a la función SQL eliminar_mi_cuenta(), que elimina la
 * cuenta de auth y todos los datos en cascada.
 */
export function EliminarCuenta() {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    setError(null);
    if (
      !window.confirm(
        "⚠️ Vas a eliminar tu cuenta y TODOS tus datos: gastos, comprobantes, proveedores y alertas. Esta acción no se puede deshacer. ¿Continuar?"
      )
    )
      return;
    const escrito = window.prompt(
      'Para confirmar, escribí ELIMINAR en mayúsculas:'
    );
    if (escrito !== "ELIMINAR") return;

    setEliminando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEliminando(false);
      return setError("Tu sesión expiró. Volvé a iniciar sesión.");
    }

    // 1) Archivos del bucket (por las dudas, además del respaldo en SQL)
    const { data: archivos } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .list(user.id, { limit: 1000 });
    if (archivos && archivos.length > 0) {
      await supabase.storage
        .from(BUCKET_COMPROBANTES)
        .remove(archivos.map((a) => `${user.id}/${a.name}`));
    }

    // 2) Cuenta y datos en cascada
    const { error: errorRpc } = await supabase.rpc("eliminar_mi_cuenta");
    if (errorRpc) {
      setEliminando(false);
      return setError(
        "No se pudo eliminar la cuenta. Verificá que la migración supabase/migracion-perfil.sql esté ejecutada."
      );
    }

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={eliminar}
        disabled={eliminando}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-base font-semibold text-red-600 transition-colors active:bg-red-50 disabled:opacity-50"
      >
        {eliminando ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
        ) : null}
        Eliminar mi cuenta
      </button>
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
