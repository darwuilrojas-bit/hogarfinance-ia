import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Aviso visible mientras no se configuren las credenciales
 * de Supabase en .env.local (modo demostración).
 */
export function SupabaseWarning() {
  if (isSupabaseConfigured) return null;

  return (
    <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
      <strong>Modo demostración:</strong> configurá tus credenciales de
      Supabase en <code className="font-mono">.env.local</code> para activar
      la autenticación real. Ver instrucciones en el README.
    </p>
  );
}
